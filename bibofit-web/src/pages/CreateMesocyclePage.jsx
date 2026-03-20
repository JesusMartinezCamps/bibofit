import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { createMesocycleBlueprintV2, getTrainingZoneCatalogs } from '@/lib/trainingZoneService';

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

const FOCUS_TYPE_OPTIONS = [
  { value: 'none', label: 'Sin foco' },
  { value: 'movement_pattern', label: 'Patron de movimiento' },
  { value: 'muscle', label: 'Musculo' },
  { value: 'joint', label: 'Articulacion' },
  { value: 'exercise', label: 'Ejercicio' },
];

const DEFAULT_DAY_ROTATION = ['torso', 'pierna', 'fullbody', 'torso', 'pierna', 'fullbody', 'cardio'];

const makeDefaultExercise = () => ({
  exercise_id: '',
  preferred_equipment_id: '',
  target_sets: '3',
  target_reps_min: '8',
  target_reps_max: '12',
  progression_increment_kg: '5',
  backoff_percentage: '0.8',
  is_key_exercise: false,
  notes: '',
});

const makeDefaultBlock = (type = 'custom') => ({
  type,
  name: '',
  exercises: [makeDefaultExercise()],
});

const makeDefaultDay = (index) => {
  const defaultType = DEFAULT_DAY_ROTATION[index] || 'custom';
  return {
    name: `Dia ${index + 1}`,
    blocks: [makeDefaultBlock(defaultType)],
  };
};

const normalizeDayBlueprintLength = (current, size) => {
  const safeSize = Math.max(1, Math.min(7, size));
  const next = [...current];
  if (next.length > safeSize) return next.slice(0, safeSize);
  while (next.length < safeSize) next.push(makeDefaultDay(next.length));
  return next;
};

const makeBlockKey = (dayIndex, blockOrder) => `${dayIndex}-${blockOrder}`;

const splitDateRange = (startDate, endDate, count) => {
  const safeCount = Math.max(1, count);
  if (!startDate || !endDate) return Array.from({ length: safeCount }, () => ({ start_date: '', end_date: '' }));

  const start = parseISO(startDate);
  const end = parseISO(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return Array.from({ length: safeCount }, () => ({ start_date: startDate, end_date: endDate }));
  }

  const totalDays = differenceInCalendarDays(end, start) + 1;
  const base = Math.floor(totalDays / safeCount);
  const remainder = totalDays % safeCount;

  let cursor = start;
  return Array.from({ length: safeCount }).map((_, idx) => {
    const extra = idx < remainder ? 1 : 0;
    const chunkSize = Math.max(1, base + extra);
    const chunkEnd = addDays(cursor, chunkSize - 1);
    const result = {
      start_date: format(cursor, 'yyyy-MM-dd'),
      end_date: format(chunkEnd > end ? end : chunkEnd, 'yyyy-MM-dd'),
    };
    cursor = addDays(chunkEnd, 1);
    return result;
  });
};

const toSafeInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (Number.isNaN(parsed)) return fallback;
  return parsed;
};

const getBlockReferences = (days) => {
  const refs = [];
  days.forEach((day, dayIdx) => {
    day.blocks.forEach((block, blockIdx) => {
      const dayIndex = dayIdx + 1;
      const blockOrder = blockIdx + 1;
      const key = makeBlockKey(dayIndex, blockOrder);
      const exerciseIds = block.exercises
        .map((exercise) => Number.parseInt(exercise.exercise_id, 10))
        .filter((id) => !Number.isNaN(id));
      const keyExercise = block.exercises.find((exercise) => exercise.is_key_exercise && exercise.exercise_id);
      refs.push({
        key,
        day_index: dayIndex,
        block_order: blockOrder,
        label: `Dia ${dayIndex} · Bloque ${blockOrder} (${block.type || 'custom'})`,
        exerciseIds,
        defaultKeyExerciseId: keyExercise?.exercise_id || (exerciseIds[0] ? String(exerciseIds[0]) : ''),
      });
    });
  });
  return refs;
};

const normalizeMicrocycleFocuses = (focuses, blockRefs) => {
  const currentMap = new Map((focuses || []).map((focus) => [makeBlockKey(focus.day_index, focus.block_order), focus]));

  return blockRefs.map((ref) => {
    const existing = currentMap.get(ref.key);
    return {
      day_index: ref.day_index,
      block_order: ref.block_order,
      focus_type: existing?.focus_type || 'none',
      movement_pattern_id: existing?.movement_pattern_id || '',
      muscle_id: existing?.muscle_id || '',
      joint_id: existing?.joint_id || '',
      focus_exercise_id: existing?.focus_exercise_id || '',
      key_exercise_id: existing?.key_exercise_id || ref.defaultKeyExerciseId || '',
      notes: existing?.notes || '',
    };
  });
};

const buildMicrocyclesByCount = ({ count, startDate, endDate, objectiveId, blockRefs, previous }) => {
  const ranges = splitDateRange(startDate, endDate, count);

  return Array.from({ length: count }).map((_, idx) => {
    const prev = previous?.[idx];
    const range = ranges[idx] || { start_date: startDate, end_date: endDate };

    return {
      name: prev?.name || `Microciclo ${idx + 1}`,
      start_date: prev?.start_date || range.start_date,
      end_date: prev?.end_date || range.end_date,
      objective_id: prev?.objective_id || String(objectiveId || ''),
      objective_notes: prev?.objective_notes || '',
      deload_week: Boolean(prev?.deload_week),
      focuses: normalizeMicrocycleFocuses(prev?.focuses || [], blockRefs),
    };
  });
};

const CreateMesocyclePage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [isLoadingCatalogs, setIsLoadingCatalogs] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [objectiveOptions, setObjectiveOptions] = useState([]);
  const [movementPatterns, setMovementPatterns] = useState([]);
  const [muscles, setMuscles] = useState([]);
  const [joints, setJoints] = useState([]);
  const [exerciseOptions, setExerciseOptions] = useState([]);
  const [equipmentOptions, setEquipmentOptions] = useState([]);

  const [mesocycleName, setMesocycleName] = useState('');
  const [weeklyRoutineName, setWeeklyRoutineName] = useState('Rutina semanal');
  const [selectedObjectiveId, setSelectedObjectiveId] = useState('');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(addDays(new Date(), 56), 'yyyy-MM-dd'));
  const [sessionsPerWeek, setSessionsPerWeek] = useState(3);
  const [dayBlueprint, setDayBlueprint] = useState(() => normalizeDayBlueprintLength([], 3));

  const [microcycleCount, setMicrocycleCount] = useState(2);
  const [microcycles, setMicrocycles] = useState([]);

  const blockReferences = useMemo(() => getBlockReferences(dayBlueprint), [dayBlueprint]);

  useEffect(() => {
    let isMounted = true;

    const loadCatalogs = async () => {
      setIsLoadingCatalogs(true);
      try {
        const catalogs = await getTrainingZoneCatalogs();
        if (!isMounted) return;

        setObjectiveOptions(catalogs.objectives);
        setMovementPatterns(catalogs.movementPatterns);
        setMuscles(catalogs.muscles);
        setJoints(catalogs.joints);
        setExerciseOptions(catalogs.exercises);
        setEquipmentOptions(catalogs.equipment);

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
    setDayBlueprint((current) => normalizeDayBlueprintLength(current, sessionsPerWeek));
  }, [sessionsPerWeek]);

  useEffect(() => {
    setMicrocycles((current) =>
      buildMicrocyclesByCount({
        count: microcycleCount,
        startDate,
        endDate,
        objectiveId: selectedObjectiveId,
        blockRefs: blockReferences,
        previous: current,
      })
    );
  }, [microcycleCount, startDate, endDate, selectedObjectiveId, blockReferences]);

  const selectedObjective = useMemo(
    () => objectiveOptions.find((objective) => String(objective.id) === String(selectedObjectiveId)) || null,
    [objectiveOptions, selectedObjectiveId]
  );

  const exerciseMap = useMemo(() => new Map(exerciseOptions.map((exercise) => [String(exercise.id), exercise])), [exerciseOptions]);

  const updateDay = (index, updater) => {
    setDayBlueprint((current) => current.map((day, dayIdx) => (dayIdx === index ? updater(day) : day)));
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
              exercises: [...block.exercises, makeDefaultExercise()],
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
        return {
          ...block,
          exercises: block.exercises.filter((_, exIdx) => exIdx !== exerciseIdx),
        };
      }),
    }));
  };

  const updateBlockExercise = (dayIdx, blockIdx, exerciseIdx, patch) => {
    updateDay(dayIdx, (day) => ({
      ...day,
      blocks: day.blocks.map((block, idx) => {
        if (idx !== blockIdx) return block;
        return {
          ...block,
          exercises: block.exercises.map((exercise, exIdx) => {
            if (exIdx !== exerciseIdx) return exercise;
            return { ...exercise, ...patch };
          }),
        };
      }),
    }));
  };

  const updateMicrocycle = (index, patch) => {
    setMicrocycles((current) => current.map((microcycle, idx) => (idx === index ? { ...microcycle, ...patch } : microcycle)));
  };

  const updateMicrocycleFocus = (microcycleIndex, focusIndex, patch) => {
    setMicrocycles((current) =>
      current.map((microcycle, idx) => {
        if (idx !== microcycleIndex) return microcycle;
        return {
          ...microcycle,
          focuses: microcycle.focuses.map((focus, focusIdx) => {
            if (focusIdx !== focusIndex) return focus;

            const resetTargetPatch =
              patch.focus_type && patch.focus_type !== focus.focus_type
                ? {
                    movement_pattern_id: '',
                    muscle_id: '',
                    joint_id: '',
                    focus_exercise_id: '',
                  }
                : {};

            return {
              ...focus,
              ...resetTargetPatch,
              ...patch,
            };
          }),
        };
      })
    );
  };

  const validateForm = () => {
    if (!user?.id) return 'Usuario no autenticado.';
    if (!selectedObjectiveId) return 'Selecciona un objetivo principal.';
    if (!startDate || !endDate) return 'Define fecha de inicio y fin.';
    if (parseISO(endDate) < parseISO(startDate)) return 'La fecha de fin no puede ser anterior a la de inicio.';

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

    for (let microIdx = 0; microIdx < microcycles.length; microIdx += 1) {
      const micro = microcycles[microIdx];
      if (!micro.start_date || !micro.end_date) {
        return `El microciclo ${microIdx + 1} necesita fecha de inicio y fin.`;
      }
      if (parseISO(micro.end_date) < parseISO(micro.start_date)) {
        return `El microciclo ${microIdx + 1} tiene fechas invalidas.`;
      }
      if (parseISO(micro.start_date) < parseISO(startDate) || parseISO(micro.end_date) > parseISO(endDate)) {
        return `El microciclo ${microIdx + 1} debe estar dentro del rango del mesociclo.`;
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
      await createMesocycleBlueprintV2({
        userId: user.id,
        name: mesocycleName,
        objectiveId: selectedObjectiveId,
        startDate,
        endDate,
        weeklyRoutineName,
        days: dayBlueprint,
        microcycles,
      });

      toast({
        title: 'Zona de entrenamiento creada',
        description: 'Mesociclo, rutina semanal y microciclos guardados correctamente.',
        variant: 'success',
      });

      navigate('/plan/entreno', { replace: true });
    } catch (error) {
      console.error('Error creating training zone blueprint:', error);
      toast({
        title: 'No se pudo crear la zona de entrenamiento',
        description: error?.message || 'Revisa la configuracion e intentalo de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Crear Zona de Entrenamiento - Bibofit</title>
        <meta
          name="description"
          content="Configura tu mesociclo con rutina semanal y microciclos en la nueva Zona de Entrenamiento."
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
              <CardTitle className="text-white">Nuevo mesociclo (V2)</CardTitle>
              <CardDescription>
                Configura en una sola pantalla: mesociclo, rutina semanal (dias, bloques, ejercicios) y microciclos.
              </CardDescription>
            </CardHeader>
          </Card>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">1) Datos del mesociclo</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1.5 md:col-span-2">
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
                  {selectedObjective ? (
                    <p className="text-xs text-muted-foreground">{selectedObjective.description}</p>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <Label>Nombre mesociclo</Label>
                  <Input
                    value={mesocycleName}
                    onChange={(event) => setMesocycleName(event.target.value)}
                    placeholder="Ej: Torso/Pierna - Primavera"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Nombre rutina semanal</Label>
                  <Input
                    value={weeklyRoutineName}
                    onChange={(event) => setWeeklyRoutineName(event.target.value)}
                    placeholder="Ej: Rutina base"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Fecha inicio</Label>
                  <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                </div>

                <div className="space-y-1.5">
                  <Label>Fecha fin</Label>
                  <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Dias de entrenamiento por semana</Label>
                  <div className="flex flex-wrap gap-2">
                    {[1, 2, 3, 4, 5, 6, 7].map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setSessionsPerWeek(count)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                          sessionsPerWeek === count
                            ? 'border-[#F44C40] bg-[#F44C40] text-white'
                            : 'border-border bg-background text-muted-foreground'
                        }`}
                      >
                        {count} dia{count === 1 ? '' : 's'}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">2) Rutina semanal (dias, bloques y ejercicios)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {dayBlueprint.map((day, dayIdx) => (
                  <div key={`day-${dayIdx}`} className="rounded-xl border border-border bg-background p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-white">Dia {dayIdx + 1}</p>
                    </div>

                    <div className="space-y-1.5">
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
                            </div>

                            <div className="col-span-12 sm:col-span-8">
                              <Label className="mb-1 block text-xs">Nombre bloque (opcional)</Label>
                              <Input
                                value={block.name}
                                onChange={(event) => updateBlock(dayIdx, blockIdx, { name: event.target.value })}
                                placeholder="Ej: Empuje principal"
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
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">3) Microciclos y focos</CardTitle>
                <CardDescription>
                  Divide el mesociclo en microciclos y define focos por bloque (patron, musculo, articulacion o ejercicio).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Numero de microciclos</Label>
                  <div className="flex flex-wrap gap-2">
                    {[1, 2, 3, 4, 5, 6].map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setMicrocycleCount(count)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                          microcycleCount === count
                            ? 'border-[#F44C40] bg-[#F44C40] text-white'
                            : 'border-border bg-background text-muted-foreground'
                        }`}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                </div>

                {microcycles.map((microcycle, microIdx) => (
                  <div key={`micro-${microIdx}`} className="rounded-xl border border-border bg-background p-3">
                    <p className="text-sm font-semibold text-white">Microciclo {microIdx + 1}</p>

                    <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-4">
                      <div className="space-y-1.5 md:col-span-2">
                        <Label className="text-xs">Nombre</Label>
                        <Input
                          value={microcycle.name}
                          onChange={(event) => updateMicrocycle(microIdx, { name: event.target.value })}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Inicio</Label>
                        <Input
                          type="date"
                          value={microcycle.start_date}
                          onChange={(event) => updateMicrocycle(microIdx, { start_date: event.target.value })}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Fin</Label>
                        <Input
                          type="date"
                          value={microcycle.end_date}
                          onChange={(event) => updateMicrocycle(microIdx, { end_date: event.target.value })}
                        />
                      </div>

                      <div className="space-y-1.5 md:col-span-2">
                        <Label className="text-xs">Objetivo del microciclo</Label>
                        <Select
                          value={String(microcycle.objective_id || selectedObjectiveId || '')}
                          onValueChange={(value) => updateMicrocycle(microIdx, { objective_id: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Objetivo" />
                          </SelectTrigger>
                          <SelectContent>
                            {objectiveOptions.map((objective) => (
                              <SelectItem key={objective.id} value={String(objective.id)}>
                                {objective.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="md:col-span-2 flex items-end">
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Checkbox
                            checked={Boolean(microcycle.deload_week)}
                            onCheckedChange={(checked) => updateMicrocycle(microIdx, { deload_week: checked === true })}
                          />
                          Deload en este microciclo
                        </label>
                      </div>
                    </div>

                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Focos por bloque</p>

                      {microcycle.focuses.map((focus, focusIdx) => {
                        const ref = blockReferences[focusIdx];
                        const keyExerciseOptions = ref?.exerciseIds?.length
                          ? ref.exerciseIds
                              .map((id) => ({ id: String(id), name: exerciseMap.get(String(id))?.name || `Ejercicio ${id}` }))
                              .filter((item) => item.name)
                          : [];

                        const focusType = focus.focus_type || 'none';

                        return (
                          <div key={`micro-${microIdx}-focus-${focusIdx}`} className="rounded-md border border-border/80 p-2">
                            <p className="mb-2 text-xs text-muted-foreground">{ref?.label || `Bloque ${focusIdx + 1}`}</p>

                            <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                              <div className="space-y-1">
                                <Label className="text-xs">Tipo foco</Label>
                                <Select
                                  value={focusType}
                                  onValueChange={(value) => updateMicrocycleFocus(microIdx, focusIdx, { focus_type: value })}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {FOCUS_TYPE_OPTIONS.map((option) => (
                                      <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              {focusType === 'movement_pattern' ? (
                                <div className="space-y-1">
                                  <Label className="text-xs">Patron</Label>
                                  <Select
                                    value={String(focus.movement_pattern_id || '')}
                                    onValueChange={(value) =>
                                      updateMicrocycleFocus(microIdx, focusIdx, { movement_pattern_id: value })
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Selecciona" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {movementPatterns.map((pattern) => (
                                        <SelectItem key={pattern.id} value={String(pattern.id)}>
                                          {pattern.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              ) : null}

                              {focusType === 'muscle' ? (
                                <div className="space-y-1">
                                  <Label className="text-xs">Musculo</Label>
                                  <Select
                                    value={String(focus.muscle_id || '')}
                                    onValueChange={(value) => updateMicrocycleFocus(microIdx, focusIdx, { muscle_id: value })}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Selecciona" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {muscles.map((muscle) => (
                                        <SelectItem key={muscle.id} value={String(muscle.id)}>
                                          {muscle.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              ) : null}

                              {focusType === 'joint' ? (
                                <div className="space-y-1">
                                  <Label className="text-xs">Articulacion</Label>
                                  <Select
                                    value={String(focus.joint_id || '')}
                                    onValueChange={(value) => updateMicrocycleFocus(microIdx, focusIdx, { joint_id: value })}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Selecciona" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {joints.map((joint) => (
                                        <SelectItem key={joint.id} value={String(joint.id)}>
                                          {joint.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              ) : null}

                              {focusType === 'exercise' ? (
                                <div className="space-y-1">
                                  <Label className="text-xs">Ejercicio foco</Label>
                                  <Select
                                    value={String(focus.focus_exercise_id || '')}
                                    onValueChange={(value) =>
                                      updateMicrocycleFocus(microIdx, focusIdx, { focus_exercise_id: value })
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Selecciona" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {exerciseOptions.map((exercise) => (
                                        <SelectItem key={exercise.id} value={String(exercise.id)}>
                                          {exercise.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              ) : null}

                              <div className="space-y-1">
                                <Label className="text-xs">Ejercicio clave</Label>
                                <Select
                                  value={String(focus.key_exercise_id || '')}
                                  onValueChange={(value) => updateMicrocycleFocus(microIdx, focusIdx, { key_exercise_id: value })}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="(Opcional)" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {keyExerciseOptions.length ? (
                                      keyExerciseOptions.map((exercise) => (
                                        <SelectItem key={exercise.id} value={String(exercise.id)}>
                                          {exercise.name}
                                        </SelectItem>
                                      ))
                                    ) : (
                                      exerciseOptions.map((exercise) => (
                                        <SelectItem key={exercise.id} value={String(exercise.id)}>
                                          {exercise.name}
                                        </SelectItem>
                                      ))
                                    )}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Button
              type="submit"
              className="w-full bg-[#F44C40] text-white hover:bg-[#E23C32]"
              disabled={isLoadingCatalogs || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando zona de entrenamiento...
                </>
              ) : (
                'Crear nueva zona de entrenamiento'
              )}
            </Button>
          </form>
        </div>
      </main>
    </>
  );
};

export default CreateMesocyclePage;
