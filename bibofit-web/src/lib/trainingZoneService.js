import { format } from 'date-fns';
import { supabase } from '@/lib/supabaseClient';

const sortRoutines = (routines = []) => {
  return [...routines].sort((a, b) => {
    const aIdx = a.day_index ?? Number.MAX_SAFE_INTEGER;
    const bIdx = b.day_index ?? Number.MAX_SAFE_INTEGER;
    if (aIdx !== bIdx) return aIdx - bIdx;
    return (a.id ?? 0) - (b.id ?? 0);
  });
};

const sortSets = (sets = []) => {
  return [...sets].sort((a, b) => (a.set_no ?? 0) - (b.set_no ?? 0));
};

export const getDateKey = (date = new Date()) => format(date, 'yyyy-MM-dd');

export const getActiveMesocycleWithRoutines = async (userId, dateKey = getDateKey()) => {
  if (!userId) return { mesocycle: null, routines: [] };

  const { data: mesocycles, error: mesocycleError } = await supabase
    .from('mesocycles')
    .select('id, name, objective, start_date, end_date, sessions_per_week')
    .eq('user_id', userId)
    .order('start_date', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false });

  if (mesocycleError) throw mesocycleError;

  const activeMesocycle = (mesocycles || []).find((m) => {
    const startsOk = !m.start_date || m.start_date <= dateKey;
    const endsOk = !m.end_date || m.end_date >= dateKey;
    return startsOk && endsOk;
  });

  if (!activeMesocycle) return { mesocycle: null, routines: [] };

  const { data: routines, error: routinesError } = await supabase
    .from('routines')
    .select('id, mesocycle_id, name, day_index, day_type, focus')
    .eq('mesocycle_id', activeMesocycle.id);

  if (routinesError) throw routinesError;

  return { mesocycle: activeMesocycle, routines: sortRoutines(routines || []) };
};

export const getNextRoutineInCycle = async (userId, routines = []) => {
  if (!userId || !routines.length) return null;

  const orderedRoutines = sortRoutines(routines);
  const routineIds = orderedRoutines.map((r) => r.id);

  const { data: latestWorkouts, error } = await supabase
    .from('workouts')
    .select('id, routine_id, performed_on')
    .eq('user_id', userId)
    .in('routine_id', routineIds)
    .order('performed_on', { ascending: false })
    .order('id', { ascending: false })
    .limit(1);

  if (error) throw error;

  const latest = latestWorkouts?.[0];
  if (!latest) return orderedRoutines[0];

  const lastIdx = orderedRoutines.findIndex((r) => r.id === latest.routine_id);
  if (lastIdx < 0) return orderedRoutines[0];

  return orderedRoutines[(lastIdx + 1) % orderedRoutines.length];
};

export const ensureWorkoutForRoutine = async (userId, routineId, dateKey = getDateKey()) => {
  if (!userId || !routineId) return null;

  const { data: existing, error: existingError } = await supabase
    .from('workouts')
    .select('id, routine_id, performed_on')
    .eq('user_id', userId)
    .eq('routine_id', routineId)
    .eq('performed_on', dateKey)
    .order('id', { ascending: false })
    .limit(1);

  if (existingError) throw existingError;
  if (existing?.[0]?.id) return existing[0].id;

  const { data: createdWorkoutId, error: createError } = await supabase.rpc('create_workout_from_routine', {
    p_routine_id: routineId,
    p_performed_on: dateKey,
  });

  if (createError) throw createError;
  if (createdWorkoutId) return createdWorkoutId;

  const { data: fallback, error: fallbackError } = await supabase
    .from('workouts')
    .select('id')
    .eq('user_id', userId)
    .eq('routine_id', routineId)
    .eq('performed_on', dateKey)
    .order('id', { ascending: false })
    .limit(1);

  if (fallbackError) throw fallbackError;
  return fallback?.[0]?.id ?? null;
};

const getWorkoutExercisesBase = async (workoutId) => {
  const { data, error } = await supabase
    .from('workout_exercises')
    .select(`
      id,
      workout_id,
      sequence,
      exercise_id,
      performed_equipment_id,
      prescribed_sets,
      prescribed_reps_min,
      prescribed_reps_max,
      exercises!workout_exercises_exercise_id_fkey(id, name, technique),
      equipment!workout_exercises_performed_equipment_id_fkey(id, name)
    `)
    .eq('workout_id', workoutId)
    .order('sequence', { ascending: true })
    .order('id', { ascending: true });

  if (error) throw error;
  return data || [];
};

const getWorkoutSets = async (workoutExerciseIds = []) => {
  if (!workoutExerciseIds.length) return [];

  const { data, error } = await supabase
    .from('exercise_sets')
    .select('id, workout_exercise_id, set_no, reps, weight, rir, target_reps_min, target_reps_max, target_weight, is_warmup')
    .in('workout_exercise_id', workoutExerciseIds);

  if (error) throw error;
  return sortSets(data || []);
};

const getPreviousPerformanceMap = async (userId, currentWorkoutId, currentWorkoutExercises = []) => {
  if (!userId || !currentWorkoutExercises.length) return new Map();

  const exerciseIds = [...new Set(currentWorkoutExercises.map((item) => item.exercise_id).filter(Boolean))];
  if (!exerciseIds.length) return new Map();

  const { data: recentWorkouts, error: workoutsError } = await supabase
    .from('workouts')
    .select('id, performed_on')
    .eq('user_id', userId)
    .neq('id', currentWorkoutId)
    .order('performed_on', { ascending: false })
    .order('id', { ascending: false })
    .limit(160);

  if (workoutsError) throw workoutsError;
  if (!recentWorkouts?.length) return new Map();

  const workoutOrder = new Map(recentWorkouts.map((w, idx) => [w.id, idx]));
  const workoutDate = new Map(recentWorkouts.map((w) => [w.id, w.performed_on]));
  const recentWorkoutIds = recentWorkouts.map((w) => w.id);

  const { data: recentWorkoutExercises, error: workoutExercisesError } = await supabase
    .from('workout_exercises')
    .select('id, workout_id, exercise_id, performed_equipment_id')
    .in('workout_id', recentWorkoutIds)
    .in('exercise_id', exerciseIds);

  if (workoutExercisesError) throw workoutExercisesError;
  if (!recentWorkoutExercises?.length) return new Map();

  const sortedRecentExerciseRows = [...recentWorkoutExercises].sort((a, b) => {
    const aOrder = workoutOrder.get(a.workout_id) ?? Number.MAX_SAFE_INTEGER;
    const bOrder = workoutOrder.get(b.workout_id) ?? Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return b.id - a.id;
  });

  const selectedPreviousByCurrentWorkoutExercise = new Map();
  for (const current of currentWorkoutExercises) {
    const sameExercise = sortedRecentExerciseRows.filter((row) => row.exercise_id === current.exercise_id);
    const preferred = current.performed_equipment_id
      ? sameExercise.find((row) => row.performed_equipment_id === current.performed_equipment_id)
      : null;
    const fallback = sameExercise[0];
    const selected = preferred || fallback;
    if (!selected) continue;
    selectedPreviousByCurrentWorkoutExercise.set(current.id, {
      previousWorkoutExerciseId: selected.id,
      performed_on: workoutDate.get(selected.workout_id) || null,
      performed_equipment_id: selected.performed_equipment_id ?? null,
      equipment_match: current.performed_equipment_id
        ? selected.performed_equipment_id === current.performed_equipment_id
        : false,
    });
  }

  const previousWorkoutExerciseIds = [
    ...new Set(
      [...selectedPreviousByCurrentWorkoutExercise.values()]
        .map((item) => item.previousWorkoutExerciseId)
        .filter(Boolean)
    ),
  ];

  const previousSets = await getWorkoutSets(previousWorkoutExerciseIds);
  const previousSetsByWorkoutExercise = previousSets.reduce((acc, setRow) => {
    if (!acc.has(setRow.workout_exercise_id)) acc.set(setRow.workout_exercise_id, []);
    acc.get(setRow.workout_exercise_id).push(setRow);
    return acc;
  }, new Map());

  const result = new Map();
  for (const [currentWorkoutExerciseId, previousMeta] of selectedPreviousByCurrentWorkoutExercise.entries()) {
    result.set(currentWorkoutExerciseId, {
      ...previousMeta,
      sets: sortSets(previousSetsByWorkoutExercise.get(previousMeta.previousWorkoutExerciseId) || []),
    });
  }

  return result;
};

export const getWorkoutSessionPayload = async ({ userId, routineId, dateKey = getDateKey() }) => {
  const workoutId = await ensureWorkoutForRoutine(userId, routineId, dateKey);
  if (!workoutId) return { workoutId: null, exercises: [] };

  const workoutExercises = await getWorkoutExercisesBase(workoutId);
  const workoutExerciseIds = workoutExercises.map((item) => item.id);
  const setRows = await getWorkoutSets(workoutExerciseIds);
  const setsByWorkoutExercise = setRows.reduce((acc, row) => {
    if (!acc.has(row.workout_exercise_id)) acc.set(row.workout_exercise_id, []);
    acc.get(row.workout_exercise_id).push(row);
    return acc;
  }, new Map());

  const previousPerformanceMap = await getPreviousPerformanceMap(userId, workoutId, workoutExercises);

  const mergedExercises = workoutExercises.map((item) => ({
    ...item,
    sets: sortSets(setsByWorkoutExercise.get(item.id) || []),
    history: previousPerformanceMap.get(item.id) || null,
  }));

  return { workoutId, exercises: mergedExercises };
};

export const saveExerciseSet = async (setId, { weight, reps, rir }) => {
  const payload = { weight, reps };
  if (rir !== undefined) payload.rir = rir;

  const { data, error } = await supabase
    .from('exercise_sets')
    .update(payload)
    .eq('id', setId)
    .select('id, weight, reps, rir')
    .single();

  if (error) throw error;
  return data;
};
