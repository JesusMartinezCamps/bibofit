import { corsHeaders, jsonResponse } from "../_shared/http/cors.ts";
import { safeNumber } from "../_shared/auto-balance/core.ts";
import { createAdminClient } from "../_shared/auto-balance/adapters.ts";
import { balanceRecipesWithSharedContext } from "../_shared/auto-balance/core-autobalance-recipe.ts";
import type { BalanceRecipeRequest } from "../_shared/auto-balance/types.ts";

type EquivalenceInput = {
  equivalence_adjustment_id: number;
  user_id: string;
  target_macros: {
    proteins: number;
    carbs: number;
    fats: number;
  };
  recipes: Array<{ id: number | string; is_private: boolean }>;
};

const resolveFromRecord = async (supabaseAdmin: ReturnType<typeof createAdminClient>, record: any): Promise<EquivalenceInput> => {
  const eqId = Number(record?.id);
  if (!eqId) throw new Error("Missing equivalence adjustment id in record payload");

  const { data: eq, error: eqError } = await supabaseAdmin
    .from("equivalence_adjustments")
    .select("*")
    .eq("id", eqId)
    .single();

  if (eqError) throw eqError;

  const { data: targetMeal, error: mealError } = await supabaseAdmin
    .from("user_day_meals")
    .select("id, user_id, day_meal_id, diet_plan_id, target_proteins, target_carbs, target_fats")
    .eq("id", eq.target_user_day_meal_id)
    .single();

  if (mealError) throw mealError;

  const target_macros = {
    proteins: Math.max(0, safeNumber(targetMeal.target_proteins) - safeNumber(eq.adjustment_proteins)),
    carbs: Math.max(0, safeNumber(targetMeal.target_carbs) - safeNumber(eq.adjustment_carbs)),
    fats: Math.max(0, safeNumber(targetMeal.target_fats) - safeNumber(eq.adjustment_fats)),
  };

  const [planRecipesRes, plannedPrivateRes] = await Promise.all([
    supabaseAdmin
      .from("diet_plan_recipes")
      .select("id")
      .eq("diet_plan_id", targetMeal.diet_plan_id)
      .eq("day_meal_id", targetMeal.day_meal_id),
    supabaseAdmin
      .from("planned_meals")
      .select("private_recipe_id")
      .eq("user_id", eq.user_id)
      .eq("diet_plan_id", targetMeal.diet_plan_id)
      .eq("plan_date", eq.log_date)
      .eq("day_meal_id", targetMeal.day_meal_id),
  ]);

  if (planRecipesRes.error) throw planRecipesRes.error;
  if (plannedPrivateRes.error) throw plannedPrivateRes.error;

  const recipes = [
    ...((planRecipesRes.data || []).map((r: any) => ({ id: r.id, is_private: false }))),
    ...((plannedPrivateRes.data || []).filter((r: any) => r.private_recipe_id != null).map((r: any) => ({ id: r.private_recipe_id, is_private: true }))),
  ];

  return {
    equivalence_adjustment_id: eqId,
    user_id: eq.user_id,
    target_macros,
    recipes,
  };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseAdmin = createAdminClient();

  try {
    const payload = await req.json();

    const normalized: EquivalenceInput = payload?.record
      ? await resolveFromRecord(supabaseAdmin, payload.record)
      : {
          equivalence_adjustment_id: Number(payload?.equivalence_adjustment_id),
          user_id: payload?.user_id,
          target_macros: {
            proteins: safeNumber(payload?.target_macros?.proteins),
            carbs: safeNumber(payload?.target_macros?.carbs),
            fats: safeNumber(payload?.target_macros?.fats),
          },
          recipes: Array.isArray(payload?.recipes) ? payload.recipes : [],
        };

    if (!normalized.user_id || !normalized.equivalence_adjustment_id || !Array.isArray(normalized.recipes)) {
      return jsonResponse({
        success: false,
        error_code: "invalid_input",
        error: "Invalid input. Required: user_id, equivalence_adjustment_id, target_macros, recipes[]",
      }, 400);
    }

    if (!normalized.recipes.length) {
      await supabaseAdmin
        .from("equivalence_adjustments")
        .update({ status: "applied", error_message: null })
        .eq("id", normalized.equivalence_adjustment_id);

      return jsonResponse({ success: true, schema_version: "v1", count: 0, results: [] });
    }

    const dietPlanRecipeIds = normalized.recipes.filter((r) => !r.is_private).map((r) => r.id);
    const privateRecipeIds = normalized.recipes.filter((r) => r.is_private).map((r) => r.id);

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

    const allRecipes: BalanceRecipeRequest[] = [
      ...(planRecipesRes.data || []).map((r: any) => ({ id: r.id, is_private: false, ingredients: r.custom_ingredients || [] })),
      ...(privateRecipesRes.data || []).map((r: any) => ({ id: r.id, is_private: true, ingredients: r.private_recipe_ingredients || [] })),
    ].map((recipe: any) => ({
      recipe_id: recipe.id,
      is_private: recipe.is_private,
      ingredients: recipe.ingredients || [],
    }));

    const allIngredients = allRecipes.flatMap((recipe) => recipe.ingredients || []);

    if (!allIngredients.length) {
      await supabaseAdmin
        .from("equivalence_adjustments")
        .update({ status: "applied", error_message: null })
        .eq("id", normalized.equivalence_adjustment_id);

      return jsonResponse({ success: true, schema_version: "v1", count: 0, results: [] });
    }

    const finalAdjustments: any[] = [];
    const originalIngredientsByRecipeId = new Map(
      allRecipes.map((recipe) => [String(recipe.recipe_id), recipe.ingredients || []]),
    );

    const balancedRecipes = await balanceRecipesWithSharedContext({
      supabaseAdmin,
      recipes: allRecipes,
      targets: normalized.target_macros,
    });

    for (const recipe of balancedRecipes) {
      const originalsByRowId = new Map(
        (originalIngredientsByRecipeId.get(String(recipe.recipe_id)) || [])
          .map((ingredient: any) => [String(ingredient.id), ingredient]),
      );

      for (const row of recipe.ingredients) {
        const original = originalsByRowId.get(String(row.ingredient_row_id));
        finalAdjustments.push({
          equivalence_adjustment_id: normalized.equivalence_adjustment_id,
          diet_plan_recipe_id: row.is_private ? null : Number(recipe.recipe_id),
          private_recipe_id: row.is_private ? Number(recipe.recipe_id) : null,
          food_id: original?.food_id != null ? Number(original.food_id) : null,
          original_grams: safeNumber(original?.grams, 0),
          adjusted_grams: Math.round(safeNumber(row.grams, 0) * 10) / 10,
          created_at: new Date().toISOString(),
        });
      }
    }

    const { error: delError } = await supabaseAdmin
      .from("daily_ingredient_adjustments")
      .delete()
      .eq("equivalence_adjustment_id", normalized.equivalence_adjustment_id);

    if (delError) throw delError;

    if (finalAdjustments.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from("daily_ingredient_adjustments")
        .insert(finalAdjustments);
      if (insertError) throw insertError;
    }

    const { error: updateError } = await supabaseAdmin
      .from("equivalence_adjustments")
      .update({ status: "applied", error_message: null })
      .eq("id", normalized.equivalence_adjustment_id);

    if (updateError) throw updateError;

    return jsonResponse({
      success: true,
      schema_version: "v1",
      count: finalAdjustments.length,
      results: finalAdjustments,
    });
  } catch (error) {
    const message = (error as any)?.message || String(error);
    try {
      const body = await req.clone().json().catch(() => ({}));
      const eqId = Number(body?.equivalence_adjustment_id || body?.record?.id || 0);
      if (eqId) {
        await supabaseAdmin
          .from("equivalence_adjustments")
          .update({ status: "failed", error_message: message })
          .eq("id", eqId);
      }
    } catch {
      // noop
    }

    return jsonResponse({
      success: false,
      error_code: "internal_error",
      error: message,
    }, 400);
  }
});
