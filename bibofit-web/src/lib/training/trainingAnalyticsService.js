import { supabase } from '@/lib/supabaseClient';
import { getDateKey } from '@/lib/training/dateUtils';

/**
 * Eventos de timeline para hitos semanales/diarios de entrenamiento.
 */
export const getWorkoutTimelineEvents = async ({
  userId = null,
  startDate = getDateKey(new Date()),
  endDate = getDateKey(new Date()),
}) => {
  const { data, error } = await supabase.rpc('training_get_workout_timeline_events', {
    p_user_id: userId,
    p_start_date: startDate,
    p_end_date: endDate,
  });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
};

export const getExerciseMuscleMap = async (exerciseIds = []) => {
  if (!exerciseIds.length) return [];
  const { data, error } = await supabase
    .from('exercise_muscles')
    .select('exercise_id, muscle_id, muscles(id, name)')
    .in('exercise_id', exerciseIds);

  if (error) throw error;
  return data || [];
};

export const getLatestExercisePerformanceByUser = async ({ userId, exerciseIds = [] }) => {
  if (!userId || !exerciseIds.length) return [];

  const { data, error } = await supabase
    .from('workout_exercises')
    .select(`
      exercise_id,
      workout_id,
      workouts!inner(user_id, performed_on),
      exercise_sets(set_no, weight, reps, rir)
    `)
    .in('exercise_id', exerciseIds)
    .eq('workouts.user_id', userId);

  if (error) throw error;
  return data || [];
};

export const getCompletedSetsByExerciseInRange = async ({
  userId = null,
  startDate = getDateKey(new Date()),
  endDate = getDateKey(new Date()),
}) => {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('exercise_sets')
    .select(`
      id,
      workout_exercise_id,
      completed_at,
      workout_exercises!inner(
        exercise_id,
        workouts!inner(user_id, performed_on)
      )
    `)
    .not('completed_at', 'is', null)
    .eq('workout_exercises.workouts.user_id', userId)
    .gte('workout_exercises.workouts.performed_on', startDate)
    .lte('workout_exercises.workouts.performed_on', endDate);

  if (error) throw error;
  return data || [];
};

export const getDailyStepsInRange = async ({
  userId = null,
  startDate = getDateKey(new Date()),
  endDate = getDateKey(new Date()),
}) => {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('training_daily_steps')
    .select('id, user_id, step_date, steps, source')
    .eq('user_id', userId)
    .gte('step_date', startDate)
    .lte('step_date', endDate)
    .order('step_date', { ascending: true });

  if (error) throw error;
  return data || [];
};

export const upsertDailySteps = async ({
  userId = null,
  stepDate = getDateKey(new Date()),
  steps = 0,
  source = 'manual',
}) => {
  if (!userId) throw new Error('userId es requerido');

  const safeSteps = Math.max(0, Number.parseInt(String(steps || 0), 10) || 0);
  const payload = {
    user_id: userId,
    step_date: stepDate,
    steps: safeSteps,
    source: source || 'manual',
  };

  const { data, error } = await supabase
    .from('training_daily_steps')
    .upsert(payload, { onConflict: 'user_id,step_date' })
    .select('id, user_id, step_date, steps, source')
    .single();

  if (error) throw error;
  return data;
};
