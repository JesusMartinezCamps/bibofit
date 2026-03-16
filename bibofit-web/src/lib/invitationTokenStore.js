const INVITE_TOKEN_QUERY_PARAM = 'invite_token';
const INVITE_TOKEN_STORAGE_KEY = 'bibofit.pending_invite_token';
const INVITE_TOKEN_REGEX = /^[a-zA-Z0-9]{24,96}$/;
const INVITE_TOKEN_TTL_MS = 45 * 60 * 1000;

export const sanitizeInviteToken = (value) => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!INVITE_TOKEN_REGEX.test(normalized)) return null;
  return normalized.toLowerCase();
};

const getTokenStorages = () => {
  if (typeof window === 'undefined') return [];
  const storages = [];
  try {
    if (window.localStorage) storages.push(window.localStorage);
  } catch {
    // Ignorar almacenamiento no disponible.
  }
  try {
    if (window.sessionStorage) storages.push(window.sessionStorage);
  } catch {
    // Ignorar almacenamiento no disponible.
  }
  return storages;
};

const safeRemoveStoredToken = () => {
  const storages = getTokenStorages();
  storages.forEach((storage) => {
    try {
      storage.removeItem(INVITE_TOKEN_STORAGE_KEY);
    } catch {
      // Ignorar errores de almacenamiento.
    }
  });
};

const stripInviteTokenFromCurrentUrl = () => {
  if (typeof window === 'undefined' || !window.location) return;
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(INVITE_TOKEN_QUERY_PARAM)) return;
    url.searchParams.delete(INVITE_TOKEN_QUERY_PARAM);
    const cleanUrl = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(window.history.state, '', cleanUrl);
  } catch {
    // Si falla el parsing de URL, no bloquear el flujo.
  }
};

export const getInviteTokenFromSearch = (search = '') => {
  const params = new URLSearchParams(search || '');
  return sanitizeInviteToken(params.get(INVITE_TOKEN_QUERY_PARAM));
};

export const setStoredInviteToken = (token) => {
  const cleanToken = sanitizeInviteToken(token);
  if (!cleanToken) return null;

  const storages = getTokenStorages();
  if (storages.length === 0) return null;

  let persisted = false;
  storages.forEach((storage) => {
    try {
      storage.setItem(
        INVITE_TOKEN_STORAGE_KEY,
        JSON.stringify({
          token: cleanToken,
          storedAt: Date.now(),
        })
      );
      persisted = true;
    } catch {
      // Ignorar errores puntuales de una storage concreta.
    }
  });

  return persisted ? cleanToken : null;
};

export const getStoredInviteToken = () => {
  const storages = getTokenStorages();
  if (storages.length === 0) return null;

  for (const storage of storages) {
    try {
      const rawValue = storage.getItem(INVITE_TOKEN_STORAGE_KEY);
      if (!rawValue) continue;

      let parsedValue = null;
      try {
        parsedValue = JSON.parse(rawValue);
      } catch {
        // Compatibilidad con valor legacy en texto plano.
      }

      const candidateToken =
        parsedValue && typeof parsedValue === 'object'
          ? sanitizeInviteToken(parsedValue.token)
          : sanitizeInviteToken(rawValue);

      if (!candidateToken) {
        safeRemoveStoredToken();
        return null;
      }

      const storedAt =
        parsedValue && typeof parsedValue.storedAt === 'number'
          ? parsedValue.storedAt
          : null;

      if (storedAt && Date.now() - storedAt > INVITE_TOKEN_TTL_MS) {
        safeRemoveStoredToken();
        return null;
      }

      return candidateToken;
    } catch {
      // Probar siguiente storage.
    }
  }

  return null;
};

export const clearStoredInviteToken = () => {
  safeRemoveStoredToken();
};

export const captureInviteTokenFromLocation = (search, options = {}) => {
  const { stripFromUrl = true } = options;
  const resolvedSearch =
    typeof search === 'string'
      ? search
      : typeof window !== 'undefined'
        ? window.location.search
        : '';

  const token = getInviteTokenFromSearch(resolvedSearch);
  if (!token) return null;
  setStoredInviteToken(token);
  if (stripFromUrl) stripInviteTokenFromCurrentUrl();
  return token;
};

export const getInviteTokenCandidate = (explicitToken = null, search) => {
  const explicit = sanitizeInviteToken(explicitToken);
  if (explicit) {
    setStoredInviteToken(explicit);
    return explicit;
  }

  const fromLocation = captureInviteTokenFromLocation(search);
  if (fromLocation) return fromLocation;

  return getStoredInviteToken();
};

export const appendInviteTokenToPath = (path, token) => {
  const cleanToken = sanitizeInviteToken(token);
  if (!cleanToken) return path;

  try {
    const base =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'http://localhost';
    const url = new URL(path, base);
    url.searchParams.set(INVITE_TOKEN_QUERY_PARAM, cleanToken);

    if (/^https?:\/\//i.test(path)) return url.toString();
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    const separator = path.includes('?') ? '&' : '?';
    return `${path}${separator}${INVITE_TOKEN_QUERY_PARAM}=${encodeURIComponent(cleanToken)}`;
  }
};
