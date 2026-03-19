import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, CalendarDays, CheckCircle2, Dumbbell, History, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import {
  getActiveMesocycleWithRoutines,
  getDateKey,
  getNextRoutineInCycle,
  getWorkoutSessionPayload,
  saveExerciseSet,
} from '@/lib/trainingZoneService';

const sanitizeNumericInput = (value) => String(value || '').replace(/[^\d]/g, '');
const formatKg = (value) => (value === null || value === undefined || value === '' ? '-' : `${value} kg`);
const formatReps = (value) => (value === null || value === undefined || value === '' ? '-' : `${value} reps`);
const toNullableInt = (value) => {
  const clean = sanitizeNumericInput(value);
  if (!clean) return null;
  const parsed = Number.parseInt(clean, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const TrainingSessionPage = () => {
  const { routineId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mesocycle, setMesocycle] = useState(null);
  const [routines, setRoutines] = useState([]);
  const [nextRoutineId, setNextRoutineId] = useState(null);
  const [selectedRoutine, setSelectedRoutine] = useState(null);
  const [workoutId, setWorkoutId] = useState(null);
  const [exerciseRows, setExerciseRows] = useState([]);
  const [activeExerciseId, setActiveExerciseId] = useState(null);
  const [draftBySetId, setDraftBySetId] = useState({});
  const [savingSetIds, setSavingSetIds] = useState({});

  const todayKey = useMemo(() => getDateKey(new Date()), []);

  const buildDraftFromPayload = useCallback((rows) => {
    const nextDraft = {};
    rows.forEach((exercise) => {
      const historyBySetNo = new Map((exercise.history?.sets || []).map((s) => [s.set_no, s]));
      exercise.sets.forEach((setRow) => {
        const previousSet = historyBySetNo.get(setRow.set_no);
        const prefilledWeight = setRow.weight ?? previousSet?.weight ?? setRow.target_weight ?? '';
        const prefilledReps = setRow.reps ?? '';
        nextDraft[setRow.id] = {
          weight: prefilledWeight === null || prefilledWeight === undefined ? '' : String(prefilledWeight),
          reps: prefilledReps === null || prefilledReps === undefined ? '' : String(prefilledReps),
        };
      });
    });
    return nextDraft;
  }, []);

  const loadTrainingSession = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');

    try {
      const { mesocycle: activeMesocycle, routines: cycleRoutines } = await getActiveMesocycleWithRoutines(user.id, todayKey);
      setMesocycle(activeMesocycle);
      setRoutines(cycleRoutines);

      if (!activeMesocycle || !cycleRoutines.length) {
        setSelectedRoutine(null);
        setWorkoutId(null);
        setExerciseRows([]);
        setActiveExerciseId(null);
        setDraftBySetId({});
        setNextRoutineId(null);
        return;
      }

      const computedNextRoutine = await getNextRoutineInCycle(user.id, cycleRoutines);
      setNextRoutineId(computedNextRoutine?.id ?? null);

      const requestedRoutineId = routineId ? Number.parseInt(routineId, 10) : null;
      const foundRequestedRoutine = requestedRoutineId
        ? cycleRoutines.find((routine) => routine.id === requestedRoutineId)
        : null;
      const resolvedRoutine = foundRequestedRoutine || computedNextRoutine || cycleRoutines[0];

      if (!resolvedRoutine) {
        setSelectedRoutine(null);
        setWorkoutId(null);
        setExerciseRows([]);
        setDraftBySetId({});
        return;
      }

      setSelectedRoutine(resolvedRoutine);

      if (!requestedRoutineId || requestedRoutineId !== resolvedRoutine.id) {
        navigate(`/plan/entreno/sesion/${resolvedRoutine.id}`, { replace: true });
      }

      const payload = await getWorkoutSessionPayload({
        userId: user.id,
        routineId: resolvedRoutine.id,
        dateKey: todayKey,
      });

      setWorkoutId(payload.workoutId);
      setExerciseRows(payload.exercises);
      setDraftBySetId(buildDraftFromPayload(payload.exercises));
      setActiveExerciseId((prev) => {
        if (!payload.exercises.length) return null;
        if (prev && payload.exercises.some((exercise) => exercise.id === prev)) return prev;
        return payload.exercises[0].id;
      });
    } catch (fetchError) {
      console.error('Error loading training session:', fetchError);
      setError(fetchError?.message || 'No se pudo cargar la sesión de entrenamiento.');
    } finally {
      setLoading(false);
    }
  }, [buildDraftFromPayload, navigate, routineId, todayKey, user?.id]);

  useEffect(() => {
    loadTrainingSession();
  }, [loadTrainingSession]);

  const handleRoutinePick = (targetRoutineId) => {
    if (!targetRoutineId) return;
    navigate(`/plan/entreno/sesion/${targetRoutineId}`);
  };

  const handleDraftChange = (setId, field, rawValue) => {
    const clean = sanitizeNumericInput(rawValue);
    setDraftBySetId((prev) => ({
      ...prev,
      [setId]: {
        ...(prev[setId] || {}),
        [field]: clean,
      },
    }));
  };

  const handleSaveSet = async (setId) => {
    const draft = draftBySetId[setId] || {};
    const nextWeight = toNullableInt(draft.weight);
    const nextReps = toNullableInt(draft.reps);

    setSavingSetIds((prev) => ({ ...prev, [setId]: true }));
    try {
      const saved = await saveExerciseSet(setId, { weight: nextWeight, reps: nextReps });
      setExerciseRows((prevRows) =>
        prevRows.map((exercise) => ({
          ...exercise,
          sets: exercise.sets.map((setRow) =>
            setRow.id === setId
              ? { ...setRow, weight: saved.weight, reps: saved.reps, rir: saved.rir }
              : setRow
          ),
        }))
      );
    } catch (saveError) {
      console.error('Error saving set:', saveError);
      toast({
        title: 'No se pudo guardar',
        description: 'Revisa tu conexión y vuelve a intentarlo.',
        variant: 'destructive',
      });
    } finally {
      setSavingSetIds((prev) => ({ ...prev, [setId]: false }));
    }
  };

  const handleCopyPrevious = (workoutExerciseId) => {
    const targetExercise = exerciseRows.find((row) => row.id === workoutExerciseId);
    if (!targetExercise?.history?.sets?.length) return;

    const previousBySetNo = new Map(targetExercise.history.sets.map((setRow) => [setRow.set_no, setRow]));
    setDraftBySetId((prev) => {
      const next = { ...prev };
      targetExercise.sets.forEach((setRow) => {
        const previousSet = previousBySetNo.get(setRow.set_no);
        if (!previousSet) return;
        next[setRow.id] = {
          ...(next[setRow.id] || {}),
          weight: previousSet.weight === null || previousSet.weight === undefined ? '' : String(previousSet.weight),
          reps: previousSet.reps === null || previousSet.reps === undefined ? '' : String(previousSet.reps),
        };
      });
      return next;
    });

    toast({
      title: 'Cargado el histórico',
      description: 'Se copiaron pesos y reps de tu última sesión para este ejercicio.',
      variant: 'success',
    });
  };

  const formattedToday = format(parseISO(todayKey), "EEEE d 'de' MMMM", { locale: es });
  const capitalizedToday = formattedToday.charAt(0).toUpperCase() + formattedToday.slice(1);

  if (loading) {
    return (
      <main className="w-full px-4 py-8">
        <div className="max-w-2xl mx-auto rounded-2xl border border-border bg-card/70 p-6 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#F44C40]" />
          <p className="mt-3 text-sm text-muted-foreground">Preparando tu sesión de hoy...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="w-full px-4 py-8">
        <div className="mx-auto max-w-2xl rounded-2xl border border-red-500/40 bg-red-500/10 p-6">
          <p className="text-sm text-red-300">{error}</p>
          <Button className="mt-4" variant="outline" onClick={loadTrainingSession}>
            Reintentar
          </Button>
        </div>
      </main>
    );
  }

  if (!mesocycle || !routines.length) {
    return (
      <main className="w-full px-4 py-8">
        <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card/70 p-6 text-center">
          <Dumbbell className="mx-auto h-8 w-8 text-[#F44C40]" />
          <h1 className="mt-3 text-xl font-bold text-white">Zona de entrenamiento</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Aún no tienes un mesociclo activo con días de entreno.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/plan/entreno/mesociclo/nuevo">Crear nuevo mesociclo</Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <>
      <Helmet>
        <title>Sesión de Entrenamiento - Bibofit</title>
        <meta
          name="description"
          content="Registra tu sesión de entrenamiento con histórico de pesos y repeticiones por ejercicio."
        />
      </Helmet>
      <main className="w-full px-3 py-4 md:px-4 md:py-8">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="mx-auto w-full max-w-3xl space-y-4"
        >
          <Button asChild variant="ghost" className="text-muted-foreground hover:text-foreground">
            <Link to="/plan">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al plan
            </Link>
          </Button>

          <section className="rounded-2xl border border-[#F44C40]/30 bg-card/80 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#F44C40]">Zona de entrenamiento</p>
                <h1 className="mt-1 text-2xl font-bold text-white">{selectedRoutine?.name || 'Sesión'}</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {mesocycle.name || 'Mesociclo activo'} · {capitalizedToday}
                </p>
              </div>
              <div className="rounded-lg bg-[#F44C40]/20 px-3 py-2 text-right">
                <p className="text-[11px] uppercase tracking-wide text-[#FCA5A5]">Hoy toca</p>
                <p className="text-sm font-semibold text-white">{selectedRoutine?.day_type || 'día de entreno'}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1">
              {routines.map((routine) => {
                const isSelected = selectedRoutine?.id === routine.id;
                const isNext = nextRoutineId === routine.id;
                return (
                  <button
                    key={routine.id}
                    type="button"
                    onClick={() => handleRoutinePick(routine.id)}
                    className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      isSelected
                        ? 'border-[#F44C40] bg-[#F44C40] text-white'
                        : isNext
                          ? 'border-emerald-400/60 bg-emerald-500/10 text-emerald-300'
                          : 'border-border bg-background text-muted-foreground'
                    }`}
                  >
                    {routine.day_index ? `Día ${routine.day_index}` : 'Día'} · {routine.name}
                  </button>
                );
              })}
            </div>
          </section>

          {exerciseRows.length === 0 ? (
            <section className="rounded-2xl border border-border bg-card/70 p-6 text-center">
              <CalendarDays className="mx-auto h-7 w-7 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                Esta rutina no tiene ejercicios aún. Cuando los añadas, aquí se abrirá el primero automáticamente.
              </p>
            </section>
          ) : (
            <section className="space-y-3">
              {exerciseRows.map((exercise, index) => {
                const isOpen = activeExerciseId === exercise.id;
                return (
                  <article key={exercise.id} className="overflow-hidden rounded-2xl border border-border bg-card/70">
                    <button
                      type="button"
                      onClick={() => setActiveExerciseId((prev) => (prev === exercise.id ? null : exercise.id))}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                    >
                      <div>
                        <p className="text-xs text-muted-foreground">Ejercicio {index + 1}</p>
                        <h2 className="text-lg font-semibold text-white">{exercise.exercises?.name || 'Ejercicio'}</h2>
                      </div>
                      {isOpen ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                      ) : (
                        <Dumbbell className="h-5 w-5 text-[#F44C40]" />
                      )}
                    </button>

                    {isOpen && (
                      <div className="space-y-3 border-t border-border px-4 py-3">
                        <div className="rounded-xl border border-border bg-background p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              <History className="h-3.5 w-3.5" />
                              Última sesión
                            </p>
                            {exercise.history?.performed_on ? (
                              <span className="text-xs text-muted-foreground">
                                {format(parseISO(exercise.history.performed_on), 'dd/MM/yyyy')}
                              </span>
                            ) : null}
                          </div>
                          {exercise.history?.sets?.length ? (
                            <div className="flex flex-wrap gap-2">
                              {exercise.history.sets.map((setRow) => (
                                <span
                                  key={`hist-${exercise.id}-${setRow.id}`}
                                  className="rounded-lg bg-muted px-2 py-1 text-xs text-foreground"
                                >
                                  S{setRow.set_no}: {formatKg(setRow.weight)} x {setRow.reps ?? '-'}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">Sin histórico previo para este ejercicio.</p>
                          )}
                          {exercise.history?.sets?.length ? (
                            <Button
                              type="button"
                              variant="outline"
                              className="mt-3 h-8 text-xs"
                              onClick={() => handleCopyPrevious(exercise.id)}
                            >
                              Copiar histórico a hoy
                            </Button>
                          ) : null}
                        </div>

                        <div className="space-y-2">
                          {exercise.sets.map((setRow) => {
                            const draft = draftBySetId[setRow.id] || { weight: '', reps: '' };
                            const historySet = (exercise.history?.sets || []).find((item) => item.set_no === setRow.set_no);
                            return (
                              <div
                                key={setRow.id}
                                className="grid grid-cols-[auto_1fr_1fr] items-end gap-2 rounded-xl border border-border bg-background px-3 py-2"
                              >
                                <div className="pr-1">
                                  <p className="text-sm font-semibold text-white">
                                    {setRow.is_warmup ? `A${setRow.set_no}` : `S${setRow.set_no}`}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">
                                    Obj: {setRow.target_reps_min ?? exercise.prescribed_reps_min ?? '-'}-
                                    {setRow.target_reps_max ?? exercise.prescribed_reps_max ?? '-'}
                                  </p>
                                </div>

                                <label className="space-y-1 text-xs text-muted-foreground">
                                  Kg
                                  <Input
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={draft.weight}
                                    onChange={(event) => handleDraftChange(setRow.id, 'weight', event.target.value)}
                                    onBlur={() => handleSaveSet(setRow.id)}
                                    className="h-10 text-center text-base font-semibold"
                                  />
                                </label>

                                <label className="space-y-1 text-xs text-muted-foreground">
                                  Reps
                                  <Input
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={draft.reps}
                                    onChange={(event) => handleDraftChange(setRow.id, 'reps', event.target.value)}
                                    onBlur={() => handleSaveSet(setRow.id)}
                                    className="h-10 text-center text-base font-semibold"
                                  />
                                </label>

                                <div className="col-span-3 flex items-center justify-between text-[11px] text-muted-foreground">
                                  <p>
                                    Anterior: {formatKg(historySet?.weight)} · {formatReps(historySet?.reps)}
                                  </p>
                                  {savingSetIds[setRow.id] ? (
                                    <span className="flex items-center gap-1 text-[#F44C40]">
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                      Guardando
                                    </span>
                                  ) : (
                                    <span className="text-emerald-400">Guardado</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </section>
          )}

          <section className="rounded-2xl border border-border bg-card/70 p-4">
            <p className="text-xs text-muted-foreground">Sesión</p>
            <p className="mt-1 text-sm text-white">
              {exerciseRows.length} ejercicios · ID entrenamiento {workoutId || '-'}
            </p>
          </section>
        </motion.div>
      </main>
    </>
  );
};

export default TrainingSessionPage;
