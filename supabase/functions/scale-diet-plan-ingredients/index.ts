import { corsHeaders, jsonResponse } from "../_shared/http/cors.ts";
import { createAdminClient } from "../_shared/auto-balance/adapters.ts";
import { safeNumber } from "../_shared/auto-balance/core.ts";

/**
 * Rounds grams to nutritionally sensible precision:
 *  < 5g  → nearest 0.5g (ej. 4.3 → 4.5)
 *  5-20g → nearest 1g   (ej. 18.7 → 19)
 *  > 20g → nearest 5g   (ej. 99 → 100, 97 → 95)
 */
function roundGrams(grams: number): number {
  if (grams <= 0) return 0;
  if (grams < 5) return Math.round(grams * 2) / 2;
  if (grams < 20) return Math.round(grams);
  return Math.round(grams / 5) * 5;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { diet_plan_id, user_id, old_tdee, new_tdee } = body ?? {};

    if (!diet_plan_id || !user_id || !old_tdee || !new_tdee) {
      return jsonResponse({
        success: false,
        error_code: "invalid_input",
        error: "Missing required parameters: diet_plan_id, user_id, old_tdee, new_tdee",
      }, 400);
    }

    const oldTdee = safeNumber(old_tdee);
    const newTdee = safeNumber(new_tdee);

    if (oldTdee <= 0 || newTdee <= 0) {
      return jsonResponse({
        success: false,
        error_code: "invalid_input",
        error: "TDEE values must be positive numbers",
      }, 400);
    }

    // If the factor is effectively 1, nothing to do
    const factor = newTdee / oldTdee;
    if (Math.abs(factor - 1) < 0.001) {
      return jsonResponse({ success: true, schema_version: "v1", factor, updated_plan_rows: 0, updated_private_rows: 0 });
    }

    const supabaseAdmin = createAdminClient();

    // Fetch all diet_plan_recipe_ids for this plan (non-archived)
    const { data: planRecipes, error: planRecipesError } = await supabaseAdmin
      .from("diet_plan_recipes")
      .select("id")
      .eq("diet_plan_id", diet_plan_id)
      .eq("is_archived", false);

    if (planRecipesError) throw planRecipesError;

    const planRecipeIds = (planRecipes || []).map((r: any) => r.id);

    // Fetch all user_recipe_ids (private/variant) linked to this plan
    const { data: userRecipes, error: userRecipesError } = await supabaseAdmin
      .from("user_recipes")
      .select("id")
      .eq("diet_plan_id", diet_plan_id)
      .eq("is_archived", false);

    if (userRecipesError) throw userRecipesError;

    const privateRecipeIds = (userRecipes || []).map((r: any) => r.id);

    // Fetch current ingredient grams for both recipe types in parallel
    const [planIngredientsRes, privateIngredientsRes] = await Promise.all([
      planRecipeIds.length
        ? supabaseAdmin
            .from("diet_plan_recipe_ingredients")
            .select("id, grams")
            .in("diet_plan_recipe_id", planRecipeIds)
        : Promise.resolve({ data: [], error: null as any }),
      privateRecipeIds.length
        ? supabaseAdmin
            .from("private_recipe_ingredients")
            .select("id, grams")
            .in("private_recipe_id", privateRecipeIds)
        : Promise.resolve({ data: [], error: null as any }),
    ]);

    if (planIngredientsRes.error) throw planIngredientsRes.error;
    if (privateIngredientsRes.error) throw privateIngredientsRes.error;

    // Apply linear scale with proper rounding
    const planRows = (planIngredientsRes.data || []).map((row: any) => ({
      id: row.id,
      grams: roundGrams(safeNumber(row.grams) * factor),
    }));

    const privateRows = (privateIngredientsRes.data || []).map((row: any) => ({
      id: row.id,
      grams: roundGrams(safeNumber(row.grams) * factor),
    }));

    // Bulk update both tables in parallel
    const [r1, r2] = await Promise.all([
      planRows.length
        ? supabaseAdmin.rpc("bulk_update_diet_plan_recipe_ingredients", { _rows: planRows })
        : Promise.resolve({ data: 0, error: null as any }),
      privateRows.length
        ? supabaseAdmin.rpc("bulk_update_private_recipe_ingredients", { _rows: privateRows })
        : Promise.resolve({ data: 0, error: null as any }),
    ]);

    if (r1.error) throw r1.error;
    if (r2.error) throw r2.error;

    return jsonResponse({
      success: true,
      schema_version: "v1",
      factor: Math.round(factor * 1000) / 1000,
      updated_plan_rows: r1.data ?? 0,
      updated_private_rows: r2.data ?? 0,
    });
  } catch (error) {
    return jsonResponse({
      success: false,
      error_code: "internal_error",
      error: (error as any)?.message || String(error),
    }, 500);
  }
});
