import { corsHeaders, jsonResponse } from "../_shared/http/cors.ts";
import { safeNumber } from "../_shared/auto-balance/core.ts";
import { createAdminClient, loadFoodsAndGroupsContext } from "../_shared/auto-balance/adapters.ts";
import { balanceRecipesWithSharedContext } from "../_shared/auto-balance/core-autobalance-recipe.ts";
import type { BalanceRecipeRequest } from "../_shared/auto-balance/types.ts";

/**
 * Balances all moments of a plan in a single call.
 * More efficient than N calls to auto-balance-macros-batch because:
 *   - Food context (macros, food groups) is loaded ONCE and shared across all moments
 *   - Single HTTP round-trip from client
 *   - All DB writes dispatched in parallel at the end
 *
 * Input:  { diet_plan_id, user_id, meal_ids?: string[] }
 *   meal_ids → optional filter; if omitted, balances ALL moments of the plan.
 *              Used for linked-meal scenarios (e.g. Cena + Desayuno changed together).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { diet_plan_id, user_id, meal_ids } = body ?? {};

    if (!diet_plan_id || !user_id) {
      return jsonResponse({
        success: false,
        error_code: "invalid_input",
        error: "Missing required parameters: diet_plan_id, user_id",
      }, 400);
    }

    const supabaseAdmin = createAdminClient();

    // 1. Fetch user_day_meals for this plan (optionally filtered by meal_ids)
    let udmQuery = supabaseAdmin
      .from("user_day_meals")
      .select("*")
      .eq("user_id", user_id)
      .eq("diet_plan_id", diet_plan_id);

    if (Array.isArray(meal_ids) && meal_ids.length > 0) {
      udmQuery = udmQuery.in("id", meal_ids);
    }

    const { data: userDayMeals, error: udmError } = await udmQuery;
    if (udmError) throw udmError;
    if (!userDayMeals?.length) {
      return jsonResponse({ success: true, schema_version: "v1", moments_processed: 0, recipes_processed: 0 });
    }

    const momentIds = userDayMeals.map((m: any) => m.id);
    const dayMealIds = userDayMeals.map((m: any) => m.day_meal_id);

    // 2. Fetch all recipes for these moments in parallel
    const [planRecipesRes, privateRecipesRes] = await Promise.all([
      supabaseAdmin
        .from("diet_plan_recipes")
        .select("id, day_meal_id, custom_ingredients:diet_plan_recipe_ingredients(*)")
        .eq("diet_plan_id", diet_plan_id)
        .in("day_meal_id", dayMealIds)
        .eq("is_archived", false),
      supabaseAdmin
        .from("user_recipes")
        .select("id, day_meal_id, recipe_ingredients(*)")
        .eq("diet_plan_id", diet_plan_id)
        .in("day_meal_id", dayMealIds)
        .eq("is_archived", false),
    ]);

    if (planRecipesRes.error) throw planRecipesRes.error;
    if (privateRecipesRes.error) throw privateRecipesRes.error;

    // 3. Collect all food_ids for shared context loading
    const allFoodIds: Array<string | number> = [];

    const momentRecipes = new Map<number, BalanceRecipeRequest[]>();
    for (const udm of userDayMeals) {
      momentRecipes.set(udm.id, []);
    }

    // Build a dayMealId → moment_id map
    const dayMealToMoment = new Map<number, any>();
    for (const udm of userDayMeals) {
      dayMealToMoment.set(udm.day_meal_id, udm);
    }

    for (const r of planRecipesRes.data || []) {
      const udm = dayMealToMoment.get(r.day_meal_id);
      if (!udm) continue;
      const ingredients = r.custom_ingredients || [];
      for (const ing of ingredients) {
        if (ing?.food_id != null) allFoodIds.push(ing.food_id);
      }
      momentRecipes.get(udm.id)!.push({
        recipe_id: r.id,
        is_private: false,
        ingredients,
      });
    }

    for (const r of privateRecipesRes.data || []) {
      const udm = dayMealToMoment.get(r.day_meal_id);
      if (!udm) continue;
      const ingredients = r.recipe_ingredients || [];
      for (const ing of ingredients) {
        if (ing?.food_id != null) allFoodIds.push(ing.food_id);
      }
      momentRecipes.get(udm.id)!.push({
        recipe_id: r.id,
        is_private: true,
        ingredients,
      });
    }

    // 4. Load food context ONCE for all moments — this is the key efficiency gain
    const sharedContext = await loadFoodsAndGroupsContext(supabaseAdmin, allFoodIds);

    // 5. Balance each moment using the shared context
    const rowsDietPlan: Array<{ id: number | string; grams: number }> = [];
    const rowsPrivate: Array<{ id: number | string; grams: number }> = [];
    let momentsProcessed = 0;
    let recipesProcessed = 0;

    for (const udm of userDayMeals) {
      const recipes = momentRecipes.get(udm.id) || [];
      if (!recipes.length) continue;

      const target = {
        proteins: safeNumber(udm.target_proteins, 0),
        carbs: safeNumber(udm.target_carbs, 0),
        fats: safeNumber(udm.target_fats, 0),
      };

      const balancedResults = await balanceRecipesWithSharedContext({
        supabaseAdmin,
        recipes,
        targets: target,
        context: sharedContext,
      });

      for (const recipe of balancedResults) {
        for (const row of recipe.ingredients) {
          if (!row.ingredient_row_id) continue;
          if (row.is_private) {
            rowsPrivate.push({ id: row.ingredient_row_id, grams: row.grams });
          } else {
            rowsDietPlan.push({ id: row.ingredient_row_id, grams: row.grams });
          }
        }
      }

      momentsProcessed++;
      recipesProcessed += balancedResults.length;
    }

    // 6. Single bulk write for all moments combined
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
      moments_processed: momentsProcessed,
      recipes_processed: recipesProcessed,
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
