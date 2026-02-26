import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { calculateMacros } from '@/lib/macroCalculator';

export const useDietMacros = ({ data, activePlan, userId, logDate, viewMode, toast }) => {
  const [targetMacros, setTargetMacros] = useState({ calories: 0, proteins: 0, carbs: 0, fats: 0 });
  const [consumedMacros, setConsumedMacros] = useState({ calories: 0, proteins: 0, carbs: 0, fats: 0 });
  const [loadingMacros, setLoadingMacros] = useState(true);

  const calculateTargetMacros = useCallback(() => {
    if (!data?.profile || !activePlan) {
      setTargetMacros({ calories: 0, proteins: 0, carbs: 0, fats: 0 });
      return;
    }

    const applicableOverride = data.calorieOverrides.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
    const totalCalories = applicableOverride ? applicableOverride.manual_calories : data.profile.tdee_kcal || 0;

    const proteinPct = activePlan.protein_pct || 0;
    const carbsPct = activePlan.carbs_pct || 0;
    const fatPct = activePlan.fat_pct || 0;

    setTargetMacros({
      calories: totalCalories,
      proteins: (totalCalories * (proteinPct / 100)) / 4,
      carbs: (totalCalories * (carbsPct / 100)) / 4,
      fats: (totalCalories * (fatPct / 100)) / 9,
    });
  }, [data, activePlan]);

  const refreshConsumedMacros = useCallback(
    async (isInitialLoad = false) => {
      if (viewMode !== 'list' || !userId || !activePlan) {
        setConsumedMacros({ calories: 0, proteins: 0, carbs: 0, fats: 0 });
        setLoadingMacros(false);
        return;
      }
      if (isInitialLoad) setLoadingMacros(true);

      try {
        const [{ data: consumedLogs, error: logsError }, { data: snackLogs, error: snackLogsError }] = await Promise.all([
          supabase
            .from('daily_meal_logs')
            .select('diet_plan_recipe_id, private_recipe_id, free_recipe_occurrence_id')
            .eq('user_id', userId)
            .eq('log_date', logDate),
          supabase.from('daily_snack_logs').select('snack_occurrence_id').eq('user_id', userId).eq('log_date', logDate),
        ]);

        if (logsError) throw logsError;
        if (snackLogsError) throw snackLogsError;

        if ((!consumedLogs || consumedLogs.length === 0) && (!snackLogs || snackLogs.length === 0)) {
          setConsumedMacros({ calories: 0, proteins: 0, carbs: 0, fats: 0 });
          setLoadingMacros(false);
          return;
        }

        const dietPlanRecipeIds = consumedLogs.map((l) => l.diet_plan_recipe_id).filter(Boolean);
        const privateRecipeIds = consumedLogs.map((l) => l.private_recipe_id).filter(Boolean);
        const freeRecipeOccurrenceIds = consumedLogs.map((l) => l.free_recipe_occurrence_id).filter(Boolean);
        const snackOccurrenceIds = snackLogs.map((l) => l.snack_occurrence_id).filter(Boolean);

        const [
          { data: dietPlanIngredients, error: dprError },
          { data: privateRecipeIngredients, error: prError },
          { data: freeRecipeOccurrences, error: froError },
          { data: snackOccurrences, error: soError },
          { data: allFoods, error: foodError },
          { data: equivalenceAdjustments, error: eqAdjError },
        ] = await Promise.all([
          supabase.from('diet_plan_recipe_ingredients').select('*, food(*)').in('diet_plan_recipe_id', dietPlanRecipeIds),
          supabase.from('private_recipe_ingredients').select('*, food(*)').in('private_recipe_id', privateRecipeIds),
          supabase
            .from('free_recipe_occurrences')
            .select('*, free_recipe:free_recipes(*, free_recipe_ingredients(*, food(*)))')
            .in('id', freeRecipeOccurrenceIds),
          supabase
            .from('snack_occurrences')
            .select('*, snack:snacks(*, snack_ingredients(*, food(*)))')
            .in('id', snackOccurrenceIds),
          supabase.from('food').select('*'),
          supabase.from('equivalence_adjustments').select('id').eq('user_id', userId).eq('log_date', logDate),
        ]);

        if (dprError || prError || froError || soError || foodError || eqAdjError) {
          throw dprError || prError || froError || soError || foodError || eqAdjError;
        }

        let ingredientAdjustments = [];
        if (equivalenceAdjustments && equivalenceAdjustments.length > 0) {
          const { data: adjData, error: adjError } = await supabase
            .from('daily_ingredient_adjustments')
            .select('*')
            .in('equivalence_adjustment_id', equivalenceAdjustments.map((ea) => ea.id));
          if (adjError) throw adjError;
          ingredientAdjustments = adjData || [];
        }

        const freeRecipeIngredients = freeRecipeOccurrences.flatMap((occurrence) =>
          occurrence.free_recipe.free_recipe_ingredients.map((ing) => ({ ...ing, food: ing.food }))
        );
        const snackIngredients = snackOccurrences.flatMap((occurrence) =>
          occurrence.snack.snack_ingredients.map((ing) => ({ ...ing, food: ing.food }))
        );

        const adjustedDietPlanIngredients = dietPlanIngredients.map((ing) => {
          const adjustment = ingredientAdjustments.find(
            (adj) => adj.diet_plan_recipe_id === ing.diet_plan_recipe_id && adj.food_id === ing.food_id
          );
          return adjustment ? { ...ing, grams: adjustment.adjusted_grams } : ing;
        });

        const adjustedPrivateRecipeIngredients = privateRecipeIngredients.map((ing) => {
          const adjustment = ingredientAdjustments.find(
            (adj) => adj.private_recipe_id === ing.private_recipe_id && adj.food_id === ing.food_id
          );
          return adjustment ? { ...ing, grams: adjustment.adjusted_grams } : ing;
        });

        const allConsumedIngredients = [
          ...adjustedDietPlanIngredients,
          ...adjustedPrivateRecipeIngredients,
          ...freeRecipeIngredients,
          ...snackIngredients,
        ];

        setConsumedMacros(calculateMacros(allConsumedIngredients, allFoods));
      } catch (error) {
        console.error('Error fetching consumed macros:', error);
        toast({ title: 'Error', description: 'No se pudieron calcular las macros consumidas.', variant: 'destructive' });
      } finally {
        if (isInitialLoad) setLoadingMacros(false);
      }
    },
    [userId, activePlan, logDate, toast, viewMode]
  );

  const applyMacroDelta = useCallback((macroDelta) => {
    setConsumedMacros((prev) => ({
      calories: Math.max(0, (prev?.calories || 0) + (macroDelta?.calories || 0)),
      proteins: Math.max(0, (prev?.proteins || 0) + (macroDelta?.proteins || 0)),
      carbs: Math.max(0, (prev?.carbs || 0) + (macroDelta?.carbs || 0)),
      fats: Math.max(0, (prev?.fats || 0) + (macroDelta?.fats || 0)),
    }));
  }, []);

  useEffect(() => {
    calculateTargetMacros();
  }, [calculateTargetMacros]);

  useEffect(() => {
    refreshConsumedMacros(true);
  }, [refreshConsumedMacros]);

  return {
    targetMacros,
    consumedMacros,
    loadingMacros,
    refreshConsumedMacros,
    applyMacroDelta,
  };
};
