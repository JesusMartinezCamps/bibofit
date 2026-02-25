import React, { useState, useEffect, useCallback } from 'react';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
    import { Button } from '@/components/ui/button';
    import { Loader2 } from 'lucide-react';
    import { supabase } from '@/lib/supabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { format, isSameDay } from 'date-fns';
    import { es } from 'date-fns/locale';
    import { cn } from '@/lib/utils';

    const WeekVisualizerSimple = ({ weekDates, plannedMeals, onDayToggle, selectedDays, mealName }) => {
        const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

        return (
            <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700">
                <p className="text-center text-lg font-semibold mb-4 text-cyan-300">Repetir para: <span className="font-bold">{mealName}</span></p>
                <div className="grid grid-cols-7 gap-2">
                    {weekDates.map(date => {
                        const dateString = format(date, 'yyyy-MM-dd');
                        const isPlanned = plannedMeals.some(meal => meal.plan_date === dateString);
                        const isSelected = selectedDays.has(dateString);

                        return (
                            <button
                                key={dateString}
                                onClick={() => onDayToggle(date)}
                                className={cn(
                                    "flex flex-col items-center p-2 rounded-lg transition-all duration-200 transform",
                                    isSelected ? 'bg-green-500/80 ring-2 ring-green-300 scale-105' : 'bg-slate-800 hover:bg-slate-700',
                                )}
                            >
                                <span className={cn("text-xs uppercase font-bold", isSelected ? "text-white" : "text-gray-400")}>
                                    {capitalize(format(date, 'eee', { locale: es }))}
                                </span>
                                <span className={cn("text-lg font-bold", isSelected ? 'text-white' : 'text-gray-300')}>
                                    {format(date, 'd')}
                                </span>
                                <div className="flex justify-center items-center h-4 mt-2">
                                    {isPlanned && (
                                        <div className="w-2.5 h-2.5 rounded-full bg-cyan-400" title="Ya planificado"></div>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    };

    const RepeatPlanningDialog = ({ open, onOpenChange, onSave, weekDates, plannedItem, dietPlanId, userId }) => {
        const { toast } = useToast();
        const [loading, setLoading] = useState(false);
        const [relevantPlannedMeals, setRelevantPlannedMeals] = useState([]);
        const [selectedDays, setSelectedDays] = useState(new Set());

        const fetchRelevantMeals = useCallback(async () => {
            if (!open || !plannedItem) return;
            setLoading(true);
            
            const startDate = format(weekDates[0], 'yyyy-MM-dd');
            const endDate = format(weekDates[weekDates.length - 1], 'yyyy-MM-dd');
            
            const query = supabase.from('planned_meals')
                .select('id, plan_date')
                .eq('user_id', userId)
                .eq('diet_plan_id', dietPlanId)
                .eq('day_meal_id', plannedItem.day_meal_id)
                .gte('plan_date', startDate)
                .lte('plan_date', endDate);

            if (plannedItem.diet_plan_recipe_id) {
                query.eq('diet_plan_recipe_id', plannedItem.diet_plan_recipe_id);
            } else if (plannedItem.private_recipe_id) {
                query.eq('private_recipe_id', plannedItem.private_recipe_id);
            }

            const { data, error } = await query;

            if (error) {
                toast({ title: "Error", description: "No se pudieron cargar las comidas planificadas.", variant: "destructive" });
            } else {
                setRelevantPlannedMeals(data);
                const initialSelected = new Set(data.map(m => m.plan_date));
                setSelectedDays(initialSelected);
            }
            setLoading(false);
        }, [open, plannedItem, weekDates, userId, dietPlanId, toast]);

        useEffect(() => {
            fetchRelevantMeals();
        }, [fetchRelevantMeals]);

        const handleDayToggle = (date) => {
            const dateString = format(date, 'yyyy-MM-dd');
            setSelectedDays(prev => {
                const newSet = new Set(prev);
                if (newSet.has(dateString)) {
                    newSet.delete(dateString);
                } else {
                    newSet.add(dateString);
                }
                return newSet;
            });
        };

        const handleSave = async () => {
            setLoading(true);
            const originalDates = new Set(relevantPlannedMeals.map(m => m.plan_date));
            const datesToAdd = Array.from(selectedDays).filter(d => !originalDates.has(d));
            const datesToRemove = Array.from(originalDates).filter(d => !selectedDays.has(d));

            const mealData = {
                user_id: userId,
                diet_plan_id: dietPlanId,
                day_meal_id: plannedItem.day_meal_id,
                diet_plan_recipe_id: plannedItem.diet_plan_recipe_id,
                private_recipe_id: plannedItem.private_recipe_id,
            };

            try {
                if (datesToRemove.length > 0) {
                    const idsToRemove = relevantPlannedMeals.filter(m => datesToRemove.includes(m.plan_date)).map(m => m.id);
                    const { error: deleteError } = await supabase.from('planned_meals').delete().in('id', idsToRemove);
                    if (deleteError) throw deleteError;
                }

                if (datesToAdd.length > 0) {
                    const mealsToAdd = datesToAdd.map(date => ({ ...mealData, plan_date: date }));
                    
                    const { data: existingMeals, error: fetchError } = await supabase.from('planned_meals')
                        .select('id, plan_date')
                        .eq('user_id', userId)
                        .eq('diet_plan_id', dietPlanId)
                        .eq('day_meal_id', plannedItem.day_meal_id)
                        .in('plan_date', datesToAdd);
                    
                    if (fetchError) throw fetchError;

                    if (existingMeals.length > 0) {
                        const idsToReplace = existingMeals.map(m => m.id);
                        const { error: replaceError } = await supabase.from('planned_meals').delete().in('id', idsToReplace);
                        if (replaceError) throw replaceError;
                    }

                    const { error: insertError } = await supabase.from('planned_meals').insert(mealsToAdd);
                    if (insertError) throw insertError;
                }

                toast({ title: "Éxito", description: "Planificación semanal actualizada." });
                onSave();
            } catch (error) {
                toast({ title: "Error", description: `No se pudo guardar la planificación: ${error.message}`, variant: "destructive" });
            } finally {
                setLoading(false);
            }
        };

        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="bg-[#1a1e23] border-gray-700 text-white">
                    <DialogHeader>
                        <DialogTitle>Repetir Planificación Semanal</DialogTitle>
                        <DialogDescription>
                            Selecciona los días en los que quieres que se repita esta comida. Si ya existe una comida en ese hueco, será reemplazada.
                        </DialogDescription>
                    </DialogHeader>
                    {loading ? (
                        <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin text-green-500" /></div>
                    ) : (
                        <WeekVisualizerSimple
                            weekDates={weekDates}
                            plannedMeals={relevantPlannedMeals}
                            onDayToggle={handleDayToggle}
                            selectedDays={selectedDays}
                            mealName={plannedItem?.day_meal?.name || ''}
                        />
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
                        <Button onClick={handleSave} disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Guardar Cambios
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    };

    export default RepeatPlanningDialog;