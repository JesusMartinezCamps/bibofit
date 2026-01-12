import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import ViewModeToggle from '@/components/shared/AdminViewToggle';
import { useAuth } from '@/contexts/AuthContext';
import RecipeView from '@/components/shared/RecipeView';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Scale } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import IngredientBuilder from '@/components/admin/recipes/IngredientBuilder';
import DayMealSelect from '@/components/ui/day-meal-select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { motion, AnimatePresence } from 'framer-motion';
import EquivalenceDialog from './EquivalenceDialog';
import { calculateMacros } from '@/lib/macroCalculator';

const FreeMealViewDialog = ({ open, onOpenChange, freeMeal, onUpdate }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState('view');
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allFoods, setAllFoods] = useState([]);
  const [allVitamins, setAllVitamins] = useState([]);
  const [allMinerals, setAllMinerals] = useState([]);
  const [allFoodGroups, setAllFoodGroups] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [dayMealId, setDayMealId] = useState('');
  const [name, setName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [isEquivalenceDialogOpen, setIsEquivalenceDialogOpen] = useState(false);
  const [currentFreeMeal, setCurrentFreeMeal] = useState(freeMeal);

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [foodsRes, vitaminsRes, mineralsRes, groupsRes] = await Promise.all([
          supabase.from('food').select('*, food_to_food_groups(food_group_id), food_vitamins(vitamin_id), food_minerals(mineral_id)'),
          supabase.from('vitamins').select('*'),
          supabase.from('minerals').select('*'),
          supabase.from('food_groups').select('*')
      ]);
      if (foodsRes.error) throw foodsRes.error;
      if (vitaminsRes.error) throw vitaminsRes.error;
      if (mineralsRes.error) throw mineralsRes.error;
      if (groupsRes.error) throw groupsRes.error;
      
      setAllFoods(foodsRes.data || []);
      setAllVitamins(vitaminsRes.data || []);
      setAllMinerals(mineralsRes.data || []);
      setAllFoodGroups(groupsRes.data || []);

    } catch (error) {
      toast({ title: 'Error', description: 'No se pudieron cargar los datos necesarios.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (open) {
      setCurrentFreeMeal(freeMeal);
      fetchInitialData();
      if (freeMeal) {
        setIngredients(freeMeal.ingredients.map(ing => ({
          local_id: ing.id,
          food_id: ing.food_id,
          quantity: ing.grams,
          food_group_id: ing.food?.food_to_food_groups?.[0]?.food_group_id || null
        })));
        setDayMealId(String(freeMeal.day_meal_id));
        setName(freeMeal.name || '');
        setInstructions(freeMeal.instructions || '');
        setMode('view');
        setHasChanges(false);
      }
    }
  }, [open, freeMeal, fetchInitialData]);
  
  useEffect(() => {
      if (open && freeMeal && allFoods.length > 0) {
          setIngredients((freeMeal.ingredients || []).map(ing => {
              const foodDetails = allFoods.find(f => f.id === ing.food_id);
              const foodGroupId = foodDetails?.food_to_food_groups?.[0]?.food_group_id || null;
              return {
                  local_id: ing.id,
                  food_id: String(ing.food_id),
                  quantity: ing.grams,
                  food_group_id: foodGroupId ? String(foodGroupId) : '',
              };
          }));
      }
  }, [open, freeMeal, allFoods]);

  const recipeForView = React.useMemo(() => {
    if (!currentFreeMeal) return null;
    const ingredientsForView = (currentFreeMeal.ingredients || []).map(ing => {
      const food = allFoods.find(f => f.id === ing.food_id);
      return { ...ing, food };
    });

    return {
      name: currentFreeMeal.name || `Receta Libre: ${currentFreeMeal.day_meal?.name || ''}`,
      difficulty: null,
      prep_time_min: null,
      instructions: currentFreeMeal.instructions,
      ingredients: ingredientsForView.map(ing => ({
        food_id: ing.food_id,
        grams: ing.grams,
        food: ing.food,
      })),
    };
  }, [currentFreeMeal, allFoods]);

  const macros = React.useMemo(() => {
    if (!recipeForView || !recipeForView.ingredients || !allFoods.length) return { proteins: 0, carbs: 0, fats: 0, calories: 0 };
    return calculateMacros(recipeForView.ingredients, allFoods);
  }, [recipeForView, allFoods]);


  const handleUpdate = async () => {
    if (!currentFreeMeal) return;
    setIsSubmitting(true);
    try {
      await supabase.from('free_recipe_ingredients').delete().eq('free_recipe_id', currentFreeMeal.id);
      
      const newIngredients = ingredients.map(ing => ({
        free_recipe_id: currentFreeMeal.id,
        food_id: parseInt(ing.food_id),
        grams: parseFloat(ing.quantity),
      }));
      
      const { error: insertError } = await supabase.from('free_recipe_ingredients').insert(newIngredients);
      if (insertError) throw insertError;

      const { error: updateError } = await supabase.from('free_recipes').update({ 
        day_meal_id: dayMealId,
        name: name,
        instructions: instructions
      }).eq('id', currentFreeMeal.id);
      if (updateError) throw updateError;
      
      const { data: updatedFreeMeal, error: refetchError } = await supabase
        .from('free_recipes')
        .select('*, ingredients:free_recipe_ingredients(*, food(*, food_to_food_groups(food_group_id))), day_meal:day_meal_id!inner(id, name, display_order)')
        .eq('id', currentFreeMeal.id)
        .single();
      
      if(refetchError) throw refetchError;

      setCurrentFreeMeal(updatedFreeMeal);
      if (onUpdate) onUpdate(updatedFreeMeal);
      
      toast({ title: 'Éxito', description: 'Receta libre actualizada.' });
      setHasChanges(false);
      setMode('view');
    } catch (error) {
      toast({ title: 'Error', description: `No se pudo actualizar: ${error.message}`, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleModeChange = async (checked) => {
    const newMode = checked ? 'view' : 'settings';
    if (mode === 'settings' && newMode === 'view' && hasChanges) {
      await handleUpdate();
    } else {
      setMode(newMode);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    onOpenChange(false);
  };

  if (!currentFreeMeal) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="bg-[#1a1e23] border-gray-700 text-white w-[95vw] max-w-4xl max-h-[90vh] flex flex-col p-0">
          <ViewModeToggle
            mode={mode}
            onModeChange={handleModeChange}
            loading={isSubmitting}
            onClose={handleClose}
            className="flex-shrink-0"
            hasChanges={hasChanges}
          />

          <div className="flex-1 overflow-y-auto styled-scrollbar-green p-6 pt-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                {loading ? (
                  <div className="flex justify-center items-center h-full"><Loader2 className="h-12 w-12 animate-spin text-blue-500" /></div>
                ) : mode === 'view' ? (
                  <>
                    <RecipeView
                      recipe={recipeForView}
                      allFoods={allFoods}
                      allVitamins={allVitamins}
                      allMinerals={allMinerals}
                      allFoodGroups={allFoodGroups}
                      macros={macros}
                      isFreeMealView={true}
                    />
                    <div className="mt-8 flex justify-center">
                      <Button onClick={() => setIsEquivalenceDialogOpen(true)} className="bg-blue-900/50 border border-blue-700 text-blue-300 hover:bg-blue-800/50 hover:border-blue-600">
                        <Scale className="mr-2 h-4 w-4" />
                        Equivalencia por Calorías
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label>Momento del Día</Label>
                        <DayMealSelect userId={user.id} value={dayMealId} onValueChange={(v) => { setDayMealId(v); setHasChanges(true); }} className="mt-1" />
                      </div>
                      <div>
                        <Label>Nombre de la Receta</Label>
                        <Input value={name} onChange={(e) => { setName(e.target.value); setHasChanges(true); }} className="input-field mt-1" />
                      </div>
                    </div>
                    <div>
                      <Label>Detalles</Label>
                      <Textarea value={instructions} onChange={(e) => { setInstructions(e.target.value); setHasChanges(true); }} className="input-field mt-1" />
                    </div>
                    <IngredientBuilder
                      ingredients={ingredients}
                      onIngredientsChange={(ings) => { setIngredients(ings); setHasChanges(true); }}
                      availableFoods={allFoods}
                      isAdminView={false}
                      userId={user.id}
                      onlyGeneralFoods={true}
                    />
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </DialogContent>
      </Dialog>
      {isEquivalenceDialogOpen && (
        <EquivalenceDialog
          open={isEquivalenceDialogOpen}
          onOpenChange={setIsEquivalenceDialogOpen}
          freeMeal={currentFreeMeal}
          freeMealMacros={macros}
          onSuccess={() => {
            setIsEquivalenceDialogOpen(false);
            onUpdate();
          }}
        />
      )}
    </>
  );
};

export default FreeMealViewDialog;