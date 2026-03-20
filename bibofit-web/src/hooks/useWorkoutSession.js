import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createOrGetWorkoutSession } from '@/lib/training/workoutSessionService'

/**
 * Gestiona la sesión de entrenamiento activa para un día.
 * Crea la sesión en DB si no existe y navega al primer ejercicio.
 *
 * @param {string}      weeklyDayId  ID del día de entrenamiento.
 * @param {object|null} day          Día normalizado con sus bloques y ejercicios.
 */
export function useWorkoutSession(weeklyDayId, day) {
  const navigate = useNavigate()

  const [sessionIds, setSessionIds] = useState(null)  // { workoutId, exerciseMap }
  const [starting, setStarting]     = useState(false)

  const isDemo = weeklyDayId === 'demo'

  // ── Crear/obtener sesión en DB ───────────────────────────────────────────────
  const ensureSession = useCallback(async () => {
    if (isDemo) return { workoutId: null, exerciseMap: [] }
    if (sessionIds) return sessionIds

    setStarting(true)
    try {
      const ids = await createOrGetWorkoutSession(Number(weeklyDayId))
      setSessionIds(ids)
      return ids
    } catch (err) {
      console.error('Error creating workout session:', err)
      return { workoutId: null, exerciseMap: [] }
    } finally {
      setStarting(false)
    }
  }, [weeklyDayId, isDemo, sessionIds])

  // ── Iniciar desde el primer ejercicio ───────────────────────────────────────
  const startSession = useCallback(async () => {
    if (!day) return

    const { workoutId, exerciseMap } = await ensureSession()
    const allExercisesFlat = day.blocks.flatMap(b => b.exercises)
    const firstExercise = allExercisesFlat[0]
    if (!firstExercise) return

    const mapping = exerciseMap.find(
      m => String(m.block_exercise_id) === String(firstExercise.blockExerciseId)
    )

    navigate(
      `/plan/entreno/dia/${weeklyDayId}/ejercicio/${firstExercise.blockExerciseId}`,
      {
        state: {
          exercise: firstExercise,
          workoutId: workoutId ?? null,
          workoutExerciseId: mapping?.workout_exercise_id ?? null,
          allExercises: allExercisesFlat,
          exerciseMap,
          weeklyDayId,
        },
      }
    )
  }, [day, ensureSession, navigate, weeklyDayId])

  return {
    sessionIds,
    starting,
    startSession,
  }
}
