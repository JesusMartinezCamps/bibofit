import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Globe, Shield } from 'lucide-react';
import RecipeView from '@/components/shared/RecipeView';
import { calculateMacros } from '@/lib/macroCalculator';

const FreeMealReviewModal = ({ isOpen, onOpenChange, freeMeal, onSuccess }) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allFoods, setAllFoods] = useState([]);
  const [loadingFoods, setLoadingFoods] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setLoadingFoods(true);
      supabase.from('food').select('*, food_to_food_groups(food_group_id)')
        .then(({ data, error }) => {
          if (error) {
            toast({ title: 'Error', description: 'No se pudieron cargar los datos de alimentos.', variant: 'destructive' });
          } else {
            setAllFoods(data || []);
          }
          setLoadingFoods(false);
        });
    }
  }, [isOpen, toast]);
  
  const recipeForView = useMemo(() => {
    if (!freeMeal) return null;
    return {
      name: freeMeal.name,
      instructions: freeMeal.instructions,
      ingredients: freeMeal.ingredients.map(ing => ({
        food_id: ing.food_id,
        grams: ing.grams,
        food: ing.food
      })),
    };
  }, [freeMeal]);

  const macros = useMemo(() => {
    if (!recipeForView || allFoods.length === 0) return { calories: 0, proteins: 0, carbs: 0, fats: 0 };
    return calculateMacros(recipeForView.ingredients, allFoods);
  }, [recipeForView, allFoods]);

  const handleConvertToGlobal = async () => {
    setIsSubmitting(true);
    try {
        const ingredientsForFunction = freeMeal.ingredients.map(ing => ({
            food_id: ing.food_id,
            grams: ing.grams,
            food_group_id: ing.food.food_to_food_groups?.[0]?.food_group_id || null,
        }));

        const { data: result, error: rpcError } = await supabase.rpc('add_global_recipe_to_plan', {
            p_user_id: freeMeal.user_id,
            p_day_meal_id: freeMeal.day_meal_id,
            p_recipe_name: freeMeal.name,
            p_instructions: freeMeal.instructions,
            p_ingredients: ingredientsForFunction
        });

        if (rpcError) throw rpcError;
        if (!result.success) throw new Error(result.error || 'Ocurrió un error en el servidor.');

        const { error: statusError } = await supabase.from('free_recipes').update({ status: 'approved' }).eq('id', freeMeal.id);
        if (statusError) throw statusError;

        let successMessage = 'Receta libre convertida a receta global.';
        if (result.addedToPlan) {
            successMessage += ' y añadida al plan del cliente.';
        } else {
            successMessage += ` ${result.reason || 'No se pudo añadir al plan del cliente.'}`;
        }

        toast({ title: 'Éxito', description: successMessage });
        onSuccess();

    } catch (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleConvertToPrivate = async () => {
    setIsSubmitting(true);
    try {
      const { data: newPrivateRecipe, error: privateRecipeError } = await supabase
        .from('private_recipes')
        .insert({
          user_id: freeMeal.user_id,
          source_free_recipe_id: freeMeal.id,
          name: freeMeal.name,
          instructions: freeMeal.instructions,
        })
        .select('id')
        .single();
      if (privateRecipeError) throw privateRecipeError;

      const ingredientsToCopy = freeMeal.ingredients.map(ing => ({
        private_recipe_id: newPrivateRecipe.id,
        food_id: ing.food_id,
        grams: ing.grams,
      }));
      const { error: ingredientsError } = await supabase.from('private_recipe_ingredients').insert(ingredientsToCopy);
      if (ingredientsError) throw ingredientsError;

      const { data: activePlan, error: planError } = await supabase
        .from('diet_plans')
        .select('id')
        .eq('user_id', freeMeal.user_id)
        .eq('is_active', true)
        .maybeSingle();

      if (planError) throw planError;

      if (activePlan) {
        const { error: planRecipeError } = await supabase.from('diet_plan_recipes').insert({
          diet_plan_id: activePlan.id,
          private_recipe_id: newPrivateRecipe.id,
          day_meal_id: freeMeal.day_meal_id,
        });
        if (planRecipeError) throw planRecipeError;
      }

      const { error: statusError } = await supabase.from('free_recipes').update({ status: 'approved' }).eq('id', freeMeal.id);
      if (statusError) throw statusError;

      toast({ title: 'Éxito', description: 'Receta libre convertida a receta privada y añadida al plan.' });
      onSuccess();
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !freeMeal) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-none bg-slate-900 border-slate-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-2xl text-white">Revisar y Gestionar Receta Libre</DialogTitle>
          <DialogDescription>
            Receta registrada por {freeMeal.profiles?.full_name || 'el cliente'}.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto p-1 pr-4 styled-scrollbar-green">
          {loadingFoods ? <Loader2 className="animate-spin" /> : <RecipeView recipe={recipeForView} macros={macros} allFoods={allFoods} />}
        </div>
        <DialogFooter className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button onClick={handleConvertToPrivate} className="bg-gradient-to-br from-[hsl(211,51.05%,50.44%)] to-[hsl(121.85deg_65%_49%_/_58%)] hover:from-[hsl(211,51.05%,46.44%)] hover:to-[hsl(121.85deg_65%_45%_/_58%)] text-white" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
            Guardar como Receta Privada
          </Button>
          <Button onClick={handleConvertToGlobal} className="bg-green-600 hover:bg-green-700" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Globe className="h-4 w-4 mr-2" />}
            Convertir a Receta Global
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FreeMealReviewModal;