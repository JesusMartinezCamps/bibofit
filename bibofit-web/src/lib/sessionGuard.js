const SB_KEY_PREFIX = 'sb-';
const AUTH_TOKEN_SUFFIX = '-auth-token';
const DEFAULT_AUTH_STORAGE_KEY = 'sb-bibofit-auth-token';

const b64UrlToJson = (segment) => {
  try {
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
};

const isJwtLike = (token) => {
  if (typeof token !== 'string') return false;
  const parts = token.split('.');
  return parts.length === 3 && parts.every((p) => p.length > 0);
};

const readSessionPayload = (raw) => {
  const parsed = JSON.parse(raw);
  // Backward/forward compatibility if auth-js ever wraps session objects.
  return parsed?.currentSession ?? parsed;
};

const isStructurallyValidSession = (session) => {
  return (
    !!session &&
    typeof session === 'object' &&
    typeof session.access_token === 'string' &&
    typeof session.refresh_token === 'string' &&
    typeof session.expires_at === 'number'
  );
};

const resolveExpectedIssuerPrefix = (supabaseUrl) => {
  if (!supabaseUrl) return null;
  try {
    return `${new URL(supabaseUrl).origin}/auth/v1`;
  } catch {
    return null;
  }
};

const resolveLegacyStorageKey = (supabaseUrl) => {
  if (!supabaseUrl) return null;
  try {
    const hostPrefix = new URL(supabaseUrl).hostname.split('.')[0];
    return `sb-${hostPrefix}-auth-token`;
  } catch {
    return null;
  }
};

const clearKeyFamily = (key) => {
  localStorage.removeItem(key);
  localStorage.removeItem(`${key}-code-verifier`);
  localStorage.removeItem(`${key}-user`);
};

const validateStoredSession = (key, expectedIssuerPrefix) => {
  const raw = localStorage.getItem(key);
  if (!raw) return { valid: false, reason: 'missing' };

  let session;
  try {
    session = readSessionPayload(raw);
  } catch {
    return { valid: false, reason: 'invalid_json' };
  }

  if (!isStructurallyValidSession(session)) {
    return { valid: false, reason: 'invalid_shape' };
  }

  if (!isJwtLike(session.access_token)) {
    return { valid: false, reason: 'invalid_access_token_format' };
  }

  const payload = b64UrlToJson(session.access_token.split('.')[1]);
  if (!payload || typeof payload !== 'object') {
    return { valid: false, reason: 'invalid_access_token_payload' };
  }

  if (
    expectedIssuerPrefix &&
    typeof payload.iss === 'string' &&
    !payload.iss.startsWith(expectedIssuerPrefix)
  ) {
    return { valid: false, reason: 'issuer_mismatch' };
  }

  return { valid: true, raw };
};

export function getSupabaseAuthStorageKey(supabaseUrl) {
  if (!supabaseUrl) return DEFAULT_AUTH_STORAGE_KEY;

  try {
    const parsed = new URL(supabaseUrl);
    const host = parsed.hostname.replace(/[^a-zA-Z0-9]/g, '-');
    const portSuffix = parsed.port ? `-${parsed.port}` : '';
    return `sb-bibofit-${host}${portSuffix}-auth-token`;
  } catch {
    return DEFAULT_AUTH_STORAGE_KEY;
  }
}

/**
 * Validates and optionally migrates persisted Supabase auth session.
 * Must run before creating the Supabase client instance.
 */
export function guardSupabaseSession(options = {}) {
  const { storageKey, supabaseUrl, migrateLegacyKey = true } = options;
  const targetStorageKey = storageKey || getSupabaseAuthStorageKey(supabaseUrl);

  try {
    const expectedIssuerPrefix = resolveExpectedIssuerPrefix(supabaseUrl);
    const legacyKey = resolveLegacyStorageKey(supabaseUrl);

    if (migrateLegacyKey && legacyKey && legacyKey !== targetStorageKey) {
      const targetRaw = localStorage.getItem(targetStorageKey);
      const legacyValidation = validateStoredSession(legacyKey, expectedIssuerPrefix);

      if (!targetRaw && legacyValidation.valid && legacyValidation.raw) {
        localStorage.setItem(targetStorageKey, legacyValidation.raw);
        const legacyUser = localStorage.getItem(`${legacyKey}-user`);
        if (legacyUser) localStorage.setItem(`${targetStorageKey}-user`, legacyUser);
      }

      clearKeyFamily(legacyKey);
    }

    const targetValidation = validateStoredSession(targetStorageKey, expectedIssuerPrefix);
    if (!targetValidation.valid && targetValidation.reason !== 'missing') {
      clearKeyFamily(targetStorageKey);
    }
  } catch {
    clearSupabaseAuthKeys({ storageKey: targetStorageKey });
  }
}

export function clearSupabaseAuthKeys(options = {}) {
  const { storageKey } = options;

  try {
    if (storageKey) {
      clearKeyFamily(storageKey);
      return;
    }

    Object.keys(localStorage)
      .filter((k) => k.startsWith(SB_KEY_PREFIX) && k.endsWith(AUTH_TOKEN_SUFFIX))
      .forEach((k) => clearKeyFamily(k));
  } catch {
    // localStorage unavailable (e.g. private browsing with storage blocked)
  }
}
