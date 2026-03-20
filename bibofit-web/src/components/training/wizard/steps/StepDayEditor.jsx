import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getDefaultDayName } from '@/hooks/useCreateRoutineWizard';
import ExerciseSearchModal from '../ExerciseSearchModal';
import ExerciseConfigPanel from '../ExerciseConfigPanel';
import ExerciseCard from '../../shared/ExerciseCard';

// All exercises live in blocks[0] — the block concept is transparent to the user.
const BLOCK_IDX = 0;

const StepDayEditor = ({ wizard, onSubmit, isSubmitting }) => {
  const {
    dayBlueprint,
    cycleDays,
    currentDayIdx,
    setCurrentDayIdx,
    exerciseOptions,
    equipmentOptions,
    updateDay,
    addExerciseToBlock,
    removeExerciseFromBlock,
    updateBlockExercise,
    goPrev,
  } = wizard;

  // null | { exerciseIdx: number, isNew: boolean }
  const [configTarget, setConfigTarget] = useState(null);
  const [showSearch, setShowSearch] = useState(false);

  const day = dayBlueprint[currentDayIdx];
  if (!day) return null;

  const exercises = day.blocks?.[BLOCK_IDX]?.exercises ?? [];
  const isFirstDay = currentDayIdx === 0;
  const isLastDay = currentDayIdx === cycleDays - 1;

  // ── Navigation ────────────────────────────────────────────────────────────
  const handlePrevDay = () => {
    if (isFirstDay) goPrev();
    else setCurrentDayIdx((d) => d - 1);
  };

  const handleNextDay = () => {
    if (!isLastDay) setCurrentDayIdx((d) => d + 1);
  };

  // ── Exercise selection flow ───────────────────────────────────────────────
  // Step 1: search modal → picks an exercise
  const handleExerciseSelect = (exercise) => {
    // Count only exercises with a real exercise_id — the default block starts
    // with an empty placeholder that must not affect the "is first?" check.
    const realCount = exercises.filter((e) => e.exercise_id).length;
    addExerciseToBlock(currentDayIdx, BLOCK_IDX, {
      exercise_id: String(exercise.id),
      is_key_exercise: realCount === 0,
      preferred_equipment_id: exercise.equipment_id ? String(exercise.equipment_id) : '',
    });
    setShowSearch(false);
    setConfigTarget({ exerciseIdx: exercises.length, isNew: true });
  };

  // ── Config panel helpers ──────────────────────────────────────────────────
  const handleConfigChange = (patch) => {
    if (configTarget === null) return;
    updateBlockExercise(currentDayIdx, BLOCK_IDX, configTarget.exerciseIdx, patch);
  };

  const handleConfigConfirm = () => {
    setConfigTarget(null);
  };

  const handleConfigClose = () => {
    // If it was a new exercise that the user dismissed without confirming,
    // remove it (it was added tentatively).
    if (configTarget?.isNew) {
      removeExerciseFromBlock(currentDayIdx, BLOCK_IDX, configTarget.exerciseIdx);
    }
    setConfigTarget(null);
  };

  // ── Active config exercise ────────────────────────────────────────────────
  const activeExercise =
    configTarget !== null ? exercises[configTarget.exerciseIdx] ?? null : null;

  // Resolve the exercise catalog entry (has equipment_id, name, etc.)
  const activeExerciseCatalog = activeExercise
    ? exerciseOptions.find((e) => String(e.id) === String(activeExercise.exercise_id)) ?? null
    : null;

  const activeExerciseName = activeExerciseCatalog?.name ?? 'Ejercicio';

  // Filter equipment to only show the exercise's own equipment.
  // If the exercise has no equipment, show an empty list (selector shows only "Sin preferencia").
  const activeEquipmentOptions = activeExerciseCatalog?.equipment_id
    ? equipmentOptions.filter((eq) => eq.id === activeExerciseCatalog.equipment_id)
    : [];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto space-y-5 pr-1">

          {/* Day name — clean editable title */}
          <textarea
            rows={1}
            value={day.name}
            onChange={(e) =>
              updateDay(currentDayIdx, (current) => ({ ...current, name: e.target.value }))
            }
            placeholder={getDefaultDayName(currentDayIdx, day.blocks?.[0]?.type || 'custom')}
            className="w-full resize-none bg-transparent text-xl font-bold text-white placeholder:text-white/25 focus:outline-none leading-snug overflow-hidden border-b border-transparent focus:border-white/15 transition-colors pb-1"
            style={{ minHeight: '1.8em' }}
            onInput={(e) => {
              e.target.style.height = 'auto';
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
          />

          {/* Exercise list */}
          {exercises.length > 0 && (
            <div className="space-y-2">
              {exercises.map((exercise, exerciseIdx) => {
                const name =
                  exerciseOptions.find((e) => String(e.id) === String(exercise.exercise_id))
                    ?.name ?? null;
                if (!name) return null;

                const equipment = equipmentOptions.find(
                  (eq) => String(eq.id) === String(exercise.preferred_equipment_id)
                )?.name ?? null;

                return (
                  <ExerciseCard
                    key={`ex-${exerciseIdx}`}
                    name={name}
                    index={exerciseIdx}
                    isKeyExercise={exercise.is_key_exercise}
                    targetSets={exercise.target_sets}
                    targetRepsMin={exercise.target_reps_min}
                    targetRepsMax={exercise.target_reps_max}
                    equipment={equipment}
                    rir={exercise.target_rir}
                    tempo={exercise.tempo}
                    onClick={() => setConfigTarget({ exerciseIdx, isNew: false })}
                    onDelete={() => removeExerciseFromBlock(currentDayIdx, BLOCK_IDX, exerciseIdx)}
                    animate={false}
                  />
                );
              })}
            </div>
          )}

          {/* Add exercise — prominent CTA */}
          <button
            type="button"
            onClick={() => setShowSearch(true)}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#F44C40]/10 hover:bg-[#F44C40]/20 border border-[#F44C40]/30 hover:border-[#F44C40]/60 transition-all py-4 text-sm font-semibold text-[#F44C40]"
          >
            <Plus className="h-4 w-4" />
            Añadir ejercicio
          </button>

          {exercises.length === 0 && (
            <p className="text-xs text-amber-300/60 text-center -mt-2">
              Añade al menos un ejercicio para este día
            </p>
          )}
        </div>

        {/* Navigation footer */}
        <div className="pt-4 mt-auto shrink-0 flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handlePrevDay}
            className="flex items-center gap-1 px-3"
          >
            <ChevronLeft className="h-4 w-4" />
            {isFirstDay ? 'Atrás' : `Día ${currentDayIdx}`}
          </Button>

          {isLastDay ? (
            <Button
              type="button"
              onClick={onSubmit}
              disabled={isSubmitting}
              className="flex-1 h-12 text-base bg-[#F44C40] hover:bg-[#E23C32] text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando rutina...
                </>
              ) : (
                'Crear rutina'
              )}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleNextDay}
              className="flex-1 bg-[#F44C40] hover:bg-[#E23C32] text-white flex items-center justify-center gap-1"
            >
              Día {currentDayIdx + 2}
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Exercise search modal */}
      {showSearch && (
        <ExerciseSearchModal
          exercises={exerciseOptions}
          onSelect={handleExerciseSelect}
          onClose={() => setShowSearch(false)}
        />
      )}

      {/* Exercise config panel — WorkoutView */}
      {configTarget !== null && activeExercise && (
        <ExerciseConfigPanel
          exerciseName={activeExerciseName}
          exercise={activeExercise}
          equipmentOptions={activeEquipmentOptions}
          isNew={configTarget.isNew}
          onChange={handleConfigChange}
          onConfirm={handleConfigConfirm}
          onClose={handleConfigClose}
        />
      )}
    </>
  );
};

export default StepDayEditor;
