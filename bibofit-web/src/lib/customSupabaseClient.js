import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
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
  if (!url.includes('/auth/v1/token')) {
    return fetch(input, init);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS);

  const options = init ? { ...init, signal: controller.signal } : { signal: controller.signal };

  return fetch(input, options).finally(() => clearTimeout(timeoutId));
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: fetchWithAuthTimeout },
});
