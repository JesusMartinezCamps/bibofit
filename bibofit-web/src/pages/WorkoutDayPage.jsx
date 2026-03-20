import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Play, Dumbbell,
  Loader2, AlertTriangle,
  CheckCircle2, Flame,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  getWorkoutDayDetail,
  createOrGetWorkoutSession,
  getPreviousExerciseSets,
  updateBlockExerciseConfig,
  addExerciseToBlock,
} from '@/lib/training/workoutSessionService'
import { getTrainingZoneCatalogs } from '@/lib/training/trainingPlanService'
import TrainingDayEditor from '@/components/training/shared/day-editor/TrainingDayEditor'

// Color de entrenamiento
const T = '#F44C40'

// ─── Etiquetas de tipo de bloque ──────────────────────────────────────────────
const BLOCK_LABELS = {
  torso:      'Torso',
  pierna:     'Piernas',
  fullbody:   'Full Body',
  push:       'Empuje',
  pull:       'Tirón',
  core:       'Core',
  cardio:     'Cardio',
  movilidad:  'Movilidad',
  custom:     'Bloque',
}

// ─── Mock Data (cuando weeklyDayId = "demo") ──────────────────────────────────
const MOCK_DAY = {
  id: 'demo',
  name: 'Piernas A',
  dayIndex: 1,
  microcycleObjective: 'Semana de carga · RIR 1-2 en series principales',
  deloadWeek: false,
  blocks: [
    {
      id: 'b1',
      blockType: 'pierna',
      blockOrder: 1,
      name: null,
      exercises: [
        {
          blockExerciseId: 'be1',
          blockId: 'b1',
          exerciseId: 1,
          name: 'Conventional Deadlift',
          isKeyExercise: true,
          targetSets: 4,
          targetRepsMin: 4,
          targetRepsMax: 6,
          equipment: 'Barra olímpica',
          preferredEquipmentId: null,
          targetRir: null,
          restSeconds: 120,
          tempo: null,
          notes: null,
          prevSets: {
            1: { weight: 175, reps: 5, rir: 0 },
            2: { weight: 175, reps: 4, rir: 0 },
            3: { weight: 175, reps: 4, rir: 1 },
            4: { weight: 175, reps: 3, rir: 2 },
          },
        },
        {
          blockExerciseId: 'be2',
          blockId: 'b1',
          exerciseId: 2,
          name: 'Romanian Deadlift',
          isKeyExercise: false,
          targetSets: 3,
          targetRepsMin: 8,
          targetRepsMax: 10,
          equipment: 'Barra',
          preferredEquipmentId: null,
          targetRir: 2,
          restSeconds: 120,
          tempo: null,
          notes: null,
          prevSets: {
            1: { weight: 80, reps: 10, rir: 2 },
            2: { weight: 80, reps: 9,  rir: 2 },
            3: { weight: 80, reps: 8,  rir: 3 },
          },
        },
        {
          blockExerciseId: 'be3',
          blockId: 'b1',
          exerciseId: 3,
          name: 'Leg Press',
          isKeyExercise: false,
          targetSets: 3,
          targetRepsMin: 10,
          targetRepsMax: 12,
          equipment: 'Máquina',
          preferredEquipmentId: null,
          targetRir: null,
          restSeconds: 120,
          tempo: null,
          notes: null,
          prevSets: {
            1: { weight: 200, reps: 12, rir: 2 },
            2: { weight: 200, reps: 11, rir: 2 },
            3: { weight: 200, reps: 10, rir: 3 },
          },
        },
      ],
    },
    {
      id: 'b2',
      blockType: 'core',
      blockOrder: 2,
      name: null,
      exercises: [
        {
          blockExerciseId: 'be4',
          blockId: 'b2',
          exerciseId: 4,
          name: 'Leg Curl',
          isKeyExercise: false,
          targetSets: 3,
          targetRepsMin: 10,
          targetRepsMax: 12,
          equipment: 'Máquina',
          preferredEquipmentId: null,
          targetRir: null,
          restSeconds: 120,
          tempo: null,
          notes: null,
          prevSets: {
            1: { weight: 45, reps: 12, rir: 3 },
            2: { weight: 45, reps: 11, rir: 3 },
            3: { weight: 45, reps: 10, rir: 4 },
          },
        },
        {
          blockExerciseId: 'be5',
          blockId: 'b2',
          exerciseId: 5,
          name: 'Calf Raise',
          isKeyExercise: false,
          targetSets: 4,
          targetRepsMin: 12,
          targetRepsMax: 15,
          equipment: 'Máquina',
          preferredEquipmentId: null,
          targetRir: null,
          restSeconds: 120,
          tempo: null,
          notes: null,
          prevSets: null,
        },
      ],
    },
  ],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convierte la respuesta de la DB al formato interno de la página */
function normalizeDayData(day, blocks) {
  return {
    id: day.id,
    name: day.name || `Día ${day.day_index}`,
    dayIndex: day.day_index,
    microcycleObjective: null,
    deloadWeek: false,
    blocks: (blocks || []).map(b => ({
      id: b.id,
      blockType: b.block_type,
      blockOrder: b.block_order,
      name: b.name,
      exercises: (b.training_block_exercises || [])
        .sort((a, z) => a.exercise_order - z.exercise_order)
        .map(be => ({
          blockExerciseId: be.id,
          blockId: b.id,
          exerciseId: be.exercises?.id,
          name: be.exercises?.name || 'Ejercicio',
          isKeyExercise: be.is_key_exercise,
          targetSets: be.target_sets,
          targetRepsMin: be.target_reps_min,
          targetRepsMax: be.target_reps_max,
          equipment: be.equipment?.name || null,
          preferredEquipmentId: be.equipment?.id ? String(be.equipment.id) : '',
          targetRir: be.target_rir ?? null,
          restSeconds: be.rest_seconds ?? 120,
          tempo: be.tempo ?? null,
          notes: be.notes ?? null,
          prevSets: null, // se carga después con getPreviousExerciseSets
        })),
    })),
  }
}

/** Convierte un ejercicio normalizado al formato que espera ExerciseConfigPanel */
function exerciseToConfigShape(ex) {
  return {
    target_sets: String(ex.targetSets ?? 3),
    target_reps_min: String(ex.targetRepsMin ?? 8),
    target_reps_max: String(ex.targetRepsMax ?? 10),
    target_rir: ex.targetRir ?? null,
    rest_seconds: ex.restSeconds ?? 120,
    tempo: ex.tempo ?? null,
    notes: ex.notes ?? '',
    is_key_exercise: ex.isKeyExercise ?? false,
    preferred_equipment_id: ex.preferredEquipmentId ?? '',
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WorkoutDayPage() {
  const navigate       = useNavigate()
  const { weeklyDayId } = useParams()
  const isDemo         = weeklyDayId === 'demo'

  const [dayData, setDayData]     = useState(isDemo ? MOCK_DAY : null)
  const [loading, setLoading]     = useState(!isDemo)
  const [starting, setStarting]   = useState(false)
  const [error, setError]         = useState(null)

  // workoutId = null hasta que se crea la sesión
  const [sessionIds, setSessionIds] = useState(null) // { workoutId, exerciseMap }

  // ── Catálogos para buscador y configurador ────────────────────────────────
  const [catalogs, setCatalogs] = useState(null)

  const [isSavingConfig, setIsSavingConfig] = useState(false)

  // ── Carga de datos ───────────────────────────────────────────────────────────
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
        console.error(err)
        setError('No se pudo cargar el día de entrenamiento.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [weeklyDayId, isDemo])

  // ── Crear sesión en DB ────────────────────────────────────────────────────────
  const ensureSession = useCallback(async () => {
    if (isDemo) return { workoutId: null, exerciseMap: [] }
    if (sessionIds) return sessionIds

    setStarting(true)
    try {
      const ids = await createOrGetWorkoutSession(Number(weeklyDayId))
      setSessionIds(ids)
      return ids
    } catch (err) {
      console.error(err)
      return { workoutId: null, exerciseMap: [] }
    } finally {
      setStarting(false)
    }
  }, [weeklyDayId, isDemo, sessionIds])

  // ── Iniciar sesión desde el primer ejercicio ──────────────────────────────
  const startSession = useCallback(async () => {
    if (!dayData) return
    const { workoutId, exerciseMap } = await ensureSession()

    const firstExercise = dayData.blocks[0]?.exercises[0]
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
        },
      }
    )
  }, [dayData, ensureSession, navigate, weeklyDayId])

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
    updateBlockExercisesLocal(blockId, (exercises) =>
      exercises.filter((_, idx) => idx !== exerciseIdx)
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

  const buildDraftExercise = useCallback((blockId, exercise) => {
    const equipmentName = (catalogs?.equipment || []).find(
      eq => String(eq.id) === String(exercise.equipment_id)
    )?.name || null

    return {
      blockExerciseId: `draft-${blockId}-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
      blockId,
      exerciseId: exercise.id,
      name: exercise.name,
      isKeyExercise: false,
      targetSets: 3,
      targetRepsMin: 8,
      targetRepsMax: 10,
      equipment: equipmentName,
      preferredEquipmentId: exercise.equipment_id ? String(exercise.equipment_id) : '',
      targetRir: 1,
      restSeconds: 120,
      tempo: 'estricta',
      notes: null,
      prevSets: null,
      _isDraftNew: true,
    }
  }, [catalogs?.equipment])

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

        updateBlockExercisesLocal(blockId, (exercises) =>
          exercises.map((item, idx) =>
            idx === exerciseIdx
              ? { ...item, blockExerciseId: newRecord.id, _isDraftNew: false }
              : item
          )
        )
      } else {
        await updateBlockExerciseConfig(exercise.blockExerciseId, exerciseToConfigShape(exercise))
      }
    } catch (err) {
      console.error('Error guardando configuración de ejercicio:', err)
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
      console.error('Error eliminando ejercicio:', err)
    }
  }, [isDemo, removeExerciseAtIndex])

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">

      {/* ── Header ── */}
      <header className="flex items-center gap-3 px-4 pt-4 pb-4 bg-background/95 backdrop-blur-sm sticky top-0 z-20 border-b border-border">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 -ml-1 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="h-5 w-32 bg-muted animate-pulse rounded" />
          ) : (
            <>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">
                Rutina del día
              </p>
              <h1 className="text-lg font-bold text-foreground leading-tight truncate">
                {dayData?.name || '—'}
              </h1>
            </>
          )}
        </div>
      </header>

      {/* ── Cuerpo ── */}
      <div className="flex-1 mt-4 overflow-y-auto">

        {/* Error */}
        {error && (
          <div className="mx-4 mt-4 flex items-start gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/25">
            <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !error && (
          <div className="px-4 pt-4 space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />
            ))}
          </div>
        )}

        {/* Content */}
        {!loading && dayData && (
          <>
            {/* Blocks + exercises */}
            <div className="px-4 pb-4 space-y-4">
              {dayData.blocks.map((block) => (
                <div key={block.id}>
                  {/* Block header — solo si hay más de un bloque */}
                  {dayData.blocks.length > 1 && (
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

                  {/* Exercise cards */}
                  <TrainingDayEditor
                    showDayName={false}
                    exercises={block.exercises}
                    exerciseOptions={catalogs?.exercises || []}
                    equipmentOptions={catalogs?.equipment || []}
                    addButtonLabel="Añadir ejercicio"
                    emptyMessage="Sin ejercicios en este bloque"
                    showAddButton={!isDemo}
                    animateCards
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
                      prevSets: exercise.prevSets,
                      showChevron: true,
                    })}
                    resolveExercisePatch={mapConfigPatchToExercise}
                    toConfigExercise={exerciseToConfigShape}
                    resolveExerciseNameForConfig={({ exercise }) => exercise.name}
                    onRequestAddExercise={
                      isDemo
                        ? null
                        : (exercise) => {
                            let newExerciseIdx = 0
                            updateBlockExercisesLocal(block.id, (exercises) => {
                              newExerciseIdx = exercises.length
                              return [...exercises, buildDraftExercise(block.id, exercise)]
                            })
                            return { exerciseIdx: newExerciseIdx, isNew: true }
                          }
                    }
                    onUpdateExercise={(exerciseIdx, patch) => {
                      updateBlockExercisesLocal(block.id, (exercises) => {
                        const isKeyChange = patch?.isKeyExercise === true
                        return exercises.map((exercise, idx) => {
                          if (idx === exerciseIdx) return { ...exercise, ...patch }
                          if (isKeyChange) return { ...exercise, isKeyExercise: false }
                          return exercise
                        })
                      })
                    }}
                    onConfirmExercise={({ exerciseIdx, exercise, isNew }) => {
                      void persistExerciseConfig({ blockId: block.id, exerciseIdx, exercise, isNew })
                    }}
                    onCancelExercise={({ isNew, exerciseIdx }) => {
                      if (!isNew) return
                      removeExerciseAtIndex(block.id, exerciseIdx)
                    }}
                    onRemoveExercise={(exerciseIdx, exercise) => {
                      void handleDeleteExercise({ blockId: block.id, exerciseIdx, exercise })
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Bottom spacing for CTA */}
            <div className="h-28" />
          </>
        )}
      </div>

      {/* ── CTA fijo ── */}
      {!loading && dayData && (
        <div className="fixed inset-x-0 bottom-0 z-20 bg-background/95 backdrop-blur-sm border-t border-border p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <Button
            onClick={startSession}
            disabled={starting}
            className="w-full h-14 text-base font-bold rounded-2xl gap-3"
            style={{ background: T }}
          >
            {starting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Iniciando sesión...
              </>
            ) : sessionIds ? (
              <>
                <CheckCircle2 className="w-5 h-5" />
                Continuar sesión
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                Iniciar sesión
              </>
            )}
          </Button>
        </div>
      )}

      {/* Saving overlay */}
      {isSavingConfig && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <Loader2 className="w-8 h-8 animate-spin text-white" />
        </div>
      )}
    </div>
  )
}
