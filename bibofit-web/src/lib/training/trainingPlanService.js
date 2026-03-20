import { supabase } from '@/lib/supabaseClient';
import { getDateKey } from '@/lib/training/dateUtils';

const toIntOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const toFloatOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number.parseFloat(String(value));
  return Number.isNaN(parsed) ? null : parsed;
};

const mapDayBlueprintToPayload = (days = []) =>
  (days || []).map((day) => ({
    name: day.name?.trim() || null,
    blocks: (day.blocks || []).map((block) => ({
      type: block.type || 'custom',
      name: block.name?.trim() || null,
      exercises: (block.exercises || [])
        .map((exercise) => ({
          exercise_id: toIntOrNull(exercise.exercise_id),
          preferred_equipment_id: toIntOrNull(exercise.preferred_equipment_id),
          target_sets: toIntOrNull(exercise.target_sets) ?? 3,
          target_reps_min: toIntOrNull(exercise.target_reps_min) ?? 8,
          target_reps_max: toIntOrNull(exercise.target_reps_max) ?? 12,
          progression_increment_kg: toIntOrNull(exercise.progression_increment_kg) ?? 5,
          backoff_percentage: toFloatOrNull(exercise.backoff_percentage) ?? 0.8,
          is_key_exercise: Boolean(exercise.is_key_exercise),
          notes: exercise.notes?.trim() || null,
          target_rir: toIntOrNull(exercise.target_rir),
          tempo: exercise.tempo?.trim() || null,
        }))
        .filter((exercise) => exercise.exercise_id !== null),
    })),
  }));

export const getTrainingZoneCatalogs = async () => {
  const [
    objectivesRes,
    patternsRes,
    musclesRes,
    jointsRes,
    exercisesRes,
    equipmentRes,
  ] = await Promise.all([
    supabase
      .from('training_objectives')
      .select('id, code, name, description, display_order')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .order('id', { ascending: true }),
    supabase
      .from('training_movement_patterns')
      .select('id, code, name')
      .order('name', { ascending: true }),
    supabase
      .from('muscles')
      .select('id, name')
      .order('name', { ascending: true }),
    supabase
      .from('joints')
      .select('id, name')
      .order('name', { ascending: true }),
    supabase
      .from('exercises')
      .select('id, name, equipment_id, default_weight')
      .order('name', { ascending: true }),
    supabase
      .from('equipment')
      .select('id, name')
      .order('name', { ascending: true }),
  ]);

  if (objectivesRes.error) throw objectivesRes.error;
  if (patternsRes.error) throw patternsRes.error;
  if (musclesRes.error) throw musclesRes.error;
  if (jointsRes.error) throw jointsRes.error;
  if (exercisesRes.error) throw exercisesRes.error;
  if (equipmentRes.error) throw equipmentRes.error;

  return {
    objectives: objectivesRes.data || [],
    movementPatterns: patternsRes.data || [],
    muscles: musclesRes.data || [],
    joints: jointsRes.data || [],
    exercises: exercisesRes.data || [],
    equipment: equipmentRes.data || [],
  };
};

export const getTrainingZoneSnapshot = async (userId, dateKey = getDateKey()) => {
  if (!userId) {
    return {
      activeMesocycle: null,
      weeklyRoutine: null,
      days: [],
      blocks: [],
      blockExercises: [],
      microcycles: [],
      microcycleFocuses: [],
      muscleTargets: [],
      nextSessionDay: null,
    };
  }

  const { data: mesocycles, error: mesocyclesError } = await supabase
    .from('mesocycles')
    .select('id, user_id, name, objective, objective_id, start_date, end_date, sessions_per_week')
    .eq('user_id', userId)
    .order('start_date', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false });

  if (mesocyclesError) throw mesocyclesError;

  const orderedMesocycles = mesocycles || [];
  const activeMesocycle =
    orderedMesocycles.find((m) => {
      const startsOk = !m.start_date || m.start_date <= dateKey;
      const endsOk = !m.end_date || m.end_date >= dateKey;
      return startsOk && endsOk;
    }) || orderedMesocycles[0] || null;

  if (!activeMesocycle) {
    return {
      activeMesocycle: null,
      weeklyRoutine: null,
      days: [],
      blocks: [],
      blockExercises: [],
      microcycles: [],
      microcycleFocuses: [],
      nextSessionDay: null,
    };
  }

  const { data: routines, error: routinesError } = await supabase
    .from('training_weekly_routines')
    .select('id, mesocycle_id, name, sessions_per_week, is_default, created_at')
    .eq('mesocycle_id', activeMesocycle.id)
    .order('is_default', { ascending: false })
    .order('id', { ascending: true });

  if (routinesError) throw routinesError;

  const weeklyRoutine = (routines || [])[0] || null;
  if (!weeklyRoutine) {
    return {
      activeMesocycle,
      weeklyRoutine: null,
      days: [],
      blocks: [],
      blockExercises: [],
      microcycles: [],
      microcycleFocuses: [],
      nextSessionDay: null,
    };
  }

  const { data: days, error: daysError } = await supabase
    .from('training_weekly_days')
    .select('id, weekly_routine_id, day_index, name, created_at')
    .eq('weekly_routine_id', weeklyRoutine.id)
    .order('day_index', { ascending: true })
    .order('id', { ascending: true });

  if (daysError) throw daysError;

  const dayIds = (days || []).map((d) => d.id);

  let blocks = [];
  if (dayIds.length) {
    const { data: blocksData, error: blocksError } = await supabase
      .from('training_weekly_day_blocks')
      .select('id, weekly_day_id, block_order, block_type, name, created_at')
      .in('weekly_day_id', dayIds)
      .order('weekly_day_id', { ascending: true })
      .order('block_order', { ascending: true })
      .order('id', { ascending: true });

    if (blocksError) throw blocksError;
    blocks = blocksData || [];
  }

  const blockIds = blocks.map((b) => b.id);

  let blockExercises = [];
  if (blockIds.length) {
    const { data: blockExercisesData, error: blockExercisesError } = await supabase
      .from('training_block_exercises')
      .select(
        'id, weekly_day_block_id, exercise_id, exercise_order, preferred_equipment_id, target_sets, target_reps_min, target_reps_max, progression_increment_kg, backoff_percentage, is_key_exercise, notes, created_at'
      )
      .in('weekly_day_block_id', blockIds)
      .order('weekly_day_block_id', { ascending: true })
      .order('exercise_order', { ascending: true })
      .order('id', { ascending: true });

    if (blockExercisesError) throw blockExercisesError;
    blockExercises = blockExercisesData || [];
  }

  const { data: microcycles, error: microcyclesError } = await supabase
    .from('training_microcycles')
    .select('id, mesocycle_id, sequence_index, name, objective_id, objective_notes, start_date, end_date, deload_week, created_at')
    .eq('mesocycle_id', activeMesocycle.id)
    .order('sequence_index', { ascending: true })
    .order('id', { ascending: true });

  if (microcyclesError) throw microcyclesError;

  const microcycleIds = (microcycles || []).map((m) => m.id);

  let microcycleFocuses = [];
  if (microcycleIds.length) {
    const { data: focusesData, error: focusesError } = await supabase
      .from('training_microcycle_block_focuses')
      .select('id, microcycle_id, weekly_day_block_id, focus_type, movement_pattern_id, muscle_id, joint_id, focus_exercise_id, key_exercise_id, notes, created_at')
      .in('microcycle_id', microcycleIds)
      .order('microcycle_id', { ascending: true })
      .order('id', { ascending: true });

    if (focusesError) throw focusesError;
    microcycleFocuses = focusesData || [];
  }

  const { data: nextSessionRows, error: nextSessionError } = await supabase.rpc('training_get_next_session_day', {
    p_user_id: userId,
    p_on_date: dateKey,
  });

  if (nextSessionError) throw nextSessionError;

  return {
    activeMesocycle,
    weeklyRoutine,
    days: days || [],
    blocks,
    blockExercises,
    microcycles: microcycles || [],
    microcycleFocuses,
    nextSessionDay: (nextSessionRows || [])[0] || null,
  };
};

export const createMesocycleBlueprintV2 = async ({
  userId,
  name,
  objectiveId,
  startDate,
  endDate,
  weeklyRoutineName,
  days,
  microcycles,
}) => {
  const payloadDays = mapDayBlueprintToPayload(days);

  const payloadMicrocycles = (microcycles || []).map((microcycle, index) => ({
    name: microcycle.name?.trim() || `Microciclo ${index + 1}`,
    start_date: microcycle.start_date || null,
    end_date: microcycle.end_date || null,
    objective_id: toIntOrNull(microcycle.objective_id),
    objective_notes: microcycle.objective_notes?.trim() || null,
    deload_week: Boolean(microcycle.deload_week),
    focuses: (microcycle.focuses || [])
      .map((focus) => ({
        day_index: toIntOrNull(focus.day_index),
        block_order: toIntOrNull(focus.block_order),
        focus_type: focus.focus_type || null,
        movement_pattern_id: toIntOrNull(focus.movement_pattern_id),
        muscle_id: toIntOrNull(focus.muscle_id),
        joint_id: toIntOrNull(focus.joint_id),
        focus_exercise_id: toIntOrNull(focus.focus_exercise_id),
        key_exercise_id: toIntOrNull(focus.key_exercise_id),
        notes: focus.notes?.trim() || null,
      }))
      .filter((focus) => focus.day_index && focus.block_order && focus.focus_type),
  }));

  const { data, error } = await supabase.rpc('training_create_mesocycle_blueprint_v2', {
    p_name: name?.trim() || null,
    p_objective_id: toIntOrNull(objectiveId),
    p_start_date: startDate || null,
    p_end_date: endDate || null,
    p_days: payloadDays,
    p_user_id: userId,
    p_weekly_routine_name: weeklyRoutineName?.trim() || null,
    p_microcycles: payloadMicrocycles,
  });

  if (error) throw error;
  return data;
};

export const createWeeklyRoutineQuickstartV2 = async ({
  userId,
  weeklyRoutineName,
  cycleDays,
  objectiveId,
  startDate,
  days,
  muscleTargets = [],
}) => {
  const payloadDays = mapDayBlueprintToPayload(days);

  const { data, error } = await supabase.rpc('training_create_weekly_routine_quickstart_v2', {
    p_weekly_routine_name: weeklyRoutineName?.trim() || null,
    p_cycle_days: toIntOrNull(cycleDays),
    p_days: payloadDays,
    p_objective_id: toIntOrNull(objectiveId),
    p_start_date: startDate || null,
    p_user_id: userId,
    p_muscle_targets: (muscleTargets || []).map((item) => ({
      muscle_id: toIntOrNull(item.muscle_id),
      target_sets: toFloatOrNull(item.target_sets),
    })),
  });

  if (error) throw error;
  return data;
};

export { getDateKey };
