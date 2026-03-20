import { supabase } from '@/lib/supabaseClient';
import { getDateKey } from '@/lib/training/dateUtils';

/**
 * Obtiene todos los ejercicios de un día concreto de la rutina semanal,
 * con nombre del ejercicio, equipo y objetivos de series/reps.
 */
export const getWorkoutDayDetail = async (weeklyDayId) => {
  const [{ data: day, error: dayErr }, { data: blocks, error: blocksErr }] =
    await Promise.all([
      supabase
        .from('training_weekly_days')
        .select('id, day_index, name, weekly_routine_id')
        .eq('id', weeklyDayId)
        .single(),
      supabase
        .from('training_weekly_day_blocks')
        .select(`
          id, block_order, block_type, name,
          training_block_exercises (
            id, exercise_order, target_sets, target_reps_min, target_reps_max,
            target_rir, tempo, is_key_exercise, notes, progression_increment_kg,
            exercises ( id, name, unilateral ),
            equipment:preferred_equipment_id ( id, name )
          )
        `)
        .eq('weekly_day_id', weeklyDayId)
        .order('block_order'),
    ]);

  if (dayErr) throw dayErr;
  if (blocksErr) throw blocksErr;
  return { day, blocks: blocks || [] };
};

/**
 * Crea (o recupera si ya existe hoy) el workout + workout_exercises del día.
 * Devuelve { workoutId, exerciseMap: [{workout_exercise_id, block_exercise_id, exercise_id}] }
 */
export const createOrGetWorkoutSession = async (weeklyDayId) => {
  const { data, error } = await supabase.rpc('create_or_get_workout_session', {
    p_weekly_day_id: weeklyDayId,
    p_on_date: getDateKey(new Date()),
  });
  if (error) throw error;
  const row = (data || [])[0];
  return {
    workoutId: row?.workout_id ?? null,
    exerciseMap: Array.isArray(row?.exercise_map) ? row.exercise_map : [],
  };
};

/**
 * Contrato unificado V2:
 * crea o recupera la sesión y devuelve payload completo del workout
 * (workout + ejercicios + sets + history).
 */
export const getOrCreateWorkoutSessionPayload = async ({
  weeklyDayId,
  onDate = getDateKey(new Date()),
  userId = null,
  forceNew = false,
}) => {
  const { data, error } = await supabase.rpc('training_get_or_create_workout_session', {
    p_training_weekly_day_id: weeklyDayId,
    p_on_date: onDate,
    p_user_id: userId,
    p_force_new: forceNew,
  });

  if (error) throw error;

  return {
    workout: data?.workout || null,
    exercises: Array.isArray(data?.exercises) ? data.exercises : [],
  };
};

export const getWorkoutSessionPayload = async ({ workoutId, userId = null }) => {
  const { data, error } = await supabase.rpc('training_get_workout_session_payload', {
    p_workout_id: workoutId,
    p_user_id: userId,
  });

  if (error) throw error;

  return {
    workout: data?.workout || null,
    exercises: Array.isArray(data?.exercises) ? data.exercises : [],
  };
};

export const createNextWorkoutSession = async ({
  userId = null,
  onDate = getDateKey(new Date()),
  forceNew = false,
}) => {
  const { data, error } = await supabase.rpc('training_create_next_workout', {
    p_user_id: userId,
    p_performed_on: onDate,
    p_force_new: forceNew,
  });

  if (error) throw error;
  return data;
};

/**
 * Devuelve los sets de la sesión anterior para un ejercicio,
 * indexados por set_no → { weight, reps, rir, performed_on }.
 */
export const getPreviousExerciseSets = async (exerciseId, excludeWorkoutId = null) => {
  const { data, error } = await supabase.rpc('get_previous_exercise_sets', {
    p_exercise_id: exerciseId,
    p_exclude_workout_id: excludeWorkoutId,
  });
  if (error) {
    console.warn('getPreviousExerciseSets:', error.message);
    return {};
  }
  return Object.fromEntries((data || []).map((s) => [s.set_no, s]));
};

/**
 * Actualiza la configuración de un ejercicio existente en un bloque de la rutina.
 */
export const updateBlockExerciseConfig = async (blockExerciseId, config) => {
  const toInt = (v) => {
    if (v === null || v === undefined || v === '') return undefined;
    const n = parseInt(String(v), 10);
    return isNaN(n) ? undefined : n;
  };

  const patch = {};
  if (config.target_sets !== undefined) patch.target_sets = toInt(config.target_sets) ?? 3;
  if (config.target_reps_min !== undefined) patch.target_reps_min = toInt(config.target_reps_min) ?? 8;
  if (config.target_reps_max !== undefined) patch.target_reps_max = toInt(config.target_reps_max) ?? 10;
  if ('target_rir' in config) patch.target_rir = config.target_rir === undefined ? null : config.target_rir;
  if ('tempo' in config) patch.tempo = config.tempo || null;
  if ('notes' in config) patch.notes = config.notes || null;
  if ('is_key_exercise' in config) patch.is_key_exercise = Boolean(config.is_key_exercise);
  if ('preferred_equipment_id' in config) {
    const eq = config.preferred_equipment_id;
    patch.preferred_equipment_id = (eq && eq !== 'none') ? (parseInt(String(eq), 10) || null) : null;
  }

  const { error } = await supabase
    .from('training_block_exercises')
    .update(patch)
    .eq('id', blockExerciseId);

  if (error) throw error;
};

/**
 * Añade un nuevo ejercicio a un bloque existente de la rutina.
 * Devuelve el nuevo registro con su id.
 */
export const addExerciseToBlock = async (blockId, { exerciseId, config, exerciseOrder }) => {
  const toInt = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = parseInt(String(v), 10);
    return isNaN(n) ? null : n;
  };

  const { data, error } = await supabase
    .from('training_block_exercises')
    .insert({
      weekly_day_block_id: blockId,
      exercise_id: toInt(exerciseId),
      exercise_order: exerciseOrder ?? 99,
      target_sets: toInt(config.target_sets) ?? 3,
      target_reps_min: toInt(config.target_reps_min) ?? 8,
      target_reps_max: toInt(config.target_reps_max) ?? 10,
      target_rir: config.target_rir ?? null,
      tempo: config.tempo || null,
      notes: config.notes || null,
      is_key_exercise: Boolean(config.is_key_exercise),
      preferred_equipment_id: (config.preferred_equipment_id && config.preferred_equipment_id !== 'none')
        ? (toInt(config.preferred_equipment_id))
        : null,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data;
};
