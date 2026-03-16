
import { supabase } from '@/lib/supabaseClient';

const normalizeRelationType = (value) => {
    const relation = (value || '').toLowerCase();
    if (['to_avoid', 'evitar', 'avoid'].includes(relation)) return 'avoid';
    if (['recommended', 'recomendado', 'recommend', 'recomendar', 'to_recommend'].includes(relation)) return 'recommend';
    return relation || null;
};

const normalizeDietRuleType = (value) => {
    const normalized = (value || '').toLowerCase().trim();
    if (['excluded', 'exclude', 'no_compatible', 'not_compatible'].includes(normalized)) return 'excluded';
    if (['limited', 'limit', 'reduce', 'reduced'].includes(normalized)) return 'limited';
    return normalized || null;
};

const normalizeText = (value) =>
    String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

const mappingAppliesToConflict = (mapping, conflict) => {
    const contexts = mapping?.metadata?.conflict_contexts;

    // Backward-compatible: mappings without explicit context apply to any conflict.
    if (!Array.isArray(contexts) || contexts.length === 0) {
        return true;
    }

    return contexts.some((ctx) => {
        if (!ctx || typeof ctx !== 'object') return false;

        if (ctx.type === 'sensitivity') {
            return conflict?.type === 'sensitivity' && Number(ctx.sensitivity_id) === Number(conflict.sensitivity_id);
        }

        if (ctx.type === 'medical_condition') {
            if (
                (conflict?.type !== 'condition_avoid' && conflict?.type !== 'condition_recommend') ||
                Number(ctx.condition_id) !== Number(conflict.condition_id)
            ) {
                return false;
            }

            const ctxRelation = normalizeRelationType(ctx.relation_type);
            return !ctxRelation || ctxRelation === normalizeRelationType(conflict.condition_relation);
        }

        if (ctx.type === 'diet_type') {
            if (conflict?.type !== 'diet_type_excluded' && conflict?.type !== 'diet_type_limited') {
                return false;
            }

            if (Number(ctx.diet_type_id) !== Number(conflict.diet_type_id)) {
                return false;
            }

            const ctxRuleType = normalizeDietRuleType(ctx.rule_type);
            const conflictRuleType = normalizeDietRuleType(conflict.rule_type);
            if (ctxRuleType && conflictRuleType && ctxRuleType !== conflictRuleType) {
                return false;
            }

            if (ctx.food_group_id != null && conflict.food_group_id != null) {
                return Number(ctx.food_group_id) === Number(conflict.food_group_id);
            }

            return true;
        }

        return false;
    });
};

export const getConflictInfo = (food, userRestrictions) => {
    if (!food || !userRestrictions) {
        return null;
    }
    const extractId = (item) => (item && typeof item === 'object' ? item.id : item);
    // Check for preferred foods
    if (userRestrictions.preferred_foods?.some(pf => pf.id === food.id)) {
        return { type: 'preferred', reason: 'Preferido' };
    }

    // Check for non-preferred foods
    if (userRestrictions.non_preferred_foods?.some(npf => npf.id === food.id)) {
        return { type: 'non-preferred', reason: 'No preferido' };
    }

    // Check sensitivities
    if (userRestrictions.sensitivities?.length > 0 && food.food_sensitivities?.length > 0) {
        const userSensitivityIds = userRestrictions.sensitivities
        .map(extractId)
        .filter(id => id !== undefined && id !== null);      
        const foodSensitivity = food.food_sensitivities.find(fs => {
          const sensitivity = fs.sensitivities || fs.sensitivity;
          const sensitivityId = sensitivity?.id ?? fs.sensitivity_id;
          return sensitivityId !== undefined && userSensitivityIds.includes(sensitivityId);
        });
      if (foodSensitivity) {
        const sensitivity = foodSensitivity.sensitivities || foodSensitivity.sensitivity;
        return {
          type: 'sensitivity',
          reason: `Sensibilidad: ${sensitivity?.name || foodSensitivity.sensitivity_name || 'Desconocida'}`,
          sensitivity_id: sensitivity?.id ?? foodSensitivity.sensitivity_id ?? null
        };
      }
    }
  
    // Check medical conditions
    const restrictionConditions = userRestrictions.medical_conditions || userRestrictions.conditions || [];
    if (restrictionConditions.length > 0 && food.food_medical_conditions?.length > 0) {
      const userConditionIds = restrictionConditions
        .map(extractId)
        .filter(id => id !== undefined && id !== null);

      
      const toAvoid = food.food_medical_conditions.find(fmc => {
        const condition = fmc.medical_conditions || fmc.condition;
        const conditionId = condition?.id ?? fmc.condition_id;
        return conditionId !== undefined && userConditionIds.includes(conditionId) && normalizeRelationType(fmc.relation_type) === 'avoid';
      });

      if (toAvoid) {
        const condition = toAvoid.medical_conditions || toAvoid.condition;
        return {
          type: 'condition_avoid',
          reason: `Evitar por: ${condition?.name || toAvoid.condition_name || 'Condición'}`,
          condition_id: condition?.id ?? toAvoid.condition_id ?? null,
          condition_relation: normalizeRelationType(toAvoid.relation_type)
        };
      }

      const toRecommend = food.food_medical_conditions.find(fmc => {
        const condition = fmc.medical_conditions || fmc.condition;
        const conditionId = condition?.id ?? fmc.condition_id;
        return conditionId !== undefined && userConditionIds.includes(conditionId) && normalizeRelationType(fmc.relation_type) === 'recommend';
      });

      if (toRecommend) {
        const condition = toRecommend.medical_conditions || toRecommend.condition;
        return {
          type: 'condition_recommend',
          reason: `Recomendado por: ${condition?.name || 'Condición'}`,
          condition_id: condition?.id ?? toRecommend.condition_id ?? null,
          condition_relation: normalizeRelationType(toRecommend.relation_type)
        };
      }
    }
  
    // Check diet type compatibility
    // Genera advertencias (no bloqueos): el usuario puede usar el alimento igualmente.
    if (userRestrictions.diet_type_id && Array.isArray(userRestrictions.diet_type_rules) && userRestrictions.diet_type_rules.length > 0) {
        const foodGroupIds = (food.food_to_food_groups || []).map(fg => Number(fg.food_group_id ?? fg.food_group?.id ?? fg.food_groups?.id));
        const foodGroupNames = (food.food_to_food_groups || [])
            .map(fg => normalizeText(fg.food_group?.name ?? fg.food_groups?.name))
            .filter(Boolean);

        if (foodGroupIds.length > 0) {
            const excludedRule = userRestrictions.diet_type_rules.find(
                (r) => {
                    if (r.rule_type !== 'excluded') return false;
                    const ruleGroupId = Number(r.food_group_id ?? r.food_groups?.id);
                    const ruleGroupName = normalizeText(r.food_group_name ?? r.food_groups?.name);
                    return (
                        (Number.isFinite(ruleGroupId) && foodGroupIds.includes(ruleGroupId)) ||
                        (ruleGroupName && foodGroupNames.includes(ruleGroupName))
                    );
                }
            );
            if (excludedRule) {
                return {
                    type: 'diet_type_excluded',
                    reason: `No recomendado en dieta ${userRestrictions.diet_type_name || 'seleccionada'}: ${excludedRule.food_group_name || excludedRule.food_groups?.name || ''}`.trim(),
                    diet_type_id: userRestrictions.diet_type_id,
                    food_group_name: excludedRule.food_group_name || excludedRule.food_groups?.name,
                    food_group_id: excludedRule.food_group_id ?? excludedRule.food_groups?.id ?? null,
                    rule_type: excludedRule.rule_type,
                };
            }

            const limitedRule = userRestrictions.diet_type_rules.find(
                (r) => {
                    if (r.rule_type !== 'limited') return false;
                    const ruleGroupId = Number(r.food_group_id ?? r.food_groups?.id);
                    const ruleGroupName = normalizeText(r.food_group_name ?? r.food_groups?.name);
                    return (
                        (Number.isFinite(ruleGroupId) && foodGroupIds.includes(ruleGroupId)) ||
                        (ruleGroupName && foodGroupNames.includes(ruleGroupName))
                    );
                }
            );
            if (limitedRule) {
                return {
                    type: 'diet_type_limited',
                    reason: `Uso reducido recomendado en dieta ${userRestrictions.diet_type_name || 'seleccionada'}: ${limitedRule.food_group_name || limitedRule.food_groups?.name || ''}`.trim(),
                    diet_type_id: userRestrictions.diet_type_id,
                    food_group_name: limitedRule.food_group_name || limitedRule.food_groups?.name,
                    food_group_id: limitedRule.food_group_id ?? limitedRule.food_groups?.id ?? null,
                    rule_type: limitedRule.rule_type,
                };
            }
        }
    }

    return null;
};

export const prefetchSubstitutionMappings = async (sourceFoodIds = []) => {
    const normalizedIds = [...new Set((sourceFoodIds || [])
        .map(id => Number(id))
        .filter(id => Number.isFinite(id) && id > 0))];

    if (normalizedIds.length === 0) return new Map();

    const { data: mappings, error } = await supabase
        .from('food_substitution_mappings')
        .select('*')
        .in('source_food_id', normalizedIds)
        .order('confidence_score', { ascending: false });

    if (error) throw error;

    const bySourceFoodId = new Map();
    (mappings || []).forEach((mapping) => {
        const sourceId = Number(mapping?.source_food_id);
        if (!Number.isFinite(sourceId)) return;
        if (!bySourceFoodId.has(sourceId)) bySourceFoodId.set(sourceId, []);
        bySourceFoodId.get(sourceId).push(mapping);
    });

    return bySourceFoodId;
};

// New function handling substitutions
export const getConflictWithSubstitutions = async (food, userRestrictions, allFoods, preloadedMappingsBySourceId = null) => {
    const basicConflict = getConflictInfo(food, userRestrictions);
    
    // Si no hay conflicto o es una preferencia positiva, retornamos rápido.
    if (!basicConflict || basicConflict.type === 'preferred' || basicConflict.type === 'condition_recommend') {
        return { hasConflict: false };
    }
    
    try {
        // Use preloaded mappings when available to avoid N+1 queries.
        const sourceFoodId = Number(food?.id);
        const mappings = preloadedMappingsBySourceId instanceof Map
            ? (preloadedMappingsBySourceId.get(sourceFoodId) || [])
            : await (async () => {
                const { data, error } = await supabase
                    .from('food_substitution_mappings')
                    .select('*')
                    .eq('source_food_id', food.id)
                    .order('confidence_score', { ascending: false });
                if (error) throw error;
                return data || [];
            })();

        const substitutions = (mappings || []).filter((sub) => mappingAppliesToConflict(sub, basicConflict));

        // Filtrar sustituciones para asegurar que el target NO tenga conflictos
        const safeSubstitutions = substitutions.filter(sub => {
            const targetFood = allFoods?.find(f => f.id === sub.target_food_id);
            if (!targetFood) return false;
            
            const targetConflict = getConflictInfo(targetFood, userRestrictions);
            // Solo es seguro si no hay conflicto, o si es una recomendación/preferencia positiva
            // o una advertencia leve de tipo de dieta (limited).
            return (
                !targetConflict ||
                targetConflict.type === 'preferred' ||
                targetConflict.type === 'condition_recommend' ||
                targetConflict.type === 'diet_type_limited'
            );
        });

        const isDietLimitedConflict = basicConflict.type === 'diet_type_limited';
        const autoSubCandidates = isDietLimitedConflict
            ? []
            : safeSubstitutions.filter(s => s.is_automatic && s.confidence_score >= 85);
        const autoSub = autoSubCandidates[0] ?? null;

        return {
            hasConflict: true,
            conflict: basicConflict,
            substitutions: safeSubstitutions,
            autoSubstitution: autoSub,
            autoSubstitutionCandidates: autoSubCandidates,
            requiresReview: isDietLimitedConflict ? false : !autoSub
        };
    } catch (err) {
        console.error("Error fetching substitutions:", err);
        // Fallback: tratar como revisión manual si falla la DB
        return {
            hasConflict: true,
            conflict: basicConflict,
            substitutions: [],
            autoSubstitution: null,
            requiresReview: true
        };
    }
};
