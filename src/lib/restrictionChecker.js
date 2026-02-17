export const getConflictInfo = (food, userRestrictions) => {
    if (!food || !userRestrictions) {
        return null;
    }

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
      const userSensitivityIds = userRestrictions.sensitivities.map(s => s.id);
      const foodSensitivity = food.food_sensitivities.find(fs => {
          const sensitivity = fs.sensitivities || fs.sensitivity;
          return sensitivity && userSensitivityIds.includes(sensitivity.id);
      });
      if (foodSensitivity) {
        const sensitivity = foodSensitivity.sensitivities || foodSensitivity.sensitivity;
        return { type: 'sensitivity', reason: `Sensibilidad: ${sensitivity?.name || 'Desconocida'}` };
      }
    }
  
    // Check medical conditions
    if (userRestrictions.medical_conditions?.length > 0 && food.food_medical_conditions?.length > 0) {
      const userConditionIds = userRestrictions.medical_conditions.map(c => c.id);
      
      const toAvoid = food.food_medical_conditions.find(fmc => {
        const condition = fmc.medical_conditions || fmc.condition;
        // Check for both 'to_avoid' and 'evitar' to be safe with DB variations
        return condition && userConditionIds.includes(condition.id) && (fmc.relation_type === 'to_avoid' || fmc.relation_type === 'evitar');
      });
      
      if (toAvoid) {
        const condition = toAvoid.medical_conditions || toAvoid.condition;
        return { type: 'condition_avoid', reason: `Evitar por: ${condition?.name || 'Condición'}` };
      }

      const toRecommend = food.food_medical_conditions.find(fmc => {
        const condition = fmc.medical_conditions || fmc.condition;
        // Check for both 'recommended' and 'recomendado'
        return condition && userConditionIds.includes(condition.id) && (fmc.relation_type === 'recommended' || fmc.relation_type === 'recomendado');
      });

      if (toRecommend) {
        const condition = toRecommend.medical_conditions || toRecommend.condition;
        return { type: 'condition_recommend', reason: `Recomendado por: ${condition?.name || 'Condición'}` };
      }
    }
  
    return null;
};