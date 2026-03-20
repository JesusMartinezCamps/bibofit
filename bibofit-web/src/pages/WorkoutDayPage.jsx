import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight,
  Dumbbell, Flame,
  Loader2, Play, CheckCircle2, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import TrainingDayEditor from '@/components/training/shared/day-editor/TrainingDayEditor'
import { useRoutineNavigation } from '@/hooks/useRoutineNavigation'
import { useWorkoutSession } from '@/hooks/useWorkoutSession'
import { getPreviousExerciseSets } from '@/lib/training/workoutSessionService'
import {
  BLOCK_LABELS,
  ensureOneKeyExercise,
  exerciseToConfigShape,
  mapConfigPatchToExercise,
} from '@/lib/training/workoutDayHelpers'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WorkoutDayPage() {
  const navigate        = useNavigate()
  const location        = useLocation()
  const { weeklyDayId } = useParams()

  // ── Datos de la rutina (todos los días + mutaciones) ────────────────────────
  const {
    days,
    activeDay,
    activeIdx: currentDayIdx,
    isFirst: isFirstDay,
    isLast: isLastDay,
    loading,
    savingConfig,
    catalogs,
    progressValue,
    goToDayIdx,
    updateDayLocal,
    updateBlockExercisesLocal,
    removeExerciseAtIndex,
    buildDraftExerciseForBlock,
    persistExerciseConfig,
    handleDeleteExercise,
    persistDayName,
  } = useRoutineNavigation(weeklyDayId)

  // ── Sesión de entrenamiento ─────────────────────────────────────────────────
  const { sessionIds, starting, startSession } = useWorkoutSession(weeklyDayId, activeDay)

  // ── prevSets: historial del día activo ──────────────────────────────────────
  const [prevSetsMap, setPrevSetsMap] = useState({})

  useEffect(() => {
    const exercises = activeDay?.blocks.flatMap(b => b.exercises) ?? []
    if (!exercises.length) return

    Promise.all(
      exercises.map(ex =>
        ex.exerciseId
          ? getPreviousExerciseSets(ex.exerciseId).catch(() => ({}))
          : Promise.resolve({})
      )
    ).then(results => {
      const map = {}
      exercises.forEach((ex, i) => { if (ex.exerciseId) map[ex.exerciseId] = results[i] })
      setPrevSetsMap(map)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDay?.id]) // intencional: recarga prevSets solo al cambiar de día, no al editar config

  // ── Ejercicio a abrir automáticamente (pasado desde TrainingPlanPage) ───────
  const [pendingOpenExerciseId, setPendingOpenExerciseId] = useState(() => {
    const id = location.state?.openExerciseId
    return id ? String(id) : null
  })

  useEffect(() => {
    const id = location.state?.openExerciseId
    if (id) setPendingOpenExerciseId(String(id))
  }, [location.state])

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <main className="w-full px-4 py-10">
        <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card/70 p-6 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#F44C40]" />
          <p className="mt-3 text-sm text-muted-foreground">Cargando día de entrenamiento...</p>
        </div>
      </main>
    )
  }

  if (!days.length || !activeDay) {
    return (
      <main className="w-full px-4 py-10">
        <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card/70 p-6 text-center">
          <p className="text-base font-semibold text-foreground">No hay días configurados en la rutina activa.</p>
          <Button className="mt-4" onClick={() => navigate('/plan/entreno')}>
            Volver al plan
          </Button>
        </div>
      </main>
    )
  }

  return (
    <div className="flex flex-col min-h-[calc(100dvh-64px)] bg-[#0f1115] text-white">

      {/* ── Header ── */}
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

          <textarea
            rows={1}
            value={activeDay.name || ''}
            onChange={(e) => updateDayLocal(activeDay.id, d => ({ ...d, name: e.target.value }))}
            onBlur={(e) => void persistDayName(activeDay.id, e.target.value)}
            placeholder={`Día ${activeDay.dayIndex}`}
            className="flex-1 mx-2 resize-none bg-transparent text-sm font-semibold text-white placeholder:text-white/30 focus:outline-none text-center leading-snug overflow-hidden"
            style={{ minHeight: '1.4em' }}
            onInput={(e) => {
              e.target.style.height = 'auto'
              e.target.style.height = `${e.target.scrollHeight}px`
            }}
          />

          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/plan/entreno')}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* ── Tabs de días ── */}
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

      {/* ── Barra de progreso ── */}
      <div className="shrink-0 h-1 bg-muted w-full overflow-hidden">
        <div
          className="h-full bg-[#F44C40] transition-all duration-400 ease-out"
          style={{ width: `${progressValue}%` }}
        />
      </div>

      {/* ── Contenido ── */}
      <div className="flex-1 w-full max-w-3xl mx-auto flex flex-col px-5 py-6 min-h-0">
        <div className="flex-1 overflow-y-auto pr-1 space-y-4 pb-28">

          {activeDay.blocks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay bloques configurados en este día.</p>
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
                  addButtonLabel="Añadir ejercicio"
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
                    prevSets: prevSetsMap[exercise.exerciseId] ?? null,
                    showChevron: true,
                  })}
                  resolveExercisePatch={mapConfigPatchToExercise}
                  toConfigExercise={exerciseToConfigShape}
                  resolveExerciseNameForConfig={({ exercise }) => exercise.name}
                  initialOpenExerciseId={
                    pendingOpenExerciseId
                    && block.exercises.some(e => String(e.blockExerciseId) === pendingOpenExerciseId)
                      ? pendingOpenExerciseId
                      : null
                  }
                  onInitialExerciseOpened={() => setPendingOpenExerciseId(null)}
                  onRequestAddExercise={(exercise) => {
                    let newExerciseIdx = 0
                    updateBlockExercisesLocal(activeDay.id, block.id, (exercises) => {
                      newExerciseIdx = exercises.length
                      return [...exercises, buildDraftExerciseForBlock(block.id, exercise, exercises.length === 0)]
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
                    void persistExerciseConfig({ dayId: activeDay.id, blockId: block.id, exerciseIdx, exercise, isNew })
                  }}
                  onCancelExercise={({ isNew, exerciseIdx }) => {
                    if (!isNew) return
                    removeExerciseAtIndex(activeDay.id, block.id, exerciseIdx)
                  }}
                  onRemoveExercise={(exerciseIdx, exercise) => {
                    void handleDeleteExercise({ dayId: activeDay.id, blockId: block.id, exerciseIdx, exercise })
                  }}
                />
              </div>
            ))
          )}
        </div>

        {/* ── Navegación prev/next ── */}
        <div className="pt-4 mt-auto shrink-0 flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => { if (isFirstDay) navigate('/plan/entreno'); else goToDayIdx(currentDayIdx - 1) }}
            className="flex items-center gap-1 px-3"
          >
            <ChevronLeft className="h-4 w-4" />
            {isFirstDay ? 'Volver' : `Día ${days[currentDayIdx - 1]?.dayIndex || ''}`}
          </Button>

          <Button
            type="button"
            onClick={() => { if (isLastDay) navigate('/plan/entreno'); else goToDayIdx(currentDayIdx + 1) }}
            className="flex-1 bg-[#F44C40] hover:bg-[#E23C32] text-white flex items-center justify-center gap-1"
          >
            {isLastDay ? 'Volver al plan' : `Día ${days[currentDayIdx + 1]?.dayIndex || ''}`}
            {!isLastDay && <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* ── CTA: Iniciar / Continuar sesión ── */}
      <div className="fixed inset-x-0 bottom-0 z-20 bg-[#0f1115]/95 backdrop-blur-sm border-t border-border px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <Button
          onClick={startSession}
          disabled={starting}
          className="w-full h-12 text-base font-bold rounded-2xl gap-3 bg-[#F44C40] hover:bg-[#E23C32] text-white"
        >
          {starting ? (
            <><Loader2 className="w-5 h-5 animate-spin" />Iniciando sesión...</>
          ) : sessionIds ? (
            <><CheckCircle2 className="w-5 h-5" />Continuar sesión</>
          ) : (
            <><Play className="w-5 h-5" />Iniciar sesión</>
          )}
        </Button>
      </div>

      {/* ── Overlay guardando ── */}
      {savingConfig && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <Loader2 className="w-8 h-8 animate-spin text-white" />
        </div>
      )}
    </div>
  )
}
