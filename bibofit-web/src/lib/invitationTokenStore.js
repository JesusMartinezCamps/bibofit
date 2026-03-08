const INVITE_TOKEN_QUERY_PARAM = 'invite_token';
const INVITE_TOKEN_STORAGE_KEY = 'bibofit.pending_invite_token';
const INVITE_TOKEN_REGEX = /^[a-zA-Z0-9]{24,96}$/;

export const sanitizeInviteToken = (value) => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!INVITE_TOKEN_REGEX.test(normalized)) return null;
  return normalized.toLowerCase();
};

export const getInviteTokenFromSearch = (search = '') => {
  const params = new URLSearchParams(search || '');
  return sanitizeInviteToken(params.get(INVITE_TOKEN_QUERY_PARAM));
};

export const setStoredInviteToken = (token) => {
  const cleanToken = sanitizeInviteToken(token);
  if (!cleanToken) return null;

  try {
    window.localStorage.setItem(INVITE_TOKEN_STORAGE_KEY, cleanToken);
    return cleanToken;
  } catch {
    return null;
  }
};

export const getStoredInviteToken = () => {
  try {
    const value = window.localStorage.getItem(INVITE_TOKEN_STORAGE_KEY);
    const cleanToken = sanitizeInviteToken(value);
    if (!cleanToken && value) {
      window.localStorage.removeItem(INVITE_TOKEN_STORAGE_KEY);
    }
    return cleanToken;
  } catch {
    return null;
  }
};

export const clearStoredInviteToken = () => {
  try {
    window.localStorage.removeItem(INVITE_TOKEN_STORAGE_KEY);
  } catch {
    // Ignorar errores de almacenamiento.
  }
};

export const captureInviteTokenFromLocation = (search) => {
  const resolvedSearch =
    typeof search === 'string'
      ? search
      : typeof window !== 'undefined'
        ? window.location.search
        : '';

  const token = getInviteTokenFromSearch(resolvedSearch);
  if (!token) return null;
  setStoredInviteToken(token);
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
