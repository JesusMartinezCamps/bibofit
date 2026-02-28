import { useEffect, useState } from 'react';
import { format, parseISO, isValid, eachDayOfInterval } from 'date-fns';
import { supabase } from '@/lib/supabaseClient';

export const useDietTimelineEvents = ({ userId, weekDates, isAdminView, refreshTrigger, activePlanId }) => {
  const [timelineEvents, setTimelineEvents] = useState({});

  useEffect(() => {
    const fetchTimelineEvents = async () => {
      if (!userId || weekDates.length === 0) return;

      const startDate = format(weekDates[0], 'yyyy-MM-dd');
      const endDate = format(weekDates[weekDates.length - 1], 'yyyy-MM-dd');

      const [remindersRes, weightLogsRes, mealLogsRes, snackLogsRes] = await Promise.all([
        isAdminView
          ? supabase
              .from('reminders')
              .select('start_date, end_date')
              .eq('user_id', userId)
              .eq('type', 'event')
              .gte('start_date', startDate)
              .lte('end_date', endDate)
          : Promise.resolve({ data: [] }),
        supabase.from('weight_logs').select('logged_on').eq('user_id', userId).gte('logged_on', startDate).lte('logged_on', endDate),
        supabase
          .from('daily_meal_logs')
          .select(`
            log_date,
            free_recipe_occurrence_id,
            diet_plan_recipe:diet_plan_recipe_id(diet_plan_id),
            private_recipe:private_recipe_id(diet_plan_id),
            free_recipe_occurrence:free_recipe_occurrence_id(free_recipe:free_recipe_id(diet_plan_id))
          `)
          .eq('user_id', userId)
          .gte('log_date', startDate)
          .lte('log_date', endDate),
        supabase.from('daily_snack_logs').select('log_date').eq('user_id', userId).gte('log_date', startDate).lte('log_date', endDate),
      ]);

      const events = {};
      const addEvent = (date, type, isFreeRecipe = false) => {
        const dateString = format(parseISO(date), 'yyyy-MM-dd');
        if (!events[dateString]) {
          events[dateString] = { reminders: 0, weight: 0, diet_logs: [], snacks: 0 };
        }
        if (type === 'reminder') events[dateString].reminders++;
        if (type === 'weight') events[dateString].weight++;
        if (type === 'diet_log') events[dateString].diet_logs.push({ isFree: isFreeRecipe });
        if (type === 'snack') events[dateString].snacks++;
      };

      (remindersRes.data || []).forEach((r) => {
        const eventInterval = {
          start: parseISO(r.start_date),
          end: r.end_date ? parseISO(r.end_date) : parseISO(r.start_date),
        };
        if (isValid(eventInterval.start) && isValid(eventInterval.end)) {
          const dates = eachDayOfInterval(eventInterval);
          dates.forEach((d) => addEvent(d.toISOString(), 'reminder'));
        }
      });
      (weightLogsRes.data || []).forEach((l) => addEvent(l.logged_on, 'weight'));
      const targetPlanId = Number(activePlanId);
      (mealLogsRes.data || [])
        .filter((l) => {
          if (!targetPlanId) return false;
          const recipePlanId = Number(l.diet_plan_recipe?.diet_plan_id);
          const privatePlanId = Number(l.private_recipe?.diet_plan_id);
          const freePlanId = Number(l.free_recipe_occurrence?.free_recipe?.diet_plan_id);
          return recipePlanId === targetPlanId || privatePlanId === targetPlanId || freePlanId === targetPlanId;
        })
        .forEach((l) => addEvent(l.log_date, 'diet_log', l.free_recipe_occurrence_id !== null));
      (snackLogsRes.data || []).forEach((l) => addEvent(l.log_date, 'snack'));

      setTimelineEvents(events);
    };

    fetchTimelineEvents();
  }, [weekDates, userId, isAdminView, refreshTrigger, activePlanId]);

  return timelineEvents;
};
