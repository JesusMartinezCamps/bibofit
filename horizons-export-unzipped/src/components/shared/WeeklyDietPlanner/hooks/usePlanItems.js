import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { format } from 'date-fns';
import { useRealtime } from '@/contexts/RealtimeProvider';

const mergeById = (prevArr, newArr) => {
  const map = new Map(prevArr.map(x => [x.id, x]));
  for (const n of newArr) map.set(n.id, n);
  return Array.from(map.values());
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
    const foodsCacheRef = useRef({ userId: null, foods: [] });
    
    const { subscribe, unregister } = useRealtime();

    const fetchAndSetPlanItems = useCallback(async () => {
        setLoading(true);
        setError(null);

        if (!userId || !activePlan) {
            setLoading(false);
            return;
        }

        try {
            const firstDay = weekDates[0];
            const lastDay = weekDates[weekDates.length - 1];
            const startDate = format(firstDay, 'yyyy-MM-dd');
            const endDate = format(lastDay, 'yyyy-MM-dd');
            const shouldFetchFoods = foodsCacheRef.current.userId !== userId || !foodsCacheRef.current.foods?.length;

            const [
                plannedMealsData,
                dietPlanRecipesData,
                privateRecipesData,
                freeMealsData,
                mealLogsData,
                userDayMealsData,
                equivalenceAdjustmentsData,
                ingredientAdjustmentsData,
                snacksData,
                snackLogsData,
                foodsData,
                userFoodsData,
                changeRequestsData,
            ] = await Promise.all([
                supabase.from('planned_meals').select(`
                    *,
                    diet_plan_recipe:diet_plan_recipes(*, recipe:recipes(*, recipe_ingredients(*, food(*))), custom_ingredients:diet_plan_recipe_ingredients(*, food(*)), day_meal:day_meals(*)),
                    private_recipe:private_recipes(*, private_recipe_ingredients(*, food(*)), day_meal:day_meals(*))
                `).eq('user_id', userId).eq('diet_plan_id', activePlan.id).gte('plan_date', startDate).lte('plan_date', endDate),
                
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
                
                supabase.from('user_day_meals')
                    .select('*, day_meal:day_meals(*)')
                    .eq('user_id', userId)
                    .eq('diet_plan_id', activePlan.id)
                    .order('display_order', { foreignTable: 'day_meals' }),
                
                supabase.from('equivalence_adjustments').select('*').eq('user_id', userId).gte('log_date', startDate).lte('log_date', endDate),
                
                supabase.from('daily_ingredient_adjustments').select('*, equivalence_adjustment:equivalence_adjustments!inner(id, log_date, user_id, target_user_day_meal_id)').eq('equivalence_adjustment.user_id', userId).gte('equivalence_adjustment.log_date', startDate).lte('equivalence_adjustment.log_date', endDate),

                supabase.from('snack_occurrences').select('*, snack:snacks(*, snack_ingredients(*, food:food_id(*), user_created_food:user_created_foods(*)))').eq('user_id', userId).gte('meal_date', startDate).lte('meal_date', endDate),
                supabase.from('daily_snack_logs').select('*').eq('user_id', userId).gte('log_date', startDate).lte('log_date', endDate),
                shouldFetchFoods
                    ? supabase.from('food').select(`
                        *, 
                        food_sensitivities(sensitivity:sensitivities(*)), 
                        food_medical_conditions(relation_type, condition:medical_conditions(*)), 
                        food_vitamins(mg_per_100g, vitamin:vitamins(*)), 
                        food_minerals(mg_per_100g, mineral:minerals(*)), 
                        food_to_food_groups(food_group:food_groups(*))
                    `)
                    : Promise.resolve({ data: [], error: null }),
                shouldFetchFoods
                    ? supabase.from('user_created_foods').select('*').eq('user_id', userId).not('status', 'eq', 'rejected')
                    : Promise.resolve({ data: [], error: null }),
                supabase.from('diet_change_requests').select('*').eq('user_id', userId).eq('status', 'pending'),
            ]);

            // Error handling for all promises
            const responses = [plannedMealsData, dietPlanRecipesData, privateRecipesData, freeMealsData, mealLogsData, userDayMealsData, equivalenceAdjustmentsData, ingredientAdjustmentsData, snacksData, snackLogsData, foodsData, userFoodsData, changeRequestsData];
            for (const res of responses) {
                if (res.error) throw res.error;
            }

            const allFoods = shouldFetchFoods
                ? [
                    ...(foodsData.data || []),
                    ...((userFoodsData.data || []).map(f => ({ ...f, is_user_created: true })))
                ]
                : (foodsCacheRef.current.foods || []);

            if (shouldFetchFoods) {
                foodsCacheRef.current = { userId, foods: allFoods };
            }

            setAllAvailableFoods(allFoods);

            const changeRequests = changeRequestsData.data || [];

            const enrichIngredients = (ingredients) => {
                if (!ingredients || !Array.isArray(ingredients)) return [];
                return ingredients.map(ing => {
                    const isUserCreated = ing.is_user_created || ing.user_created_food_id;
                    const foodIdKey = isUserCreated ? ing.user_created_food_id : ing.food_id;
                    
                    const detailedFood = allFoods.find(f => f.id === foodIdKey && f.is_user_created === !!isUserCreated);
                    
                    return {
                        ...ing,
                        food: detailedFood || ing.food 
                    };
                });
            };
            
            const enrichedPlannedMeals = (plannedMealsData.data || []).map(pm => {
                const newPm = { ...pm };
                if (newPm.diet_plan_recipe) {
                    if (newPm.diet_plan_recipe.recipe) {
                        newPm.diet_plan_recipe.recipe.recipe_ingredients = enrichIngredients(newPm.diet_plan_recipe.recipe.recipe_ingredients);
                    }
                    newPm.diet_plan_recipe.custom_ingredients = enrichIngredients(newPm.diet_plan_recipe.custom_ingredients);
                }
                if (newPm.private_recipe) {
                    newPm.private_recipe.private_recipe_ingredients = enrichIngredients(newPm.private_recipe.private_recipe_ingredients);
                }
                return newPm;
            });

            setPlannedMeals(enrichedPlannedMeals);

            const processedDietPlanRecipes = (dietPlanRecipesData.data || []).map(r => {
                if (r.recipe) {
                    r.recipe.recipe_ingredients = enrichIngredients(r.recipe.recipe_ingredients || []);
                }
                r.custom_ingredients = enrichIngredients(r.custom_ingredients || []);
                
                const request = changeRequests.find(cr => cr.diet_plan_recipe_id === r.id && !cr.requested_changes_private_recipe_id);

                return {
                    ...r,
                    dnd_id: `recipe-${r.id}`,
                    type: 'recipe',
                    is_private: false,
                    changeRequest: request
                };
            });

            const processedPrivateRecipes = (privateRecipesData.data || []).map(r => {
                r.private_recipe_ingredients = enrichIngredients(r.private_recipe_ingredients || []);
                
                const request = changeRequests.find(cr => cr.requested_changes_private_recipe_id === r.id);

                return {
                    ...r,
                    dnd_id: `private-${r.id}`,
                    type: 'private_recipe',
                    is_private: true,
                    changeRequest: request
                };
            });

            setPlanRecipes([...processedDietPlanRecipes, ...processedPrivateRecipes]);

            const processedFreeMeals = freeMealsData.data.map(fm => {
                const unifiedIngredients = fm.free_recipe.free_recipe_ingredients.map(ing => {
                    const isUserCreated = !!ing.user_created_food;
                    const foodDetails = ing.food || ing.user_created_food;
                    return {
                      ...ing,
                      food: foodDetails,
                      food_id: foodDetails?.id,
                      is_user_created: isUserCreated,
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
                }
            });
            setFreeMeals(processedFreeMeals);

            const processedSnacks = snacksData.data.map(s => ({
                ...s.snack,
                snack_ingredients: enrichIngredients(s.snack.snack_ingredients),
                occurrence_id: s.id,
                meal_date: s.meal_date,
                day_meal_id: s.day_meal_id,
                dnd_id: `snack-${s.id}`,
                type: 'snack',
            }));
            setSnacks(processedSnacks);
            setSnackLogs(snackLogsData.data || []);

            setMealLogs(mealLogsData.data || []);
            setUserDayMeals(userDayMealsData.data || []);
            
            setEquivalenceAdjustments(equivalenceAdjustmentsData.data || []);
            setDailyIngredientAdjustments(ingredientAdjustmentsData.data || []);

            setAdjustments(equivalenceAdjustmentsData.data || []);
            
        } catch (err) {
            setError(`Error al cargar los datos del plan: ${err.message}`);
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [userId, activePlan, weekDates, setPlannedMeals]);

    useEffect(() => {
        fetchAndSetPlanItems();
    }, [fetchAndSetPlanItems]);

    // Realtime subscription logic for plan items
    useEffect(() => {
        if (!userId) return;

        const tablesToListen = [
            'daily_meal_logs',
            'planned_meals',
            'free_recipe_occurrences',
            'snack_occurrences',
            'daily_snack_logs',
            'daily_ingredient_adjustments',
            'equivalence_adjustments',
            'diet_plan_recipes',
            'private_recipes',
            'snacks'
        ];

        const handleUpdate = () => {
            console.log('Realtime update detected, refreshing plan items...');
            fetchAndSetPlanItems();
        };

        tablesToListen.forEach(table => {
            const key = `plan_items_${table}_${userId}`;
            subscribe(key, {
                event: '*',
                schema: 'public',
                table: table,
                filter: `user_id=eq.${userId}`
            }, handleUpdate);
        });

        return () => {
            tablesToListen.forEach(table => {
                const key = `plan_items_${table}_${userId}`;
                unregister(key, handleUpdate);
            });
        };
    }, [userId, fetchAndSetPlanItems, subscribe, unregister]);


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
        allAvailableFoods
    };
};
