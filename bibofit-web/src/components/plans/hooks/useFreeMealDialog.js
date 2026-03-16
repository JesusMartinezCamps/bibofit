import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { calculateMacros } from '@/lib/macroCalculator';
import { persistFreeRecipeOccurrence } from '@/lib/freeRecipePersistence';
import { FREE_RECIPE_STATUS, getRecipeIngredients } from '@/lib/recipeEntity';

export const useFreeMealDialog = ({ open, onOpenChange, userId, onSaveSuccess, initialMealDate, preselectedMealId, mealToEdit }) => {
  const { toast } = useToast();
  const [dayMealId, setDayMealId] = useState('');
  const [name, setName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [ingredients, setIngredients] = useState([]);
  const [mealDate, setMealDate] = useState(new Date());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userRestrictions, setUserRestrictions] = useState({ sensitivities: [], conditions: [] });
  const [allSensitivities, setAllSensitivities] = useState([]);
  const [allConditions, setAllConditions] = useState([]);
  const [availableFoods, setAvailableFoods] = useState([]);
  const [userDayMeals, setUserDayMeals] = useState([]);
  const dayMealSelectRef = useRef(null);
  
  useEffect(() => {
    const fetchInitialData = async () => {
      if (!userId) return;

      try {
        const [foodsRes, profileRes, sensitivitiesRes, conditionsRes, dayMealsRes] = await Promise.all([
          supabase.from('food').select('*, food_sensitivities(sensitivity_id), food_medical_conditions(condition_id, relation_type), food_to_food_groups(food_group_id)'),
          supabase.from('profiles').select('user_sensitivities(sensitivity_id), user_medical_conditions(condition_id)').eq('user_id', userId).single(),
          supabase.from('sensitivities').select('id, name'),
          supabase.from('medical_conditions').select('id, name'),
          supabase.from('user_day_meals').select('*, day_meal:day_meal_id(*)').eq('user_id', userId)
        ]);

        if (foodsRes.error) throw foodsRes.error;
        if (profileRes.error) throw profileRes.error;
        if (sensitivitiesRes.error) throw sensitivitiesRes.error;
        if (conditionsRes.error) throw conditionsRes.error;
        if (dayMealsRes.error) throw dayMealsRes.error;

        setUserDayMeals(dayMealsRes.data || []);
        setAllSensitivities(sensitivitiesRes.data || []);
        setAllConditions(conditionsRes.data || []);

        const currentUserRestrictions = {
          sensitivities: profileRes.data?.user_sensitivities.map(s => s.sensitivity_id) || [],
          conditions: profileRes.data?.user_medical_conditions.map(c => c.condition_id) || [],
        };
        setUserRestrictions(currentUserRestrictions);

        const getConflictTypeForFood = (food, restrictions) => {
          if (!food || !restrictions) return null;
      
          const hasConditionAvoid = food.food_medical_conditions?.some(fmc => 
              (restrictions.conditions || []).includes(fmc.condition_id) && fmc.relation_type === 'contraindicated'
          );
          if (hasConditionAvoid) return 'condition_avoid';
      
          const hasSensitivity = food.food_sensitivities?.some(fs => 
              (restrictions.sensitivities || []).includes(fs.sensitivity_id)
          );
          if (hasSensitivity) return 'sensitivity';
      
          const hasConditionRecommend = food.food_medical_conditions?.some(fmc => 
              (restrictions.conditions || []).includes(fmc.condition_id) && fmc.relation_type === 'recommended'
          );
          if (hasConditionRecommend) return 'condition_recommend';
      
          return null;
        };

        const processedFoods = foodsRes.data.map(food => ({
          ...food,
          conflictType: getConflictTypeForFood(food, currentUserRestrictions)
        }));
        
        setAvailableFoods(processedFoods);
      } catch (error) {
        toast({ title: "Error", description: `No se pudieron cargar los datos iniciales: ${error.message}`, variant: "destructive" });
      }
    };

    if (open) {
      fetchInitialData();
    }
  }, [open, userId, toast]);

  useEffect(() => {
    if (open) {
      setMealDate(initialMealDate || new Date());
      setDayMealId(preselectedMealId ? String(preselectedMealId) : '');
      
      if (mealToEdit) {
        setName(mealToEdit.name || '');
        setInstructions(mealToEdit.instructions || '');
        setDayMealId(String(mealToEdit.day_meal_id || ''));
        const mappedIngredients = getRecipeIngredients(mealToEdit).map(ing => ({
          food_id: ing.food_id || `free-${ing.id}`,
          quantity: ing.grams ?? ing.quantity,
          food_name: ing.food?.name,
          is_free: !ing.food_id,
          is_user_created: !!ing.is_user_created || !!ing.food?.user_id,
        }));
        setIngredients(mappedIngredients);
      } else {
        setName('');
        setInstructions('');
        setIngredients([]);
      }
      
      setTimeout(() => {
        dayMealSelectRef.current?.focus();
      }, 100);

    }
  }, [open, initialMealDate, preselectedMealId, mealToEdit]);

  const conflictingIngredientsData = useMemo(() => {
      const conflicts = [];
      ingredients.forEach(ing => {
          if (ing.is_free) return;
          const food = availableFoods.find(f => String(f.id) === String(ing.food_id));
          if (!food || !food.conflictType) return;

          if (food.conflictType === 'condition_avoid') {
              const conflictingConditions = food.food_medical_conditions
                  .filter(fmc => fmc.relation_type === 'contraindicated' && userRestrictions.conditions.includes(fmc.condition_id))
                  .map(fmc => allConditions.find(c => c.id === fmc.condition_id)?.name)
                  .filter(Boolean);

              if (conflictingConditions.length > 0) {
                  conflicts.push({ id: `${food.id}-cond`, foodName: food.name, restrictionName: conflictingConditions.join(', '), isPathology: true });
              }
          }

          if (food.conflictType === 'sensitivity') {
              const conflictingSensitivities = food.food_sensitivities
                  .filter(fs => userRestrictions.sensitivities.includes(fs.sensitivity_id))
                  .map(fs => allSensitivities.find(s => s.id === fs.sensitivity_id)?.name)
                  .filter(Boolean);
              
              if (conflictingSensitivities.length > 0) {
                  conflicts.push({ id: `${food.id}-sens`, foodName: food.name, restrictionName: conflictingSensitivities.join(', '), isPathology: false });
              }
          }
      });
      return conflicts;
  }, [ingredients, availableFoods, userRestrictions, allSensitivities, allConditions]);

  const currentMacros = useMemo(() => {
    const validIngredients = ingredients.filter(i => !i.is_free);
    return calculateMacros(validIngredients.map(i => ({...i, grams: i.quantity})), availableFoods);
  }, [ingredients, availableFoods]);

  const targetMacros = useMemo(() => {
    if (!dayMealId) return null;
    return userDayMeals.find(udm => String(udm.day_meal.id) === String(dayMealId));
  }, [dayMealId, userDayMeals]);

  const handleSubmit = async () => {
    if (!dayMealId) { toast({ title: "Error", description: "Debes seleccionar un momento del día.", variant: "destructive" }); return; }
    if (!name.trim()) { toast({ title: "Error", description: "Debes darle un nombre a tu receta.", variant: "destructive" }); return; }
    if (ingredients.length === 0) { toast({ title: "Error", description: "Debes añadir al menos un ingrediente.", variant: "destructive" }); return; }
    if (ingredients.some(ing => !ing.food_id || !ing.quantity || isNaN(parseFloat(ing.quantity)) || parseFloat(ing.quantity) <= 0)) {
      toast({ title: "Error", description: "Todos los ingredientes deben tener un alimento y una cantidad válida.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const mealDateString = format(mealDate, 'yyyy-MM-dd');
      const { freeRecipe, ingredients: savedIngredients, occurrence, mealLog } = await persistFreeRecipeOccurrence({
        userId,
        dayMealId,
        mealDate: mealDateString,
        dietPlanId: mealToEdit?.diet_plan_id || null,
        recipeId: mealToEdit?.id || null,
        occurrenceId: mealToEdit?.occurrence_id || null,
        recipe: {
          name,
          instructions,
          prep_time_min: mealToEdit?.prep_time_min || null,
          difficulty: mealToEdit?.difficulty || null,
          status: FREE_RECIPE_STATUS.PENDING,
        },
        ingredients,
      });

      const enrichedIngredients = (savedIngredients || []).map((ing) => {
        const food = ing.food || availableFoods.find((f) => String(f.id) === String(ing.food_id));
        return {
          ...ing,
          quantity: ing.grams,
          food,
          is_user_created: !!food?.is_user_created || !!food?.user_id,
        };
      });

      const dayMeal = userDayMeals.find((udm) => String(udm.day_meal_id) === String(freeRecipe.day_meal_id))?.day_meal || null;
      const newFreeRecipeWithDetails = {
        ...freeRecipe,
        recipe_ingredients: enrichedIngredients,
        ingredients: enrichedIngredients,
        day_meal: dayMeal,
        occurrence_id: occurrence.id,
        meal_date: occurrence.meal_date,
        type: 'free_recipe',
        dnd_id: `free-${occurrence.id}`,
      };

      toast({ title: "Éxito", description: `Receta libre ${mealToEdit ? 'actualizada' : 'registrada'} correctamente.`, variant: "success" });
      if (onSaveSuccess) onSaveSuccess(mealLog, newFreeRecipeWithDetails);
      onOpenChange(false);
    } catch (error) {
      toast({ title: "Error", description: `No se pudo guardar la receta: ${error.message}`, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleEquivalence = () => toast({ title: "Próximamente...", description: "La funcionalidad de equivalencia para recetas libres estará disponible pronto. ¡Gracias por tu paciencia!", variant: "default" });

  const handleAddGroup = () => {
    const newGroup = {
      local_id: Date.now(),
      group_id: '',
      ingredients: [{ local_id: `ing-${Date.now()}`, food_id: '', quantity: 0 }]
    };
    // This function needs to be adapted to how ingredients are managed now, directly as a flat array.
    // A simple add would be:
    setIngredients(prev => [...prev, { local_id: `ing-${Date.now()}`, food_id: '', quantity: 0, food_group_id: null }])
  };


  return {
    isSubmitting,
    name, setName,
    instructions, setInstructions,
    ingredients, setIngredients,
    dayMealId, setDayMealId,
    mealDate, setMealDate,
    userRestrictions,
    availableFoods,
    userDayMeals,
    conflictingIngredientsData,
    currentMacros,
    targetMacros,
    dayMealSelectRef,
    handleSubmit,
    handleEquivalence,
    handleAddGroup,
  };
};
