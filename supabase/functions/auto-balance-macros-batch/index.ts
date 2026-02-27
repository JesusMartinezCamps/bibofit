import { corsHeaders, jsonResponse } from "../_shared/http/cors.ts";
import { safeNumber } from "../_shared/auto-balance/core.ts";
import { createAdminClient } from "../_shared/auto-balance/adapters.ts";
import { balanceRecipesWithSharedContext } from "../_shared/auto-balance/core-autobalance-recipe.ts";
import type { BalanceRecipeRequest } from "../_shared/auto-balance/types.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { moment_id, recipe_ids, user_id } = await req.json();
    if (!moment_id || !Array.isArray(recipe_ids) || !user_id) {
      return jsonResponse({ success: false, error_code: "invalid_input", error: "Missing required parameters: moment_id, recipe_ids, user_id" }, 400);
    }

    const supabaseAdmin = createAdminClient();

    const { data: userDayMeal, error: udmError } = await supabaseAdmin
      .from("user_day_meals")
      .select("*")
      .eq("id", moment_id)
      .single();

    if (udmError) throw new Error(`User day meal not found for moment_id ${moment_id}: ${udmError.message}`);

    const dietPlanRecipeIds = recipe_ids.filter((r: any) => !r.is_private).map((r: any) => r.id);
    const privateRecipeIds = recipe_ids.filter((r: any) => r.is_private).map((r: any) => r.id);

    const [planRecipesRes, privateRecipesRes] = await Promise.all([
      dietPlanRecipeIds.length
        ? supabaseAdmin
            .from("diet_plan_recipes")
            .select("id, custom_ingredients:diet_plan_recipe_ingredients(*)")
            .in("id", dietPlanRecipeIds)
        : Promise.resolve({ data: [], error: null as any }),
      privateRecipeIds.length
        ? supabaseAdmin
            .from("private_recipes")
            .select("id, private_recipe_ingredients(*)")
            .in("id", privateRecipeIds)
        : Promise.resolve({ data: [], error: null as any }),
    ]);

    if (planRecipesRes.error) throw planRecipesRes.error;
    if (privateRecipesRes.error) throw privateRecipesRes.error;

    const recipes: BalanceRecipeRequest[] = [
      ...(planRecipesRes.data || []).map((r: any) => ({ id: r.id, is_private: false, ingredients: r.custom_ingredients || [] })),
      ...(privateRecipesRes.data || []).map((r: any) => ({ id: r.id, is_private: true, ingredients: r.private_recipe_ingredients || [] })),
    ].map((recipe: any) => ({
      recipe_id: recipe.id,
      is_private: recipe.is_private,
      ingredients: recipe.ingredients || [],
    }));

    const target = {
      proteins: safeNumber(userDayMeal.target_proteins, 0),
      carbs: safeNumber(userDayMeal.target_carbs, 0),
      fats: safeNumber(userDayMeal.target_fats, 0),
    };

    const balancedResults = await balanceRecipesWithSharedContext({
      supabaseAdmin,
      recipes,
      targets: target,
    });

    const rowsDietPlan: Array<{ id: number | string; grams: number }> = [];
    const rowsPrivate: Array<{ id: number | string; grams: number }> = [];

    for (const recipe of balancedResults) {
      for (const row of recipe.ingredients) {
        if (!row.ingredient_row_id) continue;
        if (row.is_private) rowsPrivate.push({ id: row.ingredient_row_id, grams: row.grams });
        else rowsDietPlan.push({ id: row.ingredient_row_id, grams: row.grams });
      }
    }

    const [r1, r2] = await Promise.all([
      rowsDietPlan.length
        ? supabaseAdmin.rpc("bulk_update_diet_plan_recipe_ingredients", { _rows: rowsDietPlan })
        : Promise.resolve({ data: 0, error: null as any }),
      rowsPrivate.length
        ? supabaseAdmin.rpc("bulk_update_private_recipe_ingredients", { _rows: rowsPrivate })
        : Promise.resolve({ data: 0, error: null as any }),
    ]);

    if (r1.error) throw r1.error;
    if (r2.error) throw r2.error;

    return jsonResponse({
      success: true,
      schema_version: "v1",
      recipesProcessed: balancedResults.length,
      totalRecipes: recipes.length,
      updatedDietPlanRows: r1.data ?? 0,
      updatedPrivateRows: r2.data ?? 0,
      results: balancedResults,
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
