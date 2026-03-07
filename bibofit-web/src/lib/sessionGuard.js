const SB_KEY_PREFIX = 'sb-';
const AUTH_TOKEN_SUFFIX = '-auth-token';

/**
 * Validates the stored Supabase session before the client tries to use it.
 * Clears it if it's structurally invalid to avoid getSession() hanging on a
 * corrupted or SDK-incompatible token after a deploy.
 * Must be called synchronously before ReactDOM.createRoot().
 */
export function guardSupabaseSession() {
  try {
    const authKey = Object.keys(localStorage).find(
      (k) => k.startsWith(SB_KEY_PREFIX) && k.endsWith(AUTH_TOKEN_SUFFIX)
    );
    if (!authKey) return;

    const raw = localStorage.getItem(authKey);
    if (!raw) return;

    const parsed = JSON.parse(raw);

    const isValid =
      parsed &&
      typeof parsed.access_token === 'string' &&
      typeof parsed.refresh_token === 'string' &&
      typeof parsed.user?.id === 'string';

    if (!isValid) {
      _clearSupabaseKeys();
    }
  } catch {
    // JSON.parse failed or localStorage is inaccessible
    _clearSupabaseKeys();
  }
}

function _clearSupabaseKeys() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(SB_KEY_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    // localStorage unavailable (e.g. private browsing with storage blocked)
  }
}
