import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Save, GitBranch, PenSquare, X } from 'lucide-react';
import { useAdminRecipeEditor } from './hooks/useAdminRecipeEditor';
import RecipeView from '@/components/shared/RecipeView';
import IngredientSearch from '@/components/plans/IngredientSearch';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import _ from 'lodash';
import { updateDietPlanRecipeCustomization } from '@/components/shared/RecipeEditorModal/recipeService';
import { saveDietPlanRecipeIngredients } from '@/lib/macroCalculator';

const AdminRecipeModal = ({ 
    open,
    onOpenChange,
    recipeToEdit,
    onSaveSuccess,
    userId,
    planRestrictions: initialPlanRestrictions,
    mealTargetMacros,
    isTemplatePlan = false,
    isAdding = false,
    forcedRestrictions = null,
    isAssignedPlan = false, 
    isTemporaryEdit = false,
    isReadOnly = false // NEW PROP
}) =>
{
    const { toast } = useToast();
    const { user } = useAuth();
    const [allVitamins, setAllVitamins] = useState([]);
    const [allMinerals, setAllMinerals] = useState([]);
    const [allFoods, setAllFoods] = useState([]);
    const [allFoodGroups, setAllFoodGroups] = useState([]);
    const [loadingInitialData, setLoadingInitialData] = useState(true);
    
    const [currentView, setCurrentView] = useState('editor');
    const [fullUserRestrictions, setFullUserRestrictions] = useState({});

    // Ingredient collapsible state
    const [expandedIngredients, setExpandedIngredients] = useState(new Set());
    const [visibleMacros, setVisibleMacros] = useState(new Set());
    const [focusedInput, setFocusedInput] = useState(null);
    const [allExpanded, setAllExpanded] = useState(false);

    const [initialState, setInitialState] = useState(null);
    const originalRecipeRef = useRef(null);

    // Force reset of editor state when recipeToEdit changes
    const [editorKey, setEditorKey] = useState(0);
    useEffect(() => {
        if (open && recipeToEdit) {
            setEditorKey(prev => prev + 1);
            setInitialState(null);
            originalRecipeRef.current = null;
        }
    }, [open, recipeToEdit?.id]);

    const {
        recipeData,
        setRecipeData,
        ingredients,
        setIngredients,
        macros,
        loading: loadingRecipe,
        isSaving: hookIsSaving,
        handleSave: hookHandleSave,
        conflicts
    } = useAdminRecipeEditor({ 
        recipeToEdit, 
        onSaveSuccess, 
        userId, 
        planRestrictions: forcedRestrictions || initialPlanRestrictions, 
        allFoodsData: allFoods,
        key: editorKey 
    });
    
    const [localIsSaving, setLocalIsSaving] = useState(false);

    const resetToOriginalState = useCallback(() => {
        const original = originalRecipeRef.current;
        if (!original) return;
        setRecipeData(_.cloneDeep(original.recipeData));
        setIngredients(_.cloneDeep(original.ingredients));
        setInitialState(_.cloneDeep(original));
        
        // Reset collapsible states
        setExpandedIngredients(new Set());
        setVisibleMacros(new Set());
        setFocusedInput(null);
        setAllExpanded(false);
    }, [setRecipeData, setIngredients]);

    // Reset state when modal closes or recipe changes
    useEffect(() => {
        if (!open) {
            resetToOriginalState();
            setInitialState(null);
            originalRecipeRef.current = null;
            setCurrentView('editor');
        }
    }, [open, resetToOriginalState]);
    
    // Initial Data Fetching
    useEffect(() => {
        const fetchInitialData = async () => {
            if (!open) return;
            // Don't set loading if we already have data
            if (allFoods.length > 0) return;
            
            setLoadingInitialData(true);
            try {
                const [
                    vitaminsRes, 
                    mineralsRes, 
                    foodsRes, 
                    foodGroupsRes,
                    conditionsRes, 
                    sensitivitiesRes,
                    preferredRes, 
                    nonPreferredRes,
                    userSensitivitiesRes,
                    userIndividualRes,
                    userConditionsRes
                ] = await Promise.all([
                    supabase.from('vitamins').select('id, name'),
                    supabase.from('minerals').select('id, name'),
                    supabase.from('food').select('*, food_sensitivities(*, sensitivities(id, name)), food_medical_conditions(*, medical_conditions(id, name)), food_vitamins(*), food_minerals(*), food_to_food_groups(food_group_id, food_group:food_groups(id, name))'),
                    supabase.from('food_groups').select('id, name'),
                    supabase.from('medical_conditions').select('id, name'),
                    supabase.from('sensitivities').select('id, name'),
                    (userId && !isTemplatePlan && !forcedRestrictions) ? supabase.from('preferred_foods').select('food(id, name)').eq('user_id', userId) : Promise.resolve({ data: [], error: null }),
                    (userId && !isTemplatePlan && !forcedRestrictions) ? supabase.from('non_preferred_foods').select('food(id, name)').eq('user_id', userId) : Promise.resolve({ data: [], error: null }),
                    (userId && !isTemplatePlan && !forcedRestrictions) ? supabase.from('user_sensitivities').select('sensitivity:sensitivities(id, name)').eq('user_id', userId) : Promise.resolve({ data: [], error: null }),
                    (userId && !isTemplatePlan && !forcedRestrictions) ? supabase.from('user_individual_food_restrictions').select('food(id, name)').eq('user_id', userId) : Promise.resolve({ data: [], error: null }),
                    (userId && !isTemplatePlan && !forcedRestrictions) ? supabase.from('user_medical_conditions').select('condition:medical_conditions(id, name)').eq('user_id', userId) : Promise.resolve({ data: [], error: null }),
                ]);

                if (foodsRes.error) throw foodsRes.error;
                
                setAllVitamins(vitaminsRes.data || []);
                setAllMinerals(mineralsRes.data || []);
                setAllFoods(foodsRes.data || []);
                setAllFoodGroups(foodGroupsRes.data || []);

                let restrictions = {};
                if (forcedRestrictions) {
                    restrictions = {
                        sensitivities: forcedRestrictions.sensitivities || [],
                        medical_conditions: forcedRestrictions.medical_conditions || [],
                        individual_food_restrictions: forcedRestrictions.individual_food_restrictions || [],
                        preferred_foods: forcedRestrictions.preferred_foods || [],
                        non_preferred_foods: forcedRestrictions.non_preferred_foods || []
                    };
                } else if (isTemplatePlan && initialPlanRestrictions) {
                    const sensitivityObjects = (sensitivitiesRes.data || []).filter(s => initialPlanRestrictions.sensitivities?.includes(s.id));
                    const conditionObjects = (conditionsRes.data || []).filter(c => initialPlanRestrictions.conditions?.includes(c.id));
                    restrictions = {
                        sensitivities: sensitivityObjects,
                        medical_conditions: conditionObjects,
                        individual_food_restrictions: [],
                        preferred_foods: [],
                        non_preferred_foods: []
                    };
                } else if (userId) {
                    restrictions = {
                        preferred_foods: preferredRes.data?.map(i => i.food).filter(Boolean) || [],
                        non_preferred_foods: nonPreferredRes.data?.map(i => i.food).filter(Boolean) || [],
                        sensitivities: userSensitivitiesRes.data?.map(i => i.sensitivity).filter(Boolean) || [],
                        individual_food_restrictions: userIndividualRes.data?.map(i => i.food).filter(Boolean) || [],
                        medical_conditions: userConditionsRes.data?.map(i => i.condition).filter(Boolean) || [],
                    };
                }
                setFullUserRestrictions(restrictions);

            } catch (error) {
                console.error("Error loading initial data:", error);
                toast({ title: 'Error', description: `No se pudieron cargar datos esenciales: ${error.message}`, variant: 'destructive' });
            } finally {
                setLoadingInitialData(false);
            }
        };

        fetchInitialData();
    }, [open, toast, userId, isTemplatePlan, initialPlanRestrictions, forcedRestrictions, allFoods.length]);

    // Capture initial state ONCE when data is ready
    useEffect(() => {
        if (!loadingRecipe && recipeData && !initialState) {
            const snapshot = {
                recipeData: _.cloneDeep(recipeData),
                ingredients: _.cloneDeep(ingredients)
            };
            setInitialState(snapshot);
            originalRecipeRef.current = snapshot;

        }
    }, [loadingRecipe, recipeData, ingredients, initialState]);

    const hasChanges = useMemo(() => {
        if (!initialState || !recipeData) return false;

        const dataChanged = 
            (recipeData.name || '') !== (initialState.recipeData.name || '') ||
            (recipeData.instructions || '') !== (initialState.recipeData.instructions || '') ||
            String(recipeData.prep_time_min || '') !== String(initialState.recipeData.prep_time_min || '') ||
            (recipeData.difficulty || '') !== (initialState.recipeData.difficulty || '');

        if (dataChanged) return true;

        if (ingredients.length !== initialState.ingredients.length) return true;

        const normalizeIng = (ing) => ({
            id: String(ing.food_id),
            grams: Number(ing.grams || ing.quantity || 0)
        });

        const currentIngs = ingredients.map(normalizeIng).sort((a, b) => a.id.localeCompare(b.id));
        const initialIngs = initialState.ingredients.map(normalizeIng).sort((a, b) => a.id.localeCompare(b.id));

        return !_.isEqual(currentIngs, initialIngs);

    }, [recipeData, ingredients, initialState]);

    const recipeForView = useMemo(() => {
        if (!recipeData) return null;
        
        const transformedIngredients = ingredients.map(ing => {
            const foodDetails = allFoods.find(f => String(f.id) === String(ing.food_id));
            return {
                ...ing,
                food: foodDetails || { name: 'Desconocido', id: ing.food_id, proteins: 0, total_carbs: 0, total_fats: 0 },
                quantity: ing.grams, 
                food_group_id: ing.food_group_id || foodDetails?.food_to_food_groups?.[0]?.food_group_id
            };
        }).sort((a, b) => {
            const nameA = a.food?.name || '';
            const nameB = b.food?.name || '';
            return nameA.localeCompare(nameB);
        });

        return {
            ...recipeData,
            ingredients: transformedIngredients
        };
    }, [recipeData, ingredients, allFoods]);

    const handleIngredientsChange = (newNestedIngredients) => {
        if (isReadOnly) return;
        const flatIngredients = newNestedIngredients.map(ing => {
            const rawQuantity = ing.grams ?? ing.quantity;
            const isQuantityEmpty = rawQuantity === '' || rawQuantity === null || rawQuantity === undefined;

            return {
                local_id: ing.local_id || ing.id || crypto.randomUUID(),
                id: ing.id,
                food_id: ing.food?.id || ing.food_id,
                grams: isQuantityEmpty ? '' : parseFloat(rawQuantity),
                food_group_id: ing.food_group_id || ing.food?.food_to_food_groups?.[0]?.food_group_id
            };
        });
        setIngredients(flatIngredients);
    };

    const handleRemoveIngredient = (ingredientToRemove) => {
        if (isReadOnly) return;
        const newIngredients = ingredients.filter(ing => {
            const idA = ing.local_id || ing.id;
            const idB = ingredientToRemove.local_id || ingredientToRemove.id;
            return String(idA) !== String(idB);
        });
        setIngredients(newIngredients);
    };

    const handleAddIngredient = (newIngredient) => {
        if (isReadOnly) return;
        const ingredientToAdd = {
            local_id: crypto.randomUUID(),
            food_id: newIngredient.food_id,
            grams: newIngredient.quantity || 100,
            food_group_id: allFoods.find(f => f.id === newIngredient.food_id)?.food_to_food_groups?.[0]?.food_group_id || null
        };
        
        setIngredients([...ingredients, ingredientToAdd]);
        setCurrentView('editor');
        toast({ title: "Ingrediente añadido", description: `${newIngredient.food_name} añadido a la receta.` });
    };

    // --- Interactive Collapsible Logic Handlers ---

    const toggleIngredientExpansion = useCallback((ingredientId) => {
        setExpandedIngredients(prev => {
            const next = new Set(prev);
            const isExpanding = !next.has(ingredientId);
            
            if (isExpanding) {
                next.add(ingredientId);
                // Also show macros when expanding
                setVisibleMacros(prevMacros => {
                    const nextMacros = new Set(prevMacros);
                    nextMacros.add(ingredientId);
                    return nextMacros;
                });
            } else {
                next.delete(ingredientId);
                // Also hide macros when collapsing
                setVisibleMacros(prevMacros => {
                    const nextMacros = new Set(prevMacros);
                    nextMacros.delete(ingredientId);
                    return nextMacros;
                });
            }
            return next;
        });
    }, []);

    const toggleQuantityInputFocus = useCallback((ingredientId, isFocused) => {
        setFocusedInput(isFocused ? ingredientId : null);
        
        if (isFocused) {
            // Show macros on focus
            setVisibleMacros(prev => {
                const next = new Set(prev);
                next.add(ingredientId);
                return next;
            });
        } else {
            // Hide macros on blur
            setVisibleMacros(prev => {
                const next = new Set(prev);
                next.delete(ingredientId);
                return next;
            });
        }
    }, []);

    const toggleAllIngredients = useCallback(() => {
        setAllExpanded(prev => {
            const newState = !prev;
            if (newState) {
                // Expand all
                const allIds = ingredients.map(i => i.local_id || i.id || String(i.food_id));
                setExpandedIngredients(new Set(allIds));
                setVisibleMacros(new Set(allIds));
            } else {
                // Collapse all
                setExpandedIngredients(new Set());
                setVisibleMacros(new Set());
            }
            return newState;
        });
    }, [ingredients]);


    const handleUpdateVariant = async () => {
        if (isReadOnly) return;
        const criticalConflicts = conflicts?.filter(c => ['condition_avoid', 'sensitivity', 'non-preferred', 'individual_restriction'].includes(c.type)) || [];
        if (criticalConflicts.length > 0) {
            toast({ title: "Conflictos detectados", description: "No puedes guardar cambios si la receta contiene ingredientes que generan conflicto.", variant: "destructive" });
            return;
        }

        setLocalIsSaving(true);
        try {
            // Check context: Assigned Plan vs Template
            if (isAssignedPlan && !isAdding) {
                // ASSIGNED PLAN CONTEXT
                const result = await updateDietPlanRecipeCustomization({
                    dietPlanRecipeId: recipeToEdit.id,
                    formData: recipeData,
                    ingredients: ingredients
                });
                
                if (result.success) {
                    toast({ title: "Receta actualizada", description: "Se han guardado los cambios en la receta asignada." });
                    if (onSaveSuccess) onSaveSuccess({ id: recipeToEdit.id }, 'customized_update');
                } else {
                    throw new Error(result.message);
                }

            } else {
                // TEMPLATE CONTEXT
                let parentId = recipeToEdit.recipeTemplateId || recipeToEdit.recipe_id || recipeToEdit.id;
                
                if (recipeToEdit.recipe && recipeToEdit.recipe.parent_recipe_id) {
                    parentId = recipeToEdit.recipe.parent_recipe_id;
                } else if (recipeToEdit.parent_recipe_id) {
                    parentId = recipeToEdit.parent_recipe_id;
                }

                const newRecipeData = {
                    name: recipeData.name,
                    instructions: recipeData.instructions || '',
                    prep_time_min: recipeData.prep_time_min ? parseInt(recipeData.prep_time_min) : null,
                    difficulty: recipeData.difficulty,
                    created_by: user.id, 
                    parent_recipe_id: parentId,
                };

                const { data: newRecipe, error: createError } = await supabase
                    .from('recipes')
                    .insert(newRecipeData)
                    .select()
                    .single();

                if (createError) throw createError;

                const ingredientsToInsert = ingredients.map(ing => ({
                    recipe_id: newRecipe.id,
                    food_id: parseInt(ing.food_id),
                    grams: parseFloat(ing.grams || 0),
                    food_group_id: ing.food_group_id || null
                })).filter(i => !isNaN(i.food_id));

                if (ingredientsToInsert.length > 0) {
                    const { error: ingError } = await supabase
                        .from('recipe_ingredients')
                        .insert(ingredientsToInsert);
                    
                    if (ingError) throw ingError;
                }
                
                const { error: macroError } = await supabase.from('recipe_macros').insert({
                    recipe_id: newRecipe.id,
                    calories: macros.calories,
                    proteins: macros.proteins,
                    carbs: macros.carbs,
                    fats: macros.fats,
                });
                
                if (macroError) throw macroError;

                let updatedPlanRecipeId;
                const ingredientsToSave = ingredients;

                if (isAdding) {
                    const { data: insertedPlanRecipe, error: insertPlanError } = await supabase
                        .from('diet_plan_recipes')
                        .insert({
                            diet_plan_id: recipeToEdit.dietPlanId,
                            day_meal_id: recipeToEdit.mealId,
                            recipe_id: newRecipe.id,
                            is_customized: false, 
                        })
                        .select()
                        .single();
                    
                    if (insertPlanError) throw insertPlanError;
                    updatedPlanRecipeId = insertedPlanRecipe.id;

                } else {
                    const { data: updatedPlanRecipe, error: updateError } = await supabase
                        .from('diet_plan_recipes')
                        .update({
                            recipe_id: newRecipe.id,
                            is_customized: false,
                            custom_name: null,
                            custom_instructions: null,
                            custom_prep_time_min: null,
                            custom_difficulty: null,
                            custom_ingredients: null
                        })
                        .eq('id', recipeToEdit.id)
                        .select()
                        .single();

                    if (updateError) throw updateError;
                    updatedPlanRecipeId = updatedPlanRecipe.id;
                    
                }
                const { success, error: dpIngError } = await saveDietPlanRecipeIngredients(updatedPlanRecipeId, ingredientsToSave);

                if (!success) throw new Error(dpIngError || 'Error guardando ingredientes del plan.');
                toast({ title: "Variante creada", description: "Se ha creado una nueva variante de la receta y asignada al plan." });
                
                if (onSaveSuccess) onSaveSuccess({ id: updatedPlanRecipeId }, 'variant_created');
            }

        } catch (error) {
            console.error("Error creating variant/updating:", error);
            toast({ title: "Error", description: `No se pudieron cargar los cambios: ${error.message}`, variant: "destructive" });
        } finally {
            setLocalIsSaving(false);
        }
    };

    const handleClose = () => {
        if (!hookIsSaving && !localIsSaving) {
            resetToOriginalState();
            onOpenChange(false);
            setInitialState(null);
            setCurrentView('editor');
        }
    };

    const loading = loadingRecipe || loadingInitialData;
    const isSaving = hookIsSaving || localIsSaving;
    const showVariantButton = (
        recipeToEdit &&
        (isTemplatePlan || userId) &&
        (isAdding || recipeToEdit.id) &&
        !isTemporaryEdit &&
        !isReadOnly 
    ); 

    const criticalConflicts = conflicts?.filter(c => ['condition_avoid', 'sensitivity', 'non-preferred', 'individual_restriction'].includes(c.type)) || [];
    const hasCriticalConflicts = criticalConflicts.length > 0;
    
    const variantButtonText = useMemo(() => {
         if (hasCriticalConflicts) return "Resolver conflictos";
         if (isAssignedPlan && !isAdding) return "Actualizar receta"; 
         if (!hasChanges && !isAdding) return "Sin cambios";
         return "Crear nueva variante";
    }, [hasCriticalConflicts, hasChanges, isAdding, isAssignedPlan]);

    const variantButtonIcon = useMemo(() => {
        if (isAssignedPlan && !isAdding && !hasCriticalConflicts) return <PenSquare className="mr-2 h-4 w-4" />;
        return <GitBranch className="mr-2 h-4 w-4" />;
    }, [isAssignedPlan, isAdding, hasCriticalConflicts]);


    const isButtonDisabled = isSaving || hasCriticalConflicts || (!hasChanges && !isAdding && !isAssignedPlan); 

    
    const handleTemporarySave = () => {
        if (isReadOnly) return;
        const foodMap = new Map((allFoods || []).map(food => [String(food.id), food]));

        const mappedIngredients = ingredients.map(ing => ({
            ...ing,
            food: ing.food || foodMap.get(String(ing.food_id)) || null,
            food_id: ing.food_id,
            grams: Number(ing.grams || ing.quantity || 0)
        }));

        const updatedRecipe = {
            ...recipeToEdit,
            custom_name: recipeData?.name ?? recipeToEdit?.custom_name ?? recipeToEdit?.recipe?.name,
            custom_instructions: recipeData?.instructions ?? recipeToEdit?.custom_instructions ?? recipeToEdit?.recipe?.instructions,
            custom_prep_time_min: recipeData?.prep_time_min ?? recipeToEdit?.custom_prep_time_min ?? recipeToEdit?.recipe?.prep_time_min,
            custom_difficulty: recipeData?.difficulty ?? recipeToEdit?.custom_difficulty ?? recipeToEdit?.recipe?.difficulty,
            ingredients: mappedIngredients,
            custom_ingredients: mappedIngredients
        };

        if (onSaveSuccess) {
            onSaveSuccess(updatedRecipe);
        }
        handleClose();
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-4xl h-[90vh] bg-slate-950 border-slate-800 text-white flex flex-col p-0 overflow-hidden">
                {loading ? (
                    <div className="flex-grow flex items-center justify-center">
                        <Loader2 className="w-12 h-12 animate-spin text-green-400" />
                    </div>
                ) : (
                    <div className="flex flex-col h-full overflow-hidden">
                        {currentView === 'editor' ? (
                             <div className="flex flex-col h-full">
                                <div className="flex-grow overflow-y-auto styled-scrollbar p-0 pb-24">
                                    {recipeForView && (
                                        <RecipeView
                                            recipe={recipeForView}
                                            allFoods={allFoods}
                                            allVitamins={allVitamins}
                                            allMinerals={allMinerals}
                                            allFoodGroups={allFoodGroups}
                                            macros={macros}
                                            userRestrictions={fullUserRestrictions}
                                            isEditing={!isReadOnly}
                                            onFormChange={(e) => !isReadOnly && setRecipeData(prev => ({ ...prev, [e.target.name]: e.target.value }))}
                                            onIngredientsChange={handleIngredientsChange}
                                            onRemoveIngredient={handleRemoveIngredient}
                                            onAddIngredientClick={() => setCurrentView('search')}
                                            mealTargetMacros={mealTargetMacros}
                                            enableStickyMacros={true}
                                            conflicts={conflicts}
                                            
                                            // New props for collapsible logic
                                            expandedIngredients={expandedIngredients}
                                            visibleMacros={visibleMacros}
                                            focusedQuantityInput={focusedInput}
                                            toggleIngredientExpansion={toggleIngredientExpansion}
                                            toggleQuantityInputFocus={toggleQuantityInputFocus}
                                            toggleAllIngredients={toggleAllIngredients}
                                            allExpanded={allExpanded}
                                        />
                                    )}
                                </div>
                                
                                <div className="absolute bottom-0 left-0 right-0 bg-slate-900/95 border-t border-slate-800 p-4 backdrop-blur-sm flex justify-end gap-3 z-20">
                                    <Button variant="ghost" onClick={handleClose} disabled={isSaving} className="text-white hover:bg-slate-900 hover:text-gray-200">
                                        {isReadOnly ? 'Cerrar' : 'Cancelar'}
                                    </Button>
                                    
                                    {!isReadOnly && (
                                        isTemporaryEdit ? (
                                            <Button
                                                onClick={handleTemporarySave}
                                                disabled={isSaving}
                                                className="bg-green-600 hover:bg-green-500"
                                            >
                                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                                Guardar cambios temporales
                                            </Button>
                                        ) : showVariantButton ? (
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <span tabIndex={0}> 
                                                            <Button 
                                                                onClick={handleUpdateVariant} 
                                                                disabled={isButtonDisabled} 
                                                                className={cn(
                                                                    "bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-400",
                                                                    ((hasChanges || isAdding) && !hasCriticalConflicts) && "bg-green-600 hover:bg-green-500",
                                                                    (isAssignedPlan && !isAdding && !hasCriticalConflicts) && "bg-orange-600 hover:bg-orange-500"
                                                                )}
                                                            >
                                                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : variantButtonIcon}
                                                                {variantButtonText}
                                                            </Button>
                                                        </span>
                                                    </TooltipTrigger>
                                                    {(isButtonDisabled) && (
                                                        <TooltipContent className="bg-slate-900 border-slate-700 text-white">
                                                            {hasCriticalConflicts 
                                                                ? <p className="text-red-400">Resuelve los conflictos de intolerancias antes de guardar.</p>
                                                                : <p>Realiza cambios en la receta para poder guardar.</p>
                                                            }
                                                        </TooltipContent>
                                                    )}
                                                </Tooltip>
                                            </TooltipProvider>
                                        ) : (
                                            <Button onClick={hookHandleSave} disabled={isSaving} className="bg-green-600 hover:bg-green-500">
                                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                                Guardar Receta
                                            </Button>
                                        )
                                    )}
                                </div>
                             </div>
                        ) : (
                            <div className="h-full p-6 bg-slate-950">
                                <IngredientSearch
                                    selectedIngredients={ingredients}
                                    onIngredientAdded={handleAddIngredient}
                                    availableFoods={allFoods}
                                    userRestrictions={fullUserRestrictions}
                                    onBack={() => setCurrentView('editor')}
                                />
                            </div>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};

function cn(...classes) {
    return classes.filter(Boolean).join(' ');
}

export default AdminRecipeModal;