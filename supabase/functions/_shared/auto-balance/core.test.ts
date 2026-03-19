import { balanceRecipeCore } from "./core.ts";

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

const toQtyMap = (rows: Array<{ food_id: string | number; quantity: number }>) =>
  new Map(rows.map((row) => [String(row.food_id), row.quantity]));

Deno.test("normaliza macro_role carbs y carb de forma equivalente", () => {
  const buildIngredients = (carbRole: string) => ([
    { food_id: "arroz", quantity: 120, group_name: "Cereales", macro_role: carbRole, food_data: { food_unit: "gramos", proteins: 7, total_carbs: 77, total_fats: 0.6 } },
    { food_id: "patata", quantity: 200, group_name: "Tubérculos y raíces", macro_role: carbRole, food_data: { food_unit: "gramos", proteins: 2, total_carbs: 17, total_fats: 0.1 } },
    { food_id: "lentejas", quantity: 80, group_name: "Legumbres", macro_role: "protein", food_data: { food_unit: "gramos", proteins: 25, total_carbs: 60, total_fats: 1 } },
    { food_id: "pollo", quantity: 140, group_name: "Carnes blancas", macro_role: "protein", food_data: { food_unit: "gramos", proteins: 31, total_carbs: 0, total_fats: 3.6 } },
  ]);

  const targets = { proteins: 55, carbs: 95, fats: 14 };
  const outCarbs = balanceRecipeCore(buildIngredients("carbs"), targets, {});
  const outCarb = balanceRecipeCore(buildIngredients("carb"), targets, {});

  const mapCarbs = toQtyMap(outCarbs);
  const mapCarb = toQtyMap(outCarb);
  for (const foodId of mapCarbs.keys()) {
    assert(mapCarbs.get(foodId) === mapCarb.get(foodId), `Cantidad distinta para ${foodId} con carbs vs carb`);
  }
});

Deno.test("si todos estan a cero mantiene presencia en verduras, fruta-unidad, cereal, legumbre y proteina", () => {
  const out = balanceRecipeCore([
    { food_id: "cebolla", quantity: 0, group_name: "Verduras y hortalizas", macro_role: "carbs", food_data: { food_unit: "gramos", proteins: 1.1, total_carbs: 9.3, total_fats: 0.1 } },
    { food_id: "pimiento", quantity: 0, group_name: "Verduras y hortalizas", macro_role: "carbs", food_data: { food_unit: "gramos", proteins: 1.0, total_carbs: 6.0, total_fats: 0.3 } },
    { food_id: "calabacin", quantity: 0, group_name: "Verduras y hortalizas", macro_role: "carbs", food_data: { food_unit: "gramos", proteins: 1.2, total_carbs: 3.1, total_fats: 0.2 } },
    { food_id: "tomate", quantity: 0, group_name: "Verduras y hortalizas", macro_role: "carbs", food_data: { food_unit: "gramos", proteins: 0.9, total_carbs: 3.9, total_fats: 0.2 } },
    { food_id: "arroz", quantity: 0, group_name: "Cereales", macro_role: "carbs", food_data: { food_unit: "gramos", proteins: 7.0, total_carbs: 77, total_fats: 0.6 } },
    { food_id: "lentejas", quantity: 0, group_name: "Legumbres", macro_role: "protein", food_data: { food_unit: "gramos", proteins: 25, total_carbs: 60, total_fats: 1 } },
    { food_id: "pollo", quantity: 0, group_name: "Carnes blancas", macro_role: "protein", food_data: { food_unit: "gramos", proteins: 31, total_carbs: 0, total_fats: 3.6 } },
    { food_id: "platano", quantity: 0, group_name: "Frutas", macro_role: "carbs", food_data: { food_unit: "unidades", proteins: 1.3, total_carbs: 27, total_fats: 0.3 } },
  ], { proteins: 40, carbs: 80, fats: 15 }, {});

  const map = toQtyMap(out);
  assert((map.get("cebolla") || 0) >= 20, "Cebolla deberia mantener presencia");
  assert((map.get("pimiento") || 0) >= 20, "Pimiento deberia mantener presencia");
  assert((map.get("calabacin") || 0) >= 20, "Calabacin deberia mantener presencia");
  assert((map.get("tomate") || 0) >= 20, "Tomate deberia mantener presencia");
  assert((map.get("platano") || 0) >= 1, "Platano en unidades deberia ser >= 1");
  assert((map.get("arroz") || 0) >= 15, "Cereal deberia mantener presencia minima");
  assert((map.get("lentejas") || 0) >= 15, "Legumbre deberia mantener presencia minima");
  assert((map.get("pollo") || 0) >= 50, "Proteina principal deberia mantener presencia minima");
});

Deno.test("reduce desbalance extremo entre verduras del mismo grupo", () => {
  const out = balanceRecipeCore([
    { food_id: "cebolla", quantity: 200, group_name: "Verduras y hortalizas", macro_role: "carbs", food_data: { food_unit: "gramos", proteins: 1.1, total_carbs: 9.3, total_fats: 0.1 } },
    { food_id: "pimiento", quantity: 20, group_name: "Verduras y hortalizas", macro_role: "carbs", food_data: { food_unit: "gramos", proteins: 1.0, total_carbs: 6.0, total_fats: 0.3 } },
    { food_id: "arroz", quantity: 80, group_name: "Cereales", macro_role: "carbs", food_data: { food_unit: "gramos", proteins: 7.0, total_carbs: 77, total_fats: 0.6 } },
    { food_id: "lentejas", quantity: 40, group_name: "Legumbres", macro_role: "protein", food_data: { food_unit: "gramos", proteins: 25, total_carbs: 60, total_fats: 1 } },
    { food_id: "pollo", quantity: 120, group_name: "Carnes blancas", macro_role: "protein", food_data: { food_unit: "gramos", proteins: 31, total_carbs: 0, total_fats: 3.6 } },
  ], { proteins: 40, carbs: 60, fats: 12 }, {});

  const map = toQtyMap(out);
  const onion = map.get("cebolla") || 0;
  const pepper = map.get("pimiento") || 1;
  const ratio = onion / pepper;
  assert(ratio <= 2.25, `Ratio verduras demasiado alta: ${ratio.toFixed(2)}`);
});

Deno.test("aplica minimo de frutos secos y semillas y mantiene unidad minima", () => {
  const out = balanceRecipeCore([
    { food_id: "avellanas", quantity: 0, group_name: "Frutos secos", macro_role: "fats", food_data: { food_unit: "gramos", proteins: 15, total_carbs: 10, total_fats: 61 } },
    { food_id: "chia", quantity: 0, group_name: "Semillas", macro_role: "fats", food_data: { food_unit: "gramos", proteins: 17, total_carbs: 42, total_fats: 31 } },
    { food_id: "huevo", quantity: 0, group_name: "Huevos", macro_role: "protein", food_data: { food_unit: "unidades", proteins: 6.2, total_carbs: 0.4, total_fats: 5.3 } },
    { food_id: "pollo", quantity: 100, group_name: "Carnes blancas", macro_role: "protein", food_data: { food_unit: "gramos", proteins: 31, total_carbs: 0, total_fats: 3.6 } },
    { food_id: "arroz", quantity: 100, group_name: "Cereales", macro_role: "carbs", food_data: { food_unit: "gramos", proteins: 7, total_carbs: 77, total_fats: 0.6 } },
  ], { proteins: 40, carbs: 80, fats: 10 }, {});

  const map = toQtyMap(out);
  assert((map.get("avellanas") || 0) >= 15, "Frutos secos deberian quedar en >= 15g");
  assert((map.get("chia") || 0) >= 5, "Semillas deberian quedar en >= 5g");
  assert((map.get("huevo") || 0) >= 1, "Unidades deberian quedar en >= 1");
});
