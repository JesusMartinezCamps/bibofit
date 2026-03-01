import React, { useState, useCallback, useMemo, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import RecipeEditorModal from '../RecipeEditorModal/RecipeEditorModal';
import { useAuth } from '@/contexts/AuthContext';
import WeekView from './WeekView';
import ListView from './ListView';
import { format, addDays, parseISO, isValid, isSameDay } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import FreeRecipeSelectorDialog from '@/components/plans/FreeRecipeSelectorDialog';
import RepeatFreeRecipeDialog from '@/components/plans/RepeatFreeRecipeDialog';
import SnackSelectorDialog from '@/components/plans/SnackSelectorDialog';
import RepeatSnackDialog from '@/components/plans/RepeatSnackDialog';
import SnackCard from '@/components/plans/SnackCard';
import SnackEditorModal from '@/components/plans/SnackEditorModal';
import EquivalenceDialog from '@/components/plans/EquivalenceDialog';
import { calculateMacros } from '@/lib/macroCalculator';
import { usePlanItems } from './hooks/usePlanItems';
import { useMealLogging } from './hooks/useMealLogging';

const getAdjustmentsForRecipe = (dailyIngredientAdjustments, equivalenceAdjustments, recipeId, userDayMealId, logDate, isPrivate) => {
    if (!dailyIngredientAdjustments || !equivalenceAdjustments) return null;

    const eqAdjustment = equivalenceAdjustments.find(adj => adj.target_user_day_meal_id === userDayMealId && adj.log_date === logDate);
    if (!eqAdjustment) return null;

    const recipeAdjustments = dailyIngredientAdjustments.filter(dia => {
        return dia.equivalence_adjustment_id === eqAdjustment.id &&
            (isPrivate ? dia.private_recipe_id === recipeId : dia.diet_plan_recipe_id === recipeId);
    });

    return recipeAdjustments.length > 0 ? recipeAdjustments : null;
};

const applyIngredientAdjustments = (ingredients, adjustments) => {
    if (!adjustments || adjustments.length === 0) return ingredients;

    return ingredients.map(ing => {
        const foodId = ing.food_id || ing.food?.id;
        const adjustment = adjustments.find(adj => {
            const targetFoodId = adj.food_id || adj.food?.id;
            return targetFoodId === foodId;
        });

        if (!adjustment) return ing;

        return {
            ...ing,
            grams: adjustment.adjusted_grams ?? adjustment.grams ?? ing.grams,
        };
    });
};

const negateMacros = (macros) => macros ? {
    calories: -(macros.calories || 0),
    proteins: -(macros.proteins || 0),
    carbs: -(macros.carbs || 0),
    fats: -(macros.fats || 0),
} : null;

const normalizeDateKey = (value) => {
    if (!value) return value;

    const parsed = parseISO(value);
    return isValid(parsed) ? format(parsed, 'yyyy-MM-dd') : value;
};


const WeeklyDietPlanner = forwardRef(({ isAdminView, userId, viewMode = 'week', logDate: propLogDate, currentDate, activePlan, onAddRecipeClick, onPlanUpdate, plannedMeals, setPlannedMeals, userRestrictions, onWeekSummaryChange }, ref) => {
    const { toast } = useToast();
    const { user } = useAuth();
    const navigate = useNavigate();
    // Initialize as empty array to prevent null access in WeekView
    const dayElementsRef = useRef([]); 

    const logDate = useMemo(() => {
        const date = parseISO(propLogDate);
        return isValid(date) ? format(date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
    }, [propLogDate]);

    const weekDates = useMemo(() => {
        const start = viewMode === 'week' ? currentDate : addDays(parseISO(logDate), -3);
        return Array.from({ length: 7 }).map((_, i) => addDays(start, i));
    }, [currentDate, viewMode, logDate]);

    const { 
        planRecipes, 
        setPlanRecipes,
        freeMeals, 
        setFreeMeals, 
        mealLogs: initialMealLogs, 
        userDayMeals, 
        adjustments,
        setAdjustments,
        fetchAndSetPlanItems, 
        loading: planLoading, 
        error: planError, 
        snacks,
        setSnacks, 
        snackLogs,
        setSnackLogs,
        dailyIngredientAdjustments,
        setDailyIngredientAdjustments,
        equivalenceAdjustments,
        setEquivalenceAdjustments,
        allAvailableFoods,
    } = usePlanItems(userId, activePlan, weekDates, setPlannedMeals);
    
    const ingredientCache = useMemo(() => {
        const map = new Map();

        planRecipes.forEach(recipe => {
            const baseIngredients = recipe.type === 'recipe'
                ? ((recipe.custom_ingredients && recipe.custom_ingredients.length > 0)
                    ? recipe.custom_ingredients
                    : (recipe.recipe?.recipe_ingredients || []))
                : (recipe.private_recipe_ingredients || []);
            map.set(recipe.dnd_id, baseIngredients);
        });

        freeMeals.forEach(freeMeal => {
            const mealDateKey = normalizeDateKey(freeMeal.meal_date);
            map.set(`free-${freeMeal.occurrence_id}|${mealDateKey}`, freeMeal.free_recipe_ingredients || []);
        });

        snacks.forEach(snack => {
            const mealDateKey = normalizeDateKey(snack.meal_date);
            map.set(`snack-${snack.occurrence_id}|${mealDateKey}`, snack.snack_ingredients || []);
        });

        return map;
    }, [planRecipes, freeMeals, snacks]);

    const resolveIngredientsForToggle = useCallback((togglePayload) => {
        if (!togglePayload) return null;

        const { recipeType, recipeId, freeRecipeOccurrenceId, logDate, userDayMealId } = togglePayload;

        if (recipeType === 'free_recipe') {
            return ingredientCache.get(`free-${freeRecipeOccurrenceId}|${logDate}`)
                || freeMeals.find(fm => fm.occurrence_id === freeRecipeOccurrenceId)?.free_recipe_ingredients
                || null;
        }

        if (recipeType === 'snack') {
            return ingredientCache.get(`snack-${freeRecipeOccurrenceId}|${logDate}`)
                || snacks.find(sn => sn.occurrence_id === freeRecipeOccurrenceId)?.snack_ingredients
                || null;
        }

        const dndId = recipeType === 'recipe' ? `recipe-${recipeId}` : `private-${recipeId}`;
        const baseIngredients = ingredientCache.get(dndId) || null;

        if (!baseIngredients) return null;

        const adjustments = getAdjustmentsForRecipe(
            dailyIngredientAdjustments,
            equivalenceAdjustments,
            recipeId,
            userDayMealId,
            logDate,
            recipeType === 'private_recipe'
        );

        return applyIngredientAdjustments(baseIngredients, adjustments);
    }, [dailyIngredientAdjustments, equivalenceAdjustments, freeMeals, ingredientCache, snacks]);

    const calculateMacrosForPayload = useCallback((payload) => {
        if (!payload || !allAvailableFoods || allAvailableFoods.length === 0) return null;

        const ingredients = resolveIngredientsForToggle(payload);
        if (!ingredients || ingredients.length === 0) return null;

        return calculateMacros(ingredients, allAvailableFoods);
    }, [allAvailableFoods, resolveIngredientsForToggle]);

    const computeMacroDelta = useCallback((togglePayload) => {
        if (!togglePayload) return null;

        const deltas = [];

        if (togglePayload.action === 'replace' && togglePayload.previousLog) {
            const previousMacros = calculateMacrosForPayload(togglePayload.previousLog);
            if (previousMacros) {
                deltas.push(negateMacros(previousMacros));
            }
        }

        const currentMacros = calculateMacrosForPayload(togglePayload);
        if (currentMacros) {
            deltas.push(togglePayload.action === 'remove' ? negateMacros(currentMacros) : currentMacros);
        }

        if (deltas.length === 0) return null;

        return deltas.reduce((acc, delta) => ({
            calories: (acc.calories || 0) + (delta?.calories || 0),
            proteins: (acc.proteins || 0) + (delta?.proteins || 0),
            carbs: (acc.carbs || 0) + (delta?.carbs || 0),
            fats: (acc.fats || 0) + (delta?.fats || 0),
        }), {});
    }, [calculateMacrosForPayload]);

    const onMealLogUpdate = useCallback((togglePayload) => {
        const macroDelta = computeMacroDelta(togglePayload);
        if (onPlanUpdate) onPlanUpdate({ ...togglePayload, macroDelta });
    }, [computeMacroDelta, onPlanUpdate]);
    const { 
        selectedMealLogs, 
        mealCounts, 
        handleToggleMealSelection,
        allMealLogs,
        setAllMealLogs,
        processMealLogs
    } = useMealLogging(userId, initialMealLogs, userDayMeals, onMealLogUpdate);

    const weekSummaryByDate = useMemo(() => {
        const summary = {};
        weekDates.forEach(date => {
            const key = format(date, 'yyyy-MM-dd');
            summary[key] = {
                planned: 0,
                logged: 0,
                loggedRecipe: 0,
                loggedPrivate: 0,
                loggedFree: 0,
                snacksLogged: 0,
                freeAvailable: 0,
                snacksAvailable: 0,
            };
        });

        (plannedMeals || []).forEach(item => {
            if (summary[item.plan_date]) summary[item.plan_date].planned += 1;
        });

        (allMealLogs || []).forEach(log => {
            if (!summary[log.log_date]) return;
            summary[log.log_date].logged += 1;
            if (log.private_recipe_id) summary[log.log_date].loggedPrivate += 1;
            else if (log.free_recipe_occurrence_id) summary[log.log_date].loggedFree += 1;
            else if (log.diet_plan_recipe_id) summary[log.log_date].loggedRecipe += 1;
        });

        (snackLogs || []).forEach(log => {
            if (summary[log.log_date]) summary[log.log_date].snacksLogged += 1;
        });

        (freeMeals || []).forEach(item => {
            if (summary[item.meal_date]) summary[item.meal_date].freeAvailable += 1;
        });

        (snacks || []).forEach(item => {
            if (summary[item.meal_date]) summary[item.meal_date].snacksAvailable += 1;
        });

        return summary;
    }, [weekDates, plannedMeals, allMealLogs, snackLogs, freeMeals, snacks]);

    useEffect(() => {
        if (onWeekSummaryChange) onWeekSummaryChange(weekSummaryByDate);
    }, [onWeekSummaryChange, weekSummaryByDate]);

    const [recipeToEdit, setRecipeToEdit] = useState(null);
    const [recipeAdjustment, setRecipeAdjustment] = useState(null);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    
    const [isFreeMealSelectorOpen, setIsFreeMealSelectorOpen] = useState(false);
    const [isRepeatFreeRecipeOpen, setIsRepeatFreeRecipeOpen] = useState(false);
    const [preselectedMealInfo, setPreselectedMealInfo] = useState({ mealId: null, date: null });

    const [isSnackSelectorOpen, setIsSnackSelectorOpen] = useState(false);
    const [isRepeatSnackOpen, setIsRepeatSnackOpen] = useState(false);
    const [snackToEdit, setSnackToEdit] = useState(null);
    const [isSnackEditorOpen, setIsSnackEditorOpen] = useState(false);
    
    const [equivalenceData, setEquivalenceData] = useState(null);
    const [isEquivalenceDialogOpen, setIsEquivalenceDialogOpen] = useState(false);
    const [closeSnackEditorOnEquivalence, setCloseSnackEditorOnEquivalence] = useState(false);

    useImperativeHandle(ref, () => ({
        refreshItems: fetchAndSetPlanItems,
        getWeekDates: () => weekDates,
        getIngredientCache: () => ingredientCache,
        scrollToDay(date) {
            const dayIndex = weekDates.findIndex(d => isSameDay(d, date));
            if (dayIndex !== -1 && dayElementsRef.current && dayElementsRef.current[dayIndex]) {
                dayElementsRef.current[dayIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        },
    }));

    const handleOpenEquivalence = useCallback(({ item, type, macros, logId, closeSnackEditor = false }) => {
        setEquivalenceData({
            item,
            type,
            macros,
            logId,
        });
        setCloseSnackEditorOnEquivalence(closeSnackEditor);
        setIsEquivalenceDialogOpen(true);
    }, []);

    const handleEquivalenceOpenChange = useCallback((isOpen) => {
        setIsEquivalenceDialogOpen(isOpen);
        if (!isOpen) {
            setEquivalenceData(null);
            setCloseSnackEditorOnEquivalence(false);
        }
    }, []);
    
    const handleEquivalenceSuccess = useCallback((newAdjustment) => {
        if (newAdjustment) {
            setEquivalenceAdjustments(prev => [...prev, newAdjustment]);
            setAdjustments(prev => [...prev, newAdjustment]);
        }
        setIsEquivalenceDialogOpen(false);
        setEquivalenceData(null);
        if (closeSnackEditorOnEquivalence) {
            setIsSnackEditorOpen(false);
            setCloseSnackEditorOnEquivalence(false);
        }
    }, [setEquivalenceAdjustments, setAdjustments, closeSnackEditorOnEquivalence]);

    const handleRecipeClick = useCallback(async (planRecipe, adjustment, date) => {
        setRecipeToEdit(planRecipe);
        setRecipeAdjustment(adjustment);
        setIsEditorOpen(true);
    }, []);

    const handleFreeMealClick = useCallback(async (freeMeal) => {
        const recipeAdapter = {
            ...freeMeal,
            type: 'free_recipe',
            is_customized: true, 
        };
        setRecipeToEdit(recipeAdapter);
        setRecipeAdjustment(null);
        setIsEditorOpen(true);
    }, []);

    const handleEditorSave = useCallback((updatedRecipe, saveType) => {
        fetchAndSetPlanItems();
        setIsEditorOpen(false);
    }, [fetchAndSetPlanItems]);

    const handleFreeMealUpdate = useCallback((newLog, newFreeMealWithOccurrence) => {
        setFreeMeals(prev => {
            const existingIndex = prev.findIndex(fm => fm.occurrence_id === newFreeMealWithOccurrence.occurrence_id);
            if (existingIndex !== -1) {
                const updated = [...prev];
                updated[existingIndex] = newFreeMealWithOccurrence;
                return updated;
            }
            return [...prev, newFreeMealWithOccurrence];
        });

        const updatedLogs = allMealLogs.filter(log => !(log.log_date === newLog.log_date && log.user_day_meal_id === newLog.user_day_meal_id));
        updatedLogs.push(newLog);
        setAllMealLogs(updatedLogs);
        processMealLogs(updatedLogs);

        if (onPlanUpdate) onPlanUpdate();
    }, [onPlanUpdate, setFreeMeals, allMealLogs, setAllMealLogs, processMealLogs]);

    const handleRemovePlannedMealOptimistic = useCallback(async (plannedMealId) => {
        const originalPlannedMeals = [...plannedMeals];
        setPlannedMeals(prev => prev.filter(p => p.id !== plannedMealId));

        const { error } = await supabase.from('planned_meals').delete().eq('id', plannedMealId);
        if (error) {
            toast({ title: 'Error', description: 'No se pudo eliminar la comida. Inténtalo de nuevo.', variant: 'destructive' });
            setPlannedMeals(originalPlannedMeals);
        }
    }, [plannedMeals, toast, setPlannedMeals]);

    const handleRemoveFreeMealFromLog = useCallback(async (occurrenceId) => {
        const originalFreeMeals = [...freeMeals];
        const originalLogs = [...allMealLogs];
        
        const adjustmentToDelete = equivalenceAdjustments.find(adj => adj.source_free_recipe_occurrence_id === occurrenceId);
        
        if (adjustmentToDelete) {
             setEquivalenceAdjustments(prev => prev.filter(a => a.id !== adjustmentToDelete.id));
             setAdjustments(prev => prev.filter(a => a.id !== adjustmentToDelete.id));
             setDailyIngredientAdjustments(prev => prev.filter(dia => dia.equivalence_adjustment_id !== adjustmentToDelete.id));
        }

        const updatedFreeMeals = freeMeals.filter(fm => fm.occurrence_id !== occurrenceId);
        const updatedLogs = allMealLogs.filter(log => log.free_recipe_occurrence_id !== occurrenceId);
        
        setFreeMeals(updatedFreeMeals);
        setAllMealLogs(updatedLogs);
        processMealLogs(updatedLogs);

        try {
            await supabase
                .from('equivalence_adjustments')
                .delete()
                .eq('source_free_recipe_occurrence_id', occurrenceId);

            const { error: logError } = await supabase
                .from('daily_meal_logs')
                .delete()
                .match({ free_recipe_occurrence_id: occurrenceId });

            if (logError) console.warn("Could not delete meal log, it might not exist.", logError);

            const { error: occurrenceError } = await supabase
                .from('free_recipe_occurrences')
                .delete()
                .eq('id', occurrenceId);

            if (occurrenceError) throw occurrenceError;

            if (onPlanUpdate) onPlanUpdate();
            toast({ title: 'Éxito', description: 'Receta libre eliminada de este día.' });
        } catch (error) {
            setFreeMeals(originalFreeMeals);
            setAllMealLogs(originalLogs);
            processMealLogs(originalLogs);
            fetchAndSetPlanItems();
            toast({ title: 'Error', description: `No se pudo eliminar la receta: ${error.message}`, variant: 'destructive' });
        }
    }, [freeMeals, allMealLogs, equivalenceAdjustments, onPlanUpdate, toast, setFreeMeals, setAllMealLogs, processMealLogs, fetchAndSetPlanItems, setEquivalenceAdjustments, setAdjustments, setDailyIngredientAdjustments]);

    const handleRemoveFreeMealPermanently = useCallback(async (freeRecipeId) => {
        try {
            const { error } = await supabase.rpc('delete_free_recipe_and_occurrences', { p_free_recipe_id: freeRecipeId });
            if (error) throw error;

            toast({ title: 'Éxito', description: 'Receta libre eliminada permanentemente.' });
            
            setFreeMeals(prev => prev.filter(fm => fm.id !== freeRecipeId));
            const updatedLogs = allMealLogs.filter(log => {
                const occurrence = freeMeals.find(fm => fm.id === freeRecipeId && fm.occurrence_id === log.free_recipe_occurrence_id);
                return !occurrence;
            });
            setAllMealLogs(updatedLogs);
            processMealLogs(updatedLogs);

            if (onPlanUpdate) onPlanUpdate();
            return true;
        } catch (error) {
            toast({ title: 'Error', description: `No se pudo eliminar la receta libre: ${error.message}`, variant: 'destructive' });
            return false;
        }
    }, [toast, freeMeals, allMealLogs, setFreeMeals, setAllMealLogs, processMealLogs, onPlanUpdate]);

    const handleRemoveRecipe = useCallback(async (recipeId, isPrivate) => {
        try {
            if (isPrivate) {
                const { error } = await supabase.rpc('delete_private_recipe_cascade', { p_recipe_id: recipeId });
                if (error) throw error;

                setPlanRecipes(prev => prev.filter(r => !(r.id === recipeId && r.is_private)));
                toast({ title: 'Éxito', description: 'Receta privada eliminada.' });
            } else if (isAdminView) {
                const { error } = await supabase.rpc('delete_diet_plan_recipe_with_dependencies', { p_recipe_id: recipeId });
                if (error) {
                    console.error("Error with delete_diet_plan_recipe_with_dependencies:", error);
                     try {
                        await supabase.from('diet_change_requests').delete().eq('diet_plan_recipe_id', recipeId);
                        await supabase.from('daily_meal_logs').delete().eq('diet_plan_recipe_id', recipeId);
                        await supabase.from('diet_plan_recipe_ingredients').delete().eq('diet_plan_recipe_id', recipeId);
                        await supabase.from('recipe_macros').delete().eq('diet_plan_recipe_id', recipeId);
                        await supabase.from('diet_plan_recipes').delete().eq('id', recipeId);
                    } catch (manualError) {
                         throw error; 
                    }
                }
                
                setPlanRecipes(prev => prev.filter(r => !(r.id === recipeId && !r.is_private)));
                toast({ title: 'Éxito', description: 'Receta del plan eliminada.' });
            }
            
            const updatedLogs = allMealLogs.filter(log => {
                if (isPrivate) return log.private_recipe_id !== recipeId;
                return log.diet_plan_recipe_id !== recipeId;
            });
            setAllMealLogs(updatedLogs);
            processMealLogs(updatedLogs);
            if (onPlanUpdate) onPlanUpdate();

            fetchAndSetPlanItems();

        } catch (error) {
            console.error("Error deleting recipe:", error);
            toast({ title: 'Error', description: `No se pudo eliminar la receta: ${error.message}`, variant: 'destructive' });
        }
    }, [isAdminView, allMealLogs, onPlanUpdate, toast, setPlanRecipes, setAllMealLogs, processMealLogs, fetchAndSetPlanItems]);

    const handleSnackUpdate = useCallback((newLog, newSnackWithOccurrence) => {
        const unifiedIngredients = newSnackWithOccurrence.snack_ingredients.map(ing => {
            const food = ing.food;
            return {
                ...ing,
                food,
                is_user_created: !!ing.is_user_created,
                food_id: food?.id,
                quantity: ing.grams
            };
        });
    
        const snackWithUnifiedIngredients = { ...newSnackWithOccurrence, snack_ingredients: unifiedIngredients };
    
        setSnacks(prev => {
            const existingIndex = prev.findIndex(s => s.occurrence_id === newSnackWithOccurrence.occurrence_id);
            if (existingIndex > -1) {
                const updated = [...prev];
                updated[existingIndex] = snackWithUnifiedIngredients;
                return updated;
            }
            return [...prev, snackWithUnifiedIngredients];
        });
    
        if (newLog) {
            setSnackLogs(prev => {
                const existingIndex = prev.findIndex(l => l.id === newLog.id);
                if (existingIndex > -1) {
                    const updated = [...prev];
                    updated[existingIndex] = newLog;
                    return updated;
                }
                return [...prev, newLog];
            });
    
            const snackMacros = calculateMacros(snackWithUnifiedIngredients.snack_ingredients, allAvailableFoods);
            
            handleOpenEquivalence({
                item: snackWithUnifiedIngredients,
                type: 'snack',
                macros: snackMacros,
                logId: newLog.id,
            });
            setIsEquivalenceDialogOpen(true);
        }
    
        if (onPlanUpdate) onPlanUpdate();
    }, [onPlanUpdate, setSnacks, setSnackLogs, allAvailableFoods, handleOpenEquivalence]);

    const handleRemoveSnackFromLog = useCallback(async (occurrenceId) => {
        const logToDelete = snackLogs.find(l => l.snack_occurrence_id === occurrenceId);
        const eqAdjustmentToDelete = logToDelete ? equivalenceAdjustments.find(adj => adj.source_daily_snack_log_id === logToDelete.id) : null;

        setSnacks(prev => prev.filter(s => s.occurrence_id !== occurrenceId));
        setSnackLogs(prev => prev.filter(l => l.snack_occurrence_id !== occurrenceId));
        if (logToDelete) {
            setEquivalenceAdjustments(prev => prev.filter(adj => adj.source_daily_snack_log_id !== logToDelete.id));
            setAdjustments(prev => prev.filter(adj => adj.source_daily_snack_log_id !== logToDelete.id));
        }
        if (eqAdjustmentToDelete) {
            setDailyIngredientAdjustments(prev => prev.filter(dia => dia.equivalence_adjustment_id !== eqAdjustmentToDelete.id));
        }

        try {
            if (logToDelete) {
                await supabase.from('equivalence_adjustments').delete().eq('source_daily_snack_log_id', logToDelete.id);
                await supabase.from('daily_snack_logs').delete().eq('id', logToDelete.id);
            }
            await supabase.from('snack_occurrences').delete().eq('id', occurrenceId);
            
            if (onPlanUpdate) onPlanUpdate();
            toast({ title: 'Éxito', description: 'Picoteo eliminado de este día.' });
        } catch (error) {
            toast({ title: 'Error', description: `No se pudo eliminar el picoteo: ${error.message}`, variant: 'destructive' });
            fetchAndSetPlanItems();
        }
    }, [onPlanUpdate, toast, fetchAndSetPlanItems, setSnacks, setSnackLogs, snackLogs, setAdjustments, setEquivalenceAdjustments, setDailyIngredientAdjustments, equivalenceAdjustments]);

    const handleUndoEquivalence = useCallback(async (sourceDailySnackLogId, equivalenceAdjustmentId) => {
        setEquivalenceAdjustments(prev => prev.filter(adj => adj.id !== equivalenceAdjustmentId));
        setAdjustments(prev => prev.filter(adj => adj.id !== equivalenceAdjustmentId));
        setDailyIngredientAdjustments(prev => prev.filter(dia => dia.equivalence_adjustment_id !== equivalenceAdjustmentId));
    
        try {
            const { error } = await supabase.from('equivalence_adjustments').delete().eq('id', equivalenceAdjustmentId);
            if (error) throw error;
    
            toast({ title: 'Éxito', description: 'La equivalencia ha sido deshecha. Las recetas han vuelto a su estado original.' });
            if (onPlanUpdate) onPlanUpdate();
            fetchAndSetPlanItems();
    
        } catch (error) {
            toast({ title: 'Error', description: `No se pudo deshacer la equivalencia: ${error.message}`, variant: 'destructive' });
            fetchAndSetPlanItems();
        }
    }, [onPlanUpdate, toast, fetchAndSetPlanItems, setEquivalenceAdjustments, setAdjustments, setDailyIngredientAdjustments]);

    const handleToggleSnackSelection = useCallback(async (snack) => {
        const log = snackLogs.find(l => l.snack_occurrence_id === snack.occurrence_id);
        if (log) {
            const eqAdjustmentToDelete = equivalenceAdjustments.find(adj => adj.source_daily_snack_log_id === log.id);
            
            setSnackLogs(prev => prev.filter(l => l.snack_occurrence_id !== snack.occurrence_id));
            setEquivalenceAdjustments(prev => prev.filter(adj => adj.source_daily_snack_log_id !== log.id));
            setAdjustments(prev => prev.filter(adj => adj.source_daily_snack_log_id !== log.id));
            if (eqAdjustmentToDelete) {
                setDailyIngredientAdjustments(prev => prev.filter(dia => dia.equivalence_adjustment_id !== eqAdjustmentToDelete.id));
            }

            try {
                await supabase.from('equivalence_adjustments').delete().eq('source_daily_snack_log_id', log.id);
                await supabase.from('daily_snack_logs').delete().eq('id', log.id);

                toast({ title: 'Éxito', description: 'Picoteo desmarcado.' });
                if (onPlanUpdate) onPlanUpdate();
            } catch (error) {
                toast({ title: 'Error', description: `No se pudo desmarcar: ${error.message}`, variant: 'destructive' });
                fetchAndSetPlanItems();
            }
        } else {
            try {
                const userDayMeal = userDayMeals.find(udm => udm.day_meal_id === snack.day_meal_id);
                if (!userDayMeal) throw new Error("Configuración de comida de usuario no encontrada.");

                const { data: newLog, error } = await supabase.from('daily_snack_logs').insert({
                    user_id: userId,
                    log_date: snack.meal_date,
                    snack_occurrence_id: snack.occurrence_id,
                    user_day_meal_id: userDayMeal.id,
                }).select().single();
                if (error) throw error;
                
                const newSnackWithOccurrence = {
                    ...snack,
                    snack_ingredients: snack.snack_ingredients || [],
                }
                handleSnackUpdate(newLog, newSnackWithOccurrence);

                toast({ title: 'Éxito', description: 'Picoteo marcado como comido.' });
                if (onPlanUpdate) onPlanUpdate();
            } catch (error) {
                toast({ title: 'Error', description: `No se pudo marcar: ${error.message}`, variant: 'destructive' });
            }
        }
    }, [snackLogs, userId, onPlanUpdate, toast, fetchAndSetPlanItems, setSnackLogs, setAdjustments, setEquivalenceAdjustments, setDailyIngredientAdjustments, equivalenceAdjustments, handleSnackUpdate, userDayMeals]);

    const handleRemoveSnackPermanently = useCallback(async (snackId) => {
        try {
            const { error } = await supabase.rpc('delete_snack_and_dependencies', { p_snack_id: snackId });
            if (error) throw error;
            
            toast({ title: 'Éxito', description: 'Picoteo eliminado permanentemente.' });
            setSnacks(prev => prev.filter(s => s.id !== snackId));
            setIsSnackEditorOpen(false);
            if (onPlanUpdate) onPlanUpdate();
            return true;
        } catch (error) {
            toast({ title: 'Error', description: `No se pudo eliminar el picoteo: ${error.message}`, variant: 'destructive' });
            return false;
        }
    }, [toast, setSnacks, onPlanUpdate]);

    const handleSnackCardClick = useCallback((snack) => {
        setSnackToEdit(snack);
        setIsSnackEditorOpen(true);
    }, []);

    const groupedByMeal = useMemo(() => {
        const dailyPlanRecipes = planRecipes.map(r => {
             const recipeAdjustment = getAdjustmentsForRecipe(
                dailyIngredientAdjustments,
                equivalenceAdjustments,
                r.id,
                userDayMeals.find(udm => udm.day_meal_id === r.day_meal_id)?.id,
                logDate,
                r.is_private
            );

            return { 
                ...r, 
                selectionCount: mealCounts[r.dnd_id] || 0,
                adjustment: recipeAdjustment 
            };
        });

        const dailyFreeMeals = freeMeals
            .filter(item => item.meal_date === logDate)
            .map(fm => ({ ...fm, selectionCount: mealCounts[fm.dnd_id] || 0 }));

        const loggedSnackOccurrenceIds = new Set(snackLogs.filter(l => l.log_date === logDate).map(l => l.snack_occurrence_id));
        const dailySnacks = snacks
            .filter(item => item.meal_date === logDate)
            .map(s => {
                const isSelected = loggedSnackOccurrenceIds.has(s.occurrence_id);
                
                return { 
                    ...s, 
                    type: 'snack',
                    isSelected,
                    itemContent: (
                        <SnackCard
                            key={s.occurrence_id}
                            snack={s}
                            allFoods={allAvailableFoods}
                            onRemove={() => handleRemoveSnackFromLog(s.occurrence_id)}
                            onToggle={() => handleToggleSnackSelection(s)}
                            onClick={() => handleSnackCardClick(s)}
                            isSelected={isSelected}
                        />
                    )
                };
            });
        
        const dailyItems = [...dailyPlanRecipes, ...dailyFreeMeals, ...dailySnacks];

        const mealGroups = userDayMeals.reduce((acc, userMeal) => {
            const mealName = userMeal.day_meal.name;
            const itemsForMeal = dailyItems.filter(item => (item.day_meal_id || item.day_meal?.id) === userMeal.day_meal_id);
            acc[mealName] = { items: itemsForMeal, mealId: userMeal.id, name: mealName };
            return acc;
        }, {});
        
        const orderedMealGroups = {};
        const sortedUserDayMeals = [...userDayMeals].sort((a, b) => a.day_meal.display_order - b.day_meal.display_order);

        sortedUserDayMeals.forEach(udm => {
            const mealName = udm.day_meal.name;
            if(mealGroups[mealName]) {
                orderedMealGroups[mealName] = mealGroups[mealName];
            } else {
                 orderedMealGroups[mealName] = { items: [], mealId: udm.id, name: mealName };
            }
        });

        return orderedMealGroups;
    }, [userDayMeals, planRecipes, freeMeals, snacks, mealCounts, logDate, snackLogs, allAvailableFoods, handleRemoveSnackFromLog, handleToggleSnackSelection, handleSnackCardClick, dailyIngredientAdjustments, equivalenceAdjustments]);

    const handleAddFreeMeal = (userDayMealId, mealName) => {
        const userDayMeal = userDayMeals.find(udm => udm.id === userDayMealId);
        if (userDayMeal) {
            const date = parseISO(logDate);
            setPreselectedMealInfo({ mealId: userDayMeal.day_meal_id, date });
            setIsFreeMealSelectorOpen(true);
        }
    };

    const handleAddSnack = (userDayMealId, mealName) => {
        const userDayMeal = userDayMeals.find(udm => udm.id === userDayMealId);
        if (userDayMeal) {
            const date = parseISO(logDate);
            setPreselectedMealInfo({ mealId: userDayMeal.day_meal_id, date });
            setIsSnackSelectorOpen(true);
        }
    };

    const handleOpenFreeMealCreator = () => {
        const { mealId, date } = preselectedMealInfo;
        const dateString = format(date, 'yyyy-MM-dd');
        navigate(`/create-free-recipe/${dateString}/${mealId}`);
    };

    const handleOpenSnackCreator = () => {
        const { mealId, date } = preselectedMealInfo;
        const dateString = format(date, 'yyyy-MM-dd');
        navigate(`/create-snack/${dateString}/${mealId}`);
    };

    const handleRepeatFreeRecipeSelect = async (recipeToRepeat) => {
        const { mealId, date } = preselectedMealInfo;
        const logDateStr = format(date, 'yyyy-MM-dd');
        
        try {
            const { data: userDayMealsData } = await supabase.from('user_day_meals')
                .select('id')
                .eq('user_id', userId)
                .eq('day_meal_id', mealId)
                .eq('diet_plan_id', activePlan.id)
                .limit(1);

            const userDayMeal = userDayMealsData?.[0];
            
            if (!userDayMeal) throw new Error("Configuración de comida de usuario no encontrada.");
    
            const { error: deleteError } = await supabase.from('daily_meal_logs').delete().match({ user_id: userId, log_date: logDateStr, user_day_meal_id: userDayMeal.id });
            if (deleteError) throw deleteError;
    
            const { data: occurrence, error: occurrenceError } = await supabase
                .from('free_recipe_occurrences')
                .insert({
                    free_recipe_id: recipeToRepeat.id,
                    user_id: userId,
                    meal_date: logDateStr,
                    day_meal_id: mealId
                })
                .select()
                .single();
            if (occurrenceError) throw occurrenceError;
    
            const newLogData = {
                user_id: userId,
                log_date: logDateStr,
                free_recipe_occurrence_id: occurrence.id,
                user_day_meal_id: userDayMeal.id,
            };
    
            const { data: newLog, error: insertError } = await supabase.from('daily_meal_logs').insert(newLogData).select().single();
            if (insertError) throw insertError;
    
            const rawIngredients = recipeToRepeat.ingredients || recipeToRepeat.free_recipe_ingredients || [];
            
            const unifiedIngredients = rawIngredients.map(ing => {
                 let foodDetails = ing.food;
                 
                 if (!foodDetails) {
                    foodDetails = allAvailableFoods.find(f => String(f.id) === String(ing.food_id) && !!f.is_user_created === !!ing.is_user_created);
                 }
                 
                 return { 
                    ...ing, 
                    food: foodDetails,
                    user_created_food: foodDetails?.is_user_created ? foodDetails : null,
                    grams: ing.grams || ing.quantity
                 };
            });
    
            const newFreeMealWithOccurrence = {
                ...recipeToRepeat,
                occurrence_id: occurrence.id,
                meal_date: logDateStr,
                day_meal_id: mealId,
                dnd_id: `free-${occurrence.id}`,
                type: 'free_recipe',
                free_recipe_ingredients: unifiedIngredients,
                ingredients: unifiedIngredients
            };

            handleFreeMealUpdate(newLog, newFreeMealWithOccurrence);
            setIsRepeatFreeRecipeOpen(false);

            let macros = recipeToRepeat.macros;
            if (!macros || macros.calories === 0) {
                macros = calculateMacros(unifiedIngredients, allAvailableFoods);
            }

            handleOpenEquivalence({
                item: newFreeMealWithOccurrence,
                type: 'free_recipe',
                macros: macros,
                logId: newLog.id
            });
    
            toast({ title: 'Éxito', description: `"${recipeToRepeat.name}" añadida a tu plan.` });
        } catch (error) {
            toast({ title: 'Error', description: `No se pudo registrar la receta: ${error.message}`, variant: 'destructive' });
        }
    };

    const handleRepeatSnackSelect = async (snackToRepeat) => {
        const { mealId, date } = preselectedMealInfo;
        const logDateStr = format(date, 'yyyy-MM-dd');
    
        try {
            const { data: userDayMealsData } = await supabase
                .from('user_day_meals')
                .select('id')
                .eq('user_id', userId)
                .eq('day_meal_id', mealId)
                .eq('diet_plan_id', activePlan.id)
                .limit(1);

            const userDayMeal = userDayMealsData?.[0];

            if (!userDayMeal) throw new Error("Configuración de comida de usuario no encontrada.");
    
            const { data: occurrence, error: occurrenceError } = await supabase
                .from('snack_occurrences')
                .insert({
                    snack_id: snackToRepeat.id,
                    user_id: userId,
                    meal_date: logDateStr,
                    day_meal_id: mealId,
                })
                .select()
                .single();
            if (occurrenceError) throw occurrenceError;
    
            const { data: newLog, error: logError } = await supabase
                .from('daily_snack_logs')
                .insert({
                    user_id: userId,
                    log_date: logDateStr,
                    snack_occurrence_id: occurrence.id,
                    user_day_meal_id: userDayMeal.id,
                })
                .select()
                .single();
            if (logError) throw logError;
    
            const { data: fullSnack, error: fullSnackError } = await supabase
                .from('snacks')
                .select('*, snack_ingredients(*, food(*))')
                .eq('id', snackToRepeat.id)
                .single();
    
            if (fullSnackError) throw fullSnackError;
    
            const newSnackWithOccurrence = {
                ...fullSnack,
                occurrence_id: occurrence.id,
                meal_date: logDateStr,
                day_meal_id: mealId,
                dnd_id: `snack-${occurrence.id}`,
                type: 'snack',
            };
    
            handleSnackUpdate(newLog, newSnackWithOccurrence);
            setIsRepeatSnackOpen(false);
            toast({ title: 'Éxito', description: `"${newSnackWithOccurrence.name}" añadido y marcado.` });
        } catch (error) {
            toast({ title: 'Error', description: `No se pudo registrar el picoteo: ${error.message}`, variant: 'destructive' });
        }
    };

    if (planLoading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-green-500" /></div>;
    }
     if (planError) {
        return <div className="text-center text-red-500 p-8">{planError}</div>;
    }

    const sharedProps = {
        isAdminView,
        user,
        allFoods: allAvailableFoods,
        handleRecipeClick,
        handleFreeMealClick,
        handleRemoveFreeMeal: handleRemoveFreeMealFromLog,
        handleRemoveRecipe,
        onAddRecipeClick,
        handleAddFreeMeal,
        handleAddSnack,
        handleToggleMealSelection,
        onItemsUpdate: fetchAndSetPlanItems,
        dailyIngredientAdjustments,
        equivalenceAdjustments,
        userDayMeals,
        mealLogs: allMealLogs,
        selectedMealLogs,
        plannedMeals: plannedMeals,
        planRecipes,
        freeMeals,
        mealCounts,
        userRestrictions: userRestrictions,
        activePlan,
        handleUndoEquivalence,
    };

    return (
        <>
            {viewMode === 'week' ? <WeekView {...sharedProps} weekDates={weekDates} dayElementsRef={dayElementsRef} handleRemovePlannedMeal={handleRemovePlannedMealOptimistic} /> : <ListView {...sharedProps} groupedByMeal={groupedByMeal} logDate={logDate} />}
            
            {isEditorOpen && (
                <RecipeEditorModal 
                    open={isEditorOpen}
                    onOpenChange={setIsEditorOpen}
                    recipeToEdit={recipeToEdit}
                    onSaveSuccess={handleEditorSave}
                    isAdminView={isAdminView}
                    userId={userId}
                    planRestrictions={userRestrictions}
                    adjustments={recipeAdjustment}
                    isEditable={true}
                />
            )}

            {isSnackEditorOpen && (
                <SnackEditorModal
                    open={isSnackEditorOpen}
                    onOpenChange={setIsSnackEditorOpen}
                    snackToEdit={snackToEdit}
                    onOpenEquivalence={(payload) => handleOpenEquivalence({ ...payload, closeSnackEditor: true })}
                    onDeleteFromLog={handleRemoveSnackFromLog}
                    onDeletePermanent={handleRemoveSnackPermanently}
                    allFoods={allAvailableFoods}
                />
            )}
            
            {equivalenceData && (
                <EquivalenceDialog
                    open={isEquivalenceDialogOpen}
                    onOpenChange={handleEquivalenceOpenChange}
                    sourceItem={equivalenceData.item}
                    sourceItemType={equivalenceData.type}
                    sourceItemMacros={equivalenceData.macros}
                    sourceLogId={equivalenceData.logId}
                    allFoods={allAvailableFoods}
                    onSuccess={handleEquivalenceSuccess}
                />
            )}

            <FreeRecipeSelectorDialog
                open={isFreeMealSelectorOpen}
                onOpenChange={setIsFreeMealSelectorOpen}
                onAddNew={handleOpenFreeMealCreator}
                onRepeat={() => {
                    setIsFreeMealSelectorOpen(false);
                    setIsRepeatFreeRecipeOpen(true);
                }}
            />
            
            <RepeatFreeRecipeDialog
                open={isRepeatFreeRecipeOpen}
                onOpenChange={setIsRepeatFreeRecipeOpen}
                planId={activePlan?.id}
                userId={userId}
                allFoods={allAvailableFoods}
                onSelectRecipe={handleRepeatFreeRecipeSelect}
                onDeleteRecipe={handleRemoveFreeMealPermanently}
            />

            <SnackSelectorDialog
                open={isSnackSelectorOpen}
                onOpenChange={setIsSnackSelectorOpen}
                onAddNew={handleOpenSnackCreator}
                onRepeat={() => {
                    setIsSnackSelectorOpen(false);
                    setIsRepeatSnackOpen(true);
                }}
            />
            
            <RepeatSnackDialog
                open={isRepeatSnackOpen}
                onOpenChange={setIsRepeatSnackOpen}
                onBack={() => {
                    setIsRepeatSnackOpen(false);
                    setIsSnackSelectorOpen(true);
                }}
                planId={activePlan?.id}
                userId={userId}
                allFoods={allAvailableFoods}
                onSelectSnack={handleRepeatSnackSelect}
                onDeleteSnack={handleRemoveSnackPermanently}
            />
        </>
    );
});

WeeklyDietPlanner.displayName = 'WeeklyDietPlanner';

export default WeeklyDietPlanner;
