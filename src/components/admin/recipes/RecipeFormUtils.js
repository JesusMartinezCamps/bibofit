import { supabase } from '@/lib/supabaseClient';

export const fetchRecipeData = async (toast) => {
  try {
    const [
        { data: foods, error: foodsError },
        { data: vitamins, error: vitaminsError },
        { data: minerals, error: mineralsError },
        { data: sensitivitiesData, error: sensitivitiesError },
        { data: foodVitamins, error: foodVitaminsError },
        { data: foodMinerals, error: foodMineralsError },
        { data: foodSensitivities, error: foodSensitivitiesError }
    ] = await Promise.all([
        supabase.from('food').select('*'),
        supabase.from('vitamins').select('id, name'),
        supabase.from('minerals').select('id, name'),
        supabase.from('sensitivities').select('id, name'),
        supabase.from('food_vitamins').select('food_id, vitamin_id'),
        supabase.from('food_minerals').select('food_id, mineral_id'),
        supabase.from('food_sensitivities').select('food_id, sensitivity_id')
    ]);

    if (foodsError || vitaminsError || mineralsError || sensitivitiesError || foodVitaminsError || foodMineralsError || foodSensitivitiesError) {
        throw new Error('Error al cargar datos para el editor');
    }
    
    const vitaminMap = new Map(vitamins.map(v => [v.id, v.name]));
    const mineralMap = new Map(minerals.map(m => [m.id, m.name]));
    const sensitivityMap = new Map(sensitivitiesData.map(a => [a.id, a.name]));
    
    const enrichedFoods = foods.map(food => {
        const vits = foodVitamins.filter(fv => fv.food_id === food.id).map(fv => ({ id: fv.vitamin_id, name: vitaminMap.get(fv.vitamin_id) })).filter(v => v.name);
        const mins = foodMinerals.filter(fm => fm.food_id === food.id).map(fm => ({ id: fm.mineral_id, name: mineralMap.get(fm.mineral_id) })).filter(m => m.name);
        const foodSens = foodSensitivities.filter(fa => fa.food_id === food.id).map(fa => ({ id: fa.sensitivity_id, name: sensitivityMap.get(fa.sensitivity_id) })).filter(a => a.name);
        return { ...food, vitamins: vits, minerals: mins, sensitivities: foodSens };
    });

    return {
      allFoods: enrichedFoods.sort((a, b) => a.name.localeCompare(b.name)),
      allVitamins: vitamins.sort((a,b) => a.name.localeCompare(b.name)),
      allMinerals: minerals.sort((a,b) => a.name.localeCompare(b.name)),
      allSensitivities: sensitivitiesData.sort((a,b) => a.name.localeCompare(b.name))
    };
  } catch (error) {
    toast({ title: "Error de datos", description: error.message, variant: "destructive" });
    throw error;
  }
};

export const calculateMacros = (ingredient, allFoods) => {
  const foodDetails = allFoods.find(f => f.id === parseInt(ingredient.food_id));
  if (!foodDetails || ingredient.quantity === null || ingredient.quantity === '') return { p: 0, c: 0, f: 0, k: 0 };
  
  const quantity = parseFloat(ingredient.quantity) || 0;
  const p = foodDetails.proteins_total || 0;
  const c = foodDetails.carbs_total || 0;
  const f = foodDetails.fats_total || 0;
  
  let calculatedP, calculatedC, calculatedF;
  
  if (foodDetails.food_unit === 'gramos') {
    calculatedP = (p / 100) * quantity;
    calculatedC = (c / 100) * quantity;
    calculatedF = (f / 100) * quantity;
  } else {
    calculatedP = p * quantity;
    calculatedC = c * quantity;
    calculatedF = f * quantity;
  }
  const calculatedK = (calculatedP * 4) + (calculatedC * 4) + (calculatedF * 9);
  
  return { p: calculatedP, c: calculatedC, f: calculatedF, k: calculatedK };
};

export const getRecipeNutrients = (ingredients, allFoods) => {
  const vitaminIds = new Set();
  const mineralIds = new Set();
  ingredients.forEach(ing => {
    const foodDetails = allFoods.find(f => f.id === parseInt(ing.food_id));
    if (foodDetails) {
      foodDetails.vitamins.forEach(v => vitaminIds.add(v.id));
      foodDetails.minerals.forEach(m => mineralIds.add(m.id));
    }
  });
  return { vitaminIds: Array.from(vitaminIds), mineralIds: Array.from(mineralIds) };
};

export const getAvailableFoods = (allFoods, selectedSensitivities) => {
  if (selectedSensitivities.length === 0) {
      return allFoods;
  }
  return allFoods.filter(food => {
      const foodSensitivityIds = food.sensitivities?.map(a => a.id) || [];
      return !selectedSensitivities.some(sensitivityId => foodSensitivityIds.includes(sensitivityId));
  });
};