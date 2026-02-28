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
  ThumbsUp,
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

  const safeFoods = allFoods || [];
  const safeVitamins = allVitamins || [];
  const safeMinerals = allMinerals || [];
  const safeFoodGroups = allFoodGroups || [];

  const recipeImageUrl = useMemo(() => resolveRecipeImageUrl(recipe), [recipe]);
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
    if (mealTargetMacros || !isEditing || !user || !recipe?.day_meal_id || isTemplate) return;

    const fetchTargets = async () => {
      try {
        const { data, error } = await supabase
          .from('user_day_meals')
          .select('target_calories, target_proteins, target_carbs, target_fats')
          .eq('user_id', user.id)
          .eq('day_meal_id', recipe.day_meal_id)
          .limit(1)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching meal targets:', error);
        } else if (data) {
          setFetchedTargets(data);
        }
      } catch (err) {
        console.error('Error fetching targets:', err);
      }
    };

    fetchTargets();
  }, [mealTargetMacros, isEditing, user, recipe, isTemplate]);

  useEffect(() => {
    if (propConflicts || propUserRestrictions || !user) return;

    const fetchRestrictions = async () => {
      setLoadingRestrictions(true);
      try {
        const [sensRes, condRes, indRes, prefRes, nonPrefRes] = await Promise.all([
          supabase.from('user_sensitivities').select('sensitivity:sensitivities(id, name)').eq('user_id', user.id),
          supabase.from('user_medical_conditions').select('condition:medical_conditions(id, name)').eq('user_id', user.id),
          supabase.from('user_individual_food_restrictions').select('food(id, name)').eq('user_id', user.id),
          supabase.from('preferred_foods').select('food(id, name)').eq('user_id', user.id),
          supabase.from('non_preferred_foods').select('food(id, name)').eq('user_id', user.id),
        ]);

        setInternalRestrictions({
          sensitivities: (sensRes.data || []).map((s) => s.sensitivity).filter(Boolean),
          medical_conditions: (condRes.data || []).map((c) => c.condition).filter(Boolean),
          individual_food_restrictions: (indRes.data || []).map((i) => i.food).filter(Boolean),
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
        conflicts,
        recommendations,
      }),
    [recipe, safeFoods, safeVitamins, safeMinerals, conflicts, recommendations]
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
    const activeTargets = mealTargetMacros || fetchedTargets;

    if (
      !activeTargets ||
      [activeTargets.target_proteins, activeTargets.target_carbs, activeTargets.target_fats].some(
        (t) => t === 0 || t === null || t === undefined
      )
    ) {
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

  const handleQuickEditSave = ({ quantity, food }) => {
    if (!quantityEditorIngredient) return;

    const hasFoodChanged =
      food &&
      String(food.id) !== String(quantityEditorIngredient.food_id || quantityEditorIngredient.food?.id);

    if (!hasFoodChanged) {
      handleQuantityChange(quantityEditorIngredient, quantity);
      setQuantityEditorIngredient(null);
      return;
    }

    const replacementIngredient = {
      local_id: crypto.randomUUID(),
      food_id: food.id,
      grams: quantity,
      quantity,
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
      local_id: crypto.randomUUID(),
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

  const greenCount = recommendations.length;
  const redCount = conflicts.length;
  const hasIngredients = (recipe?.ingredients || []).length > 0;
  const showAutoBalance = isEditing && hasIngredients && (mealTargetMacros || recipe?.day_meal_id);
  const canManageIngredientsInView = !!onIngredientsChange && !!onRemoveIngredient;
  const canRenderNativeImageUpload = showImageUpload && typeof onImageUploadChange === 'function';
  const isMultiplierActive = servingMultiplier !== 1;
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
    <div className="text-white space-y-6 p-2 sm:p-4 md:p-6">
      <div className="text-center mt-6 relative z-10">
        {recipeImageUrl && (
          <div className="mb-4 overflow-hidden rounded-xl border border-slate-700/70 bg-slate-900/70">
            <img
              src={recipeImageUrl}
              alt={`Imagen de ${recipe.name || 'receta'}`}
              className="w-full h-44 sm:h-56 object-cover"
              loading="lazy"
            />
          </div>
        )}

        {isEditing ? (
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
        ) : (
          <>
            <h2 className="text-3xl font-bold text-center break-words bg-clip-text text-transparent bg-gradient-to-r from-green-300 to-teal-400">
              {recipe.name}
            </h2>
            <div className="flex justify-center gap-3 mt-2">
              {greenCount > 0 && (
                <span className="flex items-center text-sm text-green-400 gap-1.5 bg-green-900/20 px-2 py-1 rounded-full border border-green-500/30">
                  <ThumbsUp className="w-4 h-4" /> {greenCount} Recomendados
                </span>
              )}
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

      {showMetaFields && (
        <div
          className={cn(
            'grid grid-cols-3 gap-2 sm:gap-3 rounded-lg relative z-10',
            isEditing ? 'sm:p-0.5' : 'p-3 bg-slate-800/50'
          )}
        >
          <div className={cn('min-w-0', !isEditing && 'flex flex-col items-center justify-center text-center')}>
            <div className={cn('flex items-center gap-1 sm:gap-2 text-gray-200 font-semibold', !isEditing && 'justify-center')}>
              {!isEditing && <ChefHat className="w-4 h-4 text-gray-400 shrink-0" />}
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
            <div className={cn('flex items-center gap-1 sm:gap-2 text-gray-200 font-semibold', !isEditing && 'justify-center')}>
              {!isEditing && <Clock className="w-4 h-4 text-gray-400 shrink-0" />}
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
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none">min</span>
                </div>
              ) : (
                <span className="text-gray-300">{recipe.prep_time_min ? `${recipe.prep_time_min} min` : 'N/A'}</span>
              )}
            </div>
          </div>

          <div className={cn('min-w-0 relative', !isEditing && 'flex flex-col items-center justify-center text-center')}>
            <div className="text-gray-200 font-semibold">Multiplicador</div>
            <div className={cn('mt-1 flex items-center gap-1', !isEditing && 'justify-center')}>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 border-slate-600 bg-slate-900/60 hover:bg-slate-800 hover:text-gray-300 text-gray-200 shrink-0"
                onClick={() => setServingMultiplier((prev) => clampMultiplier(prev - 1))}
                disabled={servingMultiplier <= 1}
              >
                <Minus className="w-4 h-4" />
              </Button>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none">x</span>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={servingMultiplier}
                  onChange={(e) => setServingMultiplier(clampMultiplier(e.target.value))}
                  className="h-7 w-10 text-center pl-4 pr-1 input-field bg-transparent border-dashed font-semibold"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 border-slate-600 bg-slate-900/60 hover:bg-slate-800 hover:text-gray-300 text-gray-200 shrink-0"
                onClick={handleIncreaseMultiplier}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div
              className={cn(
                'absolute -top-8 left-1/2 -translate-x-1/2 rounded-md bg-slate-900/95 border border-cyan-500/30 px-2 py-1 text-[11px] text-cyan-100 whitespace-nowrap shadow-lg transition-all duration-200',
                showMultiplierEasterEgg ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
              )}
            >
              ¡Pero bueno! Suficiente comida así...
            </div>
          </div>
        </div>
      )}

      {showPreparationSection && (
        <div className="relative z-10">
          <h3 className="text-xl font-semibold mb-3 border-b border-gray-700 pb-2 bg-clip-text text-transparent bg-gradient-to-r from-green-300 to-teal-400">
            Preparacion
          </h3>
          <EditableField
            value={recipe.instructions}
            onChange={(e) => onFormChange({ target: { name: 'instructions', value: e.target.value } })}
            isEditing={isEditing}
            placeholder="Anade aqui las instrucciones..."
            type={isEditing ? 'textarea' : 'p'}
            className="text-gray-300 whitespace-pre-wrap"
          />
        </div>
      )}

      <div
        className={cn(
          enableStickyMacros &&
            'sticky top-0 bg-[#0C101D] -mx-2 px-2 sm:-mx-4 sm:px-4 md:-mx-6 md:px-6 py-2 shadow-xl border-b border-gray-800/60 mb-4',
          'z-30'
        )}
      >
        <h3 className="text-xl font-semibold mb-3 border-b border-gray-700 pb-2 bg-clip-text text-transparent bg-gradient-to-r from-green-300 to-teal-400">
          Macros Totales
        </h3>
        <MacroSummaryGrid macros={scaledTotalMacros} />
        {isEditing && (mealTargetMacros || fetchedTargets) && !isTemplate && (
          <div className="mt-4">
            <h4 className="text-sm font-semibold text-gray-400 mb-2 uppercase tracking-wider">
              Macros Objetivo (Limite)
            </h4>
            <MacroTargetGrid targets={mealTargetMacros || fetchedTargets} />
          </div>
        )}
      </div>

      {actionButton && <div className="my-4 relative z-10">{actionButton}</div>}

      <div className="relative z-10">
        <div className="flex justify-between items-center mb-3 border-b border-gray-700 pb-2">
          <h3 className="text-xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-green-300 to-teal-400">
            Ingredientes
          </h3>
          {onAddIngredientClick && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onAddIngredientClick}
              className="text-green-400 hover:bg-green-500/10 hover:text-green-300"
            >
              <PlusCircle className="w-6 h-6" />
            </Button>
          )}
        </div>

        <div className="space-y-4">
          {isEditing && isMultiplierActive && (
            <p className="text-xs text-cyan-200/80 rounded-md border border-cyan-500/20 bg-cyan-500/5 px-3 py-2">
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
              <div className="text-center py-10 border-2 border-dashed border-gray-700 rounded-lg">
                <p className="text-gray-500">No hay ingredientes en esta receta.</p>
                <p className="text-gray-500 mt-2">
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
                <div className="text-center py-10 border-2 border-dashed border-gray-700 rounded-lg">
                  <p className="text-gray-500">No hay ingredientes en esta receta.</p>
                </div>
              )}
            </ul>
          )}

          {showAutoBalance && (mealTargetMacros || fetchedTargets) && (
            <div className="mt-4 pt-2 border-t border-gray-800">
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
                className="w-full bg-slate-800 border-cyan-500 text-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-300 mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
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
