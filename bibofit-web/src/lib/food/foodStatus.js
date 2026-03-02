export const FOOD_STATUS_STYLES = {
  pending: {
    label: 'Pendiente',
    className: 'bg-violet-500/20 text-violet-200 border-violet-400/40',
  },
  approved_private: {
    label: 'Privado · Aprobado',
    className: 'bg-indigo-500/20 text-indigo-200 border-indigo-400/40',
  },
  approved_general: {
    label: 'Global · Aprobado',
    className: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40',
  },
  rejected: {
    label: 'Rechazado',
    className: 'bg-red-500/20 text-red-200 border-red-400/40',
  },
  needs_review: {
    label: 'En Revisión',
    className: 'bg-amber-500/20 text-amber-200 border-amber-400/40',
  },
};

export const resolveFoodStatusKey = (status, moderationStatus) => {
  if (moderationStatus === 'needs_review') return 'needs_review';
  if (!status) return null;
  return String(status).toLowerCase();
};

export const getFoodStatusMeta = ({ status, moderationStatus }) => {
  const key = resolveFoodStatusKey(status, moderationStatus);
  if (!key) return null;
  return FOOD_STATUS_STYLES[key] || null;
};
