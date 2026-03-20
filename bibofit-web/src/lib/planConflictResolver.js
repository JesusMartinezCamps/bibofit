import { supabase } from '@/lib/supabaseClient';
import { getConflictInfo, getConflictWithSubstitutions, prefetchSubstitutionMappings } from '@/lib/restrictionChecker';

export const CRITICAL_CONFLICT_TYPES = new Set([
  'condition_avoid',
  'sensitivity',
  'individual_restriction',
  'non-preferred',
  'diet_type_excluded',
]);

export const fetchClientRestrictionsForUser = async (userId) => {
  if (!userId) {
    return {
      sensitivities: [],
      conditions: [],
      medical_conditions: [],
      preferred_foods: [],
      non_preferred_foods: [],
      diet_type_id: null,
      diet_type_name: null,
      diet_type_rules: [],
    };
  }

  const [
    { data: rpcRestrictions, error: restrictionsError },
    { data: preferredFoods, error: preferredError },
    { data: nonPreferredFoods, error: nonPreferredError },
  ] = await Promise.all([
    supabase.rpc('get_user_restrictions', { p_user_id: userId }),
    supabase.from('preferred_foods').select('food(id, name)').eq('user_id', userId),
    supabase.from('non_preferred_foods').select('food(id, name)').eq('user_id', userId),
  ]);

  if (restrictionsError) throw restrictionsError;
  if (preferredError) throw preferredError;
  if (nonPreferredError) throw nonPreferredError;

  const normalizedRestrictions = rpcRestrictions || {};
  const normalizedMedicalConditions =
    normalizedRestrictions.medical_conditions || normalizedRestrictions.conditions || [];

  return {
    sensitivities: normalizedRestrictions.sensitivities || [],
    conditions: normalizedMedicalConditions,
    medical_conditions: normalizedMedicalConditions,
    preferred_foods: (preferredFoods || []).map((item) => item.food).filter(Boolean),
    non_preferred_foods: (nonPreferredFoods || []).map((item) => item.food).filter(Boolean),
    diet_type_id: normalizedRestrictions.diet_type_id ?? null,
    diet_type_name: normalizedRestrictions.diet_type_name ?? null,
    diet_type_rules: normalizedRestrictions.diet_type_rules || [],
  };
};

export const fetchTemplateRecipesWithFoods = async (templateId) => {
  if (!templateId) return [];

  const { data, error } = await supabase
    .from('diet_plan_recipes')
    .select(`
      *,
      day_meal:day_meal_id(id, name, display_order),
      recipe:recipe_id(
        *,
        recipe_ingredients(
          *,
          food(
            *,
            food_sensitivities(sensitivity_id, sensitivities(id, name)),
            food_medical_conditions(*, medical_conditions(id, name)),
            food_to_food_groups(food_group_id, food_group:food_groups(id, name))
          )
        )
      ),
      custom_ingredients:recipe_ingredients(
        *,
        food(
          *,
          food_sensitivities(sensitivity_id, sensitivities(id, name)),
          food_medical_conditions(*, medical_conditions(id, name)),
          food_to_food_groups(food_group_id, food_group:food_groups(id, name))
        )
      )
    `)
    .eq('diet_plan_id', templateId);

  if (error) throw error;
  return data || [];
};

export const fetchAllFoodsForSubstitutions = async () => {
  const { data, error } = await supabase
    .from('food')
    .select(`
      *,
      food_sensitivities(sensitivity_id),
      food_medical_conditions(*),
      food_to_food_groups(food_group_id, food_group:food_groups(id, name))
    `);

  if (error) throw error;
  return data || [];
};

export const buildRecipeOverrideMap = (templateRecipes = []) => {
  const map = new Map();
  templateRecipes.forEach((recipe) => map.set(recipe.id, recipe));
  return map;
};

const cloneRecipe = (recipe) => {
  if (typeof structuredClone === 'function') {
    return structuredClone(recipe);
  }
  return JSON.parse(JSON.stringify(recipe));
};

// Picks the least-used candidate to distribute substitutions across a plan.
// Tiebreak: preference_rank (lower = better quality, as seeded in migrations).
const pickWithVariety = (candidates, usageTracker) => {
  if (!candidates?.length) return null;
  return [...candidates].sort((a, b) => {
    const ua = usageTracker.get(a.target_food_id) ?? 0;
    const ub = usageTracker.get(b.target_food_id) ?? 0;
    if (ua !== ub) return ua - ub;
    return (a.preference_rank ?? 99) - (b.preference_rank ?? 99);
  })[0];
};

const normalizeIngredientQuantityForTargetFood = (ingredient, targetFood) => {
  const sourceUnit = ingredient?.food?.food_unit || 'gramos';
  const targetUnit = targetFood?.food_unit || 'gramos';
  const currentQty = Number(ingredient?.grams ?? ingredient?.quantity ?? 0);
  const hasCurrentQty = Number.isFinite(currentQty) && currentQty > 0;

  if (sourceUnit === targetUnit) {
    return hasCurrentQty ? currentQty : targetUnit === 'unidades' ? 1 : 100;
  }

  return targetUnit === 'unidades' ? 1 : 100;
};

export const buildConflictsMap = (
  templateRecipes = [],
  clientRestrictions = { sensitivities: [], conditions: [] },
  criticalConflictTypes = CRITICAL_CONFLICT_TYPES,
) => {
  const newConflicts = {};

  templateRecipes.forEach((recipe) => {
    const ingredientsSource = recipe.custom_ingredients?.length > 0
      ? recipe.custom_ingredients
      : recipe.recipe?.recipe_ingredients || [];

    ingredientsSource.forEach((ingredient) => {
      const food = ingredient?.food;
      if (!food) return;

      const conflict = getConflictInfo(food, clientRestrictions);
      if (!conflict || !criticalConflictTypes.has(conflict.type)) return;

      const restrictionKey = conflict.reason || 'Conflicto';
      if (!newConflicts[restrictionKey]) newConflicts[restrictionKey] = [];
      if (!newConflicts[restrictionKey].some((r) => r.id === recipe.id)) {
        newConflicts[restrictionKey].push(recipe);
      }
    });
  });

  return newConflicts;
};

const applyAutoSubstitutionsToRecipe = async ({
  recipe,
  clientRestrictions,
  allFoods,
  analysisCache,
  substitutionsBySourceFoodId,
  usageTracker,
}) => {
  const updatedRecipe = cloneRecipe(recipe);
  const foodsById = new Map(allFoods.map((food) => [food.id, food]));
  const autoApplied = [];
  let hasChanges = false;

  const sourceIngredients = updatedRecipe.custom_ingredients?.length > 0
    ? updatedRecipe.custom_ingredients
    : updatedRecipe.recipe?.recipe_ingredients || [];

  if (!Array.isArray(sourceIngredients) || sourceIngredients.length === 0) {
    return { updatedRecipe, hasChanges: false, autoApplied };
  }

  for (let index = 0; index < sourceIngredients.length; index += 1) {
    const ingredient = sourceIngredients[index];
    const food = ingredient?.food;
    if (!food?.id) continue;

    let analysis = analysisCache.get(food.id);
    if (!analysis) {
      analysis = await getConflictWithSubstitutions(
        food,
        clientRestrictions,
        allFoods,
        substitutionsBySourceFoodId,
      );
      analysisCache.set(food.id, analysis);
    }

    if (!analysis?.hasConflict) continue;

    const candidates = analysis.autoSubstitutionCandidates ?? (analysis.autoSubstitution ? [analysis.autoSubstitution] : []);
    const chosenSub = pickWithVariety(candidates, usageTracker);
    if (!chosenSub) continue;

    const targetFood = foodsById.get(chosenSub.target_food_id);
    if (!targetFood) continue;

    usageTracker.set(chosenSub.target_food_id, (usageTracker.get(chosenSub.target_food_id) ?? 0) + 1);

    const normalizedQty = normalizeIngredientQuantityForTargetFood(ingredient, targetFood);
    sourceIngredients[index] = {
      ...ingredient,
      food_id: targetFood.id,
      food: targetFood,
      grams: normalizedQty,
      quantity: normalizedQty,
    };

    autoApplied.push({
      recipeId: recipe.id,
      recipeName: recipe.custom_name || recipe.recipe?.name || recipe.name || 'Receta',
      sourceFoodName: food.name,
      targetFoodName: targetFood.name,
      conflictType: analysis?.conflict?.type || null,
    });
    hasChanges = true;
  }

  if (updatedRecipe.custom_ingredients?.length > 0) {
    updatedRecipe.custom_ingredients = sourceIngredients;
  } else if (updatedRecipe.recipe?.recipe_ingredients) {
    updatedRecipe.recipe.recipe_ingredients = sourceIngredients;
  }

  return {
    updatedRecipe,
    hasChanges,
    autoApplied,
  };
};

export const prepareTemplateConflictResolution = async ({
  userId,
  templateId,
  templateRecipes: preloadedTemplateRecipes = null,
  clientRestrictions: preloadedClientRestrictions = null,
  allFoods: preloadedAllFoods = null,
} = {}) => {
  if (!templateId) {
    return {
      conflicts: {},
      clientRestrictions: null,
      templateRecipes: [],
      recipeOverrides: new Map(),
      autoSubstitutionsApplied: [],
      planRestrictionsForEditor: null,
    };
  }

  const [clientRestrictions, templateRecipes, allFoods] = await Promise.all([
    preloadedClientRestrictions
      ? Promise.resolve(preloadedClientRestrictions)
      : fetchClientRestrictionsForUser(userId),
    preloadedTemplateRecipes
      ? Promise.resolve(preloadedTemplateRecipes)
      : fetchTemplateRecipesWithFoods(templateId),
    preloadedAllFoods
      ? Promise.resolve(preloadedAllFoods)
      : fetchAllFoodsForSubstitutions(),
  ]);

  const recipeOverrides = buildRecipeOverrideMap(templateRecipes);
  const analysisCache = new Map();
  const usageTracker = new Map();
  const autoSubstitutionsApplied = [];

  const allTemplateFoodIds = templateRecipes.flatMap((recipe) => {
    const source = recipe.custom_ingredients?.length > 0
      ? recipe.custom_ingredients
      : recipe.recipe?.recipe_ingredients || [];

    return source
      .map((ingredient) => ingredient?.food_id || ingredient?.food?.id)
      .filter(Boolean);
  });

  let substitutionsBySourceFoodId = new Map();
  try {
    substitutionsBySourceFoodId = await prefetchSubstitutionMappings(allTemplateFoodIds);
  } catch (error) {
    console.error('Error preloading substitution mappings, falling back to per-food lookup:', error);
  }

  for (const recipe of templateRecipes) {
    const { updatedRecipe, hasChanges, autoApplied } = await applyAutoSubstitutionsToRecipe({
      recipe,
      clientRestrictions,
      allFoods,
      analysisCache,
      substitutionsBySourceFoodId,
      usageTracker,
    });

    if (hasChanges) {
      recipeOverrides.set(recipe.id, updatedRecipe);
      autoSubstitutionsApplied.push(...autoApplied);
    }
  }

  const resolvedRecipes = Array.from(recipeOverrides.values());
  const conflicts = buildConflictsMap(resolvedRecipes, clientRestrictions);

  return {
    conflicts,
    clientRestrictions,
    templateRecipes,
    recipeOverrides,
    autoSubstitutionsApplied,
    planRestrictionsForEditor: {
      sensitivities: clientRestrictions?.sensitivities || [],
      medical_conditions: clientRestrictions?.medical_conditions || clientRestrictions?.conditions || [],
      preferred_foods: clientRestrictions?.preferred_foods || [],
      non_preferred_foods: clientRestrictions?.non_preferred_foods || [],
      diet_type_id: clientRestrictions?.diet_type_id ?? null,
      diet_type_name: clientRestrictions?.diet_type_name ?? null,
      diet_type_rules: clientRestrictions?.diet_type_rules || [],
    },
  };
};
