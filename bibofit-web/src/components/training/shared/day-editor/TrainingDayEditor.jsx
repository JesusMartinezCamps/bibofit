import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import ExerciseCard from '@/components/training/shared/ExerciseCard';
import ExerciseConfigPanel from './ExerciseConfigPanel';
import ExerciseSearchModal from './ExerciseSearchModal';

const toStringKey = (value) => String(value ?? '');
const getExerciseConfigSignature = (exerciseConfig = {}) =>
  JSON.stringify({
    target_sets: String(exerciseConfig.target_sets ?? ''),
    target_reps_min: String(exerciseConfig.target_reps_min ?? ''),
    target_reps_max: String(exerciseConfig.target_reps_max ?? ''),
    target_rir: exerciseConfig.target_rir ?? null,
    rest_seconds: Number.parseInt(String(exerciseConfig.rest_seconds ?? 120), 10) || 120,
    tempo: exerciseConfig.tempo ?? null,
    notes: String(exerciseConfig.notes ?? ''),
    is_key_exercise: exerciseConfig.is_key_exercise === true,
    preferred_equipment_id: String(exerciseConfig.preferred_equipment_id || ''),
  });

const TrainingDayEditor = ({
  dayName,
  dayNamePlaceholder,
  onDayNameChange,
  showDayName = true,
  exercises,
  exerciseOptions = [],
  equipmentOptions = [],
  onRequestAddExercise,
  onUpdateExercise,
  onRemoveExercise,
  onConfirmExercise,
  onCancelExercise,
  addButtonLabel = 'Añadir ejercicio',
  emptyMessage = 'Añade al menos un ejercicio para este día',
  showAddButton = true,
  animateCards = false,
  resolveExerciseCatalogId = (exercise) => exercise?.exercise_id,
  resolveExerciseViewModel,
  resolveExercisePatch = (patch) => patch,
  toConfigExercise = (exercise) => exercise,
  resolveEquipmentOptionsForExercise,
  resolveExerciseNameForConfig,
  initialOpenExerciseId = null,
  onInitialExerciseOpened,
}) => {
  const [configTarget, setConfigTarget] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const autoOpenedExerciseRef = useRef(null);

  const catalogById = useMemo(
    () => new Map((exerciseOptions || []).map((item) => [toStringKey(item.id), item])),
    [exerciseOptions]
  );

  const equipmentById = useMemo(
    () => new Map((equipmentOptions || []).map((item) => [toStringKey(item.id), item])),
    [equipmentOptions]
  );

  const defaultViewModel = (exercise) => {
    const catalogId = resolveExerciseCatalogId(exercise);
    const catalog = catalogById.get(toStringKey(catalogId));
    const preferredEquipmentId = exercise?.preferred_equipment_id ?? exercise?.preferredEquipmentId;

    return {
      name: exercise?.name ?? catalog?.name ?? null,
      isKeyExercise: Boolean(exercise?.is_key_exercise ?? exercise?.isKeyExercise),
      targetSets: exercise?.target_sets ?? exercise?.targetSets,
      targetRepsMin: exercise?.target_reps_min ?? exercise?.targetRepsMin,
      targetRepsMax: exercise?.target_reps_max ?? exercise?.targetRepsMax,
      rir: exercise?.target_rir ?? exercise?.targetRir ?? null,
      restSeconds: exercise?.rest_seconds ?? exercise?.restSeconds ?? 120,
      tempo: exercise?.tempo ?? null,
      equipment:
        exercise?.equipment
        ?? equipmentById.get(toStringKey(preferredEquipmentId))?.name
        ?? null,
    };
  };

  const getExerciseViewModel = (exercise, exerciseIdx) => {
    if (resolveExerciseViewModel) {
      return resolveExerciseViewModel({
        exercise,
        exerciseIdx,
        exerciseOptions,
        equipmentOptions,
        catalogById,
        equipmentById,
      });
    }
    return defaultViewModel(exercise);
  };

  const visibleExerciseEntries = (exercises || []).map((exercise, exerciseIdx) => ({
    exercise,
    exerciseIdx,
    viewModel: getExerciseViewModel(exercise, exerciseIdx),
  }));

  const handleExerciseSelect = (exerciseCatalogItem) => {
    if (!onRequestAddExercise) {
      setShowSearch(false);
      return;
    }

    const target = onRequestAddExercise(exerciseCatalogItem);
    setShowSearch(false);

    if (target && Number.isInteger(target.exerciseIdx)) {
      setConfigTarget({
        exerciseIdx: target.exerciseIdx,
        isNew: Boolean(target.isNew),
        initialSignature: null,
      });
    }
  };

  const activeExercise =
    configTarget !== null ? exercises?.[configTarget.exerciseIdx] ?? null : null;

  const activeCatalogId = activeExercise ? resolveExerciseCatalogId(activeExercise) : null;
  const activeExerciseCatalog =
    activeExercise && activeCatalogId !== null
      ? catalogById.get(toStringKey(activeCatalogId)) ?? null
      : null;

  const activeExerciseName = activeExercise
    ? (
      resolveExerciseNameForConfig?.({
        exercise: activeExercise,
        exerciseIdx: configTarget?.exerciseIdx,
        exerciseCatalog: activeExerciseCatalog,
      })
      ?? getExerciseViewModel(activeExercise, configTarget?.exerciseIdx ?? 0)?.name
      ?? 'Ejercicio'
    )
    : 'Ejercicio';

  const activeEquipmentOptions = activeExercise
    ? (
      resolveEquipmentOptionsForExercise?.({
        exercise: activeExercise,
        exerciseIdx: configTarget?.exerciseIdx,
        exerciseCatalog: activeExerciseCatalog,
        equipmentOptions,
      })
      ?? equipmentOptions
    )
    : [];

  const activeConfigSignature = activeExercise
    ? getExerciseConfigSignature(toConfigExercise(activeExercise))
    : null;

  const confirmDisabled = Boolean(
    configTarget
    && !configTarget.isNew
    && configTarget.initialSignature !== null
    && activeConfigSignature === configTarget.initialSignature
  );

  const handleConfigChange = (patch) => {
    if (configTarget === null || !onUpdateExercise) return;
    onUpdateExercise(configTarget.exerciseIdx, resolveExercisePatch(patch));
  };

  const handleConfigConfirm = () => {
    if (configTarget === null) return;

    const shouldClose = onConfirmExercise?.({
      ...configTarget,
      exercise: activeExercise,
    });

    if (shouldClose !== false) {
      setConfigTarget(null);
    }
  };

  const handleConfigClose = () => {
    if (configTarget === null) return;

    if (onCancelExercise) {
      const shouldClose = onCancelExercise({
        ...configTarget,
        exercise: activeExercise,
      });
      if (shouldClose === false) return;
      setConfigTarget(null);
      return;
    }

    if (configTarget.isNew && onRemoveExercise) {
      onRemoveExercise(configTarget.exerciseIdx);
    }

    setConfigTarget(null);
  };

  useEffect(() => {
    if (!initialOpenExerciseId) return;
    if (autoOpenedExerciseRef.current === String(initialOpenExerciseId)) return;

    const targetIdx = (exercises || []).findIndex((exercise) => {
      const candidateId = exercise?.blockExerciseId ?? exercise?.id ?? null;
      return candidateId !== null && String(candidateId) === String(initialOpenExerciseId);
    });

    if (targetIdx < 0) return;

    const targetExercise = (exercises || [])[targetIdx];
    if (!targetExercise) return;

    autoOpenedExerciseRef.current = String(initialOpenExerciseId);
    setConfigTarget({
      exerciseIdx: targetIdx,
      isNew: false,
      initialSignature: getExerciseConfigSignature(toConfigExercise(targetExercise)),
    });
    onInitialExerciseOpened?.(String(initialOpenExerciseId));
  }, [exercises, initialOpenExerciseId, onInitialExerciseOpened, toConfigExercise]);

  return (
    <>
      <div className="flex-1 overflow-y-auto space-y-5 pr-1">
        {showDayName && (
          <textarea
            rows={1}
            value={dayName}
            onChange={(e) => onDayNameChange?.(e.target.value)}
            placeholder={dayNamePlaceholder}
            className="w-full resize-none bg-transparent text-xl font-bold text-white placeholder:text-white/25 focus:outline-none leading-snug overflow-hidden border-b border-transparent focus:border-white/15 transition-colors pb-1"
            style={{ minHeight: '1.8em' }}
            onInput={(e) => {
              e.target.style.height = 'auto';
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
          />
        )}

        {visibleExerciseEntries.length > 0 && (
          <div className="space-y-2">
            {visibleExerciseEntries.map(({ exercise, exerciseIdx, viewModel }) => {
              if (!viewModel?.name) return null;

              return (
                <ExerciseCard
                  key={`ex-${exerciseIdx}`}
                  name={viewModel.name}
                  index={exerciseIdx}
                  isKeyExercise={viewModel.isKeyExercise}
                  targetSets={viewModel.targetSets}
                  targetRepsMin={viewModel.targetRepsMin}
                  targetRepsMax={viewModel.targetRepsMax}
                  equipment={viewModel.equipment}
                  rir={viewModel.rir}
                  restSeconds={viewModel.restSeconds}
                  tempo={viewModel.tempo}
                  prevSets={viewModel.prevSets}
                  onClick={() =>
                    setConfigTarget({
                      exerciseIdx,
                      isNew: false,
                      initialSignature: getExerciseConfigSignature(toConfigExercise(exercise)),
                    })
                  }
                  onDelete={onRemoveExercise ? () => onRemoveExercise(exerciseIdx, exercise) : null}
                  animate={animateCards}
                  showChevron={Boolean(viewModel.showChevron)}
                />
              );
            })}
          </div>
        )}

        {showAddButton && (
          <button
            type="button"
            onClick={() => setShowSearch(true)}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#F44C40]/10 hover:bg-[#F44C40]/20 border border-[#F44C40]/30 hover:border-[#F44C40]/60 transition-all py-4 text-sm font-semibold text-[#F44C40]"
          >
            <Plus className="h-4 w-4" />
            {addButtonLabel}
          </button>
        )}

        {(exercises || []).length === 0 && (
          <p className="text-xs text-amber-300/60 text-center -mt-2">
            {emptyMessage}
          </p>
        )}
      </div>

      {showSearch && (
        <ExerciseSearchModal
          exercises={exerciseOptions}
          onSelect={handleExerciseSelect}
          onClose={() => setShowSearch(false)}
        />
      )}

      {configTarget !== null && activeExercise && (
        <ExerciseConfigPanel
          exerciseName={activeExerciseName}
          exercise={toConfigExercise(activeExercise)}
          equipmentOptions={activeEquipmentOptions}
          isNew={configTarget.isNew}
          confirmDisabled={confirmDisabled}
          onChange={handleConfigChange}
          onConfirm={handleConfigConfirm}
          onClose={handleConfigClose}
        />
      )}
    </>
  );
};

export default TrainingDayEditor;
