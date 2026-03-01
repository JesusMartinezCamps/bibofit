export const normalizeText = (text) => {
  return text
    ? text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    : '';
};

const toTokens = (value) => {
  const normalized = normalizeText(value).trim();
  return normalized ? normalized.split(/\s+/).filter(Boolean) : [];
};

const countTokenMatches = (tokens, haystack) => {
  if (tokens.length === 0 || !haystack) return 0;
  return tokens.reduce((acc, token) => acc + (haystack.includes(token) ? 1 : 0), 0);
};

const getIngredientNames = (recipe) => {
  if (!recipe?.recipe_ingredients?.length) return [];
  return recipe.recipe_ingredients
    .map((ing) => ing?.food?.name || '')
    .filter(Boolean);
};

export const getRecipeSearchScore = (recipe, query) => {
  if (!recipe) return { matched: false, score: 0 };

  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return { matched: true, score: 0 };

  const tokens = toTokens(normalizedQuery);
  const name = normalizeText(recipe.name || '');
  const difficulty = normalizeText(recipe.difficulty || '');
  const ingredientNames = getIngredientNames(recipe);
  const normalizedIngredients = ingredientNames.map((nameValue) => normalizeText(nameValue));
  const ingredientBlob = normalizedIngredients.join(' ');

  let score = 0;
  let matched = false;

  if (name.includes(normalizedQuery)) {
    matched = true;
    score += 120;
    if (name.startsWith(normalizedQuery)) score += 20;
  }

  if (difficulty.includes(normalizedQuery)) {
    matched = true;
    score += 80;
    if (difficulty.startsWith(normalizedQuery)) score += 10;
  }

  const ingredientMatchCount = normalizedIngredients.reduce(
    (acc, ingredient) => acc + (ingredient.includes(normalizedQuery) ? 1 : 0),
    0
  );
  if (ingredientMatchCount > 0) {
    matched = true;
    score += Math.min(ingredientMatchCount, 4) * 35;
  }

  const nameTokenHits = countTokenMatches(tokens, name);
  const diffTokenHits = countTokenMatches(tokens, difficulty);
  const ingredientTokenHits = countTokenMatches(tokens, ingredientBlob);

  score += nameTokenHits * 15;
  score += diffTokenHits * 12;
  score += ingredientTokenHits * 8;

  if (tokens.length > 0 && (nameTokenHits + diffTokenHits + ingredientTokenHits) >= tokens.length) {
    matched = true;
    score += 20;
  }

  return { matched, score };
};
