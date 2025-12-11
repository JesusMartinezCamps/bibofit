import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';

export const useSnackLogging = ({ userId, onSaveSuccess, mealDate, preselectedMealId, activePlanId }) => {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [name, setName] = useState('');
    const [ingredients, setIngredients] = useState([]);
    const [availableFoods, setAvailableFoods] = useState([]);
    const [userRestrictions, setUserRestrictions] = useState(null);

    const handleSubmit = useCallback(async ({ dietPlanId }) => {
        if (!name.trim()) {
            toast({ title: 'Error', description: 'El picoteo debe tener un nombre.', variant: 'destructive' });
            return;
        }
        if (ingredients.length === 0) {
            toast({ title: 'Error', description: 'Añade al menos un ingrediente.', variant: 'destructive' });
            return;
        }

        setIsSubmitting(true);
        try {
            // 1. Create the snack
            const { data: newSnack, error: snackError } = await supabase
                .from('snacks')
                .insert({ user_id: userId, name, diet_plan_id: dietPlanId })
                .select()
                .single();
            if (snackError) throw snackError;

            // 2. Insert ingredients
            const ingredientData = ingredients.map(ing => ({
                snack_id: newSnack.id,
                food_id: ing.is_user_created ? null : ing.food_id,
                user_created_food_id: ing.is_user_created ? ing.food_id : null,
                grams: ing.quantity,
                status: 'approved',
            }));

            const { error: ingredientsError } = await supabase.from('snack_ingredients').insert(ingredientData);
            if (ingredientsError) throw ingredientsError;

            // 3. Create an occurrence for today
             const { data: occurrence, error: occurrenceError } = await supabase
                .from('snack_occurrences')
                .insert({
                    snack_id: newSnack.id,
                    user_id: userId,
                    meal_date: mealDate,
                    day_meal_id: preselectedMealId,
                })
                .select()
                .single();
            if (occurrenceError) throw occurrenceError;
            
            // 4. Create a log entry for the occurrence
            const { data: userDayMeal } = await supabase
                .from('user_day_meals')
                .select('id')
                .eq('user_id', userId)
                .eq('day_meal_id', preselectedMealId)
                .single();
            
            if (!userDayMeal) throw new Error("Configuración de comida de usuario no encontrada.");

            const { data: newLog, error: logError } = await supabase
                .from('daily_snack_logs')
                .insert({
                    user_id: userId,
                    log_date: mealDate,
                    snack_occurrence_id: occurrence.id,
                    user_day_meal_id: userDayMeal.id,
                })
                .select()
                .single();
            if (logError) throw logError;

            const fullIngredients = ingredients.map(ing => {
                const foodDetails = availableFoods.find(f => f.id === ing.food_id && f.is_user_created === ing.is_user_created);
                return {
                    ...ing,
                    food: ing.is_user_created ? null : foodDetails,
                    user_created_food: ing.is_user_created ? foodDetails : null,
                };
            });

            const newSnackWithOccurrence = {
                ...newSnack,
                snack_ingredients: fullIngredients,
                occurrence_id: occurrence.id,
                meal_date: mealDate,
                day_meal_id: preselectedMealId,
                dnd_id: `snack-${occurrence.id}`,
                type: 'snack',
            };

            if (onSaveSuccess) {
                onSaveSuccess(newLog, newSnackWithOccurrence);
            }

        } catch (error) {
            console.error('Error saving snack:', error);
            toast({
                title: 'Error al guardar',
                description: `No se pudo guardar el picoteo: ${error.message}`,
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    }, [name, ingredients, userId, mealDate, preselectedMealId, toast, onSaveSuccess, availableFoods]);
    
    return {
        isSubmitting,
        name, setName,
        ingredients, setIngredients,
        availableFoods, setAvailableFoods,
        userRestrictions, setUserRestrictions,
        handleSubmit,
    };
};