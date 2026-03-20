import { useCallback, useEffect, useState } from 'react'
import { getTrainingZoneCatalogs } from '@/lib/training/trainingPlanService'
import {
  addExerciseToBlock,
  getWorkoutDayDetail,
  getPreviousExerciseSets,
  updateBlockExerciseConfig,
} from '@/lib/training/workoutSessionService'
import {
  buildDraftExercise,
  exerciseToConfigShape,
  normalizeDayData,
} from '@/lib/training/workoutDayHelpers'

/**
 * Carga el detalle completo de un día de entrenamiento: ejercicios,
 * catálogos y el historial previo de cada ejercicio (prevSets).
 *
 * Diseñado para la vista de un único día (WorkoutDayPage).
 * Para la vista multi-día usa useRoutineNavigation.
 *
 * @param {string|undefined} weeklyDayId  ID del día a cargar. 'demo' usa mock.
 * @param {object|null}      mockDay      Datos mock opcionales para modo demo.
 */
export function useWorkoutDayDetail(weeklyDayId, mockDay = null) {
  const isDemo = weeklyDayId === 'demo'

  const [dayData, setDayData]           = useState(isDemo ? mockDay : null)
  const [catalogs, setCatalogs]         = useState(null)
  const [loading, setLoading]           = useState(!isDemo)
  const [error, setError]               = useState(null)
  const [isSavingConfig, setIsSavingConfig] = useState(false)

  // ── Carga del día + catálogos + prevSets ────────────────────────────────────
  useEffect(() => {
    if (isDemo) return

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [{ day, blocks }, catalogsData] = await Promise.all([
          getWorkoutDayDetail(weeklyDayId),
          getTrainingZoneCatalogs(),
        ])
        const normalized = normalizeDayData(day, blocks)

        // Cargar historial previo para cada ejercicio en paralelo
        const allExercises = normalized.blocks.flatMap(b => b.exercises)
        const prevResults = await Promise.all(
          allExercises.map(ex =>
            ex.exerciseId
              ? getPreviousExerciseSets(ex.exerciseId).catch(() => ({}))
              : Promise.resolve({})
          )
        )

        // Adjuntar prevSets a cada ejercicio
        let i = 0
        for (const block of normalized.blocks) {
          for (const ex of block.exercises) {
            ex.prevSets = prevResults[i++]
          }
        }

        setDayData(normalized)
        setCatalogs(catalogsData)
      } catch (err) {
        console.error('Error loading workout day detail:', err)
        setError('No se pudo cargar el día de entrenamiento.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [weeklyDayId, isDemo])

  // ── Mutaciones de estado local ──────────────────────────────────────────────
  const updateBlockExercisesLocal = useCallback((blockId, updater) => {
    setDayData(prev => {
      if (!prev) return prev
      return {
        ...prev,
        blocks: prev.blocks.map(block =>
          block.id === blockId
            ? { ...block, exercises: updater(block.exercises || [], block) }
            : block
        ),
      }
    })
  }, [])

  const removeExerciseAtIndex = useCallback((blockId, exerciseIdx) => {
    updateBlockExercisesLocal(blockId, exercises =>
      exercises.filter((_, idx) => idx !== exerciseIdx)
    )
  }, [updateBlockExercisesLocal])

  // ── Persistencia ────────────────────────────────────────────────────────────
  const persistExerciseConfig = useCallback(async ({ blockId, exerciseIdx, exercise, isNew }) => {
    if (!exercise || isDemo) return
    setIsSavingConfig(true)
    try {
      if (isNew || exercise._isDraftNew) {
        const newRecord = await addExerciseToBlock(blockId, {
          exerciseId: exercise.exerciseId,
          config: exerciseToConfigShape(exercise),
          exerciseOrder: exerciseIdx + 1,
        })
        updateBlockExercisesLocal(blockId, exercises =>
          exercises.map((item, idx) =>
            idx === exerciseIdx ? { ...item, blockExerciseId: newRecord.id, _isDraftNew: false } : item
          )
        )
      } else {
        await updateBlockExerciseConfig(exercise.blockExerciseId, exerciseToConfigShape(exercise))
      }
    } catch (err) {
      console.error('Error saving exercise config:', err)
    } finally {
      setIsSavingConfig(false)
    }
  }, [isDemo, updateBlockExercisesLocal])

  const handleDeleteExercise = useCallback(async ({ blockId, exerciseIdx, exercise }) => {
    if (!exercise) return
    if (exercise._isDraftNew || isDemo) {
      removeExerciseAtIndex(blockId, exerciseIdx)
      return
    }
    try {
      const { supabase } = await import('@/lib/supabaseClient')
      await supabase.from('training_block_exercises').delete().eq('id', exercise.blockExerciseId)
      removeExerciseAtIndex(blockId, exerciseIdx)
    } catch (err) {
      console.error('Error deleting exercise:', err)
    }
  }, [isDemo, removeExerciseAtIndex])

  /** Construye un ejercicio draft usando el catálogo cargado. */
  const buildDraftExerciseForBlock = useCallback((blockId, exercise) =>
    buildDraftExercise(blockId, exercise, false, catalogs?.equipment || [])
  , [catalogs?.equipment])

  return {
    // Estado
    dayData,
    catalogs,
    loading,
    error,
    isSavingConfig,
    // Mutaciones locales
    updateBlockExercisesLocal,
    removeExerciseAtIndex,
    buildDraftExerciseForBlock,
    // Persistencia
    persistExerciseConfig,
    handleDeleteExercise,
  }
}
