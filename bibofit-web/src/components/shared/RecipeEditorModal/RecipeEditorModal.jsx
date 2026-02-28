import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { useRecipeEditor } from './useRecipeEditor';
import RecipeView from '../RecipeView';
import { Button } from '@/components/ui/button';
import ViewModeToggle from '../AdminViewToggle';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import IngredientSearch from '@/components/plans/IngredientSearch';
import { supabase } from '@/lib/supabaseClient';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAutoFrameAccess } from '@/hooks/useAutoFrameAccess';
import { useToast } from '@/components/ui/use-toast';
import { Link } from 'react-router-dom';

const SimpleHeader = ({ title, className }) => (
  <div className={cn("flex items-center justify-between p-4 border-b border-gray-700", className || "bg-gray-800/50")}>
    <h3 className="text-lg font-semibold text-white">{title}</h3>
  </div>
);

const RecipeEditorModal = ({ 
    open, 
    onOpenChange, 
    recipeToEdit, 
    onSaveSuccess, 
    isAdminView, 
    userId, 
    planRestrictions, 
    initialConflicts = null, 
    adjustments = null, 
    readOnly = false,
    isEditable: propIsEditable,
    isTemplate = false,
    // Backward-compatible alias. Prefer `isTemplate` in callers.
    isTemplatePlan = false
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { canUseAutoFrame, message: autoFrameMessage, link: autoFrameLink } = useAutoFrameAccess();

  const [localLoading, setLocalLoading] = useState(true);
  const [enrichedRecipe, setEnrichedRecipe] = useState(null);
  const [allFoods, setAllFoods] = useState([]);
  const [allVitamins, setAllVitamins] = useState([]);
  const [allMinerals, setAllMinerals] = useState([]);
  const [allFoodGroups, setAllFoodGroups] = useState([]);

  useEffect(() => {
    if (open && recipeToEdit) {
      const fetchAndEnrich = async () => {
        setLocalLoading(true);
        try {
            const [
                foodsRes, 
                userFoodsRes,
                vitaminsRes,
                mineralsRes,
                foodGroupsRes,
            ] = await Promise.all([
                supabase.from('food').select('*, food_sensitivities(sensitivity:sensitivities(*)), food_medical_conditions(relation_type, condition:medical_conditions(*)), food_vitamins(mg_per_100g, vitamin:vitamins(*)), food_minerals(mg_per_100g, mineral:minerals(*)), food_to_food_groups(food_group:food_groups(*))'),
                userId ? supabase.from('user_created_foods').select('*, user_created_food_sensitivities(sensitivity:sensitivities(*))').eq('user_id', userId) : Promise.resolve({ data: [], error: null }),
                supabase.from('vitamins').select('*'),
                supabase.from('minerals').select('*'),
                supabase.from('food_groups').select('*'),
            ]);

            if (foodsRes.error || userFoodsRes.error || vitaminsRes.error || mineralsRes.error || foodGroupsRes.error) {
                throw new Error('Failed to fetch enrichment data.');
            }

            const combinedFoods = [
                ...(foodsRes.data || []).map(f => ({ ...f, is_user_created: false })),
                ...(userFoodsRes.data || []).map(f => ({ ...f, is_user_created: true, food_medical_conditions: [] }))
            ];

            setAllFoods(combinedFoods);
            setAllVitamins(vitaminsRes.data || []);
            setAllMinerals(mineralsRes.data || []);
            setAllFoodGroups(foodGroupsRes.data || []);
            
            let recipeSource = {};
            let ingredientsSource = [];
            const isPrivate = recipeToEdit.is_private || recipeToEdit.is_private_recipe || recipeToEdit.type === 'private_recipe';

            if (recipeToEdit.type === 'free_recipe') {
                recipeSource = recipeToEdit;
                ingredientsSource = recipeToEdit.free_recipe_ingredients || [];
            } else if (isPrivate) {
                recipeSource = recipeToEdit;
                ingredientsSource = recipeToEdit.private_recipe_ingredients || [];
            } else { // diet_plan_recipe
                recipeSource = recipeToEdit.is_customized ? recipeToEdit : (recipeToEdit.recipe || {});
                
                const hasCustomIngredients = recipeToEdit.custom_ingredients && recipeToEdit.custom_ingredients.length > 0;
                ingredientsSource = hasCustomIngredients ? recipeToEdit.custom_ingredients : (recipeToEdit.recipe?.recipe_ingredients || []);
            }

            const populatedIngredients = ingredientsSource.map(ing => {
                const foodId = ing.food_id;
                
                const foodDetails = combinedFoods.find(f => String(f.id) === String(foodId));
                
                if (!foodDetails) return null;

                let adjustedQuantity = ing.grams || ing.quantity;
                if (adjustments && Array.isArray(adjustments)) {
                     const adj = adjustments.find(a => String(a.food_id) === String(foodId));
                     if (adj) adjustedQuantity = adj.adjusted_grams;
                }

                return {
                    ...ing,
                    grams: adjustedQuantity,
                    quantity: adjustedQuantity,
                    food: foodDetails
                };
            }).filter(Boolean);

            setEnrichedRecipe({
              ...recipeToEdit,
              recipe: recipeSource,
              image_url:
                recipeToEdit.image_url ||
                recipeToEdit.img_url ||
                recipeSource?.image_url ||
                recipeSource?.img_url ||
                recipeToEdit.recipe?.image_url ||
                recipeToEdit.recipe?.img_url ||
                null,
              img_url:
                recipeToEdit.img_url ||
                recipeToEdit.image_url ||
                recipeSource?.img_url ||
                recipeSource?.image_url ||
                recipeToEdit.recipe?.img_url ||
                recipeToEdit.recipe?.image_url ||
                null,
              ingredients: populatedIngredients
            });

        } catch (error) {
            console.error("Error enriching recipe data in modal:", error);
        } finally {
            setLocalLoading(false);
        }
      };

      fetchAndEnrich();
    }
  }, [open, recipeToEdit, userId, adjustments]);
  
  const {
    mode, setMode,
    loading,
    formData,
    ingredients,
    macros,
    isSubmitting,
    handleFormChange,
    handleIngredientsChange,
    handleSubmit,
    hasChanges,
    hasIngredientChanges,
    conflicts,
    recommendations,
    isClientRequestView,
    userRestrictions,
    isEditable: hookIsEditable,
    handleAddIngredient,
    handleRemoveIngredient,
    hasInitialConflicts
  } = useRecipeEditor({ 
      recipeToEdit: enrichedRecipe, 
      onSaveSuccess, 
      isAdminView, 
      userId, 
      open, 
      planRestrictions, 
      initialConflicts,
      allFoods,
      isTemplate: isTemplate || isTemplatePlan
  });

  const isEditable = propIsEditable !== undefined ? propIsEditable : hookIsEditable;

  const [isSearching, setIsSearching] = useState(false);
  const [scrollToFoodId, setScrollToFoodId] = useState(null);
  const [quickEditIngredientKey, setQuickEditIngredientKey] = useState(null);
  const ingredientsContainerRef = useRef(null);

  useEffect(() => {
    if (scrollToFoodId && ingredientsContainerRef.current) {
      const ingredientCard = ingredientsContainerRef.current.querySelector(`[data-ingredient-food-id='${scrollToFoodId}']`);
      if (ingredientCard) {
        ingredientCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setScrollToFoodId(null); 
      }
    }
  }, [ingredients, scrollToFoodId, mode]);

  const handleModeChange = async (checked) => {
    if (readOnly) return;
    const newMode = checked ? 'view' : 'settings';
    if (mode === 'settings' && newMode === 'view' && hasChanges && !isClientRequestView) {
      const success = await handleSubmit('replace');
      if (!success) return; 
    }
    setMode(newMode);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    onOpenChange(false);
    setIsSearching(false);
  };
  
  const handleLocalAddIngredient = (newIngredientData) => {
    const addedIngredient = handleAddIngredient(newIngredientData);
    setIsSearching(false);
    setScrollToFoodId(newIngredientData.food_id);
    if (mode === 'view' && addedIngredient?.local_id) {
      setQuickEditIngredientKey(addedIngredient.local_id);
    }
  }

  const handleSaveClick = async () => {
    const success = await handleSubmit('save');
    if (success) {
      onOpenChange(false);
      setIsSearching(false);
    }
  };

  const recipeForView = useMemo(() => ({
    ...enrichedRecipe,
    ...formData,
    ingredients: ingredients,
  }), [formData, ingredients, enrichedRecipe]);

  const isEditingMode = mode === 'settings' && isEditable && !readOnly;
  const totalLoading = loading || localLoading;

  const isFreeRecipe = enrichedRecipe?.type === 'free_recipe';
  const headerBgClass = isFreeRecipe ? "bg-sky-900/30" : "bg-green-900/20";
  const toggleSwitchColor = isFreeRecipe ? "data-[state=checked]:bg-sky-400" : "data-[state=checked]:bg-green-400";
  const activeIconColor = isFreeRecipe ? "text-sky-400" : "text-green-400";
  
  const criticalConflicts = conflicts?.filter(c => ['condition_avoid', 'sensitivity', 'non-preferred', 'individual_restriction'].includes(c.type)) || [];
  const hasCriticalConflicts = criticalConflicts.length > 0;
  
  const effectiveIsTemplate = isTemplate || isTemplatePlan;

  const saveButtonText = useMemo(() => {
      // If actively blocked by conflicts:
      if (hasCriticalConflicts) return "Resolver conflictos";
      
      if (!hasChanges) return "Sin cambios";

      if (effectiveIsTemplate) return "Guardar cambios";
      return "Crear variante";
  }, [hasCriticalConflicts, hasChanges, effectiveIsTemplate]);

  // Button is disabled if:
  // 1. Submitting
  // 2. No changes (unless we want to allow saving 'no changes' but requirements say "enable only if actual changes")
  // 3. Has active critical conflicts
  const isButtonDisabled = isSubmitting || !hasChanges || hasCriticalConflicts;

  const handleBlockedFeature = () => {
      toast({
          title: "Funcionalidad Premium",
          description: (
              <div className="flex flex-col gap-2">
                  <span>{autoFrameMessage}</span>
                  <Link to={autoFrameLink} className="text-green-400 underline font-bold" onClick={() => onOpenChange(false)}>
                      Ver Planes
                  </Link>
              </div>
          ),
          variant: "destructive"
      });
  };

  // Determine if we should disable auto-balance in RecipeView
  // Disabled if no changes, no premium, OR if it's a template (templates don't have personal targets usually)
  const shouldDisableAutoBalance = !hasIngredientChanges || !canUseAutoFrame || effectiveIsTemplate;

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="bg-[#0C101D] border-gray-700 text-white w-[95vw] max-w-4xl p-0 flex flex-col h-[90vh]">
          {totalLoading ? (
            <div className="flex justify-center items-center h-full min-h-[400px]">
              <Loader2 className="h-12 w-12 animate-spin text-green-500" />
            </div>
          ) : (
            <>
              {(!isSearching) && (
                (isEditable && !readOnly) ? (
                  <ViewModeToggle
                    mode={mode}
                    onModeChange={handleModeChange}
                    loading={isSubmitting}
                    className={cn("flex-shrink-0", headerBgClass)}
                    hasChanges={hasChanges}
                    isClientRequestView={isClientRequestView}
                    switchCheckedColor={toggleSwitchColor}
                    activeIconColor={activeIconColor}
                  />
                ) : (
                  <SimpleHeader title={formData.name} className={headerBgClass} />
                )
              )}
              
              <div ref={ingredientsContainerRef} className="flex-1 overflow-y-auto styled-scrollbar-green">
                {isSearching ? (
                  <div className="p-4 h-full">
                    <IngredientSearch 
                      selectedIngredients={ingredients}
                      onIngredientAdded={handleLocalAddIngredient}
                      availableFoods={allFoods}
                      userRestrictions={userRestrictions}
                      onBack={() => setIsSearching(false)}
                    />
                  </div>
                ) : (
                  <RecipeView
                    recipe={recipeForView}
                    allFoods={allFoods}
                    allVitamins={allVitamins}
                    allMinerals={allMinerals}
                    allFoodGroups={allFoodGroups}
                    macros={macros}
                    conflicts={conflicts}
                    recommendations={recommendations}
                    userRestrictions={userRestrictions}
                    isEditing={isEditingMode}
                    onFormChange={handleFormChange}
                    onIngredientsChange={isEditable && !readOnly ? handleIngredientsChange : undefined}
                    onRemoveIngredient={isEditable && !readOnly ? handleRemoveIngredient : undefined}
                    onAddIngredientClick={isEditable && !readOnly ? () => setIsSearching(true) : undefined}
                    disableAutoBalance={shouldDisableAutoBalance}
                    onAutoBalanceBlocked={!canUseAutoFrame ? handleBlockedFeature : undefined}
                    enableStickyMacros={true}
                    isTemplate={effectiveIsTemplate}
                    quickEditIngredientKey={quickEditIngredientKey}
                    onQuickEditConsumed={() => setQuickEditIngredientKey(null)}
                  />
                )}
                  
                  {!isSearching && isEditable && !readOnly && (
                    <div className="flex justify-center pt-4 px-2 gap-4 pb-4">
                      <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span tabIndex={0}>
                                  <Button 
                                    type="button" 
                                    onClick={handleSaveClick} 
                                    disabled={isButtonDisabled} 
                                    className={cn(
                                      "bg-gradient-to-r from-[#550d4f] to-[#2f0596] hover:from-[#6b1062] hover:to-[#3b06bb] text-white font-bold transition-all duration-300",
                                      "disabled:opacity-80 disabled:cursor-not-allowed disabled:from-[#533750] disabled:to-[#443a5d]",
                                      // Special styling for conflict resolution success state
                                      (hasChanges && !hasCriticalConflicts && (hasInitialConflicts || hasIngredientChanges)) && "from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 border border-green-400/50 shadow-[0_0_15px_rgba(34,197,94,0.3)]"
                                    )}
                                  >
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {saveButtonText}
                                  </Button>
                                </span>
                            </TooltipTrigger>
                            {(isButtonDisabled) && (
                                <TooltipContent className="bg-slate-900 border-slate-700 text-white">
                                     {hasCriticalConflicts 
                                        ? <p className="text-red-400">Debes resolver todos los conflictos antes de guardar.</p>
                                        : <p>Realiza cambios en la receta para habilitar el guardado.</p>
                                     }
                                </TooltipContent>
                            )}
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default RecipeEditorModal;
