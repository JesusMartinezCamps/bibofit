import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  ChefHat,
  Clock,
  Loader2,
  Minus,
  PlusCircle,
  Plus,
  UtensilsCrossed,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import IngredientSearch from '@/components/plans/IngredientSearch';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { invokeAutoBalanceRecipe } from '@/lib/autoBalanceClient';
import RecipeImageUpload from '@/components/admin/recipes/RecipeImageUpload';
import EditableField from '@/components/shared/recipe-view/EditableField';
import IngredientCard from '@/components/shared/recipe-view/IngredientCard';
import IngredientQuickEditDialog from '@/components/shared/recipe-view/IngredientQuickEditDialog';
import { MacroSummaryGrid, MacroTargetGrid } from '@/components/shared/recipe-view/MacroSummaryGrid';
import {
  buildIngredientsWithDetails,
  calculateRecipeConflicts,
  resolveRecipeImageUrl,
} from '@/components/shared/recipe-view/recipeViewUtils';
import { resolveRecipeStyleId, resolveRecipeStyleName } from '@/lib/recipeStyles';

const clampMultiplier = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(20, Math.max(1, Math.round(parsed)));
};

const scaleMacrosByMultiplier = (macros, multiplier) => {
  if (!macros) return macros;
  return {
    calories: (macros.calories || 0) * multiplier,
    proteins: (macros.proteins || 0) * multiplier,
    carbs: (macros.carbs || 0) * multiplier,
    fats: (macros.fats || 0) * multiplier,
  };
};

const toNumberOrNull = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeTargets = (rawTargets) => {
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

const pickBestTargetsRow = (rows, expectedDietPlanId) => {
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

const RecipeView = ({
  recipe,
  allFoods,
  allVitamins,
  allMinerals,
  allFoodGroups,
  macros: totalMacros,
  isFreeMealView = false,
  conflicts: propConflicts,
  recommendations: propRecommendations,
  userRestrictions: propUserRestrictions,
  isEditing = false,
  onFormChange,
  onIngredientsChange,
  onRemoveIngredient,
  onAddIngredientClick,
  actionButton,
  mealTargetMacros,
  targetUserId,
  disableAutoBalance = false,
  onAutoBalanceBlocked,
  enableStickyMacros = true,
  headerSlot = null,
  isTemplate = false,
  quickEditIngredientKey = null,
  onQuickEditConsumed,
  showImageUpload = false,
  imageUploadValue = null,
  onImageUploadChange,
  imageUploadDisabled = false,
  showMetaFields = true,
  showPreparationSection = true,
  onFoodCreated,
  recipeStyles = null,
  isConflictCorrectionMode = false,
  hideMacrosTitle = false,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [internalRestrictions, setInternalRestrictions] = useState(null);
  const [loadingRestrictions, setLoadingRestrictions] = useState(false);
  const [isBalancing, setIsBalancing] = useState(false);
  const [fetchedTargets, setFetchedTargets] = useState(null);
  const [replacingIngredient, setReplacingIngredient] = useState(null);
  const [quantityEditorIngredient, setQuantityEditorIngredient] = useState(null);
  const [servingMultiplier, setServingMultiplier] = useState(1);
  const [showMultiplierEasterEgg, setShowMultiplierEasterEgg] = useState(false);
  const [internalRecipeStyles, setInternalRecipeStyles] = useState([]);

  const safeFoods = allFoods || [];
  const safeVitamins = allVitamins || [];
  const safeMinerals = allMinerals || [];
  const safeFoodGroups = allFoodGroups || [];
  const safeRecipeStyles =
    Array.isArray(recipeStyles) && recipeStyles.length > 0
      ? recipeStyles
      : internalRecipeStyles;

  const recipeStyleId = useMemo(() => resolveRecipeStyleId(recipe), [recipe]);
  const recipeStyleName = useMemo(
    () => resolveRecipeStyleName(recipe, safeRecipeStyles),
    [recipe, safeRecipeStyles]
  );

  const recipeImageUrl = useMemo(() => resolveRecipeImageUrl(recipe), [recipe]);
  const normalizedProvidedTargets = useMemo(() => normalizeTargets(mealTargetMacros), [mealTargetMacros]);
  const resolvedTargetUserId = targetUserId || recipe?.user_id || user?.id || null;
  const resolvedDayMealId = recipe?.day_meal_id ?? recipe?.day_meal?.id ?? null;
  const resolvedDietPlanId = recipe?.diet_plan_id ?? recipe?.diet_plan?.id ?? null;
  const scaledTotalMacros = useMemo(
    () => scaleMacrosByMultiplier(totalMacros, servingMultiplier),
    [totalMacros, servingMultiplier]
  );

  useEffect(() => {
    setServingMultiplier(1);
  }, [recipe?.id, recipe?.name, recipe?.updated_at, recipe?.created_at]);

  useEffect(() => {
    if (!showMultiplierEasterEgg) return;
    const timeoutId = setTimeout(() => setShowMultiplierEasterEgg(false), 2000);
    return () => clearTimeout(timeoutId);
  }, [showMultiplierEasterEgg]);

  useEffect(() => {
    if (Array.isArray(recipeStyles) && recipeStyles.length > 0) return;

    const fetchRecipeStyles = async () => {
      try {
        const { data, error } = await supabase
          .from('recipe_styles')
          .select('id, name')
          .eq('is_active', true)
          .order('display_order', { ascending: true })
          .order('name', { ascending: true });

        if (error) {
          console.error('Error fetching recipe styles:', error);
          return;
        }
        setInternalRecipeStyles(data || []);
      } catch (err) {
        console.error('Error fetching recipe styles:', err);
      }
    };

    fetchRecipeStyles();
  }, [recipeStyles]);

  useEffect(() => {
    if (normalizedProvidedTargets || !resolvedTargetUserId || !resolvedDayMealId || isTemplate) return;

    const fetchTargets = async () => {
      try {
        const { data, error } = await supabase
          .from('user_day_meals')
          .select('diet_plan_id, target_calories, target_proteins, target_carbs, target_fats')
          .eq('user_id', resolvedTargetUserId)
          .eq('day_meal_id', resolvedDayMealId);

        if (error) {
          console.error('Error fetching meal targets:', error);
          return;
        }

        const picked = pickBestTargetsRow(data || [], resolvedDietPlanId);
        if (picked) {
          setFetchedTargets(normalizeTargets(picked));
        } else {
          setFetchedTargets(null);
        }
      } catch (err) {
        console.error('Error fetching targets:', err);
      }
    };

    fetchTargets();
  }, [normalizedProvidedTargets, resolvedTargetUserId, resolvedDayMealId, resolvedDietPlanId, isTemplate]);

  useEffect(() => {
    if (propConflicts || propUserRestrictions || !user) return;

    const fetchRestrictions = async () => {
      setLoadingRestrictions(true);
      try {
        const [restrictionsRes, prefRes, nonPrefRes] = await Promise.all([
          supabase.rpc('get_user_restrictions', { p_user_id: user.id }),
          supabase.from('preferred_foods').select('food(id, name)').eq('user_id', user.id),
          supabase.from('non_preferred_foods').select('food(id, name)').eq('user_id', user.id),
        ]);

        setInternalRestrictions({
          ...(restrictionsRes.data || {}),
          preferred_foods: (prefRes.data || []).map((p) => p.food).filter(Boolean),
          non_preferred_foods: (nonPrefRes.data || []).map((np) => np.food).filter(Boolean),
        });
      } catch (err) {
        console.error('Error fetching user restrictions for recipe view:', err);
      } finally {
        setLoadingRestrictions(false);
      }
    };

    fetchRestrictions();
  }, [user, propConflicts, propUserRestrictions]);

  const { conflicts, recommendations } = useMemo(() => {
    const hasGranularPropConflicts =
      Array.isArray(propConflicts) &&
      propConflicts.some((c) => c && c.foodId !== undefined && c.foodId !== null);

    if (hasGranularPropConflicts) {
      return { conflicts: propConflicts, recommendations: propRecommendations || [] };
    }

    return calculateRecipeConflicts({
      recipe,
      allFoods: safeFoods,
      activeRestrictions: propUserRestrictions || internalRestrictions,
    });
  }, [recipe, propConflicts, propRecommendations, propUserRestrictions, internalRestrictions, safeFoods]);

  const ingredientsWithDetails = useMemo(
    () =>
      buildIngredientsWithDetails({
        recipe,
        allFoods: safeFoods,
        allVitamins: safeVitamins,
        allMinerals: safeMinerals,
        allFoodGroups: safeFoodGroups,
        conflicts,
        recommendations,
      }),
    [recipe, safeFoods, safeVitamins, safeMinerals, safeFoodGroups, conflicts, recommendations]
  );

  useEffect(() => {
    if (!quickEditIngredientKey || !ingredientsWithDetails.length) return;

    const target = ingredientsWithDetails.find(
      (ing) => String(ing.local_id || ing.id) === String(quickEditIngredientKey)
    );

    if (target) {
      setQuantityEditorIngredient(target);
      if (onQuickEditConsumed) onQuickEditConsumed();
    }
  }, [quickEditIngredientKey, ingredientsWithDetails, onQuickEditConsumed]);

  const handleQuantityChange = (ingredient, newQuantity) => {
    const targetIndex = ingredient.originalIndex;
    if (targetIndex !== undefined && targetIndex !== null) {
      const newIngredients = [...(recipe?.ingredients || [])];
      if (newIngredients[targetIndex]) {
        newIngredients[targetIndex] = {
          ...newIngredients[targetIndex],
          grams: newQuantity,
          quantity: newQuantity,
        };
        onIngredientsChange(newIngredients);
      }
      return;
    }

    const identifier = ingredient.local_id || ingredient.id;
    const newIngredients = (recipe?.ingredients || []).map((ing) =>
      (ing.local_id || ing.id) === identifier
        ? { ...ing, grams: newQuantity, quantity: newQuantity }
        : ing
    );
    onIngredientsChange(newIngredients);
  };

  const handleAutoBalance = async () => {
    const activeTargets = normalizedProvidedTargets || fetchedTargets;
    const targetValues = [
      Number(activeTargets?.target_proteins),
      Number(activeTargets?.target_carbs),
      Number(activeTargets?.target_fats),
    ];
    const hasMissingTargets = targetValues.some((value) => !Number.isFinite(value));
    const hasAnyPositiveTarget = targetValues.some((value) => value > 0);

    if (!activeTargets || hasMissingTargets || !hasAnyPositiveTarget) {
      toast({
        title: 'Objetivos no definidos',
        description: 'No se encontraron objetivos de macros validos.',
        variant: 'destructive',
      });
      return;
    }

    setIsBalancing(true);
    try {
      const ingredientsForFunction = (recipe?.ingredients || [])
        .map((ing) => ({
          food_id: Number(ing.food_id || ing.food?.id),
          quantity: Number(ing.grams || ing.quantity) || 0,
          locked: !!ing.locked,
        }))
        .filter((ing) => ing.food_id);

      const data = await invokeAutoBalanceRecipe({
        ingredients: ingredientsForFunction,
        targets: activeTargets,
      });

      if (!data.balancedIngredients) {
        throw new Error(data.error || 'Respuesta inesperada.');
      }

      const newIngredients = (recipe?.ingredients || []).map((ing) => {
        const balanced = data.balancedIngredients.find(
          (b) => String(b.food_id) === String(ing.food_id || ing.food?.id)
        );
        if (balanced) return { ...ing, grams: balanced.quantity, quantity: balanced.quantity };
        return ing;
      });

      onIngredientsChange(newIngredients);
      toast({
        title: 'Receta autocuadrada',
        description: 'Se han ajustado las cantidades.',
        className: 'bg-cyan-600/25 text-white border-none backdrop-blur-md',
      });
    } catch (error) {
      console.error('Auto-balance error:', error);
      toast({ title: 'Error al autocuadrar', description: error.message, variant: 'destructive' });
    } finally {
      setIsBalancing(false);
    }
  };

  const handleQuickEditSave = ({ quantity, food, locked }) => {
    if (!quantityEditorIngredient) return;

    const hasFoodChanged =
      food &&
      String(food.id) !== String(quantityEditorIngredient.food_id || quantityEditorIngredient.food?.id);

    if (!hasFoodChanged) {
      // Actualiza cantidad y estado de candado en el ingrediente existente
      const targetIndex = quantityEditorIngredient.originalIndex;
      if (targetIndex !== undefined && targetIndex !== null) {
        const newIngredients = [...(recipe?.ingredients || [])];
        if (newIngredients[targetIndex]) {
          newIngredients[targetIndex] = {
            ...newIngredients[targetIndex],
            grams: quantity,
            quantity,
            locked: !!locked,
          };
          onIngredientsChange(newIngredients);
        }
      } else {
        const identifier = quantityEditorIngredient.local_id || quantityEditorIngredient.id;
        const newIngredients = (recipe?.ingredients || []).map((ing) =>
          (ing.local_id || ing.id) === identifier
            ? { ...ing, grams: quantity, quantity, locked: !!locked }
            : ing
        );
        onIngredientsChange(newIngredients);
      }
      setQuantityEditorIngredient(null);
      return;
    }

    const replacementIngredient = {
      local_id: quantityEditorIngredient.local_id || quantityEditorIngredient.id || crypto.randomUUID(),
      food_id: food.id,
      grams: quantity,
      quantity,
      locked: !!locked,
      food_group_id: food?.food_to_food_groups?.[0]?.food_group_id || null,
      food,
    };

    const targetIndex = quantityEditorIngredient.originalIndex;
    if (targetIndex !== undefined && targetIndex !== null && recipe?.ingredients?.[targetIndex]) {
      const newIngredients = [...recipe.ingredients];
      newIngredients[targetIndex] = replacementIngredient;
      onIngredientsChange(newIngredients);
    } else {
      const identifier = quantityEditorIngredient.local_id || quantityEditorIngredient.id;
      const newIngredients = (recipe?.ingredients || []).map((ing) =>
        (ing.local_id || ing.id) === identifier ? replacementIngredient : ing
      );
      onIngredientsChange(newIngredients);
    }

    toast({ title: 'Ingrediente actualizado', description: `Se cambio por ${food.name}.` });
    setQuantityEditorIngredient(null);
  };

  const handleReplaceSelection = (newFoodData) => {
    if (!replacingIngredient) return;

    const newIngredient = {
      local_id: replacingIngredient.local_id || replacingIngredient.id || crypto.randomUUID(),
      food_id: newFoodData.food_id,
      grams: newFoodData.quantity || 100,
      quantity: newFoodData.quantity || 100,
      food_group_id:
        safeFoods.find((f) => String(f.id) === String(newFoodData.food_id))?.food_to_food_groups?.[0]
          ?.food_group_id || null,
    };

    const targetIndex = replacingIngredient.originalIndex;
    if (targetIndex !== undefined && targetIndex !== null && recipe?.ingredients?.[targetIndex]) {
      const newIngredients = [...recipe.ingredients];
      newIngredients[targetIndex] = newIngredient;
      onIngredientsChange(newIngredients);
    } else {
      const identifier = replacingIngredient.local_id || replacingIngredient.id;
      const newIngredients = (recipe?.ingredients || []).map((ing) =>
        (ing.local_id || ing.id) === identifier ? newIngredient : ing
      );
      onIngredientsChange(newIngredients);
    }

    setReplacingIngredient(null);
    toast({ title: 'Ingrediente reemplazado', description: `Se ha sustituido por ${newFoodData.food_name}.` });
  };

  const redCount = conflicts.length;
  const hasIngredients = (recipe?.ingredients || []).length > 0;
  const canManageIngredientsInView = !!onIngredientsChange && !!onRemoveIngredient;
  const resolvedTargets = normalizedProvidedTargets || fetchedTargets;
  const showAutoBalance =
    hasIngredients &&
    !!(resolvedTargets || resolvedDayMealId) &&
    (isEditing || canManageIngredientsInView);
  const canRenderNativeImageUpload = showImageUpload && typeof onImageUploadChange === 'function';
  const isMultiplierActive = servingMultiplier !== 1;
  const shouldShowMetaFields = showMetaFields && !isConflictCorrectionMode;
  const shouldShowPreparationSection = showPreparationSection && !isConflictCorrectionMode;
  const handleIncreaseMultiplier = () => {
    setServingMultiplier((prev) => {
      if (prev >= 20) {
        setShowMultiplierEasterEgg(true);
        return prev;
      }
      return clampMultiplier(prev + 1);
    });
  };

  if (replacingIngredient) {
    return (
      <div className="h-full p-4 md:p-6">
        <IngredientSearch
          selectedIngredients={recipe?.ingredients || []}
          onIngredientAdded={handleReplaceSelection}
          availableFoods={safeFoods}
          userRestrictions={propUserRestrictions || internalRestrictions}
          onFoodCreated={onFoodCreated}
          createFoodUserId={recipe?.user_id || user?.id}
          onBack={() => setReplacingIngredient(null)}
        />
      </div>
    );
  }

  if (!recipe) return null;

  if (loadingRestrictions) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'text-foreground dark:text-white dark:bg-[#0C101D] space-y-6',
        isConflictCorrectionMode ? 'py-2 px-0 sm:px-0 md:px-0' : 'p-2 sm:p-4 md:p-6'
      )}
    >
      <div className="text-center mt-6 relative z-10">
        {recipeImageUrl && (
          <div
            data-recipe-hero-image-wrapper
            className="mb-4 overflow-hidden rounded-xl border border-border/70 bg-card/85"
          >
            <img
              data-recipe-hero-image
              src={recipeImageUrl}
              alt={`Imagen de ${recipe.name || 'receta'}`}
              className="w-full h-44 sm:h-56 object-cover"
              loading="lazy"
            />
          </div>
        )}

        {isEditing ? (
          <div data-recipe-title-anchor>
            <EditableField
              value={recipe.name}
              onChange={(e) => onFormChange({ target: { name: 'name', value: e.target.value } })}
              isEditing
              placeholder="Nombre de la Receta"
              type="textarea"
              textareaRows={1}
              textareaMinHeight="1.2em"
              className="text-3xl font-bold leading-tight whitespace-pre-wrap break-normal resize-none text-center w-full"
            />
          </div>
        ) : (
          <>
            <div data-recipe-title-anchor>
              <h2 className="text-3xl font-bold text-center break-words bg-clip-text text-transparent bg-gradient-to-r from-emerald-700 to-teal-700 dark:from-green-300 dark:to-teal-400">
                {recipe.name}
              </h2>
            </div>
            <div className="flex justify-center gap-3 mt-2">
              {redCount > 0 && (
                <span className="flex items-center text-sm text-red-400 gap-1.5 bg-red-900/20 px-2 py-1 rounded-full border border-red-500/30">
                  <AlertTriangle className="w-4 h-4" /> {redCount} Conflictos
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {isTemplate && (
        <div className="flex justify-center -mt-2 mb-4 relative z-10">
          <Badge variant="outline" className="border-purple-500 text-purple-400 bg-purple-900/20">
            Modo Plantilla
          </Badge>
        </div>
      )}
      {isConflictCorrectionMode && (
        <div className="flex justify-center -mt-2 mb-4 relative z-10">
          <Badge variant="outline" className="border-amber-500 text-amber-300 bg-amber-900/20">
            Modo correccion de conflictos
          </Badge>
        </div>
      )}

      {canRenderNativeImageUpload && (
        <div className="relative z-10">
          <RecipeImageUpload
            value={imageUploadValue}
            onChange={onImageUploadChange}
            disabled={imageUploadDisabled}
          />
        </div>
      )}

      {headerSlot && <div className="relative z-10">{headerSlot}</div>}

      <div
        className={cn(
          enableStickyMacros &&
            (isConflictCorrectionMode
              ? 'sticky top-0 bg-card/95 dark:bg-[#0C101D] px-0 sm:px-0 md:px-0 py-2 shadow-xl border-b border-border/60 mb-4'
              : 'sticky top-0 bg-card/95 dark:bg-[#0C101D] -mx-2 px-2 sm:-mx-4 sm:px-4 md:-mx-6 md:px-6 py-2 shadow-xl border-b border-border/60 mb-4'),
          'z-30'
        )}
      >
        {!hideMacrosTitle && (
          <h3 className="text-xl font-semibold mb-3 border-b border-border pb-2 bg-clip-text text-transparent bg-gradient-to-r from-emerald-700 to-teal-700 dark:from-green-300 dark:to-teal-400">
            Macros Totales
          </h3>
        )}
        <MacroSummaryGrid macros={scaledTotalMacros} />
        {isEditing && resolvedTargets && !isTemplate && (
          <div className="mt-4">
            <h4 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
              Macros Objetivo
            </h4>
            <MacroTargetGrid targets={resolvedTargets} />
          </div>
        )}
      </div>

      {!isEditing && (
        <div className="relative z-10 flex flex-col items-center">
          <div className="text-sm font-semibold text-foreground mb-1 text-center">Multiplicador</div>
          <div className="flex items-center justify-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 border-input bg-card/80 hover:bg-muted hover:text-muted-foreground text-foreground dark:text-gray-200 shrink-0"
              onClick={() => setServingMultiplier((prev) => clampMultiplier(prev - 1))}
              disabled={servingMultiplier <= 1}
            >
              <Minus className="w-4 h-4" />
            </Button>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none">x</span>
              <Input
                type="number"
                min={1}
                max={20}
                value={servingMultiplier}
                onChange={(e) => setServingMultiplier(clampMultiplier(e.target.value))}
                className="h-9 w-12 text-center pl-4 pr-1 input-field bg-transparent border-dashed font-semibold"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 border-input bg-card/80 hover:bg-muted hover:text-muted-foreground text-foreground dark:text-gray-200 shrink-0"
              onClick={handleIncreaseMultiplier}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div
            className={cn(
              'absolute -top-8 left-1/2 -translate-x-1/2 rounded-md bg-card/95 border border-cyan-500/30 px-2 py-1 text-[11px] text-cyan-100 whitespace-nowrap shadow-lg transition-all duration-200',
              showMultiplierEasterEgg ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
            )}
          >
            ¡Pero bueno! Suficiente comida así...
          </div>
        </div>
      )}

      <div className="relative z-10">
        <div className="flex justify-between items-center mb-3 border-b border-border pb-2">
          <h3 className="text-xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-emerald-700 to-teal-700 dark:from-green-300 dark:to-teal-400">
            Ingredientes
          </h3>
          {onAddIngredientClick && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onAddIngredientClick}
              className="text-green-700 dark:text-green-300 hover:bg-green-500/10 hover:text-green-800 dark:hover:text-green-200"
            >
              <PlusCircle className="w-6 h-6" />
            </Button>
          )}
        </div>

        <div className="space-y-4">
          {isEditing && isMultiplierActive && (
            <p className="text-xs text-cyan-700 dark:text-cyan-200/80 rounded-md border border-cyan-500/35 dark:border-cyan-500/20 bg-cyan-500/10 dark:bg-cyan-500/5 px-3 py-2">
              En edicion, las cantidades se guardan en base x1. El multiplicador solo ajusta la vista para cocinar.
            </p>
          )}
          {isEditing ? (
            ingredientsWithDetails.length > 0 ? (
              <div className="space-y-3">
                {ingredientsWithDetails.map((ing, index) => (
                  <IngredientCard
                    key={ing.local_id || `${ing.food_id}-${index}`}
                    ingredient={ing}
                    isFreeMealView={isFreeMealView}
                    isEditing
                    onRemove={onRemoveIngredient ? () => onRemoveIngredient(ing) : undefined}
                    onReplace={() => setReplacingIngredient(ing)}
                    onQuantityChange={(e) => handleQuantityChange(ing, e.target.value)}
                    allFoodGroups={safeFoodGroups}
                    multiplier={servingMultiplier}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-10 border-2 border-dashed border-border rounded-lg">
                <p className="text-muted-foreground">No hay ingredientes en esta receta.</p>
                <p className="text-muted-foreground mt-2">
                  Haz clic en el <PlusCircle className="inline w-4 h-4 mx-1" /> para anadir el primero.
                </p>
              </div>
            )
          ) : (
            <ul className="space-y-0">
              {ingredientsWithDetails.length > 0 ? (
                ingredientsWithDetails.map((ing, index) => (
                  <IngredientCard
                    key={ing.local_id || `${ing.food_id}-${index}`}
                    ingredient={ing}
                    isFreeMealView={isFreeMealView}
                    isEditing={false}
                    displayAsBullet
                    allFoodGroups={safeFoodGroups}
                    onRemove={canManageIngredientsInView ? () => onRemoveIngredient(ing) : undefined}
                    onReplace={canManageIngredientsInView ? () => setReplacingIngredient(ing) : undefined}
                    onQuickEdit={canManageIngredientsInView ? () => setQuantityEditorIngredient(ing) : undefined}
                    multiplier={servingMultiplier}
                  />
                ))
              ) : (
                <div className="text-center py-10 border-2 border-dashed border-border rounded-lg">
                  <p className="text-muted-foreground">No hay ingredientes en esta receta.</p>
                </div>
              )}
            </ul>
          )}

          {showAutoBalance && resolvedTargets && (
            <div className="mt-4 pt-2 border-t border-border">
              <Button
                type="button"
                onClick={() => {
                  if (disableAutoBalance && onAutoBalanceBlocked) {
                    onAutoBalanceBlocked();
                    return;
                  }
                  handleAutoBalance();
                }}
                disabled={isBalancing || (disableAutoBalance && !onAutoBalanceBlocked)}
                variant="outline"
                className="w-full bg-muted border-cyan-500 bg-cyan-400/10 text-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-300 mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isBalancing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Bot className="w-4 h-4 mr-2" />
                )}
                Autocuadrar Macros
              </Button>
            </div>
          )}
        </div>
      </div>

      {actionButton && <div className="my-4 relative z-10">{actionButton}</div>}

      {shouldShowPreparationSection && (
        <div className="relative z-10">
          <h3 className="text-xl font-semibold mb-3 border-b border-border pb-2 bg-clip-text text-transparent bg-gradient-to-r from-emerald-700 to-teal-700 dark:from-green-300 dark:to-teal-400">
            Preparacion
          </h3>
          <EditableField
            value={recipe.instructions}
            onChange={(e) => onFormChange({ target: { name: 'instructions', value: e.target.value } })}
            isEditing={isEditing}
            placeholder="Anade aqui las instrucciones..."
            type={isEditing ? 'textarea' : 'p'}
            className="text-muted-foreground whitespace-pre-wrap"
          />
        </div>
      )}

      {shouldShowMetaFields && (
        <div
          className={cn(
            'grid grid-cols-3 gap-2 sm:gap-3 rounded-lg relative z-10',
            isEditing ? 'sm:p-0.5' : 'p-3 bg-muted/65'
          )}
        >
          <div className={cn('min-w-0', !isEditing && 'flex flex-col items-center justify-center text-center')}>
            <div className={cn('flex items-center gap-1 sm:gap-2 text-foreground dark:text-gray-200 font-semibold', !isEditing && 'justify-center')}>
              {!isEditing && <ChefHat className="w-4 h-4 text-muted-foreground shrink-0" />}
              <span className="truncate">Dificultad</span>
            </div>
            <div className="mt-1">
              <EditableField
                value={recipe.difficulty}
                onChange={(value) => onFormChange({ target: { name: 'difficulty', value } })}
                isEditing={isEditing}
                placeholder="No especificada"
                type="select"
                options={[
                  { value: 'Fácil', label: 'Fácil' },
                  { value: 'Media', label: 'Media' },
                  { value: 'Difícil', label: 'Difícil' },
                ]}
                className={isEditing ? 'py-1 pr-1 pl-2' : ''}
              />
            </div>
          </div>

          <div className={cn('min-w-0', !isEditing && 'flex flex-col items-center justify-center text-center')}>
            <div className={cn('flex items-center gap-1 sm:gap-2 text-foreground dark:text-gray-200 font-semibold', !isEditing && 'justify-center')}>
              {!isEditing && <UtensilsCrossed className="w-4 h-4 text-muted-foreground shrink-0" />}
              <span className="truncate">Estilo</span>
            </div>
            <div className="mt-1">
              {isEditing ? (
                <EditableField
                  value={recipeStyleId ? String(recipeStyleId) : undefined}
                  onChange={(value) => onFormChange({ target: { name: 'recipe_style_id', value } })}
                  isEditing={isEditing}
                  placeholder="No definido"
                  type="select"
                  options={safeRecipeStyles.map((style) => ({
                    value: String(style.id),
                    label: style.name,
                  }))}
                  className={isEditing ? 'py-1 pr-1 pl-2' : ''}
                />
              ) : (
                <span className="text-muted-foreground">{recipeStyleName || 'No definido'}</span>
              )}
            </div>
          </div>

          <div className={cn('min-w-0', !isEditing && 'flex flex-col items-center justify-center text-center')}>
            <div className={cn('flex items-center gap-1 sm:gap-2 text-foreground dark:text-gray-200 font-semibold', !isEditing && 'justify-center')}>
              {!isEditing && <Clock className="w-4 h-4 text-muted-foreground shrink-0" />}
              <span className="truncate">Tiempo</span>
            </div>
            <div className="mt-1">
              {isEditing ? (
                <div className="relative inline-flex items-center">
                  <Input
                    type="number"
                    value={recipe.prep_time_min}
                    onChange={(e) => onFormChange({ target: { name: 'prep_time_min', value: e.target.value } })}
                    className="input-field bg-transparent border-dashed w-16 text-center p-0.5 pr-7"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none">min</span>
                </div>
              ) : (
                <span className="text-muted-foreground">{recipe.prep_time_min ? `${recipe.prep_time_min} min` : 'N/A'}</span>
              )}
            </div>
          </div>
        </div>
      )}

      <IngredientQuickEditDialog
        open={!!quantityEditorIngredient}
        ingredient={quantityEditorIngredient}
        allFoods={safeFoods}
        allVitamins={safeVitamins}
        allMinerals={safeMinerals}
        selectedIngredients={recipe?.ingredients || []}
        userRestrictions={propUserRestrictions || internalRestrictions}
        onOpenChange={(isOpen) => {
          if (!isOpen) setQuantityEditorIngredient(null);
        }}
        onSave={handleQuickEditSave}
      />
    </div>
  );
};

export default RecipeView;
