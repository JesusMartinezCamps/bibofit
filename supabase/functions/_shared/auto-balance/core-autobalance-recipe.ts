import { balanceRecipeCore, safeNumber } from "./core.ts";
import {
  enrichIngredientsForCore,
  loadFoodsAndGroupsContext,
  type createAdminClient,
} from "./adapters.ts";
import type {
  BalanceRecipeRequest,
  BalanceRecipeResult,
  BalancerIngredientInput,
  BalancerOptions,
  MacroTargets,
} from "./types.ts";

type SupabaseAdminClient = ReturnType<typeof createAdminClient>;

const normalizeIngredientInput = (
  ingredient: any,
  recipeMeta: { recipe_id?: number | string; is_private?: boolean } = {},
): BalancerIngredientInput | null => {
  if (!ingredient || ingredient.food_id == null) return null;
  return {
    food_id: ingredient.food_id,
    quantity: safeNumber(ingredient.quantity ?? ingredient.grams, 0),
    grams: safeNumber(ingredient.grams ?? ingredient.quantity, 0),
    ingredient_row_id: ingredient.ingredient_row_id ?? ingredient.id,
    recipe_id: ingredient.recipe_id ?? recipeMeta.recipe_id,
    is_private: ingredient.is_private ?? recipeMeta.is_private,
    locked: !!ingredient.locked,
    minQty: ingredient.minQty,
    maxQty: ingredient.maxQty,
    group_name: ingredient.group_name,
    macro_role: ingredient.macro_role,
  };
};

const normalizeRecipeRequest = (recipe: BalanceRecipeRequest): BalanceRecipeRequest => {
  const normalizedIngredients = (recipe.ingredients || [])
    .map((ingredient) => normalizeIngredientInput(ingredient, { recipe_id: recipe.recipe_id, is_private: recipe.is_private }))
    .filter(Boolean) as BalancerIngredientInput[];

  return {
    recipe_id: recipe.recipe_id,
    is_private: !!recipe.is_private,
    ingredients: normalizedIngredients,
  };
};

const normalizeTargets = (targets: any): MacroTargets => ({
  proteins: safeNumber(targets?.target_proteins ?? targets?.proteins, 0),
  carbs: safeNumber(targets?.target_carbs ?? targets?.carbs, 0),
  fats: safeNumber(targets?.target_fats ?? targets?.fats, 0),
});

export const normalizeRecipeTargets = normalizeTargets;

export const normalizeLooseIngredients = (ingredients: any[]): BalancerIngredientInput[] =>
  (Array.isArray(ingredients) ? ingredients : [])
    .map((ingredient) => normalizeIngredientInput(ingredient))
    .filter(Boolean) as BalancerIngredientInput[];

export const balanceSingleRecipeIngredients = async ({
  supabaseAdmin,
  ingredients,
  targets,
  options = {},
}: {
  supabaseAdmin: SupabaseAdminClient;
  ingredients: BalancerIngredientInput[];
  targets: MacroTargets;
  options?: BalancerOptions;
}) => {
  const normalizedIngredients = normalizeLooseIngredients(ingredients);
  if (!normalizedIngredients.length) return [];

  const ctx = await loadFoodsAndGroupsContext(
    supabaseAdmin,
    normalizedIngredients.map((ingredient) => ingredient.food_id),
  );

  const enriched = enrichIngredientsForCore(normalizedIngredients, ctx);
  return balanceRecipeCore(enriched, normalizeTargets(targets), options);
};

export const balanceRecipesWithSharedContext = async ({
  supabaseAdmin,
  recipes,
  targets,
  options = {},
}: {
  supabaseAdmin: SupabaseAdminClient;
  recipes: BalanceRecipeRequest[];
  targets: MacroTargets;
  options?: BalancerOptions;
}): Promise<BalanceRecipeResult[]> => {
  const normalizedRecipes = recipes.map(normalizeRecipeRequest).filter((recipe) => recipe.ingredients.length > 0);
  if (!normalizedRecipes.length) return [];

  const allFoodIds = normalizedRecipes.flatMap((recipe) => recipe.ingredients.map((ingredient) => ingredient.food_id));
  const ctx = await loadFoodsAndGroupsContext(supabaseAdmin, allFoodIds);
  const normalizedTargets = normalizeTargets(targets);

  return normalizedRecipes.map((recipe) => {
    const enriched = enrichIngredientsForCore(recipe.ingredients, ctx);
    const balancedIngredients = balanceRecipeCore(enriched, normalizedTargets, options);
    return {
      recipe_id: recipe.recipe_id,
      is_private: recipe.is_private,
      ingredients: balancedIngredients,
    };
  });
};
