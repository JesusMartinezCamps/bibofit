import { supabase } from '@/lib/supabaseClient';
import { calculateGerFromProfile } from '@/lib/metabolismEngine';

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
  const sexLower = sex.toLowerCase();
  
  if (sexLower === 'hombre' || sexLower === 'male') {
    // Hombres: GER = 10 × peso (kg) + 6.25 × altura (cm) – 5 × edad (años) + 5
    ger = 10 * weightNum + 6.25 * heightNum - 5 * ageNum + 5;
  } else if (sexLower === 'mujer' || sexLower === 'female') {
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
 * @param {Object} profileData - Datos del perfil del usuario (opcional, para evitar fetch extra)
 * @returns {Object} - Resultado del cálculo y guardado
 */
export const calculateAndSaveMetabolism = async (userId, profileData = null) => {
  console.group('🧮 [MetabolismCalculator] calculateAndSaveMetabolism');
  try {
    // 1. Obtener datos del perfil si no se proporcionan
    let profile = profileData;
    if (!profile) {
      console.log('Fetching profile data...');
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

    // 2. Resolver factor de actividad si solo tenemos el ID
    if (!profile.activity_levels?.factor && profile.activity_level_id) {
      console.log('Fetching activity level factor...');
      const { data: activityLevel, error: activityLevelError } = await supabase
        .from('activity_levels')
        .select('factor')
        .eq('id', profile.activity_level_id)
        .single();

      if (activityLevelError) throw activityLevelError;
      profile.activity_levels = activityLevel;
    }

    // 3. Calcular
    const age = calculateAge(profile.birth_date);
    console.log('Age calculated:', age);

    const advancedResult = calculateGerFromProfile({
      profile,
      age
    });

    // Compatibility path: preserve the legacy Mifflin calculation if advanced logic
    // cannot produce a valid GER value.
    const legacyGer = calculateGER({
      weight: profile.current_weight_kg,
      height: profile.height_cm,
      age,
      sex: profile.sex
    });

    const ger = advancedResult.ger ?? legacyGer;
    console.log('GER calculated:', ger, advancedResult.formulaKey ? `(${advancedResult.formulaKey})` : '(legacy)');

    let tdee = null;
    if (ger && profile.activity_levels?.factor) {
      tdee = calculateTDEE(ger, profile.activity_levels.factor);
    }
    console.log('TDEE calculated:', tdee);

    if (ger && tdee) {
        // 4. Guardar
        console.log('Saving calculations to DB...');
        const { error: updateError } = await supabase
        .from('profiles')
        .update({
            ger_kcal: ger,
            tdee_kcal: tdee,
            ger_equation_key: advancedResult.formulaKey || (legacyGer ? 'mifflin_st_jeor_weight' : null)
        })
        .eq('user_id', userId);

        if (updateError) throw updateError;
        console.log('✅ Metabolism saved successfully');
    } else {
        console.warn('⚠️ Could not calculate metabolism due to missing data');
    }

    return {
      success: true,
      ger,
      tdee,
      age,
      gerFormulaKey: advancedResult.formulaKey || (legacyGer ? 'mifflin_st_jeor_weight' : null),
      recommendedFormulaKeys: advancedResult.recommendedFormulaKeys || [],
      formulaSource: advancedResult.formulaSource || 'legacy',
      bodyComposition: advancedResult.bodyComposition || null,
      missingData: !ger ? getMissingDataMessage(profile, age) : null
    };

  } catch (error) {
    console.error('❌ Error calculating metabolism:', error);
    return {
      success: false,
      error: error.message,
      ger: null,
      tdee: null
    };
  } finally {
    console.groupEnd();
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
