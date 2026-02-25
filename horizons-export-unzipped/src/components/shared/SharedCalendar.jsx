import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Apple, Dumbbell, Scale, Leaf, PlusCircle, Bell } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import WeightLogDialog from '@/components/shared/WeightLogDialog';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { format, isSameDay, startOfWeek, endOfWeek, eachDayOfInterval, addDays, isWithinInterval, parseISO, add, sub } from 'date-fns';
import ReminderFormDialog from '@/components/admin/reminders/ReminderFormDialog';

const capitalize = (value) => value ? value.charAt(0).toUpperCase() + value.slice(1) : 0;

const SharedCalendar = ({ userId: propUserId, onRemindersChanged, refreshTrigger }) => {
  const { user: authUser } = useAuth();
  // Ensure we have a userId, preferring the prop but falling back to the authenticated user
  const userId = propUserId || authUser?.id;
  
  const isClientView = !propUserId || propUserId === authUser?.id;
  const isManagerView = (authUser?.role === 'admin' || authUser?.role === 'coach') && !isClientView;

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isWeightLogOpen, setIsWeightLogOpen] = useState(false);
  const [selectedWeightDate, setSelectedWeightDate] = useState(null);
  const [events, setEvents] = useState({});
  const [reminders, setReminders] = useState([]);
  const [totalMealSlots, setTotalMealSlots] = useState(0);
  const [isReminderFormOpen, setIsReminderFormOpen] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState(null);
  const [newReminderPrefill, setNewReminderPrefill] = useState(null);
  const [activeReminderTooltipId, setActiveReminderTooltipId] = useState(null);

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
      if (weightLogsRes.data) weightLogsRes.data.forEach(l => addEvent(l.logged_on, { title: `${l.weight_kg} kg`, type: 'weight' }));

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

          Object.entries(mealCount).forEach(([date, count]) =>
            addEvent(date, { title: `${count}/${totalSlots}`, type: 'diet_log' })
          );
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
        });
      }

      setEvents(formattedEvents);
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

<div className={cn("w-full h-full flex flex-col", isClientView && "sm:p-6 sm:bg-[#1a1e23] sm:rounded-2xl")}>

  {/* HEADER */}
  <div className="flex items-center justify-between mb-4">
    <h2 className="pl-4 text-3xl font-bold bg-gradient-to-r from-white to-green-400 bg-clip-text text-transparent">
      {capitalize(currentDate.toLocaleString("es-ES", { month: "long" }))} {currentDate.getFullYear()}
    </h2>
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
  <div className="grid grid-cols-7 text-center text-gray-400 mb-2">
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

      const dayNumberClasses = cn(
        "text-sm",
        !isCurrentMonth && "text-gray-600",
        isCurrentMonth && isToday && "text-green-400 font-bold"
      );

      return (
      <div
        key={day.toString()}
        className="border border-gray-800 relative cursor-pointer hover:bg-[#2a2f36] min-h-[114px] flex flex-col"
        style={!isCurrentMonth ? { backgroundColor: 'rgb(38 43 51)' } : {}}
        onClick={() => handleDateClick(day)}
      >
          {/* ---------- DAY NUMBER + REMINDER ICONS (CODex STYLE) ---------- */}
          <div className="flex items-start justify-between mb-1">

            {/* Number */}
            <span
              className={cn(
                "text-sm w-6 h-6 flex items-center justify-center rounded-full",
                !isCurrentMonth && "text-gray-600",
                isCurrentMonth && isToday && "bg-green-400/20 text-green-400 border border-green-400/20",
                isCurrentMonth && !isToday && "text-white"
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
                              ? "border-slate-500/50 bg-slate-700/40 hover:bg-slate-700/60"
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
                       <Bell className={cn("w-3 h-3", isPastReminder ? "text-slate-300" : "text-amber-300")} />
                              </motion.button>
                      </TooltipTrigger>

                      {/* ---- Tooltip Content with DETAILS ---- */}
                          <TooltipContent
                              className={cn(
                                  "bg-slate-800 text-white max-w-sm p-3 space-y-2",
                                  isPastReminder ? "border-slate-500" : "border-amber-400"
                              )}
                          >
                              <p className={cn("font-bold", isPastReminder ? "text-slate-200" : "text-amber-300")}>{rem.title}</p>
                              <p className={cn("text-sm leading-snug", isPastReminder && "text-slate-300")}>{rem.content}</p>

                              <div
                                  className={cn(
                                      "text-xs space-y-1 pt-2 border-t",
                                      isPastReminder
                                          ? "text-slate-300 border-slate-500/30"
                                          : "text-amber-200/90 border-amber-500/20"
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
          <div className="space-y-1">
            {dayEvents.map((event, index) => {
              const chipKey = `${event.type}-${index}`;
              let style = {};
              let classes = "";

              if (event.type === 'diet_log') {
                const [done, total] = event.title.split('/').map(Number);
                let fromColor = 'rgb(34 197 94 / 5%)';
                if (done === total && total > 0) fromColor = 'rgb(9 147 60 / 82%)';
                else if (done >= total / 2 && total > 0) fromColor = 'rgb(34 197 94 / 20%)';

                if (event.hasSnack) {
                  style.background = `linear-gradient(to right, ${fromColor}, rgb(255 202 0 / 29%))`;
                  classes = 'border-green-600';
                } else {
                  style.backgroundColor = fromColor;
                  classes = 'border-green-600';
                }

                style.color = 'white';
              }

              return (
                <motion.div
                  key={chipKey}
                  className={cn(
                    "event-chip flex items-center justify-center text-[11px] sm:text-xs truncate",
                    event.type === 'workout' && "bg-red-500/20 text-red-200 border border-red-500/40",
                    event.type === 'weight' && "bg-purple-500/20 text-purple-200 border border-purple-500/40",
                    event.type === 'diet_log' && `border ${classes}`
                  )}
                  style={event.type === 'diet_log' ? style : {}}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (event.type === 'weight') {
                      setSelectedWeightDate(day);
                      setIsWeightLogOpen(true);
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
      );
    })}
  </div>
</div>

{/* MODALS */}
<Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
  <DialogContent className="text-white border-gray-700 max-w-lg">
    <DialogHeader>
      <DialogTitle className="bg-gradient-to-r from-white to-green-400 bg-clip-text text-transparent">
        {!isClientView ? '¿Qué quieres gestionar?' : '¿Qué quieres ver?'}
      </DialogTitle>
      <DialogDescription className="text-gray-300">
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
          className="flex-grow"
        >
          <Apple className="w-6 h-6 mr-2" />Plan de Dieta
        </Button>

        <Button
          onClick={() => navigate(!isClientView ? `/admin/manage-training/${userId}` : '/plan/entreno')}
          variant="outline-training"
          className="flex-grow"
        >
          <Dumbbell className="w-6 h-6 mr-2" />Plan de Entreno
        </Button>
      </div>

      <Button
        onClick={() => {
          setIsModalOpen(false);
          setSelectedWeightDate(selectedDate);
          setIsWeightLogOpen(true);
        }}
        variant="outline-weight"
      >
        {!isClientView ? 'Añadirle un Registro de Peso' : 'Añadir Registro de Peso'}
      </Button>

      {isManagerView && (
        <Button
          onClick={handleOpenNewReminder}
          variant="outline-reminder"
        >
          <PlusCircle className="w-6 h-6 mr-2" />Añadir Recordatorio
        </Button>
      )}
    </div>
  </DialogContent>
</Dialog>

<WeightLogDialog
  open={isWeightLogOpen}
  onOpenChange={setIsWeightLogOpen}
  onLogAdded={fetchEventsAndReminders}
  initialDate={selectedWeightDate}
  userId={userId}
/>

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