export type ProfileName = "balanced" | "lowcarb_satiety" | "highcarb_performance";

export type MacroTargets = {
  proteins: number;
  carbs: number;
  fats: number;
};

export type BalancerFoodData = {
  food_unit?: string | null;
  proteins?: number | string | null;
  total_carbs?: number | string | null;
  total_fats?: number | string | null;
};

export type BalancerIngredientInput = {
  food_id: number | string;
  quantity?: number | string;
  grams?: number | string;
  recipe_id?: number | string;
  ingredient_row_id?: number | string;
  is_private?: boolean;
  locked?: boolean;
  minQty?: number;
  maxQty?: number;
  group_name?: string;
  macro_role?: string;
  food?: BalancerFoodData;
  food_data?: BalancerFoodData;
};

export type BalancerOptions = {
  profile?: ProfileName;
  stepGrams?: number;
  maxIterations?: number;
};

export type BalancedIngredient = {
  food_id: number | string;
  quantity: number;
  grams: number;
  ingredient_row_id?: number | string;
  recipe_id?: number | string;
  is_private?: boolean;
};

export type BalanceRecipeRequest = {
  recipe_id: number | string;
  is_private: boolean;
  ingredients: BalancerIngredientInput[];
};

export type BalanceRecipeResult = {
  recipe_id: number | string;
  is_private: boolean;
  ingredients: BalancedIngredient[];
};
