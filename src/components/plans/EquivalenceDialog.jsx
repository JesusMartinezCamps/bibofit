import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import { addDays, format, parseISO, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

const EquivalenceDialog = ({ open, onOpenChange, sourceItem, sourceItemType, sourceLogId, onSuccess, sourceItemMacros }) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableMeals, setAvailableMeals] = useState([]);
  const [selectedMeal, setSelectedMeal] = useState(null);

  const sourceDate = useMemo(() => {
    if (!sourceItem) return null;
    return sourceItem.meal_date || sourceItem.log_date;
  }, [sourceItem]);

  const parsedSourceDate = useMemo(() => {
    return sourceDate ? parseISO(sourceDate) : null;
  }, [sourceDate]);

  useEffect(() => {
    const fetchAvailableMeals = async () => {
      if (!open || !sourceItem || !sourceDate || !parsedSourceDate) return;
      setLoading(true);
      try {
        let activePlanId = sourceItem.diet_plan_id;

        if (!activePlanId) {
            const { data: planData, error: planError } = await supabase
            .from('diet_plans')
            .select('id')
            .eq('user_id', sourceItem.user_id)
            .lte('start_date', sourceDate)
            .gte('end_date', sourceDate)
            .eq('is_active', true)
            .maybeSingle();

            if (planError) throw planError;
            activePlanId = planData?.id;
        }

        if (!activePlanId) {
            throw new Error("No se encontró un plan de dieta activo para la fecha seleccionada.");
        }
        
        const { data: userDayMeals, error: userDayMealsError } = await supabase
          .from('user_day_meals')
          .select('*, day_meal:day_meal_id(*)')
          .eq('user_id', sourceItem.user_id)
          .eq('diet_plan_id', activePlanId)
          .order('display_order', { foreignTable: 'day_meal', ascending: true });
        
        if (userDayMealsError) throw userDayMealsError;

        const sortedUserDayMeals = (userDayMeals || []).sort((a, b) => {
             return (a.day_meal?.display_order || 0) - (b.day_meal?.display_order || 0);
        });

        const sourceMealOrder = sortedUserDayMeals.find(udm => udm.day_meal_id === sourceItem.day_meal_id)?.day_meal?.display_order;
        
        const todayFormatted = format(parsedSourceDate, 'yyyy-MM-dd');
        const tomorrow = addDays(parsedSourceDate, 1);
        const tomorrowFormatted = format(tomorrow, 'yyyy-MM-dd');

        const todayMeals = sortedUserDayMeals
          .filter(udm => sourceMealOrder === undefined || (udm.day_meal?.display_order || 0) >= sourceMealOrder)
          .map(udm => ({
            ...udm,
            date: todayFormatted,
            label: `${udm.day_meal?.name || 'Comida'} (Hoy)`,
            display_order: udm.day_meal?.display_order || 0
          }));

        const tomorrowMeals = sortedUserDayMeals.map(udm => ({
          ...udm,
          date: tomorrowFormatted,
          label: `${udm.day_meal?.name || 'Comida'} (Mañana)`,
          display_order: (udm.day_meal?.display_order || 0) + 100 
        }));

        const finalSortedMeals = [...todayMeals, ...tomorrowMeals].sort((a, b) => a.display_order - b.display_order);

        setAvailableMeals(finalSortedMeals);
      } catch (error) {
        console.error("Error fetching available meals:", error);
        toast({ title: 'Error', description: `No se pudieron cargar las comidas: ${error.message}`, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };

    fetchAvailableMeals();
  }, [open, sourceItem, sourceDate, toast, parsedSourceDate]);

  const handleConfirm = async () => {
    if (!selectedMeal || !sourceItemMacros || !user) {
        toast({ title: 'Error', description: 'Faltan datos para crear la equivalencia.', variant: 'destructive' });
        return;
    }
    setIsSubmitting(true);
    try {
      const freeRecipeId = sourceItemType === 'free_recipe' 
        ? (sourceItem.free_recipe?.id || sourceItem.id) 
        : null;
      
      const freeRecipeOccurrenceId = sourceItemType === 'free_recipe' ? sourceItem.occurrence_id : null;

      // 1. Calculate Target Macros (Meal Target - Snack Adjustment)
      const newTargetMacros = {
          calories: Math.max(0, (selectedMeal.target_calories || 0) - (sourceItemMacros.calories || 0)),
          proteins: Math.max(0, (selectedMeal.target_proteins || 0) - (sourceItemMacros.proteins || 0)),
          carbs: Math.max(0, (selectedMeal.target_carbs || 0) - (sourceItemMacros.carbs || 0)),
          fats: Math.max(0, (selectedMeal.target_fats || 0) - (sourceItemMacros.fats || 0)),
      };

      // 2. Create Adjustment Record
      const adjustmentPayload = {
        user_id: sourceItem.user_id,
        log_date: selectedMeal.date,
        target_user_day_meal_id: selectedMeal.id,
        adjustment_calories: sourceItemMacros.calories,
        adjustment_proteins: sourceItemMacros.proteins,
        adjustment_carbs: sourceItemMacros.carbs,
        adjustment_fats: sourceItemMacros.fats,
        source_free_recipe_id: freeRecipeId,
        source_free_recipe_occurrence_id: freeRecipeOccurrenceId,
        source_daily_snack_log_id: sourceItemType === 'snack' ? sourceLogId : null,
        source_diet_plan_recipe_id: sourceItemType === 'recipe' ? sourceItem.id : null,
        source_private_recipe_id: sourceItemType === 'private_recipe' ? sourceItem.id : null,
        status: 'pending',
      };
      
      const { data: newAdjustment, error: adjustmentError } = await supabase
        .from('equivalence_adjustments')
        .insert(adjustmentPayload)
        .select()
        .single();

      if (adjustmentError) throw adjustmentError;

      // 3. Identify Recipes
      const dateObj = parseISO(selectedMeal.date);
      const jsDay = dateObj.getDay(); 
      const isoDow = jsDay === 0 ? 7 : jsDay;

      // Diet Plan Recipes
      const { data: planRecipes } = await supabase
        .from('diet_plan_recipes')
        .select('id')
        .eq('diet_plan_id', selectedMeal.diet_plan_id)
        .eq('day_meal_id', selectedMeal.day_meal_id);

      // Private Recipes
      const { data: plannedPrivate } = await supabase
        .from('private_recipes')
        .select('id')
        .eq('user_id', user.id)
        .eq('diet_plan_id', selectedMeal.diet_plan_id)
        .eq('day_meal_id', selectedMeal.day_meal_id);

      const recipesPayload = [];
      if (planRecipes) {
          planRecipes.forEach(r => recipesPayload.push({ id: r.id, is_private: false }));
      }
      if (plannedPrivate) {
          plannedPrivate.forEach(p => recipesPayload.push({ id: p.private_recipe_id, is_private: true }));
      }

      const payload = {
          equivalence_adjustment_id: newAdjustment.id,
          user_id: user.id,
          target_macros: newTargetMacros,
          recipes: recipesPayload
      };

      // Validation
      if (!payload.user_id || !payload.equivalence_adjustment_id || !payload.target_macros || !payload.recipes) {
          console.error("Payload Validation Failed", payload);
          throw new Error("Validation Failed: Missing required fields in payload.");
      }

      // 4. Invoke Edge Function (Aligned Structure)
      const { data: funcData, error: invokeError } = await supabase.functions.invoke('auto-balance-equivalence', {
          body: payload
      });

      if (invokeError) throw new Error('Error en el balanceo automático: ' + invokeError.message);
      if (funcData && !funcData.success) throw new Error('Error interno en balanceo: ' + (funcData.error || 'Unknown error'));


      toast({ title: 'Éxito', description: 'Equivalencia aplicada y recetas ajustadas.' });
      if(onSuccess) onSuccess(newAdjustment);
      onOpenChange(false);
    } catch (error) {
      console.error("Equivalence Process Error:", error);
      toast({ title: 'Error', description: `No se pudo aplicar la equivalencia: ${error.message}`, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1a1e23] border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle>Aplicar Equivalencia por Calorías</DialogTitle>
          <DialogDescription>
            Selecciona una comida futura para restar las calorías de este {sourceItemType === 'snack' ? 'picoteo' : (sourceItemType === 'free_recipe' ? 'comida libre' : 'receta')}.
            <div className="mt-2 font-bold text-red-400">
              Calorías a compensar: {Math.round(sourceItemMacros?.calories || 0)} kcal
            </div>
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto space-y-4 p-1 styled-scrollbar-blue">
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : availableMeals.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {availableMeals.map(meal => {
                const isTodayMeal = parsedSourceDate && isSameDay(parseISO(meal.date), parsedSourceDate);
                const isSelected = selectedMeal?.id === meal.id && selectedMeal?.date === meal.date;

                return (
                  <Button
                    key={`${meal.id}-${meal.date}`}
                    variant={isSelected ? 'default' : 'outline'}
                    className={cn(
                      'w-full justify-start h-auto py-3 transition-all duration-200',
                      {
                        'bg-blue-600 hover:bg-blue-700 text-white': isSelected,
                        'bg-gradient-to-r from-[#001e2f] to-[#2f2169] hover:from-[#002b44] hover:to-[#3e2f84] text-white border-blue-800': isTodayMeal && !isSelected,
                        'bg-gradient-to-r from-[#142631] to-[#312953] hover:from-[#1b3442] hover:to-[#3d3368] text-white border-gray-600': !isTodayMeal && !isSelected
                      }
                    )}
                    onClick={() => setSelectedMeal(meal)}
                  >
                    {meal.label}
                  </Button>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-gray-400 py-8">No hay comidas futuras disponibles para aplicar la equivalencia.</p>
          )}
        </div>
        <div className="flex justify-between pt-4">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="border-gray-600 bg-gray-900/50 hover:bg-gray-800 text-white hover:text-white"
          >
            Continuar sin aplicar
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={!selectedMeal || isSubmitting || (sourceItemMacros?.calories || 0) <= 0}
            className={cn(
              'transition-all',
              {
                'bg-gray-500': !selectedMeal || (sourceItemMacros?.calories || 0) <= 0,
                'bg-gradient-to-r from-blue-800 to-cyan-800 text-white': selectedMeal && (sourceItemMacros?.calories || 0) > 0
              }
            )}
          >
            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Aplicando...</> : 'Confirmar Equivalencia'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EquivalenceDialog;
