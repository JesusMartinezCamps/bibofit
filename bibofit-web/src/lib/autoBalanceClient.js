import { supabase } from '@/lib/supabaseClient';

const AUTO_BALANCE_SCHEMA_VERSION = 'v1';

const normalizeError = async (error) => {
  if (!error) return null;
  let message = error.message || 'Error desconocido';
  try {
    if (error.context && typeof error.context.json === 'function') {
      const body = await error.context.json();
      message = body?.error || body?.message || message;
    }
  } catch {
    // noop
  }
  return new Error(message);
};

const ensureSuccess = async ({ data, error }) => {
  if (error) throw await normalizeError(error);
  if (data?.success === false) {
    throw new Error(data.error || 'La función devolvió un error');
  }
  return data;
};

const invokeAutoBalanceFunction = async (fnName, body) => {
  const response = await supabase.functions.invoke(fnName, {
    body: {
      schema_version: AUTO_BALANCE_SCHEMA_VERSION,
      ...body,
    },
  });
  return ensureSuccess(response);
};

const normalizeBalancedIngredients = (data) => {
  const raw = data?.results || data?.balancedIngredients || [];
  return raw.map((ing) => ({
    ...ing,
    quantity: Number(ing.quantity ?? ing.grams ?? 0),
    grams: Number(ing.grams ?? ing.quantity ?? 0),
  }));
};

export const invokeAutoBalanceRecipe = async ({ ingredients, targets, profile }) => {
  const data = await invokeAutoBalanceFunction('auto-balance-macros', {
    ingredients,
    targets,
    ...(profile ? { profile } : {}),
  });
  const balancedIngredients = normalizeBalancedIngredients(data);

  return {
    ...data,
    balancedIngredients,
    results: data?.results || balancedIngredients,
  };
};

export const invokeAutoBalanceBatch = async ({ moment_id, recipe_ids, user_id, date }) => {
  return invokeAutoBalanceFunction('auto-balance-macros-batch', {
    moment_id,
    recipe_ids,
    user_id,
    ...(date ? { date } : {}),
  });
};

export const invokeAutoBalanceDietPlans = async ({ user_id, tdee, macro_distribution, meals, template_id, start_date, end_date }) => {
  return invokeAutoBalanceFunction('auto-balance-macros-dietPlans', {
    user_id,
    tdee,
    macro_distribution,
    meals,
    ...(template_id ? { template_id } : {}),
    ...(start_date ? { start_date } : {}),
    ...(end_date ? { end_date } : {}),
  });
};

export const invokeAutoBalanceEquivalence = async ({ equivalence_adjustment_id, user_id, target_macros, recipes }) => {
  return invokeAutoBalanceFunction('auto-balance-equivalence', {
    equivalence_adjustment_id,
    user_id,
    target_macros,
    recipes,
  });
};
