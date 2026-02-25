import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, ArrowRight, Utensils, CalendarDays, CheckCircle2, X } from 'lucide-react';
import { addDays, format, parseISO, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

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
            label: udm.day_meal?.name || 'Comida',
            subLabel: 'Hoy',
            display_order: udm.day_meal?.display_order || 0
          }));

        const tomorrowMeals = sortedUserDayMeals.map(udm => ({
          ...udm,
          date: tomorrowFormatted,
          label: udm.day_meal?.name || 'Comida',
          subLabel: 'Mañana',
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
      console.log('1. New Target Macros:', newTargetMacros);

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
        .from('planned_meals')
        .select('id')
        .eq('user_id', user.id)
        .eq('diet_plan_id', selectedMeal.diet_plan_id)
        .eq('plan_date', selectedMeal.date)
        .eq('day_meal_id', selectedMeal.day_meal_id);


      const recipesPayload = [];
      if (planRecipes) {
          planRecipes.forEach(r => recipesPayload.push({ id: r.id, is_private: false }));
      }
      if (plannedPrivate) {
          plannedPrivate.forEach(p => recipesPayload.push({ id: p.private_recipe_id, is_private: true }));
      }
      console.log('2. Identified Recipes:', recipesPayload);

      const payload = {
          equivalence_adjustment_id: newAdjustment.id,
          user_id: user.id,
          target_macros: newTargetMacros,
          recipes: recipesPayload
      };
      console.log('3. Sending Payload to Edge Function:', payload);

      // Validation
      if (!payload.user_id || !payload.equivalence_adjustment_id || !payload.target_macros || !payload.recipes) {
          console.error("Payload Validation Failed", payload);
          throw new Error("Validation Failed: Missing required fields in payload.");
      }

      // 4. Invoke Edge Function (Aligned Structure)
      const { data: funcData, error: invokeError } = await supabase.functions.invoke('auto-balance-equivalence', {
          body: payload
      });

      console.log('4. Edge Function Response:', funcData, invokeError);

      if (invokeError) throw new Error('Error en el balanceo automático: ' + invokeError.message);
      if (funcData && !funcData.success) throw new Error('Error interno en balanceo: ' + (funcData.error || 'Unknown error'));

      toast({ title: 'Éxito', description: 'Equivalencia aplicada y recetas ajustadas.' });
      if(onSuccess) onSuccess(newAdjustment);
      // NO cerramos aquí: el padre se encarga de cerrar y limpiar estado.
      // Esto evita el "cierra/reabre" por dobles updates + refetch.    
    } catch (error) {
      console.error("Equivalence Process Error:", error);
      toast({ title: 'Error', description: `No se pudo aplicar la equivalencia: ${error.message}`, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const caloriesToCompensate = Math.round(sourceItemMacros?.calories || 0);
  const handleDialogOpenChange = (nextOpen) => {
    if (isSubmitting && !nextOpen) {
      return;
    }
    onOpenChange(nextOpen);
  };
  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent
        className="bg-slate-900 border-slate-800 text-slate-50 max-w-2xl p-0 overflow-hidden shadow-2xl rounded-2xl"
        onEscapeKeyDown={(event) => {
          if (isSubmitting) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (isSubmitting) event.preventDefault();
        }}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onOpenChange(false)}
          className="absolute right-3 top-9 z-30 h-9 w-9 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/70"
          aria-label="Cerrar"
        >
          <X className="h-5 w-5" />
        </Button>

        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 pointer-events-none" />
        
        <DialogHeader className="p-6 pb-2 relative z-10 border-b border-slate-800/60 bg-slate-900/50 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/20">
              <Utensils className="w-5 h-5 text-white" />
            </div>
            <DialogTitle className="text-xl font-semibold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              Aplicar Equivalencia
            </DialogTitle>
          </div>
          <DialogDescription className="text-slate-400 text-base leading-relaxed">
            Selecciona una comida futura para compensar las calorías de este {sourceItemType === 'snack' ? 'picoteo' : (sourceItemType === 'free_recipe' ? 'comida libre' : 'receta')}.
          </DialogDescription>
          
          <div className="mt-4 flex items-center justify-between p-4 bg-slate-800/50 rounded-xl border border-slate-700/50 shadow-inner">
             <div className="flex flex-col">
               <span className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Calorías a Compensar</span>
               <span className="text-2xl font-bold text-red-400 tabular-nums tracking-tight">
                 {caloriesToCompensate} <span className="text-sm font-medium text-red-400/70">kcal</span>
               </span>
             </div>
             <div className="h-8 w-px bg-slate-700/50 mx-4 hidden sm:block"></div>
             <div className="hidden sm:flex flex-col items-end">
               <span className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Impacto Estimado</span>
               <span className="text-sm text-slate-300">Se ajustarán las porciones automáticamente</span>
             </div>
          </div>
        </DialogHeader>

        <div className="max-h-[55vh] overflow-y-auto p-6 relative z-10 styled-scrollbar-thin eq-scrollbar-blue">
          {loading ? (
            <div className="flex flex-col justify-center items-center h-48 gap-3 animate-pulse">
              <div className="p-3 bg-blue-500/10 rounded-full">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              </div>
              <p className="text-sm text-slate-400 font-medium">Buscando opciones compatibles...</p>
            </div>
          ) : availableMeals.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <AnimatePresence mode='popLayout'>
                {availableMeals.map((meal, idx) => {
                  const isTodayMeal = parsedSourceDate && isSameDay(parseISO(meal.date), parsedSourceDate);
                  const isSelected = selectedMeal?.id === meal.id && selectedMeal?.date === meal.date;

                  return (
                    <motion.div
                      key={`${meal.id}-${meal.date}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05, duration: 0.3 }}
                      whileHover={{ scale: 1.02, translateY: -2 }}
                      whileTap={{ scale: 0.98 }}
                      className="relative"
                    >
                      <button
                        onClick={() => setSelectedMeal(meal)}
                        className={cn(
                          'w-full text-left p-4 rounded-xl border transition-all duration-300 relative overflow-hidden group',
                          isSelected 
                            ? 'bg-gradient-to-br from-blue-600 to-indigo-600 border-blue-500/50 shadow-lg shadow-blue-500/20' 
                            : isTodayMeal
                              ? 'bg-blue-500/10 border-slate-700 hover:border-blue-500/30 hover:bg-blue-500/30 hover:shadow-md'
                              : 'bg-slate-900/40 border-slate-700/50 hover:border-indigo-500/30 hover:bg-slate-800/60'
                        )}
                      >
                        {isSelected && (
                          <div className="absolute top-2 right-2 text-white/20">
                            <CheckCircle2 className="w-16 h-16 rotate-12 opacity-20 -mr-4 -mt-4" />
                          </div>
                        )}
                        
                        <div className="relative z-10 flex flex-col h-full justify-between">
                          <div className="flex justify-between items-start mb-2">
                             <div className={cn(
                               "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1",
                               isSelected ? "bg-white/20 text-white" : isTodayMeal ? "bg-blue-500/10 text-blue-400" : "bg-slate-700 text-slate-400"
                             )}>
                               <CalendarDays className="w-3 h-3" />
                               {meal.subLabel}
                             </div>
                             {isSelected && (
                               <CheckCircle2 className="w-5 h-5 text-white animate-in zoom-in duration-300" />
                             )}
                          </div>
                          
                          <h3 className={cn(
                            "font-semibold text-lg leading-tight transition-colors",
                            isSelected ? "text-white" : "text-slate-200 group-hover:text-white"
                          )}>
                            {meal.label}
                          </h3>
                          
                          <div className={cn(
                            "mt-3 text-xs flex items-center gap-1 transition-colors",
                            isSelected ? "text-blue-100" : "text-slate-500 group-hover:text-slate-400"
                          )}>
                             <span>Objetivo original:</span>
                             <span className="font-medium">{Math.round(meal.target_calories || 0)} kcal</span>
                          </div>
                        </div>
                        
                        {/* Decorative gradient blur */}
                        {!isSelected && (
                            <div className={cn(
                                "absolute -bottom-4 -right-4 w-24 h-24 rounded-full blur-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-500 pointer-events-none",
                                isTodayMeal ? "bg-blue-500" : "bg-indigo-500"
                            )} />
                        )}
                      </button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center bg-slate-800/30 rounded-xl border border-slate-800 border-dashed">
              <div className="p-4 bg-slate-800 rounded-full mb-3 text-slate-500">
                <CalendarDays className="w-8 h-8" />
              </div>
              <h3 className="text-slate-300 font-medium text-lg mb-1">Sin opciones disponibles</h3>
              <p className="text-slate-500 max-w-xs text-sm">No hay comidas futuras planificadas donde aplicar esta equivalencia.</p>
            </div>
          )}
        </div>

        <DialogFooter className="p-6 border-t border-slate-800/60 bg-slate-900/50 backdrop-blur-sm relative z-20 flex flex-col sm:flex-row gap-3">
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto text-slate-400 hover:text-white hover:bg-slate-800"
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={!selectedMeal || isSubmitting || caloriesToCompensate <= 0}
            className={cn(
              'w-full sm:w-auto relative overflow-hidden transition-all duration-300 shadow-lg',
              (!selectedMeal || caloriesToCompensate <= 0)
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5'
            )}
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> 
                Procesando...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Confirmar Equivalencia 
                <ArrowRight className="h-4 w-4 opacity-80" />
              </span>
            )}
          </Button>
          {isSubmitting && (
            <p className="text-xs text-slate-400 sm:ml-2">
              Espera un momento, estamos recalculando tu plan.
            </p>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EquivalenceDialog;