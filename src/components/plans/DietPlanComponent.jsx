
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Calendar, List, User, ArrowLeft, ArrowRight, Settings, AlertTriangle, ShoppingCart, BookCopy, HeartPulse, ShieldAlert, Weight, StickyNote } from 'lucide-react';
import WeightLogDialog from '@/components/shared/WeightLogDialog';
import { useAuth } from '@/contexts/AuthContext';
import WeeklyDietPlanner from '@/components/shared/WeeklyDietPlanner/WeeklyDietPlanner';
import { format, addDays, subDays, isValid, parseISO, isToday, isSameDay, eachDayOfInterval, isBefore, isAfter, startOfDay, formatDistanceStrict, differenceInCalendarDays } from 'date-fns';
import { es } from 'date-fns/locale';
import AddRecipeToPlanDialog from './AddRecipeToPlanDialog';
import InfoBadge from '@/components/shared/InfoBadge';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import MacroVisualizer from '@/components/shared/MacroVisualizer/MacroVisualizer';
import WeekVisualizer from '@/components/shared/WeekVisualizer';
import { calculateMacros } from '@/lib/macroCalculator';
import ContentStateToggle from '@/components/shared/ContentStateToggle';
import ReminderFormDialog from '@/components/admin/reminders/ReminderFormDialog';
import AssignRecipeDialog from './AssignRecipeDialog';

const DateTimeline = ({ currentDate, setCurrentDate, navigate, isAdminView, userId, refreshTrigger }) => {
    const [timelineEvents, setTimelineEvents] = useState({});

    const weekDates = useMemo(() => {
        const start = subDays(currentDate, 3);
        return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }, [currentDate]);

    useEffect(() => {
        const fetchTimelineEvents = async () => {
            if (!userId || weekDates.length === 0) return;
            const startDate = format(weekDates[0], 'yyyy-MM-dd');
            const endDate = format(weekDates[weekDates.length - 1], 'yyyy-MM-dd');
            
            const [remindersRes, weightLogsRes, mealLogsRes, snackLogsRes] = await Promise.all([
                isAdminView ? supabase.from('reminders').select('start_date, end_date').eq('user_id', userId).eq('type', 'event').gte('start_date', startDate).lte('end_date', endDate) : Promise.resolve({ data: [] }),
                supabase.from('weight_logs').select('logged_on').eq('user_id', userId).gte('logged_on', startDate).lte('logged_on', endDate),
                supabase.from('daily_meal_logs').select('log_date, free_recipe_occurrence_id').eq('user_id', userId).gte('log_date', startDate).lte('log_date', endDate),
                supabase.from('daily_snack_logs').select('log_date').eq('user_id', userId).gte('log_date', startDate).lte('log_date', endDate)
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

            (remindersRes.data || []).forEach(r => {
                const eventInterval = { start: parseISO(r.start_date), end: r.end_date ? parseISO(r.end_date) : parseISO(r.start_date) };
                if (isValid(eventInterval.start) && isValid(eventInterval.end)) {
                  const dates = eachDayOfInterval(eventInterval);
                  dates.forEach(d => addEvent(d.toISOString(), 'reminder'));
                }
            });
            (weightLogsRes.data || []).forEach(l => addEvent(l.logged_on, 'weight'));
            (mealLogsRes.data || []).forEach(l => addEvent(l.log_date, 'diet_log', l.free_recipe_occurrence_id !== null));
            (snackLogsRes.data || []).forEach(l => addEvent(l.log_date, 'snack'));

            setTimelineEvents(events);
        };

        fetchTimelineEvents();
    }, [weekDates, userId, isAdminView, refreshTrigger]);

    const handleDateClick = (date) => {
        setCurrentDate(date);
        const dateString = format(date, 'yyyy-MM-dd');
        const newPath = isAdminView ? `/plan/dieta/${userId}/${dateString}` : `/plan/dieta/${dateString}`;
        navigate(newPath, { replace: true });
    };
    
    const changeWeek = (direction) => {
         const newDate = addDays(currentDate, direction === 'next' ? 7 : -7);
        handleDateClick(newDate);
    }
    
    const today = startOfDay(new Date());
    const isTodayVisible = weekDates.some(d => isSameDay(d, today));
    const isTodayInFuture = !isTodayVisible && isAfter(today, weekDates[weekDates.length - 1]);
    const isTodayInPast = !isTodayVisible && isBefore(today, weekDates[0]);

    return (
        <div className="flex items-center justify-center gap-2 bg-slate-900/50 p-2 rounded-xl border border-gray-700">
            <Button variant="ghost" size="icon" onClick={() => changeWeek('prev')} className="text-gray-400 hover:bg-slate-800 hover:text-gray-300">
                <ArrowLeft className={cn(isTodayInPast ? "text-cyan-400" : "text-gray-400")} />
            </Button>
            <div className="flex-grow grid grid-cols-7 gap-1">
                {weekDates.map(date => {
                    const dateString = format(date, 'yyyy-MM-dd');
                    const dayEvents = timelineEvents[dateString] || { reminders: 0, weight: 0, diet_logs: [], snacks: 0 };
                    const isCurrentDay = isToday(date);
                    return (
                        <button key={dateString} onClick={() => handleDateClick(date)} className={cn("flex flex-col items-center p-2 rounded-lg transition-colors", isSameDay(date, currentDate) ? 'bg-slate-700' : 'hover:bg-slate-800')}>
                            <span className={cn("text-xs uppercase font-bold", isCurrentDay ? "bg-gradient-to-t from-cyan-700 to-cyan-300 bg-clip-text text-transparent" : "text-gray-400")}>{format(date, 'eee', {locale: es})}</span>
                            <span className={cn("text-lg font-bold", isSameDay(date, currentDate) ? 'text-white' : (isCurrentDay ? "bg-gradient-to-t from-cyan-700 to-cyan-300 bg-clip-text text-transparent" : "text-gray-300"))}>{format(date, 'd')}</span>
                            <div className="flex flex-wrap justify-center gap-1 mt-1 min-h-[12px] items-center">
                                {isAdminView && dayEvents.reminders > 0 && <div className="w-2 h-2 rounded-full bg-amber-500" title="Recordatorio"></div>}
                                {dayEvents.weight > 0 && <div className="w-2 h-2 rounded-full bg-purple-500" title="Peso registrado"></div>}
                                {dayEvents.snacks > 0 && <div className="w-2 h-2 rounded-full bg-orange-500" title="Picoteo registrado"></div>}
                                {dayEvents.diet_logs.slice(0, 3).map((log, i) => (
                                    <div key={i} className={cn("w-2 h-2 rounded-full", log.isFree ? "bg-[rgb(155,255,247)]" : "bg-green-500")} title={log.isFree ? "Receta libre registrada" : "Comida registrada"}></div>
                                ))}
                            </div>
                        </button>
                    )
                })}
            </div>
            <Button variant="ghost" size="icon" onClick={() => changeWeek('next')} className="text-gray-400 hover:bg-slate-800 hover:text-gray-300">
                <ArrowRight className={cn(isTodayInFuture ? "text-cyan-400" : "text-gray-400")} />
            </Button>
        </div>
    );
}

const DietPlanComponent = () => {
  const { user: authUser } = useAuth();
  const { userId: paramUserId, date: paramDate } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const userId = paramUserId || authUser.id;
  
  const getInitialDate = () => {
    if (paramDate) {
      const date = parseISO(paramDate);
      if (isValid(date)) return date;
    }
    return new Date();
  };

  const [currentDate, setCurrentDate] = useState(getInitialDate());
  
  const [data, setData] = useState(null);
  const [activePlan, setActivePlan] = useState(null);
  const [planStatus, setPlanStatus] = useState({ hasPlans: false, closestPlanLabel: null });
  const [loading, setLoading] = useState(true);
  const [isWeightLogOpen, setIsWeightLogOpen] = useState(false);
  const [viewMode, setViewMode] = useState('list');
  const [isAddRecipeOpen, setIsAddRecipeOpen] = useState(false);
  const [mealToAddTo, setMealToAddTo] = useState(null);
  const [mealDateToAddTo, setMealDateToAddTo] = useState(null);
  const [addRecipeMode, setAddRecipeMode] = useState('all');
  const [targetMacros, setTargetMacros] = useState({ calories: 0, proteins: 0, carbs: 0, fats: 0 });
  const [consumedMacros, setConsumedMacros] = useState({ calories: 0, proteins: 0, carbs: 0, fats: 0 });
  const [loadingMacros, setLoadingMacros] = useState(true);
  const [timelineRefreshTrigger, setTimelineRefreshTrigger] = useState(0);
  const [reminders, setReminders] = useState([]);
  const [isReminderFormOpen, setIsReminderFormOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState(null);
  const [isAssignRecipeOpen, setIsAssignRecipeOpen] = useState(false);
  const [recipeToAssign, setRecipeToAssign] = useState(null);
  const [plannedMeals, setPlannedMeals] = useState([]);
  const [weightForDay, setWeightForDay] = useState(null);
  
  const isAdminView = authUser?.id !== userId;
  const logDate = format(currentDate, 'yyyy-MM-dd');
  const plannerRef = useRef(null);

  const clientName = useMemo(() => data?.profile?.full_name || 'Cliente', [data]);

  const handleDateChange = (newDate) => {
    setCurrentDate(newDate);
    const dateString = format(newDate, 'yyyy-MM-dd');
    const newPath = isAdminView ? `/plan/dieta/${userId}/${dateString}` : `/plan/dieta/${dateString}`;
    navigate(newPath, { replace: true });
  };
  
  const fetchData = useCallback(async () => {
    setLoading(true);
    setPlanStatus({ hasPlans: false, closestPlanLabel: null });
    
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select(`
          full_name,
          tdee_kcal,
          user_medical_conditions(medical_conditions(id, name, description)),
          user_sensitivities(sensitivities(id, name, description))
        `)
        .eq('user_id', userId)
        .single();
      if (profileError) throw profileError;

      const { data: dietPlan, error: planError } = await supabase
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
        .maybeSingle();
      
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
                  closestPlanLabel: sortedByDistance[0].start_date
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

      // 1. Fetch exact match for today
      const { data: weightForDayData, error: weightDayError } = await supabase.from('weight_logs').select('*, satiety_levels(name, emoji)').eq('user_id', userId).eq('logged_on', logDate).maybeSingle();
      if (weightDayError && weightDayError.code !== 'PGRST116') throw weightDayError;
      setWeightForDay(weightForDayData);

      // 2. Fetch closest weights for interpolation logic
      let closestWeightData = weightForDayData;
      let interpolatedWeightVal = null;
      let previousWeightLog = null;
      let nextWeightLog = null;

      if (!weightForDayData) {
        const [prevRes, nextRes] = await Promise.all([
            supabase.from('weight_logs')
                .select('*, satiety_levels(name, emoji)')
                .eq('user_id', userId)
                .lt('logged_on', logDate)
                .order('logged_on', { ascending: false })
                .limit(1)
                .maybeSingle(),
            supabase.from('weight_logs')
                .select('*, satiety_levels(name, emoji)')
                .eq('user_id', userId)
                .gt('logged_on', logDate)
                .order('logged_on', { ascending: true })
                .limit(1)
                .maybeSingle()
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

            // Interpolation
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

      if (isAdminView) {
        const { data: remindersData, error: remindersError } = await supabase
          .from('reminders')
          .select('*')
          .eq('user_id', userId)
          .in('category', ['Dieta', 'Personal'])
          .lte('start_date', logDate)
          .gte('end_date', logDate);
        if (remindersError) throw remindersError;
        setReminders(remindersData || []);
      }

      const [preferredRes, nonPreferredRes, individualRes] = await Promise.all([
        supabase.from('preferred_foods').select('food(id, name)').eq('user_id', userId),
        supabase.from('non_preferred_foods').select('food(id, name)').eq('user_id', userId),
        supabase.from('user_individual_food_restrictions').select('food(id, name)').eq('user_id', userId)
      ]);

      setData({ 
          profile: profileData, 
          closestWeight: closestWeightData,
        interpolatedWeight: interpolatedWeightVal,
        previousWeightLog,
        nextWeightLog,
          calorieOverrides,
          preferences: {
              preferred: preferredRes.data?.map(p => p.food) || [],
              nonPreferred: nonPreferredRes.data?.map(p => p.food) || [],
              individual: individualRes.data?.map(p => p.food) || []
          }
      });

    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [userId, toast, logDate, isAdminView]);

  const onWeightLogAdded = useCallback((newLog) => {
    if (newLog) {
        const isCurrentDayLog = format(parseISO(newLog.logged_on), 'yyyy-MM-dd') === logDate;
        if (isCurrentDayLog) {
            setWeightForDay(newLog);
            // Since we added a log for today, it becomes the closest and exact match
          setData(prev => ({
            ...prev,
            closestWeight: newLog,
            interpolatedWeight: null,
            previousWeightLog: null,
            nextWeightLog: null
          }));
        } else {
             // Re-fetch to update neighbors if necessary
             fetchData();
        }
    } else {
        setWeightForDay(null);
        fetchData(); // Reload to find new neighbors/interpolation
    }
    setTimelineRefreshTrigger(prev => prev + 1);
  }, [logDate, fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const newDate = getInitialDate();
    if (newDate.getTime() !== currentDate.getTime()) {
      setCurrentDate(newDate);
    }
  }, [paramDate, currentDate]);

  const handleOpenAddRecipe = (meal, date, mode = 'all') => {
    setMealToAddTo(meal);
    setMealDateToAddTo(date);
    setAddRecipeMode(mode);
    setIsAddRecipeOpen(true);
  };
  
  const handleRecipeSelectedForAssignment = (recipe) => {
    setIsAddRecipeOpen(false);
    setRecipeToAssign(recipe);
    setIsAssignRecipeOpen(true);
  };

  const handleRecipeAssigned = (newItems, itemsToRemove) => {
    setIsAssignRecipeOpen(false);
    setRecipeToAssign(null);
    setPlannedMeals(prev => {
        const itemsToRemoveIds = new Set(itemsToRemove.map(r => r.id));
        const withoutRemoved = prev.filter(p => !itemsToRemoveIds.has(p.id));
        
        const final = [...withoutRemoved];
        newItems.forEach(newItem => {
            const index = final.findIndex(p => p.id === newItem.id);
            if (index > -1) {
                final[index] = newItem;
            } else {
                final.push(newItem);
            }
        });
        return final;
    });
    handlePlanUpdate();
  };

  const handleConstructorClick = () => {
    if (activePlan) {
      navigate(`/admin-panel/plan-detail/${activePlan.id}`);
    } else {
      toast({
        title: "No hay plan activo",
        description: "No se puede abrir el constructor porque no hay un plan activo para esta fecha.",
        variant: "destructive"
      });
    }
  }

  const handleShoppingListClick = () => {
    navigate('/shopping-list', {
      state: {
        initialMode: viewMode === 'list' ? 'day' : 'week',
        initialDate: currentDate.toISOString()
      }
    });
  };

const calculateTargetMacros = useCallback(() => {
    if (!data?.profile || !activePlan) {
        setTargetMacros({ calories: 0, proteins: 0, carbs: 0, fats: 0 });
        return;
    }

    // Sort by created_at to find the most recent override that applies
    const applicableOverride = data.calorieOverrides
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

    const totalCalories = applicableOverride ? applicableOverride.manual_calories : (data.profile.tdee_kcal || 0);
    
    const proteinPct = activePlan.protein_pct || 0;
    const carbsPct = activePlan.carbs_pct || 0;
    const fatPct = activePlan.fat_pct || 0;

    const proteinGrams = (totalCalories * (proteinPct / 100)) / 4;
    const carbGrams = (totalCalories * (carbsPct / 100)) / 4;
    const fatGrams = (totalCalories * (fatPct / 100)) / 9;

    setTargetMacros({
        calories: totalCalories,
        proteins: proteinGrams,
        carbs: carbGrams,
        fats: fatGrams,
    });
}, [data, activePlan]);

const fetchConsumedMacros = useCallback(async (isInitialLoad = false) => {
    if (viewMode !== 'list' || !userId || !activePlan) {
        setConsumedMacros({ calories: 0, proteins: 0, carbs: 0, fats: 0 });
        setLoadingMacros(false);
        return;
    }
    if (isInitialLoad) setLoadingMacros(true);
    try {
        const [
            { data: consumedLogs, error: logsError },
            { data: snackLogs, error: snackLogsError }
        ] = await Promise.all([
            supabase.from('daily_meal_logs').select('diet_plan_recipe_id, private_recipe_id, free_recipe_occurrence_id').eq('user_id', userId).eq('log_date', logDate),
            supabase.from('daily_snack_logs').select('snack_occurrence_id').eq('user_id', userId).eq('log_date', logDate)
        ]);

        if (logsError) throw logsError;
        if (snackLogsError) throw snackLogsError;
        
        if ((!consumedLogs || consumedLogs.length === 0) && (!snackLogs || snackLogs.length === 0)) {
             setConsumedMacros({ calories: 0, proteins: 0, carbs: 0, fats: 0 });
             setLoadingMacros(false);
             return;
        }

        const dietPlanRecipeIds = consumedLogs.map(l => l.diet_plan_recipe_id).filter(Boolean);
        const privateRecipeIds = consumedLogs.map(l => l.private_recipe_id).filter(Boolean);
        const freeRecipeOccurrenceIds = consumedLogs.map(l => l.free_recipe_occurrence_id).filter(Boolean);
        const snackOccurrenceIds = snackLogs.map(l => l.snack_occurrence_id).filter(Boolean);

        const [
            { data: dietPlanIngredients, error: dprError },
            { data: privateRecipeIngredients, error: prError },
            { data: freeRecipeOccurrences, error: froError },
            { data: snackOccurrences, error: soError },
            { data: allFoods, error: foodError },
            { data: equivalenceAdjustments, error: eqAdjError },
        ] = await Promise.all([
            supabase.from('diet_plan_recipe_ingredients').select('*, food(*)').in('diet_plan_recipe_id', dietPlanRecipeIds),
            supabase.from('private_recipe_ingredients').select('*, food(*)').in('private_recipe_id', privateRecipeIds),
            supabase.from('free_recipe_occurrences').select('*, free_recipe:free_recipes(*, free_recipe_ingredients(*, food(*)))').in('id', freeRecipeOccurrenceIds),
            supabase.from('snack_occurrences').select('*, snack:snacks(*, snack_ingredients(*, food(*)))').in('id', snackOccurrenceIds),
            supabase.from('food').select('*'),
            supabase.from('equivalence_adjustments').select('id').eq('user_id', userId).eq('log_date', logDate),
        ]);

        if (dprError || prError || froError || soError || foodError || eqAdjError) throw dprError || prError || froError || soError || foodError || eqAdjError;

        let ingredientAdjustments = [];
        if (equivalenceAdjustments && equivalenceAdjustments.length > 0) {
            const { data: adjData, error: adjError } = await supabase
                .from('daily_ingredient_adjustments')
                .select('*')
                .in('equivalence_adjustment_id', equivalenceAdjustments.map(ea => ea.id));
            if (adjError) throw adjError;
            ingredientAdjustments = adjData || [];
        }

        const freeRecipeIngredients = freeRecipeOccurrences.flatMap(occurrence => 
            occurrence.free_recipe.free_recipe_ingredients.map(ing => ({...ing, food: ing.food}))
        );

        const snackIngredients = snackOccurrences.flatMap(occurrence =>
            occurrence.snack.snack_ingredients.map(ing => ({...ing, food: ing.food}))
        );

        const adjustedDietPlanIngredients = dietPlanIngredients.map(ing => {
            const adjustment = ingredientAdjustments.find(adj => adj.diet_plan_recipe_id === ing.diet_plan_recipe_id && adj.food_id === ing.food_id);
            return adjustment ? { ...ing, grams: adjustment.adjusted_grams } : ing;
        });
        
        const adjustedPrivateRecipeIngredients = privateRecipeIngredients.map(ing => {
            const adjustment = ingredientAdjustments.find(adj => adj.private_recipe_id === ing.private_recipe_id && adj.food_id === ing.food_id);
            return adjustment ? { ...ing, grams: adjustment.adjusted_grams } : ing;
        });

        const allConsumedIngredients = [
            ...adjustedDietPlanIngredients,
            ...adjustedPrivateRecipeIngredients,
            ...freeRecipeIngredients,
            ...snackIngredients
        ];
        
        const totalConsumed = calculateMacros(allConsumedIngredients, allFoods);
        setConsumedMacros(totalConsumed);
    } catch (error) {
        console.error("Error fetching consumed macros:", error);
        toast({ title: "Error", description: "No se pudieron calcular las macros consumidas.", variant: "destructive" });
    } finally {
        if (isInitialLoad) setLoadingMacros(false);
    }
}, [userId, activePlan, logDate, toast, viewMode]);

    const handlePlanUpdate = useCallback((updatePayload) => {
        if (updatePayload?.macroDelta && viewMode === 'list') {
            setConsumedMacros(prev => ({
                calories: Math.max(0, (prev?.calories || 0) + (updatePayload.macroDelta.calories || 0)),
                proteins: Math.max(0, (prev?.proteins || 0) + (updatePayload.macroDelta.proteins || 0)),
                carbs: Math.max(0, (prev?.carbs || 0) + (updatePayload.macroDelta.carbs || 0)),
                fats: Math.max(0, (prev?.fats || 0) + (updatePayload.macroDelta.fats || 0)),
            }));
        } else {
            fetchConsumedMacros();
        }
    setTimelineRefreshTrigger(prev => prev + 1);
}, [fetchConsumedMacros, viewMode]);

const handleReminderSave = () => {
    setIsReminderFormOpen(false);
    setEditingReminder(null);
    fetchData();
};

const handleEditReminder = (reminder) => {
    setEditingReminder(reminder);
    setIsReminderFormOpen(true);
};

const handleDayClickInVisualizer = (date) => {
    if (plannerRef.current) {
        plannerRef.current.scrollToDay(date);
    }
};

useEffect(() => {
    calculateTargetMacros();
}, [calculateTargetMacros]);

useEffect(() => {
    fetchConsumedMacros(true);
}, [logDate, activePlan, viewMode]);

const combinedPlanRestrictions = useMemo(() => {
    if (!data?.profile && !activePlan) return null;

    // Client restrictions
    const clientSensitivities = data?.profile?.user_sensitivities?.map(s => s.sensitivities) || [];
    const clientConditions = data?.profile?.user_medical_conditions?.map(c => c.medical_conditions) || [];
    const clientPreferred = data?.preferences?.preferred || [];
    const clientNonPreferred = data?.preferences?.nonPreferred || [];
    const clientIndividual = data?.preferences?.individual || [];

    // Plan restrictions (Plan overrides or adds to client? Usually adds)
    const planSensitivities = activePlan?.sensitivities?.map(s => s.sensitivities) || [];
    const planConditions = activePlan?.medical_conditions?.map(c => c.medical_conditions) || [];

    // Merge unique by ID
    const mergeUnique = (arr1, arr2) => {
        const map = new Map();
        arr1.forEach(i => i && map.set(i.id, i));
        arr2.forEach(i => i && map.set(i.id, i));
        return Array.from(map.values());
    };

    return {
        sensitivities: mergeUnique(clientSensitivities, planSensitivities),
        medical_conditions: mergeUnique(clientConditions, planConditions),
        individual_food_restrictions: clientIndividual,
        preferred_foods: clientPreferred,
        non_preferred_foods: clientNonPreferred
    };
}, [data, activePlan]);


  if (loading) return <div className="flex justify-center items-center h-96"><Loader2 className="h-12 w-12 animate-spin text-green-500" /></div>;

  const closestWeightDate = data?.closestWeight?.logged_on ? parseISO(data.closestWeight.logged_on) : null;
  const interpolatedWeight = data?.interpolatedWeight;
  
  // Logic for relative time label
  let relativeWeightLabel = "";
  if (closestWeightDate && !weightForDay) {
      const daysDiff = differenceInCalendarDays(currentDate, closestWeightDate);
      if (daysDiff > 0) {
          relativeWeightLabel = `hacía ${Math.abs(daysDiff)} días`;
      } else if (daysDiff < 0) {
          relativeWeightLabel = `en ${Math.abs(daysDiff)} días`;
      } else {
          relativeWeightLabel = 'hoy'; // Should be covered by weightForDay but safeguard
      }
  }
  
  const planSensitivities = activePlan?.sensitivities?.map(s => s.sensitivities) || [];
  const clientSensitivities = data?.profile?.user_sensitivities?.map(s => s.sensitivities) || [];
  const allSensitivities = [...planSensitivities, ...clientSensitivities].reduce((acc, current) => {
    if (current && !acc.find(item => item.id === current.id)) {
      acc.push(current);
    }
    return acc;
  }, []);

  const planMedicalConditions = activePlan?.medical_conditions?.map(mc => mc.medical_conditions) || [];
  const clientMedicalConditions = data?.profile?.user_medical_conditions?.map(mc => mc.medical_conditions) || [];
  const allMedicalConditions = [...planMedicalConditions, ...clientMedicalConditions].reduce((acc, current) => {
    if (current && !acc.find(item => item.id === current.id)) {
      acc.push(current);
    }
    return acc;
  }, []);

  const notes = reminders.filter(r => r.type === 'note');
  const events = reminders.filter(r => r.type === 'event');

  const categoryColors = {
    'Dieta': 'bg-green-500/20 text-green-300 border-green-500/40',
    'Entreno': 'bg-red-500/20 text-red-300 border-red-500/40',
    'Personal': 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  };

  const renderVisualizer = (isSticky = false) => {
    if (!activePlan) {
        return (
            <div className={cn("h-full rounded-lg bg-gray-800/40 border border-gray-700 flex items-center justify-center", isSticky ? "p-4" : "")}>
                <p className="text-gray-400 text-sm italic">No hay plan de dieta activo.</p>
            </div>
        );
    }

    if (viewMode === 'list') {
        return (
            <MacroVisualizer
                currentTarget={targetMacros}
                actual={consumedMacros}
                loading={loadingMacros}
                isSticky={isSticky}
            />
        );
    }

    if (viewMode === 'week') {
        return (
            <WeekVisualizer
                weekDates={plannerRef.current?.getWeekDates() || []}
                plannedMeals={plannedMeals}
                onDayClick={handleDayClickInVisualizer}
                currentDate={currentDate}
                isSticky={isSticky}
            />
        );
    }

    return null;
};

  const isExactMatch = !!weightForDay;
  const displayWeight = isExactMatch
    ? weightForDay
    : (interpolatedWeight !== null && interpolatedWeight !== undefined)
        ? { weight_kg: interpolatedWeight.toFixed(1) }
        : data?.closestWeight;
  const previousWeightLog = data?.previousWeightLog;
  const nextWeightLog = data?.nextWeightLog;
  const hasInterpolationDetails =
    !isExactMatch &&
    interpolatedWeight &&
    previousWeightLog?.logged_on &&
    nextWeightLog?.logged_on;

  return (
    <div className="overflow-x-clip">
      <div className="space-y-2 sm:space-y-6 sm:p-1">
        <div className="space-y-2 sm:space-y-4 sm:px-0">
             {isAdminView && (
                <h1 className={cn(
                    "text-4xl md:text-5xl font-extrabold mb-8 mt-6 text-center",
                    "bg-gradient-to-r from-[#51ff77bf] to-green-300 bg-clip-text text-transparent"
                )}>
                    Plan de Dieta de <Link to={`/client-profile/${userId}`} className="hover:underline decoration-green-400">{clientName}</Link>
                </h1>
              )}
             {isAdminView && (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full">

                {/* Gestor de Dieta Actual */}
                <Button
                  asChild
                  size="sm"
                  variant="outline-diet"
                  className="calendar-dialog-button bg-gradient-to-br from-[rgb(52_143_85_/50%)] to-emerald-300/0 w-full sm:w-auto"
                >
                  <div onClick={handleConstructorClick} className="!text-xs sm:!text-s text-center">
                    Gestor de Dieta Actual
                  </div>
                </Button>

                {/* Gestor de planes de dieta */}
                <Button
                  asChild
                  size="sm"
                  variant="outline-profile"
                  className="calendar-dialog-button bg-gradient-to-br from-[rgb(66_52_143_/50%)] to-emerald-300/0 w-full sm:w-auto"
                >
                  <div onClick={() => navigate(`/admin/manage-diet/${userId}`)} className="!text-xs sm:!text-s text-center">
                    Gestor de planes de dieta
                  </div>
                </Button>

              </div>

              )}
              
              <DateTimeline currentDate={currentDate} setCurrentDate={handleDateChange} navigate={navigate} isAdminView={isAdminView} userId={userId} refreshTrigger={timelineRefreshTrigger} />
        </div>

        <Card className="bg-slate-900/50 border-gray-700 text-white overflow-hidden shadow-xl">
          <CardHeader className="pb-3 pt-5 px-5">
            <div className="flex justify-between items-center">
              <div className="hidden sm:block">
                <CardTitle className="text-xl">Resumen del Plan</CardTitle>
                <CardDescription className="text-sm text-gray-400">Objetivos y estado diario.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-4 pt-0">
            <div className="flex flex-col space-y-4">
                <div 
                    onClick={() => setIsWeightLogOpen(true)} 
                    className={cn(
                        "p-3 rounded-lg border shadow-lg text-center cursor-pointer h-auto flex flex-col justify-center w-full",
                        weightForDay 
                            ? "bg-gradient-to-br from-purple-800/50 via-purple-600/20 to-gray-900/10 border-purple-500/50"
                            : "bg-gradient-to-br from-gray-800/50 via-gray-600/20 to-gray-900/10 border-gray-700/50"
                    )}
                >
                    <h4 className={cn(
                        "font-semibold text-sm flex items-center justify-center gap-2",
                        weightForDay ? "text-purple-300" : "text-purple-400"
                    )}>
                        <Weight className="w-4 h-4"/>
                        {weightForDay ? "Peso de Hoy" : "Peso medio estimado"}
                    </h4>
                    <p className={cn(
                        "text-2xl font-bold mt-1",
                        weightForDay ? "text-white" : "text-purple-300"
                    )}>
                        {displayWeight?.weight_kg ? `${displayWeight.weight_kg} kg` : 'Introduce tu primer Registro'}
                    </p>
                    {isExactMatch && displayWeight?.satiety_levels && (
                        <span className="text-xs text-purple-200/80 mt-1">
                            {displayWeight.satiety_levels.emoji} {displayWeight.satiety_levels.name}
                        </span>
                    )}
                    {!isExactMatch && hasInterpolationDetails ? (
                      <div className="text-[11px] sm:text-xs text-purple-100/80 mt-2 space-y-1 leading-relaxed">
                        <div className="text-purple-200/80">
                          {previousWeightLog?.weight_kg} kg · {format(parseISO(previousWeightLog.logged_on), 'dd-MM-yyyy')} y {nextWeightLog?.weight_kg} kg · {format(parseISO(nextWeightLog.logged_on), 'dd-MM-yyyy')}
                        </div>
                      </div>
                    ) : (
                      <>
                        {!isExactMatch && closestWeightDate && (
                          <span className="text-xs text-purple-400/70 mt-1">
                            {format(closestWeightDate, 'dd-MM-yyyy')} ({relativeWeightLabel})
                          </span>
                        )}
                        {!isExactMatch && interpolatedWeight && (
                          <div className="text-xs text-purple-200/80 mt-1">
                            Peso estimado (media aproximada): {interpolatedWeight.toFixed(1)} kg
                          </div>
                        )}
                      </>
                    )}
                </div>
                
                {isAdminView && (
                  <div className="p-3 rounded-lg border border-gray-700 space-y-3 flex-col justify-center w-full">
                      <Badge variant="silver" className="w-full justify-start text-left h-auto py-1.5 px-3 bg-transparent border-none">
                          <ShieldAlert className="w-5 h-5 mr-3 flex-shrink-0 text-orange-400" />
                          <span className="font-semibold mr-2 text-orange-400">Evita:</span>
                          <div className="flex flex-wrap gap-1.5 flex-1">
                          {allSensitivities.length > 0 ? allSensitivities.map(s => <InfoBadge key={s.id} item={s} type="sensitivity" />) : <span className="text-gray-400 text-sm">Ninguna</span>}
                          </div>
                      </Badge>
                      <Badge variant="silver" className="w-full justify-start text-left h-auto py-1.5 px-3 bg-transparent border-none">
                          <HeartPulse className="w-5 h-5 mr-3 flex-shrink-0 text-red-400" />
                          <span className="font-semibold mr-2 text-red-400">Patologías:</span>
                          <div className="flex flex-wrap gap-1.5 flex-1">
                          {allMedicalConditions.length > 0 ? allMedicalConditions.map(p => <InfoBadge key={p.id} item={p} type="medical_condition" />) : <span className="text-gray-400 text-sm">Ninguna</span>}
                          </div>
                      </Badge>
                  </div>
                )}

                {isAdminView && reminders.length > 0 && (
                    <div className="p-3 rounded-lg border border-gray-700 space-y-3">
                        <h4 className="font-semibold text-amber-300 text-sm flex items-center gap-2"><StickyNote className="w-4 h-4"/>Recordatorios para hoy</h4>
                        {notes.length > 0 && (
                            <div className="space-y-2">
                                <h5 className="text-xs font-bold uppercase text-amber-400/80">Notas</h5>
                                {notes.map(r => (
                                    <div key={r.id} onClick={() => handleEditReminder(r)} className="text-sm bg-slate-800/50 p-2 rounded-md cursor-pointer hover:bg-slate-800 transition-colors">
                                        <p className="font-bold text-amber-200 flex items-center gap-2">{r.title || 'Nota'} <Badge className={cn("font-normal text-xs", categoryColors[r.category])}>{r.category}</Badge></p>
                                        <p className="text-amber-200/80">{r.content}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                         {events.length > 0 && (
                            <div className="space-y-2">
                                <h5 className="text-xs font-bold uppercase text-amber-400/80">Eventos</h5>
                                {events.map(r => (
                                    <div key={r.id} onClick={() => handleEditReminder(r)} className="text-sm bg-slate-800/50 p-2 rounded-md cursor-pointer hover:bg-slate-800 transition-colors">
                                        <p className="font-bold text-amber-200 flex items-center gap-2">{r.title || 'Evento'} <Badge className={cn("font-normal text-xs", categoryColors[r.category])}>{r.category}</Badge></p>
                                        <p className="text-amber-200/80">{r.content}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
            <div className="hidden lg:block">
                {renderVisualizer()}
            </div>
          </CardContent>
        </Card>

        <div className="lg:hidden sticky top-16 z-30 bg-slate-900/95 backdrop-blur-sm -mx-1 sm:mx-0 px-1 sm:px-0 py-2 rounded-b-xl shadow-[0_8px_15px_-5px_rgba(0,0,0,0.3)]">
            {renderVisualizer(true)}
        </div>

        <Card className="bg-slate-900/50 border-gray-700 text-white shadow-xl">
            <div className="p-4 border-b border-slate-800">
                <ContentStateToggle
                    mode={viewMode}
                    onModeChange={(newMode) => setViewMode(newMode)}
                    optionOne={{ value: 'list', label: 'Día', icon: List }}
                    optionTwo={{ value: 'week', label: 'Semana', icon: Calendar }}
                    isSegmented={true}
                    className="w-full"
                />
            </div>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>{viewMode === 'list' ? 'Comidas del día' : 'Planificación de semana'}</CardTitle>
                        {viewMode === 'week' && <CardDescription className="text-gray-400">Planifica tu semana y revisa la Compra Inteligente</CardDescription>}
                    </div>
                    <div className="flex items-center gap-4">
                        <Button variant="outline" size="icon" className="bg-transparent border-[rgb(59_154_167)] text-[rgb(59_154_167)] hover:bg-[rgb(28_53_61)] hover:text-[rgb(59_154_167)]" onClick={handleShoppingListClick}>
                            <ShoppingCart className="w-5 h-5" />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="px-3">
                {!activePlan ? (
                <div className="text-center text-yellow-400 p-8 bg-yellow-900/20 rounded-lg flex flex-col items-center gap-4">
                    <AlertTriangle className="w-10 h-10" />
                    <p className="font-semibold text-lg">
                        {planStatus.hasPlans && planStatus.closestPlanLabel 
                            ? `No hay plan activo. El plan más cercano es del ${format(parseISO(planStatus.closestPlanLabel), 'dd-MM-yyyy')}`
                            : "No hay planes de dieta asignados"
                        }
                    </p>
                    {isAdminView ? (
                    <Button onClick={() => navigate(`/admin/manage-diet/${userId}`)}>Gestionar Planes</Button>
                    ) : (
                    <p className="text-sm text-yellow-300/80">Contacta con tu entrenador para que te asigne un plan de dieta.</p>
                    )}
                </div>
                ) : (
                <WeeklyDietPlanner 
                    ref={plannerRef}
                    isAdminView={isAdminView} 
                    userId={userId}
                    viewMode={viewMode}
                    logDate={logDate}
                    currentDate={currentDate}
                    activePlan={activePlan}
                    onAddRecipeClick={handleOpenAddRecipe}
                    onPlanUpdate={handlePlanUpdate}
                    plannedMeals={plannedMeals}
                    setPlannedMeals={setPlannedMeals}
                    userRestrictions={combinedPlanRestrictions}
                />
                )}
            </CardContent>
        </Card>
      </div>
      <WeightLogDialog 
        open={isWeightLogOpen} 
        onOpenChange={setIsWeightLogOpen} 
        onLogAdded={onWeightLogAdded}
        userId={userId}
        initialDate={currentDate}
      />
      <AddRecipeToPlanDialog
          open={isAddRecipeOpen}
          onOpenChange={setIsAddRecipeOpen}
          dietPlanId={activePlan?.id}
          onRecipeSelected={handleRecipeSelectedForAssignment}
          userId={userId}
          preselectedMeal={mealToAddTo}
          mealDate={mealDateToAddTo}
          isConstructor={false}
          mode={addRecipeMode}
          planRestrictions={combinedPlanRestrictions}
      />
      <ReminderFormDialog
        isOpen={isReminderFormOpen}
        onOpenChange={setIsReminderFormOpen}
        onSave={handleReminderSave}
        reminder={editingReminder}
        userId={userId}
      />
      {recipeToAssign && (
        <AssignRecipeDialog
            open={isAssignRecipeOpen}
            onOpenChange={setIsAssignRecipeOpen}
            onAssign={handleRecipeAssigned}
            weekDates={plannerRef.current?.getWeekDates() || []}
            recipe={recipeToAssign}
            meal={mealToAddTo}
            dietPlanId={activePlan?.id}
            userId={userId}
            initialDate={mealDateToAddTo}
        />
      )}
    </div>
  );
};

export default DietPlanComponent;
