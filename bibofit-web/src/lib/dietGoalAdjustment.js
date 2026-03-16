const GOAL_DIRECTION = {
  DEFICIT: 'deficit',
  MAINTENANCE: 'maintenance',
  SURPLUS: 'surplus'
};

const BASE_RANGES = {
  [GOAL_DIRECTION.DEFICIT]: {
    defaultPct: 15,
    recommendedMinPct: 10,
    recommendedMaxPct: 20,
    hardMinPct: 5,
    hardMaxPct: 25
  },
  [GOAL_DIRECTION.MAINTENANCE]: {
    defaultPct: 0,
    recommendedMinPct: 0,
    recommendedMaxPct: 0,
    hardMinPct: 0,
    hardMaxPct: 0
  },
  [GOAL_DIRECTION.SURPLUS]: {
    defaultPct: 7,
    recommendedMinPct: 5,
    recommendedMaxPct: 10,
    hardMinPct: 3,
    hardMaxPct: 15
  }
};

const DEFICIT_KEYWORDS = [
  'deficit',
  'deficit calorico',
  'deficit calórico',
  'perdida',
  'pérdida',
  'bajar',
  'grasa',
  'cut',
  'cutting',
  'reducir'
];

const SURPLUS_KEYWORDS = [
  'superavit',
  'superávit',
  'surplus',
  'ganar',
  'ganancia',
  'subir',
  'volumen',
  'bulk',
  'hypertrophy',
  'hipertrofia',
  'musculo',
  'músculo'
];

const MAINTENANCE_KEYWORDS = [
  'mantenimiento',
  'mantener',
  'maintain',
  'maintenance',
  'recomposicion',
  'recomposición'
];

const FEMALE_VALUES = ['mujer', 'female', 'f'];
const MALE_VALUES = ['hombre', 'male', 'm'];

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const normalizeText = (value) =>
  String(value || '')
    .trim()
    .toLowerCase();

export const normalizeGoalDirection = (value) => {
  const normalized = normalizeText(value);
  if (!normalized) return null;

  if (normalized === GOAL_DIRECTION.DEFICIT) return GOAL_DIRECTION.DEFICIT;
  if (normalized === GOAL_DIRECTION.MAINTENANCE) return GOAL_DIRECTION.MAINTENANCE;
  if (normalized === GOAL_DIRECTION.SURPLUS) return GOAL_DIRECTION.SURPLUS;

  if (normalized === 'loss') return GOAL_DIRECTION.DEFICIT;
  if (normalized === 'gain') return GOAL_DIRECTION.SURPLUS;

  return null;
};

const inferDirectionFromText = (value) => {
  const normalized = normalizeText(value);
  if (!normalized) return null;

  if (MAINTENANCE_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return GOAL_DIRECTION.MAINTENANCE;
  }
  if (DEFICIT_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return GOAL_DIRECTION.DEFICIT;
  }
  if (SURPLUS_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return GOAL_DIRECTION.SURPLUS;
  }

  return null;
};

export const resolveGoalDirection = (goalRow, fallbackDirection = null) => {
  const explicitDirection = normalizeGoalDirection(goalRow?.energy_adjustment_direction);
  if (explicitDirection) return explicitDirection;

  const fallback = normalizeGoalDirection(fallbackDirection);
  if (fallback) return fallback;

  const byName = inferDirectionFromText(goalRow?.name);
  if (byName) return byName;

  const byDescription = inferDirectionFromText(goalRow?.description);
  if (byDescription) return byDescription;

  return GOAL_DIRECTION.MAINTENANCE;
};

export const resolveGoalAdjustmentRange = ({ goalRow, direction }) => {
  const safeDirection = normalizeGoalDirection(direction) || GOAL_DIRECTION.MAINTENANCE;
  const base = BASE_RANGES[safeDirection];

  if (safeDirection === GOAL_DIRECTION.MAINTENANCE) {
    return { ...base };
  }

  const goalMin = toNumberOrNull(goalRow?.min_adjustment_pct);
  const goalMax = toNumberOrNull(goalRow?.max_adjustment_pct);
  const goalDefault = toNumberOrNull(goalRow?.default_adjustment_pct);

  const hardMinPct = base.hardMinPct;
  const hardMaxPct = base.hardMaxPct;
  const minPct = clamp(goalMin ?? hardMinPct, hardMinPct, hardMaxPct);
  const maxPct = clamp(goalMax ?? hardMaxPct, hardMinPct, hardMaxPct);
  const normalizedMin = Math.min(minPct, maxPct);
  const normalizedMax = Math.max(minPct, maxPct);
  const defaultPct = clamp(goalDefault ?? base.defaultPct, normalizedMin, normalizedMax);

  return {
    defaultPct,
    recommendedMinPct: clamp(base.recommendedMinPct, normalizedMin, normalizedMax),
    recommendedMaxPct: clamp(base.recommendedMaxPct, normalizedMin, normalizedMax),
    hardMinPct: normalizedMin,
    hardMaxPct: normalizedMax
  };
};

export const sanitizeGoalAdjustmentPct = ({ goalRow, direction, adjustmentPct }) => {
  const range = resolveGoalAdjustmentRange({ goalRow, direction });

  if (direction === GOAL_DIRECTION.MAINTENANCE) {
    return {
      adjustmentPct: 0,
      wasClamped: false,
      ...range
    };
  }

  const parsedPct = toNumberOrNull(adjustmentPct);
  if (parsedPct === null) {
    return {
      adjustmentPct: range.defaultPct,
      wasClamped: false,
      ...range
    };
  }

  const clampedPct = clamp(parsedPct, range.hardMinPct, range.hardMaxPct);

  return {
    adjustmentPct: clampedPct,
    wasClamped: clampedPct !== parsedPct,
    ...range
  };
};

const resolveSexMinimumCalories = (sex) => {
  const normalizedSex = normalizeText(sex);
  if (FEMALE_VALUES.includes(normalizedSex)) return 1200;
  if (MALE_VALUES.includes(normalizedSex)) return 1500;
  return 1200;
};

export const calculateGoalAdjustedCalories = ({
  tdeeKcal,
  sex,
  goalRow,
  direction,
  adjustmentPct
}) => {
  const baseTdeeKcal = toNumberOrNull(tdeeKcal);
  const resolvedDirection = resolveGoalDirection(goalRow, direction);

  if (baseTdeeKcal === null || baseTdeeKcal <= 0) {
    const sanitized = sanitizeGoalAdjustmentPct({
      goalRow,
      direction: resolvedDirection,
      adjustmentPct
    });

    return {
      baseTdeeKcal: null,
      targetCaloriesKcal: null,
      deltaKcal: null,
      direction: resolvedDirection,
      ...sanitized,
      minCaloriesGuardrailApplied: false,
      minCaloriesGuardrailKcal: resolveSexMinimumCalories(sex),
      effectivePct: sanitized.adjustmentPct,
      insideRecommendedRange: true
    };
  }

  const sanitized = sanitizeGoalAdjustmentPct({
    goalRow,
    direction: resolvedDirection,
    adjustmentPct
  });

  const pct = sanitized.adjustmentPct;
  let targetCaloriesKcal = Math.round(baseTdeeKcal);

  if (resolvedDirection === GOAL_DIRECTION.DEFICIT) {
    targetCaloriesKcal = Math.round(baseTdeeKcal * (1 - pct / 100));
  } else if (resolvedDirection === GOAL_DIRECTION.SURPLUS) {
    targetCaloriesKcal = Math.round(baseTdeeKcal * (1 + pct / 100));
  }

  const minCaloriesGuardrailKcal = resolveSexMinimumCalories(sex);
  let minCaloriesGuardrailApplied = false;

  if (resolvedDirection === GOAL_DIRECTION.DEFICIT && targetCaloriesKcal < minCaloriesGuardrailKcal) {
    targetCaloriesKcal = minCaloriesGuardrailKcal;
    minCaloriesGuardrailApplied = true;
  }

  const deltaKcal = targetCaloriesKcal - Math.round(baseTdeeKcal);
  const effectivePct =
    Math.round((Math.abs(deltaKcal) / Math.round(baseTdeeKcal)) * 10000) / 100;

  const insideRecommendedRange =
    resolvedDirection === GOAL_DIRECTION.MAINTENANCE
      ? true
      : pct >= sanitized.recommendedMinPct && pct <= sanitized.recommendedMaxPct;

  return {
    baseTdeeKcal: Math.round(baseTdeeKcal),
    targetCaloriesKcal,
    deltaKcal,
    direction: resolvedDirection,
    ...sanitized,
    minCaloriesGuardrailApplied,
    minCaloriesGuardrailKcal,
    effectivePct,
    insideRecommendedRange
  };
};

export const findDefaultGoalId = (dietGoals = []) => {
  if (!Array.isArray(dietGoals) || dietGoals.length === 0) return null;

  const explicitMaintenance = dietGoals.find(
    (goal) => normalizeGoalDirection(goal?.energy_adjustment_direction) === GOAL_DIRECTION.MAINTENANCE
  );
  if (explicitMaintenance?.id) return String(explicitMaintenance.id);

  const maintenanceByText = dietGoals.find(
    (goal) => resolveGoalDirection(goal) === GOAL_DIRECTION.MAINTENANCE
  );
  if (maintenanceByText?.id) return String(maintenanceByText.id);

  return String(dietGoals[0].id);
};

export const GOAL_DIRECTION_OPTIONS = GOAL_DIRECTION;
