import { useMemo } from 'react';
import { calculateMacros } from '@/lib/macroCalculator';
import { INGREDIENT_LAYOUTS } from './layoutTypes';

const HEALTH_GROUP_KEYWORDS = [
  'fruta',
  'verdura',
  'hortaliza',
  'semilla',
  'fruto seco',
  'legumbre',
  'cereal',
  'integral',
  'procesado sano',
];

const MACRO_GROUP_HINTS = {
  protein: ['carne', 'pescado', 'huevo', 'lacteo', 'proteina', 'legumbre'],
  carbs: ['cereal', 'tuberculo', 'fruta', 'arroz', 'pasta', 'pan', 'legumbre'],
  fats: ['aceite', 'fruto seco', 'semilla', 'aguacate', 'grasa'],
};

const safeArray = (value) => (Array.isArray(value) ? value : []);

const mapToIdSet = (values) => {
  return new Set(
    safeArray(values)
      .map((item) => {
        if (item === null || item === undefined) return null;
        if (typeof item === 'number' || typeof item === 'string') return String(item);
        return String(item.id || item.food_id || item.condition_id || item.sensitivity_id || '');
      })
      .filter(Boolean)
  );
};

const normalizeRestrictions = (planRestrictions = {}) => {
  const preferredFoods = mapToIdSet([
    ...safeArray(planRestrictions.preferredFoods),
    ...safeArray(planRestrictions.preferred_foods).map((item) => item?.food || item),
  ]);

  const nonPreferredFoods = mapToIdSet([
    ...safeArray(planRestrictions.nonPreferredFoods),
    ...safeArray(planRestrictions.non_preferred_foods).map((item) => item?.food || item),
  ]);

  const blockedFoods = mapToIdSet([
    ...safeArray(planRestrictions.individualFoodRestrictions),
    ...safeArray(planRestrictions.individual_food_restrictions).map((item) => item?.food || item),
  ]);

  const sensitivities = mapToIdSet([
    ...safeArray(planRestrictions.sensitivities),
    ...safeArray(planRestrictions.userSensitivities),
  ]);

  const conditions = mapToIdSet([
    ...safeArray(planRestrictions.conditions),
    ...safeArray(planRestrictions.medical_conditions).map((item) => item?.condition || item),
  ]);

  return {
    preferredFoods,
    nonPreferredFoods,
    blockedFoods,
    sensitivities,
    conditions,
  };
};

const getFoodGroups = (food) => {
  return safeArray(food?.food_to_food_groups)
    .map((entry) => entry?.food_group?.name || entry?.food_groups?.name || '')
    .filter(Boolean);
};

const getFoodConflictLevel = (food, restrictions) => {
  const foodId = String(food?.id || '');
  if (!foodId) return { blocked: false, reason: '' };
  if (restrictions.blockedFoods.has(foodId)) return { blocked: true, reason: 'Bloqueado por restricción individual' };
  if (restrictions.nonPreferredFoods.has(foodId)) return { blocked: true, reason: 'No preferido' };

  const hasSensitivity = safeArray(food?.food_sensitivities).some((entry) =>
    restrictions.sensitivities.has(String(entry?.sensitivity_id || entry?.sensitivity?.id || entry?.sensitivities?.id || ''))
  );
  if (hasSensitivity) return { blocked: true, reason: 'Sensibilidad detectada' };

  const contraindicated = safeArray(food?.food_medical_conditions).some((entry) => {
    const conditionId = String(entry?.condition_id || entry?.condition?.id || '');
    const relation = (entry?.relation_type || '').toLowerCase();
    return restrictions.conditions.has(conditionId) && relation === 'contraindicated';
  });
  if (contraindicated) return { blocked: true, reason: 'Contraindicado por patología' };

  return { blocked: false, reason: '' };
};

const buildGroupCoverage = (ingredients = []) => {
  const groups = new Set();
  ingredients.forEach((ing) => {
    getFoodGroups(ing.food).forEach((groupName) => groups.add(groupName.toLowerCase()));
  });
  return groups;
};

const hasGroupKeyword = (food, keywords) => {
  const groupNames = getFoodGroups(food).map((name) => name.toLowerCase());
  return groupNames.some((groupName) => keywords.some((keyword) => groupName.includes(keyword)));
};

const getMicronutrientCount = (food) => {
  const vitaminCount = safeArray(food?.food_vitamins).length;
  const mineralCount = safeArray(food?.food_minerals).length;
  return vitaminCount + mineralCount;
};

const getMacroDensity = (food, type) => {
  const proteins = Number(food?.proteins || 0);
  const carbs = Number(food?.total_carbs || food?.carbs || 0);
  const fats = Number(food?.total_fats || food?.fats || 0);

  if (type === 'protein') return proteins - (carbs * 0.25 + fats * 0.4);
  if (type === 'carbs') return carbs - (fats * 0.25);
  return fats - (carbs * 0.15);
};

const getMacroImbalance = (ingredients, allFoods, targets) => {
  if (!targets) return { proteinGap: 0, carbsGap: 0, fatsGap: 0 };
  const totals = calculateMacros(ingredients, allFoods);
  return {
    proteinGap: Math.max(0, Number(targets.target_proteins || 0) - Number(totals.proteins || 0)),
    carbsGap: Math.max(0, Number(targets.target_carbs || 0) - Number(totals.carbs || 0)),
    fatsGap: Math.max(0, Number(targets.target_fats || 0) - Number(totals.fats || 0)),
  };
};

const buildFoodScore = ({ food, layout, restrictions, groupCoverage, macroNeeds }) => {
  const conflict = getFoodConflictLevel(food, restrictions);
  if (conflict.blocked) return { total: -1000, reason: conflict.reason };

  const preferredBoost = restrictions.preferredFoods.has(String(food.id)) ? 18 : 0;
  const micronutrientScore = getMicronutrientCount(food) * 3;
  const healthGroupBoost = hasGroupKeyword(food, HEALTH_GROUP_KEYWORDS) ? 12 : 0;

  const groupNoveltyBoost = getFoodGroups(food).some((groupName) => !groupCoverage.has(groupName.toLowerCase())) ? 8 : 0;

  const proteinDensity = getMacroDensity(food, 'protein');
  const carbsDensity = getMacroDensity(food, 'carbs');
  const fatsDensity = getMacroDensity(food, 'fats');

  const proteinNeedBoost = macroNeeds.proteinGap > 0 ? Math.max(0, proteinDensity) * 0.9 : 0;
  const carbsNeedBoost = macroNeeds.carbsGap > 0 ? Math.max(0, carbsDensity) * 0.7 : 0;
  const fatsNeedBoost = macroNeeds.fatsGap > 0 ? Math.max(0, fatsDensity) * 0.7 : 0;

  if (layout === INGREDIENT_LAYOUTS.HEALTH) {
    return {
      total: preferredBoost + micronutrientScore + healthGroupBoost + groupNoveltyBoost + proteinNeedBoost * 0.2,
      reason: 'Mayor densidad de micronutrientes y mejor diversidad de grupos.',
    };
  }

  if (layout === INGREDIENT_LAYOUTS.MACROS) {
    return {
      total: preferredBoost + proteinNeedBoost + carbsNeedBoost + fatsNeedBoost + micronutrientScore * 0.5,
      reason: 'Mejor ajuste de macros con fuente alimentaria más limpia.',
    };
  }

  return {
    total: preferredBoost + micronutrientScore,
    reason: 'Buena relación entre preferencia y perfil nutricional.',
  };
};

export const useIngredientAssistant = ({
  layout,
  ingredients,
  allFoods,
  mealTargetMacros,
  planRestrictions,
}) => {
  return useMemo(() => {
    const restrictions = normalizeRestrictions(planRestrictions);
    const groupCoverage = buildGroupCoverage(ingredients);
    const macroNeeds = getMacroImbalance(ingredients, allFoods, mealTargetMacros);

    const suggestions = safeArray(allFoods)
      .map((food) => {
        const score = buildFoodScore({
          food,
          layout,
          restrictions,
          groupCoverage,
          macroNeeds,
        });
        return {
          food,
          score: score.total,
          reason: score.reason,
          conflict: getFoodConflictLevel(food, restrictions),
        };
      })
      .filter((item) => !item.conflict.blocked)
      .sort((a, b) => b.score - a.score);

    const topSuggestions = suggestions.slice(0, 8);

    const macroLanes = {
      protein: suggestions
        .filter((item) => hasGroupKeyword(item.food, MACRO_GROUP_HINTS.protein) || getMacroDensity(item.food, 'protein') > 5)
        .slice(0, 4),
      carbs: suggestions
        .filter((item) => hasGroupKeyword(item.food, MACRO_GROUP_HINTS.carbs) || getMacroDensity(item.food, 'carbs') > 7)
        .slice(0, 4),
      fats: suggestions
        .filter((item) => hasGroupKeyword(item.food, MACRO_GROUP_HINTS.fats) || getMacroDensity(item.food, 'fats') > 4)
        .slice(0, 4),
    };

    const healthCoverage = {
      coveredGroups: Array.from(groupCoverage),
      micronutrientIngredientCount: ingredients.filter((ing) => getMicronutrientCount(ing.food) > 0).length,
    };

    return {
      topSuggestions,
      macroLanes,
      healthCoverage,
      macroNeeds,
    };
  }, [layout, ingredients, allFoods, mealTargetMacros, planRestrictions]);
};
