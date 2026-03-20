import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import {
  addDays,
  subDays,
  format,
  isSameDay,
  isToday,
  parseISO,
  isValid,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Dumbbell,
  Loader2,
  PenLine,
  Play,
  Target,
  Footprints,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ColorLegendCollapsible from '@/components/shared/ColorLegendCollapsible';
import { WIZARD_DRAFT_KEY } from '@/hooks/useCreateRoutineWizard';
import TrainingMacroVisualizer from '@/components/shared/TrainingMacroVisualizer/TrainingMacroVisualizer';
import TrainingWeeklyRoutineSection from '@/components/training/TrainingWeeklyRoutineSection';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import {
  getDateKey,
  getTrainingZoneCatalogs,
  getTrainingZoneSnapshot,
} from '@/lib/training/trainingPlanService';
import { createNextWorkoutSession, getWorkoutSessionPayload } from '@/lib/training/workoutSessionService';
import { getWorkoutTimelineEvents } from '@/lib/training/trainingAnalyticsService';
import { buildTrainingVisualizerMetrics } from '@/lib/training/trainingVisualizerMetrics';
import { cn } from '@/lib/utils';

const TRAINING_ACCENT = '#F44C40';
const DAY_TYPE_LABELS = {
  torso: 'Torso',
  pierna: 'Pierna',
  fullbody: 'Full body',
  push: 'Empuje',
  pull: 'Traccion',
  core: 'Core',
  cardio: 'Cardio',
  movilidad: 'Movilidad',
  custom: 'Personalizado',
};

const EMPTY_LIST = [];

const formatDate = (value) => {
  if (!value) return 'Sin fecha';
  const parsed = parseISO(value);
  if (!isValid(parsed)) return value;
  return format(parsed, "d 'de' MMM", { locale: es });
};

const focusTypeLabel = (value) => {
  switch (value) {
    case 'movement_pattern':
      return 'Patrón';
    case 'muscle':
      return 'Músculo';
    case 'joint':
      return 'Articulación';
    case 'exercise':
      return 'Ejercicio';
    default:
      return 'Foco';
  }
};

const toDateKey = (date) => format(date, 'yyyy-MM-dd');

const shortDayLabel = (date) => {
  const text = format(date, 'EEE', { locale: es });
  return text.charAt(0).toUpperCase() + text.slice(1, 3);
};

const DateTimeline = ({
  currentDate,
  onDateChange,
  timelineEvents,
  plannedDayByDate,
  stepsDateSet,
}) => {
  const weekDates = useMemo(() => {
    const start = subDays(currentDate, 3);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [currentDate]);

  const changeWeek = (direction) => {
    onDateChange(addDays(currentDate, direction === 'next' ? 7 : -7));
  };

  return (
    <div className="flex items-center justify-center gap-2 bg-card/85 p-2 rounded-xl border border-border shadow-sm">
      <Button variant="ghost" size="icon" onClick={() => changeWeek('prev')} className="text-muted-foreground hover:bg-muted">
        <ArrowLeft />
      </Button>

      <div className="flex-grow grid grid-cols-7 gap-1">
        {weekDates.map((date) => {
          const dateKey = toDateKey(date);
          const event = timelineEvents.get(dateKey);
          const planned = plannedDayByDate.get(dateKey);
          const isCurrent = isSameDay(date, currentDate);
          const isCurrentDay = isToday(date);
          const isDone = Boolean(event?.is_completed);
          const hasWorkout = Boolean(event?.workout_id);
          const hasPR = Boolean(event?.has_pr);
          const hasSteps = stepsDateSet?.has(dateKey);

          return (
            <button
              key={dateKey}
              onClick={() => onDateChange(date)}
              className={cn(
                'flex flex-col items-center p-2 rounded-lg transition-colors border',
                isCurrent
                  ? 'bg-primary/15 border-primary/40 shadow-sm'
                  : 'bg-transparent border-transparent hover:bg-muted/80'
              )}
            >
              <span className={cn('text-xs uppercase font-bold', isCurrent || isCurrentDay ? 'text-primary' : 'text-muted-foreground')}>
                {shortDayLabel(date)}
              </span>
              <span className={cn('text-lg font-bold', isCurrent || isCurrentDay ? 'text-primary' : 'text-foreground')}>
                {format(date, 'd')}
              </span>
              <div className="flex flex-wrap justify-center gap-1 mt-1 min-h-[12px] items-center">
                {planned ? <div className="w-2 h-2 rounded-full bg-slate-400/70" title="Día planificado" /> : null}
                {hasWorkout ? <div className="w-2 h-2 rounded-full bg-orange-400" title="Entreno iniciado" /> : null}
                {isDone ? <div className="w-2 h-2 rounded-full bg-emerald-500" title="Entreno completado" /> : null}
                {hasPR ? <div className="w-2 h-2 rounded-full bg-amber-400" title="Marca de fuerza" /> : null}
                {hasSteps ? <div className="w-2 h-2 rounded-full bg-cyan-400" title="Pasos registrados" /> : null}
              </div>
            </button>
          );
        })}
      </div>

      <Button variant="ghost" size="icon" onClick={() => changeWeek('next')} className="text-muted-foreground hover:bg-muted">
        <ArrowRight />
      </Button>
    </div>
  );
};

const WizardDraftBanner = ({ onResume, onDiscard }) => (
  <div className="flex items-center gap-3 rounded-xl border border-[#F44C40]/30 bg-[#F44C40]/8 px-4 py-3">
    <PenLine className="h-4 w-4 text-[#F44C40] shrink-0" />
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-white">Tienes una rutina sin terminar</p>
      <p className="text-xs text-muted-foreground">Retoma el asistente donde lo dejaste</p>
    </div>
    <button
      type="button"
      onClick={onDiscard}
      className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0 px-2 py-1"
    >
      Descartar
    </button>
    <Button
      size="sm"
      onClick={onResume}
      className="bg-[#F44C40] hover:bg-[#E23C32] text-white text-xs shrink-0"
    >
      Retomar
    </Button>
  </div>
);

const TrainingPlanPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { date: dateParam } = useParams();

  const [hasDraft, setHasDraft] = useState(() => {
    try { return !!localStorage.getItem(WIZARD_DRAFT_KEY); } catch { return false; }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isStartingWorkout, setIsStartingWorkout] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const [catalogs, setCatalogs] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const [currentDate, setCurrentDate] = useState(() => {
    if (dateParam) {
      const parsed = parseISO(dateParam);
      if (isValid(parsed)) return parsed;
    }
    return new Date();
  });

  useEffect(() => {
    if (!dateParam || !isValid(parseISO(dateParam))) {
      navigate(`/plan/entreno/${format(new Date(), 'yyyy-MM-dd')}`, { replace: true });
    }
  }, [dateParam, navigate]);

  const handleDateChange = useCallback((newDate) => {
    setCurrentDate(newDate);
    navigate(`/plan/entreno/${format(newDate, 'yyyy-MM-dd')}`, { replace: true });
  }, [navigate]);
  const [timelineEvents, setTimelineEvents] = useState(new Map());
  const [volumeProgressRows, setVolumeProgressRows] = useState([]);
  const [volumeProgressTotal, setVolumeProgressTotal] = useState({ actual: 0, target: 0 });
  const [prProgress, setPrProgress] = useState({ actual: 0, target: 1 });
  const [stepProgress, setStepProgress] = useState({ actual: 0, target: 70000 });
  const [currentDaySteps, setCurrentDaySteps] = useState(null);
  const [lastStepRecord, setLastStepRecord] = useState(null);
  const [stepsDateSet, setStepsDateSet] = useState(new Set());
  const stickysentinel = useRef(null);
  const [isVisualizerStuck, setIsVisualizerStuck] = useState(false);

  const loadPageData = useCallback(
    async ({ silent = false } = {}) => {
      if (!user?.id) {
        setSnapshot(null);
        setCatalogs(null);
        setIsLoading(false);
        return;
      }

      if (!silent) setIsLoading(true);
      if (silent) setIsRefreshing(true);

      try {
        const dateKey = getDateKey(new Date());
        const [snapshotData, catalogsData] = await Promise.all([
          getTrainingZoneSnapshot(user.id, dateKey),
          getTrainingZoneCatalogs(),
        ]);

        setSnapshot(snapshotData);
        setCatalogs(catalogsData);

        const cycleStart = parseISO(snapshotData?.activeMesocycle?.start_date || dateKey);
        const safeCycleStart = isValid(cycleStart) ? cycleStart : new Date();
        const rangeStart = subDays(currentDate, 14);
        const rangeEnd = addDays(currentDate, 14);

        const events = await getWorkoutTimelineEvents({
          userId: user.id,
          startDate: toDateKey(rangeStart),
          endDate: toDateKey(rangeEnd),
        });

        const eventMap = new Map();
        events.forEach((item) => {
          const key = item.event_date;
          const prev = eventMap.get(key);
          if (!prev || (item.completed_sets || 0) >= (prev.completed_sets || 0)) {
            eventMap.set(key, item);
          }
        });

        const nextDateWindow = Array.from({ length: 29 }, (_, i) => addDays(rangeStart, i));
        const plannedEventMap = new Map(eventMap);

        if (snapshotData?.activeMesocycle?.start_date && (snapshotData?.days || []).length) {
          nextDateWindow.forEach((date) => {
            const dayDiff = Math.floor((date - safeCycleStart) / (1000 * 60 * 60 * 24));
            if (dayDiff < 0) return;

            const cycleIndex = (dayDiff % (snapshotData.days.length || 1)) + 1;
            const dayItem = snapshotData.days.find((d) => d.day_index === cycleIndex);
            const dateKeyLoop = toDateKey(date);
            const prev = plannedEventMap.get(dateKeyLoop);
            if (!prev && dayItem) {
              plannedEventMap.set(dateKeyLoop, {
                event_date: dateKeyLoop,
                weekly_day_id: dayItem.id,
                weekly_day_index: dayItem.day_index,
                weekly_day_name: dayItem.name,
                is_completed: false,
                completed_sets: 0,
                total_sets: 0,
                has_pr: false,
                pr_count: 0,
              });
            }
          });
        }

        events.forEach((item) => {
          const key = item.event_date;
          const prev = plannedEventMap.get(key) || {};
          const fallbackHasPr = Boolean(
            item.completed_key_exercises
            && item.total_key_exercises
            && item.completed_key_exercises >= item.total_key_exercises
          );
          const hasPR = typeof item.has_pr === 'boolean' ? item.has_pr : fallbackHasPr;
          plannedEventMap.set(key, {
            ...prev,
            ...item,
            has_pr: hasPR,
            pr_count: Number(item.pr_count || 0),
          });
        });

        const metrics = await buildTrainingVisualizerMetrics({
          userId: user.id,
          currentDate,
          snapshotData,
          catalogsData,
          timelineRows: events,
        });

        setTimelineEvents(plannedEventMap);
        setVolumeProgressRows(metrics.volumeRows);
        setVolumeProgressTotal(metrics.volumeTotal);
        setPrProgress(metrics.prProgress);
        setStepProgress(metrics.stepProgress);
        setCurrentDaySteps(metrics.currentDaySteps);
        setLastStepRecord(metrics.lastStepRecord);
        setStepsDateSet(metrics.stepsDateSet);
      } catch (error) {
        console.error('Error loading training zone:', error);
        toast({
          title: 'No se pudo cargar la zona de entrenamiento',
          description: error?.message || 'Revisa tu conexión y vuelve a intentarlo.',
          variant: 'destructive',
        });
      } finally {
        if (!silent) setIsLoading(false);
        if (silent) setIsRefreshing(false);
      }
    },
    [currentDate, toast, user?.id]
  );

  useEffect(() => {
    loadPageData();
  }, [loadPageData]);

  useEffect(() => {
    const sentinel = stickysentinel.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisualizerStuck(!entry.isIntersecting),
      { threshold: 0, rootMargin: '0px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  const objectiveMap = useMemo(
    () => new Map((catalogs?.objectives || []).map((item) => [String(item.id), item.name])),
    [catalogs?.objectives]
  );
  const movementPatternMap = useMemo(
    () => new Map((catalogs?.movementPatterns || []).map((item) => [String(item.id), item.name])),
    [catalogs?.movementPatterns]
  );
  const muscleMap = useMemo(
    () => new Map((catalogs?.muscles || []).map((item) => [String(item.id), item.name])),
    [catalogs?.muscles]
  );
  const jointMap = useMemo(
    () => new Map((catalogs?.joints || []).map((item) => [String(item.id), item.name])),
    [catalogs?.joints]
  );
  const exerciseMap = useMemo(
    () => new Map((catalogs?.exercises || []).map((item) => [String(item.id), item.name])),
    [catalogs?.exercises]
  );
  const equipmentMap = useMemo(
    () => new Map((catalogs?.equipment || []).map((item) => [String(item.id), item.name])),
    [catalogs?.equipment]
  );

  const days = snapshot?.days ?? EMPTY_LIST;
  const blocks = snapshot?.blocks ?? EMPTY_LIST;
  const blockExercises = snapshot?.blockExercises ?? EMPTY_LIST;
  const microcycles = snapshot?.microcycles ?? EMPTY_LIST;
  const microcycleFocuses = snapshot?.microcycleFocuses ?? EMPTY_LIST;

  const blocksByDayId = useMemo(() => {
    const grouped = new Map();
    blocks.forEach((block) => {
      const list = grouped.get(block.weekly_day_id) || [];
      list.push(block);
      grouped.set(block.weekly_day_id, list);
    });
    return grouped;
  }, [blocks]);

  const blockExercisesByBlockId = useMemo(() => {
    const grouped = new Map();
    blockExercises.forEach((item) => {
      const list = grouped.get(item.weekly_day_block_id) || [];
      list.push(item);
      grouped.set(item.weekly_day_block_id, list);
    });
    return grouped;
  }, [blockExercises]);

  const blockById = useMemo(() => new Map(blocks.map((block) => [block.id, block])), [blocks]);
  const dayById = useMemo(() => new Map(days.map((day) => [day.id, day])), [days]);

  const focusesByMicrocycleId = useMemo(() => {
    const grouped = new Map();
    microcycleFocuses.forEach((focus) => {
      const list = grouped.get(focus.microcycle_id) || [];
      list.push(focus);
      grouped.set(focus.microcycle_id, list);
    });
    return grouped;
  }, [microcycleFocuses]);

  const activeMesocycle = snapshot?.activeMesocycle || null;
  const weeklyRoutine = snapshot?.weeklyRoutine || null;
  const nextSessionDayId = snapshot?.nextSessionDay?.weekly_day_id || null;
  const nextSessionDayKey = nextSessionDayId != null ? String(nextSessionDayId) : null;
  const nextSessionLabel = snapshot?.nextSessionDay?.weekly_day_name || null;
  const nextSessionDay = useMemo(
    () => (nextSessionDayKey ? days.find((day) => String(day.id) === nextSessionDayKey) || null : null),
    [days, nextSessionDayKey]
  );
  const nextSessionBlocks = useMemo(
    () => {
      if (!nextSessionDayKey) return EMPTY_LIST;
      return (
        blocksByDayId.get(nextSessionDayId)
        || blocksByDayId.get(nextSessionDayKey)
        || blocksByDayId.get(Number.parseInt(nextSessionDayKey, 10))
        || EMPTY_LIST
      );
    },
    [blocksByDayId, nextSessionDayId, nextSessionDayKey]
  );

  const plannedDayByDate = useMemo(() => {
    const map = new Map();
    timelineEvents.forEach((event, key) => {
      if (event?.weekly_day_id) map.set(key, event);
    });
    return map;
  }, [timelineEvents]);

  const weekDates = useMemo(() => {
    const start = subDays(currentDate, 3);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [currentDate]);

  const weekSummary = useMemo(() => {
    let completedSessions = 0;
    let loggedSessions = 0;
    let prCount = 0;

    weekDates.forEach((date) => {
      const key = toDateKey(date);
      const event = timelineEvents.get(key);
      if (!event) return;
      if (event.workout_id) loggedSessions += 1;
      if (event.is_completed) completedSessions += 1;
      if (event.has_pr) prCount += 1;
    });

    return { completedSessions, loggedSessions, prCount };
  }, [timelineEvents, weekDates]);

  const handleOpenTrainingDay = useCallback((weeklyDayId, blockExerciseId = null) => {
    if (!weeklyDayId) return;
    navigate(`/plan/entreno/rutina/editar/${String(weeklyDayId)}`, {
      state: blockExerciseId ? { openExerciseId: String(blockExerciseId) } : null,
    });
  }, [navigate]);

  const activeMicrocycleToday = useMemo(() => {
    const today = getDateKey(new Date());
    return microcycles.find((microcycle) => {
      const startsOk = !microcycle.start_date || microcycle.start_date <= today;
      const endsOk = !microcycle.end_date || microcycle.end_date >= today;
      return startsOk && endsOk;
    }) || microcycles[0] || null;
  }, [microcycles]);

  const todaySessionTypeLabel = useMemo(() => {
    if (!nextSessionBlocks.length) return nextSessionDay?.name || 'Sesión libre';
    const labels = [...new Set(nextSessionBlocks.map((block) => DAY_TYPE_LABELS[block.block_type] || 'Personalizado'))];
    return labels.join(' · ');
  }, [nextSessionBlocks, nextSessionDay?.name]);

  const todaySessionObjectiveLabel = useMemo(() => {
    if (!activeMicrocycleToday || !nextSessionBlocks.length) return 'Sin focos específicos para hoy';
    const dayBlockIdSet = new Set(nextSessionBlocks.map((block) => block.id));
    const focuses = (focusesByMicrocycleId.get(activeMicrocycleToday.id) || []).filter((focus) =>
      dayBlockIdSet.has(focus.weekly_day_block_id)
    );
    if (!focuses.length) {
      return objectiveMap.get(String(activeMicrocycleToday.objective_id)) || 'Objetivo general de microciclo';
    }
    const focusLabels = focuses.slice(0, 3).map((focus) => {
      if (focus.focus_type === 'movement_pattern') {
        return movementPatternMap.get(String(focus.movement_pattern_id)) || 'Patron';
      }
      if (focus.focus_type === 'muscle') {
        return muscleMap.get(String(focus.muscle_id)) || 'Musculo';
      }
      if (focus.focus_type === 'joint') {
        return jointMap.get(String(focus.joint_id)) || 'Articulacion';
      }
      if (focus.focus_type === 'exercise') {
        return exerciseMap.get(String(focus.focus_exercise_id)) || 'Ejercicio';
      }
      return 'Foco';
    });
    return `Objetivos: ${focusLabels.join(' · ')}`;
  }, [activeMicrocycleToday, nextSessionBlocks, focusesByMicrocycleId, objectiveMap, movementPatternMap, muscleMap, jointMap, exerciseMap]);

  const handleStartWorkout = useCallback(async () => {
    if (!user?.id) return;
    setIsStartingWorkout(true);

    try {
      if (nextSessionDayId) {
        navigate(`/plan/entreno/dia/${nextSessionDayId}`);
        return;
      }

      const workoutId = await createNextWorkoutSession({ userId: user.id, onDate: getDateKey(new Date()) });
      if (!workoutId) throw new Error('No se pudo crear la sesión de hoy.');

      const payload = await getWorkoutSessionPayload({ workoutId, userId: user.id });
      const weeklyDayId = payload?.workout?.training_weekly_day_id;
      if (!weeklyDayId) throw new Error('No se encontró el día de entreno asociado.');

      navigate(`/plan/entreno/dia/${weeklyDayId}`);
    } catch (error) {
      console.error('Error starting workout:', error);
      toast({
        title: 'No se pudo iniciar el entreno',
        description: error?.message || 'Inténtalo de nuevo en unos segundos.',
        variant: 'destructive',
      });
    } finally {
      setIsStartingWorkout(false);
    }
  }, [navigate, nextSessionDayId, toast, user?.id]);


  const renderFocusTarget = useCallback((focus) => {
    if (focus.focus_type === 'movement_pattern') return movementPatternMap.get(String(focus.movement_pattern_id)) || '-';
    if (focus.focus_type === 'muscle') return muscleMap.get(String(focus.muscle_id)) || '-';
    if (focus.focus_type === 'joint') return jointMap.get(String(focus.joint_id)) || '-';
    if (focus.focus_type === 'exercise') return exerciseMap.get(String(focus.focus_exercise_id)) || '-';
    return '-';
  }, [exerciseMap, jointMap, movementPatternMap, muscleMap]);

  if (isLoading) {
    return (
      <main className="w-full px-4 py-10">
        <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card/70 p-6 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#F44C40]" />
          <p className="mt-3 text-sm text-muted-foreground">Cargando tu zona de entrenamiento...</p>
        </div>
      </main>
    );
  }

  return (
    <>
      <Helmet>
        <title>Plan de Entrenamiento - Bibofit</title>
        <meta
          name="description"
          content="Resumen del plan, vista semanal con hitos y días de entrenamiento con ejercicios."
        />
      </Helmet>

      <main className="w-full pt-0 sm:pt-8 pb-8">
        <div className="space-y-2 sm:space-y-6 sm:p-1 relative">
          <ColorLegendCollapsible
            items={[
              { label: 'Planificado', dotClassName: 'bg-slate-400/80' },
              { label: 'Iniciado', dotClassName: 'bg-orange-400' },
              { label: 'Completado', dotClassName: 'bg-emerald-500' },
              { label: 'Marca', dotClassName: 'bg-amber-400' },
              { label: 'Pasos', dotClassName: 'bg-cyan-400' },
            ]}
          />

          <DateTimeline
            currentDate={currentDate}
            onDateChange={handleDateChange}
            timelineEvents={timelineEvents}
            plannedDayByDate={plannedDayByDate}
            stepsDateSet={stepsDateSet}
          />

          {hasDraft && (
            <WizardDraftBanner
              onResume={() => navigate('/plan/entreno/rutina/nueva')}
              onDiscard={() => {
                try { localStorage.removeItem(WIZARD_DRAFT_KEY); } catch {}
                setHasDraft(false);
              }}
            />
          )}

          {!activeMesocycle || !weeklyRoutine ? (
            <Card className="bg-card/85 border-border text-foreground shadow-xl">
              <CardContent className="py-10 text-center">
                <Dumbbell className="mx-auto h-8 w-8" style={{ color: TRAINING_ACCENT }} />
                <p className="mt-3 text-base font-semibold text-foreground">No tienes mesociclo activo</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Crea una rutina semanal para empezar a entrenar ya.
                </p>
                <div className="mt-4">
                  <Button onClick={() => navigate('/plan/entreno/rutina/nueva')} className="bg-[#F44C40] text-white hover:bg-[#E23C32]">
                    Crear rutina semanal
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Botón primario: iniciar entreno */}
              <Card
                onClick={handleStartWorkout}
                className={cn(
                  "text-foreground shadow-xl cursor-pointer transition-colors duration-200",
                  isStartingWorkout
                    ? "bg-orange-100/70 dark:bg-orange-900/30 border-orange-400/60 dark:border-orange-500/50"
                    : "bg-orange-100/60 dark:bg-orange-900/25 border-orange-400/55 dark:border-orange-500/45 hover:bg-gradient-to-br hover:from-orange-100/70 hover:to-red-50/70 dark:hover:from-orange-900/30 dark:hover:to-red-900/30"
                )}
              >
                <CardContent className="py-5 px-4 flex flex-col items-center text-center">
                  <h4 className="font-semibold text-sm flex items-center justify-center gap-2 text-orange-700 dark:text-orange-300">
                    <Dumbbell className="w-4 h-4 flex-shrink-0" />
                    Iniciar entreno de hoy
                  </h4>
                  <p className="text-2xl font-bold mt-2 text-foreground leading-tight">
                    {nextSessionLabel || 'Sesión del día'}
                  </p>
                  {todaySessionTypeLabel && (
                    <span className="text-xs text-orange-700/80 dark:text-orange-200/80 mt-1.5">
                      {todaySessionTypeLabel}
                    </span>
                  )}
                  {todaySessionObjectiveLabel && (
                    <span className="text-xs text-orange-700/75 dark:text-orange-200/75">
                      {todaySessionObjectiveLabel}
                    </span>
                  )}
                </CardContent>
              </Card>

              {/* Botón secundario: pasos del día */}
              <Card
                onClick={() => navigate(`/registro-pasos?date=${format(currentDate, 'yyyy-MM-dd')}`)}
                className={cn(
                  "shadow-xl cursor-pointer transition-colors duration-200",
                  currentDaySteps !== null
                    ? "bg-cyan-100/70 dark:bg-cyan-900/30 border-cyan-400/60 dark:border-cyan-500/50 hover:bg-gradient-to-br hover:from-cyan-100/70 hover:to-cyan-50/80 dark:hover:from-cyan-900/30 dark:hover:to-cyan-700/35"
                    : "bg-muted/65 border-border/80 hover:bg-gradient-to-br hover:from-cyan-100/40 hover:to-cyan-50/60 dark:hover:from-cyan-900/25 dark:hover:to-cyan-700/30"
                )}
              >
                <CardContent className="py-2.5 px-4 flex items-center justify-between gap-3">
                  <h4 className={cn(
                    "font-semibold text-sm flex items-center gap-2",
                    currentDaySteps !== null ? "text-cyan-700 dark:text-cyan-300" : "text-cyan-700/85 dark:text-cyan-300"
                  )}>
                    <Footprints className="w-4 h-4 flex-shrink-0" />
                    {currentDaySteps !== null ? 'Pasos del día' : 'Sin registro de pasos'}
                  </h4>
                  <div className="text-right shrink-0">
                    {currentDaySteps !== null ? (
                      <span className="text-base font-bold text-foreground tabular-nums">
                        {currentDaySteps.toLocaleString()}
                      </span>
                    ) : lastStepRecord ? (
                      <span className="text-xs text-muted-foreground">
                        Último: {Number(lastStepRecord.steps).toLocaleString()} · {format(parseISO(lastStepRecord.step_date), "d MMM", { locale: es })}
                      </span>
                    ) : null}
                  </div>
                </CardContent>
              </Card>


              <div className="lg:hidden contents">
                <div ref={stickysentinel} className="h-0 w-full" aria-hidden="true" />
                <div
                  data-training-sticky-visualizer="true"
                  className="lg:hidden sticky !top-0 z-30 bg-card/95 backdrop-blur-sm px-1 py-2 rounded-b-xl shadow-[0_8px_15px_-5px_rgba(0,0,0,0.3)]"
                >
                  <TrainingMacroVisualizer
                    volumeValue={volumeProgressTotal.actual}
                    volumeTarget={volumeProgressTotal.target}
                    prValue={prProgress.actual}
                    prTarget={prProgress.target}
                    stepValue={stepProgress.actual}
                    stepTarget={stepProgress.target}
                    muscleProgressRows={volumeProgressRows}
                    isSticky={isVisualizerStuck}
                  />
                </div>
              </div>

              <TrainingWeeklyRoutineSection
                mode={viewMode}
                onModeChange={setViewMode}
                days={days}
                blocksByDayId={blocksByDayId}
                blockExercisesByBlockId={blockExercisesByBlockId}
                nextSessionDayId={nextSessionDayId}
                exerciseMap={exerciseMap}
                equipmentMap={equipmentMap}
                timelineEvents={timelineEvents}
                onOpenDay={handleOpenTrainingDay}
                prProgress={prProgress}
                volumeProgressTotal={volumeProgressTotal}
              />

              <Card className="bg-card/85 border-border text-foreground shadow-xl">
                <CardHeader>
                  <CardTitle className="text-lg">Microciclos y focos activos</CardTitle>
                  <CardDescription>Seguimiento del bloque de progreso dentro del mesociclo.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {microcycles.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hay microciclos configurados.</p>
                  ) : (
                    microcycles.map((microcycle) => {
                      const focuses = focusesByMicrocycleId.get(microcycle.id) || [];
                      return (
                        <div key={microcycle.id} className="rounded-xl border border-border bg-background p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-foreground">
                              #{microcycle.sequence_index}: {microcycle.name || 'Microciclo'}
                            </p>
                            {microcycle.deload_week ? (
                              <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-300 hover:bg-amber-500/20">
                                Deload
                              </Badge>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatDate(microcycle.start_date)} - {formatDate(microcycle.end_date)} · Objetivo:{' '}
                            {objectiveMap.get(String(microcycle.objective_id)) || 'Sin objetivo'}
                          </p>

                          <div className="mt-2 space-y-1.5">
                            {focuses.length === 0 ? (
                              <p className="text-xs text-muted-foreground">Sin focos definidos en este microciclo.</p>
                            ) : (
                              focuses.map((focus) => {
                                const block = blockById.get(focus.weekly_day_block_id);
                                const day = block ? dayById.get(block.weekly_day_id) : null;
                                const targetLabel = renderFocusTarget(focus);
                                return (
                                  <div key={focus.id} className="rounded-md border border-border/70 px-2 py-1.5 text-xs">
                                    <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                                      <Target className="h-3.5 w-3.5" />
                                      <span>
                                        Día {day?.day_index || '?'} · Bloque {block?.block_order || '?'} ({block?.block_type || 'custom'})
                                      </span>
                                    </div>
                                    <p className="mt-1 text-foreground">
                                      {focusTypeLabel(focus.focus_type)}: {targetLabel}
                                    </p>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </main>

    </>
  );
};

export default TrainingPlanPage;
