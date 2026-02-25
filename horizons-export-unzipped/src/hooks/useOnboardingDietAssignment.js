import React, { useState } from 'react';
import { assignDietPlanToUser } from '@/lib/dietAssignmentService';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';


const fetchClientRestrictions = async (userId) => {
  if (!userId) {
    return { sensitivities: [], conditions: [] };
  }

  const [{ data: sensitivities, error: sensError }, { data: conditions, error: condError }] = await Promise.all([
    supabase
      .from('user_sensitivities')
      .select('sensitivities(id, name)')
      .eq('user_id', userId),
    supabase
      .from('user_medical_conditions')
      .select('medical_conditions(id, name)')
      .eq('user_id', userId)
  ]);

  if (sensError) throw sensError;
  if (condError) throw condError;

  return {
    sensitivities: (sensitivities || []).map(s => s.sensitivities).filter(Boolean),
    conditions: (conditions || []).map(c => c.medical_conditions).filter(Boolean)
  };
};

const fetchTemplateRecipesWithFoods = async (templateId) => {
  if (!templateId) return [];

  const { data, error } = await supabase
    .from('diet_plan_recipes')
    .select(`
      *,
      recipe:recipe_id(
        *,
        recipe_ingredients(
          *,
          food(
            *,
            food_sensitivities(sensitivity_id),
            food_medical_conditions(*)
          )
        )
      ),
      custom_ingredients:diet_plan_recipe_ingredients(
        *,
        food(
          *,
          food_sensitivities(sensitivity_id),
          food_medical_conditions(*)
        )
      )
    `)
    .eq('diet_plan_id', templateId);

  if (error) throw error;
  return data || [];
};

const buildConflictsMap = (templateRecipes = [], clientRestrictions = { sensitivities: [], conditions: [] }) => {
  const newConflicts = {};

  const clientSensitivityIds = new Set((clientRestrictions.sensitivities || []).map(s => s.id));
  const clientConditionIds = new Set((clientRestrictions.conditions || []).map(c => c.id));

  templateRecipes.forEach(recipe => {
    const ingredientsSource = recipe.custom_ingredients?.length > 0
      ? recipe.custom_ingredients
      : recipe.recipe?.recipe_ingredients || [];

    const ingredients = ingredientsSource.map(i => i?.food).filter(Boolean);

    ingredients.forEach(food => {
      (food.food_sensitivities || []).forEach(fs => {
        if (clientSensitivityIds.has(fs.sensitivity_id)) {
          const restriction = (clientRestrictions.sensitivities || []).find(s => s.id === fs.sensitivity_id);
          if (restriction) {
            if (!newConflicts[restriction.name]) newConflicts[restriction.name] = [];
            if (!newConflicts[restriction.name].some(r => r.id === recipe.id)) {
              newConflicts[restriction.name].push(recipe);
            }
          }
        }
      });

      (food.food_medical_conditions || []).forEach(fmc => {
        if (clientConditionIds.has(fmc.condition_id) && (fmc.relation_type === 'to_avoid' || fmc.relation_type === 'evitar')) {
          const restriction = (clientRestrictions.conditions || []).find(c => c.id === fmc.condition_id);
          if (restriction) {
            if (!newConflicts[restriction.name]) newConflicts[restriction.name] = [];
            if (!newConflicts[restriction.name].some(r => r.id === recipe.id)) {
              newConflicts[restriction.name].push(recipe);
            }
          }
        }
      });
    });
  });

  return newConflicts;
};

const buildRecipeOverrideMap = (templateRecipes = []) => {
  const map = new Map();
  templateRecipes.forEach(recipe => map.set(recipe.id, recipe));
  return map;
};

export const useOnboardingDietAssignment = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { toast } = useToast();
 const prepareConflictResolutionData = async ({ userId, template }) => {
    const [clientRestrictions, templateRecipes] = await Promise.all([
      fetchClientRestrictions(userId),
      fetchTemplateRecipesWithFoods(template?.id)
    ]);

    const conflicts = buildConflictsMap(templateRecipes, clientRestrictions);

    return {
      conflicts,
      clientRestrictions,
      templateRecipes,
      recipeOverrides: buildRecipeOverrideMap(templateRecipes),
      planRestrictionsForEditor: {
        sensitivities: (clientRestrictions.sensitivities || []).map(s => s.id),
        conditions: (clientRestrictions.conditions || []).map(c => c.id)
      }
    };
  };
  const assignDietFromOnboarding = async (userId, onboardingData) => {
    setLoading(true);
    setError(null);

    try {
      const { 
        macrosPct, 
        meals,
        template,
        planName,
        dailyCalories
      } = onboardingData;

      // 1. Calculate Daily Grams based on TDEE and Global Ratios
      const dailyProteins = Math.round((dailyCalories * (macrosPct.protein / 100)) / 4);
      const dailyCarbs = Math.round((dailyCalories * (macrosPct.carbs / 100)) / 4);
      const dailyFats = Math.round((dailyCalories * (macrosPct.fat / 100)) / 9);

      // 2. Build Meals Array with Calculated Targets
      const calculatedMeals = meals.map(meal => {
        // Calculate grams for this meal based on its share of the daily total
        const target_proteins = Math.round(dailyProteins * (meal.protein_pct / 100));
        const target_carbs = Math.round(dailyCarbs * (meal.carbs_pct / 100));
        const target_fats = Math.round(dailyFats * (meal.fat_pct / 100));
        
        // Calculate calories for this meal from its macros
        const target_calories = (target_proteins * 4) + (target_carbs * 4) + (target_fats * 9);
        
        // Return meal with populated targets
        return {
            ...meal,
            target_calories,
            target_proteins,
            target_carbs,
            target_fats
        };
      });

      // Calculate dates
      const now = new Date();
      const startDate = now.toISOString().split('T')[0];
      const endDate = new Date(now.setFullYear(now.getFullYear() + 100)).toISOString().split('T')[0];

      // 3. Construct Final Plan Data
      const planData = {
        planName: planName || "Mi Plan de Nutrición",
        startDate: startDate,
        endDate: endDate,
        template: template,
        dailyCalories: dailyCalories,
        globalMacros: macrosPct || { protein: 30, carbs: 40, fat: 30 },
        mealMacroDistribution: calculatedMeals,
        overrides: [] 
      };

      // 4. Create Plan via Service
        const result = await assignDietPlanToUser(userId, planData, true, onboardingData?.recipeOverrides);

      if (!result.success) {
        throw new Error(result.error?.message || "Error desconocido al asignar el plan.");
      }

      return { success: true, planId: result.planId };

    } catch (err) {
      setError(err.message);
      
      toast({
        title: "Error al crear el plan",
        description: React.createElement(
          "div",
          { className: "flex flex-col gap-1" },
          React.createElement("span", null, "Hubo un problema procesando tus datos."),
          React.createElement("span", { className: "text-xs opacity-90 font-mono bg-red-900/30 p-1 rounded" }, err.message)
        ),
        variant: "destructive",
        duration: 5000,
      });
      return { success: false, error: err };
    } finally {
      setLoading(false);
    }
  };

  return {
      assignDietFromOnboarding,
      prepareConflictResolutionData,
    loading,
    error
  };
};