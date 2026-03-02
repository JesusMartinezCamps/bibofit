export const FOOD_CARD_SELECT = `
  id,
  name,
  proteins,
  total_carbs,
  total_fats,
  food_unit,
  status,
  moderation_status,
  visibility,
  user_id,
  created_at,
  food_to_seasons(season_id, season(name)),
  food_to_food_groups(food_group_id, food_groups(id, name)),
  food_to_stores(store_id),
  food_vitamins(vitamin_id, mg_per_100g, vitamins(id, name)),
  food_minerals(mineral_id, mg_per_100g, minerals(id, name)),
  food_sensitivities(sensitivity_id, sensitivities(id, name))
`;

const toArray = (value) => (Array.isArray(value) ? value : []);

export const normalizeFoodRecord = (food = {}) => {
  const relationGroups = toArray(food.food_to_food_groups)
    .map((entry) => entry?.food_groups)
    .filter(Boolean);
  const directGroups = toArray(food.food_groups).filter(Boolean);

  const relationSeasons = toArray(food.food_to_seasons)
    .map((entry) => entry?.season)
    .filter(Boolean);
  const directSeasons = toArray(food.seasons).filter(Boolean);

  const relationSensitivities = toArray(food.food_sensitivities).map((entry) => ({
    ...entry,
    sensitivity_id: entry?.sensitivity_id ?? entry?.sensitivities?.id,
    sensitivities: entry?.sensitivities || null,
  }));

  const isUserCreated = Boolean(food.is_user_created || food.isUserCreated || food.user_id);

  return {
    ...food,
    carbs: food.carbs ?? food.total_carbs,
    fats: food.fats ?? food.total_fats,
    food_groups: relationGroups.length > 0 ? relationGroups : directGroups,
    seasons: relationSeasons.length > 0 ? relationSeasons : directSeasons,
    food_sensitivities: relationSensitivities,
    is_user_created: isUserCreated,
    isUserCreated: isUserCreated,
  };
};

export const mergeFoodsById = (foods = []) => {
  const merged = new Map();

  foods.forEach((food) => {
    if (!food?.id) return;
    const normalized = normalizeFoodRecord(food);
    const key = String(normalized.id);
    const current = merged.get(key);

    if (!current || (normalized.isUserCreated && !current.isUserCreated)) {
      merged.set(key, normalized);
    }
  });

  return Array.from(merged.values());
};

export const getFoodGroupText = (food) => {
  const groups = toArray(food?.food_groups)
    .map((group) => group?.name)
    .filter(Boolean);

  if (groups.length === 0) return 'Sin grupo';
  return groups.join(', ');
};

export const getFoodSensitivityText = (food, allSensitivities = []) => {
  const relationNames = toArray(food?.food_sensitivities)
    .map((entry) => entry?.sensitivities?.name)
    .filter(Boolean);

  if (relationNames.length > 0) {
    return relationNames.join(', ');
  }

  const selectedAllergies = toArray(food?.selected_allergies);
  if (selectedAllergies.length === 0) return null;

  const fallbackNames = selectedAllergies
    .map((id) => allSensitivities.find((sensitivity) => sensitivity.id === id)?.name)
    .filter(Boolean);

  return fallbackNames.length > 0 ? fallbackNames.join(', ') : null;
};
