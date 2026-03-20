import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/use-toast'
import { supabase } from '@/lib/supabaseClient'
import {
  getDateKey,
  getTrainingZoneCatalogs,
  getTrainingZoneSnapshot,
} from '@/lib/training/trainingPlanService'
import {
  addExerciseToBlock,
  getWorkoutDayDetail,
  updateBlockExerciseConfig,
} from '@/lib/training/workoutSessionService'
import {
  buildDraftExercise,
  ensureOneKeyExercise,
  exerciseToConfigShape,
  normalizeDayData,
} from '@/lib/training/workoutDayHelpers'

/**
 * Gestiona la carga y navegación de todos los días del mesociclo activo.
 * También expone las mutaciones de edición de ejercicios y nombre de día.
 *
 * @param {string|undefined} weeklyDayId  ID del día activo (viene del param de la URL).
 */
export function useRoutineNavigation(weeklyDayId) {
  const navigate   = useNavigate()
  const { user }   = useAuth()
  const { toast }  = useToast()

  const [days, setDays]               = useState([])
  const [currentDayIdx, setCurrentDayIdx] = useState(0)
  const [loading, setLoading]         = useState(true)
  const [savingConfig, setSavingConfig] = useState(false)
  const [catalogs, setCatalogs]       = useState(null)

  const selectedDayId = weeklyDayId ? String(weeklyDayId) : null

  // ── Carga de todos los días del mesociclo activo ────────────────────────────
  const loadDays = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const [snapshotData, catalogsData] = await Promise.all([
        getTrainingZoneSnapshot(user.id, getDateKey(new Date())),
        getTrainingZoneCatalogs(),
      ])

      const snapshotDays = (snapshotData?.days || [])
        .slice()
        .sort((a, b) => (a.day_index || 0) - (b.day_index || 0))

      setCatalogs(catalogsData)

      if (!snapshotDays.length) {
        setDays([])
        return
      }

      const details = await Promise.all(snapshotDays.map(d => getWorkoutDayDetail(d.id)))
      const normalizedDays = details
        .map(({ day, blocks }) => normalizeDayData(day, blocks))
        .sort((a, b) => a.dayIndex - b.dayIndex)

      setDays(normalizedDays)

      // Posicionar en el día de la URL, o en el siguiente sugerido por el snapshot
      const nextDayId = String(snapshotData?.nextSessionDay?.weekly_day_id || '')
      const preferredId = selectedDayId || nextDayId
      const preferredIdx = normalizedDays.findIndex(d => String(d.id) === preferredId)
      setCurrentDayIdx(preferredIdx >= 0 ? preferredIdx : 0)
    } catch (err) {
      console.error('Error loading routine navigation:', err)
      toast({
        title: 'No se pudo cargar la rutina',
        description: err?.message || 'Inténtalo de nuevo en unos segundos.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [user?.id, toast]) // eslint-disable-line react-hooks/exhaustive-deps
  // selectedDayId intencionalmente excluido: solo queremos sincronizar en la carga inicial

  useEffect(() => { loadDays() }, [loadDays])

  // Sincroniza el índice cuando cambia el param de la URL (navegación entre días)
  useEffect(() => {
    if (!days.length || !selectedDayId) return
    const idx = days.findIndex(d => String(d.id) === selectedDayId)
    if (idx >= 0) setCurrentDayIdx(idx)
  }, [days, selectedDayId])

  // ── Navegación ──────────────────────────────────────────────────────────────
  const goToDay = useCallback((id) => {
    navigate(`/plan/entreno/dia/${id}`, { replace: true })
  }, [navigate])

  const goToDayIdx = useCallback((nextIdx) => {
    const safeIdx = Math.max(0, Math.min(nextIdx, days.length - 1))
    setCurrentDayIdx(safeIdx)
    const nextDay = days[safeIdx]
    if (nextDay?.id) navigate(`/plan/entreno/dia/${String(nextDay.id)}`, { replace: true })
  }, [days, navigate])

  // ── Mutaciones de estado local ──────────────────────────────────────────────
  const updateDayLocal = useCallback((dayId, updater) => {
    setDays(prev => prev.map(d => d.id === dayId ? updater(d) : d))
  }, [])

  const updateBlockExercisesLocal = useCallback((dayId, blockId, updater) => {
    updateDayLocal(dayId, day => ({
      ...day,
      blocks: day.blocks.map(block =>
        block.id === blockId
          ? { ...block, exercises: updater(block.exercises || [], block) }
          : block
      ),
    }))
  }, [updateDayLocal])

  const removeExerciseAtIndex = useCallback((dayId, blockId, exerciseIdx) => {
    updateBlockExercisesLocal(dayId, blockId, exercises =>
      ensureOneKeyExercise(exercises.filter((_, idx) => idx !== exerciseIdx))
    )
  }, [updateBlockExercisesLocal])

  // ── Persistencia ────────────────────────────────────────────────────────────
  const persistExerciseConfig = useCallback(async ({ dayId, blockId, exerciseIdx, exercise, isNew }) => {
    if (!exercise) return
    setSavingConfig(true)
    try {
      if (isNew || exercise._isDraftNew) {
        const newRecord = await addExerciseToBlock(blockId, {
          exerciseId: exercise.exerciseId,
          config: exerciseToConfigShape(exercise),
          exerciseOrder: exerciseIdx + 1,
        })
        updateBlockExercisesLocal(dayId, blockId, exercises =>
          exercises.map((item, idx) =>
            idx === exerciseIdx ? { ...item, blockExerciseId: newRecord.id, _isDraftNew: false } : item
          )
        )
      } else {
        await updateBlockExerciseConfig(exercise.blockExerciseId, exerciseToConfigShape(exercise))
      }
    } catch (err) {
      console.error('Error persisting exercise config:', err)
      toast({
        title: 'No se pudo guardar el ejercicio',
        description: err?.message || 'Inténtalo de nuevo en unos segundos.',
        variant: 'destructive',
      })
    } finally {
      setSavingConfig(false)
    }
  }, [toast, updateBlockExercisesLocal])

  const handleDeleteExercise = useCallback(async ({ dayId, blockId, exerciseIdx, exercise }) => {
    if (!exercise) return
    if (exercise._isDraftNew) {
      removeExerciseAtIndex(dayId, blockId, exerciseIdx)
      return
    }
    try {
      const { error } = await supabase
        .from('training_block_exercises')
        .delete()
        .eq('id', exercise.blockExerciseId)
      if (error) throw error
      removeExerciseAtIndex(dayId, blockId, exerciseIdx)
    } catch (err) {
      console.error('Error deleting exercise:', err)
      toast({
        title: 'No se pudo eliminar el ejercicio',
        description: err?.message || 'Inténtalo de nuevo.',
        variant: 'destructive',
      })
    }
  }, [removeExerciseAtIndex, toast])

  const persistDayName = useCallback(async (dayId, name) => {
    try {
      const { error } = await supabase
        .from('training_weekly_days')
        .update({ name: (name || '').trim() || null })
        .eq('id', dayId)
      if (error) throw error
    } catch (err) {
      console.error('Error updating day name:', err)
      toast({
        title: 'No se pudo guardar el nombre del día',
        description: err?.message || 'Inténtalo de nuevo.',
        variant: 'destructive',
      })
    }
  }, [toast])

  /** Construye un ejercicio draft usando el catálogo cargado. */
  const buildDraftExerciseForBlock = useCallback((blockId, exercise, isFirstInBlock) =>
    buildDraftExercise(blockId, exercise, isFirstInBlock, catalogs?.equipment || [])
  , [catalogs?.equipment])

  // ── Valores derivados ───────────────────────────────────────────────────────
  const activeDay = days[currentDayIdx] || null

  const progressValue = useMemo(() => {
    if (!days.length) return 0
    return ((currentDayIdx + 1) / days.length) * 100
  }, [currentDayIdx, days.length])

  return {
    // Estado
    days,
    activeDay,
    activeIdx: currentDayIdx,
    isFirst: currentDayIdx === 0,
    isLast: currentDayIdx === Math.max(days.length - 1, 0),
    loading,
    savingConfig,
    catalogs,
    progressValue,
    // Navegación
    goToDay,
    goPrev: () => goToDayIdx(currentDayIdx - 1),
    goNext: () => goToDayIdx(currentDayIdx + 1),
    goToDayIdx,
    // Mutaciones locales
    updateDayLocal,
    updateBlockExercisesLocal,
    removeExerciseAtIndex,
    buildDraftExerciseForBlock,
    // Persistencia
    persistExerciseConfig,
    handleDeleteExercise,
    persistDayName,
    // Reload manual
    reload: loadDays,
  }
}
