import { useState, useEffect, useCallback, useRef } from 'react';
import { parseISO, differenceInCalendarDays } from 'date-fns';
import { supabase } from '@/lib/supabaseClient';

const MAX_DATE_CACHE = 14; // ~2 semanas de navegación

export const useDietPlanHeaderData = ({ userId, logDate, isAdminView, toast }) => {
  const [data, setData] = useState(null);
  const [activePlan, setActivePlan] = useState(null);
  const [planStatus, setPlanStatus] = useState({ hasPlans: false, closestPlanLabel: null });
  const [loading, setLoading] = useState(true);
  const [reminders, setReminders] = useState([]);
  const [weightForDay, setWeightForDay] = useState(null);

  // staticCache: profile + preferences — estables por sesión (se invalidan solo al cambiar userId)
  const staticCacheRef = useRef(null);
  // dateCache: plan + pesos + overrides + reminders — por (userId, logDate)
  const dateCacheRef = useRef(new Map());

  const invalidateDateCache = useCallback((date) => {
    dateCacheRef.current.delete(date ?? logDate);
  }, [logDate]);

  const refreshHeaderData = useCallback(async (force = false) => {
    setLoading(true);
    setPlanStatus({ hasPlans: false, closestPlanLabel: null });

    // Invalida todo si cambió el usuario
    if (staticCacheRef.current?.userId !== userId) {
      staticCacheRef.current = null;
      dateCacheRef.current.clear();
    }
    // Invalida la fecha actual si se fuerza refresco
    if (force) dateCacheRef.current.delete(logDate);

    const staticHit = staticCacheRef.current;
    const dateHit = dateCacheRef.current.get(logDate);

    try {
      const [staticResult, dateResult] = await Promise.all([
        // --- Datos estáticos (perfil + preferencias) ---
        staticHit
          ? Promise.resolve(staticHit)
          : (async () => {
              const [profileRes, preferredRes, nonPreferredRes] = await Promise.all([
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
                supabase.from('preferred_foods').select('food(id, name)').eq('user_id', userId),
                supabase.from('non_preferred_foods').select('food(id, name)').eq('user_id', userId),
              ]);
              if (profileRes.error) throw profileRes.error;
              if (preferredRes.error || nonPreferredRes.error) throw preferredRes.error || nonPreferredRes.error;
              return {
                userId,
                profile: profileRes.data,
                preferred: preferredRes.data,
                nonPreferred: nonPreferredRes.data,
              };
            })(),

        // --- Datos por fecha (plan + pesos + recordatorios) ---
        dateHit
          ? Promise.resolve(dateHit)
          : (async () => {
              const [planRes, weightDayRes, weightPrevRes, weightNextRes, remindersRes] = await Promise.all([
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

              if (planRes.error && planRes.error.code !== 'PGRST116') throw planRes.error;
              if (weightDayRes.error && weightDayRes.error.code !== 'PGRST116') throw weightDayRes.error;
              if (remindersRes.error) throw remindersRes.error;

              const dietPlan = planRes.data;

              // Fase 2: overrides (si hay plan) o allPlans (si no hay) — mutuamente excluyentes
              const [overridesRes, allPlansRes] = await Promise.all([
                dietPlan
                  ? supabase
                      .from('diet_plan_calorie_overrides')
                      .select('created_at, manual_calories')
                      .eq('diet_plan_id', dietPlan.id)
                  : Promise.resolve({ data: [], error: null }),
                !dietPlan
                  ? supabase
                      .from('diet_plans')
                      .select('start_date')
                      .eq('user_id', userId)
                      .order('start_date', { ascending: true })
                  : Promise.resolve({ data: null, error: null }),
              ]);

              if (overridesRes.error) throw overridesRes.error;

              return {
                plan: dietPlan,
                calorieOverrides: overridesRes.data || [],
                allPlans: allPlansRes.data,
                weightDay: weightDayRes.data,
                weightPrev: weightPrevRes.data,
                weightNext: weightNextRes.data,
                reminders: remindersRes.data || [],
              };
            })(),
      ]);

      // Almacena en caché los resultados nuevos
      if (!staticHit) {
        staticCacheRef.current = staticResult;
      }
      if (!dateHit) {
        if (dateCacheRef.current.size >= MAX_DATE_CACHE) {
          dateCacheRef.current.delete(dateCacheRef.current.keys().next().value);
        }
        dateCacheRef.current.set(logDate, dateResult);
      }

      // --- Procesa y actualiza estado ---
      const dietPlan = dateResult.plan;
      setActivePlan(dietPlan);

      if (!dietPlan && dateResult.allPlans && dateResult.allPlans.length > 0) {
        const logDateObj = parseISO(logDate);
        const sortedByDistance = [...dateResult.allPlans].sort((a, b) => {
          const distA = Math.abs(parseISO(a.start_date) - logDateObj);
          const distB = Math.abs(parseISO(b.start_date) - logDateObj);
          return distA - distB;
        });
        setPlanStatus({ hasPlans: true, closestPlanLabel: sortedByDistance[0].start_date });
      }

      const weightForDayData = dateResult.weightDay;
      setWeightForDay(weightForDayData);

      let closestWeightData = weightForDayData;
      let interpolatedWeightVal = null;
      let previousWeightLog = null;
      let nextWeightLog = null;

      if (!weightForDayData) {
        const prevWeight = dateResult.weightPrev;
        const nextWeight = dateResult.weightNext;

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

      setReminders(dateResult.reminders);

      setData({
        profile: staticResult.profile,
        closestWeight: closestWeightData,
        interpolatedWeight: interpolatedWeightVal,
        previousWeightLog,
        nextWeightLog,
        calorieOverrides: dateResult.calorieOverrides,
        preferences: {
          preferred: staticResult.preferred?.map((p) => p.food) || [],
          nonPreferred: staticResult.nonPreferred?.map((p) => p.food) || [],
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
    invalidateDateCache,
  };
};
