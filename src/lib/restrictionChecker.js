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
        .filter(id => id !== undefined && id !== null);      const foodSensitivity = food.food_sensitivities.find(fs => {
          const sensitivity = fs.sensitivities || fs.sensitivity;
          const sensitivityId = sensitivity?.id ?? fs.sensitivity_id;
          return sensitivityId !== undefined && userSensitivityIds.includes(sensitivityId);
        });
      if (foodSensitivity) {
        const sensitivity = foodSensitivity.sensitivities || foodSensitivity.sensitivity;
        return {
          type: 'sensitivity',
          reason: `Sensibilidad: ${sensitivity?.name || foodSensitivity.sensitivity_name || 'Desconocida'}`
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
        return { type: 'condition_avoid', reason: `Evitar por: ${condition?.name || toAvoid.condition_name || 'Condición'}` };
      }

      const toRecommend = food.food_medical_conditions.find(fmc => {
        const condition = fmc.medical_conditions || fmc.condition;
        const conditionId = condition?.id ?? fmc.condition_id;
        // Check for both 'recommended' and 'recomendado'
        return conditionId !== undefined && userConditionIds.includes(conditionId) && (fmc.relation_type === 'recommended' || fmc.relation_type === 'recomendado');

      });

      if (toRecommend) {
        const condition = toRecommend.medical_conditions || toRecommend.condition;
        return { type: 'condition_recommend', reason: `Recomendado por: ${condition?.name || 'Condición'}` };
      }
    }
  
    return null;
};