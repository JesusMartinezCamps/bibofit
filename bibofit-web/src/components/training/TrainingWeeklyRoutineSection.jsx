import React, { useMemo, useState } from 'react';
import { addDays, format, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Dumbbell, List, Star } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import ContentStateToggle from '@/components/shared/ContentStateToggle';
import { cn } from '@/lib/utils';

const toDateKey = (date) => format(date, 'yyyy-MM-dd');

const shortDayLabel = (date) => {
  const text = format(date, 'EEE', { locale: es });
  return text.charAt(0).toUpperCase() + text.slice(1, 3);
};

const TrainingWeeklyRoutineSection = ({
  mode,
  onModeChange,
  days,
  blocksByDayId,
  blockExercisesByBlockId,
  nextSessionDayId,
  exerciseMap,
  equipmentMap,
  timelineEvents,
  onOpenDay,
  prProgress,
  volumeProgressTotal,
}) => {
  const [openDayMap, setOpenDayMap] = useState({});
  const [historyRightDate, setHistoryRightDate] = useState(new Date());

  const historyDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(historyRightDate, i - 6)),
    [historyRightDate]
  );

  const toggleDay = (dayId, open) => {
    setOpenDayMap((current) => ({ ...current, [dayId]: open }));
  };

  // Ordena los días para que el siguiente al de hoy aparezca primero
  const orderedDays = useMemo(() => {
    if (!nextSessionDayId || !days.length) return days;
    const todayDay = days.find((d) => d.id === nextSessionDayId);
    if (!todayDay) return days;
    const todayIdx = todayDay.day_index;
    return [...days].sort((a, b) => {
      const oa = (a.day_index - todayIdx - 1 + days.length) % days.length;
      const ob = (b.day_index - todayIdx - 1 + days.length) % days.length;
      return oa - ob;
    });
  }, [days, nextSessionDayId]);

  return (
    <Card className="bg-card/85 border-border text-foreground shadow-xl">
      <div className="p-4 border-b border-border">
        <ContentStateToggle
          mode={mode}
          onModeChange={onModeChange}
          optionOne={{ value: 'list', label: 'Rutina semanal', icon: List }}
          optionTwo={{ value: 'history', label: 'Histórico', icon: CalendarDays }}
          isSegmented={true}
          className="w-full"
        />
      </div>

      <CardHeader>
        {mode === 'list' ? (
          <>
            <CardTitle>Rutina semanal</CardTitle>
            <CardDescription>Estructura semanal en bloques y ejercicios.</CardDescription>
          </>
        ) : (
          <>
            <CardTitle>Histórico</CardTitle>
            <CardDescription>Vista rápida de PRs y volumen de series por día.</CardDescription>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-300 hover:bg-amber-500/20">
                PRs: {prProgress.actual}/{prProgress.target}
              </Badge>
              <Badge className="bg-[#F44C40]/20 text-[#F44C40] hover:bg-[#F44C40]/20">
                Volumen: {Math.round(volumeProgressTotal.actual)}/{Math.round(volumeProgressTotal.target)} series
              </Badge>
            </div>
          </>
        )}
      </CardHeader>

      <CardContent className="px-3 pb-4">
        {mode === 'history' ? (
          <div className="space-y-3">
            <div className="flex items-center justify-end gap-1.5">
              <Button variant="outline" size="icon" onClick={() => setHistoryRightDate((d) => addDays(d, -7))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => setHistoryRightDate((d) => addDays(d, 7))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-7 gap-2 md:gap-3 rounded-xl bg-card/75 p-3 border border-border/70">
              {historyDates.map((date) => {
                const dateKey = toDateKey(date);
                const event = timelineEvents.get(dateKey);
                const canOpen = Boolean(event?.weekly_day_id);
                const volumeLabel = `${event?.completed_sets || 0}/${event?.total_sets || 0}`;
                const prCount = Number(event?.pr_count || 0);

                return (
                  <button
                    key={dateKey}
                    type="button"
                    disabled={!canOpen}
                    onClick={() => canOpen && onOpenDay(event.weekly_day_id)}
                    className={cn(
                      'relative flex flex-col items-center justify-between p-2 rounded-lg transition-all duration-200 aspect-[3/4] min-h-[74px] border',
                      canOpen ? 'bg-muted/70 hover:bg-muted/85 border-transparent' : 'bg-muted/40 border-transparent opacity-70',
                      isToday(date) ? 'border-dashed border-[#F44C40]/60 bg-[#F44C40]/10' : ''
                    )}
                  >
                    <div className="text-center">
                      <p className={cn('text-xs md:text-sm font-medium', isToday(date) ? 'text-[#F44C40]' : 'text-muted-foreground')}>
                        {shortDayLabel(date)}
                      </p>
                      <p className="text-lg md:text-xl font-bold text-foreground">{format(date, 'd')}</p>
                    </div>

                    <div className="flex flex-col items-center gap-1">
                      <div className="flex justify-center gap-1 min-h-[8px] items-center">
                        {event?.has_pr ? <div className="w-2 h-2 rounded-full bg-amber-400" title="PR" /> : null}
                        {event?.is_completed ? <div className="w-2 h-2 rounded-full bg-emerald-500" title="Completado" /> : null}
                      </div>
                      {prCount > 0 ? (
                        <span className="text-[10px] text-amber-500/90 font-semibold">PR x{prCount}</span>
                      ) : null}
                      <span className="text-[10px] text-muted-foreground font-medium">{volumeLabel}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {orderedDays.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aún no hay días creados en la rutina semanal.</p>
            ) : (
              orderedDays.map((day) => {
                const dayBlocks = blocksByDayId.get(day.id) || [];
                const isNext = nextSessionDayId === day.id;
                const isOpen = openDayMap[day.id] ?? isNext;

                let exOrder = 0;

                return (
                  <Collapsible
                    key={day.id}
                    open={isOpen}
                    onOpenChange={(open) => toggleDay(day.id, open)}
                    className="rounded-lg bg-muted/70 border border-border/70 overflow-hidden"
                  >
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="w-full flex items-center justify-between gap-2 p-3 text-left hover:bg-muted/90 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            Día {day.day_index}: {day.name || `Día ${day.day_index}`}
                          </p>
                          {isNext ? (
                            <Badge className="mt-1 bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/20">
                              Siguiente sesión
                            </Badge>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-[#F44C40] hover:bg-[#F44C40]/10 border border-[#F44C40]/40"
                            style={{ borderWidth: 'thin' }}
                            title="Abrir día de entrenamiento"
                            onClick={(e) => { e.stopPropagation(); onOpenDay(day.id); }}
                          >
                            <Dumbbell className="h-4 w-4" />
                          </Button>
                          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', isOpen ? 'rotate-180' : 'rotate-0')} />
                        </div>
                      </button>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="px-3 pb-3 space-y-2">
                        {dayBlocks.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Sin bloques configurados.</p>
                        ) : (
                          dayBlocks.flatMap((block) => {
                            const exercises = blockExercisesByBlockId.get(block.id) || [];
                            return exercises.map((item) => {
                              exOrder += 1;
                              const currentOrder = exOrder;
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => onOpenDay(day.id)}
                                  className="w-full text-left flex items-center gap-3 p-3 rounded-xl border border-border/80 bg-card/80 hover:border-border hover:bg-muted/20 active:scale-[0.99] transition-all"
                                >
                                  <div
                                    className={cn(
                                      'flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold',
                                      item.is_key_exercise ? 'text-[#F44C40]' : 'bg-muted text-muted-foreground'
                                    )}
                                    style={item.is_key_exercise ? { background: '#F44C4015' } : {}}
                                  >
                                    {item.is_key_exercise ? <Star className="w-3.5 h-3.5" /> : currentOrder}
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="text-xs font-semibold text-foreground truncate">
                                        {exerciseMap.get(String(item.exercise_id)) || `Ejercicio ${item.exercise_id}`}
                                      </p>
                                      {item.is_key_exercise ? (
                                        <Badge
                                          className="text-[10px] px-1.5 py-0 h-4 rounded-full hover:bg-[#F44C40]/15"
                                          style={{ background: '#F44C4015', color: '#F44C40', border: '1px solid #F44C4030' }}
                                        >
                                          Principal
                                        </Badge>
                                      ) : null}
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap text-[11px] text-muted-foreground">
                                      <span>{item.target_sets || 0} × {item.target_reps_min || 0}–{item.target_reps_max || 0} reps</span>
                                      {item.preferred_equipment_id ? (
                                        <span className="text-muted-foreground/60">· {equipmentMap.get(String(item.preferred_equipment_id)) || 'Equipamiento'}</span>
                                      ) : null}
                                    </div>
                                  </div>

                                  <ChevronRight className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
                                </button>
                              );
                            });
                          })
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TrainingWeeklyRoutineSection;
