
export const ONBOARDING_STEPS = [
  {
    id: 'intro',
    type: 'intro',
    title: 'Bienvenido',
    description: 'Vamos a configurar tu perfil para ofrecerte la mejor experiencia.',
    nextStepId: 'personal-data'
  },
  {
    id: 'personal-data',
    type: 'form',
    title: 'Datos Personales',
    description: 'Cuéntanos un poco sobre ti.',
    fieldKeys: ['full_name', 'phone'],
    nextStepId: 'physical-data',
    tableName: 'profiles'
  },
  {
    id: 'physical-data',
    type: 'form',
    title: 'Datos Físicos',
    description: 'Necesitamos estos datos para calcular tus necesidades calóricas.',
    fieldKeys: ['birth_date', 'sex', 'height_cm', 'current_weight_kg', 'activity_level_id'],
    nextStepId: 'diet_objective_history',
    tableName: 'profiles'
  },
  {
    id: 'diet_objective_history',
    type: 'form',
    title: 'Objetivo de Dieta',
    description: 'Define tus metas respecto a la dieta y experiencia previa.',
    nextStepId: 'diet_meals_preferences',
    tableName: 'diet_preferences' 
  },
  {
    id: 'diet_meals_preferences',
    type: 'form',
    title: 'Tus Comidas',
    description: 'Organiza tu día: ¿Qué comidas sueles hacer?',
    nextStepId: 'diet_restrictions',
    tableName: 'diet_preferences'
  },
  {
    id: 'diet_restrictions',
    type: 'form',
    title: 'Restricciones',
    description: 'Alergias, intolerancias o condiciones médicas.',
    nextStepId: 'diet_preferences',
    tableName: 'diet_preferences'
  },
  {
    id: 'diet_preferences',
    type: 'form',
    title: 'Gustos',
    description: '¿Qué alimentos te encantan y cuáles prefieres evitar?',
    nextStepId: 'completion',
    tableName: 'diet_preferences'
  },
  {
    id: 'completion',
    type: 'completion',
    title: '¡Todo Listo!',
    description: 'Has completado la configuración inicial.',
    nextStepId: null
  }
];

export const getStepConfig = (stepId) => ONBOARDING_STEPS.find(s => s.id === stepId) || ONBOARDING_STEPS[0];
