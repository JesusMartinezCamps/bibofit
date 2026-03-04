import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import {
    buildMealLogPayload,
    getMealLogDndId,
    inferRecipeEntityType,
    RECIPE_ENTITY_TYPES,
} from '@/lib/recipeEntity';

export const useMealLogging = (userId, initialMealLogs, userDayMeals, onMealLogUpdate) => {
    const { toast } = useToast();
    const [allMealLogs, setAllMealLogs] = useState(initialMealLogs || []);
    const [selectedMealLogs, setSelectedMealLogs] = useState(new Map());
    const [mealCounts, setMealCounts] = useState({});

    const processMealLogs = useCallback((logs) => {
        const newSelected = new Map();
        const newCounts = {};

        if (logs) {
            logs.forEach(log => {
                const userDayMeal = userDayMeals.find(udm => udm.id === log.user_day_meal_id);
                if (userDayMeal) {
                    const logKey = `${log.log_date}-${userDayMeal.id}`;
                    const dnd_id = getMealLogDndId(log);
                    
                    if (dnd_id) {
                        newSelected.set(logKey, { ...log, dnd_id });
                        newCounts[dnd_id] = (newCounts[dnd_id] || 0) + 1;
                    }
                }
            });
        }

        setSelectedMealLogs(newSelected);
        setMealCounts(newCounts);
    }, [userDayMeals]);

    useEffect(() => {
        setAllMealLogs(initialMealLogs || []);
        processMealLogs(initialMealLogs || []);
    }, [initialMealLogs, processMealLogs]);

    const handleToggleMealSelection = useCallback(async (item, date) => {
        const logDate = format(date, 'yyyy-MM-dd');
        const dayMealId = item.day_meal_id ?? item.day_meal?.id;
        const userDayMeal = userDayMeals.find(udm => udm.day_meal_id === dayMealId);

        if (!userDayMeal) {
            toast({ title: 'Error', description: 'No se encontró la configuración de comida para este día.', variant: 'destructive' });
            return;
        }

        const existingLog = allMealLogs.find(
            log => log.log_date === logDate && log.user_day_meal_id === userDayMeal.id
        );

        const itemType = inferRecipeEntityType(item);
        const isCurrentlySelected = existingLog && (
            (itemType === RECIPE_ENTITY_TYPES.PLAN && existingLog.diet_plan_recipe_id === item.id && !existingLog.private_recipe_id) ||
            (itemType === RECIPE_ENTITY_TYPES.PRIVATE && existingLog.private_recipe_id === item.id) ||
            (itemType === RECIPE_ENTITY_TYPES.FREE && existingLog.free_recipe_occurrence_id === item.occurrence_id)
        );

        try {
            let updatedLogs;
            let newlyInsertedLog = null;

            if (isCurrentlySelected) {
                // REMOVE
                const { error } = await supabase.from('daily_meal_logs').delete().eq('id', existingLog.id);
                if (error) throw error;

                updatedLogs = allMealLogs.filter(log => log.id !== existingLog.id);

            } else {
                // REPLACE or ADD
                if (existingLog) {
                    const { error: deleteError } = await supabase.from('daily_meal_logs').delete().eq('id', existingLog.id);
                    if (deleteError) throw deleteError;
                }

                const newLogData = buildMealLogPayload({
                    userId,
                    logDate,
                    userDayMealId: userDayMeal.id,
                    entity: item,
                });

                const { data: newLog, error: insertError } = await supabase.from('daily_meal_logs')
                    .insert(newLogData)
                    .select()
                    .single();

                if (insertError) throw insertError;

                newlyInsertedLog = newLog; // ✔️ ESTA ES LA ASIGNACIÓN CORRECTA

                updatedLogs = allMealLogs.filter(log => log.id !== existingLog?.id).concat(newLog);
            }

            // Update UI state
            setAllMealLogs(updatedLogs);
            processMealLogs(updatedLogs);

            // Notify parent
            if (onMealLogUpdate) {
                const resolveExisting = (log) => {
                    if (!log) return null;
                    if (log.private_recipe_id) {
                        return { recipeType: 'private_recipe', recipeId: log.private_recipe_id };
                    }
                    if (log.diet_plan_recipe_id) {
                        return { recipeType: 'recipe', recipeId: log.diet_plan_recipe_id };
                    }
                    if (log.free_recipe_occurrence_id) {
                        return { recipeType: 'free_recipe', recipeId: log.free_recipe_occurrence_id };
                    }
                    return null;
                };

                const basePayload = {
                    logDate,
                    userDayMealId: userDayMeal.id,
                    recipeId: item.id,
                    recipeType: itemType,
                    freeRecipeOccurrenceId: itemType === RECIPE_ENTITY_TYPES.FREE ? item.occurrence_id : null,
                };

                if (isCurrentlySelected) {
                    onMealLogUpdate({
                        ...basePayload,
                        action: 'remove',
                        mealLogId: existingLog?.id,
                    });
                } else {
                    const previousLogInfo = resolveExisting(existingLog);
                    onMealLogUpdate({
                        ...basePayload,
                        action: previousLogInfo ? 'replace' : 'add',
                        mealLogId: newlyInsertedLog?.id,   // ✔️ AHORA SÍ EXISTE
                        previousLog: previousLogInfo
                            ? { ...previousLogInfo, userDayMealId: existingLog.user_day_meal_id, logDate }
                            : null,
                    });
                }
            }

        } catch (error) {
            toast({ title: 'Error', description: `No se pudo actualizar el registro: ${error.message}`, variant: 'destructive' });
        }

    }, [allMealLogs, userDayMeals, userId, toast, onMealLogUpdate, processMealLogs]);

    return { selectedMealLogs, mealCounts, handleToggleMealSelection, allMealLogs, setAllMealLogs, processMealLogs };
};
