import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { calculateMacros } from '@/lib/macroCalculator';
import { getConflictInfo } from '@/lib/restrictionChecker';
import {
    createVariant,
    saveFreeRecipe,
    saveDietPlanRecipe,
    updateRecipeDetails,
    versionDietPlanRecipe,
    checkRecipeEditability,
    updateUserRecipeInPlace,
    archiveUserRecipe,
} from './recipeService';
import {
    buildDiffSummary,
    inferVariantLabel,
    inferVariantNameFromIngredientChanges,
} from '@/lib/recipeDiffUtils';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabaseClient';
import { findFoodByIdentity, inferIngredientUserCreated, isUserCreatedFood } from '@/lib/foodIdentity';
import { isAdminRole, isCoachRole } from '@/lib/roles';

export const useRecipeEditor = ({ recipeToEdit, onSaveSuccess, isAdminView, userId: propUserId, open, planRestrictions: initialPlanRestrictions, initialConflicts = null, allFoods, isTemplate = false }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const userId = propUserId || user.id;

  const [mode, setMode] = useState('view');
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({});
  const [ingredients, setIngredients] = useState([]);
  const [originalIngredients, setOriginalIngredients] = useState([]);
  const [macros, setMacros] = useState({ calories: 0, proteins: 0, carbs: 0, fats: 0 });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [initialFormData, setInitialFormData] = useState({});
  const [userRestrictions, setUserRestrictions] = useState(initialPlanRestrictions || null);
  const [conflicts, setConflicts] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [hasInitialConflicts, setHasInitialConflicts] = useState(false);
  const initializedRecipeRef = useRef(null);

  // En el nuevo modelo: los usuarios nunca auto-guardan al cambiar de modo —
  // la creación de variante es siempre explícita (botón). Los admins sí auto-guardan.
  const isClientRequestView = !isAdminView;

  const resetState = useCallback(() => {
    setMode('view');
    setLoading(true);
    setFormData({});
    setIngredients([]);
    setOriginalIngredients([]);
    setMacros({ calories: 0, proteins: 0, carbs: 0, fats: 0 });
    setInitialFormData({});
    setConflicts(null);
    setRecommendations(null);
    setHasInitialConflicts(false);
    initializedRecipeRef.current = null;
  }, []);

  const fetchUserRestrictions = useCallback(async () => {
    if (!userId) return;
    try {
        const [restrictionsRes, preferredRes, nonPreferredRes] = await Promise.all([
            supabase.rpc('get_user_restrictions', { p_user_id: userId }),
            supabase.from('preferred_foods').select('food(id, name)').eq('user_id', userId),
            supabase.from('non_preferred_foods').select('food(id, name)').eq('user_id', userId),
        ]);

        if (restrictionsRes.error) throw new Error(`Error fetching restrictions: ${restrictionsRes.error.message}`);

        setUserRestrictions({
            ...(restrictionsRes.data || {}),
            preferred_foods: (preferredRes.data || []).map(p => p.food).filter(Boolean),
            non_preferred_foods: (nonPreferredRes.data || []).map(np => np.food).filter(Boolean),
        });

    } catch (error) {
      console.error('Error fetching user restrictions:', error);
      toast({ title: 'Error', description: 'No se pudieron cargar las restricciones del usuario.', variant: 'destructive' });
    }
  }, [userId, toast]);
  
  useEffect(() => {
    if (open) {
      // Para plantillas no hay usuario objetivo: las restricciones vienen de initialPlanRestrictions.
      // Llamar fetchUserRestrictions aquí usaría user.id (el admin), contaminando los conflictos.
      if (!isTemplate) {
        fetchUserRestrictions();
      }
    } else {
      resetState();
    }
  }, [open, isTemplate, fetchUserRestrictions, resetState]);

  useEffect(() => {
    if (!open || !recipeToEdit || allFoods.length === 0) return;

    const recipeKey = [
      recipeToEdit.type || 'recipe',
      recipeToEdit.id || recipeToEdit.recipe_id || 'no-id',
      recipeToEdit.updated_at || recipeToEdit.recipe?.updated_at || '',
      recipeToEdit.diet_plan_id || recipeToEdit.recipe?.diet_plan_id || '',
    ].join('|');

    // Prevent local edits from being overwritten when enrichment data changes (e.g. creating a new food inline).
    if (initializedRecipeRef.current === recipeKey && !loading) return;

    setLoading(true);

    const recipeSource = recipeToEdit.recipe || {};
    const initialForm = {
      name: recipeToEdit.custom_name || recipeSource.name || recipeToEdit.name || 'Nueva Receta',
      instructions: recipeToEdit.custom_instructions || recipeSource.instructions || recipeToEdit.instructions || '',
      prep_time_min: recipeToEdit.custom_prep_time_min ?? recipeSource.prep_time_min ?? recipeToEdit.prep_time_min,
      difficulty: recipeToEdit.custom_difficulty || recipeSource.difficulty || recipeToEdit.difficulty || 'Fácil',
      recipe_style_id: String(
        recipeToEdit.custom_recipe_style_id ??
          recipeSource.recipe_style_id ??
          recipeToEdit.recipe_style_id ??
          ''
      ),
    };

    setFormData(initialForm);
    setInitialFormData(initialForm);
    setIngredients(recipeToEdit.ingredients || []);
    setOriginalIngredients(JSON.parse(JSON.stringify(recipeToEdit.ingredients || [])));
    initializedRecipeRef.current = recipeKey;
    setLoading(false);
  }, [recipeToEdit, open, allFoods.length, loading]);


  useEffect(() => {
    if (ingredients.length > 0 && allFoods.length > 0) {
      const sanitizedIngredients = ingredients.map(i => ({
          ...i,
          grams: i.grams === '' || i.grams === null ? 0 : Number(i.grams)
      }));
      setMacros(calculateMacros(sanitizedIngredients, allFoods));
    } else {
      setMacros({ calories: 0, proteins: 0, carbs: 0, fats: 0 });
    }
  }, [ingredients, allFoods]);

  useEffect(() => {
    if (initialConflicts) {
      const { conflicts: c, recommendations: r } = initialConflicts;
      setConflicts(c || []);
      setRecommendations(r || []);
      if (c && c.length > 0) setHasInitialConflicts(true);
    } else if (recipeToEdit?.conflicts) {
        // Handle flattened conflicts from object structure (e.g. from AddRecipeToPlanDialog)
        const flatConflicts = [];
        if (recipeToEdit.conflicts.sensitivities) {
            recipeToEdit.conflicts.sensitivities.forEach(s => 
                flatConflicts.push({ type: 'sensitivity', reason: s.name, id: s.id })
            );
        }
        if (recipeToEdit.conflicts.conditions) {
            recipeToEdit.conflicts.conditions.forEach(c => 
                flatConflicts.push({ type: 'condition_avoid', reason: c.name, id: c.id })
            );
        }
        setConflicts(flatConflicts);
        if (flatConflicts.length > 0) setHasInitialConflicts(true);

        const flatRecs = [];
        if (recipeToEdit.recommendations?.conditions) {
             recipeToEdit.recommendations.conditions.forEach(c => 
                flatRecs.push({ type: 'condition_recommend', reason: c.name, id: c.id })
            );
        }
        setRecommendations(flatRecs);
    }
  }, [initialConflicts, recipeToEdit]);
  useEffect(() => {
    if (!ingredients?.length || !userRestrictions || !allFoods?.length) return;

    const computedConflicts = [];
    const computedRecommendations = [];

    ingredients.forEach((ing) => {
      const foodId = ing.food?.id || ing.food_id;
      const food = ing.food || allFoods.find(f => String(f.id) === String(foodId));

      if (!food) return;

      const info = getConflictInfo(food, userRestrictions);
      if (!info) return;

      if (['condition_avoid', 'sensitivity', 'individual_restriction', 'non-preferred', 'diet_type_excluded', 'diet_type_limited'].includes(info.type)) {
        computedConflicts.push({
          foodId: food.id,
          type: info.type,
          restrictionName: info.reason
        });
      } else if (['condition_recommend', 'preferred'].includes(info.type)) {
        computedRecommendations.push({
          foodId: food.id,
          restrictionName: info.reason
        });
      }
    });

    setConflicts(computedConflicts);
    setRecommendations(computedRecommendations);
  }, [ingredients, userRestrictions, allFoods]);
  
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleIngredientsChange = (newIngredients) => {
    setIngredients(newIngredients);
  };
  
  const handleAddIngredient = (newIngredientData) => {
      const inferredUserCreated = inferIngredientUserCreated(newIngredientData);
      const food =
        findFoodByIdentity(allFoods, {
          foodId: newIngredientData.food_id,
          isUserCreated: inferredUserCreated,
        }) ||
        newIngredientData.food ||
        null;
      const newIngredient = {
          ...newIngredientData,
          is_user_created:
            inferredUserCreated !== null
              ? inferredUserCreated
              : isUserCreatedFood(food),
          food: food,
          local_id: uuidv4()
      };
      
      handleIngredientsChange([...ingredients, newIngredient]);
      return newIngredient;
  };

  const handleRemoveIngredient = (ingredient) => {
    const identifier = ingredient.local_id || ingredient.id;
    handleIngredientsChange(ingredients.filter(ing => (ing.local_id || ing.id) !== identifier));
  };

  const normalizeFormForComparison = useCallback((data) => ({
    name: String(data?.name ?? ''),
    instructions: String(data?.instructions ?? ''),
    prep_time_min:
      data?.prep_time_min === '' || data?.prep_time_min === null || data?.prep_time_min === undefined
        ? null
        : Number(data.prep_time_min),
    difficulty: String(data?.difficulty ?? ''),
    recipe_style_id: String(data?.recipe_style_id ?? ''),
  }), []);

  const hasFormChanged = useCallback((current, baseline) => {
    const normalizedCurrent = normalizeFormForComparison(current);
    const normalizedBaseline = normalizeFormForComparison(baseline);

    return (
      normalizedCurrent.name !== normalizedBaseline.name ||
      normalizedCurrent.instructions !== normalizedBaseline.instructions ||
      normalizedCurrent.prep_time_min !== normalizedBaseline.prep_time_min ||
      normalizedCurrent.difficulty !== normalizedBaseline.difficulty ||
      normalizedCurrent.recipe_style_id !== normalizedBaseline.recipe_style_id
    );
  }, [normalizeFormForComparison]);

  // ---------------------------------------------------------------------------
  // Clasificación del nodo de receta
  // ---------------------------------------------------------------------------

  // Una rama del usuario vive en user_recipes (variant / private_recipe)
  const isUserBranch = useMemo(() => {
      if (!recipeToEdit) return false;
      return (
          recipeToEdit.type === 'variant' ||
          recipeToEdit.type === 'private_recipe' ||
          recipeToEdit.is_private === true ||
          recipeToEdit.is_private_recipe === true ||
          Boolean(recipeToEdit.parent_user_recipe_id) ||
          recipeToEdit.user_recipe_type === 'variant' ||
          recipeToEdit.user_recipe_type === 'private'
      );
  }, [recipeToEdit]);

  // Una receta base vive en diet_plan_recipes (nodo del plan, no rama personal)
  const isBaseRecipe = useMemo(() => {
      if (!recipeToEdit) return false;
      return !isUserBranch && recipeToEdit.type !== 'free_recipe';
  }, [recipeToEdit, isUserBranch]);

  // Guard de trazabilidad: ¿puede editarse in-place?
  const checkEditabilityForSave = useCallback(async () => {
      if (!recipeToEdit?.id || !isUserBranch) return { canModifyInPlace: false, hasEatenRecords: false, hasChildren: false };
      return checkRecipeEditability(recipeToEdit.id);
  }, [recipeToEdit?.id, isUserBranch]);

  const hasIngredientChanges = useMemo(() => {
      const normalizeGrams = (v) => (v == null || v === '') ? 0 : Number(v);
      const normalize = (ing) => ({
          food_id: String(ing.food_id ?? ing.food?.id ?? ''),
          grams: normalizeGrams(ing.grams),
      });

      const current = ingredients.map(normalize).sort((a, b) => a.food_id.localeCompare(b.food_id));
      const original = originalIngredients.map(normalize).sort((a, b) => a.food_id.localeCompare(b.food_id));

      if (current.length !== original.length) return true;

      return current.some((ing, i) => {
          const orig = original[i];
          return ing.food_id !== orig.food_id || ing.grams !== orig.grams;
      });
  }, [ingredients, originalIngredients]);

  const hasMetadataChanges = useMemo(() => {
    return hasFormChanged(formData, initialFormData);
  }, [formData, initialFormData, hasFormChanged]);

  // Lista de campos de metadata que han cambiado (para mostrar en diálogos informativos)
  const changedMetadataFields = useMemo(() => {
    const fields = [];
    if (String(formData?.name ?? '') !== String(initialFormData?.name ?? '')) fields.push('nombre');
    if (String(formData?.instructions ?? '') !== String(initialFormData?.instructions ?? '')) fields.push('preparación');
    const newTime = formData?.prep_time_min == null || formData?.prep_time_min === '' ? null : Number(formData.prep_time_min);
    const oldTime = initialFormData?.prep_time_min == null || initialFormData?.prep_time_min === '' ? null : Number(initialFormData.prep_time_min);
    if (newTime !== oldTime) fields.push('tiempo');
    if (String(formData?.difficulty ?? '') !== String(initialFormData?.difficulty ?? '')) fields.push('dificultad');
    if (String(formData?.recipe_style_id ?? '') !== String(initialFormData?.recipe_style_id ?? '')) fields.push('estilo');
    return fields;
  }, [formData, initialFormData]);

  const hasChanges = useMemo(() => {
    return hasMetadataChanges || hasIngredientChanges;
  }, [hasMetadataChanges, hasIngredientChanges]);

  const handleSubmit = useCallback(async (actionType = 'save', saveMode = 'auto') => {
    if (!hasChanges) {
        if (actionType === 'replace') return true; 
        toast({ title: "Sin cambios", description: "No has realizado ninguna modificación." });
        return true;
    }
    
    setIsSubmitting(true);
    let result;

    try {
        const sanitizedIngredients = ingredients.map(i => ({
            ...i,
            grams: (i.grams === '' || i.grams === null || isNaN(Number(i.grams))) ? 0 : Number(i.grams),
            quantity: (i.quantity === '' || i.quantity === null || isNaN(Number(i.quantity))) ? 0 : Number(i.quantity)
        }));
        let finalFormData = { ...formData };
        const foodsById = new Map((allFoods || []).map((food) => [String(food.id), food]));

        if (hasIngredientChanges && finalFormData.name?.trim() === initialFormData.name?.trim()) {
            const autoVariantName = inferVariantNameFromIngredientChanges(
              initialFormData.name || finalFormData.name || '',
              originalIngredients,
              sanitizedIngredients,
              foodsById
            );
            if (autoVariantName && autoVariantName.trim() !== initialFormData.name?.trim()) {
              finalFormData.name = autoVariantName.trim();
              setFormData((prev) => ({ ...prev, name: autoVariantName.trim() }));
            }
        }
        if (hasIngredientChanges && finalFormData.name?.trim() === initialFormData.name?.trim()) {
            const forcedVariantName = `${initialFormData.name || finalFormData.name} (variante)`.trim();
            finalFormData.name = forcedVariantName;
            setFormData((prev) => ({ ...prev, name: forcedVariantName }));
        }

        const isSimpleUpdate = !hasIngredientChanges && hasFormChanged(finalFormData, initialFormData);
        const isVariantNode =
            recipeToEdit.type === 'variant' ||
            recipeToEdit.user_recipe_type === 'variant';
        const isUserRecipeNode =
            recipeToEdit.type === 'private_recipe' ||
            recipeToEdit.type === 'free_recipe' ||
            recipeToEdit.type === 'variant' ||
            recipeToEdit.is_private_recipe ||
            recipeToEdit.is_private ||
            Boolean(recipeToEdit.user_recipe_type);

        // Solo cambios de metadatos: actualizar in-place.
        // En variantes: NO crear nueva variante si no cambian ingredientes.
        if (isSimpleUpdate && recipeToEdit.id && !isTemplate && isUserRecipeNode) {
             let recipeType = 'user_recipe';
             if (recipeToEdit.type === 'free_recipe') recipeType = 'free_recipe';
             else if (isVariantNode) recipeType = 'variant';
             else if (recipeToEdit.type === 'private_recipe' || recipeToEdit.is_private_recipe) recipeType = 'private_recipe';

             result = await updateRecipeDetails({
                 recipeId: recipeToEdit.id,
                 recipeType,
                 updates: finalFormData
             });
             
             if (result.success) {
                 if (onSaveSuccess) onSaveSuccess(result.data, 'update_details');
                 toast({ title: 'Éxito', description: result.message, variant: 'success' });
                 setIsSubmitting(false);
                 return true;
             }
        }

        const diffSummary = buildDiffSummary(originalIngredients, sanitizedIngredients, foodsById);
        const variantLabel = inferVariantLabel(diffSummary);

        // Path explícito: guardar solo metadatos en-place (nombre, instrucciones, dificultad, etc.)
        // No crea nueva rama ni toca ingredientes. Válido para ramas del usuario Y recetas base.
        if (saveMode === 'metadata_only' && recipeToEdit.id) {
            const recipeType = isUserBranch
                ? (isVariantNode ? 'variant' : 'user_recipe')
                : 'diet_plan_recipe';
            result = await updateRecipeDetails({
                recipeId: recipeToEdit.id,
                recipeType,
                updates: finalFormData,
            });
        } else if (saveMode === 'in_place' && recipeToEdit.id && isUserBranch) {
            result = await updateUserRecipeInPlace({
                recipeId: recipeToEdit.id,
                formData: finalFormData,
                ingredients: sanitizedIngredients,
            });
        } else if (saveMode === 'hide_and_variant' && recipeToEdit.id && isUserBranch) {
            // Ocultar versión actual (preserva datos históricos) y crear rama hija
            await archiveUserRecipe(recipeToEdit.id);
            result = await createVariant({
                parentNodeId: recipeToEdit.id,
                parentNodeType: 'user_recipe',
                userId: recipeToEdit.user_id || userId,
                formData: finalFormData,
                ingredients: sanitizedIngredients,
                variantLabel,
                diffSummary,
                dietPlanId: recipeToEdit.diet_plan_id,
                dayMealId: recipeToEdit.day_meal_id,
            });
        } else if (recipeToEdit.type === 'private_recipe' || recipeToEdit.is_private_recipe || recipeToEdit.type === 'variant') {
            // En nodos del árbol personal (private/variant), si hay cambios de ingredientes:
            // crear nueva variante hija para conservar historial.
            result = await createVariant({
                parentNodeId: recipeToEdit.id,
                parentNodeType: 'user_recipe',
                userId: recipeToEdit.user_id || userId,
                formData: finalFormData,
                ingredients: sanitizedIngredients,
                variantLabel,
                diffSummary,
                dietPlanId: recipeToEdit.diet_plan_id,
                dayMealId: recipeToEdit.day_meal_id,
            });
        } else if (recipeToEdit.type === 'free_recipe') {
            result = await saveFreeRecipe({
                recipeId: recipeToEdit.id,
                userId: recipeToEdit.user_id,
                formData: finalFormData,
                ingredients: sanitizedIngredients,
                originalRecipe: recipeToEdit,
            });
        } else { // diet_plan_recipe o receta global del catálogo
            if (isAdminView) {
                if (isTemplate && recipeToEdit.id) {
                    // Template: crear nueva versión y archivar la anterior (Principio 4)
                    result = await versionDietPlanRecipe({
                        oldDietPlanRecipeId: recipeToEdit.id,
                        formData: finalFormData,
                        ingredients: sanitizedIngredients,
                        originalRecipe: recipeToEdit,
                    });
                } else {
                    // Plan en vivo (admin): crear variante en diet_plan_recipes
                    const originalToPass = recipeToEdit.type === 'recipe'
                        ? {
                            ...recipeToEdit,
                            recipe_id: recipeToEdit.recipe_id || recipeToEdit.recipe?.id || recipeToEdit.id,
                            diet_plan_id: recipeToEdit.diet_plan_id,
                            day_meal_id: recipeToEdit.day_meal_id,
                          }
                        : recipeToEdit;

                    result = await saveDietPlanRecipe({
                        formData: finalFormData,
                        ingredients: sanitizedIngredients,
                        originalRecipe: originalToPass,
                    });
                }
            } else {
                // Usuario: crear variante personal inmediata — sin solicitud al coach (Principio 5)
                const parentNodeType = recipeToEdit.id ? 'diet_plan_recipe' : null;
                result = await createVariant({
                    parentNodeId: recipeToEdit.id,
                    parentNodeType,
                    userId,
                    formData: finalFormData,
                    ingredients: sanitizedIngredients,
                    variantLabel,
                    diffSummary,
                    dietPlanId: recipeToEdit.diet_plan_id,
                    dayMealId: recipeToEdit.day_meal_id,
                });
            }
        }

        if (result.success) {
            setInitialFormData(finalFormData);
            setOriginalIngredients(JSON.parse(JSON.stringify(sanitizedIngredients)));
            if (onSaveSuccess) onSaveSuccess(result.data, result.action);
            toast({ title: 'Éxito', description: result.message, variant: 'success' });
            return true;
        } else {
            toast({ title: 'Error', description: result.message, variant: 'destructive' });
            return false;
        }
    } catch (error) {
        toast({ title: 'Error Inesperado', description: error.message, variant: 'destructive' });
        return false;
    } finally {
        setIsSubmitting(false);
    }
}, [hasChanges, formData, ingredients, originalIngredients, recipeToEdit, userId, onSaveSuccess, toast, isAdminView, initialFormData, hasIngredientChanges, isTemplate, allFoods, hasFormChanged]);
  
  const isEditable = isAdminView || isAdminRole(user?.role) || isCoachRole(user?.role) || (recipeToEdit && (
      recipeToEdit.is_private ||
      recipeToEdit.type === 'private_recipe' ||
      recipeToEdit.type === 'free_recipe' ||
      recipeToEdit.type === 'variant'
  ));


  return {
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
    isEditable,
    handleAddIngredient,
    handleRemoveIngredient,
    hasInitialConflicts,
    isBaseRecipe,
    isUserBranch,
    checkEditabilityForSave,
    hasMetadataChanges,
    changedMetadataFields,
  };
};
