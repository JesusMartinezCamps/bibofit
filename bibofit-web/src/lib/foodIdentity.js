export const isUserCreatedFood = (food) => {
  if (!food) return false;
  return !!food.is_user_created || !!food.user_id;
};

export const inferIngredientUserCreated = (ingredient) => {
  if (!ingredient) return null;
  if (ingredient.is_user_created !== undefined && ingredient.is_user_created !== null) {
    return !!ingredient.is_user_created;
  }
  if (ingredient.food) return isUserCreatedFood(ingredient.food);
  return null;
};

export const findFoodByIdentity = (foods, { foodId, isUserCreated = null } = {}) => {
  if (!Array.isArray(foods) || foodId === undefined || foodId === null) return null;

  const sameId = foods.filter((food) => String(food.id) === String(foodId));
  if (sameId.length === 0) return null;

  if (isUserCreated === null) return sameId[0];

  return sameId.find((food) => isUserCreatedFood(food) === !!isUserCreated) || sameId[0];
};
