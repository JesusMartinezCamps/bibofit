import { createClient } from "@supabase/supabase-js";
import { getSupabaseAuthStorageKey, guardSupabaseSession } from "./sessionGuard";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseKey = supabasePublishableKey || supabaseAnonKey;
const authStorageKey = getSupabaseAuthStorageKey(supabaseUrl);

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL and one of VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY"
  );
}

const isLikelyLocalSupabaseUrl = (url) => {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "::1"
    );
  } catch {
    return false;
  }
};

if (import.meta.env.PROD && isLikelyLocalSupabaseUrl(supabaseUrl)) {
  throw new Error(
    `Invalid production Supabase URL (${supabaseUrl}). Build is pointing to local Supabase.`
  );
}

// Auth token refresh requests can hang indefinitely if the network is slow or
// if the local/remote Supabase auth service is temporarily unresponsive.
// While a hung refresh is pending, the Supabase client blocks ALL subsequent
// API calls (including data queries and new login attempts), causing blank screens.
// This wrapper aborts auth requests that take longer than AUTH_TIMEOUT_MS,
// allowing the SDK to recover and the user to re-authenticate normally.
const AUTH_TIMEOUT_MS = 10000;

const fetchWithAuthTimeout = (input, init) => {
  const url = input instanceof Request ? input.url : String(input);
  if (!url.includes('/auth/v1/')) {
    return fetch(input, init);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS);

  const options = init ? { ...init, signal: controller.signal } : { signal: controller.signal };

  return fetch(input, options).finally(() => clearTimeout(timeoutId));
};

// Important: this must run before createClient() so auth-js never boots with a
// malformed persisted session in memory.
guardSupabaseSession({
  storageKey: authStorageKey,
  supabaseUrl,
  migrateLegacyKey: true,
});

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storageKey: authStorageKey,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  global: { fetch: fetchWithAuthTimeout },
});
