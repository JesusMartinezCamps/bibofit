import React, { useMemo } from 'react';
    import { format, isSameDay, isToday } from 'date-fns';
    import { es } from 'date-fns/locale';
    import { cn } from '@/lib/utils';
    
    const WeekVisualizer = ({ weekDates, plannedMeals, onDayClick, currentDate, isSticky }) => {
      const mealsByDate = useMemo(() => {
        if (!plannedMeals) return {};
        return plannedMeals.reduce((acc, meal) => {
          const date = meal.plan_date;
          if (!acc[date]) {
            acc[date] = [];
          }
          acc[date].push(meal);
          return acc;
        }, {});
      }, [plannedMeals]);
    
      return (
        <div className={cn("grid grid-cols-7 gap-2 md:gap-3 rounded-xl", isSticky ? "bg-transparent" : "bg-gray-900/50 p-3")}>
          {weekDates.map(date => {
            const dateString = format(date, 'yyyy-MM-dd');
            const dayMeals = mealsByDate[dateString] || [];
            const isCurrent = isSameDay(date, currentDate);
    
            return (
              <button
                key={dateString}
                onClick={() => onDayClick(date)}
                className={cn(
                  "relative flex flex-col items-center justify-between p-2 rounded-lg transition-all duration-200 aspect-[3/4] min-h-[70px]",
                  isCurrent ? "bg-sky-500/20 border-2 border-sky-400 shadow-lg shadow-sky-500/10" : "bg-gray-800/60 hover:bg-gray-700/80 border border-transparent",
                  isToday(date) && !isCurrent && "border border-dashed border-gray-500"
                )}
              >
                <div className="text-center">
                  <p className={cn("text-xs md:text-sm font-medium", isCurrent ? "text-sky-300" : "text-gray-400")}>
                    {format(date, 'EEE', { locale: es }).charAt(0).toUpperCase() + format(date, 'EEE', { locale: es }).slice(1, 3)}
                  </p>
                  <p className={cn("text-lg md:text-xl font-bold", isCurrent ? "text-white" : "text-gray-200")}>
                    {format(date, 'd')}
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-1 mt-1 min-h-[8px]">
                  {dayMeals.map((meal, index) => (
                    <div key={index} className="w-2 h-2 rounded-full bg-cyan-400" title="Comida planificada"></div>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      );
    };
    
    export default WeekVisualizer;