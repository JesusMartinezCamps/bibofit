import React from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getDefaultDayName } from '@/hooks/useCreateRoutineWizard';
import TrainingDayEditor from '@/components/training/shared/day-editor/TrainingDayEditor';

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

  const day = dayBlueprint[currentDayIdx];
  if (!day) return null;

  const exercises = day.blocks?.[BLOCK_IDX]?.exercises ?? [];
  const isFirstDay = currentDayIdx === 0;
  const isLastDay = currentDayIdx === cycleDays - 1;

  const handlePrevDay = () => {
    if (isFirstDay) goPrev();
    else setCurrentDayIdx((d) => d - 1);
  };

  const handleNextDay = () => {
    if (!isLastDay) setCurrentDayIdx((d) => d + 1);
  };

  const resolveEquipmentOptionsForExercise = ({ exerciseCatalog }) => {
    if (!exerciseCatalog?.equipment_id) return [];
    return (equipmentOptions || []).filter((eq) => eq.id === exerciseCatalog.equipment_id);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <TrainingDayEditor
        dayName={day.name}
        dayNamePlaceholder={getDefaultDayName(currentDayIdx, day.blocks?.[0]?.type || 'custom')}
        onDayNameChange={(name) =>
          updateDay(currentDayIdx, (current) => ({ ...current, name }))
        }
        exercises={exercises}
        exerciseOptions={exerciseOptions}
        equipmentOptions={equipmentOptions}
        onRequestAddExercise={(exercise) => {
          const realCount = exercises.filter((e) => e.exercise_id).length;
          addExerciseToBlock(currentDayIdx, BLOCK_IDX, {
            exercise_id: String(exercise.id),
            is_key_exercise: realCount === 0,
            preferred_equipment_id: exercise.equipment_id ? String(exercise.equipment_id) : '',
          });
          return { exerciseIdx: exercises.length, isNew: true };
        }}
        onUpdateExercise={(exerciseIdx, patch) => {
          updateBlockExercise(currentDayIdx, BLOCK_IDX, exerciseIdx, patch);
        }}
        onRemoveExercise={(exerciseIdx) => {
          removeExerciseFromBlock(currentDayIdx, BLOCK_IDX, exerciseIdx);
        }}
        onCancelExercise={({ isNew, exerciseIdx }) => {
          if (isNew) {
            removeExerciseFromBlock(currentDayIdx, BLOCK_IDX, exerciseIdx);
          }
        }}
        resolveEquipmentOptionsForExercise={resolveEquipmentOptionsForExercise}
        animateCards={false}
      />

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
  );
};

export default StepDayEditor;
