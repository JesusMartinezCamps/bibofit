import { getConflictInfo } from '@/lib/restrictionChecker';

const toIdSet = (items = []) =>
  new Set(
    (Array.isArray(items) ? items : [])
      .map((item) => (item && typeof item === 'object' ? item.id : item))
      .filter((id) => id !== undefined && id !== null)
  );

const getRecipeIngredients = (recipe) => {
  if (!recipe) return [];

  if (recipe.is_private_recipe || recipe.is_private || recipe.type === 'private_recipe') {
    return recipe.recipe_ingredients || recipe.private_recipe_ingredients || [];
  }

  if (Array.isArray(recipe.custom_ingredients) && recipe.custom_ingredients.length > 0) {
    return recipe.custom_ingredients;
  }

  if (Array.isArray(recipe.recipe_ingredients) && recipe.recipe_ingredients.length > 0) {
    return recipe.recipe_ingredients;
  }

  return recipe.recipe?.recipe_ingredients || [];
};

const buildFoodMap = (foods = []) => {
  const map = new Map();
  (Array.isArray(foods) ? foods : []).forEach((food) => {
    if (food?.id !== undefined && food?.id !== null) {
      map.set(food.id, food);
    }
  });
  return map;
};

const pushUnique = (arr, item) => {
  if (!item?.id) return;
  if (!arr.find((existing) => existing.id === item.id)) arr.push(item);
};

export const analyzeRecipeConflicts = ({ recipe, allFoods = [], userRestrictions }) => {
  const conflicts = { sensitivities: [], conditions: [] };
  const recommendations = { conditions: [] };
  const unsafeFoodNames = new Set();
  const recommendedFoodNames = new Set();

  if (!recipe || !userRestrictions) {
    return { conflicts, recommendations, unsafeFoodNames, recommendedFoodNames };
  }

  const foodById = buildFoodMap(allFoods);
  const ingredients = getRecipeIngredients(recipe);

  ingredients.forEach((ing) => {
    const food = ing?.food || foodById.get(ing?.food_id);
    if (!food) return;

    const conflictInfo = getConflictInfo(food, userRestrictions);
    if (!conflictInfo) return;

    if (['condition_avoid', 'sensitivity', 'individual_restriction', 'non-preferred'].includes(conflictInfo.type)) {
      unsafeFoodNames.add(food.name);
    }

    if (['condition_recommend', 'preferred'].includes(conflictInfo.type)) {
      recommendedFoodNames.add(food.name);
    }

    if (conflictInfo.type === 'sensitivity') {
      const sensitivityId = conflictInfo.sensitivity_id;
      const sensitivity = (food.food_sensitivities || []).find((fs) => {
        const id = fs?.sensitivity?.id ?? fs?.sensitivities?.id ?? fs?.sensitivity_id;
        return id === sensitivityId;
      });

      pushUnique(conflicts.sensitivities, {
        id: sensitivityId,
        name:
          sensitivity?.sensitivity?.name ||
          sensitivity?.sensitivities?.name ||
          (conflictInfo.reason || '').replace('Sensibilidad: ', '') ||
          'Sensibilidad',
      });
      return;
    }

    if (conflictInfo.type === 'condition_avoid') {
      const conditionId = conflictInfo.condition_id;
      const condition = (food.food_medical_conditions || []).find((fmc) => {
        const id = fmc?.condition?.id ?? fmc?.medical_conditions?.id ?? fmc?.condition_id;
        return id === conditionId;
      });

      pushUnique(conflicts.conditions, {
        id: conditionId,
        name:
          condition?.condition?.name ||
          condition?.medical_conditions?.name ||
          (conflictInfo.reason || '').replace('Evitar por: ', '') ||
          'Condición',
      });
      return;
    }

    if (conflictInfo.type === 'condition_recommend') {
      const conditionId = conflictInfo.condition_id;
      const condition = (food.food_medical_conditions || []).find((fmc) => {
        const id = fmc?.condition?.id ?? fmc?.medical_conditions?.id ?? fmc?.condition_id;
        return id === conditionId;
      });

      pushUnique(recommendations.conditions, {
        id: conditionId,
        name:
          condition?.condition?.name ||
          condition?.medical_conditions?.name ||
          (conflictInfo.reason || '').replace('Recomendado por: ', '') ||
          'Condición',
      });
    }
  });

  // Recipe-level sensitivity tags still count as explicit sensitivity conflicts.
  const userSensitivityIds = toIdSet(userRestrictions?.sensitivities || []);
  (recipe.recipe_sensitivities || recipe.recipe?.recipe_sensitivities || []).forEach((rs) => {
    const sensitivityId = rs?.sensitivity_id ?? rs?.sensitivity?.id ?? rs?.sensitivities?.id;
    if (!sensitivityId || !userSensitivityIds.has(sensitivityId)) return;

    pushUnique(conflicts.sensitivities, {
      id: sensitivityId,
      name: rs?.sensitivity?.name || rs?.sensitivities?.name || 'Sensibilidad',
    });
  });

  return { conflicts, recommendations, unsafeFoodNames, recommendedFoodNames };
};

