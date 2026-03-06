import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { format } from 'date-fns';
import { useRealtime } from '@/contexts/RealtimeProvider';
import { findFoodByIdentity, inferIngredientUserCreated, isUserCreatedFood } from '@/lib/foodIdentity';
import { RECIPE_ENTITY_TYPES } from '@/lib/recipeEntity';

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
    map.set(`${isUserCreatedFood(food) ? 1 : 0}:${food.id}`, food);
  });
  return map;
};

const buildIngredientEnricher = (foods = []) => {
  const foodIndex = buildFoodIndex(foods);

  return (ingredients) => {
    if (!Array.isArray(ingredients)) return [];

    return ingredients.map((ing) => {
      const isUserCreated = inferIngredientUserCreated(ing);
      const foodId = ing.food_id;
      const strictKey = isUserCreated === null ? null : `${isUserCreated ? 1 : 0}:${foodId}`;
      const detailedFood = (strictKey ? foodIndex.get(strictKey) : null)
        || foodIndex.get(`0:${foodId}`)
        || foodIndex.get(`1:${foodId}`)
        || findFoodByIdentity(foods, { foodId, isUserCreated });

      return {
        ...ing,
        food: detailedFood || ing.food,
      };
    });
  };
};

const getRequestTimestamp = (request) => {
  const raw = request?.requested_at || request?.created_at;
  const parsed = raw ? Date.parse(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildLatestRequestMap = (requests = [], keyName) => {
  const map = new Map();

  requests.forEach((request) => {
    const key = request?.[keyName];
    if (key == null) return;

    const mapKey = String(key);
    const current = map.get(mapKey);
    if (!current || getRequestTimestamp(request) > getRequestTimestamp(current)) {
      map.set(mapKey, request);
    }
  });

  return map;
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
  const [recipeStyles, setRecipeStyles] = useState([]);

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
      setStateIfChanged('recipeStyles', staticData.recipeStyles, setRecipeStyles);
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
        const [dietPlanRecipesRes, privateRecipesRes, userDayMealsRes, foodsRes, userFoodsRes, changeRequestsRes, recipeStylesRes] = await Promise.all([
          supabase.from('diet_plan_recipes').select(`
            *,
            recipe:recipe_id(*, template_ingredients:recipe_ingredients(*)),
            custom_ingredients:recipe_ingredients(*),
            day_meal:day_meal_id!inner(id,name,display_order)
          `).eq('diet_plan_id', activePlan.id).eq('is_archived', false),
          supabase.from('user_recipes').select(`
            *,
            recipe_ingredients(*),
            day_meal:day_meal_id!inner(id,name,display_order)
          `).eq('diet_plan_id', activePlan.id).in('type', ['private', 'variant']).eq('is_archived', false),
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
          `).is('user_id', null),
          supabase.from('food').select(`
            *,
            food_to_food_groups(food_group:food_groups(*))
          `).eq('user_id', userId).not('status', 'eq', 'rejected'),
          supabase.from('diet_change_requests').select('*').eq('user_id', userId).eq('status', 'pending'),
          supabase.from('recipe_styles').select('id, name').eq('is_active', true).order('display_order').order('name'),
        ]);

        const staticResponses = [dietPlanRecipesRes, privateRecipesRes, userDayMealsRes, foodsRes, userFoodsRes, changeRequestsRes, recipeStylesRes];
        for (const res of staticResponses) {
          if (res.error) throw res.error;
        }

        const allFoods = [
          ...(foodsRes.data || []),
          ...((userFoodsRes.data || []).map((f) => ({ ...f, is_user_created: true }))),
        ];
        const enrichIngredients = buildIngredientEnricher(allFoods);
        const changeRequests = changeRequestsRes.data || [];
        const latestChangeRequestByPlanRecipeId = buildLatestRequestMap(
          changeRequests.filter((request) => !request.requested_changes_user_recipe_id),
          'diet_plan_recipe_id'
        );
        const latestChangeRequestByRequestedUserRecipeId = buildLatestRequestMap(
          changeRequests,
          'requested_changes_user_recipe_id'
        );

        const processedDietPlanRecipes = (dietPlanRecipesRes.data || []).map((r) => {
          const recipeIngredients = enrichIngredients(r.recipe?.template_ingredients || []);
          const customIngredients = enrichIngredients(r.custom_ingredients || []);
          const request = latestChangeRequestByPlanRecipeId.get(String(r.id));

          return {
            ...r,
            recipe: r.recipe ? { ...r.recipe, recipe_ingredients: recipeIngredients } : r.recipe,
            custom_ingredients: customIngredients,
            dnd_id: `recipe-${r.id}`,
            type: RECIPE_ENTITY_TYPES.PLAN,
            is_private: false,
            changeRequest: request,
          };
        });

        const processedPrivateRecipes = (privateRecipesRes.data || []).map((r) => {
          const recipeIngredients = enrichIngredients(r.recipe_ingredients || []);
          const request = latestChangeRequestByRequestedUserRecipeId.get(String(r.id));

          return {
            ...r,
            user_recipe_type: r.type,
            recipe_ingredients: recipeIngredients,
            dnd_id: `private-${r.id}`,
            type: RECIPE_ENTITY_TYPES.PRIVATE,
            is_private: true,
            changeRequest: request,
          };
        });

        staticData = {
          allFoods,
          recipeStyles: recipeStylesRes.data || [],
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
          diet_plan_recipe:diet_plan_recipes(*, recipe:recipes(*, template_ingredients:recipe_ingredients(*, food(*))), custom_ingredients:recipe_ingredients(*, food(*)), day_meal:day_meals(*)),
          user_recipe:user_recipes(*, recipe_ingredients(*, food(*)), day_meal:day_meals(*))
        `).eq('user_id', userId).eq('diet_plan_id', activePlan.id).gte('plan_date', startDate).lte('plan_date', endDate),
        supabase.from('free_recipe_occurrences').select(`
          *,
          user_recipe:user_recipes!inner(*, recipe_ingredients!inner(id, grams, food:food_id(*))),
          day_meal:day_meals(*)
        `).eq('user_id', userId).gte('meal_date', startDate).lte('meal_date', endDate),
        supabase.from('daily_meal_logs')
          .select('log_date, diet_plan_recipe_id, user_recipe_id, free_recipe_occurrence_id, user_day_meal_id, id')
          .eq('user_id', userId)
          .gte('log_date', startDate)
          .lte('log_date', endDate),
        supabase.from('equivalence_adjustments').select('*').eq('user_id', userId).gte('log_date', startDate).lte('log_date', endDate),
        supabase.from('daily_ingredient_adjustments').select('*, equivalence_adjustment:equivalence_adjustments!inner(id, log_date, user_id, target_user_day_meal_id)').eq('equivalence_adjustment.user_id', userId).gte('equivalence_adjustment.log_date', startDate).lte('equivalence_adjustment.log_date', endDate),
        supabase.from('snack_occurrences').select('*, snack:snacks(*, snack_ingredients(*, food:food_id(*)))').eq('user_id', userId).gte('meal_date', startDate).lte('meal_date', endDate),
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
          const templateIngredients = enrichIngredients(nextPm.diet_plan_recipe.recipe?.template_ingredients || []);
          const customIngredients = enrichIngredients(nextPm.diet_plan_recipe.custom_ingredients || []);

          nextPm.diet_plan_recipe = {
            ...nextPm.diet_plan_recipe,
            recipe: nextPm.diet_plan_recipe.recipe
              ? { ...nextPm.diet_plan_recipe.recipe, recipe_ingredients: templateIngredients }
              : nextPm.diet_plan_recipe.recipe,
            custom_ingredients: customIngredients,
          };
        }

        if (nextPm.user_recipe) {
          nextPm.user_recipe = {
            ...nextPm.user_recipe,
            user_recipe_type: nextPm.user_recipe.type,
            recipe_ingredients: enrichIngredients(nextPm.user_recipe.recipe_ingredients || []),
            is_private: ['private', 'variant'].includes(nextPm.user_recipe.type),
          };
        }

        return nextPm;
      });

      const processedFreeMeals = (freeMealsRes.data || []).map((fm) => {
        const unifiedIngredients = (fm.user_recipe?.recipe_ingredients || []).map((ing) => {
          const foodDetails = ing.food;
          return {
            ...ing,
            food: foodDetails,
            food_id: foodDetails?.id,
            is_user_created: !!foodDetails?.user_id,
          };
        });

        return {
          ...fm.user_recipe,
          recipe_ingredients: enrichIngredients(unifiedIngredients),
          occurrence_id: fm.id,
          meal_date: fm.meal_date,
          day_meal_id: fm.day_meal_id,
          day_meal: fm.day_meal,
          dnd_id: `free-${fm.id}`,
          type: RECIPE_ENTITY_TYPES.FREE,
        };
      });

      const processedSnacks = (snackOccurrencesRes.data || []).map((s) => ({
        ...s.snack,
        snack_ingredients: enrichIngredients(s.snack?.snack_ingredients || []),
        occurrence_id: s.id,
        meal_date: s.meal_date,
        day_meal_id: s.day_meal_id,
        dnd_id: `snack-${s.id}`,
        type: RECIPE_ENTITY_TYPES.SNACK,
      }));

      const currentPlanRecipeIds = new Set(
        (staticData?.planRecipes || [])
          .filter((item) => item.type === 'recipe' && !item.is_private)
          .map((item) => String(item.id))
      );
      const currentPrivateRecipeIds = new Set(
        (staticData?.planRecipes || [])
          .filter((item) => item.type === 'private_recipe' || item.is_private)
          .map((item) => String(item.id))
      );
      const currentFreeOccurrenceIds = new Set(
        (processedFreeMeals || []).map((item) => String(item.occurrence_id))
      );

      const filteredMealLogs = (mealLogsRes.data || [])
        .filter((log) => {
          if (log.diet_plan_recipe_id != null) {
            return currentPlanRecipeIds.has(String(log.diet_plan_recipe_id));
          }
          if (log.user_recipe_id != null) {
            return currentPrivateRecipeIds.has(String(log.user_recipe_id));
          }
          if (log.free_recipe_occurrence_id != null) {
            return currentFreeOccurrenceIds.has(String(log.free_recipe_occurrence_id));
          }
          return false;
        })
        .map((log) => ({
          log_date: log.log_date,
          diet_plan_recipe_id: log.diet_plan_recipe_id,
          user_recipe_id: log.user_recipe_id,
          free_recipe_occurrence_id: log.free_recipe_occurrence_id,
          user_day_meal_id: log.user_day_meal_id,
          id: log.id,
        }));

      const rangeData = {
        plannedMeals: processedPlannedMeals,
        freeMeals: processedFreeMeals,
        mealLogs: filteredMealLogs,
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
      { table: 'user_recipes', filter: `diet_plan_id=eq.${activePlan.id}`, staticRefresh: true },
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
    recipeStyles,
  };
};
