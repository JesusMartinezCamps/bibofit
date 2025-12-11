import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Flame, Apple, Scale, Dumbbell, UtensilsCrossed } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import WeightLogDialog from '@/components/shared/WeightLogDialog';
import FreeMealDialog from '@/components/plans/FreeMealDialog';

const AdminCalendar = ({ selectedUser }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState({});
  const [isWeightLogOpen, setIsWeightLogOpen] = useState(false);
  const [isFreeMealOpen, setIsFreeMealOpen] = useState(false);
  const [selectedDateForAction, setSelectedDateForAction] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();

  const firstDayOfMonth = useMemo(() => new Date(currentDate.getFullYear(), currentDate.getMonth(), 1), [currentDate]);
  const lastDayOfMonth = useMemo(() => new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0), [currentDate]);

  const fetchEvents = useCallback(async () => {
    if (!selectedUser) {
      setEvents({});
      return;
    }

    const startDate = firstDayOfMonth.toISOString().split('T')[0];
    const endDate = lastDayOfMonth.toISOString().split('T')[0];

    const [advisoriesRes, weightLogsRes] = await Promise.all([
      supabase
        .from('advisories')
        .select('assigned_date, item_type, item_name')
        .eq('user_id', selectedUser.user_id)
        .gte('assigned_date', startDate)
        .lte('assigned_date', endDate),
      supabase
        .from('weight_logs')
        .select('logged_on, weight_kg')
        .eq('user_id', selectedUser.user_id)
        .gte('logged_on', startDate)
        .lte('logged_on', endDate)
    ]);

    if (advisoriesRes.error) console.error('Error fetching advisories:', advisoriesRes.error);
    if (weightLogsRes.error) console.error('Error fetching weight logs:', weightLogsRes.error);

    const formattedEvents = {};
    if (advisoriesRes.data) {
      advisoriesRes.data.forEach(advisory => {
        const date = advisory.assigned_date;
        if (!formattedEvents[date]) formattedEvents[date] = [];
        formattedEvents[date].push({
          title: advisory.item_name || 'Asesoría',
          type: advisory.item_type
        });
      });
    }
    if (weightLogsRes.data) {
      weightLogsRes.data.forEach(log => {
        const date = log.logged_on;
        if (!formattedEvents[date]) formattedEvents[date] = [];
        formattedEvents[date].push({
          title: `${log.weight_kg} kg`,
          type: 'weight'
        });
      });
    }
    setEvents(formattedEvents);
  }, [selectedUser, firstDayOfMonth, lastDayOfMonth]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    let startDayOfWeek = firstDayOfMonth.getDay();
    if (startDayOfWeek === 0) startDayOfWeek = 7;

    const days = [];
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i > 0; i--) {
      days.push({ day: prevMonthLastDay - i + 1, isCurrentMonth: false });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      days.push({ day: day, isCurrentMonth: true });
    }

    const totalCells = 42;
    const nextMonthDays = totalCells - days.length;
    for (let i = 1; i <= nextMonthDays; i++) {
      days.push({ day: i, isCurrentMonth: false });
    }
    return days;
  };
  
  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const handleDateClick = (day) => {
    if (!day.isCurrentMonth || !selectedUser) return;
    const date = new Date(Date.UTC(currentDate.getFullYear(), currentDate.getMonth(), day.day));
    setSelectedDate(date);
    setIsModalOpen(true);
  };

  const handleWeightLogClick = (day, e) => {
    e.stopPropagation();
    if (!day.isCurrentMonth) return;
    const date = new Date(Date.UTC(currentDate.getFullYear(), currentDate.getMonth(), day.day));
    setSelectedDateForAction(date);
    setIsWeightLogOpen(true);
  };

  const handleAddAction = (action) => {
    setSelectedDateForAction(selectedDate);
    setIsModalOpen(false);
    if (action === 'weight') setIsWeightLogOpen(true);
    if (action === 'free_meal') setIsFreeMealOpen(true);
  };

  const handleNavigation = (path) => {
    navigate(path);
    setIsModalOpen(false);
  };

  const isToday = (day) => {
    const today = new Date();
    return day.isCurrentMonth &&
           day.day === today.getDate() &&
           currentDate.getMonth() === today.getMonth() &&
           currentDate.getFullYear() === today.getFullYear();
  };

  const days = getDaysInMonth(currentDate);

  const eventIcons = {
    routine_template: <Flame className="w-3.5 h-3.5 mr-1.5 text-red-400 flex-shrink-0" />,
    diet_plan: <Apple className="w-3.5 h-3.5 mr-1.5 text-green-400 flex-shrink-0" />,
    weight: <Scale className="w-3.5 h-3.5 mr-1.5 text-purple-400 flex-shrink-0" />,
  };

  return (
    <>
      <div className="w-full flex-grow flex flex-col bg-[#1a1e23] p-6 rounded-2xl">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="calendar-header"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-white to-green-400 bg-clip-text text-transparent">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <div className="flex items-center space-x-3">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => navigateMonth(-1)} 
                className="text-gray-300 hover:text-white hover:bg-green-500/20 transition-all duration-200 rounded-full"
              >
                <ChevronLeft className="w-6 h-6" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => navigateMonth(1)} 
                className="text-gray-300 hover:text-white hover:bg-green-500/20 transition-all duration-200 rounded-full"
              >
                <ChevronRight className="w-6 h-6" />
              </Button>
            </div>
          </div>
        </motion.div>

        <div className="calendar-grid">
          <div className="grid grid-cols-7 gap-0">
            {dayNames.map((day) => (
              <div key={day} className="calendar-day-header">{day}</div>
            ))}
          </div>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7 }}
            className="grid grid-cols-7 flex-grow"
          >
            {days.map((day, index) => {
              const dateString = day.isCurrentMonth ? `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day.day).padStart(2, '0')}` : null;
              const dayEvents = dateString ? events[dateString] || [] : [];
              const weightLog = dayEvents.find(e => e.type === 'weight');
              const otherEvents = dayEvents.filter(e => e.type !== 'weight');

              return (
                <div
                  key={index}
                  onClick={() => handleDateClick(day)}
                  className={`calendar-cell ${!day.isCurrentMonth ? 'opacity-40' : 'cursor-pointer'}`}
                >
                  <div className="calendar-day-content">
                    {weightLog ? (
                      <div 
                        className="weight-log-bar cursor-pointer"
                        onClick={(e) => handleWeightLogClick(day, e)}
                      >
                        <span className="weight-text">{weightLog.title}</span>
                        <span className={`day-number-weight ${isToday(day) ? 'today' : ''} ${!day.isCurrentMonth ? 'text-gray-600' : ''}`}>
                          {day.day}
                        </span>
                      </div>
                    ) : (
                      <div className="flex justify-end p-2">
                        <span className={`day-number ${isToday(day) ? 'today' : ''} ${!day.isCurrentMonth ? 'text-gray-600' : ''}`}>
                          {day.day}
                        </span>
                      </div>
                    )}

                    <div className="space-y-1.5 overflow-y-auto no-scrollbar flex-grow p-2">
                      {otherEvents.map((event, eventIndex) => (
                        <motion.div 
                          key={eventIndex} 
                          className={`event-chip ${event.type === 'routine_template' ? 'event-chip-workout' : 'bg-green-500/20 text-green-200 border-green-500/40'}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: eventIndex * 0.1 }}
                        >
                          {eventIcons[event.type] || null}
                          <span className="truncate font-medium">{event.title}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </motion.div>
        </div>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="calendar-dialog-content text-white border-gray-700 max-w-lg">
          <DialogHeader>
            <DialogTitle className="calendar-dialog-title text-center bg-gradient-to-r from-white to-green-400 bg-clip-text text-transparent">
              ¿Qué quieres gestionar?
            </DialogTitle>
            <DialogDescription className="calendar-dialog-description text-center text-gray-300">
              Selecciona una opción para el {selectedDate?.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col space-y-5 pt-4">
            <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-4">
              <Button
                onClick={() => handleNavigation(`/plan/dieta/${selectedUser?.user_id}`)}
                className="calendar-dialog-button flex-grow border-2 border-green-500 bg-transparent text-green-400 hover:bg-green-500/10 hover:border-green-400 transition-all duration-300"
              >
                <Apple className="w-6 h-6 mr-2" />
                Plan de Dieta
              </Button>
              <Button
                onClick={() => handleNavigation(`/admin/manage-training/${selectedUser?.user_id}`)}
                className="calendar-dialog-button flex-grow border-2 border-red-500 bg-transparent text-red-400 hover:bg-red-500/10 hover:border-red-400 transition-all duration-300"
              >
                <Dumbbell className="w-6 h-6 mr-2" />
                Plan de Entreno
              </Button>
            </div>
            <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-4">
              <Button
                onClick={() => handleAddAction('weight')}
                className="calendar-dialog-button flex-grow border-2 border-purple-500 bg-transparent text-purple-400 hover:bg-purple-500/10 hover:border-purple-400 transition-all duration-300"
              >
                <Scale className="w-6 h-6 mr-2" />
                Añadirle un Registro de Peso
              </Button>
              <Button
                onClick={() => handleAddAction('free_meal')}
                className="calendar-dialog-button flex-grow border-2 border-blue-500 bg-transparent text-blue-400 hover:bg-blue-500/10 hover:border-blue-400 transition-all duration-300"
              >
                <UtensilsCrossed className="w-6 h-6 mr-2" />
                Añadirle Comida Libre
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {selectedUser && (
        <>
          <WeightLogDialog
            open={isWeightLogOpen}
            onOpenChange={setIsWeightLogOpen}
            onLogAdded={fetchEvents}
            initialDate={selectedDateForAction}
            userId={selectedUser.user_id}
          />
          <FreeMealDialog
            open={isFreeMealOpen}
            onOpenChange={setIsFreeMealOpen}
            onSaveSuccess={fetchEvents}
            userId={selectedUser.user_id}
            mealDate={selectedDateForAction}
          />
        </>
      )}
    </>
  );
};

export default AdminCalendar;