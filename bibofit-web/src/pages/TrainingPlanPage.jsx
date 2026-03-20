import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, Dumbbell, Loader2, Plus, Repeat, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { getDateKey, getTrainingZoneCatalogs, getTrainingZoneSnapshot } from '@/lib/trainingZoneService';

const formatDate = (value) => {
  if (!value) return 'Sin fecha';
  try {
    return format(parseISO(value), 'd MMM yyyy', { locale: es });
  } catch (_error) {
    return value;
  }
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
      return 'Sin foco';
  }
};

const EMPTY_LIST = [];

const TrainingPlanPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const [catalogs, setCatalogs] = useState(null);

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
    [toast, user?.id]
  );

  useEffect(() => {
    loadPageData();
  }, [loadPageData]);

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

  const dayById = useMemo(() => new Map(days.map((day) => [day.id, day])), [days]);
  const blocksByDayId = useMemo(() => {
    const grouped = new Map();
    blocks.forEach((block) => {
      const list = grouped.get(block.weekly_day_id) || [];
      list.push(block);
      grouped.set(block.weekly_day_id, list);
    });
    return grouped;
  }, [blocks]);

  const blockById = useMemo(() => new Map(blocks.map((block) => [block.id, block])), [blocks]);
  const blockExercisesByBlockId = useMemo(() => {
    const grouped = new Map();
    blockExercises.forEach((item) => {
      const list = grouped.get(item.weekly_day_block_id) || [];
      list.push(item);
      grouped.set(item.weekly_day_block_id, list);
    });
    return grouped;
  }, [blockExercises]);

  const focusesByMicrocycleId = useMemo(() => {
    const grouped = new Map();
    microcycleFocuses.forEach((focus) => {
      const list = grouped.get(focus.microcycle_id) || [];
      list.push(focus);
      grouped.set(focus.microcycle_id, list);
    });
    return grouped;
  }, [microcycleFocuses]);

  const nextSessionDayId = snapshot?.nextSessionDay?.weekly_day_id || null;
  const nextSessionLabel = snapshot?.nextSessionDay?.weekly_day_name || null;

  const renderFocusTarget = (focus) => {
    if (focus.focus_type === 'movement_pattern') return movementPatternMap.get(String(focus.movement_pattern_id)) || '-';
    if (focus.focus_type === 'muscle') return muscleMap.get(String(focus.muscle_id)) || '-';
    if (focus.focus_type === 'joint') return jointMap.get(String(focus.joint_id)) || '-';
    if (focus.focus_type === 'exercise') return exerciseMap.get(String(focus.focus_exercise_id)) || '-';
    return '-';
  };

  if (isLoading) {
    return (
      <main className="w-full px-4 py-10">
        <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card/70 p-6 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#F44C40]" />
          <p className="mt-3 text-sm text-muted-foreground">Cargando tu nueva zona de entrenamiento...</p>
        </div>
      </main>
    );
  }

  const activeMesocycle = snapshot?.activeMesocycle || null;
  const weeklyRoutine = snapshot?.weeklyRoutine || null;

  return (
    <>
      <Helmet>
        <title>Zona de Entrenamiento - Bibofit</title>
        <meta
          name="description"
          content="Mesociclo activo, microciclos y rutina semanal de la nueva Zona de Entrenamiento."
        />
      </Helmet>

      <main className="w-full px-3 py-4 md:px-4 md:py-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
          <Card className="border-[#F44C40]/40 bg-card/80">
            <CardHeader className="pb-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#F44C40]">Training Zone</p>
              <CardTitle className="text-white">Zona de entrenamiento</CardTitle>
              <CardDescription>
                MPV listo para crear mesociclos, definir microciclos y configurar la rutina semanal por bloques.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-2">
              <Button asChild className="bg-[#F44C40] text-white hover:bg-[#E23C32]">
                <Link to="/plan/entreno/mesociclo/nuevo">
                  <Plus className="mr-2 h-4 w-4" />
                  Crear nuevo mesociclo
                </Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => loadPageData({ silent: true })}
                disabled={isRefreshing}
              >
                {isRefreshing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Actualizando...
                  </>
                ) : (
                  <>
                    <Repeat className="mr-2 h-4 w-4" />
                    Actualizar
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {!activeMesocycle || !weeklyRoutine ? (
            <Card>
              <CardContent className="py-10 text-center">
                <Dumbbell className="mx-auto h-8 w-8 text-[#F44C40]" />
                <p className="mt-3 text-base font-semibold text-white">No tienes mesociclo activo</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Crea uno nuevo para definir tus días, bloques, ejercicios y microciclos.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg text-white">{activeMesocycle.name || 'Mesociclo activo'}</CardTitle>
                  <CardDescription className="flex flex-wrap items-center gap-2">
                    <span>Objetivo: {objectiveMap.get(String(activeMesocycle.objective_id)) || activeMesocycle.objective || 'Sin objetivo'}</span>
                    <span>·</span>
                    <span>{formatDate(activeMesocycle.start_date)} - {formatDate(activeMesocycle.end_date)}</span>
                    <span>·</span>
                    <span>{activeMesocycle.sessions_per_week || weeklyRoutine.sessions_per_week || days.length || 0} días/semana</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarDays className="h-4 w-4" />
                    Rutina semanal: <span className="font-medium text-foreground">{weeklyRoutine.name || 'Rutina base'}</span>
                  </div>
                  {nextSessionDayId ? (
                    <a
                      href={`#weekly-day-${nextSessionDayId}`}
                      className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/50 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300"
                    >
                      Hoy toca: {nextSessionLabel || 'Siguiente día'}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Rutina semanal</CardTitle>
                  <CardDescription>
                    Bloques y ejercicios configurados para cada día.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {days.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aún no hay días creados en la rutina semanal.</p>
                  ) : (
                    days.map((day) => {
                      const dayBlocks = blocksByDayId.get(day.id) || [];
                      return (
                        <div
                          key={day.id}
                          id={`weekly-day-${day.id}`}
                          className={`rounded-xl border p-3 ${
                            nextSessionDayId === day.id ? 'border-emerald-400/60 bg-emerald-500/5' : 'border-border bg-background'
                          }`}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-white">
                              Día {day.day_index}: {day.name || `Día ${day.day_index}`}
                            </p>
                            {nextSessionDayId === day.id ? (
                              <Badge className="bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20">Siguiente sesión</Badge>
                            ) : null}
                          </div>

                          <div className="mt-2 space-y-2">
                            {dayBlocks.length === 0 ? (
                              <p className="text-xs text-muted-foreground">Sin bloques configurados.</p>
                            ) : (
                              dayBlocks.map((block) => {
                                const exercises = blockExercisesByBlockId.get(block.id) || [];
                                return (
                                  <div key={block.id} className="rounded-lg border border-border/80 p-2">
                                    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                                      <Badge variant="outline">{block.block_type || 'custom'}</Badge>
                                      <span className="font-medium text-foreground">
                                        {block.name || `Bloque ${block.block_order}`}
                                      </span>
                                    </div>

                                    {exercises.length === 0 ? (
                                      <p className="text-xs text-muted-foreground">Sin ejercicios en este bloque.</p>
                                    ) : (
                                      <div className="space-y-1.5">
                                        {exercises.map((item) => (
                                          <div key={item.id} className="rounded-md border border-border/60 px-2 py-1.5 text-xs">
                                            <div className="flex flex-wrap items-center gap-2">
                                              <span className="font-medium text-foreground">
                                                {exerciseMap.get(String(item.exercise_id)) || `Ejercicio ${item.exercise_id}`}
                                              </span>
                                              {item.is_key_exercise ? (
                                                <Badge className="bg-[#F44C40]/20 text-[#FCA5A5] hover:bg-[#F44C40]/20">Clave</Badge>
                                              ) : null}
                                            </div>
                                            <p className="mt-1 text-muted-foreground">
                                              {item.target_sets || 0} series · {item.target_reps_min || 0}-{item.target_reps_max || 0} reps
                                              {item.preferred_equipment_id
                                                ? ` · ${equipmentMap.get(String(item.preferred_equipment_id)) || 'Equipamiento'}`
                                                : ''}
                                            </p>
                                          </div>
                                        ))}
                                      </div>
                                    )}
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

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Microciclos</CardTitle>
                  <CardDescription>
                    Objetivos y focos activos dentro del mesociclo.
                  </CardDescription>
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
                            <p className="text-sm font-semibold text-white">
                              #{microcycle.sequence_index}: {microcycle.name || 'Microciclo'}
                            </p>
                            {microcycle.deload_week ? (
                              <Badge className="bg-amber-500/20 text-amber-300 hover:bg-amber-500/20">Deload</Badge>
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
