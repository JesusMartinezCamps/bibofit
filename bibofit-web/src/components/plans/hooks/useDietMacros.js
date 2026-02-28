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

    const applicableOverride = [...(data.calorieOverrides || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
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
          dietPlanIngredientsRes,
          privateRecipeIngredientsRes,
          freeRecipeOccurrencesRes,
          snackOccurrencesRes,
          equivalenceAdjustmentsRes,
        ] = await Promise.all([
          dietPlanRecipeIds.length > 0
            ? supabase
                .from('diet_plan_recipe_ingredients')
                .select('diet_plan_recipe_id, food_id, grams, food(id, proteins, total_carbs, total_fats, food_unit)')
                .in('diet_plan_recipe_id', dietPlanRecipeIds)
            : Promise.resolve({ data: [], error: null }),
          privateRecipeIds.length > 0
            ? supabase
                .from('private_recipe_ingredients')
                .select('private_recipe_id, food_id, grams, food(id, proteins, total_carbs, total_fats, food_unit)')
                .in('private_recipe_id', privateRecipeIds)
            : Promise.resolve({ data: [], error: null }),
          freeRecipeOccurrenceIds.length > 0
            ? supabase
                .from('free_recipe_occurrences')
                .select(
                  'id, free_recipe:free_recipes(id, free_recipe_ingredients(id, grams, food(id, proteins, total_carbs, total_fats, food_unit)))'
                )
                .in('id', freeRecipeOccurrenceIds)
            : Promise.resolve({ data: [], error: null }),
          snackOccurrenceIds.length > 0
            ? supabase
                .from('snack_occurrences')
                .select('id, snack:snacks(id, snack_ingredients(id, grams, food(id, proteins, total_carbs, total_fats, food_unit)))')
                .in('id', snackOccurrenceIds)
            : Promise.resolve({ data: [], error: null }),
          supabase.from('equivalence_adjustments').select('id').eq('user_id', userId).eq('log_date', logDate),
        ]);

        if (
          dietPlanIngredientsRes.error ||
          privateRecipeIngredientsRes.error ||
          freeRecipeOccurrencesRes.error ||
          snackOccurrencesRes.error ||
          equivalenceAdjustmentsRes.error
        ) {
          throw (
            dietPlanIngredientsRes.error ||
            privateRecipeIngredientsRes.error ||
            freeRecipeOccurrencesRes.error ||
            snackOccurrencesRes.error ||
            equivalenceAdjustmentsRes.error
          );
        }

        const dietPlanIngredients = dietPlanIngredientsRes.data || [];
        const privateRecipeIngredients = privateRecipeIngredientsRes.data || [];
        const freeRecipeOccurrences = freeRecipeOccurrencesRes.data || [];
        const snackOccurrences = snackOccurrencesRes.data || [];
        const equivalenceAdjustments = equivalenceAdjustmentsRes.data || [];

        let ingredientAdjustments = [];
        if (equivalenceAdjustments.length > 0) {
          const { data: adjData, error: adjError } = await supabase
            .from('daily_ingredient_adjustments')
            .select('equivalence_adjustment_id, diet_plan_recipe_id, private_recipe_id, food_id, adjusted_grams')
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

        const dietAdjustmentMap = new Map(
          ingredientAdjustments
            .filter((adj) => adj.diet_plan_recipe_id && adj.food_id)
            .map((adj) => [`${adj.diet_plan_recipe_id}-${adj.food_id}`, adj.adjusted_grams])
        );
        const privateAdjustmentMap = new Map(
          ingredientAdjustments
            .filter((adj) => adj.private_recipe_id && adj.food_id)
            .map((adj) => [`${adj.private_recipe_id}-${adj.food_id}`, adj.adjusted_grams])
        );

        const adjustedDietPlanIngredients = dietPlanIngredients.map((ing) => {
          const adjustedGrams = dietAdjustmentMap.get(`${ing.diet_plan_recipe_id}-${ing.food_id}`);
          const adjustment = adjustedGrams !== undefined ? { adjusted_grams: adjustedGrams } : null;
          return adjustment ? { ...ing, grams: adjustment.adjusted_grams } : ing;
        });

        const adjustedPrivateRecipeIngredients = privateRecipeIngredients.map((ing) => {
          const adjustedGrams = privateAdjustmentMap.get(`${ing.private_recipe_id}-${ing.food_id}`);
          const adjustment = adjustedGrams !== undefined ? { adjusted_grams: adjustedGrams } : null;
          return adjustment ? { ...ing, grams: adjustment.adjusted_grams } : ing;
        });

        const allConsumedIngredients = [
          ...adjustedDietPlanIngredients,
          ...adjustedPrivateRecipeIngredients,
          ...freeRecipeIngredients,
          ...snackIngredients,
        ];

        setConsumedMacros(calculateMacros(allConsumedIngredients));
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
