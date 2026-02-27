import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (_req) => {
  return new Response(
    JSON.stringify({ ok: true, note: "stub" }),
    { headers: { "content-type": "application/json" } },
  );
});
