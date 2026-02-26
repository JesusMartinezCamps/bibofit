import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { format } from 'date-fns';
import { useRealtime } from '@/contexts/RealtimeProvider';

const hashValue = (value) => {
  try {
    return JSON.stringify(value);
  } catch {
    return String(Math.random());
  }
};

const buildFoodIndex = (foods = []) => {
  const map = new Map();
  foods.forEach((food) => {
    map.set(`${food.is_user_created ? 1 : 0}:${food.id}`, food);
  });
  return map;
};

const buildIngredientEnricher = (foods = []) => {
  const foodIndex = buildFoodIndex(foods);

  return (ingredients) => {
    if (!Array.isArray(ingredients)) return [];

    return ingredients.map((ing) => {
      const isUserCreated = !!ing.is_user_created;
      const foodId = ing.food_id;
      const detailedFood = foodIndex.get(`${isUserCreated ? 1 : 0}:${foodId}`);

      return {
        ...ing,
        food: detailedFood || ing.food,
      };
    });
  };
};

export const usePlanItems = (userId, activePlan, weekDates, setPlannedMeals) => {
  const [planRecipes, setPlanRecipes] = useState([]);
  const [freeMeals, setFreeMeals] = useState([]);
  const [snacks, setSnacks] = useState([]);
  const [snackLogs, setSnackLogs] = useState([]);
  const [mealLogs, setMealLogs] = useState([]);
  const [userDayMeals, setUserDayMeals] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [equivalenceAdjustments, setEquivalenceAdjustments] = useState([]);
  const [dailyIngredientAdjustments, setDailyIngredientAdjustments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [allAvailableFoods, setAllAvailableFoods] = useState([]);

  const staticCacheRef = useRef({ key: null, data: null });
  const rangeCacheRef = useRef(new Map());
  const stateHashesRef = useRef({});
  const realtimeDebounceRef = useRef(null);
  const pendingStaticRefreshRef = useRef(false);

  const { subscribe, unregister } = useRealtime();

  const setStateIfChanged = useCallback((stateKey, nextValue, setter) => {
    const nextHash = hashValue(nextValue);
    if (stateHashesRef.current[stateKey] === nextHash) return false;

    stateHashesRef.current[stateKey] = nextHash;
    setter(nextValue);
    return true;
  }, []);

  const applyProcessedData = useCallback((processed) => {
    if (!processed) return;

    const { staticData, rangeData } = processed;

    if (staticData) {
      setStateIfChanged('allAvailableFoods', staticData.allFoods, setAllAvailableFoods);
      setStateIfChanged('planRecipes', staticData.planRecipes, setPlanRecipes);
      setStateIfChanged('userDayMeals', staticData.userDayMeals, setUserDayMeals);
    }

    if (rangeData) {
      setStateIfChanged('plannedMeals', rangeData.plannedMeals, setPlannedMeals);
      setStateIfChanged('freeMeals', rangeData.freeMeals, setFreeMeals);
      setStateIfChanged('snacks', rangeData.snacks, setSnacks);
      setStateIfChanged('snackLogs', rangeData.snackLogs, setSnackLogs);
      setStateIfChanged('mealLogs', rangeData.mealLogs, setMealLogs);
      setStateIfChanged('equivalenceAdjustments', rangeData.equivalenceAdjustments, setEquivalenceAdjustments);
      setStateIfChanged('dailyIngredientAdjustments', rangeData.dailyIngredientAdjustments, setDailyIngredientAdjustments);
      setStateIfChanged('adjustments', rangeData.equivalenceAdjustments, setAdjustments);
    }
  }, [setPlannedMeals, setStateIfChanged]);

  const fetchAndSetPlanItems = useCallback(async (options = {}) => {
    const { force = false, refreshStatic = false, silent = false } = options;

    if (!userId || !activePlan || !weekDates?.length) {
      setLoading(false);
      return;
    }

    const firstDay = weekDates[0];
    const lastDay = weekDates[weekDates.length - 1];
    const startDate = format(firstDay, 'yyyy-MM-dd');
    const endDate = format(lastDay, 'yyyy-MM-dd');

    const staticKey = `${userId}:${activePlan.id}`;
    const rangeKey = `${staticKey}:${startDate}:${endDate}`;

    const cachedStatic = staticCacheRef.current.key === staticKey ? staticCacheRef.current.data : null;
    const cachedRange = rangeCacheRef.current.get(rangeKey);

    // If we already have this range and static data, re-apply from cache and skip network.
    if (!force && cachedStatic && cachedRange) {
      applyProcessedData({ staticData: cachedStatic, rangeData: cachedRange });
      setLoading(false);
      return;
    }

    if (!silent && (!cachedStatic || !cachedRange)) {
      setLoading(true);
    }
    setError(null);

    try {
      const shouldFetchStatic = force ? (refreshStatic || !cachedStatic) : (!cachedStatic || refreshStatic);

      let staticData = cachedStatic;
      if (shouldFetchStatic) {
        const [dietPlanRecipesRes, privateRecipesRes, userDayMealsRes, foodsRes, userFoodsRes, changeRequestsRes] = await Promise.all([
          supabase.from('diet_plan_recipes').select(`
            *, 
            recipe:recipe_id(*, recipe_ingredients(*)), 
            custom_ingredients:diet_plan_recipe_ingredients(*), 
            day_meal:day_meal_id!inner(id,name,display_order)
          `).eq('diet_plan_id', activePlan.id),
          supabase.from('private_recipes').select(`
            *, 
            private_recipe_ingredients(*), 
            day_meal:day_meal_id!inner(id,name,display_order)
          `).eq('diet_plan_id', activePlan.id),
          supabase.from('user_day_meals')
            .select('*, day_meal:day_meals(*)')
            .eq('user_id', userId)
            .eq('diet_plan_id', activePlan.id)
            .order('display_order', { foreignTable: 'day_meals' }),
          supabase.from('food').select(`
            *, 
            food_sensitivities(sensitivity:sensitivities(*)), 
            food_medical_conditions(relation_type, condition:medical_conditions(*)), 
            food_vitamins(mg_per_100g, vitamin:vitamins(*)), 
            food_minerals(mg_per_100g, mineral:minerals(*)), 
            food_to_food_groups(food_group:food_groups(*))
          `),
          supabase.from('user_created_foods').select('*').eq('user_id', userId).not('status', 'eq', 'rejected'),
          supabase.from('diet_change_requests').select('*').eq('user_id', userId).eq('status', 'pending'),
        ]);

        const staticResponses = [dietPlanRecipesRes, privateRecipesRes, userDayMealsRes, foodsRes, userFoodsRes, changeRequestsRes];
        for (const res of staticResponses) {
          if (res.error) throw res.error;
        }

        const allFoods = [
          ...(foodsRes.data || []),
          ...((userFoodsRes.data || []).map((f) => ({ ...f, is_user_created: true }))),
        ];
        const enrichIngredients = buildIngredientEnricher(allFoods);
        const changeRequests = changeRequestsRes.data || [];

        const processedDietPlanRecipes = (dietPlanRecipesRes.data || []).map((r) => {
          const recipeIngredients = enrichIngredients(r.recipe?.recipe_ingredients || []);
          const customIngredients = enrichIngredients(r.custom_ingredients || []);
          const request = changeRequests.find((cr) => cr.diet_plan_recipe_id === r.id && !cr.requested_changes_private_recipe_id);

          return {
            ...r,
            recipe: r.recipe ? { ...r.recipe, recipe_ingredients: recipeIngredients } : r.recipe,
            custom_ingredients: customIngredients,
            dnd_id: `recipe-${r.id}`,
            type: 'recipe',
            is_private: false,
            changeRequest: request,
          };
        });

        const processedPrivateRecipes = (privateRecipesRes.data || []).map((r) => {
          const privateIngredients = enrichIngredients(r.private_recipe_ingredients || []);
          const request = changeRequests.find((cr) => cr.requested_changes_private_recipe_id === r.id);

          return {
            ...r,
            private_recipe_ingredients: privateIngredients,
            dnd_id: `private-${r.id}`,
            type: 'private_recipe',
            is_private: true,
            changeRequest: request,
          };
        });

        staticData = {
          allFoods,
          planRecipes: [...processedDietPlanRecipes, ...processedPrivateRecipes],
          userDayMeals: userDayMealsRes.data || [],
        };

        staticCacheRef.current = { key: staticKey, data: staticData };
        if (refreshStatic) {
          for (const key of rangeCacheRef.current.keys()) {
            if (key.startsWith(`${staticKey}:`)) rangeCacheRef.current.delete(key);
          }
        }
      }

      const [plannedMealsRes, freeMealsRes, mealLogsRes, equivalenceAdjustmentsRes, ingredientAdjustmentsRes, snackOccurrencesRes, snackLogsRes] = await Promise.all([
        supabase.from('planned_meals').select(`
          *,
          diet_plan_recipe:diet_plan_recipes(*, recipe:recipes(*, recipe_ingredients(*, food(*))), custom_ingredients:diet_plan_recipe_ingredients(*, food(*)), day_meal:day_meals(*)),
          private_recipe:private_recipes(*, private_recipe_ingredients(*, food(*)), day_meal:day_meals(*))
        `).eq('user_id', userId).eq('diet_plan_id', activePlan.id).gte('plan_date', startDate).lte('plan_date', endDate),
        supabase.from('free_recipe_occurrences').select(`
          *,
          free_recipe:free_recipes!inner(*, free_recipe_ingredients!inner(id, grams, food:food_id(*), user_created_food:user_created_foods(*))),
          day_meal:day_meals(*)
        `).eq('user_id', userId).gte('meal_date', startDate).lte('meal_date', endDate),
        supabase.from('daily_meal_logs')
          .select('log_date, diet_plan_recipe_id, private_recipe_id, free_recipe_occurrence_id, user_day_meal_id, id')
          .eq('user_id', userId)
          .gte('log_date', startDate)
          .lte('log_date', endDate),
        supabase.from('equivalence_adjustments').select('*').eq('user_id', userId).gte('log_date', startDate).lte('log_date', endDate),
        supabase.from('daily_ingredient_adjustments').select('*, equivalence_adjustment:equivalence_adjustments!inner(id, log_date, user_id, target_user_day_meal_id)').eq('equivalence_adjustment.user_id', userId).gte('equivalence_adjustment.log_date', startDate).lte('equivalence_adjustment.log_date', endDate),
        supabase.from('snack_occurrences').select('*, snack:snacks(*, snack_ingredients(*, food:food_id(*), user_created_food:user_created_foods(*)))').eq('user_id', userId).gte('meal_date', startDate).lte('meal_date', endDate),
        supabase.from('daily_snack_logs').select('*').eq('user_id', userId).gte('log_date', startDate).lte('log_date', endDate),
      ]);

      const rangeResponses = [plannedMealsRes, freeMealsRes, mealLogsRes, equivalenceAdjustmentsRes, ingredientAdjustmentsRes, snackOccurrencesRes, snackLogsRes];
      for (const res of rangeResponses) {
        if (res.error) throw res.error;
      }

      const enrichIngredients = buildIngredientEnricher(staticData?.allFoods || []);

      const processedPlannedMeals = (plannedMealsRes.data || []).map((pm) => {
        const nextPm = { ...pm };

        if (nextPm.diet_plan_recipe) {
          const recipeIngredients = enrichIngredients(nextPm.diet_plan_recipe.recipe?.recipe_ingredients || []);
          const customIngredients = enrichIngredients(nextPm.diet_plan_recipe.custom_ingredients || []);

          nextPm.diet_plan_recipe = {
            ...nextPm.diet_plan_recipe,
            recipe: nextPm.diet_plan_recipe.recipe
              ? { ...nextPm.diet_plan_recipe.recipe, recipe_ingredients: recipeIngredients }
              : nextPm.diet_plan_recipe.recipe,
            custom_ingredients: customIngredients,
          };
        }

        if (nextPm.private_recipe) {
          nextPm.private_recipe = {
            ...nextPm.private_recipe,
            private_recipe_ingredients: enrichIngredients(nextPm.private_recipe.private_recipe_ingredients || []),
          };
        }

        return nextPm;
      });

      const processedFreeMeals = (freeMealsRes.data || []).map((fm) => {
        const unifiedIngredients = (fm.free_recipe?.free_recipe_ingredients || []).map((ing) => {
          const foodDetails = ing.food || ing.user_created_food;
          return {
            ...ing,
            food: foodDetails,
            food_id: foodDetails?.id,
            is_user_created: !!ing.user_created_food,
          };
        });

        return {
          ...fm.free_recipe,
          free_recipe_ingredients: enrichIngredients(unifiedIngredients),
          occurrence_id: fm.id,
          meal_date: fm.meal_date,
          day_meal_id: fm.day_meal_id,
          day_meal: fm.day_meal,
          dnd_id: `free-${fm.id}`,
          type: 'free_recipe',
        };
      });

      const processedSnacks = (snackOccurrencesRes.data || []).map((s) => ({
        ...s.snack,
        snack_ingredients: enrichIngredients(s.snack?.snack_ingredients || []),
        occurrence_id: s.id,
        meal_date: s.meal_date,
        day_meal_id: s.day_meal_id,
        dnd_id: `snack-${s.id}`,
        type: 'snack',
      }));

      const rangeData = {
        plannedMeals: processedPlannedMeals,
        freeMeals: processedFreeMeals,
        mealLogs: mealLogsRes.data || [],
        equivalenceAdjustments: equivalenceAdjustmentsRes.data || [],
        dailyIngredientAdjustments: ingredientAdjustmentsRes.data || [],
        snacks: processedSnacks,
        snackLogs: snackLogsRes.data || [],
      };

      rangeCacheRef.current.set(rangeKey, rangeData);
      if (rangeCacheRef.current.size > 30) {
        const oldestKey = rangeCacheRef.current.keys().next().value;
        if (oldestKey) rangeCacheRef.current.delete(oldestKey);
      }

      applyProcessedData({
        staticData,
        rangeData,
      });
    } catch (err) {
      setError(`Error al cargar los datos del plan: ${err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [activePlan, applyProcessedData, userId, weekDates]);

  useEffect(() => {
    fetchAndSetPlanItems();
  }, [fetchAndSetPlanItems]);

  useEffect(() => {
    if (!userId || !activePlan?.id) return;

    const subscriptions = [
      { table: 'daily_meal_logs', filter: `user_id=eq.${userId}`, staticRefresh: false },
      { table: 'planned_meals', filter: `user_id=eq.${userId}`, staticRefresh: false },
      { table: 'free_recipe_occurrences', filter: `user_id=eq.${userId}`, staticRefresh: false },
      { table: 'snack_occurrences', filter: `user_id=eq.${userId}`, staticRefresh: false },
      { table: 'daily_snack_logs', filter: `user_id=eq.${userId}`, staticRefresh: false },
      { table: 'daily_ingredient_adjustments', filter: null, staticRefresh: false },
      { table: 'equivalence_adjustments', filter: `user_id=eq.${userId}`, staticRefresh: false },
      { table: 'diet_plan_recipes', filter: `diet_plan_id=eq.${activePlan.id}`, staticRefresh: true },
      { table: 'private_recipes', filter: `diet_plan_id=eq.${activePlan.id}`, staticRefresh: true },
      { table: 'snacks', filter: `user_id=eq.${userId}`, staticRefresh: true },
      { table: 'diet_change_requests', filter: `user_id=eq.${userId}`, staticRefresh: true },
    ];

    const scheduleRefresh = (refreshStatic) => {
      if (refreshStatic) pendingStaticRefreshRef.current = true;
      if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);

      realtimeDebounceRef.current = setTimeout(() => {
        const mustRefreshStatic = pendingStaticRefreshRef.current;
        pendingStaticRefreshRef.current = false;
        fetchAndSetPlanItems({ force: true, refreshStatic: mustRefreshStatic, silent: true });
      }, 220);
    };

    const unsubscribers = [];
    subscriptions.forEach(({ table, filter, staticRefresh }) => {
      const key = `plan_items_${table}_${userId}_${activePlan.id}`;
      const listener = () => scheduleRefresh(staticRefresh);
      subscribe(key, {
        event: '*',
        schema: 'public',
        table,
        ...(filter ? { filter } : {}),
      }, listener);
      unsubscribers.push({ key, listener });
    });

    return () => {
      if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
      unsubscribers.forEach(({ key, listener }) => {
        unregister(key, listener);
      });
    };
  }, [activePlan?.id, fetchAndSetPlanItems, subscribe, unregister, userId]);

  return {
    planRecipes,
    setPlanRecipes,
    freeMeals,
    setFreeMeals,
    mealLogs,
    setMealLogs,
    userDayMeals,
    adjustments,
    setAdjustments,
    equivalenceAdjustments,
    setEquivalenceAdjustments,
    dailyIngredientAdjustments,
    setDailyIngredientAdjustments,
    fetchAndSetPlanItems,
    loading,
    error,
    snacks,
    setSnacks,
    snackLogs,
    setSnackLogs,
    allAvailableFoods,
  };
};
