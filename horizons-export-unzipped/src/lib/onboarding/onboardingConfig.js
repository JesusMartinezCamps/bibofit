export const ONBOARDING_STEPS = [
  {
    id: 'intro',
    type: 'intro',
    title: 'Bienvenido',
    description: 'Vamos a configurar tu perfil para ofrecerte la mejor experiencia.',
    nextStepId: 'personal-data',
    showModal: false,
    modalContent: null,
    component: 'IntroStep'
  },
  {
    id: 'personal-data',
    type: 'form',
    title: 'Datos Personales',
    description: 'Cuéntanos un poco sobre ti.',
    fieldKeys: ['full_name', 'phone'],
    nextStepId: 'physical-data',
    tableName: 'profiles',
    showModal: false,
    modalContent: null,
    component: 'PersonalDataStep'
  },
  {
    id: 'physical-data',
    type: 'form',
    title: 'Datos Físicos',
    description: 'Necesitamos estos datos para calcular tus necesidades calóricas.',
    fieldKeys: ['birth_date', 'sex', 'height_cm', 'current_weight_kg', 'activity_level_id'],
    nextStepId: 'diet_objective_history',
    tableName: 'profiles',
    showModal: true,
    modalContent: {
      title: "Datos Físicos",
      description: "Con tus datos físicos bibofit podrá calcular tus requerimientos calóricos.",
      tips: ["Peso en ayunas si puedes", "Sé honesto con tu nivel de actividad, pero luego se podrá cambiar no te estreses"]
    },
    component: 'PhysicalDataStep'
  },
  {
    id: 'diet_objective_history',
    type: 'form',
    title: 'Objetivo de Dieta',
    description: 'Define tus metas respecto a la dieta y experiencia previa.',
    nextStepId: 'diet_meals_preferences',
    tableName: 'diet_preferences',
    showModal: true,
    modalContent: {
      title: "Qué quieres y de dónde vienes",
      description: "Define tu objetivo. Y dime qué has intentado antes. No empezamos desde cero, empezamos desde tu historia.",
      tips: ["Elige un objetivo realista", "Menciona qué te funcionó antes", "Aprendemos de lo que ya probaste"]
    },
    component: 'DietObjectiveStep'
  },
  {
    id: 'diet_meals_preferences',
    type: 'form',
    title: 'Tus Comidas',
    description: 'Organiza tu día: ¿Qué comidas sueles hacer?',
    nextStepId: 'diet_restrictions',
    tableName: 'diet_preferences',
    showModal: true,
    modalContent: {
      title: "Tu estructura diaria",
      description: "No existe el número mágico de comidas. Existe la frecuenta que no te cuesta mantener para que bibofit pueda adaptar el plan a tu rutina.",
      tips: ["Piensa en tu horario de trabajo/estudio", "No hay un número 'perfecto', elige lo sostenible"]
    },
    component: 'DietMealsStep'
  },
  {
    id: 'diet_restrictions',
    type: 'form',
    title: 'Restricciones',
    description: 'Alergias, intolerancias o condiciones médicas.',
    nextStepId: 'diet_preferences',
    tableName: 'diet_preferences',
    showModal: true,
    modalContent: {
      title: "Tu salud es lo primero",
      description: "Si hay patologías o intolerancias, las respetamos.",
      tips: ["Incluye intolerancias confirmadas", "Si tienes dudas, consulta a tu médico"]
    },
    component: 'DietRestrictionsStep'
  },
  {
    id: 'diet_preferences',
    type: 'form',
    title: 'Gustos',
    description: '¿Qué alimentos te encantan y cuáles prefieres evitar?',
    nextStepId: 'meal-macro-distribution',
    tableName: 'diet_preferences',
    showModal: true,
    modalContent: {
      title: "Haz que te guste la dieta, ese es el secreto para que todo funcione",
      description: "Aquí no hay alimentos prohibidos. Solo elecciones inteligentes que encajen contigo. Un plan funciona mejor si lo disfrutas.",
      tips: ["Añade lo que disfrutas, no te cortes", "Quita lo que no estás dispuesto a comer, ¡pero no te pases!"]
    },
    component: 'DietPreferencesStep'
  },
  {
    id: 'meal-macro-distribution',
    title: 'Asignar Plantilla de Dieta',
    description: 'Elige una plantilla de macronutrientes que se adapte a tu objetivo',
    component: 'MealMacroDistributionStep',
    showModal: true,
    modalContent: {
      title: 'Calorías y Macronutrientes diarios',
      description: 'Bibofit ha calculado en función de tus datos unas calorías diarias objetivo, pero puedes introducir un valor manual si ya has trackeado tus calorías antes y sabes en qué rango estás.',
      videoUrl: null,
      tips: ['Bibofit recomienda este reparto, no tienes la necesidad de modificarlo ahora', 'Puedes cambiar esto más tarde', 'Elige según tu objetivo']
    },
    nextStepId: 'meal-adjustment',
    tableName: 'assignment_progress' 
  },
  {
    id: 'meal-adjustment',
    title: 'Ajustar Macros',
    description: 'Ajusta los detalles finos de tu distribución calórica.',
    component: 'MealAdjustmentStep',
    showModal: true,
    modalContent: {
      title: 'Ajuste Fino',
      description: 'Aquí puedes modificar manualmente las calorías y macronutrientes por cada comida si tienes requerimientos muy específicos.',
      videoUrl: null,
      tips: ['Bibofit recomienda un reparto equilibrado, sencillo y sostenible','Mueve los sliders de arriba a abajo para realizar los ajustes, el sistema se encargará de mantener cuadradas las cantidades' ,'Modificalo solo si eres avanzado']
    },
    nextStepId: 'completion',
    tableName: 'assignment_progress'
  },
  {
    id: 'completion',
    type: 'completion',
    title: '¡Todo Listo!',
    description: 'Has completado la configuración inicial.',
    nextStepId: null,
    showModal: false,
    modalContent: null,
    component: 'CompletionStep'
  }
];

export const getStepConfig = (stepId) => ONBOARDING_STEPS.find(s => s.id === stepId) || ONBOARDING_STEPS[0];