import { supabase } from '@/lib/supabaseClient';
import { FREE_RECIPE_STATUS } from '@/lib/recipeEntity';

const toNumeric = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const sanitizeIngredient = (ingredient) => {
  const grams = toNumeric(ingredient?.grams ?? ingredient?.quantity);
  const foodId = ingredient?.food_id == null || ingredient?.food_id === ''
    ? null
    : Number.parseInt(ingredient.food_id, 10);

  if (!grams || grams <= 0) return null;

  const isFreeIngredient = !foodId || ingredient?.is_free;

  return {
    food_id: isFreeIngredient ? null : foodId,
    grams,
    status: isFreeIngredient ? 'pending' : 'linked',
  };
};

const buildIngredientRows = (freeRecipeId, ingredients = []) => {
  return ingredients
    .map(sanitizeIngredient)
    .filter(Boolean)
    .map((ingredient) => ({
      free_recipe_id: freeRecipeId,
      food_id: ingredient.food_id,
      grams: ingredient.grams,
      status: ingredient.status,
    }));
};

const resolveUserDayMealId = async ({ userId, dayMealId, dietPlanId, mealDate }) => {
  const numericDayMealId = Number.parseInt(dayMealId, 10);
  if (!numericDayMealId) {
    throw new Error('No se pudo resolver el momento del dia para el registro.');
  }

  let query = supabase
    .from('user_day_meals')
    .select('id, diet_plan_id')
    .eq('user_id', userId)
    .eq('day_meal_id', numericDayMealId);

  if (dietPlanId) {
    query = query.eq('diet_plan_id', dietPlanId);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('No existe configuracion de comida para ese plan.');
    return data.id;
  }

  const { data: rows, error } = await query;
  if (error) throw error;

  if (!rows || rows.length === 0) {
    throw new Error('No se encontro configuracion de comida para el usuario.');
  }

  if (rows.length === 1) return rows[0].id;

  const { data: activePlan, error: planError } = await supabase
    .from('diet_plans')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .lte('start_date', mealDate)
    .gte('end_date', mealDate)
    .maybeSingle();

  if (!planError && activePlan?.id) {
    const matching = rows.find((row) => row.diet_plan_id === activePlan.id);
    if (matching) return matching.id;
  }

  return rows[0].id;
};

const upsertFreeRecipeHeader = async ({
  userId,
  dayMealId,
  dietPlanId,
  recipeId,
  recipe,
  defaultStatus = FREE_RECIPE_STATUS.PENDING,
}) => {
  const numericDayMealId = Number.parseInt(dayMealId, 10);
  const numericPrepTime = recipe.prep_time_min ? Number.parseInt(recipe.prep_time_min, 10) : null;

  const payload = {
    user_id: userId,
    day_meal_id: Number.isFinite(numericDayMealId) ? numericDayMealId : null,
    diet_plan_id: dietPlanId || null,
    name: recipe.name,
    instructions: recipe.instructions || null,
    prep_time_min: Number.isFinite(numericPrepTime) ? numericPrepTime : null,
    difficulty: recipe.difficulty || null,
    status: recipe.status || defaultStatus,
  };

  if (recipe.parent_recipe_id) payload.parent_recipe_id = recipe.parent_recipe_id;
  if (recipe.parent_free_recipe_id) payload.parent_free_recipe_id = recipe.parent_free_recipe_id;

  if (recipeId) {
    const { data, error } = await supabase
      .from('free_recipes')
      .update(payload)
      .eq('id', recipeId)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('free_recipes')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return data;
};

const replaceIngredients = async ({ freeRecipeId, ingredients }) => {
  const { error: deleteError } = await supabase
    .from('free_recipe_ingredients')
    .delete()
    .eq('free_recipe_id', freeRecipeId);

  if (deleteError) throw deleteError;

  const rows = buildIngredientRows(freeRecipeId, ingredients);
  if (rows.length === 0) return [];

  const { data, error } = await supabase
    .from('free_recipe_ingredients')
    .insert(rows)
    .select('*, food(*)');

  if (error) throw error;
  return data || [];
};

const upsertOccurrence = async ({ occurrenceId, freeRecipeId, userId, mealDate, dayMealId }) => {
  const payload = {
    free_recipe_id: freeRecipeId,
    user_id: userId,
    meal_date: mealDate,
    day_meal_id: Number.parseInt(dayMealId, 10),
  };

  if (occurrenceId) {
    const { data, error } = await supabase
      .from('free_recipe_occurrences')
      .update(payload)
      .eq('id', occurrenceId)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('free_recipe_occurrences')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return data;
};

const upsertMealLog = async ({ userId, mealDate, userDayMealId, occurrenceId }) => {
  const { data, error } = await supabase
    .from('daily_meal_logs')
    .upsert(
      {
        user_id: userId,
        log_date: mealDate,
        user_day_meal_id: userDayMealId,
        free_recipe_occurrence_id: occurrenceId,
        diet_plan_recipe_id: null,
        private_recipe_id: null,
      },
      { onConflict: 'user_id,log_date,user_day_meal_id' }
    )
    .select('*')
    .single();

  if (error) throw error;
  return data;
};

export const persistFreeRecipeDefinition = async ({
  userId,
  dayMealId,
  dietPlanId,
  recipe,
  ingredients,
  recipeId,
  defaultStatus,
}) => {
  const freeRecipe = await upsertFreeRecipeHeader({
    userId,
    dayMealId,
    dietPlanId,
    recipeId,
    recipe,
    defaultStatus,
  });

  const savedIngredients = await replaceIngredients({
    freeRecipeId: freeRecipe.id,
    ingredients,
  });

  return {
    freeRecipe,
    ingredients: savedIngredients,
  };
};

export const fetchFreeRecipeDetails = async (freeRecipeId) => {
  const numericId = Number.parseInt(freeRecipeId, 10);
  if (!numericId) {
    throw new Error('ID de receta libre invalido.');
  }

  const { data, error } = await supabase
    .from('free_recipes')
    .select(`
      *,
      day_meal:day_meal_id(id, name, display_order),
      ingredients:free_recipe_ingredients(
        *,
        food:food_id(
          *,
          food_to_food_groups(food_group_id)
        )
      )
    `)
    .eq('id', numericId)
    .single();

  if (error) throw error;
  return data;
};

export const persistFreeRecipeOccurrence = async ({
  userId,
  dayMealId,
  mealDate,
  dietPlanId,
  recipe,
  ingredients,
  recipeId,
  occurrenceId,
  defaultStatus,
}) => {
  const freeRecipe = await upsertFreeRecipeHeader({
    userId,
    dayMealId,
    dietPlanId,
    recipeId,
    recipe,
    defaultStatus,
  });

  const savedIngredients = await replaceIngredients({
    freeRecipeId: freeRecipe.id,
    ingredients,
  });

  const occurrence = await upsertOccurrence({
    occurrenceId,
    freeRecipeId: freeRecipe.id,
    userId,
    mealDate,
    dayMealId,
  });

  const userDayMealId = await resolveUserDayMealId({
    userId,
    dayMealId,
    dietPlanId: freeRecipe.diet_plan_id,
    mealDate,
  });

  const mealLog = await upsertMealLog({
    userId,
    mealDate,
    userDayMealId,
    occurrenceId: occurrence.id,
  });

  return {
    freeRecipe,
    ingredients: savedIngredients,
    occurrence,
    mealLog,
  };
};
