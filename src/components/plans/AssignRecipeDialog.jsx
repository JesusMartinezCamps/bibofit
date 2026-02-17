import React, { useState, useEffect, useCallback } from 'react';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogClose } from '@/components/ui/dialog';
    import { Button } from '@/components/ui/button';
    import { Loader2, X } from 'lucide-react';
    import { supabase } from '@/lib/supabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { format, isSameDay } from 'date-fns';
    import { es } from 'date-fns/locale';
    import { cn } from '@/lib/utils';
    import { v4 as uuidv4 } from 'uuid';

    const WeekVisualizerForAssign = ({ weekDates, onDayToggle, selectedDays, mealName, currentDate, otherPlannedDays }) => {
        const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

        return (
            <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700">
                <p className="text-center text-lg font-semibold mb-4 text-sky-300">Asignar a: <span className="font-bold">{mealName}</span></p>
                <div className="grid grid-cols-7 gap-2">
                    {weekDates.map(date => {
                        const dateString = format(date, 'yyyy-MM-dd');
                        const isSelected = selectedDays.has(dateString);
                        const isCurrent = isSameDay(date, currentDate);
                        const isOtherPlanned = otherPlannedDays.has(dateString) && !isSelected;

                        return (
                            <button
                                key={dateString}
                                onClick={() => onDayToggle(date)}
                                className={cn(
                                    "relative flex flex-col items-center p-2 rounded-lg transition-all duration-200 transform",
                                    isSelected ? 'bg-sky-500/80 ring-2 ring-sky-300 scale-105' : (isCurrent ? 'bg-slate-700' : 'bg-slate-800 hover:bg-slate-700'),
                                )}
                            >
                                <span className={cn("text-xs uppercase font-bold", isSelected ? "text-white" : (isCurrent ? "text-sky-400" : "text-gray-400"))}>
                                    {capitalize(format(date, 'eee', { locale: es }))}
                                </span>
                                <span className={cn("text-lg font-bold", isSelected ? 'text-white' : (isCurrent ? 'text-white' : 'text-gray-300'))}>
                                    {format(date, 'd')}
                                </span>
                                {isOtherPlanned && (
                                    <div className="absolute bottom-1 w-1.5 h-1.5 bg-cyan-400 rounded-full" title="Otra receta planificada"></div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    };

    const AssignRecipeDialog = ({ open, onOpenChange, onAssign, weekDates, recipe, meal, dietPlanId, userId, initialDate }) => {
        const { toast } = useToast();
        const [loading, setLoading] = useState(false);
        const [selectedDays, setSelectedDays] = useState(new Set());
        const [initialAssignments, setInitialAssignments] = useState([]);
        const [otherPlannedDays, setOtherPlannedDays] = useState(new Set());

        const currentMealId = meal?.day_meal?.id || meal?.id;

        useEffect(() => {
            if (open && userId && dietPlanId && currentMealId && recipe) {
                const fetchExistingAssignments = async () => {
                    const isPrivate = recipe.private_recipe_id || recipe.is_private;
                    const recipeId = isPrivate ? (recipe.private_recipe_id || recipe.id) : recipe.id;
                    
                    const { data, error } = await supabase
                        .from('planned_meals')
                        .select('id, plan_date, diet_plan_recipe_id, private_recipe_id')
                        .eq('user_id', userId)
                        .eq('diet_plan_id', dietPlanId)
                        .eq('day_meal_id', currentMealId);

                    if (error) {
                        console.error("Error fetching existing assignments:", error);
                        return;
                    }

                    const existingDatesForThisRecipe = new Set();
                    const otherPlanned = new Set();

                    data.forEach(d => {
                        const isThisRecipe = (isPrivate && d.private_recipe_id === recipeId) || (!isPrivate && d.diet_plan_recipe_id === recipeId);
                        if (isThisRecipe) {
                            existingDatesForThisRecipe.add(d.plan_date);
                        } else {
                            otherPlanned.add(d.plan_date);
                        }
                    });

                    if (initialDate) {
                        existingDatesForThisRecipe.add(format(initialDate, 'yyyy-MM-dd'));
                    }
                    
                    setSelectedDays(existingDatesForThisRecipe);
                    setOtherPlannedDays(otherPlanned);
                    setInitialAssignments(data.filter(d => {
                        const isThisRecipe = (isPrivate && d.private_recipe_id === recipeId) || (!isPrivate && d.diet_plan_recipe_id === recipeId);
                        return isThisRecipe;
                    }));
                };
                fetchExistingAssignments();
            } else {
                setSelectedDays(new Set());
                setInitialAssignments([]);
                setOtherPlannedDays(new Set());
            }
        }, [open, userId, dietPlanId, currentMealId, recipe, initialDate]);

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

        const handleAssign = async () => {
            setLoading(true);

            const isPrivate = recipe.private_recipe_id || recipe.is_private;
            const recipeId = isPrivate ? (recipe.private_recipe_id || recipe.id) : recipe.id;
            const recipeIdColumn = isPrivate ? 'private_recipe_id' : 'diet_plan_recipe_id';
            const otherRecipeIdColumn = isPrivate ? 'diet_plan_recipe_id' : 'private_recipe_id';

            const datesToAssign = Array.from(selectedDays);
            const initialDateStrings = new Set(initialAssignments.map(a => a.plan_date));
            
            const assignmentsToRemove = initialAssignments.filter(a => !selectedDays.has(a.plan_date));
            const datesToInsert = datesToAssign.filter(d => !initialDateStrings.has(d));

            try {
                let replacedItems = [];
                // 1. Unassign days that were deselected
                if (assignmentsToRemove.length > 0) {
                    const idsToDelete = assignmentsToRemove.map(a => a.id);
                    const { error: deleteError } = await supabase
                        .from('planned_meals')
                        .delete()
                        .in('id', idsToDelete);
                    if (deleteError) throw deleteError;
                }

                // 2. For new assignments, first delete any existing meal in that slot
                if (datesToInsert.length > 0) {
                    const { data: itemsToDelete, error: deleteExistingError } = await supabase
                        .from('planned_meals')
                        .delete()
                        .eq('user_id', userId)
                        .eq('diet_plan_id', dietPlanId)
                        .eq('day_meal_id', currentMealId)
                        .in('plan_date', datesToInsert)
                        .select();
                    
                    if (deleteExistingError) throw deleteExistingError;
                    replacedItems = itemsToDelete || [];

                    // 3. Insert the new assignments
                    const mealsToInsert = datesToInsert.map(date => ({
                        user_id: userId,
                        diet_plan_id: dietPlanId,
                        day_meal_id: currentMealId,
                        plan_date: date,
                        [recipeIdColumn]: recipeId,
                        [otherRecipeIdColumn]: null,
                    }));

                    const { data: insertedData, error: insertError } = await supabase.from('planned_meals').insert(mealsToInsert).select(`*, diet_plan_recipe:diet_plan_recipes(*, recipe:recipes(*, recipe_ingredients(*, food(*))), custom_ingredients:diet_plan_recipe_ingredients(*, food(*))), private_recipe:private_recipes(*, private_recipe_ingredients(*, food(*, food_sensitivities(*), food_medical_conditions(*)))), free_recipe:free_recipes(*)`);
                    if (insertError) throw insertError;
                    
                    onAssign(insertedData, [...assignmentsToRemove, ...replacedItems]);
                } else {
                    onAssign([], assignmentsToRemove);
                }

            } catch (error) {
                toast({ title: "Error", description: `No se pudo actualizar la planificación: ${error.message}`, variant: "destructive" });
            } finally {
                setLoading(false);
            }
        };

        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="bg-[#1a1e23] border-gray-700 text-white">
                    <DialogHeader className="mb-4">
                        <DialogTitle>Asignar "{recipe?.name}"</DialogTitle>
                        <DialogDescription>
                            Selecciona los días en los que quieres asignar esta receta. Si ya existe una comida en ese hueco, será reemplazada.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogClose asChild>
                        <button className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
                            <X className="h-4 w-4" />
                            <span className="sr-only">Close</span>
                        </button>
                    </DialogClose>
                    <WeekVisualizerForAssign
                        weekDates={weekDates}
                        onDayToggle={handleDayToggle}
                        selectedDays={selectedDays}
                        mealName={meal?.day_meal?.name || ''}
                        currentDate={initialDate}
                        otherPlannedDays={otherPlannedDays}
                    />
                    <DialogFooter className="mt-4">
                        <Button 
                            onClick={handleAssign} 
                            disabled={loading} 
                            className="w-full bg-sky-600 hover:bg-sky-700 border border-sky-400"
                        >
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Guardar Cambios
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    };

    export default AssignRecipeDialog;