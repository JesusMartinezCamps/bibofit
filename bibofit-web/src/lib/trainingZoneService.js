// Compat facade (deprecated): keep old imports working during migration.
// New code should import from:
// - '@/lib/training/trainingPlanService'
// - '@/lib/training/workoutSessionService'
// - '@/lib/training/trainingAnalyticsService'

export {
  getDateKey,
  getTrainingZoneCatalogs,
  getTrainingZoneSnapshot,
  createMesocycleBlueprintV2,
  createWeeklyRoutineQuickstartV2,
} from '@/lib/training/trainingPlanService';

export {
  getWorkoutDayDetail,
  createOrGetWorkoutSession,
  getOrCreateWorkoutSessionPayload,
  getPreviousExerciseSets,
} from '@/lib/training/workoutSessionService';

export { getWorkoutTimelineEvents } from '@/lib/training/trainingAnalyticsService';
