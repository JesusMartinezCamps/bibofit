import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import { addDays, format, parseISO, isSameDay } from 'date-fns'; // Import isSameDay
import { cn } from '@/lib/utils';

const EquivalenceDialog = ({ open, onOpenChange, sourceItem, sourceItemType, sourceLogId, onSuccess, sourceItemMacros }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableMeals, setAvailableMeals] = useState([]);
  const [selectedMeal, setSelectedMeal] = useState(null);

  const sourceDate = useMemo(() => {
    if (!sourceItem) return null;
    return sourceItem.meal_date || sourceItem.log_date;
  }, [sourceItem]);

  // Parse sourceDate once to avoid re-parsing in render loop
  const parsedSourceDate = useMemo(() => {
    return sourceDate ? parseISO(sourceDate) : null;
  }, [sourceDate]);

  useEffect(() => {
    const fetchAvailableMeals = async () => {
      if (!open || !sourceItem || !sourceDate || !parsedSourceDate) return;
      setLoading(true);
      try {
        const { data: userDayMeals, error: userDayMealsError } = await supabase
          .from('user_day_meals')
          .select('*, day_meal:day_meal_id(*)')
          .eq('user_id', sourceItem.user_id)
          .order('display_order', { foreignTable: 'day_meal', ascending: true });
        
        if (userDayMealsError) throw userDayMealsError;

        const sourceMealOrder = userDayMeals.find(udm => udm.day_meal_id === sourceItem.day_meal_id)?.day_meal.display_order;
        
        const todayFormatted = format(parsedSourceDate, 'yyyy-MM-dd');
        const tomorrow = addDays(parsedSourceDate, 1);
        const tomorrowFormatted = format(tomorrow, 'yyyy-MM-dd');

        const todayMeals = userDayMeals
          .filter(udm => sourceMealOrder === undefined || udm.day_meal.display_order >= sourceMealOrder)
          .map(udm => ({
            ...udm,
            date: todayFormatted,
            label: `${udm.day_meal.name} (Hoy)`,
            display_order: udm.day_meal.display_order
          }));

        const tomorrowMeals = userDayMeals.map(udm => ({
          ...udm,
          date: tomorrowFormatted,
          label: `${udm.day_meal.name} (Mañana)`,
          display_order: udm.day_meal.display_order + 100 // Add a large number to ensure they come after today's meals
        }));

        const sortedMeals = [...todayMeals, ...tomorrowMeals].sort((a, b) => a.display_order - b.display_order);

        setAvailableMeals(sortedMeals);
      } catch (error) {
        toast({ title: 'Error', description: `No se pudieron cargar las comidas: ${error.message}`, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };

    fetchAvailableMeals();
  }, [open, sourceItem, sourceDate, toast, parsedSourceDate]);

  const handleConfirm = async () => {
    if (!selectedMeal || !sourceItemMacros) {
        toast({ title: 'Error', description: 'Faltan datos para crear la equivalencia.', variant: 'destructive' });
        return;
    }
    setIsSubmitting(true);
    try {
      // Determine the correct ID based on the item structure (flat or nested)
      const freeRecipeId = sourceItemType === 'free_recipe' 
        ? (sourceItem.free_recipe?.id || sourceItem.id) 
        : null;
      
      // Determine the occurrence ID if it's a free recipe
      const freeRecipeOccurrenceId = sourceItemType === 'free_recipe' ? sourceItem.occurrence_id : null;

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

      toast({ title: 'Éxito', description: 'Equivalencia solicitada. El sistema está ajustando las recetas...' });
      if(onSuccess) onSuccess(newAdjustment);
      onOpenChange(false);
    } catch (error) {
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
                        // Selected meal styles
                        'bg-blue-600 hover:bg-blue-700 text-white': isSelected,
                        
                        // Unselected "Today" meal styles
                        'bg-gradient-to-r from-[#001e2f] to-[#2f2169] hover:from-[#002b44] hover:to-[#3e2f84] text-white border-blue-800': isTodayMeal && !isSelected,
                        
                        // Unselected "Tomorrow" meal styles
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