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

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
