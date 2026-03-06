export const RECIPE_ENTITY_TYPES = Object.freeze({
  PLAN: 'recipe',
  PRIVATE: 'private_recipe',
  FREE: 'free_recipe',
  SNACK: 'snack',
});

export const FREE_RECIPE_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED_PRIVATE: 'approved_private',
  APPROVED_GENERAL: 'approved_general',
  KEPT_AS_FREE_RECIPE: 'kept_as_free_recipe',
  REJECTED: 'rejected',
});

const APPROVED_FREE_RECIPE_STATUSES = new Set([
  FREE_RECIPE_STATUS.APPROVED_PRIVATE,
  FREE_RECIPE_STATUS.APPROVED_GENERAL,
]);

const FREE_RECIPE_CANONICAL_STATUSES = new Set(Object.values(FREE_RECIPE_STATUS));

const RECIPE_TYPE_ALIASES = Object.freeze({
  diet_plan_recipe: RECIPE_ENTITY_TYPES.PLAN,
});

const isNonEmptyArray = (value) => Array.isArray(value) && value.length > 0;

export const normalizeFreeRecipeStatus = (status) => {
  if (!status) return FREE_RECIPE_STATUS.PENDING;
  const normalized = String(status).trim().toLowerCase();
  return FREE_RECIPE_CANONICAL_STATUSES.has(normalized)
    ? normalized
    : FREE_RECIPE_STATUS.PENDING;
};

export const isFreeRecipeApproved = (status) => {
  return APPROVED_FREE_RECIPE_STATUSES.has(normalizeFreeRecipeStatus(status));
};

export const inferRecipeEntityType = (item) => {
  if (!item) return RECIPE_ENTITY_TYPES.PLAN;

  const explicit = RECIPE_TYPE_ALIASES[item.type] || item.type;
  if (explicit && Object.values(RECIPE_ENTITY_TYPES).includes(explicit)) {
    return explicit;
  }

  if (item.snack_ingredients || item.snack_id) return RECIPE_ENTITY_TYPES.SNACK;
  if (item.occurrence_id || item.type === 'free') return RECIPE_ENTITY_TYPES.FREE;
  if (item.type === 'private' || item.type === 'variant' || item.is_private || item.is_private_recipe) return RECIPE_ENTITY_TYPES.PRIVATE;

  return RECIPE_ENTITY_TYPES.PLAN;
};

export const getRecipeParentId = (item) => {
  if (!item) return null;
  return item.parent_user_recipe_id || item.parent_recipe_id || null;
};

export const getRecipeDisplayName = (item) => {
  if (!item) return '';
  return item.custom_name || item.name || item.recipe?.name || '';
};

export const getRecipeDifficulty = (item) => {
  if (!item) return 'Fácil';
  const type = inferRecipeEntityType(item);
  if (type === RECIPE_ENTITY_TYPES.PRIVATE || type === RECIPE_ENTITY_TYPES.FREE || type === RECIPE_ENTITY_TYPES.SNACK) {
    return item.difficulty || item.recipe?.difficulty || 'Fácil';
  }
  return item.custom_difficulty || item.difficulty || item.recipe?.difficulty || 'Fácil';
};

export const getRecipePrepTime = (item) => {
  if (!item) return 0;
  const type = inferRecipeEntityType(item);
  if (type === RECIPE_ENTITY_TYPES.PRIVATE || type === RECIPE_ENTITY_TYPES.FREE || type === RECIPE_ENTITY_TYPES.SNACK) {
    return item.prep_time_min ?? item.recipe?.prep_time_min ?? 0;
  }
  return item.custom_prep_time_min ?? item.prep_time_min ?? item.recipe?.prep_time_min ?? 0;
};

export const getRecipeIngredients = (item) => {
  if (!item) return [];

  if (isNonEmptyArray(item.custom_ingredients)) return item.custom_ingredients;
  if (isNonEmptyArray(item.recipe?.recipe_ingredients)) return item.recipe.recipe_ingredients;
  if (isNonEmptyArray(item.recipe_ingredients)) return item.recipe_ingredients;
  if (isNonEmptyArray(item.snack_ingredients)) return item.snack_ingredients;
  if (isNonEmptyArray(item.ingredients)) return item.ingredients;

  return [];
};

export const getMealLogDndId = (log) => {
  if (!log) return null;
  if (log.user_recipe_id != null) return `private-${log.user_recipe_id}`;
  if (log.diet_plan_recipe_id != null) return `recipe-${log.diet_plan_recipe_id}`;
  if (log.free_recipe_occurrence_id != null) return `free-${log.free_recipe_occurrence_id}`;
  return null;
};

export const buildMealLogPayload = ({ userId, logDate, userDayMealId, entity }) => {
  const basePayload = {
    user_id: userId,
    log_date: logDate,
    user_day_meal_id: userDayMealId,
    diet_plan_recipe_id: null,
    user_recipe_id: null,
    free_recipe_occurrence_id: null,
  };

  const type = inferRecipeEntityType(entity);
  if (type === RECIPE_ENTITY_TYPES.PRIVATE) {
    return { ...basePayload, user_recipe_id: entity.id };
  }
  if (type === RECIPE_ENTITY_TYPES.FREE) {
    return { ...basePayload, free_recipe_occurrence_id: entity.occurrence_id || entity.id };
  }
  if (type === RECIPE_ENTITY_TYPES.PLAN) {
    return { ...basePayload, diet_plan_recipe_id: entity.id };
  }

  return basePayload;
};
