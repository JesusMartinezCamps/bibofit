import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Dumbbell, Flame, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/use-toast'
import { supabase } from '@/lib/supabaseClient'
import { getDateKey, getTrainingZoneCatalogs, getTrainingZoneSnapshot } from '@/lib/training/trainingPlanService'
import {
  addExerciseToBlock,
  getWorkoutDayDetail,
  updateBlockExerciseConfig,
} from '@/lib/training/workoutSessionService'
import TrainingDayEditor from '@/components/training/shared/day-editor/TrainingDayEditor'

const BLOCK_LABELS = {
  torso: 'Torso',
  pierna: 'Piernas',
  fullbody: 'Full Body',
  push: 'Empuje',
  pull: 'Tiron',
  core: 'Core',
  cardio: 'Cardio',
  movilidad: 'Movilidad',
  custom: 'Bloque',
}

const normalizeDayData = (day, blocks) => ({
  id: day.id,
  name: day.name || `Dia ${day.day_index}`,
  dayIndex: day.day_index,
  blocks: (blocks || []).map((block) => ({
    id: block.id,
    blockType: block.block_type,
    blockOrder: block.block_order,
    name: block.name,
    exercises: (block.training_block_exercises || [])
      .sort((a, z) => a.exercise_order - z.exercise_order)
      .map((be) => ({
        blockExerciseId: be.id,
        blockId: block.id,
        exerciseId: be.exercises?.id,
        name: be.exercises?.name || 'Ejercicio',
        isKeyExercise: Boolean(be.is_key_exercise),
        targetSets: be.target_sets,
        targetRepsMin: be.target_reps_min,
        targetRepsMax: be.target_reps_max,
        equipment: be.equipment?.name || null,
        preferredEquipmentId: be.equipment?.id ? String(be.equipment.id) : '',
        targetRir: be.target_rir ?? null,
        restSeconds: be.rest_seconds ?? 120,
        tempo: be.tempo ?? null,
        notes: be.notes ?? null,
      })),
  })),
})

const exerciseToConfigShape = (exercise) => ({
  target_sets: String(exercise.targetSets ?? 3),
  target_reps_min: String(exercise.targetRepsMin ?? 8),
  target_reps_max: String(exercise.targetRepsMax ?? 10),
  target_rir: exercise.targetRir ?? null,
  rest_seconds: exercise.restSeconds ?? 120,
  tempo: exercise.tempo ?? null,
  notes: exercise.notes ?? '',
  is_key_exercise: exercise.isKeyExercise ?? false,
  preferred_equipment_id: exercise.preferredEquipmentId ?? '',
})

const ensureOneKeyExercise = (exercises) => {
  if (!exercises.length) return exercises
  if (exercises.some((exercise) => exercise.isKeyExercise)) return exercises
  return exercises.map((exercise, idx) => ({ ...exercise, isKeyExercise: idx === 0 }))
}

export default function RoutineDayWorkspacePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { weeklyDayId } = useParams()
  const { user } = useAuth()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [savingConfig, setSavingConfig] = useState(false)
  const [days, setDays] = useState([])
  const [catalogs, setCatalogs] = useState(null)
  const [currentDayIdx, setCurrentDayIdx] = useState(0)
  const selectedRouteDayId = weeklyDayId ? String(weeklyDayId) : null
  const [pendingOpenExerciseId, setPendingOpenExerciseId] = useState(() => {
    const id = location.state?.openExerciseId
    return id ? String(id) : null
  })

  const activeDay = days[currentDayIdx] || null
  const isFirstDay = currentDayIdx === 0
  const isLastDay = currentDayIdx === Math.max(days.length - 1, 0)

  const goToDayIdx = useCallback((nextIdx) => {
    const safeIdx = Math.max(0, Math.min(nextIdx, days.length - 1))
    setCurrentDayIdx(safeIdx)
    const nextDay = days[safeIdx]
    if (nextDay?.id) {
      navigate(`/plan/entreno/rutina/editar/${String(nextDay.id)}`, { replace: true })
    }
  }, [days, navigate])

  const updateDayLocal = useCallback((dayId, updater) => {
    setDays((prev) =>
      prev.map((day) => (day.id === dayId ? updater(day) : day))
    )
  }, [])

  const updateBlockExercisesLocal = useCallback((dayId, blockId, updater) => {
    updateDayLocal(dayId, (day) => ({
      ...day,
      blocks: day.blocks.map((block) =>
        block.id === blockId
          ? { ...block, exercises: updater(block.exercises || [], block) }
          : block
      ),
    }))
  }, [updateDayLocal])

  const removeExerciseAtIndex = useCallback((dayId, blockId, exerciseIdx) => {
    updateBlockExercisesLocal(dayId, blockId, (exercises) =>
      ensureOneKeyExercise(exercises.filter((_, idx) => idx !== exerciseIdx))
    )
  }, [updateBlockExercisesLocal])

  const mapConfigPatchToExercise = useCallback((patch) => {
    const next = {}
    if ('target_sets' in patch) next.targetSets = Number.parseInt(String(patch.target_sets), 10) || 0
    if ('target_reps_min' in patch) next.targetRepsMin = Number.parseInt(String(patch.target_reps_min), 10) || 0
    if ('target_reps_max' in patch) next.targetRepsMax = Number.parseInt(String(patch.target_reps_max), 10) || 0
    if ('target_rir' in patch) next.targetRir = patch.target_rir ?? null
    if ('rest_seconds' in patch) next.restSeconds = Number.parseInt(String(patch.rest_seconds), 10) || 120
    if ('tempo' in patch) next.tempo = patch.tempo ?? null
    if ('notes' in patch) next.notes = patch.notes ?? null
    if ('is_key_exercise' in patch) next.isKeyExercise = patch.is_key_exercise === true
    if ('preferred_equipment_id' in patch) next.preferredEquipmentId = patch.preferred_equipment_id || ''
    return next
  }, [])

  const buildDraftExercise = useCallback((blockId, exercise, isFirstInBlock) => {
    const equipmentName = (catalogs?.equipment || []).find(
      (equipment) => String(equipment.id) === String(exercise.equipment_id)
    )?.name || null

    return {
      blockExerciseId: `draft-${blockId}-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
      blockId,
      exerciseId: exercise.id,
      name: exercise.name,
      isKeyExercise: isFirstInBlock,
      targetSets: 3,
      targetRepsMin: 8,
      targetRepsMax: 10,
      equipment: equipmentName,
      preferredEquipmentId: exercise.equipment_id ? String(exercise.equipment_id) : '',
      targetRir: 1,
      restSeconds: 120,
      tempo: 'estricta',
      notes: null,
      _isDraftNew: true,
    }
  }, [catalogs?.equipment])

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

        updateBlockExercisesLocal(dayId, blockId, (exercises) =>
          exercises.map((item, idx) =>
            idx === exerciseIdx
              ? { ...item, blockExerciseId: newRecord.id, _isDraftNew: false }
              : item
          )
        )
      } else {
        await updateBlockExerciseConfig(exercise.blockExerciseId, exerciseToConfigShape(exercise))
      }
    } catch (error) {
      console.error('Error persisting exercise config:', error)
      toast({
        title: 'No se pudo guardar el ejercicio',
        description: error?.message || 'Intentalo de nuevo en unos segundos.',
        variant: 'destructive',
      })
    } finally {
      setSavingConfig(false)
    }
  }, [toast, updateBlockExercisesLocal])

  const persistDayName = useCallback(async (dayId, name) => {
    try {
      const { error } = await supabase
        .from('training_weekly_days')
        .update({ name: (name || '').trim() || null })
        .eq('id', dayId)

      if (error) throw error
    } catch (error) {
      console.error('Error updating day name:', error)
      toast({
        title: 'No se pudo guardar el nombre del dia',
        description: error?.message || 'Intentalo de nuevo.',
        variant: 'destructive',
      })
    }
  }, [toast])

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
    } catch (error) {
      console.error('Error deleting exercise:', error)
      toast({
        title: 'No se pudo eliminar el ejercicio',
        description: error?.message || 'Intentalo de nuevo.',
        variant: 'destructive',
      })
    }
  }, [removeExerciseAtIndex, toast])

  const loadRoutineDays = useCallback(async () => {
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

      if (!snapshotDays.length) {
        setDays([])
        setCatalogs(catalogsData)
        return
      }

      const details = await Promise.all(snapshotDays.map((day) => getWorkoutDayDetail(day.id)))
      const normalizedDays = details
        .map(({ day, blocks }) => normalizeDayData(day, blocks))
        .sort((a, b) => a.dayIndex - b.dayIndex)

      setDays(normalizedDays)
      setCatalogs(catalogsData)

      const preferredDayId = String(snapshotData?.nextSessionDay?.weekly_day_id || normalizedDays[0]?.id || '')
      const preferredIdx = normalizedDays.findIndex((day) => String(day.id) === preferredDayId)
      const safeIdx = preferredIdx >= 0 ? preferredIdx : 0
      setCurrentDayIdx(safeIdx)
    } catch (error) {
      console.error('Error loading routine day workspace:', error)
      toast({
        title: 'No se pudo cargar la rutina',
        description: error?.message || 'Intentalo de nuevo en unos segundos.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast, user?.id])

  useEffect(() => {
    loadRoutineDays()
  }, [loadRoutineDays])

  useEffect(() => {
    if (!days.length || !selectedRouteDayId) return
    const nextIdx = days.findIndex((day) => String(day.id) === selectedRouteDayId)
    if (nextIdx >= 0) setCurrentDayIdx(nextIdx)
  }, [days, selectedRouteDayId])

  useEffect(() => {
    const id = location.state?.openExerciseId
    if (id) setPendingOpenExerciseId(String(id))
  }, [location.state])

  const progressValue = useMemo(() => {
    if (!days.length) return 0
    return ((currentDayIdx + 1) / days.length) * 100
  }, [currentDayIdx, days.length])

  if (loading) {
    return (
      <main className="w-full px-4 py-10">
        <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card/70 p-6 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#F44C40]" />
          <p className="mt-3 text-sm text-muted-foreground">Cargando editor de rutina...</p>
        </div>
      </main>
    )
  }

  if (!days.length || !activeDay) {
    return (
      <main className="w-full px-4 py-10">
        <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card/70 p-6 text-center">
          <p className="text-base font-semibold text-foreground">No hay dias para editar en la rutina activa.</p>
          <Button className="mt-4" onClick={() => navigate('/plan/entreno')}>
            Volver al plan
          </Button>
        </div>
      </main>
    )
  }

  return (
    <div className="flex flex-col min-h-[calc(100dvh-64px)] bg-[#0f1115] text-white">
      <div className="shrink-0 bg-[#0f1115] border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/plan/entreno')}
            className="text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>

          <span className="text-sm font-semibold text-white truncate px-2 max-w-[60%] text-center">
            {activeDay.name || `Dia ${activeDay.dayIndex}`}
          </span>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/plan/entreno')}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="px-4 pb-3">
          <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
            {days.map((day, idx) => {
              const primaryType = day.blocks?.[0]?.blockType || 'custom'
              const isActive = idx === currentDayIdx
              return (
                <button
                  key={day.id}
                  type="button"
                  onClick={() => goToDayIdx(idx)}
                  className={`w-full flex flex-col items-center justify-center rounded-xl px-1 py-1.5 text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-[#F44C40] text-white shadow-sm shadow-[#F44C40]/30'
                      : 'bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground'
                  }`}
                >
                  <span className={`text-[11px] font-bold ${isActive ? 'text-white' : 'text-foreground/60'}`}>
                    D{day.dayIndex}
                  </span>
                  <span className={`text-[9px] mt-0.5 leading-none ${isActive ? 'text-white/80' : 'text-muted-foreground/60'}`}>
                    {(BLOCK_LABELS[primaryType] || 'Bloque').split(' ')[0]}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="shrink-0 h-1 bg-muted w-full overflow-hidden">
        <div
          className="h-full bg-[#F44C40] transition-all duration-400 ease-out"
          style={{ width: `${progressValue}%` }}
        />
      </div>

      <div className="flex-1 w-full max-w-3xl mx-auto flex flex-col px-5 py-6 min-h-0">
        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          <textarea
            rows={1}
            value={activeDay.name || ''}
            onChange={(event) => {
              const nextName = event.target.value
              updateDayLocal(activeDay.id, (day) => ({ ...day, name: nextName }))
            }}
            onBlur={(event) => {
              void persistDayName(activeDay.id, event.target.value)
            }}
            placeholder={`Dia ${activeDay.dayIndex}`}
            className="w-full resize-none bg-transparent text-xl font-bold text-white placeholder:text-white/25 focus:outline-none leading-snug overflow-hidden border-b border-transparent focus:border-white/15 transition-colors pb-1"
            style={{ minHeight: '1.8em' }}
            onInput={(event) => {
              event.target.style.height = 'auto'
              event.target.style.height = `${event.target.scrollHeight}px`
            }}
          />

          {activeDay.blocks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay bloques configurados en este dia.</p>
          ) : (
            activeDay.blocks.map((block) => (
              <div key={block.id}>
                {activeDay.blocks.length > 1 && (
                  <div className="flex items-center gap-2 mb-2 mt-2">
                    <div className="flex items-center gap-1.5">
                      {block.blockType === 'core' ? (
                        <Flame className="w-3.5 h-3.5 text-orange-500/80" />
                      ) : (
                        <Dumbbell className="w-3.5 h-3.5 text-muted-foreground/60" />
                      )}
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                        {block.name || BLOCK_LABELS[block.blockType] || 'Bloque'}
                      </span>
                    </div>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                )}

                <TrainingDayEditor
                  showDayName={false}
                  exercises={block.exercises}
                  exerciseOptions={catalogs?.exercises || []}
                  equipmentOptions={catalogs?.equipment || []}
                  addButtonLabel="Anadir ejercicio"
                  emptyMessage="Sin ejercicios en este bloque"
                  showAddButton={true}
                  animateCards={false}
                  resolveExerciseCatalogId={(exercise) => exercise.exerciseId}
                  resolveExerciseViewModel={({ exercise }) => ({
                    name: exercise.name,
                    isKeyExercise: exercise.isKeyExercise,
                    targetSets: exercise.targetSets,
                    targetRepsMin: exercise.targetRepsMin,
                    targetRepsMax: exercise.targetRepsMax,
                    equipment: exercise.equipment,
                    rir: exercise.targetRir,
                    restSeconds: exercise.restSeconds,
                    tempo: exercise.tempo,
                    showChevron: false,
                  })}
                  resolveExercisePatch={mapConfigPatchToExercise}
                  toConfigExercise={exerciseToConfigShape}
                  resolveExerciseNameForConfig={({ exercise }) => exercise.name}
                  initialOpenExerciseId={
                    pendingOpenExerciseId
                    && block.exercises.some((exercise) => String(exercise.blockExerciseId) === pendingOpenExerciseId)
                      ? pendingOpenExerciseId
                      : null
                  }
                  onInitialExerciseOpened={() => setPendingOpenExerciseId(null)}
                  onRequestAddExercise={(exercise) => {
                    let newExerciseIdx = 0
                    updateBlockExercisesLocal(activeDay.id, block.id, (exercises) => {
                      newExerciseIdx = exercises.length
                      return [
                        ...exercises,
                        buildDraftExercise(block.id, exercise, exercises.length === 0),
                      ]
                    })
                    return { exerciseIdx: newExerciseIdx, isNew: true }
                  }}
                  onUpdateExercise={(exerciseIdx, patch) => {
                    updateBlockExercisesLocal(activeDay.id, block.id, (exercises) => {
                      const isKeyChange = patch?.isKeyExercise === true
                      const next = exercises.map((exercise, idx) => {
                        if (idx === exerciseIdx) return { ...exercise, ...patch }
                        if (isKeyChange) return { ...exercise, isKeyExercise: false }
                        return exercise
                      })
                      return ensureOneKeyExercise(next)
                    })
                  }}
                  onConfirmExercise={({ exerciseIdx, exercise, isNew }) => {
                    void persistExerciseConfig({
                      dayId: activeDay.id,
                      blockId: block.id,
                      exerciseIdx,
                      exercise,
                      isNew,
                    })
                  }}
                  onCancelExercise={({ isNew, exerciseIdx }) => {
                    if (!isNew) return
                    removeExerciseAtIndex(activeDay.id, block.id, exerciseIdx)
                  }}
                  onRemoveExercise={(exerciseIdx, exercise) => {
                    void handleDeleteExercise({
                      dayId: activeDay.id,
                      blockId: block.id,
                      exerciseIdx,
                      exercise,
                    })
                  }}
                />
              </div>
            ))
          )}
        </div>

        <div className="pt-4 mt-auto shrink-0 flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (isFirstDay) navigate('/plan/entreno')
              else goToDayIdx(currentDayIdx - 1)
            }}
            className="flex items-center gap-1 px-3"
          >
            <ChevronLeft className="h-4 w-4" />
            {isFirstDay ? 'Volver' : `Dia ${days[currentDayIdx - 1]?.dayIndex || ''}`}
          </Button>

          <Button
            type="button"
            onClick={() => {
              if (isLastDay) navigate('/plan/entreno')
              else goToDayIdx(currentDayIdx + 1)
            }}
            className="flex-1 bg-[#F44C40] hover:bg-[#E23C32] text-white flex items-center justify-center gap-1"
          >
            {isLastDay ? 'Volver al plan' : `Dia ${days[currentDayIdx + 1]?.dayIndex || ''}`}
            {!isLastDay && <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {savingConfig && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <Loader2 className="w-8 h-8 animate-spin text-white" />
        </div>
      )}
    </div>
  )
}
