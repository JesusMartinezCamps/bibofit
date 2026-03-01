export const normalizeSearchText = (text) =>
  (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export const splitSearchTokens = (text) =>
  normalizeSearchText(text)
    .split(/\s+/)
    .filter(Boolean);

export const includesAllTokens = (haystack, rawQuery) => {
  const tokens = splitSearchTokens(rawQuery);
  if (tokens.length === 0) return true;
  const normalizedHaystack = normalizeSearchText(haystack);
  return tokens.every((token) => normalizedHaystack.includes(token));
};
