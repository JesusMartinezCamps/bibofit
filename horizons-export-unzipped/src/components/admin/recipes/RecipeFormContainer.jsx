
import React, { useState, useEffect, useCallback } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Loader2, Save } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import IngredientBuilder from './IngredientBuilder';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import RecipeImageUpload from './RecipeImageUpload';
import { useRecipeImageUpload } from './hooks/useRecipeImageUpload';

const recipeSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  prep_time_min: z.preprocess(
    (val) => (val === '' || val === null ? null : Number(val)),
    z.number().int().positive().nullable()
  ),
  difficulty: z.string().nullable().optional(),
  instructions: z.string().nullable().optional(),
  ingredients: z.array(z.object({
    food_id: z.string().min(1, 'Selecciona un alimento'),
    grams: z.preprocess(
      (val) => Number(val),
      z.number().min(0, 'La cantidad debe ser positiva')
    ),
    local_id: z.string(),
  })).min(1, 'Añade al menos un ingrediente'),
});

const RecipeFormContainer = ({ selectedRecipe, onSave }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allFoods, setAllFoods] = useState([]);
  const [macros, setMacros] = useState({ calories: 0, proteins: 0, carbs: 0, fats: 0 });
  const [imageFile, setImageFile] = useState(null);
  const { toast } = useToast();
  
  const { uploadRecipeImage, isUploading } = useRecipeImageUpload();

  const methods = useForm({
    resolver: zodResolver(recipeSchema),
    defaultValues: {
      name: '',
      prep_time_min: '',
      difficulty: '',
      instructions: '',
      ingredients: [],
    },
  });

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = methods;
  const ingredients = watch('ingredients');
  const difficultyValue = watch('difficulty');

  useEffect(() => {
    const fetchInitialData = async () => {
      const { data: foodsData, error: foodsError } = await supabase
        .from('food')
        .select('*, food_sensitivities(*, sensitivities(name))')
        .order('name');
        
      if (foodsError) console.error('Error fetching foods:', foodsError);
      else setAllFoods(foodsData || []);
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedRecipe) {
      reset({
        name: selectedRecipe.name || '',
        prep_time_min: selectedRecipe.prep_time_min || '',
        difficulty: selectedRecipe.difficulty || '', 
        instructions: selectedRecipe.instructions || '',
        ingredients: selectedRecipe.recipe_ingredients?.map(ing => ({
          food_id: String(ing.food_id),
          grams: ing.grams,
          local_id: ing.id ? String(ing.id) : Math.random().toString(),
          food_group_id: ing.food_group_id
        })) || [],
      });
      setImageFile(selectedRecipe.image_url || null);
    } else {
      reset({
        name: '',
        prep_time_min: '',
        difficulty: '',
        instructions: '',
        ingredients: [{ local_id: Date.now().toString(), food_id: '', grams: '' }],
      });
      setImageFile(null);
    }
  }, [selectedRecipe, reset]);

  const handleIngredientsChange = useCallback((newIngredients) => {
    setValue('ingredients', newIngredients, { shouldValidate: true });
  }, [setValue]);

  const handleMacrosChange = useCallback((newMacros) => {
    setMacros(newMacros);
  }, []);

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      let recipeId = selectedRecipe?.id;

      // 1. Upsert Recipe
      if (selectedRecipe) {
        const { data: updatedRecipe, error } = await supabase
          .from('recipes')
          .update({
            name: data.name,
            prep_time_min: data.prep_time_min || null,
            difficulty: data.difficulty,
            instructions: data.instructions,
          })
          .eq('id', selectedRecipe.id)
          .select()
          .single();
        if (error) throw error;
        recipeId = updatedRecipe.id;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: newRecipe, error } = await supabase
          .from('recipes')
          .insert({
            name: data.name,
            prep_time_min: data.prep_time_min || null,
            difficulty: data.difficulty,
            instructions: data.instructions,
            created_by: user?.id
          })
          .select()
          .single();
        if (error) throw error;
        recipeId = newRecipe.id;
      }

      // 2. Upload Image if new file selected
      if (imageFile instanceof File) {
        const { success, imageUrl, error: uploadError } = await uploadRecipeImage(recipeId, imageFile);
        if (success && imageUrl) {
          await supabase.from('recipes').update({ image_url: imageUrl }).eq('id', recipeId);
          toast({ title: 'Imagen subida', description: 'La imagen se subió correctamente.' });
        } else {
          toast({
            title: 'Advertencia',
            description: `La receta se guardó, pero la imagen falló: ${uploadError}`,
            variant: 'destructive',
          });
        }
      } else if (imageFile === null && selectedRecipe?.image_url) {
         // User removed existing image
         await supabase.from('recipes').update({ image_url: null }).eq('id', recipeId);
      }

      // 3. Upsert Ingredients
      await supabase.from('recipe_ingredients').delete().eq('recipe_id', recipeId);
      
      const ingredientsToInsert = data.ingredients.map(ing => ({
        recipe_id: recipeId,
        food_id: parseInt(ing.food_id),
        grams: parseFloat(ing.grams),
      }));
      
      const { error: insertError } = await supabase.from('recipe_ingredients').insert(ingredientsToInsert);
      if (insertError) throw insertError;

      // 4. Update Sensitivities
      const foodIds = data.ingredients.map(ing => ing.food_id);
      const uniqueSensitivityIds = new Set();
      
      if (allFoods.length > 0) {
        foodIds.forEach(foodId => {
          const food = allFoods.find(f => String(f.id) === String(foodId));
          if (food && food.food_sensitivities) {
            food.food_sensitivities.forEach(fs => uniqueSensitivityIds.add(fs.sensitivity_id));
          }
        });
      }

      await supabase.from('recipe_sensitivities').delete().eq('recipe_id', recipeId);
      if (uniqueSensitivityIds.size > 0) {
        const sensitivitiesToInsert = Array.from(uniqueSensitivityIds).map(id => ({
          recipe_id: recipeId,
          sensitivity_id: id,
        }));
        await supabase.from('recipe_sensitivities').insert(sensitivitiesToInsert);
      }

      // 5. Update Macros Cache
      await supabase.from('recipe_macros').delete().eq('recipe_id', recipeId);
      await supabase.from('recipe_macros').insert({
        recipe_id: recipeId,
        calories: macros.calories,
        proteins: macros.proteins,
        carbs: macros.carbs,
        fats: macros.fats,
      });

      toast({
        title: '¡Éxito!',
        description: `Receta ${selectedRecipe ? 'actualizada' : 'creada'} correctamente.`,
      });
      
      if (onSave) onSave();

    } catch (error) {
      console.error(error);
      toast({
        title: 'Error',
        description: `No se pudo guardar la receta: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormDisabled = isSubmitting || isUploading;

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="name">Nombre de la Receta</Label>
            <Input id="name" {...register('name')} placeholder="Ej: Pollo con arroz" className="input-field" disabled={isFormDisabled} />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
          </div>
          
          <div className="space-y-2 md:col-span-2">
            <RecipeImageUpload 
              value={imageFile} 
              onChange={setImageFile} 
              disabled={isFormDisabled}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="prep_time_min">Tiempo (min)</Label>
            <Input id="prep_time_min" type="number" {...register('prep_time_min')} placeholder="Ej: 30" className="input-field" disabled={isFormDisabled} />
            {errors.prep_time_min && <p className="text-red-500 text-xs mt-1">{errors.prep_time_min.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="difficulty">Dificultad</Label>
            <Select 
                onValueChange={(value) => setValue('difficulty', value)} 
                value={difficultyValue || ''}
                disabled={isFormDisabled}
            >
              <SelectTrigger className="input-field">
                <SelectValue placeholder="Selecciona dificultad" />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1e23] border-gray-700 text-white">
                <SelectItem value="Fácil">Fácil</SelectItem>
                <SelectItem value="Media">Media</SelectItem>
                <SelectItem value="Difícil">Difícil</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="instructions">Instrucciones</Label>
            <Textarea id="instructions" {...register('instructions')} rows={5} placeholder="Describe los pasos de la receta..." className="input-field" disabled={isFormDisabled} />
          </div>
        </div>

        <IngredientBuilder
          ingredients={ingredients}
          onIngredientsChange={handleIngredientsChange}
          availableFoods={allFoods}
          onMacrosChange={handleMacrosChange}
          displayMode="inform"
        />
        {errors.ingredients && <p className="text-red-500 text-xs mt-1">{errors.ingredients.message}</p>}

        <div className="flex justify-end">
          <Button type="submit" disabled={isFormDisabled} className="bg-green-600 hover:bg-green-700 text-white">
            {isFormDisabled ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {isUploading ? 'Subiendo Imagen...' : isSubmitting ? 'Guardando...' : selectedRecipe ? 'Guardar Cambios' : 'Crear Receta'}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
};

export default RecipeFormContainer;
