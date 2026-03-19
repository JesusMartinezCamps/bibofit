import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Apple, Dumbbell, Scale, Leaf, PlusCircle, Bell, Eye, EyeOff } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { format, isSameDay, startOfWeek, endOfWeek, eachDayOfInterval, addDays, isWithinInterval, parseISO, add, sub } from 'date-fns';
import ReminderFormDialog from '@/components/admin/reminders/ReminderFormDialog';
import { isStaffRole } from '@/lib/roles';
import { readBooleanViewPreference, UI_VIEW_PREFERENCE_KEYS, writeBooleanViewPreference } from '@/lib/uiViewPreferences';

const capitalize = (value) => value ? value.charAt(0).toUpperCase() + value.slice(1) : 0;

const SharedCalendar = ({ userId: propUserId, onRemindersChanged, refreshTrigger, enableViewToggle = false }) => {
  const { user: authUser } = useAuth();
  // Ensure we have a userId, preferring the prop but falling back to the authenticated user
  const userId = propUserId || authUser?.id;
  
  const isClientView = !propUserId || propUserId === authUser?.id;
  const isManagerView = isStaffRole(authUser?.role) && !isClientView;

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [events, setEvents] = useState({});
  const [reminders, setReminders] = useState([]);
  const [totalMealSlots, setTotalMealSlots] = useState(0);
  const [isReminderFormOpen, setIsReminderFormOpen] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState(null);
  const [newReminderPrefill, setNewReminderPrefill] = useState(null);
  const [activeReminderTooltipId, setActiveReminderTooltipId] = useState(null);
  const [isMiniView, setIsMiniView] = useState(() =>
    readBooleanViewPreference(UI_VIEW_PREFERENCE_KEYS.DASHBOARD_CALENDAR_MINI, true)
  );
  const [miniEventCountsByDate, setMiniEventCountsByDate] = useState({});

  const { toast } = useToast();
  const navigate = useNavigate();

  const firstDayOfMonth = useMemo(() => new Date(currentDate.getFullYear(), currentDate.getMonth(), 1), [currentDate]);
  const lastDayOfMonth = useMemo(() => new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0), [currentDate]);

  // ---------- FETCH ----------
  const fetchEventsAndReminders = useCallback(async () => {
    if (!userId) return;

    try {
      // Fetch active plan with limit(1) to avoid PGRST116 error if duplicate active plans exist
      const { data: activePlan } = await supabase
        .from('diet_plans')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      const [workoutsRes, weightLogsRes, advisoriesRes, snackLogsRes, remindersRes] = await Promise.all([
        supabase.from('workouts').select('performed_on, routines(focus)').eq('user_id', userId),
        supabase.from('weight_logs').select('logged_on, weight_kg').eq('user_id', userId),
        supabase.from('advisories').select('assigned_date, item_type, item_name').eq('user_id', userId),
        supabase.from('daily_snack_logs').select('log_date').eq('user_id', userId),
        isManagerView ? supabase.from('reminders').select('*').eq('user_id', userId).eq('type', 'event') : Promise.resolve({ data: [] })
      ]);

      const formattedEvents = {};
      const countsByDate = {};
      const incrementMiniCount = (date, type, amount = 1) => {
        if (!date || !type || amount <= 0) return;
        const key = format(parseISO(date), 'yyyy-MM-dd');
        if (!countsByDate[key]) {
          countsByDate[key] = { meal: 0, snack: 0, weight: 0 };
        }
        countsByDate[key][type] = (countsByDate[key][type] || 0) + amount;
      };

      const addEvent = (date, event) => {
        if (!date) return;
        const key = format(parseISO(date), 'yyyy-MM-dd');
        if (!formattedEvents[key]) formattedEvents[key] = [];
        
        const existingIdx = formattedEvents[key].findIndex(e => e.type === event.type);
        
        // Update diet log if exists, otherwise add new event
        if (event.type === 'diet_log' && existingIdx !== -1) {
            formattedEvents[key][existingIdx] = { ...formattedEvents[key][existingIdx], ...event };
        } else if (existingIdx === -1 || event.type !== 'diet_log') {
            formattedEvents[key].push(event);
        }
      };

      if (advisoriesRes.data) advisoriesRes.data.forEach(a => addEvent(a.assigned_date, { title: a.item_name, type: a.item_type }));
      if (workoutsRes.data) workoutsRes.data.forEach(w => addEvent(w.performed_on, { title: w.routines?.focus, type: 'workout' }));
      if (weightLogsRes.data) weightLogsRes.data.forEach(l => {
        addEvent(l.logged_on, { title: `${l.weight_kg} kg`, type: 'weight' });
        incrementMiniCount(l.logged_on, 'weight');
      });

      // Diet plan slots + logs
      let totalSlots = 0;
      if (activePlan?.id) {
        const { data: mealSlots, count } = await supabase
          .from('user_day_meals')
          .select('id', { count: 'exact' })
          .eq('user_id', userId)
          .eq('diet_plan_id', activePlan.id);

        const ids = mealSlots?.map(s => s.id) || [];
        totalSlots = count || 0;
        setTotalMealSlots(totalSlots);

        if (ids.length > 0) {
          const { data: mealLogsData } = await supabase
            .from('daily_meal_logs')
            .select('log_date, user_day_meal_id')
            .eq('user_id', userId)
            .in('user_day_meal_id', ids);

          const mealCount = {};
          mealLogsData?.forEach(l => mealCount[l.log_date] = (mealCount[l.log_date] || 0) + 1);

          Object.entries(mealCount).forEach(([date, count]) => {
            addEvent(date, { title: `${count}/${totalSlots}`, type: 'diet_log' });
            incrementMiniCount(date, 'meal', Number(count) || 0);
          });
        }
      } else {
        setTotalMealSlots(0);
      }

      // Snacks - Add diet_log event for snacks even if no plan is assigned
      if (snackLogsRes.data) {
        snackLogsRes.data.forEach(log => {
          const key = format(parseISO(log.log_date), 'yyyy-MM-dd');
          const exist = formattedEvents[key]?.find(e => e.type === 'diet_log');
          if (exist) {
              exist.hasSnack = true;
          } else {
              addEvent(log.log_date, { title: `0/${totalSlots}`, type: 'diet_log', hasSnack: true });
          }
          incrementMiniCount(log.log_date, 'snack');
        });
      }

      setEvents(formattedEvents);
      setMiniEventCountsByDate(countsByDate);
      setReminders(remindersRes?.data || []);

    } catch (err) {
      console.error("Error fetching calendar events:", err);
      // Suppress visible error toast to avoid alarming user for transient issues, 
      // as the calendar should at least render the grid.
    }
  }, [userId, isManagerView]);

  const handleRemindersUpdate = useCallback(async () => {
    setIsReminderFormOpen(false);
    setSelectedReminder(null);
    setNewReminderPrefill(null);
    setActiveReminderTooltipId(null);
    await fetchEventsAndReminders();
    if (onRemindersChanged) {
      onRemindersChanged();
    }
  }, [fetchEventsAndReminders, onRemindersChanged]);


  useEffect(() => {
    fetchEventsAndReminders();
  }, [fetchEventsAndReminders, currentDate, refreshTrigger]);

  useEffect(() => {
    writeBooleanViewPreference(UI_VIEW_PREFERENCE_KEYS.DASHBOARD_CALENDAR_MINI, isMiniView);
  }, [isMiniView]);

  // ---------- CALENDAR DAYS ----------
  const calendarDays = useMemo(() => {
    const start = startOfWeek(firstDayOfMonth, { weekStartsOn: 1 });
    const end = endOfWeek(lastDayOfMonth, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start, end });

    if (days.length < 42) {
      const next = addDays(days[days.length - 1], 1);
      const end2 = endOfWeek(next, { weekStartsOn: 1 });
      days.push(...eachDayOfInterval({ start: next, end: end2 }));
    }

    return days;
  }, [firstDayOfMonth, lastDayOfMonth]);

  const eventIcons = {
    workout: <Dumbbell className="w-3 h-3 text-red-400 mr-1" />,
    weight: <Scale className="w-3 h-3 text-purple-400 mr-1" />,
    diet_log: <Leaf className="w-3 h-3 text-green-400 mr-1" />
  };

  const handleDateClick = (day) => {
    if (isClientView) {
      navigate(`/plan?date=${format(day, 'yyyy-MM-dd')}`);
      return;
    }
    setSelectedDate(new Date(day));
    setIsModalOpen(true);
  };

  const handleOpenNewReminder = () => {
    setIsModalOpen(false);
    setNewReminderPrefill({ startDate: selectedDate });
    setSelectedReminder(null);
    setIsReminderFormOpen(true);
  };

  const today = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }, []);

  // ---------- RENDER ----------
  return (
<>
{/* TOOLTIP PROVIDER */}
<TooltipProvider>

<div className={cn("w-full h-full flex flex-col", isClientView && "sm:p-6 sm:bg-card/75 sm:border sm:border-border sm:rounded-2xl")}>

  {/* HEADER */}
  <div className="flex items-center justify-between mb-4">
    <div className="pl-4 flex items-center gap-2">
      <h2 className="text-3xl font-bold bg-gradient-to-r from-emerald-700 to-emerald-500 dark:from-white dark:to-green-300 bg-clip-text text-transparent">
        {capitalize(currentDate.toLocaleString("es-ES", { month: "long" }))} {currentDate.getFullYear()}
      </h2>
      {enableViewToggle && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-emerald-500 dark:text-green-300 hover:text-emerald-600 dark:hover:text-green-200 transition-colors"
          aria-label={isMiniView ? 'Cambiar a calendario enriquecido' : 'Cambiar a calendario mini'}
          aria-pressed={isMiniView}
          onClick={() => setIsMiniView((prev) => !prev)}
        >
          <span className="relative h-5 w-5">
            <Eye
              className={cn(
                "absolute inset-0 h-5 w-5 transition-all duration-300 ease-in-out",
                isMiniView ? "opacity-0 scale-75 -rotate-6" : "opacity-100 scale-100 rotate-0"
              )}
            />
            <EyeOff
              className={cn(
                "absolute inset-0 h-5 w-5 transition-all duration-300 ease-in-out",
                isMiniView ? "opacity-100 scale-100 rotate-0" : "opacity-0 scale-75 rotate-6"
              )}
            />
          </span>
        </Button>
      )}
    </div>
    <div className="flex space-x-2">
      <Button variant="ghost" size="icon" onClick={() => setCurrentDate(add(currentDate, { months: -1 }))}>
        <ChevronLeft />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => setCurrentDate(add(currentDate, { months: 1 }))}>
        <ChevronRight />
      </Button>
    </div>
  </div>

  {/* WEEK HEADER */}
  <div className="grid grid-cols-7 text-center text-muted-foreground mb-2">
    {["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"].map(d => <div key={d}>{d}</div>)}
  </div>

  {/* CALENDAR GRID */}
  <div className="grid grid-cols-7 flex-grow">
    {calendarDays.map((day) => {
      const dateString = format(day, 'yyyy-MM-dd');
      const dayEvents = events[dateString] || [];
      const dayReminders = reminders.filter(r => {
        const start = parseISO(r.start_date);
        const end = r.end_date ? parseISO(r.end_date) : start;
        return isWithinInterval(day, { start, end });
      });

      const isToday = isSameDay(day, new Date());
      const isCurrentMonth = day.getMonth() === currentDate.getMonth();
      const dayMiniCounts = miniEventCountsByDate[dateString] || { meal: 0, snack: 0, weight: 0 };
      const weightMiniDots = Array.from({ length: dayMiniCounts.weight }, (_, idx) => ({
        key: `weight-${dateString}-${idx}`,
        className: 'bg-violet-400',
        title: 'Registro de peso',
      }));
      const snackMiniDots = Array.from({ length: dayMiniCounts.snack }, (_, idx) => ({
        key: `snack-${dateString}-${idx}`,
        className: 'bg-orange-400',
        title: 'Picoteo registrado',
      }));
      const mealMiniDots = Array.from({ length: dayMiniCounts.meal }, (_, idx) => ({
        key: `meal-${dateString}-${idx}`,
        className: 'bg-green-400',
        title: 'Receta marcada como comida',
      }));

      return (
      <div
        key={day.toString()}
        className={cn(
          "border border-border/80 relative cursor-pointer min-h-[114px] flex flex-col transition-colors",
          isCurrentMonth ? "bg-card/50 hover:bg-muted/55" : "bg-muted/35 hover:bg-muted/45"
        )}
        onClick={() => handleDateClick(day)}
      >
          {/* ---------- DAY NUMBER + REMINDER ICONS (CODex STYLE) ---------- */}
          <div className="relative flex items-start justify-end mb-1 min-h-6">

            {/* Number */}
            <span
              className={cn(
                "absolute left-1/2 -translate-x-1/2 text-sm w-6 h-6 flex items-center justify-center rounded-full",
                !isCurrentMonth && "text-muted-foreground/70",
                isCurrentMonth && isToday && "bg-green-400/20 text-green-400 border border-green-400/20",
                isCurrentMonth && !isToday && "text-foreground"
              )}
            >
              {format(day, "d")}
            </span>


            {/* Reminder Chips */}
            {isManagerView && dayReminders.length > 0 && (
              <div className="flex space-x-1 ml-1">
                {dayReminders.map(rem => {
                  const formattedCategory = rem.category
                    ? rem.category
                      .split(',')
                      .map((cat) => cat.trim())
                      .filter(Boolean)
                      .join(', ')
                    : null;
                  const referenceDate = rem.end_date ? parseISO(rem.end_date) : parseISO(rem.start_date);
                  const normalizedReference = new Date(referenceDate);
                  normalizedReference.setHours(0, 0, 0, 0);
                  const isPastReminder = normalizedReference < today;
                  const active = activeReminderTooltipId === rem.id;
                  return (
                    <Tooltip
                      key={rem.id}
                      open={active}
                      onOpenChange={(open) => {
                        setActiveReminderTooltipId(open ? rem.id : null);
                      }}
                    >
                      <TooltipTrigger asChild>
                        <motion.button
                          type="button"
                          className={cn(
                            "inline-flex items-center justify-center rounded-full border",
                            isPastReminder
                              ? "border-border/70 bg-muted/80 hover:bg-muted"
                              : "border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25",
                            "p-[2px] sm:p-[3px]"
                          )}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.15 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveReminderTooltipId(prev => prev === rem.id ? null : rem.id);
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setActiveReminderTooltipId(null);
                            setSelectedReminder(rem);
                            setIsReminderFormOpen(true);
                          }}
                        >
                       <Bell className={cn("w-3 h-3", isPastReminder ? "text-muted-foreground" : "text-amber-700 dark:text-amber-300")} />
                              </motion.button>
                      </TooltipTrigger>

                      {/* ---- Tooltip Content with DETAILS ---- */}
                          <TooltipContent
                              className={cn(
                                  "bg-popover text-popover-foreground max-w-sm p-3 space-y-2",
                                  isPastReminder ? "border-border" : "border-amber-500/45"
                              )}
                          >
                              <p className={cn("font-bold", isPastReminder ? "text-foreground" : "text-amber-700 dark:text-amber-300")}>{rem.title}</p>
                              <p className={cn("text-sm leading-snug", isPastReminder && "text-muted-foreground")}>{rem.content}</p>

                              <div
                                  className={cn(
                                      "text-xs space-y-1 pt-2 border-t",
                                      isPastReminder
                                          ? "text-muted-foreground border-border"
                                          : "text-amber-800/85 dark:text-amber-200/90 border-amber-500/25"
                                  )}
                              >
                          <p className="uppercase tracking-wider opacity-80">Detalles:</p>
                          <p>Fecha inicio: {format(parseISO(rem.start_date), 'dd/MM/yyyy')}</p>
                          {rem.end_date && <p>Fecha fin: {format(parseISO(rem.end_date), 'dd/MM/yyyy')}</p>}
                          {rem.time && <p>Hora: {rem.time}</p>}
                          {rem.priority && <p>Prioridad: {rem.priority}</p>}
                          {formattedCategory && <p>Categoría: {formattedCategory}</p>}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            )}

          </div>

          {/* ---------- EVENT CHIPS (workout, diet_log, weight) ---------- */}
          <div
            className={cn(
              "overflow-hidden transition-all duration-300 ease-in-out",
              isMiniView ? "max-h-0 opacity-0" : "max-h-40 opacity-100"
            )}
          >
            <div className="space-y-1">
              {dayEvents.map((event, index) => {
                const chipKey = `${event.type}-${index}`;
                let style = {};
                let classes = "";

                if (event.type === 'diet_log') {
                  const [done, total] = event.title.split('/').map(Number);
                  let fromColor = 'hsl(var(--muted))';
                  let textColor = 'hsl(var(--foreground))';
                  if (done === total && total > 0) {
                    fromColor = 'hsl(145 63% 30% / 0.9)';
                    textColor = 'hsl(0 0% 98%)';
                  } else if (done >= total / 2 && total > 0) {
                    fromColor = 'hsl(145 48% 40% / 0.45)';
                  }

                  if (event.hasSnack) {
                    style.background = `linear-gradient(to right, ${fromColor}, hsl(41 95% 52% / 0.32))`;
                    classes = 'border-green-700/60 dark:border-green-500/60';
                  } else {
                    style.backgroundColor = fromColor;
                    classes = 'border-green-700/60 dark:border-green-500/60';
                  }

                  style.color = textColor;
                }

                return (
                  <motion.div
                    key={chipKey}
                    className={cn(
                      "event-chip pt-0 flex items-center justify-center text-[11px] sm:text-xs truncate pointer-events-none sm:pointer-events-auto",
                      event.type === 'workout' && "bg-red-500/15 text-red-700 dark:text-red-200 border border-red-500/35",
                      event.type === 'weight' && "bg-purple-500/15 text-purple-700 dark:text-purple-200 border border-purple-500/35",
                      event.type === 'diet_log' && `border ${classes}`
                    )}
                    style={event.type === 'diet_log' ? style : {}}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={(e) => {
                      if (typeof window !== 'undefined' && window.innerWidth < 640) return;
                      e.stopPropagation();
                      if (event.type === 'weight') {
                        navigate(`/registro-peso?date=${dateString}&userId=${userId}`);
                        return;
                      }
                      if (event.type === 'diet_log') {
                        const path = isClientView
                          ? `/plan/dieta/${dateString}`
                          : `/plan/dieta/${userId}/${dateString}`;
                        navigate(path);
                      }
                    }}
                  >
                    <div className="hidden sm:flex">{eventIcons[event.type]}</div>
                    {event.title}
                  </motion.div>
                );
              })}
            </div>
          </div>

          <div
            className={cn(
              "overflow-hidden transition-all duration-300 ease-in-out",
              isMiniView ? "max-h-32 opacity-100" : "max-h-0 opacity-0"
            )}
          >
            <div className="mt-0 min-h-[52px] px-1 flex flex-col justify-start gap-1.5">
              <div className="flex flex-wrap justify-center gap-1 min-h-[8px]">
                {weightMiniDots.map((dot) => (
                  <div
                    key={dot.key}
                    className={cn('w-2 h-2 rounded-full', dot.className)}
                    title={dot.title}
                  />
                ))}
              </div>
              <div className="flex flex-wrap justify-center gap-1 min-h-[8px]">
                {snackMiniDots.map((dot) => (
                  <div
                    key={dot.key}
                    className={cn('w-2 h-2 rounded-full', dot.className)}
                    title={dot.title}
                  />
                ))}
              </div>
              <div className="flex flex-wrap justify-center gap-1 min-h-[8px]">
                {mealMiniDots.map((dot) => (
                  <div
                    key={dot.key}
                    className={cn('w-2 h-2 rounded-full', dot.className)}
                    title={dot.title}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    })}
  </div>
</div>

{/* MODALS */}
<Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
  <DialogContent className="bg-card border-border max-w-lg">
    <DialogHeader>
      <DialogTitle className="bg-gradient-to-r from-emerald-700 to-emerald-500 dark:from-white dark:to-green-300 bg-clip-text text-transparent">
        {!isClientView ? '¿Qué quieres gestionar?' : '¿Qué quieres ver?'}
      </DialogTitle>
      <DialogDescription className="text-muted-foreground">
        {selectedDate?.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      </DialogDescription>
    </DialogHeader>

    <div className="flex flex-col space-y-5 pt-4">
      <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
        <Button
          onClick={() => navigate(
            isClientView
              ? `/plan/dieta/${format(selectedDate, 'yyyy-MM-dd')}`
              : `/plan/dieta/${userId}/${format(selectedDate, 'yyyy-MM-dd')}`
          )}
          variant="outline-diet"
          className="flex-grow bg-green-900/15 dark:bg-green-800/20 dark:text-green-400 btn-standard"
        >
          <Apple className="w-6 h-6 mr-2" />Plan de Dieta
        </Button>

        <Button
          onClick={() => navigate(!isClientView ? `/admin/manage-training/${userId}` : '/plan/entreno')}
          variant="outline-training"
          className="flex-grow bg-red-900/15 dark:bg-red-800/20 dark:text-red-400"
        >
          <Dumbbell className="w-6 h-6 mr-2" />Plan de Entreno
        </Button>
      </div>

      <Button
        onClick={() => {
          setIsModalOpen(false);
          navigate(`/registro-peso?date=${format(selectedDate, 'yyyy-MM-dd')}&userId=${userId}`);
        }}
        variant="outline-weight"
        className="bg-purple-900/15 dark:bg-purple-800/20 dark:text-purple-400"
      >
        {!isClientView ? 'Añadirle un Registro de Peso' : 'Añadir Registro de Peso'}
      </Button>

      {isManagerView && (
        <Button
          onClick={handleOpenNewReminder}
          variant="outline-reminder"
          className="bg-orange-900/15 dark:bg-orange-800/20 dark:text-amber-400"
        >
          <PlusCircle className="w-6 h-6 mr-2" />Añadir Recordatorio
        </Button>
      )}
    </div>
  </DialogContent>
</Dialog>


{isManagerView && (
  <ReminderFormDialog
    isOpen={isReminderFormOpen}
    onOpenChange={setIsReminderFormOpen}
    onSave={handleRemindersUpdate}
    reminder={selectedReminder}
    userId={userId}
    newReminderPrefill={newReminderPrefill}
  />
)}

</TooltipProvider>
</>
  );
};

export default SharedCalendar;
