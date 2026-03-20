import { supabase } from '@/lib/supabaseClient'

/**
 * Servicio de timing para sesiones de entrenamiento.
 *
 * Flujo de llamadas durante una sesión:
 *
 *  1. startWorkout(workoutId)              — al montar la página
 *  2. markWarmupTiming(...)                — al pasar del calentamiento a series de trabajo
 *  3. recordSetCompletion(...) × N         — al completar cada serie
 *  4. recordExerciseTiming(...)            — al completar el ejercicio
 *  5. finishWorkout(workoutId)             — al salir de la sesión
 *
 * Todas las funciones son fire-and-forget (no bloquean la UI).
 * Los errores se loguean pero no se propagan.
 */

async function call(rpcName, params) {
  const { error } = await supabase.rpc(rpcName, params)
  if (error) console.warn(`[exerciseTimingService] ${rpcName}:`, error.message)
}

/**
 * Marca el inicio de la sesión en el workout.
 * Idempotente: solo escribe si started_at era NULL.
 */
export async function startWorkout(workoutId, startedAt = new Date()) {
  if (!workoutId) return
  await call('start_workout_timing', {
    p_workout_id: workoutId,
    p_started_at: startedAt.toISOString(),
  })
}

/**
 * Guarda los timestamps de inicio y fin del calentamiento.
 * Se llama cuando el usuario activa su primera serie de trabajo.
 */
export async function markWarmupTiming(workoutId, warmupStartedAt, warmupEndedAt) {
  if (!workoutId || !warmupStartedAt || !warmupEndedAt) return
  await call('mark_warmup_timing', {
    p_workout_id:        workoutId,
    p_warmup_started_at: warmupStartedAt.toISOString(),
    p_warmup_ended_at:   warmupEndedAt.toISOString(),
  })
}

/**
 * Registra started_at y completed_at de una serie concreta.
 * Se llama justo al pulsar "Serie completada".
 */
export async function recordSetCompletion(setId, startedAt, completedAt) {
  if (!setId || !startedAt || !completedAt) return
  await call('record_set_completion', {
    p_set_id:       setId,
    p_started_at:   startedAt.toISOString(),
    p_completed_at: completedAt.toISOString(),
  })
}

/**
 * Guarda timestamps de inicio/fin del ejercicio completo.
 * Se llama al completar todas las series del ejercicio.
 */
export async function recordExerciseTiming(workoutExerciseId, startedAt, completedAt) {
  if (!workoutExerciseId || !startedAt || !completedAt) return
  await call('record_exercise_timing', {
    p_workout_exercise_id: workoutExerciseId,
    p_started_at:          startedAt.toISOString(),
    p_completed_at:        completedAt.toISOString(),
  })
}

/**
 * Cierra el timing de la sesión completa.
 * Se llama al salir de la página de ejercicio.
 */
export async function finishWorkout(workoutId, endedAt = new Date()) {
  if (!workoutId) return
  await call('finish_workout_timing', {
    p_workout_id: workoutId,
    p_ended_at:   endedAt.toISOString(),
  })
}

/**
 * Obtiene el resumen de timing de un workout ya finalizado.
 * Retorna null si no hay datos.
 */
export async function getWorkoutTimingSummary(workoutId) {
  if (!workoutId) return null
  const { data, error } = await supabase.rpc('get_workout_timing_summary', {
    p_workout_id: workoutId,
  })
  if (error) {
    console.warn('[exerciseTimingService] getWorkoutTimingSummary:', error.message)
    return null
  }
  return data?.[0] ?? null
}

/**
 * Histórico de duraciones de entrenos (para gráficas).
 */
export async function getWorkoutDurationHistory(userId, limit = 30) {
  const { data, error } = await supabase.rpc('get_workout_duration_history', {
    p_user_id: userId,
    p_limit:   limit,
  })
  if (error) {
    console.warn('[exerciseTimingService] getWorkoutDurationHistory:', error.message)
    return []
  }
  return data ?? []
}

/**
 * Hidrata tracking persistido de un ejercicio concreto de la sesión.
 */
export async function getWorkoutExerciseTracking(workoutExerciseId) {
  if (!workoutExerciseId) return null
  const { data, error } = await supabase.rpc('training_get_workout_exercise_tracking', {
    p_workout_exercise_id: workoutExerciseId,
  })
  if (error) {
    console.warn('[exerciseTimingService] training_get_workout_exercise_tracking:', error.message)
    return null
  }
  return data ?? null
}

/**
 * Guarda progreso de una serie (métricas + timing).
 */
export async function upsertWorkoutSetProgress({
  setId,
  weight = null,
  reps = null,
  rir = null,
  startedAt = null,
  completedAt = null,
}) {
  if (!setId) return null

  const { data, error } = await supabase.rpc('training_upsert_workout_set_progress', {
    p_set_id: setId,
    p_weight: weight,
    p_reps: reps,
    p_rir: rir,
    p_started_at: startedAt instanceof Date ? startedAt.toISOString() : null,
    p_completed_at: completedAt instanceof Date ? completedAt.toISOString() : null,
  })

  if (error) {
    console.warn('[exerciseTimingService] training_upsert_workout_set_progress:', error.message)
    return null
  }

  return data ?? null
}

/**
 * Guarda notas de sesión y nota permanente del ejercicio.
 */
export async function upsertWorkoutExerciseNotes({
  workoutExerciseId,
  feedback = null,
  blockExerciseNote = null,
}) {
  if (!workoutExerciseId) return null

  const { data, error } = await supabase.rpc('training_upsert_workout_exercise_notes', {
    p_workout_exercise_id: workoutExerciseId,
    p_feedback: feedback,
    p_block_exercise_note: blockExerciseNote,
  })

  if (error) {
    console.warn('[exerciseTimingService] training_upsert_workout_exercise_notes:', error.message)
    return null
  }

  return data ?? null
}

// ─── Helpers locales (sin DB) ─────────────────────────────────────────────────

/** Formatea segundos como "Xm Ys" o "Xs" */
export function formatDuration(secs) {
  if (!secs || secs < 0) return '—'
  const m = Math.floor(secs / 60)
  const s = secs % 60
  if (m === 0) return `${s}s`
  return s === 0 ? `${m}m` : `${m}m ${s}s`
}

/**
 * Calcula el resumen de timing desde los refs locales del componente.
 * Se usa para mostrar el resumen inmediatamente sin esperar a la DB.
 */
export function computeLocalSummary({ sessionStartedAt, warmupStartedAt, warmupEndedAt, setTimings }) {
  const now = new Date()
  const endedAt = now

  const totalSec = Math.floor((endedAt - sessionStartedAt) / 1000)

  const warmupSec =
    warmupStartedAt && warmupEndedAt
      ? Math.floor((warmupEndedAt - warmupStartedAt) / 1000)
      : null

  const workSec =
    warmupEndedAt
      ? Math.floor((endedAt - warmupEndedAt) / 1000)
      : totalSec

  // Calcular descansos: tiempo entre completed_at de serie N y started_at de serie N+1
  const completedSets = Object.values(setTimings)
    .filter(t => t.startedAt && t.completedAt)
    .sort((a, b) => a.startedAt - b.startedAt)

  const restTimes = []
  for (let i = 1; i < completedSets.length; i++) {
    const rest = Math.floor(
      (completedSets[i].startedAt - completedSets[i - 1].completedAt) / 1000
    )
    if (rest >= 0 && rest < 3600) restTimes.push(rest) // descarta outliers
  }

  const avgRest = restTimes.length
    ? Math.round(restTimes.reduce((a, b) => a + b, 0) / restTimes.length)
    : null

  const maxRest = restTimes.length ? Math.max(...restTimes) : null

  return {
    totalSec,
    warmupSec,
    workSec,
    setsCompleted: completedSets.length,
    avgRest,
    maxRest,
  }
}
