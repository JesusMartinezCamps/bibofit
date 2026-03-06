/**
 * Utilidades para calcular diffs entre versiones de recetas.
 * Usado por useRecipeEditor (para el nombre automático) y recipeService (para persistir diff_summary).
 */

const TITLE_STOPWORDS = new Set([
  'de', 'del', 'la', 'las', 'el', 'los', 'con', 'sin', 'y', 'e', 'o', 'u', 'a', 'al', 'en', 'por', 'para'
]);

const escapeRegExp = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const extractTerms = (value = '') =>
  (value.match(/[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ]+/g) || []).filter((word) => {
    const normalized = word.toLowerCase();
    return normalized.length >= 3 && !TITLE_STOPWORDS.has(normalized);
  });

export const buildReplacementLabel = (foodName = '') => {
  const terms = extractTerms(foodName);
  if (terms.length === 0) return foodName.trim();
  if (terms.length === 1) return terms[0];
  return `${terms[0]} ${terms[1]}`;
};

const findIngredientName = (ingredient, foodById = new Map()) => {
  const directName = ingredient?.food?.name || ingredient?.food_name;
  if (directName) return directName;
  const byId = foodById.get(String(ingredient?.food_id));
  return byId?.name || '';
};

/**
 * Empareja ingredientes eliminados/añadidos entre dos versiones.
 * Devuelve pares { oldName, newName } para sustituidos,
 * y entradas individuales para añadidos/eliminados puros.
 */
export const pairIngredientReplacements = (originalIngredients = [], currentIngredients = [], foodById = new Map()) => {
  const pairs = [];
  const usedOriginal = new Set();
  const usedCurrent = new Set();
  const minLength = Math.min(originalIngredients.length, currentIngredients.length);

  for (let i = 0; i < minLength; i++) {
    const before = originalIngredients[i];
    const after = currentIngredients[i];
    if (String(before?.food_id) !== String(after?.food_id)) {
      pairs.push({ oldName: findIngredientName(before, foodById), newName: findIngredientName(after, foodById) });
      usedOriginal.add(i);
      usedCurrent.add(i);
    }
  }

  const originalCount = new Map();
  const currentCount = new Map();
  originalIngredients.forEach((ing, idx) => {
    if (usedOriginal.has(idx)) return;
    const key = String(ing?.food_id);
    originalCount.set(key, (originalCount.get(key) || 0) + 1);
  });
  currentIngredients.forEach((ing, idx) => {
    if (usedCurrent.has(idx)) return;
    const key = String(ing?.food_id);
    currentCount.set(key, (currentCount.get(key) || 0) + 1);
  });

  const removed = [];
  const added = [];
  originalCount.forEach((count, key) => {
    const diff = count - (currentCount.get(key) || 0);
    if (diff > 0) {
      const sample = originalIngredients.find((ing) => String(ing?.food_id) === key);
      for (let i = 0; i < diff; i++) removed.push(findIngredientName(sample, foodById));
    }
  });
  currentCount.forEach((count, key) => {
    const diff = count - (originalCount.get(key) || 0);
    if (diff > 0) {
      const sample = currentIngredients.find((ing) => String(ing?.food_id) === key);
      for (let i = 0; i < diff; i++) added.push(findIngredientName(sample, foodById));
    }
  });

  const total = Math.min(removed.length, added.length);
  for (let i = 0; i < total; i++) {
    pairs.push({ oldName: removed[i], newName: added[i] });
  }

  return pairs.filter((pair) => pair.oldName && pair.newName);
};

/**
 * Genera un diff_summary estructurado (jsonb) entre dos listas de ingredientes.
 * Formato: [{ action, food, food_id, from_food?, from_food_id?, from_grams?, to_grams? }]
 */
export const buildDiffSummary = (originalIngredients = [], currentIngredients = [], foodById = new Map()) => {
  const summary = [];
  const originalMap = new Map(originalIngredients.map(ing => [String(ing.food_id), ing]));
  const currentMap = new Map(currentIngredients.map(ing => [String(ing.food_id), ing]));

  // Detectar modificaciones de gramos y eliminaciones
  originalMap.forEach((origIng, foodId) => {
    const currIng = currentMap.get(foodId);
    const foodName = findIngredientName(origIng, foodById);
    if (!currIng) {
      summary.push({ action: 'remove', food: foodName, food_id: Number(foodId) });
    } else {
      const origGrams = Number(origIng.grams || 0);
      const currGrams = Number(currIng.grams || 0);
      if (origGrams !== currGrams) {
        summary.push({ action: 'modify_grams', food: foodName, food_id: Number(foodId), from_grams: origGrams, to_grams: currGrams });
      }
    }
  });

  // Detectar añadidos
  currentMap.forEach((currIng, foodId) => {
    if (!originalMap.has(foodId)) {
      const foodName = findIngredientName(currIng, foodById);
      summary.push({ action: 'add', food: foodName, food_id: Number(foodId) });
    }
  });

  return summary;
};

/**
 * Intenta derivar un variant_label corto a partir del diff_summary.
 * Ej: "Salmón en vez de Atún", "con Espinacas", "sin Lactosa", "más proteína"
 */
export const inferVariantLabel = (diffSummary = []) => {
  if (!diffSummary.length) return null;

  const replace = diffSummary.find(d => d.action === 'replace');
  if (replace) return `${buildReplacementLabel(replace.to_food)} en vez de ${buildReplacementLabel(replace.from_food)}`;

  const added = diffSummary.filter(d => d.action === 'add');
  const removed = diffSummary.filter(d => d.action === 'remove');

  if (added.length === 1 && removed.length === 1) {
    return `${buildReplacementLabel(added[0].food)} en vez de ${buildReplacementLabel(removed[0].food)}`;
  }
  if (added.length > 0 && removed.length === 0) {
    return `con ${added.map(d => buildReplacementLabel(d.food)).join(', ')}`;
  }
  if (removed.length > 0 && added.length === 0) {
    return `sin ${removed.map(d => buildReplacementLabel(d.food)).join(', ')}`;
  }

  const modGrams = diffSummary.filter(d => d.action === 'modify_grams');
  if (modGrams.length > 0 && added.length === 0 && removed.length === 0) {
    return `ajuste de cantidades`;
  }

  return `variante`;
};

/**
 * Intenta reemplazar el término del alimento viejo en el nombre base.
 * Exportado para que useRecipeEditor pueda usarlo directamente.
 */
export const replaceTitleFoodTerm = (title, oldFoodName, newFoodName) => {
  const oldTerms = extractTerms(oldFoodName).sort((a, b) => b.length - a.length);
  const replacement = buildReplacementLabel(newFoodName);
  if (!replacement) return { title, replaced: false };

  for (const term of oldTerms) {
    const pattern = new RegExp(`\\b${escapeRegExp(term)}(?:es|s)?\\b`, 'i');
    if (pattern.test(title)) {
      return { title: title.replace(pattern, replacement), replaced: true };
    }
  }
  return { title, replaced: false };
};

/**
 * Infiere un nombre de variante a partir de cambios en ingredientes.
 */
export const inferVariantNameFromIngredientChanges = (baseName, originalIngredients, currentIngredients, foodById = new Map()) => {
  if (!baseName) return baseName;
  const replacements = pairIngredientReplacements(originalIngredients, currentIngredients, foodById);
  if (replacements.length === 0) return baseName;

  let nextName = baseName;
  let atLeastOneReplacement = false;

  replacements.forEach(({ oldName, newName }) => {
    const result = replaceTitleFoodTerm(nextName, oldName, newName);
    nextName = result.title;
    if (result.replaced) atLeastOneReplacement = true;
  });

  if (!atLeastOneReplacement) {
    const fallbackLabel = buildReplacementLabel(replacements[0].newName);
    if (fallbackLabel) nextName = `${baseName} (${fallbackLabel})`;
  }

  return nextName;
};
