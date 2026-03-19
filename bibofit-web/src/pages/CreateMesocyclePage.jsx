import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { addWeeks, format } from 'date-fns';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';

const DAY_TYPE_OPTIONS = [
  { value: 'torso', label: 'Torso' },
  { value: 'pierna', label: 'Pierna' },
  { value: 'fullbody', label: 'Full Body' },
  { value: 'push', label: 'Empuje (Push)' },
  { value: 'pull', label: 'Tiron (Pull)' },
  { value: 'core', label: 'Core' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'movilidad', label: 'Movilidad' },
  { value: 'custom', label: 'Personalizado' },
];

const DEFAULT_DAY_ROTATION = ['torso', 'pierna', 'fullbody', 'torso', 'pierna', 'fullbody', 'cardio'];

const BLOCK_PATTERN_CODES = {
  torso: ['empuje_horizontal', 'empuje_vertical', 'traccion_horizontal', 'traccion_vertical', 'flexion_codo', 'extension_codo'],
  pierna: ['extension_rodilla', 'flexion_rodilla', 'extension_cadera', 'abduccion_cadera', 'aduccion_cadera', 'flexion_plantar_tobillo', 'dorsiflexion_tobillo', 'locomocion_cargada'],
  fullbody: ['empuje_horizontal', 'empuje_vertical', 'traccion_horizontal', 'traccion_vertical', 'extension_rodilla', 'flexion_rodilla', 'extension_cadera', 'cardio'],
  push: ['empuje_horizontal', 'empuje_vertical', 'extension_codo'],
  pull: ['traccion_horizontal', 'traccion_vertical', 'flexion_codo', 'agarre'],
  core: ['flexion_tronco', 'anti_extension_tronco', 'anti_rotacion_tronco', 'anti_flexion_lateral_tronco'],
  cardio: ['cardio', 'locomocion_cargada'],
  movilidad: [],
  custom: [],
};

const makeDefaultBlock = (type) => ({
  type,
  goal_pattern_id: '',
  primary_exercise_id: '',
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

const toIntOrNull = (value) => {
  const parsed = Number.parseInt(String(value || '').trim(), 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const CreateMesocyclePage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [isLoadingCatalogs, setIsLoadingCatalogs] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [objectiveOptions, setObjectiveOptions] = useState([]);
  const [movementPatterns, setMovementPatterns] = useState([]);
  const [exerciseOptions, setExerciseOptions] = useState([]);
  const [exercisePatternMap, setExercisePatternMap] = useState(new Map());

  const [selectedObjectiveId, setSelectedObjectiveId] = useState(null);
  const [mesocycleName, setMesocycleName] = useState('');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(addWeeks(new Date(), 8), 'yyyy-MM-dd'));
  const [sessionsPerWeek, setSessionsPerWeek] = useState(3);
  const [dayBlueprint, setDayBlueprint] = useState(() => normalizeDayBlueprintLength([], 3));

  useEffect(() => {
    let isMounted = true;
    const fetchCatalogs = async () => {
      setIsLoadingCatalogs(true);
      try {
        const [
          objectivesRes,
          patternsRes,
          exercisesRes,
          exercisePatternsRes,
        ] = await Promise.all([
          supabase
            .from('training_objectives')
            .select('id, code, name, description, display_order')
            .eq('is_active', true)
            .order('display_order', { ascending: true })
            .order('id', { ascending: true }),
          supabase
            .from('training_movement_patterns')
            .select('id, code, name')
            .order('name', { ascending: true }),
          supabase
            .from('exercises')
            .select('id, name')
            .order('name', { ascending: true }),
          supabase
            .from('exercise_movement_patterns')
            .select('exercise_id, pattern_id')
            .eq('is_primary', true),
        ]);

        if (objectivesRes.error) throw objectivesRes.error;
        if (patternsRes.error) throw patternsRes.error;
        if (exercisesRes.error) throw exercisesRes.error;
        if (exercisePatternsRes.error) throw exercisePatternsRes.error;
        if (!isMounted) return;

        const safeObjectives = objectivesRes.data || [];
        const safePatterns = patternsRes.data || [];
        const safeExercises = exercisesRes.data || [];
        const safeExercisePatterns = exercisePatternsRes.data || [];

        const map = new Map();
        safeExercisePatterns.forEach((row) => {
          if (!map.has(row.exercise_id)) map.set(row.exercise_id, new Set());
          map.get(row.exercise_id).add(row.pattern_id);
        });

        setObjectiveOptions(safeObjectives);
        setMovementPatterns(safePatterns);
        setExerciseOptions(safeExercises);
        setExercisePatternMap(map);
        if (safeObjectives.length) {
          setSelectedObjectiveId((prev) => prev ?? safeObjectives[0].id);
        }
      } catch (fetchError) {
        console.error('Error fetching mesocycle catalogs:', fetchError);
        toast({
          title: 'No se pudieron cargar los datos base',
          description: 'Revisa que las migraciones de entreno esten aplicadas.',
          variant: 'destructive',
        });
      } finally {
        if (isMounted) setIsLoadingCatalogs(false);
      }
    };

    fetchCatalogs();
    return () => {
      isMounted = false;
    };
  }, [toast]);

  useEffect(() => {
    setDayBlueprint((current) => normalizeDayBlueprintLength(current, sessionsPerWeek));
  }, [sessionsPerWeek]);

  const selectedObjective = useMemo(
    () => objectiveOptions.find((objective) => objective.id === selectedObjectiveId) || null,
    [objectiveOptions, selectedObjectiveId]
  );

  const patternIdByCode = useMemo(() => {
    const map = new Map();
    movementPatterns.forEach((pattern) => map.set(pattern.code, pattern.id));
    return map;
  }, [movementPatterns]);

  const getPatternOptionsForBlockType = (blockType) => {
    const allowedCodes = BLOCK_PATTERN_CODES[blockType] || [];
    if (!allowedCodes.length) return movementPatterns;
    const allowedIds = new Set(allowedCodes.map((code) => patternIdByCode.get(code)).filter(Boolean));
    return movementPatterns.filter((pattern) => allowedIds.has(pattern.id));
  };

  const getExerciseOptionsForPattern = (goalPatternId) => {
    if (!goalPatternId) return exerciseOptions;
    return exerciseOptions.filter((exercise) => exercisePatternMap.get(exercise.id)?.has(goalPatternId));
  };

  const updateDay = (index, updater) => {
    setDayBlueprint((current) =>
      current.map((day, dayIndex) => (dayIndex === index ? updater(day) : day))
    );
  };

  const addBlock = (dayIndex) => {
    updateDay(dayIndex, (day) => {
      const defaultType = day.blocks?.[day.blocks.length - 1]?.type || 'custom';
      return {
        ...day,
        blocks: [...day.blocks, makeDefaultBlock(defaultType)],
      };
    });
  };

  const removeBlock = (dayIndex, blockIndex) => {
    updateDay(dayIndex, (day) => {
      if (day.blocks.length <= 1) return day;
      return {
        ...day,
        blocks: day.blocks.filter((_, idx) => idx !== blockIndex),
      };
    });
  };

  const updateBlock = (dayIndex, blockIndex, patch) => {
    updateDay(dayIndex, (day) => ({
      ...day,
      blocks: day.blocks.map((block, idx) => (idx === blockIndex ? { ...block, ...patch } : block)),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedObjectiveId) {
      toast({
        title: 'Falta objetivo',
        description: 'Selecciona un objetivo principal para el mesociclo.',
        variant: 'destructive',
      });
      return;
    }

    const payloadDays = dayBlueprint.map((day) => ({
      name: day.name?.trim() || null,
      blocks: day.blocks.map((block) => ({
        type: block.type || 'custom',
        goal_pattern_id: toIntOrNull(block.goal_pattern_id),
        primary_exercise_id: toIntOrNull(block.primary_exercise_id),
      })),
    }));

    setIsSubmitting(true);
    try {
      const { error } = await supabase.rpc('create_mesocycle_blueprint', {
        p_name: mesocycleName.trim() || null,
        p_start_date: startDate || null,
        p_end_date: endDate || null,
        p_objective_id: selectedObjectiveId,
        p_days: payloadDays,
      });

      if (error) throw error;

      toast({
        title: 'Mesociclo creado',
        description: 'Tu zona de entrenamiento ya esta lista.',
        variant: 'success',
      });
      navigate('/plan/entreno/sesion', { replace: true });
    } catch (submitError) {
      console.error('Error creating mesocycle:', submitError);
      toast({
        title: 'No se pudo crear el mesociclo',
        description: submitError?.message || 'Revisa la configuracion e intentalo de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Crear Mesociclo - Bibofit</title>
        <meta
          name="description"
          content="Crea un mesociclo por bloques: objetivo, dias por semana y bloque + objetivo + ejercicio clave."
        />
      </Helmet>
      <main className="w-full px-3 py-4 md:px-4 md:py-8">
        <div className="mx-auto w-full max-w-3xl space-y-4">
          <Button asChild variant="ghost" className="text-muted-foreground hover:text-foreground">
            <Link to="/plan/entreno/sesion">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a entreno
            </Link>
          </Button>

          <Card className="border-[#F44C40]/40 bg-card/80">
            <CardHeader>
              <CardTitle className="text-white">Crear nuevo mesociclo</CardTitle>
              <CardDescription>
                Sin duplicados: el dia se define solo por sus bloques.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-border bg-background p-3 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Informacion que se capta:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>Objetivo principal del mesociclo.</li>
                  <li>Nombre y fechas (inicio/fin).</li>
                  <li>Numero de dias de entreno por semana.</li>
                  <li>Bloques de cada dia (tipo).</li>
                  <li>Objetivo principal de cada bloque (patron de movimiento).</li>
                  <li>Ejercicio clave del bloque para seguir progreso.</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Objetivo del mesociclo</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingCatalogs ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando catalogos...
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {objectiveOptions.map((objective) => {
                      const isSelected = objective.id === selectedObjectiveId;
                      return (
                        <button
                          key={objective.id}
                          type="button"
                          onClick={() => setSelectedObjectiveId(objective.id)}
                          className={`rounded-xl border p-3 text-left transition ${
                            isSelected
                              ? 'border-[#F44C40] bg-[#F44C40]/10'
                              : 'border-border bg-background hover:border-[#F44C40]/50'
                          }`}
                        >
                          <p className="text-sm font-semibold text-white">{objective.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{objective.description}</p>
                        </button>
                      );
                    })}
                  </div>
                )}
                {selectedObjective ? (
                  <p className="mt-2 text-xs text-[#FCA5A5]">Objetivo elegido: {selectedObjective.name}</p>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Datos basicos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="mesocycle-name">Nombre (opcional)</Label>
                  <Input
                    id="mesocycle-name"
                    value={mesocycleName}
                    onChange={(event) => setMesocycleName(event.target.value)}
                    placeholder="Ej. Torso/Pierna + Cardio"
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="start-date">Fecha de inicio</Label>
                    <Input
                      id="start-date"
                      type="date"
                      value={startDate}
                      onChange={(event) => setStartDate(event.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="end-date">Fecha de fin</Label>
                    <Input
                      id="end-date"
                      type="date"
                      value={endDate}
                      onChange={(event) => setEndDate(event.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
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
                <CardTitle className="text-lg">Bloques por dia</CardTitle>
                <CardDescription>
                  Define tipo de bloque, objetivo principal y ejercicio clave.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {dayBlueprint.map((day, dayIndex) => (
                  <div key={`day-${dayIndex}`} className="rounded-xl border border-border bg-background p-3">
                    <p className="mb-2 text-sm font-semibold text-white">Dia {dayIndex + 1}</p>
                    <div className="space-y-1.5">
                      <Label>Nombre del dia</Label>
                      <Input
                        value={day.name}
                        onChange={(event) =>
                          updateDay(dayIndex, (current) => ({ ...current, name: event.target.value }))
                        }
                      />
                    </div>

                    <div className="mt-3 space-y-2">
                      {day.blocks.map((block, blockIndex) => {
                        const patternOptions = getPatternOptionsForBlockType(block.type);
                        const selectedPatternId = toIntOrNull(block.goal_pattern_id);
                        const exerciseOptionsForPattern = getExerciseOptionsForPattern(selectedPatternId);

                        return (
                          <div key={`day-${dayIndex}-block-${blockIndex}`} className="rounded-lg border border-border p-2">
                            <div className="grid grid-cols-12 gap-2">
                              <div className="col-span-12 sm:col-span-3">
                                <Label className="mb-1 block text-xs">Tipo</Label>
                                <Select
                                  value={block.type}
                                  onValueChange={(value) =>
                                    updateBlock(dayIndex, blockIndex, {
                                      type: value,
                                      goal_pattern_id: '',
                                      primary_exercise_id: '',
                                    })
                                  }
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

                              <div className="col-span-12 sm:col-span-4">
                                <Label className="mb-1 block text-xs">Objetivo del bloque</Label>
                                <Select
                                  value={String(block.goal_pattern_id || '')}
                                  onValueChange={(value) =>
                                    updateBlock(dayIndex, blockIndex, {
                                      goal_pattern_id: value,
                                      primary_exercise_id: '',
                                    })
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Patron principal" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {patternOptions.map((pattern) => (
                                      <SelectItem key={pattern.id} value={String(pattern.id)}>
                                        {pattern.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="col-span-12 sm:col-span-4">
                                <Label className="mb-1 block text-xs">Ejercicio clave</Label>
                                <Select
                                  value={String(block.primary_exercise_id || '')}
                                  onValueChange={(value) =>
                                    updateBlock(dayIndex, blockIndex, { primary_exercise_id: value })
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Ejercicio principal" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {exerciseOptionsForPattern.map((exercise) => (
                                      <SelectItem key={exercise.id} value={String(exercise.id)}>
                                        {exercise.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="col-span-12 sm:col-span-1 flex items-end justify-end">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeBlock(dayIndex, blockIndex)}
                                  disabled={day.blocks.length <= 1}
                                  className="text-muted-foreground hover:text-red-400"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => addBlock(dayIndex)}
                        className="h-8 text-xs"
                      >
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                        Anadir bloque
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Button
              type="submit"
              className="w-full bg-[#F44C40] text-white hover:bg-[#E23C32]"
              disabled={isSubmitting || isLoadingCatalogs}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando mesociclo...
                </>
              ) : (
                'Crear nuevo mesociclo'
              )}
            </Button>
          </form>
        </div>
      </main>
    </>
  );
};

export default CreateMesocyclePage;
