import { supabase } from '@/lib/supabaseClient';

/**
 * Calcula la edad basándose en la fecha de nacimiento
 * @param {string} birthDate - Fecha de nacimiento en formato YYYY-MM-DD
 * @returns {number} - Edad en años
 */
export const calculateAge = (birthDate) => {
  if (!birthDate) return null;
  
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age;
};

/**
 * Calcula el Gasto Energético en Reposo (GER) usando la fórmula de Mifflin-St Jeor
 * @param {Object} params - Parámetros para el cálculo
 * @param {number} params.weight - Peso en kilogramos
 * @param {number} params.height - Altura en centímetros
 * @param {number} params.age - Edad en años
 * @param {string} params.sex - Sexo: "Hombre" o "Mujer"
 * @returns {number|null} - GER en kcal o null si faltan datos
 */
export const calculateGER = ({ weight, height, age, sex }) => {
  // Validar que todos los datos estén presentes
  if (!weight || !height || !age || !sex) {
    return null;
  }

  // Convertir a números
  const weightNum = parseFloat(weight);
  const heightNum = parseFloat(height);
  const ageNum = parseInt(age);

  // Validar que los números sean válidos
  if (isNaN(weightNum) || isNaN(heightNum) || isNaN(ageNum)) {
    return null;
  }

  // Fórmula de Mifflin-St Jeor
  let ger;
  if (sex.toLowerCase() === 'hombre' || sex.toLowerCase() === 'male') {
    // Hombres: GER = 10 × peso (kg) + 6.25 × altura (cm) – 5 × edad (años) + 5
    ger = 10 * weightNum + 6.25 * heightNum - 5 * ageNum + 5;
  } else if (sex.toLowerCase() === 'mujer' || sex.toLowerCase() === 'female') {
    // Mujeres: GER = 10 × peso (kg) + 6.25 × altura (cm) – 5 × edad (años) – 161
    ger = 10 * weightNum + 6.25 * heightNum - 5 * ageNum - 161;
  } else {
    return null;
  }

  return Math.round(ger);
};

/**
 * Calcula el Gasto Diario Total de Energía (TDEE)
 * @param {number} ger - Gasto Energético en Reposo
 * @param {number} activityFactor - Factor de actividad
 * @returns {number|null} - TDEE en kcal o null si faltan datos
 */
export const calculateTDEE = (ger, activityFactor) => {
  if (!ger || !activityFactor) {
    return null;
  }

  const gerNum = parseFloat(ger);
  const factorNum = parseFloat(activityFactor);

  if (isNaN(gerNum) || isNaN(factorNum)) {
    return null;
  }

  return Math.round(gerNum * factorNum);
};

/**
 * Obtiene los niveles de actividad disponibles
 * @returns {Array} - Array de niveles de actividad
 */
export const getActivityLevels = async () => {
  try {
    const { data, error } = await supabase
      .from('activity_levels')
      .select('*')
      .order('factor', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching activity levels:', error);
    return [];
  }
};

/**
 * Calcula y guarda GER y TDEE para un usuario
 * @param {string} userId - ID del usuario
 * @param {Object} profileData - Datos del perfil del usuario
 * @returns {Object} - Resultado del cálculo y guardado
 */
export const calculateAndSaveMetabolism = async (userId, profileData = null) => {
  try {
    // Si no se proporcionan datos del perfil, obtenerlos
    let profile = profileData;
    if (!profile) {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          activity_levels(factor)
        `)
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      profile = data;
    }

    // Calcular edad
    const age = calculateAge(profile.birth_date);

    // Calcular GER
    const ger = calculateGER({
      weight: profile.current_weight_kg,
      height: profile.height_cm,
      age: age,
      sex: profile.sex
    });

    // Calcular TDEE
    let tdee = null;
    if (ger && profile.activity_levels?.factor) {
      tdee = calculateTDEE(ger, profile.activity_levels.factor);
    }

    // Guardar los cálculos en el perfil
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        ger_kcal: ger,
        tdee_kcal: tdee
      })
      .eq('user_id', userId);

    if (updateError) throw updateError;

    return {
      success: true,
      ger,
      tdee,
      age,
      missingData: !ger ? getMissingDataMessage(profile, age) : null
    };

  } catch (error) {
    console.error('Error calculating metabolism:', error);
    return {
      success: false,
      error: error.message,
      ger: null,
      tdee: null
    };
  }
};

/**
 * Obtiene el mensaje de datos faltantes
 * @param {Object} profile - Datos del perfil
 * @param {number} age - Edad calculada
 * @returns {string} - Mensaje de datos faltantes
 */
const getMissingDataMessage = (profile, age) => {
  const missing = [];
  
  if (!profile.current_weight_kg) missing.push('peso');
  if (!profile.height_cm) missing.push('altura');
  if (!age) missing.push('fecha de nacimiento');
  if (!profile.sex) missing.push('sexo');

  if (missing.length === 0) return null;

  return `Faltan datos para calcular el metabolismo en reposo: ${missing.join(', ')}.`;
};

/**
 * Formatea el valor con el símbolo ~ para indicar aproximación
 * @param {number} value - Valor a formatear
 * @returns {string} - Valor formateado con símbolo de aproximación
 */
export const formatApproximateValue = (value) => {
  if (!value) return 'No calculado';
  return `~${value}`;
};