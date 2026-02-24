import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog';
import ViewModeToggle from '@/components/shared/AdminViewToggle';
import { useAuth } from '@/contexts/AuthContext';
import RecipeView from '@/components/shared/RecipeView';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Scale, Utensils, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import DayMealSelect from '@/components/ui/day-meal-select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { motion, AnimatePresence } from 'framer-motion';
import EquivalenceDialog from './EquivalenceDialog';
import { calculateMacros } from '@/lib/macroCalculator';
import IngredientSearch from '@/components/plans/IngredientSearch';
import { getConflictInfo } from '@/lib/restrictionChecker.js';

const FreeRecipeViewDialog = ({ open, onOpenChange, freeMeal, onUpdate, onEquivalenceSuccess, onSelect, isActionLoading }) => {
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
  const [prepTime, setPrepTime] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [isEquivalenceDialogOpen, setIsEquivalenceDialogOpen] = useState(false);
  const [currentFreeMeal, setCurrentFreeMeal] = useState(freeMeal);
  const [isSearching, setIsSearching] = useState(false);
  const [userRestrictions, setUserRestrictions] = useState({});

  const isTemplate = freeMeal?.type === 'template';

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [
          foodsRes, 
          vitaminsRes, 
          mineralsRes, 
          groupsRes,
          userFoodsRes,
          sensitivitiesRes,
          conditionsRes,
          individualRes,
          preferredRes,
          nonPreferredRes
      ] = await Promise.all([
          supabase.from('food').select('*, food_to_food_groups(food_group_id), food_vitamins(vitamin_id), food_minerals(mineral_id), food_sensitivities(sensitivity:sensitivities(*)), food_medical_conditions(relation_type, condition:medical_conditions(*))'),
          supabase.from('vitamins').select('*'),
          supabase.from('minerals').select('*'),
          supabase.from('food_groups').select('*'),
          supabase.from('user_created_foods').select('*, user_created_food_to_food_groups(food_group_id)').eq('user_id', user.id),
          supabase.from('user_sensitivities').select('sensitivities(id, name)').eq('user_id', user.id),
          supabase.from('user_medical_conditions').select('medical_conditions(id, name)').eq('user_id', user.id),
          supabase.from('user_individual_food_restrictions').select('food(id, name)').eq('user_id', user.id),
          supabase.from('preferred_foods').select('food(id, name)').eq('user_id', user.id),
          supabase.from('non_preferred_foods').select('food(id, name)').eq('user_id', user.id),
      ]);

      if (foodsRes.error) throw foodsRes.error;
      if (vitaminsRes.error) throw vitaminsRes.error;
      if (mineralsRes.error) throw mineralsRes.error;
      if (groupsRes.error) throw groupsRes.error;
      if (userFoodsRes.error) throw userFoodsRes.error;

      const globalFoods = (foodsRes.data || []).map(f => ({ ...f, is_user_created: false }));
      const userFoods = (userFoodsRes.data || []).map(f => ({ 
          ...f, 
          is_user_created: true,
          food_to_food_groups: f.user_created_food_to_food_groups // Map for consistency
      }));

      setAllFoods([...globalFoods, ...userFoods]);
      setAllVitamins(vitaminsRes.data || []);
      setAllMinerals(mineralsRes.data || []);
      setAllFoodGroups(groupsRes.data || []);

      setUserRestrictions({
          sensitivities: (sensitivitiesRes.data || []).map(s => s.sensitivities).filter(Boolean),
          medical_conditions: (conditionsRes.data || []).map(c => c.medical_conditions).filter(Boolean),
          individual_food_restrictions: (individualRes.data || []).map(i => i.food).filter(Boolean),
          preferred_foods: (preferredRes.data || []).map(p => p.food).filter(Boolean),
          non_preferred_foods: (nonPreferredRes.data || []).map(np => np.food).filter(Boolean),
      });

    } catch (error)      {
        console.error("Error fetching data:", error);
        toast({ title: 'Error', description: 'No se pudieron cargar los datos necesarios.', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    }, [toast, user.id]);

    useEffect(() => {
      if (open) {
        setCurrentFreeMeal(freeMeal);
        fetchInitialData();
        if (freeMeal) {
          setDayMealId(String(freeMeal.day_meal_id || ''));
          setName(freeMeal.name || '');
          setInstructions(freeMeal.instructions || '');
          setPrepTime(freeMeal.prep_time_min || '');
          setDifficulty(freeMeal.difficulty || 'Fácil');
          setMode('view');
          setHasChanges(false);
        }
      }
    }, [open, freeMeal, fetchInitialData]);
    
    useEffect(() => {
      if (open && freeMeal) {
          setIngredients((freeMeal.ingredients || []).map(ing => {
              const isUserCreated = !!ing.user_created_food_id;
              const foodId = isUserCreated ? ing.user_created_food_id : ing.food_id;
              const foodGroupId = ing.food?.food_to_food_groups?.[0]?.food_group_id || null;
              
              return {
                  local_id: ing.id || `temp-${ing.food_id}`,
                  food_id: String(foodId),
                  quantity: ing.grams ?? ing.quantity,
                  food_group_id: foodGroupId ? String(foodGroupId) : '',
                  is_user_created: isUserCreated
              };
          }));
      }
    }, [open, freeMeal]);

    const recipeForView = useMemo(() => {
      if (!currentFreeMeal) return null;
      
      const ingredientsForView = (currentFreeMeal.ingredients || []).map(ing => {
        const isUserCreated = !!ing.user_created_food_id;
        const foodId = isUserCreated ? ing.user_created_food_id : ing.food_id;
        // Use food from allFoods if available (to get full data like groups), otherwise fallback to ing.food
        const food = allFoods.find(f => String(f.id) === String(foodId) && f.is_user_created === isUserCreated) || ing.food;
        return { ...ing, food };
      });

      return {
        id: currentFreeMeal.id,
        user_id: currentFreeMeal.user_id,
        day_meal_id: currentFreeMeal.day_meal_id,
        meal_date: currentFreeMeal.meal_date,
        name: currentFreeMeal.name || `Receta Libre: ${currentFreeMeal.day_meal?.name || ''}`,
        difficulty: currentFreeMeal.difficulty,
        prep_time_min: currentFreeMeal.prep_time_min,
        instructions: currentFreeMeal.instructions,
        ingredients: ingredientsForView.map(ing => ({
          id: ing.id,
          food_id: ing.food_id,
          grams: ing.grams || ing.quantity,
          food: ing.food,
          food_group_id: ing.food?.food_to_food_groups?.[0]?.food_group_id || null
        })),
      };
    }, [currentFreeMeal, allFoods]);

    const macros = useMemo(() => {
      if (!recipeForView || !recipeForView.ingredients || !allFoods.length) return { proteins: 0, carbs: 0, fats: 0, calories: 0 };
      return calculateMacros(recipeForView.ingredients, allFoods);
    }, [recipeForView, allFoods]);

    const recipeForEdit = useMemo(() => {
        const ingredientsForView = ingredients.map(ing => {
          const food = allFoods.find(f => String(f.id) === String(ing.food_id) && f.is_user_created === ing.is_user_created);
          // Ensure we get the group ID from the found food if it's missing in the ingredient state
          const groupId = ing.food_group_id || food?.food_to_food_groups?.[0]?.food_group_id || '';
          
          return {
            ...ing,
            id: ing.local_id,
            food_id: String(ing.food_id),
            grams: ing.quantity,
            quantity: ing.quantity,
            food: food,
            food_group_id: groupId
          };
        });
    
        return {
          id: currentFreeMeal?.id,
          name: name,
          difficulty: difficulty,
          prep_time_min: prepTime,
          instructions: instructions,
          ingredients: ingredientsForView
        };
      }, [name, difficulty, prepTime, instructions, ingredients, allFoods, currentFreeMeal]);

    const editMacros = useMemo(() => {
        if (!recipeForEdit || !recipeForEdit.ingredients || !allFoods.length) return { proteins: 0, carbs: 0, fats: 0, calories: 0 };
        return calculateMacros(recipeForEdit.ingredients, allFoods);
    }, [recipeForEdit, allFoods]);

    const isApproved = useMemo(() => {
        return currentFreeMeal?.status === 'approved_private' || currentFreeMeal?.status === 'approved_general';
    }, [currentFreeMeal]);

    // Calculate conflicts and recommendations for the current recipe view
    const { conflicts, recommendations } = useMemo(() => {
      const currentRecipe = mode === 'view' ? recipeForView : recipeForEdit;
      if (!currentRecipe || !currentRecipe.ingredients) return { conflicts: [], recommendations: [] };
  
      const cList = [];
      const rList = [];
  
      currentRecipe.ingredients.forEach(ing => {
          const food = ing.food;
          if (!food) return;
  
          const info = getConflictInfo(food, userRestrictions);
          if (info) {
               if (['condition_avoid', 'sensitivity', 'individual_restriction', 'non-preferred'].includes(info.type) || info.type === 'condition_avoid') {
                   let type = info.type;
                   if (info.type === 'individual_restriction') type = 'condition_avoid';
                   if (info.type === 'non-preferred') type = 'sensitivity'; 
                   
                   cList.push({
                       foodId: food.id,
                       type: type,
                       restrictionName: info.reason
                   });
               } else if (['condition_recommend', 'preferred'].includes(info.type)) {
                   rList.push({
                       foodId: food.id,
                       restrictionName: info.reason
                   });
               }
          }
      });
      return { conflicts: cList, recommendations: rList };
    }, [mode, recipeForView, recipeForEdit, userRestrictions]);

    const handleUpdate = async () => {
      if (!currentFreeMeal) return;
      
      if (isTemplate) {
        // Just update local state for adding to plan as a customized template
        const updatedIngredients = ingredients.map(ing => {
            const food = allFoods.find(f => String(f.id) === String(ing.food_id) && f.is_user_created === ing.is_user_created);
            return {
                ...ing,
                id: ing.local_id || ing.id,
                food: food,
                grams: parseFloat(ing.quantity),
                quantity: parseFloat(ing.quantity)
            };
        });

        const updatedTemplate = {
            ...currentFreeMeal,
            name: name,
            instructions: instructions,
            prep_time_min: prepTime,
            difficulty: difficulty,
            ingredients: updatedIngredients
        };

        setCurrentFreeMeal(updatedTemplate);
        setMode('view');
        setHasChanges(false);
        toast({ title: "Vista previa actualizada", description: "Los cambios se aplicarán al añadir la receta." });
        return;
      }

      setIsSubmitting(true);
      try {
        if (isApproved) {
            // Create new version (Save as new recipe)
            
            // Check if name is unchanged, if so, prepend "* "
            let finalName = name;
            if (name.trim() === currentFreeMeal.name.trim()) {
                finalName = `* ${name}`;
            }

            const { data: newRecipe, error: createError } = await supabase
                .from('free_recipes')
                .insert({
                    user_id: user.id,
                    day_meal_id: dayMealId ? parseInt(dayMealId) : null,
                    name: finalName,
                    instructions: instructions,
                    prep_time_min: prepTime,
                    difficulty: difficulty,
                    status: 'pending',
                    diet_plan_id: currentFreeMeal.diet_plan_id,
                    parent_free_recipe_id: currentFreeMeal.id
                })
                .select()
                .single();

            if (createError) throw createError;

            const newIngredients = ingredients.map(ing => ({
                free_recipe_id: newRecipe.id,
                food_id: !ing.is_user_created ? parseInt(ing.food_id) : null,
                user_created_food_id: ing.is_user_created ? parseInt(ing.food_id) : null,
                grams: parseFloat(ing.quantity),
                status: 'approved'
            }));

            const { error: insertError } = await supabase.from('free_recipe_ingredients').insert(newIngredients);
            if (insertError) throw insertError;

             // Fetch full details for the new recipe to update state
            const { data: fullNewRecipe, error: refetchError } = await supabase
                .from('free_recipes')
                .select(`
                    *,
                    day_meal:day_meal_id(name),
                    ingredients:free_recipe_ingredients(
                    *, 
                    food:food_id(
                        *, 
                        food_to_food_groups(food_group_id)
                    ),
                    user_created_food:user_created_food_id(*)
                    )
                `)
                .eq('id', newRecipe.id)
                .single();
            
            if (refetchError) throw refetchError;

            toast({ title: 'Nueva versión creada', description: 'Se ha creado una solicitud de nueva versión pendiente de aprobación.' });
            
            setCurrentFreeMeal(fullNewRecipe);
            if (onUpdate) onUpdate(fullNewRecipe);
            
            setHasChanges(false);
            setMode('view');

        } else {
            // Update existing (Pending or Rejected)
            await supabase.from('free_recipe_ingredients').delete().eq('free_recipe_id', currentFreeMeal.id);
            
            const newIngredients = ingredients.map(ing => ({
              free_recipe_id: currentFreeMeal.id,
              food_id: !ing.is_user_created ? parseInt(ing.food_id) : null,
              user_created_food_id: ing.is_user_created ? parseInt(ing.food_id) : null,
              grams: parseFloat(ing.quantity),
              status: 'approved'
            }));
            
            const { error: insertError } = await supabase.from('free_recipe_ingredients').insert(newIngredients);
            if (insertError) throw insertError;
    
            const { error: updateError } = await supabase.from('free_recipes').update({ 
              day_meal_id: dayMealId,
              name: name,
              instructions: instructions,
              prep_time_min: prepTime,
              difficulty: difficulty
            }).eq('id', currentFreeMeal.id);
            if (updateError) throw updateError;
            
            const { data: updatedFreeMeal, error: refetchError } = await supabase
              .from('free_recipes')
              .select(`
                *,
                day_meal:day_meal_id(name),
                ingredients:free_recipe_ingredients(
                  *, 
                  food:food_id(
                    *, 
                    food_to_food_groups(food_group_id)
                  ),
                  user_created_food:user_created_food_id(*)
                )
              `)
              .eq('id', currentFreeMeal.id)
              .single();
            
            if(refetchError) throw refetchError;
    
            setCurrentFreeMeal(updatedFreeMeal);
            if (onUpdate) onUpdate(updatedFreeMeal);
            
            toast({ title: 'Éxito', description: 'Receta libre actualizada.' });
            setHasChanges(false);
            setMode('view');
        }
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
      if (isSubmitting || isActionLoading) return;
      onOpenChange(false);
      setIsSearching(false);
    };
    
    const handleEquivalenceApplied = (newAdjustment) => {
      if (onEquivalenceSuccess) {
        onEquivalenceSuccess(newAdjustment);
      }
      setIsEquivalenceDialogOpen(false);
      onOpenChange(false);
    };

    const canShowEquivalence = useMemo(() => {
      return !isTemplate && currentFreeMeal?.meal_date && (currentFreeMeal?.status === 'approved_private' || currentFreeMeal?.status === 'approved_general');
    }, [currentFreeMeal, isTemplate]);

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        if (name === 'name') setName(value);
        if (name === 'instructions') setInstructions(value);
        if (name === 'prep_time_min') setPrepTime(value);
        if (name === 'difficulty') setDifficulty(value);
        setHasChanges(true);
    };

    const handleIngredientsUpdate = (newIngredients) => {
        const updatedState = newIngredients.map(ing => ({
            local_id: ing.local_id || ing.id,
            food_id: String(ing.food_id),
            quantity: ing.grams || ing.quantity,
            food_group_id: ing.food_group_id,
            is_user_created: ing.is_user_created
        }));
        setIngredients(updatedState);
        setHasChanges(true);
    };

    const handleRemoveIngredient = (ingredientToRemove) => {
        const updatedIngredients = ingredients.filter(ing => 
            (ing.local_id || ing.id) !== (ingredientToRemove.local_id || ingredientToRemove.id)
        );
        setIngredients(updatedIngredients);
        setHasChanges(true);
    };

    const handleAddIngredient = (ingredientData) => {
        const food = allFoods.find(f => String(f.id) === String(ingredientData.food_id) && f.is_user_created === ingredientData.is_user_created);
        
        const newIngredient = {
            local_id: `new-${Date.now()}`,
            food_id: String(ingredientData.food_id),
            quantity: ingredientData.quantity || 100,
            food_group_id: food?.food_to_food_groups?.[0]?.food_group_id || '',
            is_user_created: ingredientData.is_user_created,
            food: food
        };
        setIngredients([...ingredients, newIngredient]);
        setHasChanges(true);
        setIsSearching(false);
    };

    const renderAddButton = () => {
        if (!onSelect) return null;
        return (
          <Button 
              onClick={() => onSelect({ ...currentFreeMeal, macros })} 
              disabled={isActionLoading}
              className="w-full bg-gradient-to-r from-sky-700 to-sky-500 hover:from-sky-800 hover:to-sky-600 text-white text-lg h-12 shadow-lg shadow-sky-900/20"
          >
              {isActionLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Utensils className="mr-2 h-5 w-5" />}
              {isTemplate ? "Añadir al plan" : "Añadir esta receta al Plan"}
          </Button>
        );
    };

    if (!currentFreeMeal) return null;

    return (
      <>
        <Dialog open={open} onOpenChange={handleClose}>
          <DialogContent className="bg-[#0C101D] border-gray-700 text-white w-[95vw] max-w-4xl h-[90vh] flex flex-col p-0">
            {!isSearching && (
              <div className="flex justify-between items-center bg-sky-900/30">
                  {mode === 'view' && canShowEquivalence && (
                    <Button variant="ghost" size="icon" onClick={() => setIsEquivalenceDialogOpen(true)} className="text-blue-400 hover:bg-blue-500/10 hover:text-blue-300 border border-[#70a3f3] h-8 w-8 ml-4" style={{borderWidth: 'thin'}}>
                        <Scale className="h-5 w-5" />
                    </Button>
                  )}
                  <div className={mode === 'view' && canShowEquivalence ? "flex-grow" : "w-full"}>
                        <ViewModeToggle
                            mode={mode}
                            onModeChange={handleModeChange}
                            loading={isSubmitting}
                            className="flex-shrink-0"
                            hasChanges={hasChanges}
                            switchCheckedColor="data-[state=checked]:bg-sky-400"
                            activeIconColor="text-sky-400"
                        />
                  </div>
                  <DialogClose />
              </div>
            )}

            <div className="flex-1 overflow-y-auto styled-scrollbar-green">
              {isSearching ? (
                <div className="p-4 h-full">
                    <IngredientSearch 
                        selectedIngredients={ingredients}
                        onIngredientAdded={handleAddIngredient}
                        availableFoods={allFoods}
                        userRestrictions={userRestrictions}
                        onBack={() => setIsSearching(false)}
                    />
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={mode}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className="text-white space-y-6"
                  >
                    {loading ? (
                      <div className="flex justify-center items-center h-full"><Loader2 className="h-12 w-12 animate-spin text-blue-500" /></div>
                    ) : mode === 'view' ? (
                      <div className="flex flex-col h-full">
                        <RecipeView
                          recipe={recipeForView}
                          allFoods={allFoods}
                          allVitamins={allVitamins}
                          allMinerals={allMinerals}
                          allFoodGroups={allFoodGroups}
                          macros={macros}
                          isFreeMealView={true}
                          conflicts={conflicts}
                          recommendations={recommendations}
                          // Action button removed from here, only kept at bottom
                        />
                        {onSelect && (
                            <div className="p-6 pt-4 border-t border-gray-800 mt-auto bg-[#0C101D]">
                                {renderAddButton()}
                            </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-6 p-0">
                        <div className="pt-4 px-4">
                          <Label>Momento del Día</Label>
                          <DayMealSelect userId={user.id} value={dayMealId} onValueChange={(v) => { setDayMealId(v); setHasChanges(true); }} className="mt-1" />
                        </div>
                        
                        <RecipeView
                          recipe={recipeForEdit}
                          isEditing={true}
                          onFormChange={handleFormChange}
                          onIngredientsChange={handleIngredientsUpdate}
                          onRemoveIngredient={handleRemoveIngredient}
                          onAddIngredientClick={() => setIsSearching(true)}
                          allFoods={allFoods}
                          allVitamins={allVitamins}
                          allMinerals={allMinerals}
                          allFoodGroups={allFoodGroups}
                          macros={editMacros}
                          isFreeMealView={true}
                          conflicts={conflicts}
                          recommendations={recommendations}
                        />

                        {isApproved && !isTemplate && (
                            <div className="px-4 pb-4">
                                <Button 
                                    onClick={handleUpdate} 
                                    disabled={isSubmitting || !hasChanges}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                                >
                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Guardar como nueva receta
                                </Button>
                                <p className="text-xs text-gray-400 text-center mt-2">
                                    Se creará una nueva versión pendiente de aprobación. La receta original no se modificará.
                                </p>
                            </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {recipeForView && canShowEquivalence && (
          <EquivalenceDialog
            open={isEquivalenceDialogOpen}
            onOpenChange={setIsEquivalenceDialogOpen}
            sourceItem={recipeForView}
            sourceItemType="free_recipe"
            sourceItemMacros={macros}
            onSuccess={handleEquivalenceApplied}
          />
        )}
      </>
    );
  };

  export default FreeRecipeViewDialog;