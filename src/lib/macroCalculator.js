import { supabase } from '@/lib/supabaseClient';

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
 * @param {Array} [allFoods=[]] - Array opcional de todos los alimentos disponibles (si no se han pre-cargado en `ingredients`).
 * @returns {Object} - Objeto con calories, proteins, carbs, fats.
 */
export const calculateMacros = (ingredients, allFoods = []) => {
  if (!ingredients || !Array.isArray(ingredients)) {
    return { calories: 0, proteins: 0, carbs: 0, fats: 0 };
  }
  
  const totals = ingredients.reduce((totals, ingredient) => {
    if (!ingredient) return totals;

    let foodDetails = null;
    const foodId = ingredient.food_id ?? ingredient.user_created_food_id;

    if (ingredient.food) { 
        foodDetails = ingredient.food;
    } else if (ingredient.user_created_food) {
        foodDetails = ingredient.user_created_food;
    } else if (foodId && allFoods.length > 0) {
        foodDetails = allFoods.find(f => 
            String(f.id) === String(foodId) && 
            !!f.is_user_created === !!(ingredient.user_created_food_id || ingredient.is_user_created)
        );
    }
    
    const normalizedFood = normalizeFoodData(foodDetails);
    
    if (!normalizedFood) {
        console.warn(`No se encontraron detalles para el ingrediente con ID: ${foodId} (is_user_created: ${!!(ingredient.user_created_food_id || ingredient.is_user_created)})`, ingredient);
        return totals;
    }

    const quantity = parseFloat(ingredient.grams ?? ingredient.quantity) || 0;
    if (quantity <= 0) {
        return totals;
    }

    const ratio = normalizedFood.food_unit === 'unidades' ? quantity : quantity / 100;

    const proteins = normalizedFood.proteins * ratio;
    const carbs = normalizedFood.total_carbs * ratio;
    const fats = normalizedFood.total_fats * ratio;
    const calories = proteins * 4 + carbs * 4 + fats * 9;

    totals.calories += calories;
    totals.proteins += proteins;
    totals.carbs += carbs;
    totals.fats += fats;
    return totals;
  }, { calories: 0, proteins: 0, carbs: 0, fats: 0 });

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
        .filter(ing => ing.food_id)
        .map(ing => ({
            diet_plan_recipe_id: dietPlanRecipeId,
            food_id: parseInt(ing.food_id, 10),
            grams: parseInt(ing.grams || ing.quantity, 10) || 0,
        }))
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