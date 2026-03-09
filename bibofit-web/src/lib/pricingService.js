import { supabase } from '@/lib/supabaseClient';

export const PRICING_PRODUCT_AREAS = Object.freeze({
  NUTRITION: 'nutrition',
  WORKOUT: 'workout',
  BUNDLE: 'bundle',
});

const VALID_PRODUCT_AREAS = new Set(Object.values(PRICING_PRODUCT_AREAS));

const normalizeProductArea = (value) => {
  const normalized = String(value || PRICING_PRODUCT_AREAS.NUTRITION).toLowerCase();
  return VALID_PRODUCT_AREAS.has(normalized) ? normalized : PRICING_PRODUCT_AREAS.NUTRITION;
};

const FALLBACK_TIERS = [
  {
    id: 'free',
    slug: 'free',
    name: 'Free',
    subtitle: 'Una opción gratis que de verdad vale la pena',
    description: 'Para empezar a usar Bibofit de forma manual.',
    priceAmount: 0,
    priceCurrency: 'EUR',
    billingType: 'monthly',
    ctaLabel: 'Empezar Gratis',
    ctaLink: '/signup',
    isPopular: false,
    showOnHome: true,
    showOnPricing: true,
    sortOrder: 1,
    features: [
      { id: 'f-1', featureText: 'Asignación de 1 plantilla de Dieta', included: true, sortOrder: 1 },
      { id: 'f-2', featureText: 'Autocuadre inicial de Macros completo', included: true, sortOrder: 2 },
      { id: 'f-3', featureText: 'Acceso ilimitado a las recetas de la app', included: true, sortOrder: 3 },
      { id: 'f-4', featureText: 'Lista de la Compra Inteligente', included: true, sortOrder: 4 },
      { id: 'f-5', featureText: 'Registro de Peso y Progreso sin restricciones', included: true, sortOrder: 5 },
      { id: 'f-6', featureText: 'Añade tus picteos tambien sin restriccoines', included: true, sortOrder: 5 },
      { id: 'f-7', featureText: 'Soporte directo por correo', included: true, sortOrder: 6 },
      { id: 'f-8', featureText: 'Autocuadre de Macros automatizado', included: false, sortOrder: 6 },

    ],
    targets: ['free'],
    productArea: PRICING_PRODUCT_AREAS.NUTRITION,
  },
  {
    id: 'pro',
    slug: 'pro',
    name: 'Pro',
    subtitle: 'Automatiza tu nutrición',
    description: 'Automatiza tu nutrición con todas las ventajas.',
    priceAmount: 15,
    priceCurrency: 'EUR',
    billingType: 'monthly',
    ctaLabel: 'Prueba Gratis 15 días',
    ctaLink: '/signup',
    isPopular: true,
    showOnHome: true,
    showOnPricing: true,
    sortOrder: 2,
    features: [
      { id: 'p-1', featureText: 'Todo lo incluido en Free', included: true, sortOrder: 1 },
      { id: 'p-2', featureText: 'Asignación ilimitada de plantillas', included: true, sortOrder: 2 },
      { id: 'p-3', featureText: 'Autocuadre Automático de Dietas', included: true, sortOrder: 3 },
      { id: 'p-4', featureText: 'Actualización dinámica de macros', included: true, sortOrder: 4 },
      { id: 'p-5', featureText: 'Chat integrado con soporte básico', included: true, sortOrder: 5 },
      { id: 'p-6', featureText: 'Análisis avanzado de progreso', included: true, sortOrder: 6 },
    ],
    targets: ['pro-nutrition'],
    productArea: PRICING_PRODUCT_AREAS.NUTRITION,
  },
  {
    id: 'coaching',
    slug: 'coaching',
    name: 'Asesoría',
    subtitle: 'Soporte profesional',
    description: 'Soporte profesional para garantizar resultados.',
    priceAmount: 35,
    priceCurrency: 'EUR',
    billingType: 'monthly',
    ctaLabel: 'Contactar',
    ctaLink: '/contact',
    isPopular: false,
    showOnHome: true,
    showOnPricing: true,
    sortOrder: 3,
    features: [
      { id: 'c-1', featureText: 'Todo lo incluido en Pro', included: true, sortOrder: 1 },
      { id: 'c-2', featureText: 'Asignación directa a un Dietista', included: true, sortOrder: 2 },
      { id: 'c-3', featureText: 'Contacto 1 a 1 y revisión personal', included: true, sortOrder: 3 },
      { id: 'c-4', featureText: 'Seguimiento semanal detallado', included: true, sortOrder: 4 },
      { id: 'c-5', featureText: 'Soporte Prioritario 24/7', included: true, sortOrder: 5 },
      { id: 'c-6', featureText: 'Ajustes ilimitados de plan', included: true, sortOrder: 6 },
    ],
    targets: ['pro-nutrition'],
    productArea: PRICING_PRODUCT_AREAS.NUTRITION,
  },
];

const formatPrice = (amount, currency = 'EUR') => {
  const numeric = Number(amount || 0);
  const rounded = Number.isInteger(numeric) ? numeric.toString() : numeric.toFixed(2);
  if (currency === 'EUR') return `${rounded}€`;
  return `${rounded} ${currency}`;
};

const mapPlan = (plan) => {
  const features = (plan.commercial_plan_features || [])
    .map((feature) => ({
      id: feature.id,
      featureText: feature.feature_text,
      included: feature.included,
      sortOrder: feature.sort_order || 0,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder || String(a.id).localeCompare(String(b.id)));

  const targets = (plan.commercial_plan_role_targets || [])
    .map((target) => target?.roles?.role)
    .filter(Boolean);

  return {
    id: plan.id,
    slug: plan.slug,
    name: plan.name,
    subtitle: plan.subtitle,
    description: plan.description,
    priceAmount: Number(plan.price_amount || 0),
    priceCurrency: plan.price_currency || 'EUR',
    displayPrice: formatPrice(plan.price_amount, plan.price_currency),
    billingType: plan.billing_type || 'monthly',
    ctaLabel: plan.cta_label || 'Empezar',
    ctaLink: plan.cta_link || '/signup',
    isPopular: !!plan.is_popular,
    isActive: !!plan.is_active,
    showOnHome: !!plan.show_on_home,
    showOnPricing: !!plan.show_on_pricing,
    productArea: normalizeProductArea(plan.product_area),
    sortOrder: plan.sort_order || 0,
    features,
    targets,
  };
};

export const getFallbackPricingPlans = ({ productArea = PRICING_PRODUCT_AREAS.NUTRITION } = {}) => {
  const normalizedArea = normalizeProductArea(productArea);
  return FALLBACK_TIERS.filter((plan) => normalizeProductArea(plan.productArea) === normalizedArea);
};

export const getPricingPlans = async ({
  surface = 'pricing',
  includeInactive = false,
  includeAllAreas = false,
  productArea = PRICING_PRODUCT_AREAS.NUTRITION,
} = {}) => {
  const normalizedArea = normalizeProductArea(productArea);

  let query = supabase
    .from('commercial_plans')
    .select(`
      id,
      slug,
      name,
      subtitle,
      description,
      price_amount,
      price_currency,
      billing_type,
      cta_label,
      cta_link,
      is_popular,
      is_active,
      sort_order,
      show_on_home,
      show_on_pricing,
      product_area,
      commercial_plan_features (
        id,
        feature_text,
        included,
        sort_order
      ),
      commercial_plan_role_targets (
        role_id,
        roles (
          role
        )
      )
    `)
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true });

  if (!includeInactive) {
    query = query.eq('is_active', true);
  }
  if (!includeAllAreas) {
    query = query.eq('product_area', normalizedArea);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  let plans = (data || []).map(mapPlan);

  if (surface === 'home') {
    plans = plans.filter((plan) => plan.showOnHome);
  }
  if (surface === 'pricing') {
    plans = plans.filter((plan) => plan.showOnPricing);
  }

  return plans;
};

export const subscribePricingChanges = (onPricingChanged) => {
  const channel = supabase
    .channel(`pricing-changes-${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'commercial_plans' },
      onPricingChanged
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'commercial_plan_features' },
      onPricingChanged
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'commercial_plan_role_targets' },
      onPricingChanged
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const buildFeatureMatrix = (plans) => {
  const map = new Map();

  plans.forEach((plan) => {
    plan.features.forEach((feature) => {
      if (!map.has(feature.featureText)) {
        map.set(feature.featureText, {
          feature: feature.featureText,
          sortOrder: feature.sortOrder,
          byPlan: {},
        });
      }
      const row = map.get(feature.featureText);
      row.byPlan[plan.id] = feature.included;
      row.sortOrder = Math.min(row.sortOrder, feature.sortOrder);
    });
  });

  return Array.from(map.values()).sort((a, b) => a.sortOrder - b.sortOrder || a.feature.localeCompare(b.feature));
};
