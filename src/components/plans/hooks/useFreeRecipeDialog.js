import { useState, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { calculateMacros } from '@/lib/macroCalculator';

export const useFreeRecipeDialog = ({ targetUserId, dayMealId, dietPlanId, date, onSuccess, availableFoods }) => {
  const { toast } = useToast();
  const [recipeName, setRecipeName] = useState('');
  const [prepTime, setPrepTime] = useState('');
  const [difficulty, setDifficulty] = useState('Fácil');
  const [instructions, setInstructions] = useState('');
  const [ingredients, setIngredients] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  const macros = useMemo(() => {
    if (!availableFoods || availableFoods.length === 0) {
      return { proteins: 0, carbs: 0, fats: 0, calories: 0 };
    }
    return calculateMacros(ingredients, availableFoods);
  }, [ingredients, availableFoods]);

  const handleIngredientAdded = (ingredient) => {
    const newIngredient = {
      food_id: ingredient.food_id,
      food_name: ingredient.food_name,
      quantity: ingredient.quantity,
      is_free: false,
      food_unit: ingredient.food_unit || 'gramos',
      is_user_created: ingredient.is_user_created,
    };
    setIngredients(prev => [...prev, newIngredient]);
  };

  const handleQuantityChange = (index, newQuantity) => {
    setIngredients(prev =>
      prev.map((ing, i) =>
        i === index ? { ...ing, quantity: newQuantity } : ing
      )
    );
  };

  const handleRemoveIngredient = (index) => {
    setIngredients(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!recipeName.trim()) {
      toast({ title: 'Error', description: 'El nombre de la receta no puede estar vacío.', variant: 'destructive' });
      return;
    }
    if (ingredients.length === 0) {
      toast({ title: 'Error', description: 'Debes añadir al menos un ingrediente.', variant: 'destructive' });
      return;
    }
    if (!date) {
      toast({ title: 'Error', description: 'No se ha proporcionado una fecha para la receta.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const { data: freeRecipe, error: recipeError } = await supabase
        .from('free_recipes')
        .insert({
          user_id: targetUserId,
          name: recipeName,
          instructions,
          prep_time_min: prepTime || null,
          difficulty,
          status: 'pending',
          diet_plan_id: dietPlanId,
          day_meal_id: dayMealId,
        })
        .select()
        .single();

      if (recipeError) throw recipeError;

      const ingredientsToInsert = ingredients.map(ing => ({
        free_recipe_id: freeRecipe.id,
        food_id: !ing.is_user_created ? ing.food_id : null,
        user_created_food_id: ing.is_user_created ? ing.food_id : null,
        grams: ing.quantity,
        status: 'approved',
      }));

      const { error: ingredientsError } = await supabase.from('free_recipe_ingredients').insert(ingredientsToInsert);
      if (ingredientsError) throw ingredientsError;

      const { data: occurrence, error: occurrenceError } = await supabase
        .from('free_recipe_occurrences')
        .insert({
          free_recipe_id: freeRecipe.id,
          user_id: targetUserId,
          meal_date: date,
          day_meal_id: dayMealId,
        })
        .select()
        .single();
      
      if (occurrenceError) throw occurrenceError;
      
      const newFreeMealWithOccurrence = {
        ...freeRecipe,
        free_recipe_ingredients: ingredients.map(ing => ({
            ...ing,
            grams: ing.quantity,
            food: availableFoods.find(f => String(f.id) === String(ing.food_id) && f.is_user_created === ing.is_user_created)
        })),
        occurrence_id: occurrence.id,
        meal_date: date,
        day_meal_id: dayMealId,
        dnd_id: `free-${occurrence.id}`,
        type: 'free_recipe',
      };

      const { data: userDayMeal } = await supabase.from('user_day_meals').select('id').eq('user_id', targetUserId).eq('day_meal_id', dayMealId).single();
      if (!userDayMeal) throw new Error("Configuración de comida de usuario no encontrada.");
      
      // Upsert logic for daily_meal_logs
      const { data: newLog, error: logError } = await supabase
        .from('daily_meal_logs')
        .upsert({
          user_id: targetUserId,
          log_date: date,
          user_day_meal_id: userDayMeal.id,
          free_recipe_occurrence_id: occurrence.id,
          diet_plan_recipe_id: null, // Ensure other types are nulled out
          private_recipe_id: null,
        }, {
          onConflict: 'user_id, log_date, user_day_meal_id'
        })
        .select()
        .single();

      if (logError) throw logError;

      toast({ title: 'Éxito', description: 'Receta libre creada y registrada.' });
      if (onSuccess) onSuccess(newLog, newFreeMealWithOccurrence);

    } catch (error) {
      console.error('Error saving free recipe:', error);
      toast({ title: 'Error', description: `No se pudo guardar la receta: ${error.message}`, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return {
    recipeName, setRecipeName,
    prepTime, setPrepTime,
    difficulty, setDifficulty,
    instructions, setInstructions,
    ingredients, setIngredients,
    macros,
    handleIngredientAdded,
    handleQuantityChange,
    handleRemoveIngredient,
    handleSave,
    isSaving,
  };
};