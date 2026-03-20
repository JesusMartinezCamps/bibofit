import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Dumbbell, Flame, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import TrainingDayEditor from '@/components/training/shared/day-editor/TrainingDayEditor'
import { useRoutineNavigation } from '@/hooks/useRoutineNavigation'
import {
  BLOCK_LABELS,
  ensureOneKeyExercise,
  exerciseToConfigShape,
  mapConfigPatchToExercise,
} from '@/lib/training/workoutDayHelpers'

export default function RoutineDayWorkspacePage() {
  const navigate            = useNavigate()
  const location            = useLocation()
  const { weeklyDayId }     = useParams()

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

  // Estado local: ejercicio a abrir automáticamente al montar (viene de location.state)
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
                        buildDraftExerciseForBlock(block.id, exercise, exercises.length === 0),
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
