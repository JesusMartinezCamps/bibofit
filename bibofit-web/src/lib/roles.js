export const ROLE = Object.freeze({
  FREE: 'free',
  ADMIN: 'admin',
  PRO_NUTRITION: 'pro-nutrition',
  PRO_WORKOUT: 'pro-workout',
  COACH_NUTRITION: 'coach-nutrition',
  COACH_WORKOUT: 'coach-workout',
  LEGACY_CLIENT: 'client',
  LEGACY_COACH: 'coach',
});

const ROLE_ALIAS_MAP = Object.freeze({
  [ROLE.LEGACY_CLIENT]: ROLE.PRO_NUTRITION,
  [ROLE.LEGACY_COACH]: ROLE.COACH_NUTRITION,
});

const CLIENT_ROLES = new Set([ROLE.PRO_NUTRITION, ROLE.PRO_WORKOUT]);
const COACH_ROLES = new Set([ROLE.COACH_NUTRITION, ROLE.COACH_WORKOUT]);

export const STAFF_ALLOWED_ROLES = Object.freeze([ROLE.ADMIN, ROLE.COACH_NUTRITION, ROLE.COACH_WORKOUT]);

export const CLIENT_ROLE_QUERY_VALUES = Object.freeze([
  ROLE.PRO_NUTRITION,
  ROLE.PRO_WORKOUT,
  ROLE.LEGACY_CLIENT,
]);

export const COACH_ROLE_QUERY_VALUES = Object.freeze([
  ROLE.COACH_NUTRITION,
  ROLE.COACH_WORKOUT,
  ROLE.LEGACY_COACH,
]);

export const normalizeRole = (role) => {
  const value = String(role || ROLE.FREE).toLowerCase();
  return ROLE_ALIAS_MAP[value] || value;
};

export const isAdminRole = (role) => normalizeRole(role) === ROLE.ADMIN;

export const isClientRole = (role) => CLIENT_ROLES.has(normalizeRole(role));

export const isNutritionClientRole = (role) => normalizeRole(role) === ROLE.PRO_NUTRITION;

export const isWorkoutClientRole = (role) => normalizeRole(role) === ROLE.PRO_WORKOUT;

export const isCoachRole = (role) => COACH_ROLES.has(normalizeRole(role));

export const isNutritionCoachRole = (role) => normalizeRole(role) === ROLE.COACH_NUTRITION;

export const isWorkoutCoachRole = (role) => normalizeRole(role) === ROLE.COACH_WORKOUT;

export const isStaffRole = (role) => isAdminRole(role) || isCoachRole(role);

export const hasAnyRole = (role, allowedRoles = []) => {
  const normalizedRole = normalizeRole(role);
  return allowedRoles.some((candidate) => normalizeRole(candidate) === normalizedRole);
};

export const getRoleDisplayName = (role) => {
  const normalized = normalizeRole(role);

  switch (normalized) {
    case ROLE.ADMIN:
      return 'Admin';
    case ROLE.COACH_NUTRITION:
      return 'Coach Nutrición';
    case ROLE.COACH_WORKOUT:
      return 'Coach Entreno';
    case ROLE.PRO_NUTRITION:
      return 'Pro Nutrición';
    case ROLE.PRO_WORKOUT:
      return 'Pro Entreno';
    default:
      return 'Free';
  }
};

export const getDefaultAuthenticatedPath = (role) => {
  if (isAdminRole(role)) return '/admin-panel/advisories';
  if (isCoachRole(role)) return '/coach-dashboard';
  return '/dashboard';
};

export const canUseAutoFrameForRole = (role) =>
  isAdminRole(role) || isCoachRole(role) || isClientRole(role);
