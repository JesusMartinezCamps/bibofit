import { addDays, subDays } from 'date-fns';
import { getDateKey } from '@/lib/training/dateUtils';
import {
  getCompletedSetsByExerciseInRange,
  getDailyStepsInRange,
  getExerciseMuscleMap,
} from '@/lib/training/trainingAnalyticsService';

export const buildTrainingVisualizerMetrics = async ({
  userId,
  currentDate,
  snapshotData,
  catalogsData,
  timelineRows = [],
}) => {
  if (!userId) {
    return {
      volumeRows: [],
      volumeTotal: { actual: 0, target: 0 },
      prProgress: { actual: 0, target: 1 },
      stepProgress: { actual: 0, target: 70000 },
      todayStepsInput: '',
    };
  }

  const visualizerRangeStart = subDays(currentDate, 3);
  const visualizerRangeEnd = addDays(currentDate, 3);
  const startDate = getDateKey(visualizerRangeStart);
  const endDate = getDateKey(visualizerRangeEnd);

  const keyExerciseIds = (snapshotData?.blockExercises || [])
    .filter((exercise) => exercise.is_key_exercise)
    .map((exercise) => exercise.exercise_id)
    .filter(Boolean);

  const uniqueExerciseIds = [
    ...new Set((snapshotData?.blockExercises || []).map((exercise) => exercise.exercise_id).filter(Boolean)),
  ];

  const [muscleMapRows, completedSetRows, dailyStepsRows] = await Promise.all([
    getExerciseMuscleMap(uniqueExerciseIds),
    getCompletedSetsByExerciseInRange({
      userId,
      startDate,
      endDate,
    }),
    getDailyStepsInRange({
      userId,
      startDate,
      endDate,
    }),
  ]);

  const muscleNameById = new Map((catalogsData?.muscles || []).map((m) => [m.id, m.name]));

  const musclesByExerciseId = new Map();
  muscleMapRows.forEach((row) => {
    const list = musclesByExerciseId.get(row.exercise_id) || [];
    list.push(row.muscle_id);
    musclesByExerciseId.set(row.exercise_id, list);
  });

  const completedByExercise = new Map();
  completedSetRows.forEach((row) => {
    const exerciseId = row?.workout_exercises?.exercise_id;
    if (!exerciseId) return;
    completedByExercise.set(exerciseId, (completedByExercise.get(exerciseId) || 0) + 1);
  });

  const actualVolumeByMuscle = new Map();
  completedByExercise.forEach((completedSets, exerciseId) => {
    const muscleIds = musclesByExerciseId.get(exerciseId) || [];
    const divisor = muscleIds.length || 1;
    if (!muscleIds.length) return;
    muscleIds.forEach((muscleId) => {
      actualVolumeByMuscle.set(
        muscleId,
        (actualVolumeByMuscle.get(muscleId) || 0) + completedSets / divisor
      );
    });
  });

  const targetVolumeByMuscle = new Map();
  (snapshotData?.blockExercises || []).forEach((exercise) => {
    if (!exercise?.exercise_id) return;
    const muscleIds = musclesByExerciseId.get(exercise.exercise_id) || [];
    if (!muscleIds.length) return;
    const setsPerMuscle = Number(exercise.target_sets || 0) / muscleIds.length;
    muscleIds.forEach((muscleId) => {
      targetVolumeByMuscle.set(muscleId, (targetVolumeByMuscle.get(muscleId) || 0) + setsPerMuscle);
    });
  });

  const volumeKeys = new Set([
    ...Array.from(actualVolumeByMuscle.keys()),
    ...Array.from(targetVolumeByMuscle.keys()),
  ]);

  const volumeRows = Array.from(volumeKeys)
    .map((muscleId) => ({
      id: String(muscleId),
      label: muscleNameById.get(muscleId) || `Músculo ${muscleId}`,
      actual: Number(actualVolumeByMuscle.get(muscleId) || 0),
      target: Number(targetVolumeByMuscle.get(muscleId) || 0),
    }))
    .filter((row) => row.actual > 0 || row.target > 0)
    .sort((a, b) => {
      const targetDiff = b.target - a.target;
      if (targetDiff !== 0) return targetDiff;
      return b.actual - a.actual;
    });

  let weeklyPrCount = 0;
  timelineRows.forEach((item) => {
    const eventDate = item?.event_date;
    if (!eventDate || eventDate < startDate || eventDate > endDate) return;

    const explicitPrCount = Number(item?.pr_count || 0);
    if (explicitPrCount > 0) {
      weeklyPrCount += explicitPrCount;
      return;
    }

    if (item?.has_pr) {
      weeklyPrCount += 1;
      return;
    }

    // Backward compatibility: if backend has not exposed PR flags yet.
    const fallbackHasPr = Boolean(
      item.completed_key_exercises
      && item.total_key_exercises
      && item.completed_key_exercises >= item.total_key_exercises
    );
    if (fallbackHasPr) weeklyPrCount += 1;
  });

  const stepsByDate = new Map();
  let weeklySteps = 0;
  dailyStepsRows.forEach((row) => {
    stepsByDate.set(row.step_date, Number(row.steps || 0));
    weeklySteps += Number(row.steps || 0);
  });
  const todayDateKey = getDateKey(new Date());

  return {
    volumeRows,
    volumeTotal: {
      actual: volumeRows.reduce((acc, row) => acc + Number(row.actual || 0), 0),
      target: volumeRows.reduce((acc, row) => acc + Number(row.target || 0), 0),
    },
    prProgress: {
      actual: weeklyPrCount,
      target: Math.max(1, [...new Set(keyExerciseIds)].length),
    },
    stepProgress: {
      actual: weeklySteps,
      target: 70000,
    },
    todayStepsInput: String(stepsByDate.get(todayDateKey) ?? ''),
  };
};
