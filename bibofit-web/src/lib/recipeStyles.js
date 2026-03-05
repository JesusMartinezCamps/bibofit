export const parseRecipeStyleId = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const resolveRecipeStyleId = (recipe) => {
  if (!recipe || typeof recipe !== 'object') return null;

  return parseRecipeStyleId(
    recipe.custom_recipe_style_id ??
      recipe.recipe_style_id ??
      recipe.recipe_style?.id ??
      recipe.recipe?.recipe_style_id ??
      recipe.recipe?.recipe_style?.id ??
      null
  );
};

export const resolveRecipeStyleName = (recipe, recipeStyles = []) => {
  if (!recipe || typeof recipe !== 'object') return null;

  const explicitName =
    recipe.recipe_style?.name ||
    recipe.recipe?.recipe_style?.name ||
    null;

  if (explicitName) return explicitName;

  const styleId = resolveRecipeStyleId(recipe);
  if (!styleId || !Array.isArray(recipeStyles)) return null;

  const match = recipeStyles.find((style) => Number(style.id) === Number(styleId));
  return match?.name || null;
};
