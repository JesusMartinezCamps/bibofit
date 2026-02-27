import React, { useState } from 'react';
import { assignDietPlanToUser } from '@/lib/dietAssignmentService';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { getConflictInfo, getConflictWithSubstitutions } from '@/lib/restrictionChecker';


const fetchClientRestrictions = async (userId) => {
  if (!userId) {
    return {
      sensitivities: [],
      conditions: [],
      medical_conditions: [],
      individual_food_restrictions: [],
      preferred_foods: [],
      non_preferred_foods: []
    };
  }

  const [
    { data: sensitivities, error: sensError },
    { data: conditions, error: condError },
    { data: individualRestrictions, error: individualError },
    { data: preferredFoods, error: preferredError },
    { data: nonPreferredFoods, error: nonPreferredError }
  ] = await Promise.all([
    supabase
      .from('user_sensitivities')
      .select('sensitivities(id, name)')
      .eq('user_id', userId),
    supabase
      .from('user_medical_conditions')
      .select('medical_conditions(id, name)')
      .eq('user_id', userId),
    supabase
      .from('user_individual_food_restrictions')
      .select('food(id, name)')
      .eq('user_id', userId),
    supabase
      .from('preferred_foods')
      .select('food(id, name)')
      .eq('user_id', userId),
    supabase
      .from('non_preferred_foods')
      .select('food(id, name)')
      .eq('user_id', userId)
  ]);

  if (sensError) throw sensError;
  if (condError) throw condError;
  if (individualError) throw individualError;
  if (preferredError) throw preferredError;
  if (nonPreferredError) throw nonPreferredError;

  const normalizedSensitivities = (sensitivities || []).map(s => s.sensitivities).filter(Boolean);
  const normalizedConditions = (conditions || []).map(c => c.medical_conditions).filter(Boolean);
  const normalizedIndividualRestrictions = (individualRestrictions || []).map(i => i.food).filter(Boolean);
  const normalizedPreferredFoods = (preferredFoods || []).map(i => i.food).filter(Boolean);
  const normalizedNonPreferredFoods = (nonPreferredFoods || []).map(i => i.food).filter(Boolean);

  return {
    sensitivities: normalizedSensitivities,
    conditions: normalizedConditions,
    medical_conditions: normalizedConditions,
    individual_food_restrictions: normalizedIndividualRestrictions,
    preferred_foods: normalizedPreferredFoods,
    non_preferred_foods: normalizedNonPreferredFoods
  };
};

const fetchTemplateRecipesWithFoods = async (templateId) => {
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
            food_medical_conditions(*, medical_conditions(id, name))
          )
        )
      ),
      custom_ingredients:diet_plan_recipe_ingredients(
        *,
        food(
          *,
          food_sensitivities(sensitivity_id, sensitivities(id, name)),
          food_medical_conditions(*, medical_conditions(id, name))
        )
      )
    `)
    .eq('diet_plan_id', templateId);

  if (error) throw error;
  return data || [];
};

const buildConflictsMap = (templateRecipes = [], clientRestrictions = { sensitivities: [], conditions: [] }) => {
  const newConflicts = {};
  const criticalConflictTypes = new Set(['condition_avoid', 'sensitivity', 'non-preferred']);

  templateRecipes.forEach(recipe => {
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
      if (!newConflicts[restrictionKey].some(r => r.id === recipe.id)) {
        newConflicts[restrictionKey].push(recipe);
      }
    });
  });

  return newConflicts;
};

const buildRecipeOverrideMap = (templateRecipes = []) => {
  const map = new Map();
  templateRecipes.forEach(recipe => map.set(recipe.id, recipe));
  return map;
};

const fetchAllFoodsForSubstitutions = async () => {
  const { data, error } = await supabase
    .from('food')
    .select(`
      *,
      food_sensitivities(sensitivity_id),
      food_medical_conditions(*)
    `);

  if (error) throw error;
  return data || [];
};

const cloneRecipe = (recipe) => {
  if (typeof structuredClone === 'function') {
    return structuredClone(recipe);
  }

  return JSON.parse(JSON.stringify(recipe));
};

const normalizeIngredientQuantityForTargetFood = (ingredient, targetFood) => {
  const sourceUnit = ingredient?.food?.food_unit || 'gramos';
  const targetUnit = targetFood?.food_unit || 'gramos';
  const currentQty = Number(ingredient?.grams ?? ingredient?.quantity ?? 0);
  const hasCurrentQty = Number.isFinite(currentQty) && currentQty > 0;

  if (sourceUnit === targetUnit) {
    return hasCurrentQty ? currentQty : (targetUnit === 'unidades' ? 1 : 100);
  }

  return targetUnit === 'unidades' ? 1 : 100;
};

const applyAutoSubstitutionsToRecipe = async ({
  recipe,
  clientRestrictions,
  allFoods,
  analysisCache
}) => {
  const updatedRecipe = cloneRecipe(recipe);
  const foodsById = new Map(allFoods.map(food => [food.id, food]));
  const autoApplied = [];
  let hasChanges = false;

  if (updatedRecipe.custom_ingredients?.length > 0) {
    for (let index = 0; index < updatedRecipe.custom_ingredients.length; index += 1) {
      const ingredient = updatedRecipe.custom_ingredients[index];
      const food = ingredient?.food;
      if (!food?.id) continue;

      let analysis = analysisCache.get(food.id);
      if (!analysis) {
        analysis = await getConflictWithSubstitutions(food, clientRestrictions, allFoods);
        analysisCache.set(food.id, analysis);
      }

      if (!analysis?.hasConflict || !analysis?.autoSubstitution) continue;

      const targetFood = foodsById.get(analysis.autoSubstitution.target_food_id);
      if (!targetFood) continue;
      const normalizedQty = normalizeIngredientQuantityForTargetFood(ingredient, targetFood);

      updatedRecipe.custom_ingredients[index] = {
        ...ingredient,
        food_id: targetFood.id,
        food: targetFood,
        grams: normalizedQty,
        quantity: normalizedQty
      };

      autoApplied.push({
        recipeId: recipe.id,
        recipeName: recipe.custom_name || recipe.recipe?.name || recipe.name || 'Receta',
        sourceFoodName: food.name,
        targetFoodName: targetFood.name
      });
      hasChanges = true;
    }
  } else if (updatedRecipe.recipe?.recipe_ingredients?.length > 0) {
    for (let index = 0; index < updatedRecipe.recipe.recipe_ingredients.length; index += 1) {
      const ingredient = updatedRecipe.recipe.recipe_ingredients[index];
      const food = ingredient?.food;
      if (!food?.id) continue;

      let analysis = analysisCache.get(food.id);
      if (!analysis) {
        analysis = await getConflictWithSubstitutions(food, clientRestrictions, allFoods);
        analysisCache.set(food.id, analysis);
      }

      if (!analysis?.hasConflict || !analysis?.autoSubstitution) continue;

      const targetFood = foodsById.get(analysis.autoSubstitution.target_food_id);
      if (!targetFood) continue;
      const normalizedQty = normalizeIngredientQuantityForTargetFood(ingredient, targetFood);

      updatedRecipe.recipe.recipe_ingredients[index] = {
        ...ingredient,
        food_id: targetFood.id,
        food: targetFood,
        grams: normalizedQty,
        quantity: normalizedQty
      };

      autoApplied.push({
        recipeId: recipe.id,
        recipeName: recipe.custom_name || recipe.recipe?.name || recipe.name || 'Receta',
        sourceFoodName: food.name,
        targetFoodName: targetFood.name
      });
      hasChanges = true;
    }
  }

  return {
    updatedRecipe,
    hasChanges,
    autoApplied
  };
};

export const useOnboardingDietAssignment = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { toast } = useToast();
 const prepareConflictResolutionData = async ({ userId, template }) => {
    const [clientRestrictions, templateRecipes, allFoods] = await Promise.all([
      fetchClientRestrictions(userId),
      fetchTemplateRecipesWithFoods(template?.id),
      fetchAllFoodsForSubstitutions()
    ]);

    const recipeOverrides = buildRecipeOverrideMap(templateRecipes);
    const analysisCache = new Map();
    const autoSubstitutionsApplied = [];

    for (const recipe of templateRecipes) {
      const { updatedRecipe, hasChanges, autoApplied } = await applyAutoSubstitutionsToRecipe({
        recipe,
        clientRestrictions,
        allFoods,
        analysisCache
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
        sensitivities: clientRestrictions.sensitivities || [],
        medical_conditions: clientRestrictions.medical_conditions || clientRestrictions.conditions || [],
        individual_food_restrictions: clientRestrictions.individual_food_restrictions || [],
        preferred_foods: clientRestrictions.preferred_foods || [],
        non_preferred_foods: clientRestrictions.non_preferred_foods || []
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
