import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { BalancerIngredientInput } from "./types.ts";
import { safeNumber } from "./core.ts";

export const createAdminClient = () => {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
};

export const pickBestGroupByPriority = (groups: Array<{ id: string | number; name?: string }>) => {
  const scores: Record<string, number> = {
    "Verduras y Hortalizas": 5,
    "Frutas": 5,
    "Legumbres": 4,
    "Frutos secos": 3,
    "Semillas": 3,
  };

  let best: { id: string | number; score: number; numericId: number } | null = null;
  for (const g of groups) {
    const score = scores[g.name || ""] || 0;
    const numericId = Number.isFinite(Number(g.id)) ? Number(g.id) : Number.MAX_SAFE_INTEGER;
    if (!best || score > best.score || (score === best.score && numericId < best.numericId)) {
      best = { id: g.id, score, numericId };
    }
  }
  return best?.id ?? null;
};

export const loadFoodsAndGroupsContext = async (
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  foodIds: Array<string | number>,
) => {
  const uniqueFoodIds = [...new Set(foodIds.map(String))];

  const [{ data: foods, error: foodsError }, { data: groups, error: groupsError }, { data: links, error: linksError }] = await Promise.all([
    supabaseAdmin.from("food").select("id, food_unit, proteins, total_carbs, total_fats").in("id", uniqueFoodIds),
    supabaseAdmin.from("food_groups").select("id, name, macro_role"),
    supabaseAdmin.from("food_to_food_groups").select("food_id, food_group_id").in("food_id", uniqueFoodIds),
  ]);

  if (foodsError) throw foodsError;
  if (groupsError) throw groupsError;
  if (linksError) throw linksError;

  const foodsById = new Map((foods || []).map((f: any) => [String(f.id), f]));
  const groupsById = new Map((groups || []).map((g: any) => [String(g.id), g]));

  const linksByFood = new Map<string, string[]>();
  for (const row of links || []) {
    const fid = String(row.food_id);
    if (!linksByFood.has(fid)) linksByFood.set(fid, []);
    linksByFood.get(fid)!.push(String(row.food_group_id));
  }

  const groupByFoodId = new Map<string, any>();
  for (const fid of uniqueFoodIds) {
    const gids = linksByFood.get(String(fid)) || [];
    const candidates = gids.map((gid) => groupsById.get(String(gid))).filter(Boolean);
    const chosenId = pickBestGroupByPriority(candidates.map((c: any) => ({ id: c.id, name: c.name })));
    groupByFoodId.set(String(fid), chosenId ? groupsById.get(String(chosenId)) : null);
  }

  return { foodsById, groupByFoodId };
};

export const enrichIngredientsForCore = (
  ingredients: BalancerIngredientInput[],
  ctx: {
    foodsById: Map<string, any>;
    groupByFoodId: Map<string, any>;
  },
): BalancerIngredientInput[] => {
  return ingredients
    .filter((ing) => ing?.food_id != null)
    .map((ing) => {
      const food = ctx.foodsById.get(String(ing.food_id));
      const group = ctx.groupByFoodId.get(String(ing.food_id));
      const quantity = safeNumber(ing.quantity ?? ing.grams, 0);
      return {
        ...ing,
        quantity,
        grams: quantity,
        food_data: {
          food_unit: food?.food_unit,
          proteins: food?.proteins,
          total_carbs: food?.total_carbs,
          total_fats: food?.total_fats,
        },
        group_name: ing.group_name ?? group?.name ?? "",
        macro_role: ing.macro_role ?? group?.macro_role ?? "mixed",
      };
    });
};
