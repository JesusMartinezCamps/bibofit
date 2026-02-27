import type {
  BalancedIngredient,
  BalancerFoodData,
  BalancerIngredientInput,
  BalancerOptions,
  MacroTargets,
  ProfileName,
} from "./types.ts";

const PRESERVATION_PRIORITY: Record<string, number> = {
  "Verduras y Hortalizas": 5,
  "Frutas": 5,
  "Legumbres": 4,
  "Frutos secos": 3,
  "Semillas": 3,
};

const safeNum = (x: unknown, def = 0) => {
  const n = typeof x === "string" ? parseFloat(x) : x;
  return Number.isFinite(n) ? Number(n) : def;
};

const clamp = (x: number, lo: number, hi: number) => (x < lo ? lo : x > hi ? hi : x);

const quantizeDeltaNoDeadZone = (s: number, step: number) => {
  if (!Number.isFinite(s) || s === 0) return 0;
  if (step <= 0) return s;
  const sign = s < 0 ? -1 : 1;
  const abs = Math.abs(s);
  const qAbs = abs < step ? step : Math.round(abs / step) * step;
  return sign * qAbs;
};

const roundToStep = (x: number, step: number) => {
  if (!Number.isFinite(x)) return 0;
  if (step <= 0) return x;
  return Math.round(x / step) * step;
};

const normalizeProfile = (p: unknown): ProfileName => {
  const v = String(p || "balanced").toLowerCase();
  if (v === "lowcarb" || v === "lowcarb_satiety" || v === "lowcarb-satiety") return "lowcarb_satiety";
  if (v === "highcarb" || v === "highcarb_performance" || v === "highcarb-performance") return "highcarb_performance";
  return "balanced";
};

const isVegGroup = (groupName?: string) => groupName === "Verduras y Hortalizas";
const isLegumeGroup = (groupName?: string) => groupName === "Legumbres";
const isDairyOrEggsGroup = (groupName?: string) => groupName === "Lácteos" || groupName === "Huevos";

const perUnitMacros = (unitKind: "unidades" | "gramos", foodData?: BalancerFoodData) => {
  const per = unitKind === "unidades" ? 1 : 1 / 100;
  const ppu = safeNum(foodData?.proteins) * per;
  const cpu = safeNum(foodData?.total_carbs) * per;
  const fpu = safeNum(foodData?.total_fats) * per;
  return { ppu, cpu, fpu, kcalu: ppu * 4 + cpu * 4 + fpu * 9 };
};

type WorkIngredient = {
  food_id: number | string;
  ingredient_row_id?: number | string;
  recipe_id?: number | string;
  is_private?: boolean;

  baseQty: number;
  quantity: number;
  unitKind: "unidades" | "gramos";
  step: number;
  cap: number;

  ppu: number;
  cpu: number;
  fpu: number;
  vNorm2: number;

  role: string;
  groupName: string;
  preservation: number;
  isVeg: boolean;
  isLegume: boolean;
  isPriority: boolean;

  minQty: number;
  maxQty: number;
  locked: boolean;
};

export const balanceRecipeCore = (
  ingredients: BalancerIngredientInput[],
  targets: MacroTargets,
  options: BalancerOptions = {},
): BalancedIngredient[] => {
  const profile = normalizeProfile(options.profile);
  const MAX_ITERATIONS = options.maxIterations ?? 60;
  const CAL_TOL = 0.05;

  const MAX_STEP_GRAMS = options.stepGrams ?? 75;
  const MAX_STEP_UNITS = 3;

  const ALPHA_PRES = 0.05;
  const BETA_ROLE = 0.02;

  const GAMMA_ANCHOR_BASE = 1.25;
  const GAMMA_ANCHOR_PROTEIN = 2.0;
  const GAMMA_ANCHOR_FAT = 1.6;
  const GAMMA_ANCHOR_CARB = 1.25;
  const GAMMA_ANCHOR_VEG = 1.15;

  const VEG_SOFT_CAP = profile === "lowcarb_satiety" ? 450 : profile === "highcarb_performance" ? 350 : 400;
  const LAMBDA_VEG_VOLUME = 0.0025;

  const tp = safeNum(targets.proteins);
  const tc = safeNum(targets.carbs);
  const tf = safeNum(targets.fats);

  const MACRO_TOL_P = Math.max(2, tp * 0.05);
  const MACRO_TOL_C = Math.max(5, tc * 0.05);
  const MACRO_TOL_F = Math.max(2, tf * 0.05);
  const targetCalories = tp * 4 + tc * 4 + tf * 9;

  const strongProteinPresent = ingredients.some((ing) => {
    const role = String(ing.macro_role || "mixed");
    const groupName = String(ing.group_name || "");
    return role === "protein" && !isLegumeGroup(groupName);
  });

  const work: WorkIngredient[] = ingredients.map((ing) => {
    const unitKind: "unidades" | "gramos" = ing.food_data?.food_unit === "unidades" || ing.food?.food_unit === "unidades"
      ? "unidades"
      : "gramos";

    const groupName = String(ing.group_name || "");
    const role = String(ing.macro_role || "mixed");

    const isVeg = isVegGroup(groupName);
    const isLegume = isLegumeGroup(groupName);
    const isPriority = !!PRESERVATION_PRIORITY[groupName];

    const unitStep = isDairyOrEggsGroup(groupName) ? 1 : 0.5;
    const step = unitKind === "unidades" ? unitStep : 5;
    const cap = unitKind === "unidades" ? MAX_STEP_UNITS : MAX_STEP_GRAMS;

    const baseQty = safeNum(ing.quantity ?? ing.grams, 0);
    const { ppu, cpu, fpu } = perUnitMacros(unitKind, ing.food_data || ing.food);
    const vNorm2 = ppu * ppu + cpu * cpu + fpu * fpu;

    let minQty = safeNum(ing.minQty, 0);
    let maxQty = Number.isFinite(ing.maxQty) ? safeNum(ing.maxQty) : Infinity;

    if (isPriority && baseQty > 0) minQty = Math.max(minQty, unitKind === "unidades" ? unitStep : 5);
    if (unitKind === "gramos" && strongProteinPresent && role === "protein" && !isLegume) {
      minQty = Math.max(minQty, 50);
    }

    minQty = roundToStep(minQty, step);
    maxQty = Number.isFinite(maxQty) ? roundToStep(maxQty, step) : maxQty;

    return {
      food_id: ing.food_id,
      ingredient_row_id: ing.ingredient_row_id,
      recipe_id: ing.recipe_id,
      is_private: ing.is_private,
      baseQty,
      quantity: baseQty,
      unitKind,
      step,
      cap,
      ppu,
      cpu,
      fpu,
      vNorm2,
      role,
      groupName,
      preservation: PRESERVATION_PRIORITY[groupName] || 1,
      isVeg,
      isLegume,
      isPriority,
      minQty,
      maxQty,
      locked: !!ing.locked,
    };
  });

  let curP = 0;
  let curC = 0;
  let curF = 0;
  for (const w of work) {
    if (w.quantity <= 0) continue;
    curP += w.ppu * w.quantity;
    curC += w.cpu * w.quantity;
    curF += w.fpu * w.quantity;
  }
  let curK = curP * 4 + curC * 4 + curF * 9;

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const dP = tp - curP;
    const dC = tc - curC;
    const dF = tf - curF;

    const withinTol = Math.abs(dP) <= MACRO_TOL_P && Math.abs(dC) <= MACRO_TOL_C && Math.abs(dF) <= MACRO_TOL_F;
    const inCalTol = (Math.abs(curK - targetCalories) / (targetCalories || 1)) < CAL_TOL;
    if (withinTol && inCalTol) break;

    const aP = Math.abs(dP);
    const aC = Math.abs(dC);
    const aF = Math.abs(dF);

    let domRole: "protein" | "carb" | "fat";
    if (aP >= aC && aP >= aF) domRole = "protein";
    else if (aC >= aF) domRole = "carb";
    else domRole = "fat";

    let bestScore = Number.POSITIVE_INFINITY;
    let bestIdx = -1;
    let bestNewQty = 0;
    let bestApplied = 0;

    for (let i = 0; i < work.length; i++) {
      const ing = work[i];
      if (ing.locked || ing.vNorm2 === 0) continue;

      let s = (dP * ing.ppu + dC * ing.cpu + dF * ing.fpu) / (ing.vNorm2 + 1e-9);
      s = clamp(s, -ing.cap, ing.cap);

      const sQuant = quantizeDeltaNoDeadZone(s, ing.step);
      if (sQuant === 0) continue;

      let newQty = clamp(ing.quantity + sQuant, ing.minQty, ing.maxQty);
      newQty = roundToStep(newQty, ing.step);

      const applied = newQty - ing.quantity;
      if (applied === 0) continue;

      const dPp = dP - applied * ing.ppu;
      const dCp = dC - applied * ing.cpu;
      const dFp = dF - applied * ing.fpu;
      const err2 = dPp * dPp + dCp * dCp + dFp * dFp;

      const absApplied = Math.abs(applied);
      const presPenalty = ALPHA_PRES * ing.preservation * absApplied;
      const rolePenalty = ing.role !== domRole && ing.role !== "mixed" ? BETA_ROLE * absApplied : 0;

      const base = Math.max(1, ing.baseQty);
      const dev = (newQty - ing.baseQty) / base;

      const gamma =
        ing.role === "protein" ? GAMMA_ANCHOR_PROTEIN :
        ing.role === "fat" ? GAMMA_ANCHOR_FAT :
        ing.role === "carb" ? GAMMA_ANCHOR_CARB :
        ing.isVeg ? GAMMA_ANCHOR_VEG :
        GAMMA_ANCHOR_BASE;

      const anchorPenalty = gamma * dev * dev;

      let volumePenalty = 0;
      if (ing.isVeg && ing.unitKind === "gramos") {
        const over = newQty - VEG_SOFT_CAP;
        if (over > 0) volumePenalty = LAMBDA_VEG_VOLUME * over * over;
      }

      const score = err2 + presPenalty + rolePenalty + anchorPenalty + volumePenalty;

      if (score < bestScore) {
        bestScore = score;
        bestIdx = i;
        bestNewQty = newQty;
        bestApplied = applied;
      }
    }

    if (bestIdx === -1) {
      for (const ing of work) {
        if (ing.locked) continue;
        ing.cap = ing.unitKind === "gramos" ? Math.min(ing.cap + 10, 150) : Math.min(ing.cap + 1, 3);
      }
      continue;
    }

    const chosen = work[bestIdx];
    chosen.quantity = bestNewQty;
    curP += bestApplied * chosen.ppu;
    curC += bestApplied * chosen.cpu;
    curF += bestApplied * chosen.fpu;
    curK = curP * 4 + curC * 4 + curF * 9;
  }

  return work.map((ing) => {
    let finalQty = roundToStep(ing.quantity, ing.step);
    finalQty = clamp(finalQty, ing.minQty, Number.isFinite(ing.maxQty) ? ing.maxQty : Infinity);
    finalQty = roundToStep(finalQty, ing.step);

    if (ing.isPriority && ing.baseQty > 0 && finalQty === 0) {
      const minNonZero = ing.unitKind === "unidades" ? ing.step : 5;
      finalQty = roundToStep(Math.max(minNonZero, ing.minQty), ing.step);
    }

    const q = finalQty > 0 ? finalQty : 0;
    return {
      food_id: ing.food_id,
      quantity: q,
      grams: q,
      ingredient_row_id: ing.ingredient_row_id,
      recipe_id: ing.recipe_id,
      is_private: ing.is_private,
    };
  });
};

export const safeNumber = safeNum;
