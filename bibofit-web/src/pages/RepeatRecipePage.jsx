import React, { useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import RepeatFreeRecipeDialog from '@/components/plans/RepeatFreeRecipeDialog';
import { useDietPlanRefresh } from '@/contexts/DietPlanContext';

const RepeatRecipePage = () => {
  const navigate = useNavigate();
  const { requestRefresh } = useDietPlanRefresh();
  const { date, userId: adminUserId } = useParams();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const dayMealId = searchParams.get('dayMealId');
  const planId = searchParams.get('planId');
  const userId = searchParams.get('userId');

  const handleClose = useCallback(() => {
    if (adminUserId) {
      navigate(`/plan/dieta/${adminUserId}/${date}`);
    } else {
      navigate(`/plan/dieta/${date}`);
    }
  }, [navigate, date, adminUserId]);

  const handleSelectRecipe = useCallback(async (recipeToRepeat) => {
    try {
      const { data: userDayMealsData, error: udmError } = await supabase
        .from('user_day_meals')
        .select('id')
        .eq('user_id', userId)
        .eq('day_meal_id', dayMealId)
        .eq('diet_plan_id', planId)
        .limit(1);

      if (udmError) throw udmError;
      const userDayMeal = userDayMealsData?.[0];
      if (!userDayMeal) throw new Error('Configuración de comida de usuario no encontrada.');

      const { error: deleteError } = await supabase
        .from('daily_meal_logs')
        .delete()
        .match({ user_id: userId, log_date: date, user_day_meal_id: userDayMeal.id });
      if (deleteError) throw deleteError;

      const { data: occurrence, error: occurrenceError } = await supabase
        .from('free_recipe_occurrences')
        .insert({
          user_recipe_id: recipeToRepeat.id,
          user_id: userId,
          meal_date: date,
          day_meal_id: dayMealId,
        })
        .select()
        .single();
      if (occurrenceError) throw occurrenceError;

      const { error: insertError } = await supabase
        .from('daily_meal_logs')
        .insert({
          user_id: userId,
          log_date: date,
          free_recipe_occurrence_id: occurrence.id,
          user_day_meal_id: userDayMeal.id,
        });
      if (insertError) throw insertError;

      toast({ title: 'Receta añadida', description: 'La receta ha sido añadida al plan.' });
      requestRefresh();
    } catch (error) {
      console.error('Error adding repeated recipe:', error);
      toast({
        title: 'Error',
        description: `No se pudo añadir la receta: ${error.message}`,
        variant: 'destructive',
      });
    }
  }, [userId, dayMealId, planId, date, toast]);

  const handleDeleteRecipe = useCallback(async (recipeId) => {
    try {
      const { error } = await supabase.from('user_recipes').delete().eq('id', recipeId);
      if (error) throw error;
      toast({ title: 'Receta eliminada', description: 'La receta ha sido eliminada permanentemente.' });
      return true;
    } catch (error) {
      console.error('Error deleting recipe:', error);
      toast({ title: 'Error', description: 'No se pudo eliminar la receta.', variant: 'destructive' });
      return false;
    }
  }, [toast]);

  return (
    <>
      <Helmet>
        <title>Repetir Receta - Bibofit</title>
      </Helmet>
      <div className="w-full h-full flex flex-col">
        <RepeatFreeRecipeDialog
          asPage={true}
          open={true}
          onOpenChange={(open) => { if (!open) handleClose(); }}
          planId={planId}
          userId={userId}
          onSelectRecipe={handleSelectRecipe}
          onDeleteRecipe={handleDeleteRecipe}
        />
      </div>
    </>
  );
};

export default RepeatRecipePage;
