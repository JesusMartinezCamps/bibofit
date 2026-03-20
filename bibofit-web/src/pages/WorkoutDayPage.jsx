import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Play, Dumbbell,
  Loader2, AlertTriangle,
  CheckCircle2, Flame,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import TrainingDayEditor from '@/components/training/shared/day-editor/TrainingDayEditor'
import { useWorkoutDayDetail } from '@/hooks/useWorkoutDayDetail'
import { useWorkoutSession } from '@/hooks/useWorkoutSession'
import {
  BLOCK_LABELS,
  exerciseToConfigShape,
  mapConfigPatchToExercise,
} from '@/lib/training/workoutDayHelpers'

// Color de entrenamiento
const T = '#F44C40'

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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WorkoutDayPage() {
  const navigate        = useNavigate()
  const { weeklyDayId } = useParams()
  const isDemo          = weeklyDayId === 'demo'

  const {
    dayData,
    catalogs,
    loading,
    error,
    isSavingConfig,
    updateBlockExercisesLocal,
    removeExerciseAtIndex,
    buildDraftExerciseForBlock,
    persistExerciseConfig,
    handleDeleteExercise,
  } = useWorkoutDayDetail(weeklyDayId, MOCK_DAY)

  const { sessionIds, starting, startSession } = useWorkoutSession(weeklyDayId, dayData)

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
                              return [...exercises, buildDraftExerciseForBlock(block.id, exercise)]
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
