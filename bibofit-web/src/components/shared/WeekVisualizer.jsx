import React, { useMemo } from 'react';
import { format, isSameDay, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const WeekVisualizer = ({ weekDates, plannedMeals, daySummaries, onDayClick, currentDate, isSticky }) => {
  const fallbackSummary = useMemo(() => {
    if (!plannedMeals) return {};

    return plannedMeals.reduce((acc, meal) => {
      const date = meal.plan_date;
      if (!acc[date]) {
        acc[date] = {
          planned: 0,
          mealSlots: 0,
          logged: 0,
          loggedRecipe: 0,
          loggedPrivate: 0,
          loggedFree: 0,
          snacksLogged: 0,
          freeAvailable: 0,
          snacksAvailable: 0,
        };
      }
      acc[date].planned += 1;
      return acc;
    }, {});
  }, [plannedMeals]);

  const summaryByDate = daySummaries && Object.keys(daySummaries).length > 0 ? daySummaries : fallbackSummary;

  return (
    <div className={cn('grid grid-cols-7 gap-2 md:gap-3 rounded-xl', isSticky ? 'bg-transparent' : 'bg-card/75 p-3')}>
      {weekDates.map((date) => {
        const dateString = format(date, 'yyyy-MM-dd');
        const daySummary = summaryByDate[dateString] || {};
        const plannedCount = Number(daySummary.planned || 0);
        const configuredMealSlots = Number(daySummary.mealSlots || 0);
        const totalMealDots = Math.max(configuredMealSlots, plannedCount, 0);
        const isCurrent = isSameDay(date, currentDate);

        return (
          <button
            key={dateString}
            onClick={() => onDayClick(date)}
            className={cn(
              'relative flex flex-col items-center justify-between p-2 rounded-lg transition-all duration-200 aspect-[3/4] min-h-[70px]',
              isCurrent ? 'bg-sky-500/20 border-2 border-sky-400 shadow-lg shadow-sky-500/10' : 'bg-muted/70 hover:bg-muted/80 border border-transparent',
              isToday(date) && !isCurrent && 'border border-dashed border-gray-500'
            )}
          >
            <div className="text-center">
              <p className={cn('text-xs md:text-sm font-medium', isCurrent ? 'text-sky-300' : 'text-muted-foreground')}>
                {format(date, 'EEE', { locale: es }).charAt(0).toUpperCase() + format(date, 'EEE', { locale: es }).slice(1, 3)}
              </p>
              <p className={cn('text-lg md:text-xl font-bold', isCurrent ? 'text-white' : 'text-gray-200')}>
                {format(date, 'd')}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-1 mt-1 min-h-[8px]">
              {totalMealDots > 0 &&
                Array.from({ length: totalMealDots }).map((_, index) => {
                  const isPlannedDot = index < plannedCount;
                  return (
                    <div
                      key={`plan-dot-${dateString}-${index}`}
                      className={cn('w-2 h-2 rounded-full', isPlannedDot ? 'bg-cyan-400' : 'bg-muted')}
                      title={isPlannedDot ? 'Comida planificada' : 'Comida sin planificar'}
                    />
                  );
                })}
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default WeekVisualizer;
