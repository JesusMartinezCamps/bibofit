#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const allowLocal = process.env.ALLOW_LOCAL_SUPABASE_IN_PROD === "1";
const mode = process.env.MODE || "production";

const ENV_FILES_BY_PRECEDENCE = [
  ".env",
  ".env.local",
  `.env.${mode}`,
  `.env.${mode}.local`,
];

const parseEnvFile = (filePath) => {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  const values = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const key = match[1];
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }

  return values;
};

const mergedEnv = {};
for (const relPath of ENV_FILES_BY_PRECEDENCE) {
  const fullPath = path.join(cwd, relPath);
  if (!fs.existsSync(fullPath)) continue;
  Object.assign(mergedEnv, parseEnvFile(fullPath));
}

Object.assign(mergedEnv, process.env);

const supabaseUrl = mergedEnv.VITE_SUPABASE_URL;
const supabaseAnonKey = mergedEnv.VITE_SUPABASE_ANON_KEY;
const appUrl = mergedEnv.VITE_APP_URL;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "[build-check] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY for production build."
  );
  process.exit(1);
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

if (isLikelyLocalSupabaseUrl(supabaseUrl) && !allowLocal) {
  console.error("[build-check] Refusing production build with local Supabase URL.");
  console.error(`[build-check] VITE_SUPABASE_URL=${supabaseUrl}`);
  console.error(
    "[build-check] Set cloud values before deploy, or use ALLOW_LOCAL_SUPABASE_IN_PROD=1 only if intentional."
  );
  process.exit(1);
}

if (appUrl) {
  let parsedAppUrl;
  try {
    parsedAppUrl = new URL(appUrl);
  } catch {
    console.error(`[build-check] Invalid VITE_APP_URL value: ${appUrl}`);
    console.error("[build-check] VITE_APP_URL must be an absolute URL, e.g. https://bibofit.com");
    process.exit(1);
  }

  if (isLikelyLocalSupabaseUrl(parsedAppUrl.toString()) && !allowLocal) {
    console.error("[build-check] Refusing production build with local VITE_APP_URL.");
    console.error(`[build-check] VITE_APP_URL=${appUrl}`);
    process.exit(1);
  }
} else {
  console.warn(
    "[build-check] VITE_APP_URL is not set; auth redirects will fallback to window.location.origin."
  );
}

console.log(`[build-check] Supabase URL OK for mode=${mode}.`);
