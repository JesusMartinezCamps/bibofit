import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import ViewModeToggle from '@/components/shared/AdminViewToggle';
import { useAuth } from '@/contexts/AuthContext';
import RecipeView from '@/components/shared/RecipeView';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Scale } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import DayMealSelect from '@/components/ui/day-meal-select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { motion, AnimatePresence } from 'framer-motion';
import EquivalenceDialog from './EquivalenceDialog';
import { calculateMacros } from '@/lib/macroCalculator';
import IngredientSearch from '@/components/plans/IngredientSearch';

const normalizeIngredient = (ingredient, foods = []) => {
  const food = foods.find((f) => String(f.id) === String(ingredient.food_id)) || ingredient.food;
  if (!food) return null;

  const grams = ingredient.grams ?? ingredient.quantity ?? '';

  return {
    local_id: String(ingredient.local_id || ingredient.id || crypto.randomUUID()),
    food_id: String(food.id),
    grams,
    quantity: grams,
    food_group_id: food.food_to_food_groups?.[0]?.food_group_id || ingredient.food_group_id || null,
    food,
  };
};

const FreeMealViewDialog = ({ open, onOpenChange, freeMeal, onUpdate }) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [mode, setMode] = useState('view');
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearchingIngredient, setIsSearchingIngredient] = useState(false);

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
        supabase.from('food_groups').select('*'),
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
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los datos necesarios.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!open) return;

    setCurrentFreeMeal(freeMeal);
    fetchInitialData();

    if (!freeMeal) return;

    setName(freeMeal.name || '');
    setInstructions(freeMeal.instructions || '');
    setDayMealId(String(freeMeal.day_meal_id || ''));
    setMode('view');
    setHasChanges(false);
    setIsSearchingIngredient(false);
  }, [open, freeMeal, fetchInitialData]);

  useEffect(() => {
    if (!open || !freeMeal || allFoods.length === 0) return;

    const normalized = (freeMeal.ingredients || [])
      .map((ing) => normalizeIngredient(ing, allFoods))
      .filter(Boolean);

    setIngredients(normalized);
  }, [open, freeMeal, allFoods]);

  const recipeForView = useMemo(() => {
    if (!currentFreeMeal) return null;

    return {
      name: name || `Receta Libre: ${currentFreeMeal.day_meal?.name || ''}`,
      instructions,
      difficulty: null,
      prep_time_min: null,
      ingredients,
    };
  }, [currentFreeMeal, name, instructions, ingredients]);

  const macros = useMemo(() => {
    if (!recipeForView || !Array.isArray(recipeForView.ingredients) || allFoods.length === 0) {
      return { proteins: 0, carbs: 0, fats: 0, calories: 0 };
    }
    return calculateMacros(recipeForView.ingredients, allFoods);
  }, [recipeForView, allFoods]);

  const handleUpdate = async () => {
    if (!currentFreeMeal) return;

    setIsSubmitting(true);
    try {
      await supabase.from('free_recipe_ingredients').delete().eq('free_recipe_id', currentFreeMeal.id);

      const newIngredients = ingredients.map((ing) => ({
        free_recipe_id: currentFreeMeal.id,
        food_id: parseInt(ing.food_id, 10),
        grams: parseFloat(ing.grams || ing.quantity || 0),
      }));

      const { error: insertError } = await supabase.from('free_recipe_ingredients').insert(newIngredients);
      if (insertError) throw insertError;

      const { error: updateError } = await supabase
        .from('free_recipes')
        .update({
          day_meal_id: dayMealId,
          name,
          instructions,
        })
        .eq('id', currentFreeMeal.id);

      if (updateError) throw updateError;

      const { data: updatedFreeMeal, error: refetchError } = await supabase
        .from('free_recipes')
        .select(
          '*, ingredients:free_recipe_ingredients(*, food(*, food_to_food_groups(food_group_id))), day_meal:day_meal_id!inner(id, name, display_order)'
        )
        .eq('id', currentFreeMeal.id)
        .single();

      if (refetchError) throw refetchError;

      setCurrentFreeMeal(updatedFreeMeal);
      if (onUpdate) onUpdate(updatedFreeMeal);

      toast({ title: 'Exito', description: 'Receta libre actualizada.' });
      setHasChanges(false);
      setMode('view');
    } catch (error) {
      toast({
        title: 'Error',
        description: `No se pudo actualizar: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleModeChange = async (checked) => {
    const newMode = checked ? 'view' : 'settings';
    if (mode === 'settings' && newMode === 'view' && hasChanges) {
      await handleUpdate();
      return;
    }
    setMode(newMode);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    onOpenChange(false);
  };

  const handleFormChange = (e) => {
    const { name: fieldName, value } = e.target;
    if (fieldName === 'name') setName(value);
    if (fieldName === 'instructions') setInstructions(value);
    setHasChanges(true);
  };

  const handleIngredientsChange = (newIngredients) => {
    setIngredients(newIngredients.map((ing) => normalizeIngredient(ing, allFoods)).filter(Boolean));
    setHasChanges(true);
  };

  const handleRemoveIngredient = (ingredientToRemove) => {
    const ingredientId = ingredientToRemove.local_id || ingredientToRemove.id;
    setIngredients((prev) =>
      prev.filter((ing) => String(ing.local_id || ing.id) !== String(ingredientId))
    );
    setHasChanges(true);
  };

  const handleIngredientAdded = (newIngredientData) => {
    const selectedFood = allFoods.find(
      (food) => String(food.id) === String(newIngredientData.food_id)
    );
    if (!selectedFood) return;

    const defaultQuantity = selectedFood.food_unit === 'unidades' ? 1 : 100;
    const quantity = newIngredientData.quantity || defaultQuantity;

    setIngredients((prev) => [
      ...prev,
      {
        local_id: crypto.randomUUID(),
        food_id: String(selectedFood.id),
        grams: quantity,
        quantity,
        food_group_id: selectedFood.food_to_food_groups?.[0]?.food_group_id || null,
        food: selectedFood,
      },
    ]);

    setHasChanges(true);
    setIsSearchingIngredient(false);
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
                key={`${mode}-${isSearchingIngredient ? 'search' : 'content'}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                {loading ? (
                  <div className="flex justify-center items-center h-full">
                    <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
                  </div>
                ) : isSearchingIngredient ? (
                  <IngredientSearch
                    selectedIngredients={ingredients}
                    onIngredientAdded={handleIngredientAdded}
                    availableFoods={allFoods}
                    userRestrictions={{
                      sensitivities: [],
                      medical_conditions: [],
                      individual_food_restrictions: [],
                      preferred_foods: [],
                      non_preferred_foods: [],
                    }}
                    onBack={() => setIsSearchingIngredient(false)}
                  />
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
                      showMetaFields={false}
                    />
                    <div className="mt-8 flex justify-center">
                      <Button
                        onClick={() => setIsEquivalenceDialogOpen(true)}
                        className="bg-blue-900/50 border border-blue-700 text-blue-300 hover:bg-blue-800/50 hover:border-blue-600"
                      >
                        <Scale className="mr-2 h-4 w-4" />
                        Equivalencia por Calorias
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-6">
                    <div>
                      <Label>Momento del Dia</Label>
                      <DayMealSelect
                        userId={user.id}
                        value={dayMealId}
                        onValueChange={(value) => {
                          setDayMealId(value);
                          setHasChanges(true);
                        }}
                        className="mt-1"
                      />
                    </div>

                    <RecipeView
                      recipe={recipeForView}
                      allFoods={allFoods}
                      allVitamins={allVitamins}
                      allMinerals={allMinerals}
                      allFoodGroups={allFoodGroups}
                      macros={macros}
                      isEditing={true}
                      onFormChange={handleFormChange}
                      onIngredientsChange={handleIngredientsChange}
                      onRemoveIngredient={handleRemoveIngredient}
                      onAddIngredientClick={() => setIsSearchingIngredient(true)}
                      disableAutoBalance={true}
                      showMetaFields={false}
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
            if (onUpdate) onUpdate();
          }}
        />
      )}
    </>
  );
};

export default FreeMealViewDialog;
