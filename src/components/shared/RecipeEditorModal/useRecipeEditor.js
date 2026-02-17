
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { calculateMacros } from '@/lib/macroCalculator';
import { submitChangeRequest, savePrivateRecipe, saveFreeRecipe, saveDietPlanRecipe, updateRecipeDetails, updateDietPlanRecipeCustomization } from './recipeService';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabaseClient';


export const useRecipeEditor = ({ recipeToEdit, onSaveSuccess, isAdminView, userId: propUserId, open, planRestrictions: initialPlanRestrictions, isTemporaryEdit = false, initialConflicts = null, allFoods, isTemplate = false }) => {
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

  const isClientRequestView = !isAdminView && recipeToEdit?.type !== 'private_recipe' && !recipeToEdit?.is_customized && !recipeToEdit?.is_private_recipe;

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
  }, []);

  const fetchUserRestrictions = useCallback(async () => {
    if (!userId) return;
    try {
        const [
            sensitivitiesRes,
            conditionsRes,
            individualRes,
            preferredRes,
            nonPreferredRes
        ] = await Promise.all([
            supabase.from('user_sensitivities').select('sensitivities(id, name)').eq('user_id', userId),
            supabase.from('user_medical_conditions').select('medical_conditions(id, name)').eq('user_id', userId),
            supabase.from('user_individual_food_restrictions').select('food(id, name)').eq('user_id', userId),
            supabase.from('preferred_foods').select('food(id, name)').eq('user_id', userId),
            supabase.from('non_preferred_foods').select('food(id, name)').eq('user_id', userId),
        ]);

        const checkError = (res, name) => {
            if (res.error) throw new Error(`Error fetching ${name}: ${res.error.message}`);
            return res.data;
        };

        setUserRestrictions({
            sensitivities: (checkError(sensitivitiesRes, 'sensitivities') || []).map(s => s.sensitivities).filter(Boolean),
            medical_conditions: (checkError(conditionsRes, 'conditions') || []).map(c => c.medical_conditions).filter(Boolean),
            individual_food_restrictions: (checkError(individualRes, 'individual restrictions') || []).map(i => i.food).filter(Boolean),
            preferred_foods: (checkError(preferredRes, 'preferred foods') || []).map(p => p.food).filter(Boolean),
            non_preferred_foods: (checkError(nonPreferredRes, 'non-preferred foods') || []).map(np => np.food).filter(Boolean),
        });

    } catch (error) {
      console.error('Error fetching user restrictions:', error);
      toast({ title: 'Error', description: 'No se pudieron cargar las restricciones del usuario.', variant: 'destructive' });
    }
  }, [userId, toast]);
  
  useEffect(() => {
    if (open) {
      if (!initialPlanRestrictions) {
          fetchUserRestrictions();
      } else {
          setUserRestrictions(initialPlanRestrictions);
      }
    } else {
      resetState();
    }
  }, [open, fetchUserRestrictions, resetState, initialPlanRestrictions]);

  useEffect(() => {
    if (open && recipeToEdit && allFoods.length > 0) {
        setLoading(true);

        let recipeSource = recipeToEdit.recipe || {};
        
        const initialForm = {
            name: recipeToEdit.custom_name || recipeSource.name || recipeToEdit.name || 'Nueva Receta',
            instructions: recipeToEdit.custom_instructions || recipeSource.instructions || recipeToEdit.instructions || '',
            prep_time_min: recipeToEdit.custom_prep_time_min ?? recipeSource.prep_time_min ?? recipeToEdit.prep_time_min,
            difficulty: recipeToEdit.custom_difficulty || recipeSource.difficulty || recipeToEdit.difficulty || 'Fácil',
        };
        setFormData(initialForm);
        setInitialFormData(initialForm);
        
        setIngredients(recipeToEdit.ingredients);
        setOriginalIngredients(JSON.parse(JSON.stringify(recipeToEdit.ingredients)));
        setLoading(false);
    }
}, [recipeToEdit, open, allFoods]);


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

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleIngredientsChange = (newIngredients) => {
    setIngredients(newIngredients);
  };
  
  const handleAddIngredient = (newIngredientData) => {
      const food = allFoods.find(f => f.id === newIngredientData.food_id && !f.is_user_created);
      const newIngredient = {
          ...newIngredientData,
          food: food,
          local_id: uuidv4()
      };
      
      handleIngredientsChange([...ingredients, newIngredient]);
  };

  const handleRemoveIngredient = (ingredient) => {
    const identifier = ingredient.local_id || ingredient.id;
    handleIngredientsChange(ingredients.filter(ing => (ing.local_id || ing.id) !== identifier));
  };

  const hasIngredientChanges = useMemo(() => {
      if (ingredients.length !== originalIngredients.length) return true;
      
      return ingredients.some((ing, i) => {
          const orig = originalIngredients[i];
          const ingGrams = ing.grams === '' || ing.grams === null ? 0 : Number(ing.grams);
          const origGrams = orig.grams === '' || orig.grams === null ? 0 : Number(orig.grams);
          
          return (ing.food_id !== orig.food_id) || 
                 (ingGrams !== origGrams) || 
                 (ing.is_user_created !== orig.is_user_created);
      });
  }, [ingredients, originalIngredients]);

  const hasChanges = useMemo(() => {
    return JSON.stringify(formData) !== JSON.stringify(initialFormData) || hasIngredientChanges;
  }, [formData, initialFormData, hasIngredientChanges]);

  const handleSubmit = useCallback(async (actionType = 'save') => {
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

        const isSimpleUpdate = !hasIngredientChanges && JSON.stringify(formData) !== JSON.stringify(initialFormData);

        // Standard update for existing recipes that support simple updates (except Templates where we want full control below)
        if (isSimpleUpdate && recipeToEdit.id && recipeToEdit.type !== 'recipe' && !isTemplate) {
             let recipeType = 'diet_plan_recipe';
             if (recipeToEdit.type === 'private_recipe' || recipeToEdit.is_private_recipe) recipeType = 'private_recipe';
             else if (recipeToEdit.type === 'free_recipe') recipeType = 'free_recipe';

             result = await updateRecipeDetails({
                 recipeId: recipeToEdit.id,
                 recipeType,
                 updates: formData
             });
             
             if (result.success) {
                 if (onSaveSuccess) onSaveSuccess(result.data, 'update_details');
                 toast({ title: 'Éxito', description: result.message });
                 setIsSubmitting(false);
                 return true;
             }
        }

        if (recipeToEdit.type === 'private_recipe' || recipeToEdit.is_private_recipe) {
            result = await savePrivateRecipe({
                recipeId: recipeToEdit.id,
                userId: recipeToEdit.user_id,
                formData,
                ingredients: sanitizedIngredients,
                originalRecipe: recipeToEdit
            });
        } else if (recipeToEdit.type === 'free_recipe') {
             result = await saveFreeRecipe({
                recipeId: recipeToEdit.id,
                userId: recipeToEdit.user_id,
                formData,
                ingredients: sanitizedIngredients,
            });
        } else { // diet_plan_recipe OR global recipe being added/customized
            if (isAdminView) {
                // If it is a template and we are editing an existing diet_plan_recipe row, update it in place.
                // We use isTemplate flag to detect this context.
                if (isTemplate && recipeToEdit.id) {
                    result = await updateDietPlanRecipeCustomization({
                        dietPlanRecipeId: recipeToEdit.id,
                        formData,
                        ingredients: sanitizedIngredients
                    });
                } else {
                    // For client plans or new recipes, we create a variant/copy
                    const originalToPass = recipeToEdit.type === 'recipe' 
                        ? { ...recipeToEdit, recipe_id: recipeToEdit.id, diet_plan_id: recipeToEdit.diet_plan_id, day_meal_id: recipeToEdit.day_meal_id }
                        : recipeToEdit;

                    result = await saveDietPlanRecipe({
                        recipeId: recipeToEdit.id, 
                        userId,
                        formData,
                        ingredients: sanitizedIngredients,
                        originalRecipe: originalToPass
                    });
                }
            } else {
                let finalFormData = { ...formData };
                if (hasIngredientChanges && finalFormData.name.trim() === initialFormData.name.trim()) {
                     toast({ 
                         title: "Nombre requerido", 
                         description: "Por favor, cambia el nombre de la receta para guardar tu versión personalizada.", 
                         className: "bg-blue-950 border-blue-800 text-blue-100",
                         duration: 5000
                     });
                     setIsSubmitting(false);
                     return false;
                }

                result = await submitChangeRequest({ 
                    actionType: actionType, 
                    recipeToEdit, 
                    formData: finalFormData, 
                    ingredients: sanitizedIngredients, 
                    originalIngredients, 
                    userId,
                    dietPlanRecipeId: recipeToEdit.id
                });
            }
        }

        if (result.success) {
            if (onSaveSuccess) onSaveSuccess(result.data, result.action);
            toast({ title: 'Éxito', description: result.message });
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
}, [hasChanges, formData, ingredients, originalIngredients, recipeToEdit, userId, onSaveSuccess, toast, isTemporaryEdit, isAdminView, initialFormData, hasIngredientChanges, isTemplate]);
  
  const isEditable = isAdminView || user?.role === 'admin' || user?.role === 'coach' || (recipeToEdit && (
      recipeToEdit.is_private || 
      recipeToEdit.type === 'private_recipe' || 
      recipeToEdit.type === 'free_recipe'
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
    hasInitialConflicts
  };
};
