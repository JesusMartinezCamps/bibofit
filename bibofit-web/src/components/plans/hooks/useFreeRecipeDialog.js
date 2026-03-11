import { useState, useMemo, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { calculateMacros } from '@/lib/macroCalculator';
import { persistFreeRecipeOccurrence } from '@/lib/freeRecipePersistence';
import { FREE_RECIPE_STATUS } from '@/lib/recipeEntity';

const generateLocalId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const toNumericQuantity = (value) => {
  if (value === '' || value === null || value === undefined) return '';
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : '';
};

const resolveFoodFromCatalog = (availableFoods = [], foodId) => {
  if (!foodId && foodId !== 0) return null;
  return availableFoods.find((food) => String(food.id) === String(foodId)) || null;
};

const normalizeIngredientForState = (ingredient, availableFoods = []) => {
  const foodId = ingredient?.food_id ?? ingredient?.food?.id ?? '';
  const resolvedFood = ingredient?.food || resolveFoodFromCatalog(availableFoods, foodId);
  const quantity = toNumericQuantity(ingredient?.grams ?? ingredient?.quantity);
  const normalizedFoodId = foodId === null || foodId === undefined ? '' : String(foodId);

  return {
    local_id: String(ingredient?.local_id || ingredient?.id || generateLocalId()),
    id: ingredient?.id,
    food_id: normalizedFoodId,
    food_name: ingredient?.food_name || resolvedFood?.name || '',
    grams: quantity,
    quantity,
    food: resolvedFood || null,
    food_group_id:
      ingredient?.food_group_id ||
      resolvedFood?.food_to_food_groups?.[0]?.food_group_id ||
      null,
    is_free: ingredient?.is_free ?? !normalizedFoodId,
    food_unit: ingredient?.food_unit || resolvedFood?.food_unit || 'gramos',
    is_user_created:
      ingredient?.is_user_created ?? !!resolvedFood?.is_user_created ?? !!resolvedFood?.user_id,
    locked: !!ingredient?.locked,
  };
};

const serializeIngredientForDraft = (ingredient) => ({
  local_id: ingredient?.local_id,
  id: ingredient?.id,
  food_id: ingredient?.food_id,
  food_name: ingredient?.food_name,
  grams: ingredient?.grams ?? ingredient?.quantity,
  quantity: ingredient?.quantity ?? ingredient?.grams,
  food_group_id: ingredient?.food_group_id || null,
  is_free: !!ingredient?.is_free,
  food_unit: ingredient?.food_unit || 'gramos',
  is_user_created: !!ingredient?.is_user_created,
  locked: !!ingredient?.locked,
});

export const useFreeRecipeDialog = ({ targetUserId, dayMealId, dietPlanId, date, onSuccess, availableFoods }) => {
  const { toast } = useToast();
  const [recipeName, setRecipeName] = useState('');
  const [prepTime, setPrepTime] = useState('');
  const [difficulty, setDifficulty] = useState('Fácil');
  const [recipeStyleId, setRecipeStyleId] = useState('');
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
            setRecipeStyleId(parsed.recipeStyleId || '');
            setInstructions(parsed.instructions || '');
            setIngredients((parsed.ingredients || []).map((ing) => normalizeIngredientForState(ing, availableFoods)));
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
  }, [storageKey, isDraftLoaded, toast, availableFoods]);

  // Auto-save to localStorage on changes (Debounced)
  useEffect(() => {
    if (!storageKey || !isDraftLoaded) return;

    const handler = setTimeout(() => {
        const hasData = recipeName || prepTime || instructions || ingredients.length > 0;
        
        if (hasData) {
            const draft = {
              recipeName,
              prepTime,
              difficulty,
              instructions,
              ingredients: ingredients.map(serializeIngredientForDraft),
            };
            draft.recipeStyleId = recipeStyleId;
            localStorage.setItem(storageKey, JSON.stringify(draft));
            setHasSavedDraft(true);
        }
    }, 1000); // 1 second debounce

    return () => clearTimeout(handler);
  }, [recipeName, prepTime, difficulty, recipeStyleId, instructions, ingredients, storageKey, isDraftLoaded]);

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
            setRecipeStyleId(parsed.recipeStyleId || '');
            setInstructions(parsed.instructions || '');
            setIngredients((parsed.ingredients || []).map((ing) => normalizeIngredientForState(ing, availableFoods)));
            toast({ title: 'Borrador restaurado', description: 'Datos recuperados correctamente.' });
        } catch (e) {
            toast({ title: 'Error', description: 'No se pudo leer el borrador.', variant: 'destructive' });
        }
    } else {
        toast({ title: 'Sin datos', description: 'No hay ningún borrador guardado para esta comida.', variant: 'default' });
    }
  }, [storageKey, toast, availableFoods]);

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

  const handleIngredientsChange = useCallback((newIngredients) => {
    const normalized = (newIngredients || []).map((ing) => normalizeIngredientForState(ing, availableFoods));
    setIngredients(normalized);
  }, [availableFoods]);

  const handleIngredientAdded = (ingredient) => {
    const rawFoodId = ingredient?.food_id ?? ingredient?.id ?? ingredient?.food?.id;
    const resolvedFood = resolveFoodFromCatalog(availableFoods, rawFoodId);
    const fallbackQuantity = resolvedFood?.food_unit === 'unidades' ? 1 : 100;
    const quantity = ingredient.quantity ?? ingredient.grams ?? fallbackQuantity;

    const newIngredient = {
      ...ingredient,
      local_id: ingredient.local_id || generateLocalId(),
      food_id: rawFoodId,
      food_name: ingredient.food_name || resolvedFood?.name,
      grams: quantity,
      quantity,
      food: ingredient.food || resolvedFood || null,
      food_group_id:
        ingredient.food_group_id ||
        resolvedFood?.food_to_food_groups?.[0]?.food_group_id ||
        null,
      is_free: false,
      food_unit: ingredient.food_unit || resolvedFood?.food_unit || 'gramos',
      is_user_created: ingredient.is_user_created ?? !!resolvedFood?.is_user_created ?? !!resolvedFood?.user_id,
    };
    setIngredients((prev) => [...prev, normalizeIngredientForState(newIngredient, availableFoods)]);
  };

  const handleQuantityChange = (indexOrIngredient, newQuantity) => {
    const quantity = toNumericQuantity(newQuantity);
    if (typeof indexOrIngredient === 'number') {
      setIngredients((prev) =>
        prev.map((ing, i) =>
          i === indexOrIngredient ? { ...ing, grams: quantity, quantity } : ing
        )
      );
      return;
    }

    const identifier =
      indexOrIngredient?.local_id ||
      indexOrIngredient?.id ||
      indexOrIngredient?.food_id ||
      indexOrIngredient;

    setIngredients((prev) =>
      prev.map((ing) =>
        String(ing.local_id || ing.id || ing.food_id) === String(identifier)
          ? { ...ing, grams: quantity, quantity }
          : ing
      )
    );
  };

  const handleRemoveIngredient = (indexOrIngredient) => {
    if (typeof indexOrIngredient === 'number') {
      setIngredients((prev) => prev.filter((_, i) => i !== indexOrIngredient));
      return;
    }

    const identifier =
      indexOrIngredient?.local_id ||
      indexOrIngredient?.id ||
      indexOrIngredient?.food_id ||
      indexOrIngredient;

    setIngredients((prev) =>
      prev.filter((ing) => String(ing.local_id || ing.id || ing.food_id) !== String(identifier))
    );
  };

  const handleRecipeFormChange = useCallback((event) => {
    const { name, value } = event?.target || {};
    if (!name) return;

    if (name === 'name') {
      setRecipeName(value ?? '');
      return;
    }
    if (name === 'prep_time_min') {
      setPrepTime(value ?? '');
      return;
    }
    if (name === 'difficulty') {
      setDifficulty(value ?? 'Fácil');
      return;
    }
    if (name === 'recipe_style_id') {
      setRecipeStyleId(value ?? '');
      return;
    }
    if (name === 'instructions') {
      setInstructions(value ?? '');
    }
  }, []);

  const recipeForView = useMemo(() => ({
    id: null,
    user_id: targetUserId,
    day_meal_id: dayMealId || null,
    name: recipeName,
    prep_time_min: prepTime,
    difficulty,
    recipe_style_id: recipeStyleId || null,
    instructions,
    ingredients,
  }), [targetUserId, dayMealId, recipeName, prepTime, difficulty, recipeStyleId, instructions, ingredients]);

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
      const { freeRecipe, ingredients: savedIngredients, occurrence, mealLog } = await persistFreeRecipeOccurrence({
        userId: targetUserId,
        dayMealId,
        mealDate: date,
        dietPlanId,
        recipe: {
          name: recipeName,
          instructions,
          prep_time_min: prepTime || null,
          difficulty,
          recipe_style_id: recipeStyleId || null,
          status: FREE_RECIPE_STATUS.PENDING,
        },
        ingredients,
      });

      const mergedIngredients = (savedIngredients || []).map((ing) => {
        const food = ing.food || availableFoods.find((f) => String(f.id) === String(ing.food_id));
        return {
          ...ing,
          quantity: ing.grams,
          food,
          is_user_created: !!food?.is_user_created || !!food?.user_id,
        };
      });

      const newFreeMealWithOccurrence = {
        ...freeRecipe,
        recipe_ingredients: mergedIngredients,
        occurrence_id: occurrence.id,
        meal_date: date,
        day_meal_id: dayMealId,
        dnd_id: `free-${occurrence.id}`,
        type: 'free_recipe',
        recipe_style_id: freeRecipe.recipe_style_id || null,
      };
      
      // Clear draft on success
      clearDraft();

      toast({ title: 'Éxito', description: 'Receta libre creada y registrada.', variant: 'success' });
      if (onSuccess) onSuccess(mealLog, newFreeMealWithOccurrence);

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
    recipeStyleId, setRecipeStyleId,
    instructions, setInstructions,
    ingredients, setIngredients,
    recipeForView,
    macros,
    handleRecipeFormChange,
    handleIngredientsChange,
    handleIngredientAdded,
    handleQuantityChange,
    handleRemoveIngredient,
    handleSave,
    isSaving,
    restoreDraft,
    hasSavedDraft
  };
};
