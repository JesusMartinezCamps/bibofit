import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Play, Dumbbell,
  Loader2, AlertTriangle,
  CheckCircle2, Flame, Plus,
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
import ExerciseCard from '@/components/training/shared/ExerciseCard'
import ExerciseConfigPanel from '@/components/training/wizard/ExerciseConfigPanel'
import ExerciseSearchModal from '@/components/training/wizard/ExerciseSearchModal'

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
    tempo: ex.tempo ?? null,
    notes: ex.notes ?? '',
    is_key_exercise: ex.isKeyExercise ?? false,
    preferred_equipment_id: ex.preferredEquipmentId ?? '',
  }
}

/** Genera una forma inicial para un ejercicio nuevo */
function newExerciseConfigShape(exercise) {
  return {
    target_sets: '3',
    target_reps_min: '8',
    target_reps_max: '10',
    target_rir: null,
    tempo: null,
    notes: '',
    is_key_exercise: false,
    preferred_equipment_id: exercise.equipment_id ? String(exercise.equipment_id) : '',
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

  // ── Estado del configurador de ejercicio ─────────────────────────────────
  // configTarget: null | { blockExerciseId, blockId, exerciseName, config, isNew, exerciseId }
  const [configTarget, setConfigTarget] = useState(null)
  const [configDraft, setConfigDraft]   = useState(null)
  const [isSavingConfig, setIsSavingConfig] = useState(false)

  // ── Estado del buscador de ejercicios ─────────────────────────────────────
  const [searchTargetBlockId, setSearchTargetBlockId] = useState(null)

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

  // ── Abrir configurador de un ejercicio existente ──────────────────────────
  const openExerciseConfig = useCallback((ex) => {
    setConfigTarget({
      blockExerciseId: ex.blockExerciseId,
      blockId: ex.blockId,
      exerciseName: ex.name,
      exerciseId: ex.exerciseId,
      isNew: false,
    })
    setConfigDraft(exerciseToConfigShape(ex))
  }, [])

  // ── Guardar configuración ─────────────────────────────────────────────────
  const handleConfigConfirm = useCallback(async () => {
    if (!configTarget || !configDraft) return
    if (isDemo) { setConfigTarget(null); return }

    setIsSavingConfig(true)
    try {
      if (configTarget.isNew) {
        // Calcular exercise_order: último ejercicio del bloque + 1
        const block = dayData.blocks.find(b => b.id === configTarget.blockId)
        const order = (block?.exercises?.length ?? 0) + 1
        const newRecord = await addExerciseToBlock(configTarget.blockId, {
          exerciseId: configTarget.exerciseId,
          config: configDraft,
          exerciseOrder: order,
        })

        // Actualizar dayData con el nuevo ejercicio
        setDayData(prev => ({
          ...prev,
          blocks: prev.blocks.map(b =>
            b.id === configTarget.blockId
              ? {
                  ...b,
                  exercises: [
                    ...b.exercises,
                    {
                      blockExerciseId: newRecord.id,
                      blockId: b.id,
                      exerciseId: configTarget.exerciseId,
                      name: configTarget.exerciseName,
                      isKeyExercise: Boolean(configDraft.is_key_exercise),
                      targetSets: parseInt(configDraft.target_sets) || 3,
                      targetRepsMin: parseInt(configDraft.target_reps_min) || 8,
                      targetRepsMax: parseInt(configDraft.target_reps_max) || 10,
                      equipment: null,
                      preferredEquipmentId: configDraft.preferred_equipment_id || '',
                      targetRir: configDraft.target_rir ?? null,
                      tempo: configDraft.tempo ?? null,
                      notes: configDraft.notes || null,
                      prevSets: null,
                    },
                  ],
                }
              : b
          ),
        }))
      } else {
        await updateBlockExerciseConfig(configTarget.blockExerciseId, configDraft)

        // Actualizar dayData localmente
        setDayData(prev => ({
          ...prev,
          blocks: prev.blocks.map(b => ({
            ...b,
            exercises: b.exercises.map(ex =>
              ex.blockExerciseId === configTarget.blockExerciseId
                ? {
                    ...ex,
                    isKeyExercise: Boolean(configDraft.is_key_exercise),
                    targetSets: parseInt(configDraft.target_sets) || ex.targetSets,
                    targetRepsMin: parseInt(configDraft.target_reps_min) || ex.targetRepsMin,
                    targetRepsMax: parseInt(configDraft.target_reps_max) || ex.targetRepsMax,
                    preferredEquipmentId: configDraft.preferred_equipment_id || '',
                    targetRir: configDraft.target_rir ?? null,
                    tempo: configDraft.tempo ?? null,
                    notes: configDraft.notes || null,
                  }
                : ex
            ),
          })),
        }))
      }
      setConfigTarget(null)
      setConfigDraft(null)
    } catch (err) {
      console.error(err)
    } finally {
      setIsSavingConfig(false)
    }
  }, [configTarget, configDraft, dayData, isDemo])

  const handleConfigClose = useCallback(() => {
    setConfigTarget(null)
    setConfigDraft(null)
  }, [])

  // ── Eliminar ejercicio de un bloque ──────────────────────────────────────
  const handleDeleteExercise = useCallback(async (blockExerciseId) => {
    if (isDemo) return
    try {
      const { supabase } = await import('@/lib/supabaseClient')
      await supabase.from('training_block_exercises').delete().eq('id', blockExerciseId)
      setDayData(prev => ({
        ...prev,
        blocks: prev.blocks.map(b => ({
          ...b,
          exercises: b.exercises.filter(ex => ex.blockExerciseId !== blockExerciseId),
        })),
      }))
    } catch (err) {
      console.error('Error eliminando ejercicio:', err)
    }
  }, [isDemo])

  // ── Seleccionar ejercicio desde el buscador ───────────────────────────────
  const handleExerciseSearchSelect = useCallback((exercise) => {
    setSearchTargetBlockId(null)
    setConfigTarget({
      blockExerciseId: null,
      blockId: searchTargetBlockId,
      exerciseName: exercise.name,
      exerciseId: exercise.id,
      isNew: true,
    })
    setConfigDraft(newExerciseConfigShape(exercise))
  }, [searchTargetBlockId])

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
      <div className="flex-1 overflow-y-auto">

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
                  <div className="space-y-2">
                    {block.exercises.map((ex, ei) => (
                      <ExerciseCard
                        key={ex.blockExerciseId}
                        name={ex.name}
                        index={ei}
                        isKeyExercise={ex.isKeyExercise}
                        targetSets={ex.targetSets}
                        targetRepsMin={ex.targetRepsMin}
                        targetRepsMax={ex.targetRepsMax}
                        equipment={ex.equipment}
                        rir={ex.targetRir}
                        tempo={ex.tempo}
                        prevSets={ex.prevSets}
                        onClick={() => openExerciseConfig(ex)}
                        onDelete={() => handleDeleteExercise(ex.blockExerciseId)}
                        animate
                        animateDelay={ei * 0.04}
                        showChevron
                      />
                    ))}
                  </div>

                  {/* Añadir ejercicio al bloque */}
                  {!isDemo && (
                    <button
                      type="button"
                      onClick={() => setSearchTargetBlockId(block.id)}
                      className="mt-2 w-full flex items-center justify-center gap-2 rounded-xl bg-[#F44C40]/10 hover:bg-[#F44C40]/20 border border-[#F44C40]/30 hover:border-[#F44C40]/60 transition-all py-4 text-sm font-semibold text-[#F44C40]"
                    >
                      <Plus className="h-4 w-4" />
                      Añadir ejercicio
                    </button>
                  )}
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

      {/* ── Buscador de ejercicios ── */}
      {searchTargetBlockId && catalogs && (
        <ExerciseSearchModal
          exercises={catalogs.exercises}
          onSelect={handleExerciseSearchSelect}
          onClose={() => setSearchTargetBlockId(null)}
        />
      )}

      {/* ── Configurador de ejercicio ── */}
      {configTarget && configDraft && (
        <ExerciseConfigPanel
          exerciseName={configTarget.exerciseName}
          exercise={configDraft}
          equipmentOptions={catalogs?.equipment ?? []}
          isNew={configTarget.isNew}
          onChange={(patch) => setConfigDraft(prev => ({ ...prev, ...patch }))}
          onConfirm={handleConfigConfirm}
          onClose={handleConfigClose}
        />
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
