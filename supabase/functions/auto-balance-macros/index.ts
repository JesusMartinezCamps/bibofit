import { corsHeaders, jsonResponse } from "../_shared/http/cors.ts";
import { createAdminClient } from "../_shared/auto-balance/adapters.ts";
import {
  balanceSingleRecipeIngredients,
  normalizeLooseIngredients,
  normalizeRecipeTargets,
} from "../_shared/auto-balance/core-autobalance-recipe.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const ingredients = Array.isArray(body?.ingredients) ? body.ingredients : [];
    const rawTargets = body?.targets;
    const targets = normalizeRecipeTargets(rawTargets);

    if (!ingredients.length || !rawTargets) {
      return jsonResponse({ success: false, error_code: "invalid_input", error: "Missing ingredients or targets" }, 400);
    }

    const normalizedIngredients = normalizeLooseIngredients(ingredients);
    const supabaseAdmin = createAdminClient();
    const balanced = await balanceSingleRecipeIngredients({
      supabaseAdmin,
      ingredients: normalizedIngredients,
      targets,
      options: { profile: body?.profile },
    });

    const balancedIngredients = balanced.map((ing) => ({
      ...ing,
      quantity: ing.quantity,
      grams: ing.grams,
    }));

    return jsonResponse({
      success: true,
      schema_version: "v1",
      balancedIngredients,
      results: balancedIngredients,
    });
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error_code: "internal_error",
        error: (error as any)?.message || String(error),
      },
      500,
    );
  }
});
