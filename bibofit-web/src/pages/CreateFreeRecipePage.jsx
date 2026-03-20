import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import IngredientSearch from '@/components/plans/IngredientSearch';
import { useFreeRecipeDialog } from '@/components/plans/hooks/useFreeRecipeDialog';
import EquivalenceDialog from '@/components/plans/EquivalenceDialog';
import { calculateMacros } from '@/lib/macroCalculator';
import RecipeView from '@/components/shared/RecipeView';
import { useContextualGuide } from '@/contexts/ContextualGuideContext';
import { GUIDE_BLOCK_IDS } from '@/config/guideBlocks';

const EMPTY_RESTRICTIONS = {
  sensitivities: [],
  medical_conditions: [],
  preferred_foods: [],
  non_preferred_foods: [],
};

const toNumberOrNull = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeMealTargetMacros = (rawTargets) => {
  if (!rawTargets) return null;

  const proteins = toNumberOrNull(rawTargets.target_proteins ?? rawTargets.proteins);
  const carbs = toNumberOrNull(rawTargets.target_carbs ?? rawTargets.carbs);
  const fats = toNumberOrNull(rawTargets.target_fats ?? rawTargets.fats);
  const calories =
    toNumberOrNull(rawTargets.target_calories ?? rawTargets.calories) ??
    ((proteins || 0) * 4 + (carbs || 0) * 4 + (fats || 0) * 9);

  if (proteins === null && carbs === null && fats === null && calories === null) {
    return null;
  }

  return {
    target_calories: calories ?? 0,
    target_proteins: proteins ?? 0,
    target_carbs: carbs ?? 0,
    target_fats: fats ?? 0,
  };
};

const pickBestMealTargetRow = (rows, expectedDietPlanId) => {
  if (!Array.isArray(rows) || rows.length === 0) return null;

  if (expectedDietPlanId != null) {
    const exact = rows.find((row) => String(row?.diet_plan_id) === String(expectedDietPlanId));
    if (exact) return exact;
  }

  const scoreRow = (row) => {
    const p = toNumberOrNull(row?.target_proteins) || 0;
    const c = toNumberOrNull(row?.target_carbs) || 0;
    const f = toNumberOrNull(row?.target_fats) || 0;
    return p + c + f;
  };

  return [...rows].sort((a, b) => scoreRow(b) - scoreRow(a))[0] || null;
};

const CreateFreeRecipePage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { triggerBlock } = useContextualGuide();
  const navigate = useNavigate();
  const location = useLocation();
  const { date, mealId } = useParams();

  const initialTargetsFromState = useMemo(
    () => normalizeMealTargetMacros(location.state?.mealTargetMacros),
    [location.state?.mealTargetMacros]
  );

  const [view, setView] = useState('main'); // 'main', 'search'
  const [loadingInitialData, setLoadingInitialData] = useState(true);

  const [isEquivalenceDialogOpen, setIsEquivalenceDialogOpen] = useState(false);
  const [recipeForEquivalence, setRecipeForEquivalence] = useState(null);
  const [recipeNameForToast, setRecipeNameForToast] = useState('');
  const [availableFoods, setAvailableFoods] = useState([]);
  const [allVitamins, setAllVitamins] = useState([]);
  const [allMinerals, setAllMinerals] = useState([]);
  const [allFoodGroups, setAllFoodGroups] = useState([]);
  const [recipeStyles, setRecipeStyles] = useState([]);
  const [userRestrictions, setUserRestrictions] = useState(EMPTY_RESTRICTIONS);
  const [dietPlanId, setDietPlanId] = useState(null);
  const [mealTargetMacros, setMealTargetMacros] = useState(initialTargetsFromState);
  const hasTriggeredAutobalanceGuideRef = useRef(false);

  const targetUserId = user?.id;

  useEffect(() => {
    if (initialTargetsFromState) {
      setMealTargetMacros(initialTargetsFromState);
    }
  }, [initialTargetsFromState]);

  const handleSaveSuccess = (newLog, newFreeMealWithOccurrence) => {
    setRecipeNameForToast(newFreeMealWithOccurrence.name);
    const recipeMacros = calculateMacros(newFreeMealWithOccurrence.recipe_ingredients, availableFoods);

    const recipeForDialog = {
      id: newFreeMealWithOccurrence.id,
      user_id: newFreeMealWithOccurrence.user_id,
      meal_date: newFreeMealWithOccurrence.meal_date,
      day_meal_id: newFreeMealWithOccurrence.day_meal_id,
      name: newFreeMealWithOccurrence.name,
      instructions: newFreeMealWithOccurrence.instructions,
      ingredients: newFreeMealWithOccurrence.recipe_ingredients,
      occurrence_id: newFreeMealWithOccurrence.occurrence_id,
      free_recipe: { id: newFreeMealWithOccurrence.id },
    };

    setRecipeForEquivalence({
      item: recipeForDialog,
      macros: recipeMacros,
      logId: newLog.id,
    });
    setIsEquivalenceDialogOpen(true);
  };

  const {
    recipeName,
    ingredients,
    recipeForView,
    macros,
    handleRecipeFormChange,
    handleIngredientsChange,
    handleIngredientAdded,
    handleRemoveIngredient,
    handleSave,
    isSaving,
    hasSavedDraft,
  } = useFreeRecipeDialog({
    targetUserId,
    dayMealId: mealId,
    dietPlanId,
    date,
    onSuccess: handleSaveSuccess,
    availableFoods,
  });

  const handleEquivalenceSuccess = () => {
    setIsEquivalenceDialogOpen(false);
    setRecipeForEquivalence(null);
    toast({ title: 'Éxito', description: `Receta "${recipeNameForToast}" creada y equivalencia aplicada.`, variant: 'success' });
    navigate(`/plan/dieta/${date}`);
  };

  const handleEquivalenceDialogClose = (isOpen) => {
    if (!isOpen && recipeForEquivalence) {
      setIsEquivalenceDialogOpen(false);
      setRecipeForEquivalence(null);
      toast({ title: 'Éxito', description: `Receta "${recipeNameForToast}" creada y añadida al plan.`, variant: 'success' });
      navigate(`/plan/dieta/${date}`);
    } else {
      setIsEquivalenceDialogOpen(isOpen);
    }
  };

  const fetchInitialData = useCallback(async () => {
    if (!targetUserId || !date || !mealId) return;

    setLoadingInitialData(true);
    try {
      const [
        foodsRes,
        userFoodsRes,
        restrictionsRes,
        preferredFoodsRes,
        nonPreferredFoodsRes,
        recipeStylesRes,
        vitaminsRes,
        mineralsRes,
        foodGroupsRes,
        planRes,
      ] = await Promise.all([
        supabase
          .from('food')
          .select('*, food_sensitivities(sensitivity:sensitivities(id, name)), food_medical_conditions(relation_type, condition:medical_conditions(id, name)), food_to_food_groups(food_group_id, food_group:food_groups(id, name)), food_vitamins(vitamin_id, vitamins(id, name)), food_minerals(mineral_id, minerals(id, name))')
          .is('user_id', null),
        supabase
          .from('food')
          .select('*, food_sensitivities(sensitivity:sensitivities(id, name)), food_medical_conditions(relation_type, condition:medical_conditions(id, name)), food_to_food_groups(food_group_id, food_group:food_groups(id, name)), food_vitamins(vitamin_id, vitamins(id, name)), food_minerals(mineral_id, minerals(id, name))')
          .eq('user_id', targetUserId)
          .neq('status', 'rejected'),
        supabase.rpc('get_user_restrictions', { p_user_id: targetUserId }),
        supabase.from('preferred_foods').select('food(*)').eq('user_id', targetUserId),
        supabase.from('non_preferred_foods').select('food(*)').eq('user_id', targetUserId),
        supabase.from('recipe_styles').select('id, name').eq('is_active', true).order('display_order').order('name'),
        supabase.from('vitamins').select('id, name'),
        supabase.from('minerals').select('id, name'),
        supabase.from('food_groups').select('id, name'),
        supabase
          .from('diet_plans')
          .select('id')
          .eq('user_id', targetUserId)
          .lte('start_date', date)
          .gte('end_date', date)
          .eq('is_active', true)
          .maybeSingle(),
      ]);

      if (
        foodsRes.error ||
        userFoodsRes.error ||
        restrictionsRes.error ||
        preferredFoodsRes.error ||
        nonPreferredFoodsRes.error ||
        recipeStylesRes.error ||
        vitaminsRes.error ||
        mineralsRes.error ||
        foodGroupsRes.error
      ) {
        throw new Error(
          foodsRes.error?.message ||
            userFoodsRes.error?.message ||
            restrictionsRes.error?.message ||
            preferredFoodsRes.error?.message ||
            nonPreferredFoodsRes.error?.message ||
            recipeStylesRes.error?.message ||
            vitaminsRes.error?.message ||
            mineralsRes.error?.message ||
            foodGroupsRes.error?.message ||
            'No se pudo cargar la información inicial.'
        );
      }

      if (planRes.error) {
        console.error('Error fetching active diet plan:', planRes.error);
      }

      const resolvedDietPlanId = planRes.data?.id || null;
      setDietPlanId(resolvedDietPlanId);

      if (!initialTargetsFromState) {
        const { data: mealTargetRows, error: mealTargetsError } = await supabase
          .from('user_day_meals')
          .select('diet_plan_id, target_calories, target_proteins, target_carbs, target_fats')
          .eq('user_id', targetUserId)
          .eq('day_meal_id', Number(mealId));

        if (mealTargetsError) {
          console.error('Error fetching meal target macros:', mealTargetsError);
        } else {
          const pickedTargets = pickBestMealTargetRow(mealTargetRows || [], resolvedDietPlanId);
          setMealTargetMacros(normalizeMealTargetMacros(pickedTargets));
        }
      }

      const publicFoods = (foodsRes.data || []).map((food) => ({ ...food, is_user_created: false }));
      const userFoods = (userFoodsRes.data || []).map((food) => ({ ...food, is_user_created: true }));

      setAvailableFoods([...publicFoods, ...userFoods]);
      setAllVitamins(vitaminsRes.data || []);
      setAllMinerals(mineralsRes.data || []);
      setAllFoodGroups(foodGroupsRes.data || []);
      setRecipeStyles(recipeStylesRes.data || []);

      const finalRestrictions = {
        ...(restrictionsRes.data || {}),
        preferred_foods: (preferredFoodsRes.data || []).map((item) => item.food).filter(Boolean),
        non_preferred_foods: (nonPreferredFoodsRes.data || []).map((item) => item.food).filter(Boolean),
      };
      setUserRestrictions(finalRestrictions);
    } catch (error) {
      console.error('Error fetching initial data for CreateFreeRecipePage:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los datos necesarios para crear la receta.',
        variant: 'destructive',
      });
    } finally {
      setLoadingInitialData(false);
    }
  }, [targetUserId, date, mealId, toast, initialTargetsFromState]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    if (!date || !mealId) {
      toast({
        title: 'Error',
        description: 'Falta información. Vuelve al plan e inténtalo de nuevo.',
        variant: 'destructive',
      });
      navigate('/plan/dieta');
    }
  }, [date, mealId, navigate, toast]);

  useEffect(() => {
    if (view !== 'main') return;
    if (loadingInitialData) return;
    if (ingredients.length === 0) return;
    if (hasTriggeredAutobalanceGuideRef.current) return;

    hasTriggeredAutobalanceGuideRef.current = true;
    triggerBlock(GUIDE_BLOCK_IDS.FREE_RECIPE_AUTOBALANCE);
  }, [ingredients.length, loadingInitialData, triggerBlock, view]);

  const handleLocalIngredientAdded = (newIngredient) => {
    handleIngredientAdded(newIngredient);
    setView('main');
  };

  const getTitle = () => {
    if (view === 'search') return 'Añadir Ingrediente';
    return 'Crear Receta Libre';
  };

  const handleBack = () => {
    if (view === 'search') {
      setView('main');
    } else {
      navigate(`/plan/dieta/${date}`);
    }
  };

  return (
    <>
      <Helmet>
        <title>Crear Receta Libre - Gsus Martz</title>
        <meta name="description" content="Crea y añade una receta libre a tu plan de dieta." />
      </Helmet>

      <div className="container mx-auto max-w-4xl pt-0 pb-0 px-0 sm:pt-8 sm:pb-8 sm:px-4">
        <Card className="bg-card/75 dark:bg-[#0C101D] border-border text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-3xl font-bold text-green-400">
              <Button variant="ghost" size="icon" onClick={handleBack} className="text-muted-foreground hover:text-foreground hover:bg-muted shrink-0">
                <ArrowLeft size={22} />
              </Button>
              {getTitle()}
            </CardTitle>
            {view === 'main' && hasSavedDraft && (
              <div className="flex items-center gap-2 text-xs text-green-400">
                <CheckCircle2 size={12} />
                Borrador guardado
              </div>
            )}
          </CardHeader>

          <CardContent>
            {loadingInitialData ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-12 w-12 animate-spin text-green-500" />
              </div>
            ) : view === 'search' ? (
              <IngredientSearch
                selectedIngredients={ingredients}
                onIngredientAdded={handleLocalIngredientAdded}
                availableFoods={availableFoods}
                userRestrictions={userRestrictions}
                createFoodUserId={targetUserId}
                onBack={() => setView('main')}
              />
            ) : (
              <RecipeView
                recipe={recipeForView}
                allFoods={availableFoods}
                allVitamins={allVitamins}
                allMinerals={allMinerals}
                allFoodGroups={allFoodGroups}
                macros={macros}
                mealTargetMacros={mealTargetMacros}
                targetUserId={targetUserId}
                userRestrictions={userRestrictions || EMPTY_RESTRICTIONS}
                recipeStyles={recipeStyles}
                isEditing={true}
                onFormChange={handleRecipeFormChange}
                onIngredientsChange={handleIngredientsChange}
                onRemoveIngredient={handleRemoveIngredient}
                onAddIngredientClick={() => setView('search')}
                showImageUpload={false}
              />
            )}
          </CardContent>

          {view === 'main' && (
            <CardFooter>
              <Button
                onClick={handleSave}
                disabled={isSaving || !recipeName?.trim() || ingredients.length === 0}
                className="w-full bg-green-600 hover:bg-green-700 py-6 text-lg"
              >
                {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                Guardar Receta
              </Button>
            </CardFooter>
          )}
        </Card>
      </div>

      {recipeForEquivalence && (
        <EquivalenceDialog
          open={isEquivalenceDialogOpen}
          onOpenChange={handleEquivalenceDialogClose}
          sourceItem={recipeForEquivalence.item}
          sourceItemType="free_recipe"
          sourceItemMacros={recipeForEquivalence.macros}
          sourceLogId={recipeForEquivalence.logId}
          onSuccess={handleEquivalenceSuccess}
        />
      )}
    </>
  );
};

export default CreateFreeRecipePage;
