import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { getTrainingZoneCatalogs } from '@/lib/training/trainingPlanService';

const MIN_CYCLE_DAYS = 1;
const MAX_CYCLE_DAYS = 7;

export const WIZARD_DRAFT_KEY = 'bibofit_routine_wizard_draft';

const loadDraft = () => {
  try {
    const raw = localStorage.getItem(WIZARD_DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

export const DAY_TYPE_OPTIONS = [
  { value: 'torso', label: 'Torso' },
  { value: 'pierna', label: 'Pierna' },
  { value: 'fullbody', label: 'Full body' },
  { value: 'push', label: 'Empuje (push)' },
  { value: 'pull', label: 'Tracción (pull)' },
  { value: 'core', label: 'Core' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'movilidad', label: 'Movilidad' },
  { value: 'custom', label: 'Personalizado' },
];

const DEFAULT_DAY_ROTATION = ['torso', 'pierna', 'fullbody', 'torso', 'pierna', 'fullbody', 'cardio'];

export const getDayTypeLabel = (type) =>
  DAY_TYPE_OPTIONS.find((o) => o.value === type)?.label || 'Personalizado';

export const getDefaultDayName = (index, type) =>
  `Día ${index + 1} - ${getDayTypeLabel(type)}`;

const getDefaultDayType = (index) =>
  DEFAULT_DAY_ROTATION[index % DEFAULT_DAY_ROTATION.length] || 'custom';

const makeDefaultExercise = (isKey = false) => ({
  exercise_id: '',
  preferred_equipment_id: '',
  target_sets: '3',
  target_reps_min: '8',
  target_reps_max: '12',
  progression_increment_kg: '5',
  backoff_percentage: '0.8',
  is_key_exercise: isKey,
  notes: '',
  target_rir: 1,          // default RIR 1 (1 rep in reserve)
  tempo: 'estricta',      // 'estricta' | 'explosiva' | 'pausa' | 'bombeada' | null
});

const makeDefaultBlock = (type = 'custom') => ({
  type,
  name: '',
  exercises: [makeDefaultExercise(true)],
});

const makeDefaultDay = (index) => {
  const defaultType = getDefaultDayType(index);
  return {
    name: getDefaultDayName(index, defaultType),
    blocks: [makeDefaultBlock(defaultType)],
  };
};

const normalizeDayBlueprintLength = (current, size) => {
  const safeSize = Math.max(MIN_CYCLE_DAYS, Math.min(MAX_CYCLE_DAYS, size));
  const next = [...current];
  if (next.length > safeSize) return next.slice(0, safeSize);
  while (next.length < safeSize) next.push(makeDefaultDay(next.length));
  return next;
};

// Step IDs in order (muscle-targets is conditional)
const BASE_STEPS = ['basic-info', 'training-days', 'calendar', 'volume-question', 'day-editor'];
const STEPS_WITH_MUSCLE = ['basic-info', 'training-days', 'calendar', 'volume-question', 'muscle-targets', 'day-editor'];

export const useCreateRoutineWizard = () => {
  // Catalogs
  const [isLoadingCatalogs, setIsLoadingCatalogs] = useState(true);
  const [objectiveOptions, setObjectiveOptions] = useState([]);
  const [muscleOptions, setMuscleOptions] = useState([]);
  const [exerciseOptions, setExerciseOptions] = useState([]);
  const [equipmentOptions, setEquipmentOptions] = useState([]);

  // Load persisted draft once (stable between renders)
  const [_draft] = useState(loadDraft);

  // Step 1 — Basic Info
  const [weeklyRoutineName, setWeeklyRoutineName] = useState(_draft?.weeklyRoutineName ?? 'Rutina semanal');
  const [selectedObjectiveId, setSelectedObjectiveId] = useState(_draft?.selectedObjectiveId ?? '');

  // Step 2 — Training Days
  const [cycleDays, setCycleDays] = useState(_draft?.cycleDays ?? 4);

  // Step 3 — Calendar
  const [dayBlueprint, setDayBlueprint] = useState(() =>
    normalizeDayBlueprintLength(_draft?.dayBlueprint ?? [], _draft?.cycleDays ?? 4)
  );

  // Step 4 — Volume Question
  const [wantsVolumeGoal, setWantsVolumeGoal] = useState(_draft?.wantsVolumeGoal ?? null);

  // Step 5 — Muscle Targets
  const [muscleTargetInputs, setMuscleTargetInputs] = useState(_draft?.muscleTargetInputs ?? {});

  // Step 6+ — Day Editor navigation
  const [currentDayIdx, setCurrentDayIdx] = useState(_draft?.currentDayIdx ?? 0);

  // Wizard step navigation
  const [currentStepId, setCurrentStepId] = useState(_draft?.currentStepId ?? 'basic-info');
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = backward

  // Load catalogs once
  useEffect(() => {
    let isMounted = true;
    const loadCatalogs = async () => {
      setIsLoadingCatalogs(true);
      try {
        const catalogs = await getTrainingZoneCatalogs();
        if (!isMounted) return;
        setObjectiveOptions(catalogs.objectives || []);
        setMuscleOptions(catalogs.muscles || []);
        setExerciseOptions(catalogs.exercises || []);
        setEquipmentOptions(catalogs.equipment || []);
        const defaultObjectiveId = catalogs.objectives?.[0]?.id;
        // Only set default if nothing is saved (draft or user selection)
        if (defaultObjectiveId) setSelectedObjectiveId((prev) => prev || String(defaultObjectiveId));
      } catch (err) {
        console.error('Error loading training catalogs:', err);
      } finally {
        if (isMounted) setIsLoadingCatalogs(false);
      }
    };
    loadCatalogs();
    return () => { isMounted = false; };
  }, []);

  // Persist draft to localStorage on every relevant state change
  useEffect(() => {
    try {
      localStorage.setItem(WIZARD_DRAFT_KEY, JSON.stringify({
        weeklyRoutineName,
        selectedObjectiveId,
        cycleDays,
        dayBlueprint,
        wantsVolumeGoal,
        muscleTargetInputs,
        currentStepId,
        currentDayIdx,
      }));
    } catch { /* ignore */ }
  }, [weeklyRoutineName, selectedObjectiveId, cycleDays, dayBlueprint, wantsVolumeGoal, muscleTargetInputs, currentStepId, currentDayIdx]);

  const clearDraft = () => {
    try { localStorage.removeItem(WIZARD_DRAFT_KEY); } catch { /* ignore */ }
  };

  // Sync blueprint size when cycleDays changes
  useEffect(() => {
    setDayBlueprint((current) => normalizeDayBlueprintLength(current, cycleDays));
  }, [cycleDays]);

  // Dynamic step sequence
  const stepSequence = useMemo(
    () => (wantsVolumeGoal ? STEPS_WITH_MUSCLE : BASE_STEPS),
    [wantsVolumeGoal]
  );

  const currentStepIndex = stepSequence.indexOf(currentStepId);
  const totalSteps = stepSequence.length;

  const goNext = () => {
    const nextIdx = currentStepIndex + 1;
    if (nextIdx < stepSequence.length) {
      setDirection(1);
      setCurrentStepId(stepSequence[nextIdx]);
      setCurrentDayIdx(0);
    }
  };

  const goPrev = () => {
    // Inside day-editor: back navigates to previous day
    if (currentStepId === 'day-editor' && currentDayIdx > 0) {
      setDirection(-1);
      setCurrentDayIdx((d) => d - 1);
      return;
    }
    const prevIdx = currentStepIndex - 1;
    if (prevIdx >= 0) {
      setDirection(-1);
      setCurrentStepId(stepSequence[prevIdx]);
    }
  };

  // Special handler for volume-question: sets the answer and navigates in one shot,
  // avoiding React 18 batching issues where stepSequence memo hasn't updated yet.
  const confirmVolumeGoal = (wants) => {
    setWantsVolumeGoal(wants);
    setDirection(1);
    setCurrentStepId(wants ? 'muscle-targets' : 'day-editor');
    setCurrentDayIdx(0);
  };

  // ── Day blueprint mutations ──────────────────────────────────────

  const updateDay = (index, updater) => {
    setDayBlueprint((current) =>
      current.map((day, dayIdx) => (dayIdx === index ? updater(day) : day))
    );
  };

  const updateDayPrimaryType = (dayIdx, type) => {
    updateDay(dayIdx, (day) => {
      const currentType = day.blocks?.[0]?.type || 'custom';
      const expectedCurrentName = getDefaultDayName(dayIdx, currentType);
      const shouldReplaceName = !day.name || day.name === expectedCurrentName;
      const nextBlocks = day.blocks.length
        ? day.blocks.map((block, idx) => (idx === 0 ? { ...block, type } : block))
        : [makeDefaultBlock(type)];
      return {
        ...day,
        name: shouldReplaceName ? getDefaultDayName(dayIdx, type) : day.name,
        blocks: nextBlocks,
      };
    });
  };

  const addBlock = (dayIdx) => {
    updateDay(dayIdx, (day) => ({
      ...day,
      blocks: [
        ...day.blocks,
        makeDefaultBlock(day.blocks?.[day.blocks.length - 1]?.type || 'custom'),
      ],
    }));
  };

  const removeBlock = (dayIdx, blockIdx) => {
    updateDay(dayIdx, (day) => {
      if (day.blocks.length <= 1) return day;
      return { ...day, blocks: day.blocks.filter((_, idx) => idx !== blockIdx) };
    });
  };

  const updateBlock = (dayIdx, blockIdx, patch) => {
    updateDay(dayIdx, (day) => ({
      ...day,
      blocks: day.blocks.map((block, idx) =>
        idx === blockIdx ? { ...block, ...patch } : block
      ),
    }));
  };

  const addExerciseToBlock = (dayIdx, blockIdx, exerciseData = {}) => {
    updateDay(dayIdx, (day) => ({
      ...day,
      blocks: day.blocks.map((block, idx) =>
        idx === blockIdx
          ? {
              ...block,
              exercises: [
                ...block.exercises,
                { ...makeDefaultExercise(block.exercises.length === 0), ...exerciseData },
              ],
            }
          : block
      ),
    }));
  };

  const removeExerciseFromBlock = (dayIdx, blockIdx, exerciseIdx) => {
    updateDay(dayIdx, (day) => ({
      ...day,
      blocks: day.blocks.map((block, idx) => {
        if (idx !== blockIdx) return block;
        if (block.exercises.length <= 1) return block;
        const nextExercises = block.exercises.filter((_, exIdx) => exIdx !== exerciseIdx);
        const hasKeyExercise = nextExercises.some((e) => e.is_key_exercise);
        return {
          ...block,
          exercises: hasKeyExercise
            ? nextExercises
            : nextExercises.map((e, exIdx) => ({ ...e, is_key_exercise: exIdx === 0 })),
        };
      }),
    }));
  };

  const updateBlockExercise = (dayIdx, blockIdx, exerciseIdx, patch) => {
    updateDay(dayIdx, (day) => ({
      ...day,
      blocks: day.blocks.map((block, idx) => {
        if (idx !== blockIdx) return block;
        let nextExercises = block.exercises.map((e, exIdx) =>
          exIdx !== exerciseIdx ? e : { ...e, ...patch }
        );
        if (patch.is_key_exercise === true) {
          nextExercises = nextExercises.map((e, exIdx) => ({
            ...e,
            is_key_exercise: exIdx === exerciseIdx,
          }));
        }
        if (!nextExercises.some((e) => e.is_key_exercise) && nextExercises.length) {
          nextExercises = nextExercises.map((e, exIdx) => ({
            ...e,
            is_key_exercise: exIdx === 0,
          }));
        }
        return { ...block, exercises: nextExercises };
      }),
    }));
  };

  // ── Muscle targets ───────────────────────────────────────────────

  const setMuscleTarget = (muscleId, nextValue) => {
    setMuscleTargetInputs((current) => ({
      ...current,
      [muscleId]: nextValue.replace(/[^\d.]/g, ''),
    }));
  };

  const removeMuscleTarget = (muscleId) => {
    setMuscleTargetInputs((current) => {
      const next = { ...current };
      delete next[muscleId];
      return next;
    });
  };

  // ── Submit payload ────────────────────────────────────────────────

  const buildSubmitPayload = (userId) => ({
    userId,
    weeklyRoutineName,
    cycleDays,
    objectiveId: selectedObjectiveId,
    startDate: format(new Date(), 'yyyy-MM-dd'),
    days: dayBlueprint,
    muscleTargets: wantsVolumeGoal
      ? Object.entries(muscleTargetInputs)
          .map(([muscleId, targetSets]) => ({
            muscle_id: Number.parseInt(muscleId, 10),
            target_sets: Number.parseFloat(String(targetSets || 0)),
          }))
          .filter(
            (item) =>
              Number.isFinite(item.muscle_id) &&
              Number.isFinite(item.target_sets) &&
              item.target_sets > 0
          )
      : [],
  });

  return {
    // Catalogs
    isLoadingCatalogs,
    objectiveOptions,
    muscleOptions,
    exerciseOptions,
    equipmentOptions,
    // Step 1
    weeklyRoutineName,
    setWeeklyRoutineName,
    selectedObjectiveId,
    setSelectedObjectiveId,
    // Step 2
    cycleDays,
    setCycleDays,
    MAX_CYCLE_DAYS,
    MIN_CYCLE_DAYS,
    // Step 3
    dayBlueprint,
    updateDayPrimaryType,
    // Step 4
    wantsVolumeGoal,
    setWantsVolumeGoal,
    // Step 5
    muscleTargetInputs,
    setMuscleTarget,
    removeMuscleTarget,
    // Step 6
    currentDayIdx,
    setCurrentDayIdx,
    // Day mutations
    updateDay,
    addBlock,
    removeBlock,
    updateBlock,
    addExerciseToBlock,
    removeExerciseFromBlock,
    updateBlockExercise,
    // Wizard navigation
    currentStepId,
    currentStepIndex,
    totalSteps,
    stepSequence,
    direction,
    goNext,
    goPrev,
    // Submit
    buildSubmitPayload,
    // Volume goal navigation (fixes React 18 batching issue)
    confirmVolumeGoal,
    // Draft persistence
    clearDraft,
  };
};
