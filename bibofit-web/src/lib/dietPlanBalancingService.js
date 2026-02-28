import { supabase } from '@/lib/supabaseClient';
import { invokeAutoBalanceDietPlans } from '@/lib/autoBalanceClient';

const DEBUG_MODE = true; // Debug flag

/**
 * Task 1: Fetch recipes for a template.
 * Queries diet_plan_recipes to get IDs.
 * Returns recipes grouped by day_meal_id as arrays of IDs.
 * Format: { 1: [90, 91], 2: [100], ... }
 */
export const fetchRecipesForTemplate = async (templateId) => {
    if (!templateId) return {};

    console.log(`🔎 Fetching recipes for template ID: ${templateId}`);

    // 1. Fetch diet_plan_recipes - simplified query
    const { data: planRecipes, error: recipesError } = await supabase
        .from('diet_plan_recipes')
        .select('recipe_id, day_meal_id')
        .eq('diet_plan_id', templateId);

    if (recipesError) {
        console.error("❌ Error fetching template recipes:", recipesError);
        throw new Error("Error fetching template recipes.");
    }

    if (!planRecipes || planRecipes.length === 0) {
        console.warn("⚠️ No recipes found for this template.");
        return {};
    }

    // 2. Group IDs by meal
    const recipesByMeal = {};

    planRecipes.forEach(pr => {
        const mealId = pr.day_meal_id;
        if (!recipesByMeal[mealId]) recipesByMeal[mealId] = [];

        if (pr.recipe_id) {
            recipesByMeal[mealId].push(pr.recipe_id);
        }
    });

    if (DEBUG_MODE) {
        console.log("✅ Fetched Recipe IDs by Meal Group:", recipesByMeal);
    }

    return recipesByMeal;
};

/**
 * Validates the payload before sending to the Edge Function.
 * Checks required fields, types, and recipe ID presence.
 */
export const validatePayloadBeforeSending = (payload) => {
  const errors = [];
  const requiredFields = ['user_id', 'tdee', 'macro_distribution', 'meals'];

  // 1. Check required fields
  requiredFields.forEach(field => {
    if (payload[field] === undefined || payload[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  });

  // 2. Validate Data Types
  if (typeof payload.tdee !== 'number' || isNaN(payload.tdee)) {
    errors.push(`Invalid tdee: must be a valid number. Received: ${payload.tdee}`);
  }

  if (typeof payload.macro_distribution !== 'object') {
    errors.push(`Invalid macro_distribution: must be an object.`);
  } else {
    const { protein, carbs, fat } = payload.macro_distribution;
    if (typeof protein !== 'number' || typeof carbs !== 'number' || typeof fat !== 'number') {
      errors.push(`Invalid macro_distribution values: must be numbers.`);
    }
  }

  // 3. Validate Arrays
  if (!Array.isArray(payload.meals) || payload.meals.length === 0) {
    errors.push(`Invalid meals: must be a non-empty array.`);
  } else {
    payload.meals.forEach((meal, index) => {
        const mealId = Number(meal.day_meal_id);
        if (!Number.isInteger(mealId) || mealId <= 0) {
          errors.push(`Meal at index ${index} has invalid day_meal_id: ${meal.day_meal_id}`);
          return;
        }

        const hasRecipesPayload = Array.isArray(meal.recipes) && meal.recipes.length > 0;
        if (!hasRecipesPayload) {
             errors.push(`Meal (ID: ${meal.day_meal_id}) has no detailed recipes assigned.`);
            return;
        }

        if (hasRecipesPayload) {
            meal.recipes.forEach((recipe, recipeIndex) => {
                const recipeId = Number(recipe?.recipe_id);
                if (!Number.isInteger(recipeId) || recipeId <= 0) {
                    errors.push(`Meal (ID: ${meal.day_meal_id}) recipe at index ${recipeIndex} missing recipe_id`);
                }
                const ingredients = Array.isArray(recipe?.ingredients) ? recipe.ingredients : [];
                if (ingredients.length === 0) {
                    errors.push(`Meal (ID: ${meal.day_meal_id}) recipe ${recipe?.recipe_id} has no ingredients`);
                }
                ingredients.forEach((ingredient, ingredientIndex) => {
                    const foodId = Number(ingredient?.food_id);
                    const grams = Number(ingredient?.grams ?? ingredient?.quantity ?? 0);
                    if (!Number.isInteger(foodId) || foodId <= 0) {
                        errors.push(`Meal (ID: ${meal.day_meal_id}) recipe ${recipe?.recipe_id} ingredient ${ingredientIndex} invalid food_id`);
                    }
                    if (!Number.isFinite(grams) || grams <= 0) {
                        errors.push(`Meal (ID: ${meal.day_meal_id}) recipe ${recipe?.recipe_id} ingredient ${ingredientIndex} invalid grams`);
                    }
                });
            });
        }
    });
  }

  if (errors.length > 0) {
    console.error("❌ Payload Validation Failed:", errors);
    return { isValid: false, errors };
  }

  if (DEBUG_MODE) console.log("✅ Payload Validation Passed");
  return { isValid: true };
};

/**
 * Detailed logging wrapper function
 */
export const logPayloadStructure = (payload, label = "Payload Structure") => {
    console.group(`🔍 ${label} [${new Date().toISOString()}]`);
    console.log("📦 Full Payload Object:", JSON.parse(JSON.stringify(payload)));
    console.groupEnd();
};

/**
 * Constructs the payload matching the Edge Function's expected schema.
 * Simplified to use arrays of IDs and percentages.
 */
export const buildMacroBalancingParams = ({
  templateId,
  userId,
  caloriesTarget, 
  macroDistribution,
  mealTargets,
  startDate,
  endDate,
  groupedRecipes = {} // Expects { mealId: [{ source_row_id, recipe_id, ingredients: [] }] }
}) => {
  
  if (DEBUG_MODE) {
      console.log(`🔨 Building Params. TemplateID: ${templateId}`);
      console.log(`🍲 Recipe IDs Available for Mapping:`, groupedRecipes);
  }

  const mealsPayload = mealTargets.map(m => {
        // Ensure day_meal_id is used. 
        // If m.id is string "1", "2", etc, it might need conversion.
        // Assuming m.day_meal_id is the reliable DB ID.
        const rawMealId = m.day_meal_id ?? m.dayMealId ?? m.id;
        const mealId = Number(rawMealId);
        if (!Number.isInteger(mealId) || mealId <= 0) {
            throw new Error(`Invalid day_meal_id detected while building payload: ${rawMealId}`);
        }

        const groupedMealRecipes = groupedRecipes[mealId] || [];
        const recipes = groupedMealRecipes.map((recipe) => ({
            source_row_id: recipe.source_row_id != null ? Number(recipe.source_row_id) : undefined,
            recipe_id: Number(recipe.recipe_id),
            ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : []
        }));
        
        if (DEBUG_MODE) {
            console.log(`   Meal ID: ${mealId} -> Recipes:`, recipes);
        }

        return {
            day_meal_id: mealId,
            recipes, // Detailed payload with effective ingredients (overrides-safe)
            protein_pct: Number(m.protein_pct || 0),
            carbs_pct: Number(m.carbs_pct || 0),
            fat_pct: Number(m.fat_pct || 0)
        };
  });

  const payload = {
    user_id: userId,
    template_id: templateId,
    tdee: Number(caloriesTarget), 
    macro_distribution: macroDistribution, 
    meals: mealsPayload,
    start_date: startDate,
    end_date: endDate
  };
  
  if (DEBUG_MODE) {
      console.log("📤 Final Payload for Edge Function:", payload);
  }

  return payload;
};

/**
 * Invokes the Edge Function with logging and error handling.
 */
export const callMacroBalancingEdgeFunction = async (payload) => {
  const FUNCTION_NAME = 'auto-balance-macros-dietPlans';

  if (DEBUG_MODE) {
      console.log(`🚀 Preparing to call ${FUNCTION_NAME}`);
      logPayloadStructure(payload, "FINAL Payload with Recipes");
  }

  const validation = validatePayloadBeforeSending(payload);
  if (!validation.isValid) {
      throw new Error(`Error de validación: ${validation.errors[0]}`); 
  }

  try {
    const data = await invokeAutoBalanceDietPlans(payload);

    if (DEBUG_MODE) {
        console.group("✅ Edge Function Success Response");
        console.log("Success:", data.success);
        console.log("New Plan ID:", data?.new_plan_id);
        console.groupEnd();
    }

    return data;

  } catch (err) {
    console.error(`💥 Exception calling ${FUNCTION_NAME}:`, err);
    throw err;
  }
};
