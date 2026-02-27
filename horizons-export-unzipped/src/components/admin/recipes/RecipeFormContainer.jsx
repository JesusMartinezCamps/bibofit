import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { calculateMacros } from '@/lib/macroCalculator';
import RecipeView from '@/components/shared/RecipeView';
import IngredientSearch from '@/components/plans/IngredientSearch';
import RecipeImageUpload from './RecipeImageUpload';
import { useRecipeImageUpload } from './hooks/useRecipeImageUpload';

const EMPTY_RESTRICTIONS = {
  sensitivities: [],
  medical_conditions: [],
  individual_food_restrictions: [],
  preferred_foods: [],
  non_preferred_foods: [],
};

const normalizeIngredient = (ing, availableFoods = []) => {
  const idValue = ing.local_id || ing.id || crypto.randomUUID();
  const rawQuantity = ing.grams ?? ing.quantity ?? '';
  const isEmpty = rawQuantity === '' || rawQuantity === null || rawQuantity === undefined;
  const foodId = String(ing.food_id || ing.food?.id || '');
  const resolvedFood =
    availableFoods.find((food) => String(food.id) === foodId) || ing.food;

  return {
    local_id: String(idValue),
    id: ing.id,
    food_id: foodId,
    grams: isEmpty ? '' : rawQuantity,
    quantity: isEmpty ? '' : rawQuantity,
    food_group_id:
      ing.food_group_id || resolvedFood?.food_to_food_groups?.[0]?.food_group_id || null,
    food: resolvedFood,
  };
};

const RecipeFormContainer = ({ selectedRecipe, onSave, resetSignal = 0 }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearchingIngredient, setIsSearchingIngredient] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [allFoods, setAllFoods] = useState([]);
  const [allVitamins, setAllVitamins] = useState([]);
  const [allMinerals, setAllMinerals] = useState([]);
  const [allFoodGroups, setAllFoodGroups] = useState([]);
  const [recipeData, setRecipeData] = useState({
    name: '',
    prep_time_min: '',
    difficulty: 'Fácil',
    instructions: '',
    image_url: null,
  });
  const [ingredients, setIngredients] = useState([]);
  const [imageFile, setImageFile] = useState(null);
  const { toast } = useToast();
  const { uploadRecipeImage, isUploading } = useRecipeImageUpload();

  const fetchInitialData = useCallback(async () => {
    setIsLoadingData(true);
    try {
      const [foodsRes, vitaminsRes, mineralsRes, foodGroupsRes] = await Promise.all([
        supabase
          .from('food')
          .select('*, food_sensitivities(*, sensitivities(id, name)), food_medical_conditions(condition_id, relation_type), food_to_food_groups(food_group_id, food_group:food_groups(id, name)), food_vitamins(vitamin_id, vitamins(id, name)), food_minerals(mineral_id, minerals(id, name))')
          .order('name'),
        supabase.from('vitamins').select('id, name'),
        supabase.from('minerals').select('id, name'),
        supabase.from('food_groups').select('id, name'),
      ]);

      if (foodsRes.error) throw foodsRes.error;
      if (vitaminsRes.error) throw vitaminsRes.error;
      if (mineralsRes.error) throw mineralsRes.error;
      if (foodGroupsRes.error) throw foodGroupsRes.error;

      setAllFoods(foodsRes.data || []);
      setAllVitamins(vitaminsRes.data || []);
      setAllMinerals(mineralsRes.data || []);
      setAllFoodGroups(foodGroupsRes.data || []);
    } catch (error) {
      toast({
        title: 'Error',
        description: `No se pudo cargar la data inicial: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setIsLoadingData(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    if (selectedRecipe) {
      const baseIngredients = selectedRecipe.recipe_ingredients || selectedRecipe.ingredients || [];
      setRecipeData({
        name: selectedRecipe.name || '',
        prep_time_min: selectedRecipe.prep_time_min ?? '',
        difficulty: selectedRecipe.difficulty || 'Fácil',
        instructions: selectedRecipe.instructions || '',
        image_url: selectedRecipe.image_url || null,
      });
      setIngredients(baseIngredients.map((ingredient) => normalizeIngredient(ingredient, allFoods)));
      setImageFile(selectedRecipe.image_url || null);
      return;
    }

    setRecipeData({
      name: '',
      prep_time_min: '',
      difficulty: 'Fácil',
      instructions: '',
      image_url: null,
    });
    setIngredients([]);
    setImageFile(null);
  }, [selectedRecipe, resetSignal, allFoods]);

  const normalizedIngredientsForMacros = useMemo(
    () =>
      ingredients.map((ing) => ({
        ...ing,
        grams: ing.grams === '' || ing.grams === null ? 0 : Number(ing.grams),
      })),
    [ingredients]
  );

  const macros = useMemo(
    () => calculateMacros(normalizedIngredientsForMacros, allFoods),
    [normalizedIngredientsForMacros, allFoods]
  );

  const recipeForView = useMemo(() => {
    const imageUrl =
      typeof imageFile === 'string'
        ? imageFile
        : recipeData.image_url || selectedRecipe?.image_url || null;

    return {
      ...recipeData,
      image_url: imageUrl,
      ingredients,
    };
  }, [recipeData, ingredients, imageFile, selectedRecipe]);

  const handleFormChange = useCallback((e) => {
    const { name, value } = e.target;
    setRecipeData((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleIngredientsChange = useCallback((newIngredients) => {
    setIngredients(newIngredients.map((ingredient) => normalizeIngredient(ingredient, allFoods)));
  }, [allFoods]);

  const handleRemoveIngredient = useCallback((ingredientToRemove) => {
    const ingredientId = ingredientToRemove.local_id || ingredientToRemove.id;
    setIngredients((prev) =>
      prev.filter((ing) => String(ing.local_id || ing.id) !== String(ingredientId))
    );
  }, []);

  const handleIngredientAdded = useCallback((newIngredientData) => {
    const selectedFood = allFoods.find((food) => String(food.id) === String(newIngredientData.food_id));
    const fallbackQuantity = selectedFood?.food_unit === 'unidades' ? 1 : 100;
    const quantity = newIngredientData.quantity || fallbackQuantity;

    const ingredientToAdd = normalizeIngredient({
      local_id: crypto.randomUUID(),
      food_id: String(newIngredientData.food_id),
      grams: quantity,
      quantity,
      food: selectedFood,
      food_group_id: selectedFood?.food_to_food_groups?.[0]?.food_group_id || null,
    }, allFoods);

    setIngredients((prev) => [...prev, ingredientToAdd]);
    setIsSearchingIngredient(false);
  }, [allFoods]);

  const onSubmit = async () => {
    if (!recipeData.name?.trim()) {
      toast({
        title: 'Error',
        description: 'El nombre de la receta es obligatorio.',
        variant: 'destructive',
      });
      return;
    }

    const validIngredients = ingredients.filter((ing) => ing.food_id);
    if (validIngredients.length === 0) {
      toast({
        title: 'Error',
        description: 'Añade al menos un ingrediente.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      let recipeId = selectedRecipe?.id;
      let savedRecipe = null;

      const payload = {
        name: recipeData.name.trim(),
        prep_time_min:
          recipeData.prep_time_min === '' || recipeData.prep_time_min === null
            ? null
            : Number(recipeData.prep_time_min),
        difficulty: recipeData.difficulty || null,
        instructions: recipeData.instructions || null,
      };

      if (selectedRecipe) {
        const { data: updatedRecipe, error } = await supabase
          .from('recipes')
          .update(payload)
          .eq('id', selectedRecipe.id)
          .select()
          .single();
        if (error) throw error;
        recipeId = updatedRecipe.id;
        savedRecipe = updatedRecipe;
      } else {
        const { data: authData } = await supabase.auth.getUser();
        const { data: newRecipe, error } = await supabase
          .from('recipes')
          .insert({
            ...payload,
            created_by: authData?.user?.id,
          })
          .select()
          .single();
        if (error) throw error;
        recipeId = newRecipe.id;
        savedRecipe = newRecipe;
      }

      if (imageFile instanceof File) {
        const { success, imageUrl, error: uploadError } = await uploadRecipeImage(recipeId, imageFile);
        if (success && imageUrl) {
          await supabase.from('recipes').update({ image_url: imageUrl }).eq('id', recipeId);
        } else {
          toast({
            title: 'Advertencia',
            description: `La receta se guardó, pero la imagen falló: ${uploadError}`,
            variant: 'destructive',
          });
        }
      } else if (imageFile === null && selectedRecipe?.image_url) {
        await supabase.from('recipes').update({ image_url: null }).eq('id', recipeId);
      }

      await supabase.from('recipe_ingredients').delete().eq('recipe_id', recipeId);

      const ingredientsToInsert = validIngredients.map((ing) => ({
        recipe_id: recipeId,
        food_id: parseInt(ing.food_id, 10),
        grams: Number(ing.grams || 0),
      }));

      const { error: insertError } = await supabase.from('recipe_ingredients').insert(ingredientsToInsert);
      if (insertError) throw insertError;

      const uniqueSensitivityIds = new Set();
      validIngredients.forEach((ingredient) => {
        const food = allFoods.find((item) => String(item.id) === String(ingredient.food_id));
        food?.food_sensitivities?.forEach((fs) => uniqueSensitivityIds.add(fs.sensitivity_id));
      });

      await supabase.from('recipe_sensitivities').delete().eq('recipe_id', recipeId);
      if (uniqueSensitivityIds.size > 0) {
        const sensitivitiesToInsert = Array.from(uniqueSensitivityIds).map((id) => ({
          recipe_id: recipeId,
          sensitivity_id: id,
        }));
        await supabase.from('recipe_sensitivities').insert(sensitivitiesToInsert);
      }

      await supabase.from('recipe_macros').delete().eq('recipe_id', recipeId);
      await supabase.from('recipe_macros').insert({
        recipe_id: recipeId,
        calories: macros.calories,
        proteins: macros.proteins,
        carbs: macros.carbs,
        fats: macros.fats,
      });

      const { data: freshRecipe } = await supabase
        .from('recipes')
        .select(`
          *,
          recipe_ingredients:recipe_ingredients(*, food:food(id, name, food_unit, proteins, total_carbs, total_fats, food_to_food_groups(food_group_id, food_group:food_groups(id, name)), food_vitamins(vitamin_id, vitamins(id, name)), food_minerals(mineral_id, minerals(id, name)))),
          recipe_sensitivities:recipe_sensitivities(*, sensitivities:sensitivities(id, name))
        `)
        .eq('id', recipeId)
        .single();

      toast({
        title: '¡Éxito!',
        description: `Receta ${selectedRecipe ? 'actualizada' : 'creada'} correctamente.`,
      });

      if (onSave) onSave(freshRecipe || savedRecipe);
    } catch (error) {
      toast({
        title: 'Error',
        description: `No se pudo guardar la receta: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingData) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-[#5ebe7d]" />
      </div>
    );
  }

  if (isSearchingIngredient) {
    return (
      <div className="space-y-4">
        <IngredientSearch
          selectedIngredients={ingredients}
          availableFoods={allFoods}
          userRestrictions={EMPTY_RESTRICTIONS}
          onBack={() => setIsSearchingIngredient(false)}
          onIngredientAdded={handleIngredientAdded}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <RecipeView
        recipe={recipeForView}
        allFoods={allFoods}
        allVitamins={allVitamins}
        allMinerals={allMinerals}
        allFoodGroups={allFoodGroups}
        macros={macros}
        userRestrictions={EMPTY_RESTRICTIONS}
        isEditing={true}
        onFormChange={handleFormChange}
        onIngredientsChange={handleIngredientsChange}
        onRemoveIngredient={handleRemoveIngredient}
        onAddIngredientClick={() => setIsSearchingIngredient(true)}
        disableAutoBalance={true}
        headerSlot={
          <RecipeImageUpload
            value={imageFile}
            onChange={setImageFile}
            disabled={isSubmitting || isUploading}
          />
        }
      />

      <div className="flex justify-end">
        <Button
          type="button"
          disabled={isSubmitting || isUploading}
          onClick={onSubmit}
          className="bg-green-600/60 hover:bg-green-700 text-white"
        >
          {isSubmitting || isUploading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {isUploading ? 'Subiendo Imagen...' : isSubmitting ? 'Guardando...' : selectedRecipe ? 'Guardar Cambios' : 'Crear Receta'}
        </Button>
      </div>
    </div>
  );
};

export default RecipeFormContainer;
