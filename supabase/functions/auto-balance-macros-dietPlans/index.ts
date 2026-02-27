import { corsHeaders, jsonResponse } from "../_shared/http/cors.ts";
import { safeNumber } from "../_shared/auto-balance/core.ts";
import { createAdminClient } from "../_shared/auto-balance/adapters.ts";
import { balanceRecipesWithSharedContext } from "../_shared/auto-balance/core-autobalance-recipe.ts";
import type { BalanceRecipeRequest } from "../_shared/auto-balance/types.ts";

type MealRecipeInput = {
  source_row_id?: number | string;
  recipe_id: number | string;
  ingredients?: Array<{ food_id: number | string; grams?: number | string; quantity?: number | string }>;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { user_id, tdee, macro_distribution, meals } = body ?? {};

    if (!user_id || !tdee || !macro_distribution || !Array.isArray(meals)) {
      return jsonResponse({
        success: false,
        error_code: "invalid_input",
        error: "Missing required parameters: user_id, tdee, macro_distribution, meals",
      }, 400);
    }

    const totalProteinGrams = (safeNumber(tdee) * (safeNumber(macro_distribution.protein) / 100)) / 4;
    const totalCarbsGrams = (safeNumber(tdee) * (safeNumber(macro_distribution.carbs) / 100)) / 4;
    const totalFatGrams = (safeNumber(tdee) * (safeNumber(macro_distribution.fat) / 100)) / 9;

    const mealTargetsById = new Map<string, { proteins: number; carbs: number; fats: number }>();
    for (const meal of meals) {
      const dayMealId = String(meal?.day_meal_id ?? "");
      if (!dayMealId) continue;
      mealTargetsById.set(dayMealId, {
        proteins: totalProteinGrams * (safeNumber(meal.protein_pct) / 100),
        carbs: totalCarbsGrams * (safeNumber(meal.carbs_pct) / 100),
        fats: totalFatGrams * (safeNumber(meal.fat_pct) / 100),
      });
    }

    const allRecipeIds = [...new Set(
      meals.flatMap((meal: any) => {
        const fromDetailed = Array.isArray(meal?.recipes)
          ? meal.recipes.map((recipe: MealRecipeInput) => String(recipe?.recipe_id ?? ""))
          : [];
        const fromLegacy = Array.isArray(meal?.recipe_ids)
          ? meal.recipe_ids.map(String)
          : [];
        return [...fromDetailed, ...fromLegacy].filter(Boolean);
      }),
    )];

    if (!allRecipeIds.length) {
      return jsonResponse({ success: true, schema_version: "v1", results: [] });
    }

    const supabaseAdmin = createAdminClient();

    const { data: recipes, error: recipesError } = await supabaseAdmin
      .from("recipes")
      .select("id, recipe_ingredients(food_id, grams)")
      .in("id", allRecipeIds);

    if (recipesError) throw recipesError;

    const recipesById = new Map((recipes || []).map((r: any) => [String(r.id), r]));

    const results: any[] = [];

    for (const meal of meals) {
      const dayMealId = String(meal?.day_meal_id ?? "");
      const target = mealTargetsById.get(dayMealId);
      if (!target) continue;

      const detailedRecipes = Array.isArray(meal?.recipes) ? meal.recipes : [];
      const legacyRecipeIds = Array.isArray(meal?.recipe_ids) ? meal.recipe_ids.map(String).filter(Boolean) : [];

      const mealRecipesFromDetailed: (BalanceRecipeRequest & { source_row_id?: number | string })[] = detailedRecipes
        .filter((recipe: MealRecipeInput) => recipe?.recipe_id != null)
        .map((recipe: MealRecipeInput) => {
          const recipeId = String(recipe.recipe_id);
          const dbRecipe = recipesById.get(recipeId);
          const providedIngredients = Array.isArray(recipe?.ingredients)
            ? recipe.ingredients
            : [];
          const ingredients = providedIngredients.length > 0
            ? providedIngredients
            : (dbRecipe?.recipe_ingredients || []);

          return {
            recipe_id: recipeId,
            source_row_id: recipe?.source_row_id,
            is_private: false,
            ingredients,
          };
        })
        .filter((recipe) => Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0);

      // Keep backward compatibility with legacy recipe_ids, but avoid duplicating entries
      // already represented in detailed payload by the same source recipe id.
      const representedDetailedIds = new Set(
        mealRecipesFromDetailed.map((recipe) => String(recipe.recipe_id)),
      );

      const mealRecipesFromLegacy: (BalanceRecipeRequest & { source_row_id?: number | string })[] = legacyRecipeIds
        .filter((recipeId) => !representedDetailedIds.has(recipeId))
        .map((recipeId: string) => {
          const dbRecipe = recipesById.get(recipeId);
          return {
            recipe_id: recipeId,
            is_private: false,
            ingredients: dbRecipe?.recipe_ingredients || [],
          };
        })
        .filter((recipe) => Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0);

      const mealRecipes: (BalanceRecipeRequest & { source_row_id?: number | string })[] = [
        ...mealRecipesFromDetailed,
        ...mealRecipesFromLegacy,
      ];

      if (!mealRecipes.length) continue;

      const balancedByRecipe = await balanceRecipesWithSharedContext({
        supabaseAdmin,
        recipes: mealRecipes,
        targets: target,
        options: { profile: body?.profile },
      });

      results.push(
        ...balancedByRecipe.map((balancedRecipe, index) => ({
          recipe_id: balancedRecipe.recipe_id,
          source_row_id: mealRecipes[index]?.source_row_id,
          day_meal_id: meal.day_meal_id,
          ingredients: balancedRecipe.ingredients.map((ingredient) => ({ food_id: ingredient.food_id, grams: ingredient.grams })),
        })),
      );
    }

    return jsonResponse({
      success: true,
      schema_version: "v1",
      results,
    });
  } catch (error) {
    return jsonResponse({
      success: false,
      error_code: "internal_error",
      error: (error as any)?.message || String(error),
    }, 500);
  }
});
