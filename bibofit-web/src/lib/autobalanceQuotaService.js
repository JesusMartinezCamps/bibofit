import { supabase } from '@/lib/supabaseClient';

export const AUTO_BALANCE_FEATURES = Object.freeze({
  MY_PLAN: 'my_plan_autobalance',
  RECIPE_EQUIVALENCE: 'recipe_equivalence_autobalance',
});

const EMPTY_QUOTA_ENTRY = Object.freeze({
  is_limited: false,
  limit: null,
  used: 0,
  remaining: null,
  blocked: false,
});

const EMPTY_SNAPSHOT = Object.freeze({
  role: 'free',
  is_free_limited: true,
  quotas: {
    [AUTO_BALANCE_FEATURES.MY_PLAN]: { ...EMPTY_QUOTA_ENTRY },
    [AUTO_BALANCE_FEATURES.RECIPE_EQUIVALENCE]: { ...EMPTY_QUOTA_ENTRY },
  },
});

const normalizeQuotaEntry = (entry) => ({
  ...EMPTY_QUOTA_ENTRY,
  ...(entry || {}),
});

const normalizeSnapshot = (snapshot) => {
  const quotas = snapshot?.quotas || {};
  return {
    role: snapshot?.role || 'free',
    is_free_limited: !!snapshot?.is_free_limited,
    quotas: {
      [AUTO_BALANCE_FEATURES.MY_PLAN]: normalizeQuotaEntry(quotas[AUTO_BALANCE_FEATURES.MY_PLAN]),
      [AUTO_BALANCE_FEATURES.RECIPE_EQUIVALENCE]: normalizeQuotaEntry(
        quotas[AUTO_BALANCE_FEATURES.RECIPE_EQUIVALENCE]
      ),
    },
  };
};

export const getQuotaUpgradeMessage = () =>
  'Has alcanzado tu limite del plan Free. Mejora a Pro-Nutrition para seguir usando funcionalidades avanzadas.';

export const fetchAutobalanceQuotaSnapshot = async () => {
  const { data, error } = await supabase.rpc('get_autobalance_quota_snapshot');
  if (error) throw error;
  if (!data) return { ...EMPTY_SNAPSHOT };
  return normalizeSnapshot(data);
};

export const consumeAutobalanceQuota = async ({
  featureKey,
  operationId = crypto.randomUUID(),
  origin = 'other',
  metadata = {},
}) => {
  const { data, error } = await supabase.rpc('consume_autobalance_quota', {
    p_feature_key: featureKey,
    p_operation_id: operationId,
    p_origin: origin,
    p_metadata: metadata || {},
  });

  if (error) throw error;
  return data || null;
};

export const releaseAutobalanceQuota = async ({
  featureKey,
  operationId,
}) => {
  if (!operationId) return { success: false, refunded: false, reason: 'missing_operation_id' };

  const { data, error } = await supabase.rpc('release_autobalance_quota', {
    p_feature_key: featureKey,
    p_operation_id: operationId,
  });

  if (error) throw error;
  return data || null;
};

export const getFeatureQuotaEntry = (snapshot, featureKey) =>
  normalizeQuotaEntry(snapshot?.quotas?.[featureKey]);
