import { useState, useEffect, useCallback } from 'react';
import { parseISO, differenceInCalendarDays } from 'date-fns';
import { supabase } from '@/lib/supabaseClient';

export const useDietPlanHeaderData = ({ userId, logDate, isAdminView, toast }) => {
  const [data, setData] = useState(null);
  const [activePlan, setActivePlan] = useState(null);
  const [planStatus, setPlanStatus] = useState({ hasPlans: false, closestPlanLabel: null });
  const [loading, setLoading] = useState(true);
  const [reminders, setReminders] = useState([]);
  const [weightForDay, setWeightForDay] = useState(null);

  const refreshHeaderData = useCallback(async () => {
    setLoading(true);
    setPlanStatus({ hasPlans: false, closestPlanLabel: null });

    try {
      const [
        profileRes,
        planRes,
        weightDayRes,
        preferredRes,
        nonPreferredRes,
        individualRes,
        remindersRes,
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select(`
            full_name,
            tdee_kcal,
            user_medical_conditions(medical_conditions(id, name, description)),
            user_sensitivities(sensitivities(id, name, description))
          `)
          .eq('user_id', userId)
          .single(),
        supabase
          .from('diet_plans')
          .select(`
            id, name, start_date, end_date, protein_pct, carbs_pct, fat_pct,
            sensitivities:diet_plan_sensitivities(sensitivities(id, name, description)),
            medical_conditions:diet_plan_medical_conditions(medical_conditions(id, name, description))
          `)
          .eq('user_id', userId)
          .eq('is_active', true)
          .lte('start_date', logDate)
          .gte('end_date', logDate)
          .maybeSingle(),
        supabase
          .from('weight_logs')
          .select('*, satiety_levels(name, emoji)')
          .eq('user_id', userId)
          .eq('logged_on', logDate)
          .maybeSingle(),
        supabase.from('preferred_foods').select('food(id, name)').eq('user_id', userId),
        supabase.from('non_preferred_foods').select('food(id, name)').eq('user_id', userId),
        supabase.from('user_individual_food_restrictions').select('food(id, name)').eq('user_id', userId),
        isAdminView
          ? supabase
              .from('reminders')
              .select('*')
              .eq('user_id', userId)
              .in('category', ['Dieta', 'Personal'])
              .lte('start_date', logDate)
              .gte('end_date', logDate)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const { data: profileData, error: profileError } = profileRes;
      if (profileError) throw profileError;

      const { data: dietPlan, error: planError } = planRes;

      if (planError && planError.code !== 'PGRST116') {
        throw planError;
      }

      if (!dietPlan) {
        const { data: allPlans, error: allPlansError } = await supabase
          .from('diet_plans')
          .select('start_date')
          .eq('user_id', userId)
          .order('start_date', { ascending: true });

        if (!allPlansError && allPlans && allPlans.length > 0) {
          const logDateObj = parseISO(logDate);
          const sortedByDistance = allPlans.sort((a, b) => {
            const distA = Math.abs(parseISO(a.start_date) - logDateObj);
            const distB = Math.abs(parseISO(b.start_date) - logDateObj);
            return distA - distB;
          });

          setPlanStatus({
            hasPlans: true,
            closestPlanLabel: sortedByDistance[0].start_date,
          });
        }
      }

      setActivePlan(dietPlan);

      let calorieOverrides = [];
      if (dietPlan) {
        const { data: overridesData, error: overridesError } = await supabase
          .from('diet_plan_calorie_overrides')
          .select('created_at, manual_calories')
          .eq('diet_plan_id', dietPlan.id);
        if (overridesError) throw overridesError;
        calorieOverrides = overridesData || [];
      }

      const { data: weightForDayData, error: weightDayError } = weightDayRes;
      if (weightDayError && weightDayError.code !== 'PGRST116') throw weightDayError;
      setWeightForDay(weightForDayData);

      let closestWeightData = weightForDayData;
      let interpolatedWeightVal = null;
      let previousWeightLog = null;
      let nextWeightLog = null;

      if (!weightForDayData) {
        const [prevRes, nextRes] = await Promise.all([
          supabase
            .from('weight_logs')
            .select('*, satiety_levels(name, emoji)')
            .eq('user_id', userId)
            .lt('logged_on', logDate)
            .order('logged_on', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('weight_logs')
            .select('*, satiety_levels(name, emoji)')
            .eq('user_id', userId)
            .gt('logged_on', logDate)
            .order('logged_on', { ascending: true })
            .limit(1)
            .maybeSingle(),
        ]);

        const prevWeight = prevRes.data;
        const nextWeight = nextRes.data;

        previousWeightLog = prevWeight;
        nextWeightLog = nextWeight;

        if (prevWeight && nextWeight) {
          const prevDate = parseISO(prevWeight.logged_on);
          const nextDate = parseISO(nextWeight.logged_on);
          const currDate = parseISO(logDate);

          const diffPrev = Math.abs(differenceInCalendarDays(currDate, prevDate));
          const diffNext = Math.abs(differenceInCalendarDays(nextDate, currDate));

          closestWeightData = diffPrev <= diffNext ? prevWeight : nextWeight;

          const totalDays = differenceInCalendarDays(nextDate, prevDate);
          const weightDiff = nextWeight.weight_kg - prevWeight.weight_kg;
          const daysFromPrev = differenceInCalendarDays(currDate, prevDate);

          if (totalDays > 0) {
            interpolatedWeightVal = Number(prevWeight.weight_kg) + (weightDiff * (daysFromPrev / totalDays));
          }
        } else if (prevWeight) {
          closestWeightData = prevWeight;
        } else if (nextWeight) {
          closestWeightData = nextWeight;
        }
      }

      if (remindersRes.error) throw remindersRes.error;
      setReminders(remindersRes.data || []);
      if (preferredRes.error || nonPreferredRes.error || individualRes.error) {
        throw preferredRes.error || nonPreferredRes.error || individualRes.error;
      }

      setData({
        profile: profileData,
        closestWeight: closestWeightData,
        interpolatedWeight: interpolatedWeightVal,
        previousWeightLog,
        nextWeightLog,
        calorieOverrides,
        preferences: {
          preferred: preferredRes.data?.map((p) => p.food) || [],
          nonPreferred: nonPreferredRes.data?.map((p) => p.food) || [],
          individual: individualRes.data?.map((p) => p.food) || [],
        },
      });
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [userId, toast, logDate, isAdminView]);

  useEffect(() => {
    refreshHeaderData();
  }, [refreshHeaderData]);

  return {
    data,
    setData,
    activePlan,
    planStatus,
    loading,
    reminders,
    weightForDay,
    setWeightForDay,
    refreshHeaderData,
  };
};
