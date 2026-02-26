import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';

export const useSnackLogging = ({ userId, onSaveSuccess, mealDate, preselectedMealId }) => {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [name, setName] = useState('');
    const [ingredients, setIngredients] = useState([]);
    const [availableFoods, setAvailableFoods] = useState([]);
    const [userRestrictions, setUserRestrictions] = useState(null);
    const [activePlanId, setActivePlanId] = useState(null);

    // Fetch active plan on mount to ensure we have the context
    useEffect(() => {
        const fetchActivePlan = async () => {
            if (!userId) return;
            try {
                const { data, error } = await supabase
                    .from('diet_plans')
                    .select('id')
                    .eq('user_id', userId)
                    .eq('is_active', true)
                    .maybeSingle();
                
                if (error) {
                    console.error('Error fetching active plan:', error);
                } else if (data) {
                    setActivePlanId(data.id);
                }
            } catch (err) {
                console.error("Error in fetchActivePlan", err);
            }
        };
        fetchActivePlan();
    }, [userId]);

    const handleSubmit = useCallback(async ({ dietPlanId: explicitPlanId } = {}) => {
        // Use explicitly passed plan ID or fall back to the one fetched on mount
        const planIdToUse = explicitPlanId || activePlanId;

        if (!planIdToUse) {
            toast({ 
                title: 'Error de Plan', 
                description: 'No se encontró un plan de dieta activo. Por favor, activa un plan para guardar picoteos.', 
                variant: 'destructive' 
            });
            return;
        }

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
            // Validate that the meal time exists in the ACTIVE plan
            // This prevents PGRST116 errors by strictly filtering on diet_plan_id
            const { data: userDayMeal, error: userDayMealError } = await supabase
                .from('user_day_meals')
                .select('id')
                .eq('user_id', userId)
                .eq('day_meal_id', preselectedMealId)
                .eq('diet_plan_id', planIdToUse)
                .maybeSingle();
            
            if (userDayMealError && userDayMealError.code !== 'PGRST116') throw userDayMealError;

            if (!userDayMeal) {
                throw new Error("Este momento del día no existe en tu plan activo.");
            }

            // 1. Create the snack linked to the active plan
            const { data: newSnack, error: snackError } = await supabase
                .from('snacks')
                .insert({ 
                    user_id: userId, 
                    name, 
                    diet_plan_id: planIdToUse 
                })
                .select()
                .single();
            if (snackError) throw snackError;

            // 2. Insert ingredients
            const ingredientData = ingredients.map(ing => ({
                snack_id: newSnack.id,
                food_id: ing.food_id,
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
            
            // 4. Create a log entry for the occurrence using the correct user_day_meal_id
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
                description: error.message || 'No se pudo guardar el picoteo.',
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    }, [name, ingredients, userId, mealDate, preselectedMealId, toast, onSaveSuccess, availableFoods, activePlanId]);
    
    return {
        isSubmitting,
        name, setName,
        ingredients, setIngredients,
        availableFoods, setAvailableFoods,
        userRestrictions, setUserRestrictions,
        handleSubmit,
    };
};
