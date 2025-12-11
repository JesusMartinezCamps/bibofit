import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Apple, Dumbbell, Scale, Leaf, PlusCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import WeightLogDialog from '@/components/shared/WeightLogDialog';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { format, isSameDay, startOfWeek, endOfWeek, eachDayOfInterval, addDays, isWithinInterval, parseISO, add, sub } from 'date-fns';
import ReminderFormDialog from '@/components/admin/reminders/ReminderFormDialog';

const SharedCalendar = ({ userId: propUserId }) => {
  const { user: authUser } = useAuth();
  // Determine the target user ID: specific prop if provided (Coach/Admin view), otherwise authenticated user (Client view)
  const userId = propUserId || authUser?.id;
  const isClientView = !propUserId || propUserId === authUser?.id;
  
  // Allow Admin OR Coach to have manager view for OTHER users
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

  const { toast } = useToast();
  const navigate = useNavigate();

  const firstDayOfMonth = useMemo(() => new Date(currentDate.getFullYear(), currentDate.getMonth(), 1), [currentDate]);
  const lastDayOfMonth = useMemo(() => new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0), [currentDate]);

  // Calendar Data Organization Logic
  const fetchEventsAndReminders = useCallback(async () => {
    if (!userId) return;

    const viewStartDate = sub(firstDayOfMonth, { days: 7 });
    const viewEndDate = add(lastDayOfMonth, { days: 7 });

    try {
      // Fetch all required data in parallel
      const promises = [
        supabase.from('workouts').select('performed_on, routines(focus)').eq('user_id', userId).gte('performed_on', format(viewStartDate, 'yyyy-MM-dd')).lte('performed_on', format(viewEndDate, 'yyyy-MM-dd')),
        supabase.from('weight_logs').select('logged_on, weight_kg').eq('user_id', userId).gte('logged_on', format(viewStartDate, 'yyyy-MM-dd')).lte('logged_on', format(viewEndDate, 'yyyy-MM-dd')),
        supabase.from('advisories').select('assigned_date, item_type, item_name').eq('user_id', userId).gte('assigned_date', format(viewStartDate, 'yyyy-MM-dd')).lte('assigned_date', format(viewEndDate, 'yyyy-MM-dd')),
        supabase.from('daily_meal_logs').select('log_date, diet_plan_recipe_id, free_recipe_occurrence_id').eq('user_id', userId).gte('log_date', format(viewStartDate, 'yyyy-MM-dd')).lte('log_date', format(viewEndDate, 'yyyy-MM-dd')),
        supabase.from('daily_snack_logs').select('log_date').eq('user_id', userId).gte('log_date', format(viewStartDate, 'yyyy-MM-dd')).lte('log_date', format(viewEndDate, 'yyyy-MM-dd')),
        supabase.from('user_day_meals').select('id', { count: 'exact' }).eq('user_id', userId)
      ];

      if (isManagerView) {
        promises.push(
          supabase.from('reminders').select('*').eq('user_id', userId).eq('type', 'event')
        );
      }

      const results = await Promise.all(promises);
      const [workoutsRes, weightLogsRes, advisoriesRes, mealLogsRes, snackLogsRes, mealSlotsRes, remindersRes] = results;

      if (workoutsRes.error) console.error("Error fetching workouts:", workoutsRes.error);
      if (weightLogsRes.error) console.error("Error fetching weight logs:", weightLogsRes.error);
      if (mealLogsRes.error) console.error("Error fetching meal logs:", mealLogsRes.error);

      setTotalMealSlots(mealSlotsRes.count || 0);

      // Data is aggregated into an object keyed by date strings
      const formattedEvents = {};
      const addEvent = (date, event) => {
        if (!date) return;
        const dateString = format(parseISO(date), 'yyyy-MM-dd');
        if (!formattedEvents[dateString]) formattedEvents[dateString] = [];
        const existingEventIndex = formattedEvents[dateString].findIndex(e => e.type === event.type);
        if (existingEventIndex === -1) {
          formattedEvents[dateString].push(event);
        } else if (event.type === 'diet_log') {
          formattedEvents[dateString][existingEventIndex] = {
            ...formattedEvents[dateString][existingEventIndex],
            ...event
          };
        }
      };

      if (advisoriesRes.data) advisoriesRes.data.forEach(a => addEvent(a.assigned_date, { title: a.item_name || 'Asesoría', type: a.item_type }));
      if (workoutsRes.data) workoutsRes.data.forEach(w => addEvent(w.performed_on, { title: w.routines?.focus || 'Entreno', type: 'workout' }));


      const loggedMealCountByDate = {};

      if (mealLogsRes.data) {
        mealLogsRes.data.forEach(log => {
          if (log.log_date) {
            loggedMealCountByDate[log.log_date] = (loggedMealCountByDate[log.log_date] || 0) + 1;
          }
        });
      }
      Object.entries(loggedMealCountByDate).forEach(([date, count]) => {
        if (totalMealSlots > 0) {
          addEvent(date, { title: `${count}/${totalMealSlots}`, type: 'diet_log' });
        }
      });

      if (weightLogsRes.data) weightLogsRes.data.forEach(l => addEvent(l.logged_on, { title: `${l.weight_kg} kg`, type: 'weight' }));


      if (snackLogsRes.data) {
        snackLogsRes.data.forEach(log => {
          if (log.log_date) {
            const dateString = format(parseISO(log.log_date), 'yyyy-MM-dd');
            const existingDietLog = formattedEvents[dateString]?.find(e => e.type === 'diet_log');
            if (existingDietLog) {
              existingDietLog.hasSnack = true;
            } else {
              addEvent(log.log_date, { title: `0/${totalMealSlots}`, type: 'diet_log', hasSnack: true });
            }
          }
        });
      }

      setEvents(formattedEvents);

      if (remindersRes && remindersRes.data) {
        setReminders(remindersRes.data);
      } else {
          setReminders([]);
      }

    } catch (error) {
      console.error("Full fetch error:", error);
      toast({ title: "Error", description: "No se pudieron cargar los eventos del calendario.", variant: "destructive" });
    }
  }, [userId, firstDayOfMonth, lastDayOfMonth, toast, totalMealSlots, isManagerView]);

  useEffect(() => {
    fetchEventsAndReminders();
  }, [fetchEventsAndReminders, currentDate, userId]);

  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  const handleReminderSave = () => {
    setIsReminderFormOpen(false);
    setSelectedReminder(null);
    setNewReminderPrefill(null);
    fetchEventsAndReminders();
  };

  const calendarDays = useMemo(() => {
    const start = startOfWeek(firstDayOfMonth, { weekStartsOn: 1 });
    const end = endOfWeek(lastDayOfMonth, { weekStartsOn: 1 });

    const days = eachDayOfInterval({ start, end });
    if (days.length < 42) {
      const nextDay = addDays(days[days.length - 1], 1);
      const endOfNextWeek = endOfWeek(nextDay, { weekStartsOn: 1 });
      const additionalDays = eachDayOfInterval({ start: nextDay, end: endOfNextWeek });
      days.push(...additionalDays);
    }

    return days;
  }, [firstDayOfMonth, lastDayOfMonth]);

  const navigateMonth = (direction) => {
    setCurrentDate(current => add(current, { months: direction }));
  };

  const eventIcons = {
    workout: <Dumbbell className="w-3 h-3 md:w-3.5 md:h-3.5 mr-1 text-red-400 flex-shrink-0" />,
    weight: <Scale className="w-3 h-3 md:w-3.5 md:h-3.5 mr-1 text-purple-400 flex-shrink-0" />,
    diet_log: <Leaf className="w-3 h-3 md:w-3.5 md:h-3.5 mr-1 text-green-400 flex-shrink-0" />,
  };

  const handleDateClick = (day, event) => {
    if (!day || !event) return;
    const date = new Date(day);
    const dateString = format(date, 'yyyy-MM-dd');
    const dayReminders = reminders.filter(r => {
      const startDate = parseISO(r.start_date);
      const endDate = r.end_date ? parseISO(r.end_date) : startDate;
      return isWithinInterval(day, { start: startDate, end: endDate });
    });

    const dayEvents = events[dateString] || [];
    const weightEvent = dayEvents.find(e => e.type === 'weight');
    const dietEvent = dayEvents.find(e => e.type === 'diet_log');
    const targetIsEventChip = event.target.closest('.event-chip');

    if (targetIsEventChip) {
      if (weightEvent && event.target.closest('.event-chip-weight')) {
        setSelectedWeightDate(date);
        setIsWeightLogOpen(true);
        return;
      }
      if (dietEvent && event.target.closest('.event-chip-diet')) {
        navigate(isClientView ? `/plan/dieta/${dateString}` : `/plan/dieta/${userId}/${dateString}`);
        return;
      }
    }

    if (isManagerView && dayReminders.length > 0 && !targetIsEventChip) {
      setSelectedReminder(dayReminders[0]);
      setIsReminderFormOpen(true);
      return;
    }

    setSelectedDate(date);
    setIsModalOpen(true);
  };

  const handleOpenNewReminder = () => {
    setIsModalOpen(false);
    setNewReminderPrefill({ startDate: selectedDate });
    setSelectedReminder(null);
    setIsReminderFormOpen(true);
  };

  return (
    <TooltipProvider>
      <div className={cn("w-full h-full flex flex-col", isClientView && "sm:p-6 sm:bg-[#1a1e23] sm:rounded-2xl")}>
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="calendar-header">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-white to-green-400 bg-clip-text text-transparent">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h2>
            <div className="flex items-center space-x-3">
              <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)} className="text-gray-300 hover:text-white hover:bg-green-500/20 transition-all duration-200 rounded-full"><ChevronLeft className="w-6 h-6" /></Button>
              <Button variant="ghost" size="icon" onClick={() => navigateMonth(1)} className="text-gray-300 hover:text-white hover:bg-green-500/20 transition-all duration-200 rounded-full"><ChevronRight className="w-6 h-6" /></Button>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-7">{dayNames.map((day) => <div key={day} className="calendar-day-header">{day}</div>)}</div>
        <div className="calendar-grid flex-grow relative">
          {calendarDays.map((day) => {
            const dateString = format(day, 'yyyy-MM-dd');
            const dayEvents = events[dateString] || [];
            const dayReminders = reminders.filter(r => {
              const startDate = parseISO(r.start_date);
              const endDate = r.end_date ? parseISO(r.end_date) : startDate;
              return isWithinInterval(day, { start: startDate, end: endDate });
            });
            const hasReminder = isManagerView && dayReminders.length > 0;
            const isTodayFlag = isSameDay(day, new Date());
            const isCurrentMonth = day.getMonth() === currentDate.getMonth();

            const dayNumberClasses = cn('day-number',
              !isCurrentMonth && 'text-gray-600',
              isCurrentMonth && isTodayFlag && hasReminder && 'today-and-event',
              isCurrentMonth && isTodayFlag && !hasReminder && 'today',
              isCurrentMonth && !isTodayFlag && hasReminder && 'event-day',
            );

            return (
              <div
                key={day.toString()}
                className="calendar-cell"
                onClick={(e) => handleDateClick(day, e)}
                style={!isCurrentMonth ? { backgroundColor: 'rgb(38 43 51)' } : {}}
              >
                <div className="day-number-container">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className={dayNumberClasses}>{format(day, 'd')}</span>
                    </TooltipTrigger>
                    {hasReminder && (
                      <TooltipContent className="bg-slate-800 text-white border-amber-400 max-w-xs">
                        {dayReminders.map(r => (
                          <div key={r.id} className="p-2">
                            <p className="font-bold text-amber-400">{r.title}</p>
                            <p className="text-sm">{r.content}</p>
                          </div>
                        ))}
                      </TooltipContent>
                    )}
                  </Tooltip>
                </div>
                <div className="events-container">
                  {dayEvents.map((event, eventIndex) => {
                    let dietChipStyle = {};
                    let dietChipClasses = '';
                    if (event.type === 'diet_log') {
                      const [completed, total] = event.title ? event.title.split('/').map(Number) : [0, 0];
                      if (total > 0) {
                        const percentage = completed / total;
                        let fromColor = '';
                        if (percentage === 1) {
                          fromColor = 'rgb(9 147 60 / 82%)'; 
                        } else if (percentage >= 0.5) {
                          fromColor = 'rgb(34 197 94 / 20%)';
                        } else {
                          fromColor = 'rgb(34 197 94 / 5%)';
                        }

                        if (event.hasSnack) {
                          dietChipStyle.background = `linear-gradient(to right, ${fromColor}, rgb(255 202 0 / 29%))`;
                          dietChipClasses = 'border-green-600';
                        } else {
                          dietChipStyle.backgroundColor = fromColor;
                          dietChipClasses = 'border-green-600';
                        }
                        dietChipStyle.color = 'white';
                      } else if (event.hasSnack) {
                        dietChipStyle.background = `linear-gradient(to right, rgb(34 197 94 / 25%), rgb(255 191 0 / 47%))`;
                        dietChipClasses = 'border-green-600';
                      }
                    }
                    return (
                      <motion.div
                        key={eventIndex}
                        className={cn('event-chip justify-center',
                          (event.type === 'workout' || event.type === 'routine_template') && 'event-chip-workout',
                          (event.type === 'diet_log') && `event-chip-diet ${dietChipClasses}`,
                          (event.type === 'weight') && 'event-chip-weight bg-purple-500/20 text-purple-200 border-purple-500/40'
                        )}
                        style={event.type === 'diet_log' ? dietChipStyle : {}}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: eventIndex * 0.1 }}
                      >
                        <div className="hidden sm:flex items-center">{eventIcons[event.type]}</div>
                        <span className="truncate font-medium text-center text-[11px] sm:text-sm">{event.title}</span>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="calendar-dialog-content text-white border-gray-700 max-w-lg">
          <DialogHeader>
            <DialogTitle className="calendar-dialog-title text-center bg-gradient-to-r from-white to-green-400 bg-clip-text text-transparent">{!isClientView ? '¿Qué quieres gestionar?' : '¿Qué quieres ver?'}</DialogTitle>
            <DialogDescription className="calendar-dialog-description text-center text-gray-300">Selecciona una opción para el {selectedDate?.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col space-y-5 pt-4">
            <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-4">
              <Button type="button" onClick={() => navigate(isClientView ? `/plan/dieta/${format(selectedDate, 'yyyy-MM-dd')}` : `/plan/dieta/${userId}/${format(selectedDate, 'yyyy-MM-dd')}`)} variant="outline-diet" className="calendar-dialog-button flex-grow"><Apple className="w-6 h-6 mr-2" />Plan de Dieta</Button>
              <Button type="button" onClick={() => navigate(!isClientView ? `/admin/manage-training/${userId}` : '/plan/entreno')} variant="outline-training" className="calendar-dialog-button flex-grow"><Dumbbell className="w-6 h-6 mr-2" />Plan de Entreno</Button>
            </div>
            <Button type="button" onClick={() => { setIsModalOpen(false); setSelectedWeightDate(selectedDate); setIsWeightLogOpen(true); }} variant="outline-weight" className="calendar-dialog-button w-full">{!isClientView ? 'Añadirle un Registro de Peso' : 'Añadir Registro de Peso'}</Button>
            {isManagerView && <Button type="button" onClick={handleOpenNewReminder} variant="outline-reminder" className="calendar-dialog-button w-full"><PlusCircle className="w-6 h-6 mr-2" />Añadir Recordatorio</Button>}
          </div>
        </DialogContent>
      </Dialog>
      <WeightLogDialog open={isWeightLogOpen} onOpenChange={setIsWeightLogOpen} onLogAdded={fetchEventsAndReminders} initialDate={selectedWeightDate} userId={userId} />
      {isManagerView && <ReminderFormDialog isOpen={isReminderFormOpen} onOpenChange={setIsReminderFormOpen} onSave={handleReminderSave} reminder={selectedReminder} userId={userId} newReminderPrefill={newReminderPrefill} />}
    </TooltipProvider>
  );
};

export default SharedCalendar;