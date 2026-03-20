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
            is_key_exercise, notes, progression_increment_kg,
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
