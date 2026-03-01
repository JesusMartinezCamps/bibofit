import { calculateMacros } from '@/lib/macroCalculator';
import { getConflictInfo } from '@/lib/restrictionChecker.js';
import { findFoodByIdentity, inferIngredientUserCreated } from '@/lib/foodIdentity';

export const resolveRecipeImageUrl = (recipe) => {
  if (!recipe) return null;

  return (
    recipe.img_url ||
    recipe.image_url ||
    recipe.recipe?.img_url ||
    recipe.recipe?.image_url ||
    recipe.recipe?.recipe?.img_url ||
    recipe.recipe?.recipe?.image_url ||
    null
  );
};

export const calculateRecipeConflicts = ({
  recipe,
  allFoods,
  activeRestrictions,
}) => {
  if (!activeRestrictions || !recipe || !Array.isArray(recipe.ingredients)) {
    return { conflicts: [], recommendations: [] };
  }

  const conflicts = [];
  const recommendations = [];

  recipe.ingredients.forEach((ing) => {
    let food = ing.food;
    const isUserCreated = inferIngredientUserCreated(ing);

    if (!food && Array.isArray(allFoods)) {
      food = findFoodByIdentity(allFoods, { foodId: ing.food_id, isUserCreated });
    }

    if (food && Array.isArray(allFoods)) {
      const fullFood = findFoodByIdentity(allFoods, { foodId: food.id, isUserCreated });
      if (fullFood) food = fullFood;
    }

    if (!food) return;

    const info = getConflictInfo(food, activeRestrictions);
    if (!info) return;

    if (['condition_avoid', 'sensitivity', 'individual_restriction', 'non-preferred'].includes(info.type)) {
      conflicts.push({
        foodId: food.id,
        type: info.type === 'individual_restriction' ? 'condition_avoid' : info.type,
        restrictionName: info.reason,
      });
      return;
    }

    if (['condition_recommend', 'preferred'].includes(info.type)) {
      recommendations.push({
        foodId: food.id,
        restrictionName: info.reason,
      });
    }
  });

  return { conflicts, recommendations };
};

export const buildIngredientsWithDetails = ({
  recipe,
  allFoods,
  allVitamins,
  allMinerals,
  conflicts,
  recommendations,
}) => {
  if (!recipe || !Array.isArray(recipe.ingredients) || !Array.isArray(allFoods)) return [];

  return recipe.ingredients
    .map((ing, originalIndex) => {
      let food = ing.food;
      const isUserCreated = inferIngredientUserCreated(ing);

      if (!food) {
        food = findFoodByIdentity(allFoods, { foodId: ing.food_id, isUserCreated });
      }

      if (food) {
        const fullFood = findFoodByIdentity(allFoods, { foodId: food.id, isUserCreated });
        if (fullFood) food = fullFood;
      }

      if (!food) {
        // Keep ingredient visible even if food enrichment has not propagated yet.
        // This can happen right after inline creation (pending food).
        food = {
          id: ing.food_id,
          name: ing.food_name || `Alimento ${ing.food_id || ''}`.trim(),
          food_unit: ing.food_unit || 'gramos',
          is_user_created: !!isUserCreated,
          status: isUserCreated ? 'pending' : undefined,
          food_vitamins: [],
          food_minerals: [],
          food_to_food_groups: [],
        };
      }

      const qty = ing.grams !== undefined && ing.grams !== null && ing.grams !== '' ? Number(ing.grams) : 0;
      const ingredientWithFood = { ...ing, food, quantity: qty };
      const ingredientMacros = calculateMacros([ingredientWithFood], allFoods);

      const vitamins = (food.food_vitamins || [])
        .map((fv) => {
          const vitaminData = (allVitamins || []).find((v) => v.id === (fv.vitamin_id || fv.vitamin?.id));
          if (!vitaminData) return null;
          return {
            ...vitaminData,
            mg_per_100g: typeof fv.mg_per_100g === 'number' ? fv.mg_per_100g : null,
          };
        })
        .filter(Boolean);

      const minerals = (food.food_minerals || [])
        .map((fm) => {
          const mineralData = (allMinerals || []).find((m) => m.id === (fm.mineral_id || fm.mineral?.id));
          if (!mineralData) return null;
          return {
            ...mineralData,
            mg_per_100g: typeof fm.mg_per_100g === 'number' ? fm.mg_per_100g : null,
          };
        })
        .filter(Boolean);

      const foodConflicts = (conflicts || []).filter((c) => c.foodId === food.id);
      const foodRecommendations = (recommendations || []).filter((r) => r.foodId === food.id);

      let conflictType = null;
      const avoidConflict = foodConflicts.find((c) =>
        ['condition_avoid', 'sensitivity', 'non-preferred'].includes(c.type)
      );

      if (avoidConflict) {
        conflictType = avoidConflict.type;
      } else if (foodRecommendations.length > 0) {
        conflictType = 'condition_recommend';
      }

      return {
        ...ing,
        originalIndex,
        food,
        macros: ingredientMacros,
        vitamins,
        minerals,
        quantity: ing.grams !== undefined && ing.grams !== null ? ing.grams : ing.quantity,
        conflictType,
        conflictDetails: foodConflicts,
        recommendationDetails: foodRecommendations,
        is_user_created: isUserCreated,
        food_group_id: food.food_to_food_groups?.[0]?.food_group?.id || ing.food_group_id || null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const nameA = a.food?.name || '';
      const nameB = b.food?.name || '';
      return nameA.localeCompare(nameB, 'es', { sensitivity: 'base' });
    });
};
