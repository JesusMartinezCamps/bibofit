import { supabase } from '@/lib/supabaseClient';

const CACHE_LIMIT = 50;
const macroCache = new Map();

/**
 * Helper to normalize the foods input.
 * In this implementation, we support both Map and Array natively,
 * so we don't force conversion unless the input is invalid.
 */
const normalizeAvailableFoods = (foods) => {
  if (foods instanceof Map) return foods;
  if (Array.isArray(foods)) return foods;
  return [];
};

/**
 * Normaliza un objeto de alimento para asegurar que tenga los campos de macros necesarios.
 * @param {Object} foodObject - El objeto del alimento a normalizar.
 * @returns {Object} - Un objeto de alimento normalizado y seguro para cálculos.
 */
const normalizeFoodData = (foodObject) => {
  if (!foodObject) {
    return null;
  }
  return {
    ...foodObject,
    proteins: parseFloat(foodObject.proteins) || 0,
    total_carbs: parseFloat(foodObject.total_carbs) || 0,
    total_fats: parseFloat(foodObject.total_fats) || 0,
    food_unit: foodObject.food_unit || 'gramos',
  };
};

/**
 * Calcula los macros de una lista de ingredientes de forma robusta.
 * @param {Array} ingredients - Array de ingredientes con food_id y grams/quantity.
 * @param {Array|Map} [allFoods=[]] - Array o Map de todos los alimentos disponibles.
 * @returns {Object} - Objeto con calories, proteins, carbs, fats.
 */
export const calculateMacros = (ingredients, allFoods = []) => {
  // 1. Validation
  if (!ingredients || !Array.isArray(ingredients)) {
    return { calories: 0, proteins: 0, carbs: 0, fats: 0 };
  }

  // 2. Cache Check (Performance Optimization)
  // We use stringified ingredients as key. This assumes allFoods context is stable for the same ingredients.
  const cacheKey = JSON.stringify(ingredients);
  if (macroCache.has(cacheKey)) {
    return macroCache.get(cacheKey);
  }

  // 3. Normalize Data Source
  const foodsSource = normalizeAvailableFoods(allFoods);

  const totals = ingredients.reduce((acc, ingredient) => {
    if (!ingredient) return acc;

    let foodDetails = null;

    // Determine ID and User Created status
    // Priority: direct object -> ID lookup
    if (ingredient.food) {
        foodDetails = ingredient.food;
    } else if (ingredient.user_created_food) {
        foodDetails = ingredient.user_created_food;
    } else {
        const foodId = ingredient.food_id ?? ingredient.user_created_food_id;
        const isUserCreated = !!(ingredient.user_created_food_id || ingredient.is_user_created);

        if (foodId) {
             if (foodsSource instanceof Map) {
                // Optimized Lookup
                const key = `${String(foodId)}|${isUserCreated ? 1 : 0}`;
                foodDetails = foodsSource.get(key);
            } else if (Array.isArray(foodsSource)) {
                // Array Lookup
                foodDetails = foodsSource.find(f => 
                    String(f.id) === String(foodId) && 
                    !!f.is_user_created === isUserCreated
                );
            }
        }
    }

    const normalizedFood = normalizeFoodData(foodDetails);
    
    if (!normalizedFood) {
        // Skip if food not found, don't break calculation
        return acc;
    }

    const quantity = parseFloat(ingredient.grams ?? ingredient.quantity) || 0;
    if (quantity <= 0) {
        return acc;
    }

    const ratio = normalizedFood.food_unit === 'unidades' ? quantity : quantity / 100;

    acc.proteins += (normalizedFood.proteins * ratio);
    acc.carbs += (normalizedFood.total_carbs * ratio);
    acc.fats += (normalizedFood.total_fats * ratio);
    // Recalculate calories from macros for consistency
    acc.calories += ((normalizedFood.proteins * ratio) * 4) + ((normalizedFood.total_carbs * ratio) * 4) + ((normalizedFood.total_fats * ratio) * 9);
    
    return acc;
  }, { calories: 0, proteins: 0, carbs: 0, fats: 0 });

  // 4. Update Cache
  if (macroCache.size > CACHE_LIMIT) {
      const firstKey = macroCache.keys().next().value;
      macroCache.delete(firstKey);
  }
  macroCache.set(cacheKey, totals);

  return {
    calories: Math.max(0, totals.calories),
    proteins: Math.max(0, totals.proteins),
    carbs: Math.max(0, totals.carbs),
    fats: Math.max(0, totals.fats),
  };
};

/**
 * Guarda o actualiza los macros de una receta
 * @param {number} recipeId - ID de la receta (para recetas base)
 * @param {number} dietPlanRecipeId - ID de la receta del plan de dieta (para recetas personalizadas)
 * @param {Object} macros - Objeto con calories, proteins, carbs, fats
 */
export const saveRecipeMacros = async (recipeId = null, dietPlanRecipeId = null, macros) => {
  try {
    const macroData = {
      recipe_id: recipeId,
      diet_plan_recipe_id: dietPlanRecipeId,
      calories: parseFloat(macros.calories) || 0,
      proteins: parseFloat(macros.proteins) || 0,
      carbs: parseFloat(macros.carbs) || 0,
      fats: parseFloat(macros.fats) || 0,
      updated_at: new Date().toISOString()
    };

    let existingQuery = supabase.from('recipe_macros').select('id');
    
    if (recipeId !== null) {
      existingQuery = existingQuery.eq('recipe_id', recipeId).is('diet_plan_recipe_id', null);
    } else if (dietPlanRecipeId !== null) {
      existingQuery = existingQuery.eq('diet_plan_recipe_id', dietPlanRecipeId);
    } else {
      return { success: false, error: 'Se necesita un recipeId o dietPlanRecipeId.' };
    }

    const { data: existing, error: selectError } = await existingQuery.maybeSingle();
    
    if (selectError) throw selectError;

    if (existing) {
      const { error: updateError } = await supabase
        .from('recipe_macros')
        .update(macroData)
        .eq('id', existing.id);
      
      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase
        .from('recipe_macros')
        .insert(macroData);
      
      if (insertError) throw insertError;
    }

    return { success: true };
  } catch (error) {
    console.error('Error saving recipe macros:', error);
    return { success: false, error: error.message };
  }
};


/**
 * Guarda los ingredientes personalizados de una receta en un plan de dieta
 * @param {number} dietPlanRecipeId - ID de la receta del plan de dieta
 * @param {Array} ingredients - Array de ingredientes con food_id y grams
 */
export const saveDietPlanRecipeIngredients = async (dietPlanRecipeId, ingredients) => {
  try {
    // Eliminar ingredientes existentes
    const { error: deleteError } = await supabase
      .from('diet_plan_recipe_ingredients')
      .delete()
      .eq('diet_plan_recipe_id', dietPlanRecipeId);
    
    if (deleteError) throw deleteError;

    // Insertar nuevos ingredientes si existen
    if (ingredients && ingredients.length > 0) {
      const ingredientData = ingredients
          .map(ing => {
            const foodId = ing.food_id || ing.food?.id;

            return {
              diet_plan_recipe_id: dietPlanRecipeId,
              food_id: foodId ? parseInt(foodId, 10) : undefined,
              grams: parseInt(ing.grams || ing.quantity, 10) || 0,
            };
        })
        .filter(ing => !isNaN(ing.food_id) && ing.food_id > 0);

      if (ingredientData.length > 0) {
        const { error: insertError } = await supabase
          .from('diet_plan_recipe_ingredients')
          .insert(ingredientData);
        
        if (insertError) throw insertError;
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Error saving diet plan recipe ingredients:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Obtiene los ingredientes personalizados de una receta en un plan de dieta
 * @param {number} dietPlanRecipeId - ID de la receta del plan de dieta
 * @returns {Array} - Array de ingredientes
 */
export const getDietPlanRecipeIngredients = async (dietPlanRecipeId) => {
  try {
    const { data, error } = await supabase
      .from('diet_plan_recipe_ingredients')
      .select('*, food(*, total_carbs, total_fats)')
      .eq('diet_plan_recipe_id', dietPlanRecipeId);
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error('Error getting diet plan recipe ingredients:', error);
    return [];
  }
};