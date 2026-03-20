import type {
  BalancedIngredient,
  BalancerFoodData,
  BalancerIngredientInput,
  BalancerOptions,
  MacroTargets,
  ProfileName,
} from "./types.ts";

const PRESERVATION_PRIORITY_BY_KEY: Record<string, number> = {
  "verduras y hortalizas": 5,
  "frutas": 5,
  "legumbres": 4,
  "frutos secos": 3,
  "semillas": 3,
};

const CANONICAL_GROUP_BY_KEY: Record<string, string> = {
  "verduras y hortalizas": "Verduras y Hortalizas",
  "frutas": "Frutas",
  "legumbres": "Legumbres",
  "frutos secos": "Frutos secos",
  "semillas": "Semillas",
  "lacteos": "Lácteos",
  "huevos": "Huevos",
  "cereales": "Cereales",
  "pseudocereales": "Pseudocereales",
  "tuberculos y raices": "Tubérculos y raíces",
  "panes": "Panes",
  "pastas": "Pastas",
};

const normalizeTextKey = (value: unknown) =>
  String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();

const canonicalGroupName = (groupName?: string) => {
  const key = normalizeTextKey(groupName);
  return CANONICAL_GROUP_BY_KEY[key] || String(groupName || "").trim();
};

const normalizeMacroRole = (role?: string): "protein" | "carb" | "fat" | "mixed" => {
  const key = normalizeTextKey(role);
  if (key === "protein" || key === "proteins" || key === "proteina" || key === "proteinas") return "protein";
  if (key === "carb" || key === "carbs" || key === "carbohidrato" || key === "carbohidratos" || key === "hidratos") return "carb";
  if (key === "fat" || key === "fats" || key === "grasa" || key === "grasas" || key === "lipidos" || key === "lipids") return "fat";
  return "mixed";
};

const preservationScore = (groupName?: string) => PRESERVATION_PRIORITY_BY_KEY[normalizeTextKey(groupName)] || 1;

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

const squaredMacroError = (
  dP: number,
  dC: number,
  dF: number,
  targets: { tp: number; tc: number; tf: number },
  tolerances: { p: number; c: number; f: number },
) => {
  let wP = 1 + Math.abs(dP) / (targets.tp + 10);
  let wC = 1 + Math.abs(dC) / (targets.tc + 10);
  let wF = 1 + Math.abs(dF) / (targets.tf + 10);

  // Cuando hay exceso real de macro, priorizar su reducción.
  if (dC < -tolerances.c) wC *= 12;
  if (dP < -tolerances.p) wP *= 6;
  if (dF < -tolerances.f) wF *= 6;

  return wP * dP * dP + wC * dC * dC + wF * dF * dF;
};

const normalizeProfile = (p: unknown): ProfileName => {
  const v = String(p || "balanced").toLowerCase();
  if (v === "lowcarb" || v === "lowcarb_satiety" || v === "lowcarb-satiety") return "lowcarb_satiety";
  if (v === "highcarb" || v === "highcarb_performance" || v === "highcarb-performance") return "highcarb_performance";
  return "balanced";
};

const isVegGroup = (groupName?: string) => canonicalGroupName(groupName) === "Verduras y Hortalizas";
const isFruitGroup = (groupName?: string) => canonicalGroupName(groupName) === "Frutas";
const isLegumeGroup = (groupName?: string) => canonicalGroupName(groupName) === "Legumbres";
const isNutsGroup = (groupName?: string) => canonicalGroupName(groupName) === "Frutos secos";
const isSeedsGroup = (groupName?: string) => canonicalGroupName(groupName) === "Semillas";
const isDairyOrEggsGroup = (groupName?: string) => {
  const normalized = canonicalGroupName(groupName);
  return normalized === "Lácteos" || normalized === "Huevos";
};
const isCerealLikeGroup = (groupName?: string) => {
  const normalized = canonicalGroupName(groupName);
  return normalized === "Cereales" ||
    normalized === "Pseudocereales" ||
    normalized === "Tubérculos y raíces" ||
    normalized === "Panes" ||
    normalized === "Pastas";
};

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
  isFruit: boolean;
  isLegume: boolean;
  isNut: boolean;
  isSeed: boolean;
  isCerealLike: boolean;
  isPriority: boolean;

  minQty: number;
  softMinQty: number;
  softMinWeight: number;
  maxQty: number;
  locked: boolean;
};

// P1: Grupo de ingredientes que se ajustan proporcionalmente juntos.
// La clave agrupa por (groupName, unitKind) para que las unidades sean compatibles.
// Los ingredientes locked o con vNorm2=0 quedan excluidos (no participan en el ajuste).
type WorkGroup = {
  key: string;
  indices: number[]; // índices en work[]
};

const buildGroups = (work: WorkIngredient[]): WorkGroup[] => {
  const map = new Map<string, number[]>();
  for (let i = 0; i < work.length; i++) {
    const ing = work[i];
    if (ing.locked || ing.vNorm2 === 0) continue;
    // Ingredientes sin groupName forman su propio grupo individual
    const key = ing.groupName ? `${ing.groupName}:${ing.unitKind}` : `__solo_${i}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(i);
  }
  return [...map.entries()].map(([key, indices]) => ({ key, indices }));
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

  // P3: threshold de contribución calórica para considerar que un ingrediente
  // "participa" en un macro. Legumbres aportan tanto proteína como hidratos,
  // por lo que no deben penalizarse cuando el déficit dominante es de CH.
  const DUAL_ROLE_KCAL_THRESHOLD = 0.20;

  const VEG_SOFT_CAP = profile === "lowcarb_satiety" ? 450 : profile === "highcarb_performance" ? 350 : 400;
  const LAMBDA_VEG_VOLUME = 0.0025;
  const LAMBDA_VEG_BALANCE = 9;
  const VEG_MAX_RATIO = 2.25;
  const VEG_BALANCE_BLEND = 0.65;
  const LAMBDA_SOFT_MIN_BASE = 0.8;
  const LAMBDA_SOFT_MIN_UNIT = 1.6;
  const LAMBDA_SOFT_MIN_GROUP = 1.2;

  const UNIT_SOFT_MIN = 0.5;
  const FRUIT_UNIT_SOFT_MIN = 1;
  const NUTS_SOFT_MIN_GRAMS = 15;
  const SEEDS_SOFT_MIN_GRAMS = 5;
  const LEGUME_SOFT_MIN_GRAMS = 15;
  const CEREAL_SOFT_MIN_GRAMS = 15;

  // ── Fase 0: Volumen culinario mínimo para verduras ───────────────────────────
  // Calibrado para que "3 verduras en un plato de 500 kcal" den ~35g c/u,
  // y "1 verdura sola" dé ~60g. Se amortigua con sqrt para evitar explosión
  // en dietas hipercalóricas. Aplica solo si el template tenía cantidad absurda.
  const VEG_VOL_FLOOR = 20;      // mínimo absoluto (ajo, perejil, especias)
  const VEG_VOL_BASE = 60;       // gramos objetivo a 500 kcal con 1 verdura
  const VEG_VOL_KCAL_REF = 500;  // referencia de calibrado
  const VEG_VOL_CEILING = 120;   // máximo que imponemos como mínimo culinario

  // ── P2: Pre-solve proporcional por rol macro ─────────────────────────────────
  // Escala los pools de proteína/hidrato/grasa antes del bucle greedy,
  // para que éste solo tenga que hacer fine-tuning fino.
  const P2_MAX_SCALE = 4.0;   // cap del factor de escala (evita explosiones)
  const P2_MIN_SCALE = 0.25;  // cap inferior (evita colapsos)

  // ── P4: Cap de dominancia macro ──────────────────────────────────────────────
  // Penaliza grupos que ya cubren >75% de un macro cuando hay múltiples fuentes.
  // Ej: en "arroz + patata" evita que el arroz se lleve el 100% de los hidratos.
  const P4_MAX_SHARE = 0.75;  // share máximo sin penalización
  const LAMBDA_P4 = 1.5;      // peso en la función de coste (unidades: g²/g² = adim.)
  const P4_MIN_SOURCE_SHARE = 0.10; // threshold para "contar" un grupo como fuente

  const tp = safeNum(targets.proteins);
  const tc = safeNum(targets.carbs);
  const tf = safeNum(targets.fats);

  const MACRO_TOL_P = Math.max(2, tp * 0.05);
  const MACRO_TOL_C = Math.max(5, tc * 0.05);
  const MACRO_TOL_F = Math.max(2, tf * 0.05);
  const targetCalories = tp * 4 + tc * 4 + tf * 9;

  const strongProteinPresent = ingredients.some((ing) => {
    const role = normalizeMacroRole(String(ing.macro_role || "mixed"));
    const groupName = canonicalGroupName(String(ing.group_name || ""));
    return role === "protein" && !isLegumeGroup(groupName);
  });

  const work: WorkIngredient[] = ingredients.map((ing) => {
    const unitKind: "unidades" | "gramos" = ing.food_data?.food_unit === "unidades" || ing.food?.food_unit === "unidades"
      ? "unidades"
      : "gramos";

    const groupName = canonicalGroupName(String(ing.group_name || ""));
    const role = normalizeMacroRole(String(ing.macro_role || "mixed"));

    const isVeg = isVegGroup(groupName);
    const isFruit = isFruitGroup(groupName);
    const isLegume = isLegumeGroup(groupName);
    const isNut = isNutsGroup(groupName);
    const isSeed = isSeedsGroup(groupName);
    const isCerealLike = isCerealLikeGroup(groupName);
    const isPriority = preservationScore(groupName) > 1;

    const unitStep = isDairyOrEggsGroup(groupName) ? 1 : 0.5;
    const step = unitKind === "unidades" ? unitStep : 5;
    const cap = unitKind === "unidades" ? MAX_STEP_UNITS : MAX_STEP_GRAMS;

    const baseQty = safeNum(ing.quantity ?? ing.grams, 0);
    const { ppu, cpu, fpu } = perUnitMacros(unitKind, ing.food_data || ing.food);
    const vNorm2 = ppu * ppu + cpu * cpu + fpu * fpu;

    let minQty = safeNum(ing.minQty, 0);
    let maxQty = safeNum(ing.maxQty, Infinity);
    let softMinQty = 0;
    let softMinWeight = LAMBDA_SOFT_MIN_BASE;

    if (isPriority && baseQty > 0) minQty = Math.max(minQty, unitKind === "unidades" ? unitStep : 5);
    if (unitKind === "gramos" && strongProteinPresent && role === "protein" && !isLegume) {
      minQty = Math.max(minQty, 50);
    }
    if (unitKind === "gramos" && isNut) minQty = Math.max(minQty, NUTS_SOFT_MIN_GRAMS);
    if (unitKind === "gramos" && isSeed) minQty = Math.max(minQty, SEEDS_SOFT_MIN_GRAMS);

    if (!ing.locked) {
      if (unitKind === "unidades") {
        softMinQty = Math.max(softMinQty, isFruit ? FRUIT_UNIT_SOFT_MIN : UNIT_SOFT_MIN);
        softMinWeight = Math.max(softMinWeight, LAMBDA_SOFT_MIN_UNIT);
      }
      if (unitKind === "gramos" && isNut) {
        softMinQty = Math.max(softMinQty, NUTS_SOFT_MIN_GRAMS);
        softMinWeight = Math.max(softMinWeight, LAMBDA_SOFT_MIN_GROUP);
      }
      if (unitKind === "gramos" && isSeed) {
        softMinQty = Math.max(softMinQty, SEEDS_SOFT_MIN_GRAMS);
        softMinWeight = Math.max(softMinWeight, LAMBDA_SOFT_MIN_GROUP);
      }
      if (unitKind === "gramos" && isLegume) {
        softMinQty = Math.max(softMinQty, LEGUME_SOFT_MIN_GRAMS);
        softMinWeight = Math.max(softMinWeight, LAMBDA_SOFT_MIN_GROUP);
      }
      if (unitKind === "gramos" && isCerealLike) {
        softMinQty = Math.max(softMinQty, CEREAL_SOFT_MIN_GRAMS);
        softMinWeight = Math.max(softMinWeight, LAMBDA_SOFT_MIN_GROUP);
      }
    }

    minQty = roundToStep(minQty, step);
    maxQty = Number.isFinite(maxQty) ? roundToStep(maxQty, step) : maxQty;
    softMinQty = roundToStep(
      clamp(softMinQty, minQty, Number.isFinite(maxQty) ? maxQty : softMinQty),
      step,
    );

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
      preservation: preservationScore(groupName),
      isVeg,
      isFruit,
      isLegume,
      isNut,
      isSeed,
      isCerealLike,
      isPriority,
      minQty,
      softMinQty,
      softMinWeight,
      maxQty,
      locked: !!ing.locked,
    };
  });

  // ────────────────────────────────────────────────────────────────────────────
  // FASE 0 — Pre-sizing culinario de verduras
  // Garantiza que ninguna verdura de la receta quede con una cantidad absurda
  // (ej. 10g de cebolla). Se ejecuta antes de la optimización macro.
  // ────────────────────────────────────────────────────────────────────────────
  if (targetCalories > 0) {
    const vegIngredients = work.filter(
      (w) => w.isVeg && !w.locked && w.unitKind === "gramos",
    );
    const numVegs = vegIngredients.length;

    if (numVegs > 0) {
      // sqrt en ambos ejes: amortigua crecimiento en dietas altas en calorías
      // y distribuye la "masa vegetal" equitativamente entre todas las verduras.
      const kcalScale = Math.sqrt(Math.max(1, targetCalories / VEG_VOL_KCAL_REF));
      const vegMinRaw = VEG_VOL_BASE * kcalScale / Math.sqrt(numVegs);
      const vegMin = roundToStep(clamp(vegMinRaw, VEG_VOL_FLOOR, VEG_VOL_CEILING), 5);

      for (const w of vegIngredients) {
        if (w.quantity < vegMin) {
          // También aplica cuando venían en 0g: si están en la receta, deben "existir".
          w.quantity = vegMin;
          w.baseQty = Math.max(w.baseQty, vegMin);
        }
        // Siempre proteger el mínimo absoluto (ej: 20g de ajo si el template dice 5g)
        w.minQty = Math.max(w.minQty, roundToStep(VEG_VOL_FLOOR, w.step));
        w.softMinQty = Math.max(w.softMinQty, vegMin);
        w.softMinWeight = Math.max(w.softMinWeight, LAMBDA_SOFT_MIN_GROUP);
      }

      // Reequilibrio inicial para evitar plantillas con desbalance extremo entre verduras.
      const vegByGroup = new Map<string, WorkIngredient[]>();
      for (const w of vegIngredients) {
        const key = `${w.groupName}:${w.unitKind}`;
        if (!vegByGroup.has(key)) vegByGroup.set(key, []);
        vegByGroup.get(key)!.push(w);
      }

      for (const groupItems of vegByGroup.values()) {
        if (groupItems.length < 2) continue;
        const positives = groupItems.filter((w) => w.quantity > 0);
        if (positives.length < 2) continue;

        const maxQty = Math.max(...positives.map((w) => w.quantity));
        const minQty = Math.max(1, Math.min(...positives.map((w) => w.quantity)));
        if (maxQty / minQty <= VEG_MAX_RATIO) continue;

        const equalTarget = groupItems.reduce((sum, w) => sum + w.quantity, 0) / groupItems.length;
        for (const w of groupItems) {
          const blended = w.quantity * (1 - VEG_BALANCE_BLEND) + equalTarget * VEG_BALANCE_BLEND;
          const normalized = roundToStep(
            clamp(blended, w.minQty, Number.isFinite(w.maxQty) ? w.maxQty : blended),
            w.step,
          );
          w.quantity = normalized;
          w.baseQty = Math.max(w.baseQty, normalized);
        }
      }
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // FASE 0B — Presencia culinaria mínima (suave)
  // Si el alimento está en la receta, intentamos evitar que quede en 0 absoluto.
  // ────────────────────────────────────────────────────────────────────────────
  {
    const hasUnlockedLegume = work.some((w) => !w.locked && w.unitKind === "gramos" && w.isLegume);
    const hasUnlockedCereal = work.some((w) => !w.locked && w.unitKind === "gramos" && w.isCerealLike);

    for (const w of work) {
      if (w.locked) continue;

      if (w.unitKind === "gramos") {
        if (w.isLegume && hasUnlockedCereal) {
          w.softMinQty = Math.max(w.softMinQty, LEGUME_SOFT_MIN_GRAMS);
          w.softMinWeight = Math.max(w.softMinWeight, LAMBDA_SOFT_MIN_GROUP);
        }
        if (w.isCerealLike && hasUnlockedLegume) {
          w.softMinQty = Math.max(w.softMinQty, CEREAL_SOFT_MIN_GRAMS);
          w.softMinWeight = Math.max(w.softMinWeight, LAMBDA_SOFT_MIN_GROUP);
        }
      }

      if (w.softMinQty <= 0 || w.quantity >= w.softMinQty) continue;

      const seeded = roundToStep(
        clamp(w.softMinQty, w.minQty, Number.isFinite(w.maxQty) ? w.maxQty : w.softMinQty),
        w.step,
      );
      if (seeded <= w.quantity) continue;

      w.quantity = seeded;
      // Mantener un ancla >0 reduce la probabilidad de "colapso a cero" posterior.
      w.baseQty = Math.max(w.baseQty, seeded);
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // FASE P2 — Pre-solve proporcional por rol macro
  // Escala cada pool de macros (protein/carb/fat) para aproximarse a los targets
  // antes de que el bucle greedy empiece. El bucle solo tendrá que hacer ajustes
  // finos, lo que mejora la convergencia y la distribución entre ingredientes.
  // ────────────────────────────────────────────────────────────────────────────
  {
    const macroRoles = [
      {
        role: "protein" as const,
        target: tp,
        getMacro: (w: WorkIngredient) => w.ppu,
      },
      {
        role: "carb" as const,
        target: tc,
        getMacro: (w: WorkIngredient) => w.cpu,
      },
      {
        role: "fat" as const,
        target: tf,
        getMacro: (w: WorkIngredient) => w.fpu,
      },
    ];

    for (const { role, target, getMacro } of macroRoles) {
      if (target <= 0) continue;

      // Pool ajustable: no bloqueado, en gramos, con el rol asignado y cantidad > 0
      const pool = work.filter(
        (w) => !w.locked && w.unitKind === "gramos" && w.role === role && w.quantity > 0,
      );
      if (pool.length === 0) continue;

      // Contribución fija al macro: bloqueados + ingredientes de otro rol
      const fixedContrib = work
        .filter((w) => w.locked || w.role !== role || w.unitKind !== "gramos")
        .reduce((s, w) => s + getMacro(w) * w.quantity, 0);

      const remainingTarget = target - fixedContrib;
      if (remainingTarget <= 0) continue; // Ya cubierto por otros ingredientes

      const poolCurrentContrib = pool.reduce((s, w) => s + getMacro(w) * w.quantity, 0);
      if (poolCurrentContrib <= 0) continue;

      const rawScale = remainingTarget / poolCurrentContrib;
      const scale = clamp(rawScale, P2_MIN_SCALE, P2_MAX_SCALE);

      for (const w of pool) {
        const scaled = w.quantity * scale;
        const maxBound = Number.isFinite(w.maxQty) ? w.maxQty : scaled;
        const clamped = clamp(scaled, w.minQty, maxBound);
        const rounded = roundToStep(clamped, w.step);
        w.quantity = rounded;
        // Nueva ancla: el greedy refina desde aquí, no lucha contra P2.
        w.baseQty = rounded;
      }
    }
  }

  // Totales macro tras Fase 0 + P2 (el bucle greedy parte de aquí).
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

  // P1: construir grupos una sola vez — los caps individuales se leen
  // dinámicamente en cada iteración, por lo que la expansión de caps funciona igual.
  const groups = buildGroups(work);

  // ────────────────────────────────────────────────────────────────────────────
  // BUCLE GREEDY (P1 + P3 + P4)
  // ────────────────────────────────────────────────────────────────────────────
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

    const domTarget = domRole === "protein" ? tp : domRole === "carb" ? tc : tf;

    // P4: contamos cuántos grupos distintos tienen contribución significativa
    // al macro dominante. Si hay ≥2, activamos la penalización de dominancia.
    let numDomSources = 0;
    if (domTarget > 0) {
      const seenGroups = new Set<string>();
      for (const w of work) {
        if (w.locked || w.vNorm2 === 0) continue;
        const contrib = domRole === "protein" ? w.ppu * w.quantity :
                        domRole === "carb"    ? w.cpu * w.quantity :
                        w.fpu * w.quantity;
        if (contrib / domTarget >= P4_MIN_SOURCE_SHARE) {
          seenGroups.add(w.groupName || `__solo_${w.food_id}`);
        }
      }
      numDomSources = seenGroups.size;
    }

    let bestScore = Number.POSITIVE_INFINITY;
    let bestGrpIdx = -1;
    let bestNewQtys: number[] = [];
    let bestAppliedDeltas: number[] = [];

    for (let gi = 0; gi < groups.length; gi++) {
      const grp = groups[gi];

      // Macros agregados del grupo, ponderados por cantidad actual de cada miembro.
      // Esto convierte el grupo en un "ingrediente virtual" con el perfil promedio.
      let grpTotalQty = 0;
      let grpP = 0, grpC = 0, grpF = 0;
      for (const idx of grp.indices) {
        const m = work[idx];
        grpTotalQty += m.quantity;
        grpP += m.ppu * m.quantity;
        grpC += m.cpu * m.quantity;
        grpF += m.fpu * m.quantity;
      }

      // Macros por unidad efectivos del grupo (promedio ponderado).
      // Si todos los miembros tienen qty=0 usamos promedio simple para no perder el grupo.
      const n = grp.indices.length;
      const ePpu = grpTotalQty > 0 ? grpP / grpTotalQty : grp.indices.reduce((s, idx) => s + work[idx].ppu, 0) / n;
      const eCpu = grpTotalQty > 0 ? grpC / grpTotalQty : grp.indices.reduce((s, idx) => s + work[idx].cpu, 0) / n;
      const eFpu = grpTotalQty > 0 ? grpF / grpTotalQty : grp.indices.reduce((s, idx) => s + work[idx].fpu, 0) / n;
      const eVnorm2 = ePpu * ePpu + eCpu * eCpu + eFpu * eFpu;

      if (eVnorm2 === 0) continue;

      // Proyección óptima: cuántas "unidades de grupo" añadir/quitar para reducir el error.
      let s = (dP * ePpu + dC * eCpu + dF * eFpu) / (eVnorm2 + 1e-9);

      // Cap: el miembro más restrictivo marca el límite del grupo.
      // Cada miembro recibirá share × s ≤ s, por lo que ninguno supera su cap individual.
      const grpCap = grp.indices.reduce((mn, idx) => Math.min(mn, work[idx].cap), Infinity);
      s = clamp(s, -grpCap, grpCap);

      // Cuantizar al step mínimo del grupo (para grupos de gramos siempre será 5).
      const grpStep = grp.indices.reduce((mn, idx) => Math.min(mn, work[idx].step), Infinity);
      const sQuant = quantizeDeltaNoDeadZone(s, grpStep);
      if (sQuant === 0) continue;

      // Distribución proporcional del delta entre miembros.
      // Cada miembro recibe sQuant × (su_qty / total_qty), preservando las proporciones
      // de la receta plantilla. Para grupos con qty=0, se reparte a partes iguales.
      const isVegGramGroup = grp.indices.every((idx) => work[idx].isVeg && work[idx].unitKind === "gramos");
      let shares: number[];

      if (isVegGramGroup) {
        // Para verduras evitamos "arrastrar" desbalances 200g vs 20g.
        // cbrt suaviza aún más la ventaja del ingrediente grande.
        const weighted = grp.indices.map((idx) => {
          const w = work[idx];
          const anchor = Math.max(w.quantity, w.baseQty, VEG_VOL_FLOOR);
          return Math.cbrt(anchor);
        });
        const sumWeighted = weighted.reduce((acc, value) => acc + value, 0);
        shares = sumWeighted > 0
          ? weighted.map((value) => value / sumWeighted)
          : grp.indices.map(() => 1 / n);
      } else {
        shares = grp.indices.map((idx) =>
          grpTotalQty > 0 ? work[idx].quantity / grpTotalQty : 1 / n
        );
      }

      const newQtys = grp.indices.map((idx, j) => {
        const m = work[idx];
        const raw = m.quantity + sQuant * shares[j];
        let nq = clamp(raw, m.minQty, m.maxQty);
        nq = roundToStep(nq, m.step);
        return nq;
      });

      const appliedDeltas = grp.indices.map((idx, j) => newQtys[j] - work[idx].quantity);
      if (appliedDeltas.every((d) => d === 0)) continue;

      // Error residual tras aplicar el movimiento del grupo.
      let dPp = dP, dCp = dC, dFp = dF;
      for (let j = 0; j < grp.indices.length; j++) {
        const m = work[grp.indices[j]];
        dPp -= appliedDeltas[j] * m.ppu;
        dCp -= appliedDeltas[j] * m.cpu;
        dFp -= appliedDeltas[j] * m.fpu;
      }
      const err2 = squaredMacroError(
        dPp,
        dCp,
        dFp,
        { tp, tc, tf },
        { p: MACRO_TOL_P, c: MACRO_TOL_C, f: MACRO_TOL_F },
      );

      // Penalizaciones agregadas de todos los miembros del grupo.
      let presPenalty = 0, rolePenalty = 0, anchorPenalty = 0, volumePenalty = 0, softMinPenalty = 0;

      for (let j = 0; j < grp.indices.length; j++) {
        const idx = grp.indices[j];
        const m = work[idx];
        const absApplied = Math.abs(appliedDeltas[j]);
        if (absApplied === 0) continue;

        presPenalty += ALPHA_PRES * m.preservation * absApplied;

        // P3: rolePenalty basada en contribución calórica real, no en el string de role.
        // Un ingrediente no se penaliza si aporta ≥20% de sus kcal desde el macro dominante.
        // Esto evita que las legumbres sean penalizadas cuando el déficit es de hidratos,
        // aunque su role asignado en BD sea "protein".
        const kcalu = m.ppu * 4 + m.cpu * 4 + m.fpu * 9;
        const domKcalShare = kcalu > 0
          ? (domRole === "protein" ? m.ppu * 4 : domRole === "carb" ? m.cpu * 4 : m.fpu * 9) / kcalu
          : 0;
        const contributesDom = domKcalShare >= DUAL_ROLE_KCAL_THRESHOLD;
        rolePenalty += (!contributesDom && m.role !== "mixed") ? BETA_ROLE * absApplied : 0;

        // Anchor penalty: penaliza la desviación relativa respecto a la cantidad base.
        const base = Math.max(1, m.baseQty);
        const dev = (newQtys[j] - m.baseQty) / base;

        // P3: las legumbres reciben gamma más bajo (GAMMA_ANCHOR_BASE = 1.25) porque
        // son una fuente de proteína flexible y saludable, no el componente rígido
        // de la receta como lo puede ser el pollo (gamma 2.0).
        const gamma =
          m.isLegume        ? GAMMA_ANCHOR_BASE :
          m.role === "protein" ? GAMMA_ANCHOR_PROTEIN :
          m.role === "fat"     ? GAMMA_ANCHOR_FAT :
          m.role === "carb"    ? GAMMA_ANCHOR_CARB :
          m.isVeg              ? GAMMA_ANCHOR_VEG :
          GAMMA_ANCHOR_BASE;

        anchorPenalty += gamma * dev * dev;

        if (m.isVeg && m.unitKind === "gramos") {
          const over = newQtys[j] - VEG_SOFT_CAP;
          if (over > 0) volumePenalty += LAMBDA_VEG_VOLUME * over * over;
        }

        if (m.softMinQty > 0 && newQtys[j] < m.softMinQty) {
          const miss = m.softMinQty - newQtys[j];
          softMinPenalty += m.softMinWeight * miss * miss;
        }
      }

      let vegBalancePenalty = 0;
      if (isVegGramGroup && grp.indices.length >= 2) {
        const positive = newQtys.filter((q) => q > 0);
        if (positive.length >= 2) {
          const maxQty = Math.max(...positive);
          const minQty = Math.max(1, Math.min(...positive));
          const ratio = maxQty / minQty;
          const overRatio = Math.max(0, ratio - VEG_MAX_RATIO);
          vegBalancePenalty = LAMBDA_VEG_BALANCE * overRatio * overRatio;
        }
      }

      // P4: penaliza grupos que ya cubren demasiado del macro dominante cuando
      // existen múltiples fuentes. Previene que el arroz acapare el 100% de
      // hidratos ignorando la patata en platos con múltiples fuentes de CH.
      let p4DominancePenalty = 0;
      if (numDomSources >= 2 && domTarget > 0) {
        // Contribución actual de este grupo al macro dominante (antes de mover)
        let grpDomContrib = 0;
        for (const idx of grp.indices) {
          const m = work[idx];
          grpDomContrib += domRole === "protein" ? m.ppu * m.quantity :
                           domRole === "carb"    ? m.cpu * m.quantity :
                           m.fpu * m.quantity;
        }
        // Exceso sobre el share máximo permitido (en gramos, mismas unidades que err2)
        const overcoverage = Math.max(0, grpDomContrib - P4_MAX_SHARE * domTarget);
        p4DominancePenalty = LAMBDA_P4 * overcoverage * overcoverage;
      }

      const score = err2 + presPenalty + rolePenalty + anchorPenalty + volumePenalty + softMinPenalty +
        vegBalancePenalty + p4DominancePenalty;

      if (score < bestScore) {
        bestScore = score;
        bestGrpIdx = gi;
        bestNewQtys = newQtys;
        bestAppliedDeltas = appliedDeltas;
      }
    }

    if (bestGrpIdx === -1) {
      // Ningún grupo pudo avanzar: expandir caps individuales y reintentar.
      for (const ing of work) {
        if (ing.locked) continue;
        ing.cap = ing.unitKind === "gramos" ? Math.min(ing.cap + 10, 150) : Math.min(ing.cap + 1, 3);
      }
      continue;
    }

    // Aplicar el movimiento del grupo ganador.
    const bestGrp = groups[bestGrpIdx];
    for (let j = 0; j < bestGrp.indices.length; j++) {
      const idx = bestGrp.indices[j];
      work[idx].quantity = bestNewQtys[j];
      curP += bestAppliedDeltas[j] * work[idx].ppu;
      curC += bestAppliedDeltas[j] * work[idx].cpu;
      curF += bestAppliedDeltas[j] * work[idx].fpu;
    }
    curK = curP * 4 + curC * 4 + curF * 9;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // FASE R — Macro repair estricto y resolución de conflicto
  // Prioridad absoluta: cerrar macros (especialmente exceso de CH).
  // Si no hay salida con ajustes finos, se podan ingredientes carb-dominantes.
  // ────────────────────────────────────────────────────────────────────────────
  const forceZeroFoodIds = new Set<string>();
  {
    const getCardinalityByGroup = () => {
      const map = new Map<string, number>();
      for (const w of work) {
        if (w.locked || w.quantity <= 0) continue;
        map.set(w.groupName, (map.get(w.groupName) || 0) + 1);
      }
      return map;
    };

    const carbDominanceScore = (w: WorkIngredient, cardinalityByGroup: Map<string, number>) => {
      const carbPer = w.cpu;
      const proteinPer = w.ppu;
      const fatPer = w.fpu;
      const groupCardinality = cardinalityByGroup.get(w.groupName) || 1;
      const groupBonus = groupCardinality > 2 ? (groupCardinality - 2) * 0.2 : 0;
      const sourceBonus = (w.isLegume || w.isCerealLike) ? 0.35 : 0;
      return carbPer - 0.45 * proteinPer - 0.1 * fatPer + groupBonus + sourceBonus;
    };

    const strictRepairStep = () => {
      const dP = tp - curP;
      const dC = tc - curC;
      const dF = tf - curF;
      const currentErr = squaredMacroError(
        dP,
        dC,
        dF,
        { tp, tc, tf },
        { p: MACRO_TOL_P, c: MACRO_TOL_C, f: MACRO_TOL_F },
      );

      let bestImprovement = 0;
      let bestIdx = -1;
      let bestDelta = 0;

      for (let i = 0; i < work.length; i++) {
        const w = work[i];
        if (forceZeroFoodIds.has(String(w.food_id))) continue;
        if (w.locked || w.vNorm2 === 0) continue;

        const down = w.quantity - w.step;
        const canDown = down >= w.minQty;
        const canUp = w.quantity + w.step <= w.maxQty;

        const candidateDeltas: number[] = [];
        if (canDown) candidateDeltas.push(-w.step);
        if (canUp) candidateDeltas.push(w.step);

        for (const delta of candidateDeltas) {
          // En reparación estricta, evitar subir CH si ya estamos pasados.
          if (delta > 0 && dC < -MACRO_TOL_C && w.cpu > 0) continue;

          const nextDP = dP - delta * w.ppu;
          const nextDC = dC - delta * w.cpu;
          const nextDF = dF - delta * w.fpu;
          const nextErr = squaredMacroError(
            nextDP,
            nextDC,
            nextDF,
            { tp, tc, tf },
            { p: MACRO_TOL_P, c: MACRO_TOL_C, f: MACRO_TOL_F },
          );
          const improvement = currentErr - nextErr;
          if (improvement > bestImprovement + 1e-9) {
            bestImprovement = improvement;
            bestIdx = i;
            bestDelta = delta;
          }
        }
      }

      if (bestIdx < 0 || bestDelta === 0) return false;
      const w = work[bestIdx];
      w.quantity = roundToStep(clamp(w.quantity + bestDelta, w.minQty, w.maxQty), w.step);
      curP += bestDelta * w.ppu;
      curC += bestDelta * w.cpu;
      curF += bestDelta * w.fpu;
      curK = curP * 4 + curC * 4 + curF * 9;
      return true;
    };

    // 1) Repair fino con prioridad macro.
    for (let i = 0; i < 80; i++) {
      const dP = tp - curP;
      const dC = tc - curC;
      const dF = tf - curF;
      const done = Math.abs(dP) <= MACRO_TOL_P && Math.abs(dC) <= MACRO_TOL_C && Math.abs(dF) <= MACRO_TOL_F;
      if (done) break;
      if (!strictRepairStep()) break;
    }

    // 2) Si CH sigue pasado, poda carb-dominante por ingrediente (puede ir a 0).
    let dC = tc - curC;
    if (dC < -MACRO_TOL_C) {
      const cardinalityByGroup = getCardinalityByGroup();
      const candidates = work
        .map((w, idx) => ({ w, idx }))
        .filter(({ w }) =>
          !w.locked &&
          w.quantity > 0 &&
          w.cpu > 0 &&
          (w.isLegume || w.isCerealLike || w.role === "carb") &&
          !w.isVeg &&
          !w.isFruit,
        )
        .map(({ w, idx }) => ({
          idx,
          score: carbDominanceScore(w, cardinalityByGroup),
        }))
        .sort((a, b) => b.score - a.score);

      for (const candidate of candidates) {
        const w = work[candidate.idx];
        if (dC >= -MACRO_TOL_C) break;
        if (w.quantity <= 0) continue;

        const removedQty = w.quantity;
        curP -= removedQty * w.ppu;
        curC -= removedQty * w.cpu;
        curF -= removedQty * w.fpu;
        w.quantity = 0;
        // Congelamos este ingrediente para evitar que vuelva a entrar en esta ejecución.
        w.cap = 0;
        forceZeroFoodIds.add(String(w.food_id));
        dC = tc - curC;
      }
      curK = curP * 4 + curC * 4 + curF * 9;

      // 3) Reajuste final tras poda.
      for (let i = 0; i < 80; i++) {
        const dP2 = tp - curP;
        const dC2 = tc - curC;
        const dF2 = tf - curF;
        const done = Math.abs(dP2) <= MACRO_TOL_P && Math.abs(dC2) <= MACRO_TOL_C && Math.abs(dF2) <= MACRO_TOL_F;
        if (done) break;
        if (!strictRepairStep()) break;
      }
    }
  }

  return work.map((ing) => {
    if (forceZeroFoodIds.has(String(ing.food_id))) {
      return {
        food_id: ing.food_id,
        quantity: 0,
        grams: 0,
        ingredient_row_id: ing.ingredient_row_id,
        recipe_id: ing.recipe_id,
        is_private: ing.is_private,
      };
    }

    let finalQty = roundToStep(ing.quantity, ing.step);
    finalQty = clamp(finalQty, ing.minQty, Number.isFinite(ing.maxQty) ? ing.maxQty : Infinity);
    finalQty = roundToStep(finalQty, ing.step);

    if (!ing.locked && ing.unitKind === "unidades" && ing.softMinQty > 0 && finalQty === 0) {
      finalQty = roundToStep(
        clamp(ing.softMinQty, ing.minQty, Number.isFinite(ing.maxQty) ? ing.maxQty : ing.softMinQty),
        ing.step,
      );
    }

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
