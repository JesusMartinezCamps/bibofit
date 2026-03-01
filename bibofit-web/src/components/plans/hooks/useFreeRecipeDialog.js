import { useState, useMemo, useEffect, useCallback } from 'react';
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
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);
  const [hasSavedDraft, setHasSavedDraft] = useState(false);

  // Generate unique storage key based on user, date, and meal
  const storageKey = useMemo(() => {
    if (!targetUserId || !date || !dayMealId) return null;
    return `free_recipe_draft_${targetUserId}_${date}_${dayMealId}`;
  }, [targetUserId, date, dayMealId]);

  // Load draft from localStorage on mount
  useEffect(() => {
    if (!storageKey) return;

    const saved = localStorage.getItem(storageKey);
    if (saved) {
      setHasSavedDraft(true);
      try {
        const parsed = JSON.parse(saved);
        // Only auto-restore if we haven't loaded yet
        if (!isDraftLoaded) {
            setRecipeName(parsed.recipeName || '');
            setPrepTime(parsed.prepTime || '');
            setDifficulty(parsed.difficulty || 'Fácil');
            setInstructions(parsed.instructions || '');
            setIngredients(parsed.ingredients || []);
            toast({ 
                title: 'Borrador recuperado', 
                description: 'Se han cargado los datos de tu última sesión.',
            });
        }
      } catch (e) {
        console.error("Error parsing draft", e);
      }
    }
    setIsDraftLoaded(true);
  }, [storageKey, isDraftLoaded, toast]);

  // Auto-save to localStorage on changes (Debounced)
  useEffect(() => {
    if (!storageKey || !isDraftLoaded) return;

    const handler = setTimeout(() => {
        const hasData = recipeName || prepTime || instructions || ingredients.length > 0;
        
        if (hasData) {
            const draft = { recipeName, prepTime, difficulty, instructions, ingredients };
            localStorage.setItem(storageKey, JSON.stringify(draft));
            setHasSavedDraft(true);
        }
    }, 1000); // 1 second debounce

    return () => clearTimeout(handler);
  }, [recipeName, prepTime, difficulty, instructions, ingredients, storageKey, isDraftLoaded]);

  // Manual restore function
  const restoreDraft = useCallback(() => {
    if (!storageKey) return;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            setRecipeName(parsed.recipeName || '');
            setPrepTime(parsed.prepTime || '');
            setDifficulty(parsed.difficulty || 'Fácil');
            setInstructions(parsed.instructions || '');
            setIngredients(parsed.ingredients || []);
            toast({ title: 'Borrador restaurado', description: 'Datos recuperados correctamente.' });
        } catch (e) {
            toast({ title: 'Error', description: 'No se pudo leer el borrador.', variant: 'destructive' });
        }
    } else {
        toast({ title: 'Sin datos', description: 'No hay ningún borrador guardado para esta comida.', variant: 'outline' });
    }
  }, [storageKey, toast]);

  const clearDraft = useCallback(() => {
      if (storageKey) {
          localStorage.removeItem(storageKey);
          setHasSavedDraft(false);
      }
  }, [storageKey]);

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
    if (!dietPlanId) {
       toast({ title: 'Error', description: 'No se pudo identificar el plan de dieta activo. Recarga la página.', variant: 'destructive' });
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
        food_id: ing.food_id,
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
            food: availableFoods.find(f => String(f.id) === String(ing.food_id))
        })),
        occurrence_id: occurrence.id,
        meal_date: date,
        day_meal_id: dayMealId,
        dnd_id: `free-${occurrence.id}`,
        type: 'free_recipe',
      };

      // Correctly query user_day_meals with diet_plan_id to avoid PGRST116 (multiple rows)
      const { data: userDayMeal, error: userDayMealError } = await supabase
        .from('user_day_meals')
        .select('id')
        .eq('user_id', targetUserId)
        .eq('day_meal_id', dayMealId)
        .eq('diet_plan_id', dietPlanId)
        .single();
      
      if (userDayMealError) {
          console.error("Error fetching user_day_meal:", userDayMealError);
          // If 406 or similar, we should handle it, but throwing error stops flow.
          // We provide a better error message if possible
          throw userDayMealError;
      }

      if (!userDayMeal) throw new Error("Configuración de comida de usuario no encontrada para este plan.");
      
      // Upsert logic for daily_meal_logs
      const { data: newLog, error: logError } = await supabase
        .from('daily_meal_logs')
        .upsert({
          user_id: targetUserId,
          log_date: date,
          user_day_meal_id: userDayMeal.id,
          free_recipe_occurrence_id: occurrence.id,
          diet_plan_recipe_id: null, 
          private_recipe_id: null,
        }, {
          onConflict: 'user_id, log_date, user_day_meal_id'
        })
        .select()
        .single();

      if (logError) throw logError;
      
      // Clear draft on success
      clearDraft();

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
    restoreDraft,
    hasSavedDraft
  };
};
