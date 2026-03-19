const UI_PREF_STORAGE_PREFIX = 'bibofit-ui-pref-v1:';

export const UI_VIEW_PREFERENCE_KEYS = {
  DASHBOARD_CALENDAR_MINI: 'dashboard-calendar-mini',
  DIETPLAN_LIST_SHOW_TARGET_MACROS: 'dietplan-list-show-target-macros',
};

const buildStorageKey = (key) => `${UI_PREF_STORAGE_PREFIX}${key}`;

export const readBooleanViewPreference = (key, fallbackValue = false) => {
  if (typeof window === 'undefined') return fallbackValue;

  try {
    const raw = window.localStorage.getItem(buildStorageKey(key));
    if (raw === null) return fallbackValue;
    const parsed = JSON.parse(raw);

    if (typeof parsed === 'boolean') {
      return parsed;
    }

    window.localStorage.removeItem(buildStorageKey(key));
    return fallbackValue;
  } catch {
    return fallbackValue;
  }
};

export const writeBooleanViewPreference = (key, value) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(buildStorageKey(key), JSON.stringify(Boolean(value)));
  } catch {
    // Ignore storage write errors (private mode, quota, etc.)
  }
};
