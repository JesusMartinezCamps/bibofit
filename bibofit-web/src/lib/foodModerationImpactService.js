import { supabase } from '@/lib/supabaseClient';
import { invokeAutoBalanceBatch } from '@/lib/autoBalanceClient';

const getTodayISO = () => new Date().toISOString().slice(0, 10);
const normalizeMessage = (error) => error?.message || 'Error desconocido';

const uniqueByKey = (items, getKey) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const buildMomentMap = async ({ userId, meals }) => {
  const dietPlanIds = uniqueByKey(
    meals.filter((m) => m.diet_plan_id),
    (m) => String(m.diet_plan_id),
  ).map((m) => m.diet_plan_id);
  const dayMealIds = uniqueByKey(
    meals.filter((m) => m.day_meal_id),
    (m) => String(m.day_meal_id),
  ).map((m) => m.day_meal_id);

  if (dietPlanIds.length === 0 || dayMealIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('user_day_meals')
    .select('id, diet_plan_id, day_meal_id')
    .eq('user_id', userId)
    .in('diet_plan_id', dietPlanIds)
    .in('day_meal_id', dayMealIds);
  if (error) throw error;

  return new Map((data || []).map((row) => [`${row.diet_plan_id}|${row.day_meal_id}`, row.id]));
};

const invokeBatchByGroups = async ({ meals, userId }) => {
  const momentByDietAndMeal = await buildMomentMap({ userId, meals });
  const groups = new Map();
  const failures = [];

  meals.forEach((meal) => {
    const momentId = momentByDietAndMeal.get(`${meal.diet_plan_id}|${meal.day_meal_id}`);
    if (!momentId) {
      failures.push({
        reason: 'missing_user_day_meal',
        meal_id: meal.id,
        plan_date: meal.plan_date,
      });
      return;
    }

    const recipeRef = meal.diet_plan_recipe_id
      ? { id: meal.diet_plan_recipe_id, is_private: false }
      : { id: meal.private_recipe_id, is_private: true };

    const groupKey = `${meal.plan_date}|${momentId}`;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, { date: meal.plan_date, moment_id: momentId, recipe_ids: [] });
    }
    groups.get(groupKey).recipe_ids.push(recipeRef);
  });

  const normalizedGroups = Array.from(groups.values()).map((group) => ({
    ...group,
    recipe_ids: uniqueByKey(group.recipe_ids, (r) => `${r.id}|${r.is_private ? 1 : 0}`),
  }));

  let succeededGroups = 0;
  for (const group of normalizedGroups) {
    try {
      await invokeAutoBalanceBatch({
        moment_id: group.moment_id,
        recipe_ids: group.recipe_ids,
        user_id: userId,
        date: group.date,
      });
      succeededGroups += 1;
    } catch (error) {
      failures.push({
        reason: 'auto_balance_error',
        moment_id: group.moment_id,
        plan_date: group.date,
        error: normalizeMessage(error),
      });
    }
  }

  return {
    processedGroups: normalizedGroups.length,
    succeededGroups,
    failures,
  };
};

const fetchFuturePlannedMeals = async ({ userId, effectiveDate }) => {
  const { data, error } = await supabase
    .from('planned_meals')
    .select('id, plan_date, day_meal_id, diet_plan_id, diet_plan_recipe_id, private_recipe_id')
    .eq('user_id', userId)
    .gte('plan_date', effectiveDate)
    .or('diet_plan_recipe_id.not.is.null,private_recipe_id.not.is.null');
  if (error) throw error;
  return data || [];
};

const getImpactedDietMeals = async ({ meals, foodId }) => {
  const dietMeals = meals.filter((m) => m.diet_plan_recipe_id);
  const dietPlanRecipeIds = uniqueByKey(dietMeals, (m) => String(m.diet_plan_recipe_id)).map(
    (m) => m.diet_plan_recipe_id,
  );
  if (dietPlanRecipeIds.length === 0) return [];

  const { data: dprRows, error: dprError } = await supabase
    .from('diet_plan_recipes')
    .select('id, recipe_id')
    .in('id', dietPlanRecipeIds);
  if (dprError) throw dprError;

  const { data: customIngredients, error: dpriError } = await supabase
    .from('diet_plan_recipe_ingredients')
    .select('diet_plan_recipe_id, food_id')
    .in('diet_plan_recipe_id', dietPlanRecipeIds);
  if (dpriError) throw dpriError;

  const customByDpr = new Map();
  (customIngredients || []).forEach((row) => {
    if (!customByDpr.has(row.diet_plan_recipe_id)) customByDpr.set(row.diet_plan_recipe_id, []);
    customByDpr.get(row.diet_plan_recipe_id).push(row.food_id);
  });

  const dprById = new Map((dprRows || []).map((row) => [row.id, row]));
  const noCustomDpr = (dprRows || []).filter((row) => !customByDpr.has(row.id) && row.recipe_id);
  const recipeIds = uniqueByKey(noCustomDpr, (row) => String(row.recipe_id)).map((row) => row.recipe_id);
  let impactedRecipeIds = new Set();

  if (recipeIds.length > 0) {
    const { data: baseRows, error: baseError } = await supabase
      .from('recipe_ingredients')
      .select('recipe_id')
      .in('recipe_id', recipeIds)
      .eq('food_id', foodId);
    if (baseError) throw baseError;
    impactedRecipeIds = new Set((baseRows || []).map((row) => row.recipe_id));
  }

  const impactedDprIds = new Set();
  (dprRows || []).forEach((row) => {
    const customFoods = customByDpr.get(row.id);
    if (customFoods) {
      if (customFoods.includes(foodId)) impactedDprIds.add(row.id);
      return;
    }
    if (row.recipe_id && impactedRecipeIds.has(row.recipe_id)) impactedDprIds.add(row.id);
  });

  return dietMeals.filter((meal) => impactedDprIds.has(meal.diet_plan_recipe_id)).map((meal) => ({
    ...meal,
    _dpr: dprById.get(meal.diet_plan_recipe_id) || null,
  }));
};

const getImpactedPrivateMeals = async ({ meals, foodId }) => {
  const privateMeals = meals.filter((m) => m.private_recipe_id);
  const privateIds = uniqueByKey(privateMeals, (m) => String(m.private_recipe_id)).map(
    (m) => m.private_recipe_id,
  );
  if (privateIds.length === 0) return [];

  const { data, error } = await supabase
    .from('private_recipe_ingredients')
    .select('private_recipe_id')
    .in('private_recipe_id', privateIds)
    .eq('food_id', foodId);
  if (error) throw error;

  const impactedPrivateIds = new Set((data || []).map((row) => row.private_recipe_id));
  return privateMeals.filter((meal) => impactedPrivateIds.has(meal.private_recipe_id));
};

const getSourceIngredientsByDpr = async ({ dietPlanRecipeIds, dprRows }) => {
  const { data: customRows, error: customError } = await supabase
    .from('diet_plan_recipe_ingredients')
    .select('diet_plan_recipe_id, food_id, grams')
    .in('diet_plan_recipe_id', dietPlanRecipeIds);
  if (customError) throw customError;

  const customByDpr = new Map();
  (customRows || []).forEach((row) => {
    if (!customByDpr.has(row.diet_plan_recipe_id)) customByDpr.set(row.diet_plan_recipe_id, []);
    customByDpr.get(row.diet_plan_recipe_id).push({ food_id: row.food_id, grams: row.grams });
  });

  const dprWithoutCustom = (dprRows || []).filter((row) => !customByDpr.has(row.id) && row.recipe_id);
  const recipeIds = uniqueByKey(dprWithoutCustom, (row) => String(row.recipe_id)).map((row) => row.recipe_id);

  const baseByRecipe = new Map();
  if (recipeIds.length > 0) {
    const { data: baseRows, error: baseError } = await supabase
      .from('recipe_ingredients')
      .select('recipe_id, food_id, grams')
      .in('recipe_id', recipeIds);
    if (baseError) throw baseError;
    (baseRows || []).forEach((row) => {
      if (!baseByRecipe.has(row.recipe_id)) baseByRecipe.set(row.recipe_id, []);
      baseByRecipe.get(row.recipe_id).push({ food_id: row.food_id, grams: row.grams });
    });
  }

  const sourceByDpr = new Map();
  (dprRows || []).forEach((row) => {
    if (customByDpr.has(row.id)) {
      sourceByDpr.set(row.id, customByDpr.get(row.id));
      return;
    }
    sourceByDpr.set(row.id, baseByRecipe.get(row.recipe_id) || []);
  });

  return sourceByDpr;
};

const cloneDietPlanRecipeWithoutFood = async ({ originalRow, ingredients, foodId }) => {
  if (!originalRow) {
    throw new Error('No se encontró la receta de plan original.');
  }
  const filtered = (ingredients || []).filter((ing) => Number(ing.food_id) !== Number(foodId));
  if (filtered.length === 0) {
    throw new Error('La receta quedaría sin ingredientes tras eliminar el alimento rechazado.');
  }

  const clonePayload = {
    diet_plan_id: originalRow.diet_plan_id,
    recipe_id: originalRow.recipe_id,
    day_of_week: originalRow.day_of_week,
    is_customized: true,
    custom_name: originalRow.custom_name,
    custom_prep_time_min: originalRow.custom_prep_time_min,
    custom_difficulty: originalRow.custom_difficulty,
    custom_instructions: originalRow.custom_instructions,
    custom_ingredients: null,
    day_meal_id: originalRow.day_meal_id,
    parent_diet_plan_recipe_id: originalRow.id,
  };

  const { data: inserted, error: insertError } = await supabase
    .from('diet_plan_recipes')
    .insert(clonePayload)
    .select('id')
    .single();
  if (insertError) throw insertError;

  const ingredientsPayload = filtered.map((ing) => ({
    diet_plan_recipe_id: inserted.id,
    food_id: ing.food_id,
    grams: ing.grams || 0,
  }));

  const { error: ingError } = await supabase
    .from('diet_plan_recipe_ingredients')
    .insert(ingredientsPayload);
  if (ingError) throw ingError;

  return inserted.id;
};

const clonePrivateRecipeWithoutFood = async ({ originalRow, ingredients, foodId }) => {
  if (!originalRow) {
    throw new Error('No se encontró la receta privada original.');
  }
  const filtered = (ingredients || []).filter((ing) => Number(ing.food_id) !== Number(foodId));
  if (filtered.length === 0) {
    throw new Error('La receta privada quedaría sin ingredientes tras eliminar el alimento rechazado.');
  }

  const clonePayload = {
    user_id: originalRow.user_id,
    source_free_recipe_id: originalRow.source_free_recipe_id,
    name: originalRow.name,
    instructions: originalRow.instructions,
    diet_plan_id: originalRow.diet_plan_id,
    day_meal_id: originalRow.day_meal_id,
    prep_time_min: originalRow.prep_time_min,
    difficulty: originalRow.difficulty,
    parent_private_recipe_id: originalRow.id,
  };

  const { data: inserted, error: insertError } = await supabase
    .from('private_recipes')
    .insert(clonePayload)
    .select('id')
    .single();
  if (insertError) throw insertError;

  const ingredientsPayload = filtered.map((ing) => ({
    private_recipe_id: inserted.id,
    food_id: ing.food_id,
    grams: ing.grams || 0,
  }));
  const { error: ingError } = await supabase.from('private_recipe_ingredients').insert(ingredientsPayload);
  if (ingError) throw ingError;

  return inserted.id;
};

const formatResult = ({
  success,
  scannedMeals,
  impactedMeals,
  processedGroups,
  succeededGroups,
  failures,
  errors = [],
}) => ({
  success,
  summary: {
    scannedMeals,
    impactedMeals,
    processedGroups,
    succeededGroups,
    failedGroups: failures.length,
  },
  errors,
  failures,
});

export const rebalanceImpactedFutureMealsForFood = async ({
  foodId,
  userId,
  effectiveDate = getTodayISO(),
}) => {
  if (!foodId || !userId) {
    return formatResult({
      success: false,
      scannedMeals: 0,
      impactedMeals: 0,
      processedGroups: 0,
      succeededGroups: 0,
      failures: [],
      errors: ['Faltan parámetros obligatorios (foodId, userId).'],
    });
  }

  try {
    const plannedMeals = await fetchFuturePlannedMeals({ userId, effectiveDate });
    if (!plannedMeals.length) {
      return formatResult({
        success: true,
        scannedMeals: 0,
        impactedMeals: 0,
        processedGroups: 0,
        succeededGroups: 0,
        failures: [],
      });
    }

    const [dietImpacted, privateImpacted] = await Promise.all([
      getImpactedDietMeals({ meals: plannedMeals, foodId }),
      getImpactedPrivateMeals({ meals: plannedMeals, foodId }),
    ]);
    const impactedMeals = [...dietImpacted, ...privateImpacted];

    if (!impactedMeals.length) {
      return formatResult({
        success: true,
        scannedMeals: plannedMeals.length,
        impactedMeals: 0,
        processedGroups: 0,
        succeededGroups: 0,
        failures: [],
      });
    }

    const balanceResult = await invokeBatchByGroups({ meals: impactedMeals, userId });
    return formatResult({
      success: balanceResult.failures.length === 0,
      scannedMeals: plannedMeals.length,
      impactedMeals: impactedMeals.length,
      processedGroups: balanceResult.processedGroups,
      succeededGroups: balanceResult.succeededGroups,
      failures: balanceResult.failures,
    });
  } catch (error) {
    return formatResult({
      success: false,
      scannedMeals: 0,
      impactedMeals: 0,
      processedGroups: 0,
      succeededGroups: 0,
      failures: [],
      errors: [normalizeMessage(error)],
    });
  }
};

export const removeFoodFromFutureMealsAndRebalance = async ({
  foodId,
  userId,
  effectiveDate = getTodayISO(),
}) => {
  if (!foodId || !userId) {
    return formatResult({
      success: false,
      scannedMeals: 0,
      impactedMeals: 0,
      processedGroups: 0,
      succeededGroups: 0,
      failures: [],
      errors: ['Faltan parámetros obligatorios (foodId, userId).'],
    });
  }

  try {
    const plannedMeals = await fetchFuturePlannedMeals({ userId, effectiveDate });
    if (!plannedMeals.length) {
      return formatResult({
        success: true,
        scannedMeals: 0,
        impactedMeals: 0,
        processedGroups: 0,
        succeededGroups: 0,
        failures: [],
      });
    }

    const dietMeals = plannedMeals.filter((m) => m.diet_plan_recipe_id);
    const privateMeals = plannedMeals.filter((m) => m.private_recipe_id);

    const dietPlanRecipeIds = uniqueByKey(dietMeals, (m) => String(m.diet_plan_recipe_id)).map(
      (m) => m.diet_plan_recipe_id,
    );
    const privateRecipeIds = uniqueByKey(privateMeals, (m) => String(m.private_recipe_id)).map(
      (m) => m.private_recipe_id,
    );

    const failures = [];
    const changedMeals = [];

    let dprRows = [];
    if (dietPlanRecipeIds.length > 0) {
      const { data, error } = await supabase
        .from('diet_plan_recipes')
        .select(
          'id, diet_plan_id, recipe_id, day_of_week, is_customized, custom_name, custom_prep_time_min, custom_difficulty, custom_instructions, day_meal_id',
        )
        .in('id', dietPlanRecipeIds);
      if (error) throw error;
      dprRows = data || [];
    }
    const dprById = new Map(dprRows.map((row) => [row.id, row]));
    const sourceIngredientsByDpr = await getSourceIngredientsByDpr({ dietPlanRecipeIds, dprRows });

    let privateRows = [];
    let privateIngredients = [];
    if (privateRecipeIds.length > 0) {
      const [{ data: pRows, error: pRowsError }, { data: pIngRows, error: pIngError }] = await Promise.all([
        supabase
          .from('private_recipes')
          .select(
            'id, user_id, source_free_recipe_id, name, instructions, diet_plan_id, day_meal_id, prep_time_min, difficulty',
          )
          .in('id', privateRecipeIds),
        supabase
          .from('private_recipe_ingredients')
          .select('private_recipe_id, food_id, grams')
          .in('private_recipe_id', privateRecipeIds),
      ]);
      if (pRowsError) throw pRowsError;
      if (pIngError) throw pIngError;
      privateRows = pRows || [];
      privateIngredients = pIngRows || [];
    }

    const privateById = new Map(privateRows.map((row) => [row.id, row]));
    const privateIngredientsById = new Map();
    privateIngredients.forEach((row) => {
      if (!privateIngredientsById.has(row.private_recipe_id)) privateIngredientsById.set(row.private_recipe_id, []);
      privateIngredientsById
        .get(row.private_recipe_id)
        .push({ food_id: row.food_id, grams: row.grams });
    });

    for (const meal of plannedMeals) {
      if (meal.diet_plan_recipe_id) {
        const dpr = dprById.get(meal.diet_plan_recipe_id);
        const sourceIngredients = sourceIngredientsByDpr.get(meal.diet_plan_recipe_id) || [];
        const usesFood = sourceIngredients.some((ing) => Number(ing.food_id) === Number(foodId));
        if (!usesFood) continue;

        try {
          const newDprId = await cloneDietPlanRecipeWithoutFood({
            originalRow: dpr,
            ingredients: sourceIngredients,
            foodId,
          });
          const { error: updateError } = await supabase
            .from('planned_meals')
            .update({ diet_plan_recipe_id: newDprId })
            .eq('id', meal.id);
          if (updateError) throw updateError;

          changedMeals.push({ ...meal, diet_plan_recipe_id: newDprId });
        } catch (error) {
          failures.push({
            reason: 'diet_recipe_clone_error',
            meal_id: meal.id,
            plan_date: meal.plan_date,
            error: normalizeMessage(error),
          });
        }
      }

      if (meal.private_recipe_id) {
        const privateRecipe = privateById.get(meal.private_recipe_id);
        const sourceIngredients = privateIngredientsById.get(meal.private_recipe_id) || [];
        const usesFood = sourceIngredients.some((ing) => Number(ing.food_id) === Number(foodId));
        if (!usesFood) continue;

        try {
          const newPrivateId = await clonePrivateRecipeWithoutFood({
            originalRow: privateRecipe,
            ingredients: sourceIngredients,
            foodId,
          });
          const { error: updateError } = await supabase
            .from('planned_meals')
            .update({ private_recipe_id: newPrivateId })
            .eq('id', meal.id);
          if (updateError) throw updateError;

          changedMeals.push({ ...meal, private_recipe_id: newPrivateId });
        } catch (error) {
          failures.push({
            reason: 'private_recipe_clone_error',
            meal_id: meal.id,
            plan_date: meal.plan_date,
            error: normalizeMessage(error),
          });
        }
      }
    }

    if (changedMeals.length === 0) {
      return formatResult({
        success: failures.length === 0,
        scannedMeals: plannedMeals.length,
        impactedMeals: 0,
        processedGroups: 0,
        succeededGroups: 0,
        failures,
      });
    }

    const balanceResult = await invokeBatchByGroups({ meals: changedMeals, userId });
    const allFailures = [...failures, ...balanceResult.failures];

    return formatResult({
      success: allFailures.length === 0,
      scannedMeals: plannedMeals.length,
      impactedMeals: changedMeals.length,
      processedGroups: balanceResult.processedGroups,
      succeededGroups: balanceResult.succeededGroups,
      failures: allFailures,
    });
  } catch (error) {
    return formatResult({
      success: false,
      scannedMeals: 0,
      impactedMeals: 0,
      processedGroups: 0,
      succeededGroups: 0,
      failures: [],
      errors: [normalizeMessage(error)],
    });
  }
};
