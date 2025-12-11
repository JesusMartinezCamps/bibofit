import { useState, useEffect, useCallback } from 'react';
    import { supabase } from '@/lib/supabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { format } from 'date-fns';

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
                        let dnd_id;
                        if (log.private_recipe_id) {
                            dnd_id = `private-${log.private_recipe_id}`;
                        } else if (log.diet_plan_recipe_id) {
                            dnd_id = `recipe-${log.diet_plan_recipe_id}`;
                        } else if (log.free_recipe_occurrence_id) {
                            dnd_id = `free-${log.free_recipe_occurrence_id}`;
                        }
                        
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
            const userDayMeal = userDayMeals.find(udm => udm.day_meal_id === (item.day_meal_id || item.day_meal?.id));
            
            if (!userDayMeal) {
                toast({ title: 'Error', description: 'No se encontró la configuración de comida para este día.', variant: 'destructive' });
                return;
            }

            const existingLog = allMealLogs.find(log => log.log_date === logDate && log.user_day_meal_id === userDayMeal.id);
            
            const isCurrentlySelected = existingLog && (
                (item.type === 'recipe' && existingLog.diet_plan_recipe_id === item.id && !existingLog.private_recipe_id) ||
                (item.type === 'private_recipe' && existingLog.private_recipe_id === item.id) ||
                (item.type === 'free_recipe' && existingLog.free_recipe_occurrence_id === item.occurrence_id)
            );

            try {
                let updatedLogs;
                if (isCurrentlySelected) {
                    const { error } = await supabase.from('daily_meal_logs').delete().eq('id', existingLog.id);
                    if (error) throw error;
                    
                    updatedLogs = allMealLogs.filter(log => log.id !== existingLog.id);
                } else {
                    if (existingLog) {
                        const { error: deleteError } = await supabase.from('daily_meal_logs').delete().eq('id', existingLog.id);
                        if (deleteError) throw deleteError;
                    }

                    const newLogData = {
                        user_id: userId,
                        log_date: logDate,
                        user_day_meal_id: userDayMeal.id,
                    };

                    if (item.type === 'recipe') {
                        newLogData.diet_plan_recipe_id = item.id;
                    } else if (item.type === 'private_recipe') {
                        newLogData.private_recipe_id = item.id;
                    } else if (item.type === 'free_recipe') {
                        newLogData.free_recipe_occurrence_id = item.occurrence_id;
                    }

                    const { data: newLog, error: insertError } = await supabase.from('daily_meal_logs').insert(newLogData).select().single();
                    if (insertError) throw insertError;

                    updatedLogs = allMealLogs.filter(log => log.id !== existingLog?.id).concat(newLog);
                }
                
                setAllMealLogs(updatedLogs);
                processMealLogs(updatedLogs);

                if (onMealLogUpdate) onMealLogUpdate();
            } catch (error) {
                toast({ title: 'Error', description: `No se pudo actualizar el registro: ${error.message}`, variant: 'destructive' });
            }
        }, [allMealLogs, userDayMeals, userId, toast, onMealLogUpdate, processMealLogs]);

        return { selectedMealLogs, mealCounts, handleToggleMealSelection, allMealLogs, setAllMealLogs, processMealLogs };
    };