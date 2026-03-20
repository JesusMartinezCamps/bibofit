import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { addDays, format } from 'date-fns';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { createWeeklyRoutineQuickstartV2, getTrainingZoneCatalogs } from '@/lib/training/trainingPlanService';

const MIN_CYCLE_DAYS = 4;
const MAX_CYCLE_DAYS = 14;

const DAY_TYPE_OPTIONS = [
  { value: 'torso', label: 'Torso' },
  { value: 'pierna', label: 'Pierna' },
  { value: 'fullbody', label: 'Full body' },
  { value: 'push', label: 'Empuje (push)' },
  { value: 'pull', label: 'Traccion (pull)' },
  { value: 'core', label: 'Core' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'movilidad', label: 'Movilidad' },
  { value: 'custom', label: 'Personalizado' },
];

const DEFAULT_DAY_ROTATION = ['torso', 'pierna', 'fullbody', 'torso', 'pierna', 'fullbody', 'cardio'];

const getDefaultDayType = (index) => DEFAULT_DAY_ROTATION[index % DEFAULT_DAY_ROTATION.length] || 'custom';

const getDayTypeLabel = (type) => DAY_TYPE_OPTIONS.find((option) => option.value === type)?.label || 'Personalizado';

const getDefaultDayName = (index, type) => `Dia ${index + 1} - ${getDayTypeLabel(type)}`;

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

const CreateMesocyclePage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [isLoadingCatalogs, setIsLoadingCatalogs] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [objectiveOptions, setObjectiveOptions] = useState([]);
  const [muscleOptions, setMuscleOptions] = useState([]);
  const [exerciseOptions, setExerciseOptions] = useState([]);
  const [equipmentOptions, setEquipmentOptions] = useState([]);

  const [weeklyRoutineName, setWeeklyRoutineName] = useState('Rutina semanal');
  const [selectedObjectiveId, setSelectedObjectiveId] = useState('');
  const [cycleDays, setCycleDays] = useState(7);
  const [dayBlueprint, setDayBlueprint] = useState(() => normalizeDayBlueprintLength([], 7));
  const [isDistributionConfirmed, setIsDistributionConfirmed] = useState(false);
  const [muscleTargetInputs, setMuscleTargetInputs] = useState({});

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
        if (defaultObjectiveId) {
          setSelectedObjectiveId(String(defaultObjectiveId));
        }
      } catch (error) {
        console.error('Error loading training catalogs:', error);
        toast({
          title: 'No se pudieron cargar los catalogos',
          description: 'Revisa las migraciones y vuelve a intentarlo.',
          variant: 'destructive',
        });
      } finally {
        if (isMounted) setIsLoadingCatalogs(false);
      }
    };

    loadCatalogs();

    return () => {
      isMounted = false;
    };
  }, [toast]);

  useEffect(() => {
    setDayBlueprint((current) => normalizeDayBlueprintLength(current, cycleDays));
    setIsDistributionConfirmed(false);
  }, [cycleDays]);

  const selectedObjective = useMemo(
    () => objectiveOptions.find((objective) => String(objective.id) === String(selectedObjectiveId)) || null,
    [objectiveOptions, selectedObjectiveId]
  );

  const setMuscleTarget = (muscleId, nextValue) => {
    setMuscleTargetInputs((current) => ({
      ...current,
      [muscleId]: nextValue.replace(/[^\d.]/g, ''),
    }));
  };

  const updateDay = (index, updater) => {
    setDayBlueprint((current) => current.map((day, dayIdx) => (dayIdx === index ? updater(day) : day)));
  };

  const updateDayPrimaryType = (dayIdx, type) => {
    updateDay(dayIdx, (day) => {
      const currentType = day.blocks?.[0]?.type || 'custom';
      const expectedCurrentName = getDefaultDayName(dayIdx, currentType);
      const expectedCurrentShortName = `Dia ${dayIdx + 1}`;
      const shouldReplaceName = !day.name || day.name === expectedCurrentName || day.name === expectedCurrentShortName;

      const nextBlocks = day.blocks.length
        ? day.blocks.map((block, idx) => (idx === 0 ? { ...block, type } : block))
        : [makeDefaultBlock(type)];

      return {
        ...day,
        name: shouldReplaceName ? getDefaultDayName(dayIdx, type) : day.name,
        blocks: nextBlocks,
      };
    });

    setIsDistributionConfirmed(false);
  };

  const addBlock = (dayIdx) => {
    updateDay(dayIdx, (day) => ({
      ...day,
      blocks: [...day.blocks, makeDefaultBlock(day.blocks?.[day.blocks.length - 1]?.type || 'custom')],
    }));
  };

  const removeBlock = (dayIdx, blockIdx) => {
    updateDay(dayIdx, (day) => {
      if (day.blocks.length <= 1) return day;
      return {
        ...day,
        blocks: day.blocks.filter((_, idx) => idx !== blockIdx),
      };
    });
  };

  const updateBlock = (dayIdx, blockIdx, patch) => {
    updateDay(dayIdx, (day) => ({
      ...day,
      blocks: day.blocks.map((block, idx) => (idx === blockIdx ? { ...block, ...patch } : block)),
    }));
  };

  const addExerciseToBlock = (dayIdx, blockIdx) => {
    updateDay(dayIdx, (day) => ({
      ...day,
      blocks: day.blocks.map((block, idx) =>
        idx === blockIdx
          ? {
              ...block,
              exercises: [...block.exercises, makeDefaultExercise(false)],
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
        const hasKeyExercise = nextExercises.some((exercise) => exercise.is_key_exercise);

        return {
          ...block,
          exercises: hasKeyExercise
            ? nextExercises
            : nextExercises.map((exercise, idxEx) => ({ ...exercise, is_key_exercise: idxEx === 0 })),
        };
      }),
    }));
  };

  const updateBlockExercise = (dayIdx, blockIdx, exerciseIdx, patch) => {
    updateDay(dayIdx, (day) => ({
      ...day,
      blocks: day.blocks.map((block, idx) => {
        if (idx !== blockIdx) return block;

        let nextExercises = block.exercises.map((exercise, exIdx) => {
          if (exIdx !== exerciseIdx) return exercise;
          return { ...exercise, ...patch };
        });

        if (patch.is_key_exercise === true) {
          nextExercises = nextExercises.map((exercise, exIdx) => ({
            ...exercise,
            is_key_exercise: exIdx === exerciseIdx,
          }));
        }

        if (!nextExercises.some((exercise) => exercise.is_key_exercise) && nextExercises.length) {
          nextExercises = nextExercises.map((exercise, exIdx) => ({
            ...exercise,
            is_key_exercise: exIdx === 0,
          }));
        }

        return {
          ...block,
          exercises: nextExercises,
        };
      }),
    }));
  };

  const confirmDistribution = () => {
    setIsDistributionConfirmed(true);
    toast({
      title: 'Distribucion confirmada',
      description: 'Ya puedes abrir cada dia y cargar ejercicios.',
      variant: 'success',
    });
  };

  const validateForm = () => {
    if (!user?.id) return 'Usuario no autenticado.';
    if (!selectedObjectiveId) return 'No hay objetivo disponible para la rutina.';
    if (!isDistributionConfirmed) return 'Confirma antes la distribucion de dias.';
    const hasAtLeastOneMuscleTarget = Object.values(muscleTargetInputs).some(
      (value) => Number.parseFloat(String(value || 0)) > 0
    );
    if (!hasAtLeastOneMuscleTarget) return 'Configura al menos un objetivo semanal de series por grupo muscular.';

    if (dayBlueprint.length < MIN_CYCLE_DAYS || dayBlueprint.length > MAX_CYCLE_DAYS) {
      return `La rutina debe tener entre ${MIN_CYCLE_DAYS} y ${MAX_CYCLE_DAYS} dias.`;
    }

    for (let dayIdx = 0; dayIdx < dayBlueprint.length; dayIdx += 1) {
      const day = dayBlueprint[dayIdx];
      if (!day.blocks.length) return `El dia ${dayIdx + 1} no tiene bloques.`;

      for (let blockIdx = 0; blockIdx < day.blocks.length; blockIdx += 1) {
        const block = day.blocks[blockIdx];
        const validExercises = block.exercises.filter((exercise) => exercise.exercise_id);
        if (!validExercises.length) {
          return `El dia ${dayIdx + 1}, bloque ${blockIdx + 1} no tiene ejercicios configurados.`;
        }
      }
    }

    return null;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      toast({
        title: 'Faltan datos para guardar',
        description: validationError,
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const startDate = format(new Date(), 'yyyy-MM-dd');

      await createWeeklyRoutineQuickstartV2({
        userId: user.id,
        weeklyRoutineName,
        cycleDays,
        objectiveId: selectedObjectiveId,
        startDate,
        days: dayBlueprint,
        muscleTargets: Object.entries(muscleTargetInputs)
          .map(([muscleId, targetSets]) => ({
            muscle_id: Number.parseInt(muscleId, 10),
            target_sets: Number.parseFloat(String(targetSets || 0)),
          }))
          .filter((item) => Number.isFinite(item.muscle_id) && Number.isFinite(item.target_sets) && item.target_sets > 0),
      });

      toast({
        title: 'Rutina semanal creada',
        description: 'Se creo tu rutina con microciclo activo automatico.',
        variant: 'success',
      });

      navigate('/plan/entreno', { replace: true });
    } catch (error) {
      console.error('Error creating weekly routine quickstart:', error);
      toast({
        title: 'No se pudo crear la rutina semanal',
        description: error?.message || 'Revisa la configuracion e intentalo de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const cycleStartDate = format(new Date(), 'yyyy-MM-dd');
  const cycleEndDate = format(addDays(new Date(), cycleDays - 1), 'yyyy-MM-dd');

  return (
    <>
      <Helmet>
        <title>Crear Rutina Semanal - Bibofit</title>
        <meta
          name="description"
          content="Crea una rutina semanal practica: elige dias, define bloques y ejercicios, y empieza a entrenar ya."
        />
      </Helmet>

      <main className="w-full px-3 py-4 md:px-4 md:py-8">
        <div className="mx-auto w-full max-w-5xl space-y-4">
          <Button asChild variant="ghost" className="text-muted-foreground hover:text-foreground">
            <Link to="/plan/entreno">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a zona de entrenamiento
            </Link>
          </Button>

          <Card className="border-[#F44C40]/40 bg-card/80">
            <CardHeader>
              <CardTitle className="text-white">Nueva rutina semanal</CardTitle>
              <CardDescription>
                Flujo rapido: eliges dias, cargas ejercicios y entrenas esta semana. El microciclo se crea automaticamente.
              </CardDescription>
            </CardHeader>
          </Card>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">1) Configuracion rapida</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Nombre de la rutina</Label>
                    <Input
                      value={weeklyRoutineName}
                      onChange={(event) => setWeeklyRoutineName(event.target.value)}
                      placeholder="Ej: Semana base"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Objetivo principal</Label>
                    {isLoadingCatalogs ? (
                      <div className="flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Cargando objetivos...
                      </div>
                    ) : (
                      <Select value={String(selectedObjectiveId || '')} onValueChange={setSelectedObjectiveId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona objetivo" />
                        </SelectTrigger>
                        <SelectContent>
                          {objectiveOptions.map((objective) => (
                            <SelectItem key={objective.id} value={String(objective.id)}>
                              {objective.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {selectedObjective?.description ? (
                      <p className="text-xs text-muted-foreground">{selectedObjective.description}</p>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Numero de dias del calendario ({MIN_CYCLE_DAYS}-{MAX_CYCLE_DAYS})</Label>
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: MAX_CYCLE_DAYS - MIN_CYCLE_DAYS + 1 }).map((_, idx) => {
                      const count = idx + MIN_CYCLE_DAYS;
                      return (
                        <button
                          key={count}
                          type="button"
                          onClick={() => setCycleDays(count)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                            cycleDays === count
                              ? 'border-[#F44C40] bg-[#F44C40] text-white'
                              : 'border-border bg-background text-muted-foreground'
                          }`}
                        >
                          {count} dias
                        </button>
                      );
                    })}
                  </div>
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Ciclo activo: {cycleStartDate} a {cycleEndDate}
                  </p>
                </div>

                <details className="rounded-xl border border-border bg-background p-3">
                  <summary className="cursor-pointer list-none text-sm font-semibold text-white">
                    Objetivo semanal de volumen por grupo muscular
                  </summary>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Dato persistente de la rutina. Define series objetivo por músculo para el visualizador semanal.
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {muscleOptions.map((muscle) => (
                      <div key={muscle.id} className="rounded-md border border-border/70 p-2">
                        <Label className="mb-1.5 block text-xs">{muscle.name}</Label>
                        <Input
                          inputMode="decimal"
                          placeholder="0"
                          value={muscleTargetInputs[muscle.id] || ''}
                          onChange={(event) => setMuscleTarget(muscle.id, event.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                </details>

                <div className="rounded-xl border border-border bg-background p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Calendario del ciclo</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                    {dayBlueprint.map((day, dayIdx) => (
                      <div key={`calendar-day-${dayIdx}`} className="rounded-md border border-border/70 p-2">
                        <p className="text-xs font-semibold text-foreground">Dia {dayIdx + 1}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{getDayTypeLabel(day.blocks?.[0]?.type || 'custom')}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">2) Distribucion y paneles por dia</CardTitle>
                <CardDescription>
                  Primero define Dia 1, Dia 2, etc. y acepta. Luego cargas ejercicios en paneles colapsables.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-xl border border-border bg-background p-3">
                  <p className="text-sm font-semibold text-white">2.1 Elige el enfoque de cada dia</p>

                  <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                    {dayBlueprint.map((day, dayIdx) => (
                      <div key={`day-distribution-${dayIdx}`} className="rounded-lg border border-border/80 p-2">
                        <Label className="mb-1 block text-xs">Dia {dayIdx + 1}</Label>
                        <Select
                          value={day.blocks?.[0]?.type || 'custom'}
                          onValueChange={(value) => updateDayPrimaryType(dayIdx, value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona el enfoque del dia" />
                          </SelectTrigger>
                          <SelectContent>
                            {DAY_TYPE_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button type="button" onClick={confirmDistribution} className="bg-[#F44C40] text-white hover:bg-[#E23C32]">
                      Aceptar distribucion
                    </Button>
                    {isDistributionConfirmed ? (
                      <p className="text-xs font-medium text-emerald-400">Distribucion confirmada</p>
                    ) : (
                      <p className="text-xs text-amber-300">Confirma para desbloquear los paneles de dias</p>
                    )}
                  </div>
                </div>

                {isDistributionConfirmed ? (
                  <div className="rounded-xl border border-border bg-background p-3">
                    <p className="text-sm font-semibold text-white">2.2 Carga ejercicios por dia</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      El primer ejercicio del bloque queda marcado por defecto como Ejercicio Clave.
                    </p>

                    <div className="mt-3 space-y-2">
                      {dayBlueprint.map((day, dayIdx) => (
                        <details key={`day-${dayIdx}`} className="rounded-xl border border-border bg-card/40 p-3">
                          <summary className="cursor-pointer list-none text-sm font-semibold text-white">
                            Dia {dayIdx + 1}: {day.name || getDefaultDayName(dayIdx, day.blocks?.[0]?.type || 'custom')}
                          </summary>

                          <div className="mt-3 space-y-1.5">
                            <Label>Nombre del dia</Label>
                            <Input
                              value={day.name}
                              onChange={(event) => updateDay(dayIdx, (current) => ({ ...current, name: event.target.value }))}
                              placeholder={`Ej: ${dayIdx + 1} - Torso`}
                            />
                          </div>

                          <div className="mt-3 space-y-2">
                            {day.blocks.map((block, blockIdx) => (
                              <div key={`day-${dayIdx}-block-${blockIdx}`} className="rounded-lg border border-border p-2">
                                <div className="grid grid-cols-12 gap-2">
                                  <div className="col-span-12 sm:col-span-3">
                                    <Label className="mb-1 block text-xs">Tipo bloque</Label>
                                    {blockIdx === 0 ? (
                                      <div className="h-10 rounded-md border border-border bg-muted/30 px-3 text-sm flex items-center">
                                        {getDayTypeLabel(block.type)}
                                      </div>
                                    ) : (
                                      <Select
                                        value={block.type}
                                        onValueChange={(value) => updateBlock(dayIdx, blockIdx, { type: value })}
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Tipo" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {DAY_TYPE_OPTIONS.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                              {option.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    )}
                                  </div>

                                  <div className="col-span-12 sm:col-span-8">
                                    <Label className="mb-1 block text-xs">Nombre bloque (opcional)</Label>
                                    <Input
                                      value={block.name}
                                      onChange={(event) => updateBlock(dayIdx, blockIdx, { name: event.target.value })}
                                      placeholder="Ej: Traccion principal"
                                    />
                                  </div>

                                  <div className="col-span-12 sm:col-span-1 flex items-end justify-end">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removeBlock(dayIdx, blockIdx)}
                                      disabled={day.blocks.length <= 1}
                                      className="text-muted-foreground hover:text-red-400"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>

                                <div className="mt-2 space-y-2">
                                  {block.exercises.map((exercise, exerciseIdx) => (
                                    <div
                                      key={`day-${dayIdx}-block-${blockIdx}-exercise-${exerciseIdx}`}
                                      className="rounded-md border border-border/80 p-2"
                                    >
                                      <div className="grid grid-cols-12 gap-2">
                                        <div className="col-span-12 sm:col-span-4">
                                          <Label className="mb-1 block text-xs">Ejercicio</Label>
                                          <Select
                                            value={String(exercise.exercise_id || '')}
                                            onValueChange={(value) =>
                                              updateBlockExercise(dayIdx, blockIdx, exerciseIdx, { exercise_id: value })
                                            }
                                          >
                                            <SelectTrigger>
                                              <SelectValue placeholder="Selecciona ejercicio" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {exerciseOptions.map((item) => (
                                                <SelectItem key={item.id} value={String(item.id)}>
                                                  {item.name}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>

                                        <div className="col-span-12 sm:col-span-3">
                                          <Label className="mb-1 block text-xs">Equipamiento preferido</Label>
                                          <Select
                                            value={String(exercise.preferred_equipment_id || 'none')}
                                            onValueChange={(value) =>
                                              updateBlockExercise(dayIdx, blockIdx, exerciseIdx, {
                                                preferred_equipment_id: value === 'none' ? '' : value,
                                              })
                                            }
                                          >
                                            <SelectTrigger>
                                              <SelectValue placeholder="(Opcional)" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="none">Sin preferencia</SelectItem>
                                              {equipmentOptions.map((item) => (
                                                <SelectItem key={item.id} value={String(item.id)}>
                                                  {item.name}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>

                                        <div className="col-span-4 sm:col-span-1">
                                          <Label className="mb-1 block text-xs">Series</Label>
                                          <Input
                                            inputMode="numeric"
                                            value={exercise.target_sets}
                                            onChange={(event) =>
                                              updateBlockExercise(dayIdx, blockIdx, exerciseIdx, {
                                                target_sets: event.target.value.replace(/[^\d]/g, ''),
                                              })
                                            }
                                          />
                                        </div>

                                        <div className="col-span-4 sm:col-span-1">
                                          <Label className="mb-1 block text-xs">Rep min</Label>
                                          <Input
                                            inputMode="numeric"
                                            value={exercise.target_reps_min}
                                            onChange={(event) =>
                                              updateBlockExercise(dayIdx, blockIdx, exerciseIdx, {
                                                target_reps_min: event.target.value.replace(/[^\d]/g, ''),
                                              })
                                            }
                                          />
                                        </div>

                                        <div className="col-span-4 sm:col-span-1">
                                          <Label className="mb-1 block text-xs">Rep max</Label>
                                          <Input
                                            inputMode="numeric"
                                            value={exercise.target_reps_max}
                                            onChange={(event) =>
                                              updateBlockExercise(dayIdx, blockIdx, exerciseIdx, {
                                                target_reps_max: event.target.value.replace(/[^\d]/g, ''),
                                              })
                                            }
                                          />
                                        </div>

                                        <div className="col-span-6 sm:col-span-1">
                                          <Label className="mb-1 block text-xs">Inc kg</Label>
                                          <Input
                                            inputMode="numeric"
                                            value={exercise.progression_increment_kg}
                                            onChange={(event) =>
                                              updateBlockExercise(dayIdx, blockIdx, exerciseIdx, {
                                                progression_increment_kg: event.target.value.replace(/[^\d]/g, ''),
                                              })
                                            }
                                          />
                                        </div>

                                        <div className="col-span-6 sm:col-span-1">
                                          <Label className="mb-1 block text-xs">Backoff</Label>
                                          <Input
                                            inputMode="decimal"
                                            value={exercise.backoff_percentage}
                                            onChange={(event) =>
                                              updateBlockExercise(dayIdx, blockIdx, exerciseIdx, {
                                                backoff_percentage: event.target.value.replace(/[^\d.]/g, ''),
                                              })
                                            }
                                          />
                                        </div>

                                        <div className="col-span-12 sm:col-span-12 flex items-center justify-between gap-2">
                                          <label className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <Checkbox
                                              checked={Boolean(exercise.is_key_exercise)}
                                              onCheckedChange={(checked) =>
                                                updateBlockExercise(dayIdx, blockIdx, exerciseIdx, {
                                                  is_key_exercise: checked === true,
                                                })
                                              }
                                            />
                                            Ejercicio clave del bloque
                                          </label>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeExerciseFromBlock(dayIdx, blockIdx, exerciseIdx)}
                                            disabled={block.exercises.length <= 1}
                                            className="text-muted-foreground hover:text-red-400"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  ))}

                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="h-8 text-xs"
                                    onClick={() => addExerciseToBlock(dayIdx, blockIdx)}
                                  >
                                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                                    Anadir ejercicio
                                  </Button>
                                </div>
                              </div>
                            ))}

                            <Button type="button" variant="outline" className="h-8 text-xs" onClick={() => addBlock(dayIdx)}>
                              <Plus className="mr-1.5 h-3.5 w-3.5" />
                              Anadir bloque
                            </Button>
                          </div>
                        </details>
                      ))}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Button
              type="submit"
              className="w-full bg-[#F44C40] text-white hover:bg-[#E23C32]"
              disabled={isLoadingCatalogs || isSubmitting || !isDistributionConfirmed}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando rutina semanal...
                </>
              ) : (
                'Crear rutina semanal'
              )}
            </Button>
          </form>
        </div>
      </main>
    </>
  );
};

export default CreateMesocyclePage;
