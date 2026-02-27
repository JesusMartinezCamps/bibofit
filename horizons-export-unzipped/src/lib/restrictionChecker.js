
import { supabase } from '@/lib/supabaseClient';

const normalizeRelationType = (value) => {
    const relation = (value || '').toLowerCase();
    if (['to_avoid', 'evitar', 'avoid'].includes(relation)) return 'avoid';
    if (['recommended', 'recomendado', 'recommend', 'recomendar', 'to_recommend'].includes(relation)) return 'recommend';
    return relation || null;
};

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
    
    // Check individual food restrictions
    if (userRestrictions.individual_food_restrictions?.some(res => res.id === food.id)) {
      return { type: 'condition_avoid', reason: 'Restringido' };
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
        // Check for both 'to_avoid' and 'evitar' to be safe with DB variations
        return conditionId !== undefined && userConditionIds.includes(conditionId) && (fmc.relation_type === 'to_avoid' || fmc.relation_type === 'evitar');

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
        // Check for both 'recommended' and 'recomendado'
        return conditionId !== undefined && userConditionIds.includes(conditionId) && (fmc.relation_type === 'recommended' || fmc.relation_type === 'recomendado');

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
  
    return null;
};

// New function handling substitutions
export const getConflictWithSubstitutions = async (food, userRestrictions, allFoods) => {
    const basicConflict = getConflictInfo(food, userRestrictions);
    
    // Si no hay conflicto o es una preferencia positiva, retornamos rápido
    if (!basicConflict || basicConflict.type === 'preferred' || basicConflict.type === 'condition_recommend') {
        return { hasConflict: false };
    }
    
    try {
        // Obtener mapeos de sustitución de Supabase
        const { data: mappings, error } = await supabase
            .from('food_substitution_mappings')
            .select('*')
            .eq('source_food_id', food.id)
            .order('confidence_score', { ascending: false });

        if (error) throw error;

        const substitutions = (mappings || []).filter((sub) => mappingAppliesToConflict(sub, basicConflict));

        // Filtrar sustituciones para asegurar que el target NO tenga conflictos
        const safeSubstitutions = substitutions.filter(sub => {
            const targetFood = allFoods?.find(f => f.id === sub.target_food_id);
            if (!targetFood) return false;
            
            const targetConflict = getConflictInfo(targetFood, userRestrictions);
            // Solo es seguro si no hay conflicto, o si el conflicto es "preferido" / "recomendado"
            return !targetConflict || targetConflict.type === 'preferred' || targetConflict.type === 'condition_recommend';
        });

        const autoSub = safeSubstitutions.find(s => s.is_automatic && s.confidence_score >= 85);

        return {
            hasConflict: true,
            conflict: basicConflict,
            substitutions: safeSubstitutions,
            autoSubstitution: autoSub,
            requiresReview: !autoSub
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
