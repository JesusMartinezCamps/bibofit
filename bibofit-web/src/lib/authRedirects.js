const normalizeBaseUrl = (value) => value.replace(/\/+$/, '');

const getWindowOrigin = () => {
  if (typeof window === 'undefined' || !window.location?.origin) return '';
  return normalizeBaseUrl(window.location.origin);
};

export const getAppBaseUrl = () => {
  const fromEnv = import.meta.env.VITE_APP_URL;
  if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) {
    return normalizeBaseUrl(fromEnv.trim());
  }
  return getWindowOrigin();
};

const joinWithBaseUrl = (path) => {
  const baseUrl = getAppBaseUrl();
  return baseUrl ? `${baseUrl}${path}` : path;
};

export const getAuthConfirmedRedirectUrl = () => joinWithBaseUrl('/auth/confirmed');
export const getDashboardRedirectUrl = () => joinWithBaseUrl('/dashboard');
export const getUpdatePasswordRedirectUrl = () => joinWithBaseUrl('/update-password');
