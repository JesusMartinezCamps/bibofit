import { getRecipeIngredients } from '@/lib/recipeEntity';
import { resolveRecipeStyleName } from '@/lib/recipeStyles';
import { normalizeText } from '@/lib/textSearch';

export const RECIPE_SEARCH_MATCH_TYPE_ORDER = ['name', 'difficulty', 'style', 'ingredient', 'group'];

export const RECIPE_SEARCH_MATCH_TYPE_LABELS = {
  name: 'nombre',
  difficulty: 'dificultad',
  style: 'estilo',
  ingredient: 'ingrediente',
  group: 'grupo',
};

const tokenizeNormalizedText = (value = '') => {
  const normalized = normalizeText(value).trim();
  return normalized ? normalized.split(/\s+/).filter(Boolean) : [];
};

const getLevenshteinDistance = (a = '', b = '') => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const rows = b.length + 1;
  const cols = a.length + 1;
  const matrix = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 0; i < rows; i += 1) matrix[i][0] = i;
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const substitutionCost = b[i - 1] === a[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + substitutionCost
      );
    }
  }

  return matrix[b.length][a.length];
};

const isFuzzyTokenMatch = (queryToken = '', targetToken = '') => {
  if (!queryToken || !targetToken) return false;
  if (targetToken.includes(queryToken) || queryToken.includes(targetToken)) return true;
  if (queryToken.length < 4 || targetToken.length < 4) return false;

  const maxLen = Math.max(queryToken.length, targetToken.length);
  const maxDistance = maxLen >= 8 ? 2 : 1;
  return getLevenshteinDistance(queryToken, targetToken) <= maxDistance;
};

const getSearchMatchMeta = (value = '', normalizedQuery = '', queryTokens = [], allowFuzzy = true) => {
  const normalizedValue = normalizeText(value);
  if (!normalizedValue) return { matched: false, fuzzy: false };
  if (normalizedValue.includes(normalizedQuery)) return { matched: true, fuzzy: false };
  if (!queryTokens.length) return { matched: false, fuzzy: false };

  const valueTokens = tokenizeNormalizedText(normalizedValue);
  if (!valueTokens.length) return { matched: false, fuzzy: false };

  let hasFuzzy = false;
  const allTokensMatch = queryTokens.every((queryToken) => {
    let tokenMatched = false;
    for (const targetToken of valueTokens) {
      if (targetToken.includes(queryToken) || queryToken.includes(targetToken)) {
        tokenMatched = true;
        break;
      }
      if (allowFuzzy && isFuzzyTokenMatch(queryToken, targetToken)) {
        tokenMatched = true;
        hasFuzzy = true;
        break;
      }
    }
    return tokenMatched;
  });

  return { matched: allTokensMatch, fuzzy: allTokensMatch && hasFuzzy };
};

const getFoodById = (foodById, foodId) => {
  if (!foodById || foodId == null) return null;
  return foodById.get(foodId) || foodById.get(String(foodId)) || foodById.get(Number(foodId)) || null;
};

const getFoodGroupNames = (food) => {
  if (!food) return [];

  const fromRelations = (food.food_to_food_groups || [])
    .map((entry) => entry?.food_group?.name || entry?.food_groups?.name || entry?.food_group_name)
    .filter(Boolean);

  const fromDirectGroups = (food.food_groups || [])
    .map((group) => group?.name || group)
    .filter(Boolean);

  return [...new Set([...fromRelations, ...fromDirectGroups])];
};

export const buildFoodIdIndex = (foods = []) => {
  const map = new Map();
  (foods || []).forEach((food) => {
    if (!food?.id && food?.id !== 0) return;
    map.set(food.id, food);
    map.set(String(food.id), food);
  });
  return map;
};

export const getRecipeSearchMatchInfo = ({
  item,
  normalizedQuery,
  queryTokens,
  recipeStyles = [],
  foodById = null,
  allowFuzzy = true,
}) => {
  const itemMatchTypes = new Set();
  let hasFuzzyMatch = false;

  const registerMatch = (matchType, matchMeta) => {
    if (!matchMeta.matched) return;
    itemMatchTypes.add(matchType);
    if (matchMeta.fuzzy) hasFuzzyMatch = true;
  };

  const name = item?.name || item?.custom_name || item?.recipe?.name || '';
  registerMatch('name', getSearchMatchMeta(name, normalizedQuery, queryTokens, allowFuzzy));

  const difficulty =
    item?.custom_difficulty || item?.difficulty || item?.recipe?.difficulty || '';
  registerMatch('difficulty', getSearchMatchMeta(difficulty, normalizedQuery, queryTokens, allowFuzzy));

  const styleName = resolveRecipeStyleName(item, recipeStyles) || '';
  registerMatch('style', getSearchMatchMeta(styleName, normalizedQuery, queryTokens, allowFuzzy));

  const ingredients = getRecipeIngredients(item);
  if (ingredients && ingredients.length > 0) {
    ingredients.forEach((ing) => {
      const indexedFood = getFoodById(foodById, ing.food_id);
      const ingredientFood = indexedFood || ing.food || ing.user_created_food || null;

      registerMatch(
        'ingredient',
        getSearchMatchMeta(ingredientFood?.name || '', normalizedQuery, queryTokens, allowFuzzy)
      );

      const foodGroupNames = getFoodGroupNames(ingredientFood);
      foodGroupNames.forEach((groupName) => {
        registerMatch('group', getSearchMatchMeta(groupName, normalizedQuery, queryTokens, allowFuzzy));
      });
    });
  }

  return {
    matched: itemMatchTypes.size > 0,
    matchTypes: itemMatchTypes,
    hasFuzzyMatch,
  };
};

export const getIngredientHighlightForQuery = ({
  food,
  query = '',
  allowFuzzy = true,
}) => {
  if (!food) return query;

  const normalizedQuery = normalizeText(query || '').trim();
  if (!normalizedQuery) return query;
  const queryTokens = tokenizeNormalizedText(normalizedQuery);

  const ingredientName = food?.name || '';
  const ingredientMeta = getSearchMatchMeta(ingredientName, normalizedQuery, queryTokens, allowFuzzy);
  if (ingredientMeta.matched) {
    // For typos/fuzzy match, highlight the ingredient label itself.
    return ingredientMeta.fuzzy ? ingredientName : query;
  }

  const groupNames = getFoodGroupNames(food);
  const groupMatch = groupNames.some((groupName) =>
    getSearchMatchMeta(groupName, normalizedQuery, queryTokens, allowFuzzy).matched
  );

  // If query matched by food group, highlight the ingredient name that caused the match.
  if (groupMatch) return ingredientName || query;

  return query;
};

export const filterRecipesByQuery = ({
  items = [],
  query = '',
  recipeStyles = [],
  allFoods = [],
  foodById = null,
  allowFuzzy = true,
}) => {
  const normalizedQuery = normalizeText(query || '').trim();
  if (!normalizedQuery) {
    return {
      items,
      matchTypes: [],
      hasFuzzyMatch: false,
    };
  }

  const queryTokens = tokenizeNormalizedText(normalizedQuery);
  const resolvedFoodById = foodById || buildFoodIdIndex(allFoods);

  const matchedTypes = new Set();
  let hasFuzzyMatch = false;

  const filteredItems = items.filter((item) => {
    const matchInfo = getRecipeSearchMatchInfo({
      item,
      normalizedQuery,
      queryTokens,
      recipeStyles,
      foodById: resolvedFoodById,
      allowFuzzy,
    });

    if (!matchInfo.matched) return false;

    matchInfo.matchTypes.forEach((type) => matchedTypes.add(type));
    if (matchInfo.hasFuzzyMatch) hasFuzzyMatch = true;
    return true;
  });

  return {
    items: filteredItems,
    matchTypes: RECIPE_SEARCH_MATCH_TYPE_ORDER.filter((type) => matchedTypes.has(type)),
    hasFuzzyMatch,
  };
};
