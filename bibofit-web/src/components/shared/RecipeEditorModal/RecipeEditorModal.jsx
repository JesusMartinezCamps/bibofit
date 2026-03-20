import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useContextualGuide } from '@/contexts/ContextualGuideContext';
import { GUIDE_BLOCK_IDS } from '@/config/guideBlocks';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2, ArrowLeft } from 'lucide-react';
import { useRecipeEditor } from './useRecipeEditor';
import RecipeView from '../RecipeView';
import { Button } from '@/components/ui/button';
import ViewModeToggle from '../AdminViewToggle';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import IngredientSearch from '@/components/plans/IngredientSearch';
import { supabase } from '@/lib/supabaseClient';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/components/ui/use-toast';
import { isUserCreatedFood } from '@/lib/foodIdentity';

const SimpleHeader = ({ title, className, titleClassName }) => (
  <div className={cn("flex items-center justify-between p-4 border-b border-border", className || "bg-muted/65")}>
    <h3 className={cn("text-lg font-semibold", titleClassName || "text-foreground")}>{title}</h3>
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
    isTemplatePlan = false,
    asPage = false,
    mealTargetMacros = null,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();

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
            // Collect food IDs already present in the recipe to enrich with micronutrients
            const recipeIngredients = [
                ...(recipeToEdit.recipe_ingredients || []),
                ...(recipeToEdit.custom_ingredients || []),
                ...(recipeToEdit.recipe?.recipe_ingredients || []),
            ];
            const recipeFoodIds = [...new Set(recipeIngredients.map(ing => ing.food_id).filter(Boolean))];

            const [
                allStandardFoodsRes,
                enrichedRecipeFoodsRes,
                userFoodsRes,
                vitaminsRes,
                mineralsRes,
                foodGroupsRes,
            ] = await Promise.all([
                // All standard foods without micronutrients — for IngredientSearch
                supabase.from('food').select('*, food_sensitivities(sensitivity:sensitivities(*)), food_medical_conditions(relation_type, condition:medical_conditions(*)), food_to_food_groups(food_group:food_groups(*))').is('user_id', null),
                // Only this recipe's foods with full vitamin/mineral data — for detail view
                recipeFoodIds.length > 0
                    ? supabase.from('food').select('*, food_sensitivities(sensitivity:sensitivities(*)), food_medical_conditions(relation_type, condition:medical_conditions(*)), food_vitamins(mg_per_100g, vitamin:vitamins(*)), food_minerals(mg_per_100g, mineral:minerals(*)), food_to_food_groups(food_group:food_groups(*))').in('id', recipeFoodIds).is('user_id', null)
                    : Promise.resolve({ data: [], error: null }),
                userId ? supabase.from('food').select('*, food_sensitivities(sensitivity:sensitivities(*)), food_to_food_groups(food_group:food_groups(*))').eq('user_id', userId).neq('status', 'rejected') : Promise.resolve({ data: [], error: null }),
                supabase.from('vitamins').select('*'),
                supabase.from('minerals').select('*'),
                supabase.from('food_groups').select('*'),
            ]);

            if (allStandardFoodsRes.error || enrichedRecipeFoodsRes.error || userFoodsRes.error || vitaminsRes.error || mineralsRes.error || foodGroupsRes.error) {
                throw new Error('Failed to fetch enrichment data.');
            }

            // Overlay enriched recipe foods (with vitamins/minerals) onto the full food list
            const enrichedFoodMap = new Map((enrichedRecipeFoodsRes.data || []).map(f => [f.id, f]));
            const combinedFoods = [
                ...(allStandardFoodsRes.data || []).map(f => ({ ...(enrichedFoodMap.get(f.id) || f), is_user_created: false })),
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
                ingredientsSource = recipeToEdit.recipe_ingredients || [];
            } else if (isPrivate) {
                recipeSource = recipeToEdit;
                ingredientsSource = recipeToEdit.recipe_ingredients || [];
            } else { // diet_plan_recipe
                recipeSource = recipeToEdit.is_customized ? recipeToEdit : (recipeToEdit.recipe || {});
                
                const hasCustomIngredients = recipeToEdit.custom_ingredients && recipeToEdit.custom_ingredients.length > 0;
                ingredientsSource = hasCustomIngredients ? recipeToEdit.custom_ingredients : (recipeToEdit.recipe?.recipe_ingredients || []);
            }

            const populatedIngredients = ingredientsSource.map(ing => {
                const foodId = ing.food_id;
                
                const foodDetails = combinedFoods.find(f => String(f.id) === String(foodId));
                
                if (!foodDetails) return null;

                const rawQty = ing.grams ?? ing.quantity;
                let adjustedQuantity = rawQty != null ? Number(rawQty) : 0;
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
    isBaseRecipe,
    isUserBranch,
    hasMetadataChanges,
    changedMetadataFields,
    checkEditabilityForSave,
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
  const { triggerBlock, seenBlocks } = useContextualGuide();

  const [canEditInPlace, setCanEditInPlace] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [scrollToFoodId, setScrollToFoodId] = useState(null);
  const [isLeaveConfirmOpen, setIsLeaveConfirmOpen] = useState(false);
  const [isModeSwitchConfirmOpen, setIsModeSwitchConfirmOpen] = useState(false);
  // Diálogo info: se guardarán solo los metadatos (cuando también hay cambios de ingredientes)
  const [isSaveMetaInfoOpen, setIsSaveMetaInfoOpen] = useState(false);
  // Diálogo de elección y forzado (reservados para flujos futuros)
  const [isSaveChoiceOpen, setIsSaveChoiceOpen] = useState(false);
  const [isForcedVariantOpen, setIsForcedVariantOpen] = useState(false);
  const [forcedVariantReason] = useState('');
  // Diálogo de confirmación de conflictos (ya no bloquea, solo avisa)
  const [isConflictConfirmOpen, setIsConflictConfirmOpen] = useState(false);
  const [pendingMode, setPendingMode] = useState(null);
  const [quickEditIngredientKey, setQuickEditIngredientKey] = useState(null);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isMobileHeaderHidden, setIsMobileHeaderHidden] = useState(false);
  const ingredientsContainerRef = useRef(null);
  const searchScrollSnapshotRef = useRef({
    innerScrollTop: 0,
    appShellScrollTop: 0,
    windowScrollTop: 0,
  });
  const shouldRestoreSearchScrollRef = useRef(false);
  const shouldForceBottomScrollRef = useRef(false);
  const hasTriggeredAutobalanceGuideRef = useRef(false);
  const editingSnapshotRef = useRef(null);
  const closeBaselineSnapshotRef = useRef(null);
  const closeBaselineKeyRef = useRef(null);

  const normalizeFormSnapshot = useCallback((data) => ({
    name: String(data?.name ?? '').trim(),
    instructions: String(data?.instructions ?? ''),
    prep_time_min: data?.prep_time_min === '' || data?.prep_time_min === null || data?.prep_time_min === undefined
      ? null
      : Number(data.prep_time_min),
    difficulty: String(data?.difficulty ?? ''),
    recipe_style_id: String(data?.recipe_style_id ?? ''),
  }), []);

  const normalizeIngredientsSnapshot = useCallback((list) => (
    (Array.isArray(list) ? list : []).map((ing) => ({
      food_id: String(ing?.food_id ?? ing?.food?.id ?? ''),
      grams: ing?.grams === '' || ing?.grams === null || ing?.grams === undefined
        ? 0
        : Number(ing.grams),
    }))
  ), []);

  const buildEditingSnapshot = useCallback(() => JSON.stringify({
    form: normalizeFormSnapshot(formData),
    ingredients: normalizeIngredientsSnapshot(ingredients),
  }), [formData, ingredients, normalizeFormSnapshot, normalizeIngredientsSnapshot]);

  useEffect(() => {
    if (!open || loading || localLoading) return;

    const baselineKey = [
      enrichedRecipe?.id ?? 'no-id',
      enrichedRecipe?.updated_at ?? '',
      mode,
    ].join('|');

    if (closeBaselineKeyRef.current !== baselineKey) {
      closeBaselineSnapshotRef.current = buildEditingSnapshot();
      closeBaselineKeyRef.current = baselineKey;
    }
  }, [open, loading, localLoading, enrichedRecipe?.id, enrichedRecipe?.updated_at, mode, buildEditingSnapshot]);

  const hasUnsavedChangesForClose = useCallback(() => {
    const baseline = closeBaselineSnapshotRef.current;
    if (!baseline) return false;
    return baseline !== buildEditingSnapshot();
  }, [buildEditingSnapshot]);

  // Comprueba si la receta puede guardarse in-place (sin crear variante).
  // Solo aplica a ramas del usuario (variant/private_recipe) sin historial comido ni hijos.
  useEffect(() => {
    if (!open || loading || localLoading) {
      setCanEditInPlace(false);
      return undefined;
    }

    let cancelled = false;
    checkEditabilityForSave().then((result) => {
      if (!cancelled) {
        setCanEditInPlace(result.canModifyInPlace && !result.hasEatenRecords && !result.hasChildren);
      }
    }).catch(() => {
      if (!cancelled) setCanEditInPlace(false);
    });

    return () => { cancelled = true; };
  }, [open, loading, localLoading, checkEditabilityForSave]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mediaQuery = window.matchMedia('(max-width: 639px)');
    const applyViewport = (matches) => setIsMobileViewport(matches);
    applyViewport(mediaQuery.matches);

    const handler = (event) => applyViewport(event.matches);
    mediaQuery.addEventListener('change', handler);

    return () => {
      mediaQuery.removeEventListener('change', handler);
    };
  }, []);

  useEffect(() => {
    if (!open || !ingredientsContainerRef.current || isSearching || !isMobileViewport) {
      setIsMobileHeaderHidden(false);
      return undefined;
    }

    const scroller = ingredientsContainerRef.current;

    const syncHeaderVisibility = () => {
      const titleAnchor = scroller.querySelector('[data-recipe-title-anchor]');
      if (!titleAnchor) {
        setIsMobileHeaderHidden(false);
        return;
      }

      // Deterministic rule using scroll coordinates:
      // compact mode starts when the bottom edge of the title container
      // has moved above the top edge of the visible scroll area.
      const titleBottomInContent = titleAnchor.offsetTop + titleAnchor.offsetHeight;
      const shouldHideHeader = scroller.scrollTop >= titleBottomInContent;
      setIsMobileHeaderHidden(shouldHideHeader);
    };

    syncHeaderVisibility();
    scroller.addEventListener('scroll', syncHeaderVisibility, { passive: true });
    window.addEventListener('resize', syncHeaderVisibility);

    return () => {
      scroller.removeEventListener('scroll', syncHeaderVisibility);
      window.removeEventListener('resize', syncHeaderVisibility);
    };
  }, [open, isSearching, isMobileViewport, mode, enrichedRecipe?.id, enrichedRecipe?.image_url, enrichedRecipe?.img_url]);

  useEffect(() => {
    if (scrollToFoodId && ingredientsContainerRef.current) {
      const cards = ingredientsContainerRef.current.querySelectorAll('[data-ingredient-food-id]');
      const ingredientCard = Array.from(cards).find(
        (card) => card.getAttribute('data-ingredient-food-id') === String(scrollToFoodId)
      );
      if (ingredientCard) {
        ingredientCard.scrollIntoView({ behavior: 'smooth', block: 'end' });
      } else {
        ingredientsContainerRef.current.scrollTop = ingredientsContainerRef.current.scrollHeight;
      }
      setScrollToFoodId(null);
    }
  }, [ingredients, scrollToFoodId, mode]);

  useEffect(() => {
    if (isSearching || !shouldRestoreSearchScrollRef.current) return;

    const forceBottom = shouldForceBottomScrollRef.current;
    const snapshot = { ...searchScrollSnapshotRef.current };

    shouldRestoreSearchScrollRef.current = false;
    shouldForceBottomScrollRef.current = false;

    const restoreScroll = () => {
      if (ingredientsContainerRef.current) {
        ingredientsContainerRef.current.scrollTop = forceBottom
          ? ingredientsContainerRef.current.scrollHeight
          : snapshot.innerScrollTop;
      }

      if (!asPage) return;

      const appShell = document.querySelector('.app-main-shell');
      if (appShell) {
        appShell.scrollTop = forceBottom ? appShell.scrollHeight : snapshot.appShellScrollTop;
      }

      window.scrollTo({
        top: forceBottom ? document.body.scrollHeight : snapshot.windowScrollTop,
        left: 0,
        behavior: 'auto',
      });
    };

    requestAnimationFrame(() => {
      restoreScroll();
      requestAnimationFrame(restoreScroll);
    });
  }, [asPage, isSearching]);

  const openIngredientSearch = () => {
    const appShell = document.querySelector('.app-main-shell');
    searchScrollSnapshotRef.current = {
      innerScrollTop: ingredientsContainerRef.current?.scrollTop || 0,
      appShellScrollTop: appShell?.scrollTop || 0,
      windowScrollTop: window.scrollY || document.documentElement.scrollTop || 0,
    };
    setIsSearching(true);
  };

  const closeIngredientSearch = ({ scrollToBottom = false } = {}) => {
    shouldRestoreSearchScrollRef.current = true;
    shouldForceBottomScrollRef.current = scrollToBottom;
    setIsSearching(false);
  };

  const handleModeChange = (checked) => {
    if (readOnly) return;
    const newMode = checked ? 'view' : 'settings';
    if (newMode === mode) return;

    if (newMode === 'settings') {
      editingSnapshotRef.current = buildEditingSnapshot();
      setMode(newMode);
      triggerBlock(GUIDE_BLOCK_IDS.RECIPE_EDIT);
      return;
    }

    const snapshotAtEditStart = editingSnapshotRef.current;
    const hasRealChangesSinceEditStart =
      !!snapshotAtEditStart && snapshotAtEditStart !== buildEditingSnapshot();

    if (mode === 'settings' && hasRealChangesSinceEditStart) {
      setPendingMode(newMode);
      setIsModeSwitchConfirmOpen(true);
      return;
    }

    editingSnapshotRef.current = null;
    setMode(newMode);
  };

  useEffect(() => {
    if (!open) {
      hasTriggeredAutobalanceGuideRef.current = false;
    }
  }, [open]);

  useEffect(() => {
    if (!open || loading || localLoading) return;
    if (isSearching || readOnly || !isEditable) return;
    if (mode !== 'settings') return;
    if (!hasIngredientChanges) return;
    if (seenBlocks.has(GUIDE_BLOCK_IDS.RECIPE_AUTOBALANCE)) return;
    if (hasTriggeredAutobalanceGuideRef.current) return;

    hasTriggeredAutobalanceGuideRef.current = true;
    triggerBlock(GUIDE_BLOCK_IDS.RECIPE_AUTOBALANCE);
  }, [
    hasIngredientChanges,
    isEditable,
    isSearching,
    loading,
    localLoading,
    mode,
    open,
    readOnly,
    seenBlocks,
    triggerBlock,
  ]);

  const handleConfirmModeSwitch = () => {
    if (pendingMode) setMode(pendingMode);
    editingSnapshotRef.current = null;
    setPendingMode(null);
    setIsModeSwitchConfirmOpen(false);
  };

  const handleCancelModeSwitch = () => {
    setPendingMode(null);
    setIsModeSwitchConfirmOpen(false);
  };

  const handleModeSwitchDialogOpenChange = (nextOpen) => {
    setIsModeSwitchConfirmOpen(nextOpen);
    if (!nextOpen) setPendingMode(null);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    if (asPage && hasUnsavedChangesForClose()) {
      setIsLeaveConfirmOpen(true);
      return;
    }
    editingSnapshotRef.current = null;
    closeBaselineSnapshotRef.current = null;
    closeBaselineKeyRef.current = null;
    onOpenChange(false);
    setIsSearching(false);
  };
  
  const handleLocalAddIngredient = (newIngredientData) => {
    const addedIngredient = handleAddIngredient(newIngredientData);
    if (addedIngredient?.local_id || addedIngredient?.id) {
      setQuickEditIngredientKey(addedIngredient.local_id || addedIngredient.id);
    }
    closeIngredientSearch({ scrollToBottom: true });
    setScrollToFoodId(newIngredientData.food_id);
  }

  const finalizeSave = async (saveMode = 'auto') => {
    const success = await handleSubmit('save', saveMode);
    if (success) {
      closeBaselineSnapshotRef.current = null;
      closeBaselineKeyRef.current = null;
      onOpenChange(false);
      setIsSearching(false);
    }
  };

  // Guardar todo in-place (ingredientes + metadatos) — solo para recetas limpias sin historial.
  const doInPlaceSave = async () => {
    const success = await handleSubmit('save', 'in_place');
    if (success) {
      closeBaselineSnapshotRef.current = null;
      closeBaselineKeyRef.current = null;
      onOpenChange(false);
      setIsSearching(false);
    }
  };

  // Guardar solo metadatos en-place (nombre, dificultad, instrucciones, etc.)
  // Si la receta es limpia y hay cambios de ingredientes, guarda todo in-place.
  // Si no es limpia pero hay cambios de ingredientes, avisa antes de continuar.
  const handleMetadataSave = () => {
    if (hasIngredientChanges && canEditInPlace) {
      doInPlaceSave();
      return;
    }
    if (hasIngredientChanges) {
      setIsSaveMetaInfoOpen(true);
      return;
    }
    doMetadataSave();
  };

  const doMetadataSave = async () => {
    const success = await handleSubmit('save', 'metadata_only');
    if (success) {
      closeBaselineSnapshotRef.current = null;
      closeBaselineKeyRef.current = null;
      onOpenChange(false);
      setIsSearching(false);
    }
  };

  // Crear nueva variante (rama). Con confirmación si hay conflictos.
  const handleVariantSave = async () => {
    if (hasCriticalConflicts) {
      setIsConflictConfirmOpen(true);
      return;
    }
    await finalizeSave('auto');
  };

  const triggerSaveActionsGuide = useCallback(
    (firstAction) => {
      if (seenBlocks.has(GUIDE_BLOCK_IDS.RECIPE_SAVE_ACTIONS)) return false;

      const stepOrder = firstAction === 'variant' ? [1, 0] : [0, 1];
      triggerBlock(GUIDE_BLOCK_IDS.RECIPE_SAVE_ACTIONS, { stepOrder });
      return true;
    },
    [seenBlocks, triggerBlock]
  );

  const handleMetadataSaveWithGuide = () => {
    if (triggerSaveActionsGuide('save')) return;
    handleMetadataSave();
  };

  const handleVariantSaveWithGuide = () => {
    if (triggerSaveActionsGuide('variant')) return;
    handleVariantSave();
  };

  const handleConflictConfirmed = async () => {
    setIsConflictConfirmOpen(false);
    await finalizeSave('auto');
  };

  const handleChoiceModifyInPlace = async () => {
    setIsSaveChoiceOpen(false);
    await finalizeSave('in_place');
  };

  const handleChoiceCreateVariant = async () => {
    setIsSaveChoiceOpen(false);
    await finalizeSave('auto');
  };

  const handleForcedHideAndVariant = async () => {
    setIsForcedVariantOpen(false);
    await finalizeSave('hide_and_variant');
  };

  const handleSaveAndLeave = async () => {
    setIsLeaveConfirmOpen(false);
    const success = await handleSubmit('save');
    if (success) {
      closeBaselineSnapshotRef.current = null;
      closeBaselineKeyRef.current = null;
      onOpenChange(false);
      setIsSearching(false);
    }
  };

  const recipeForView = useMemo(() => ({
    ...enrichedRecipe,
    ...formData,
    ingredients: ingredients,
  }), [formData, ingredients, enrichedRecipe]);

  const handleInlineFoodCreated = (newFood) => {
    if (!newFood?.id) return;
    const normalizedFood = {
      ...newFood,
      is_user_created: isUserCreatedFood(newFood) || true,
      food_sensitivities: newFood.food_sensitivities || [],
      food_medical_conditions: newFood.food_medical_conditions || [],
      food_vitamins: newFood.food_vitamins || [],
      food_minerals: newFood.food_minerals || [],
      food_to_food_groups: newFood.food_to_food_groups || [],
    };

    setAllFoods((prev) => {
      const next = prev.filter((food) => String(food.id) !== String(normalizedFood.id));
      return [...next, normalizedFood];
    });
  };

  const isEditingMode = mode === 'settings' && isEditable && !readOnly;
  const totalLoading = loading || localLoading;

  const recipeVisualTone = useMemo(() => {
    const isVariantRecipe = (
      enrichedRecipe?.user_recipe_type === 'variant' ||
      enrichedRecipe?.type === 'variant' ||
      Boolean(enrichedRecipe?.parent_user_recipe_id) ||
      Boolean(enrichedRecipe?.source_diet_plan_recipe_id)
    );
    const isPrivateRecipe = (
      !isVariantRecipe && (
        enrichedRecipe?.is_private ||
        enrichedRecipe?.is_private_recipe ||
        enrichedRecipe?.type === 'private_recipe' ||
        enrichedRecipe?.user_recipe_type === 'private'
      )
    );
    const isFreeRecipe = enrichedRecipe?.type === 'free_recipe';

    if (isVariantRecipe) return 'variant';
    if (isPrivateRecipe) return 'private';
    if (isFreeRecipe) return 'free';
    return 'original';
  }, [enrichedRecipe]);

  const visualToneClasses = useMemo(() => {
    const toneMap = {
      original: {
        headerBgClass: 'bg-amber-500/15 border-b border-amber-500/35',
        titleClassName: 'text-amber-100',
        toggleSwitchColor: 'data-[state=checked]:bg-amber-500',
        activeIconColor: 'text-amber-300',
      },
      variant: {
        headerBgClass: 'bg-cyan-500/15 border-b border-cyan-500/35',
        titleClassName: 'text-cyan-100',
        toggleSwitchColor: 'data-[state=checked]:bg-cyan-500',
        activeIconColor: 'text-cyan-300',
      },
      private: {
        headerBgClass: 'bg-violet-500/15 border-b border-violet-500/35',
        titleClassName: 'text-violet-100',
        toggleSwitchColor: 'data-[state=checked]:bg-violet-500',
        activeIconColor: 'text-violet-300',
      },
      free: {
        headerBgClass: 'bg-sky-500/15 border-b border-sky-500/35',
        titleClassName: 'text-sky-100',
        toggleSwitchColor: 'data-[state=checked]:bg-sky-500',
        activeIconColor: 'text-sky-300',
      },
    };

    return toneMap[recipeVisualTone] || toneMap.original;
  }, [recipeVisualTone]);

  const {
    headerBgClass,
    titleClassName,
    toggleSwitchColor,
    activeIconColor,
  } = visualToneClasses;
  
  const criticalConflicts = conflicts?.filter(c => ['condition_avoid', 'sensitivity', 'non-preferred', 'individual_restriction', 'diet_type_excluded'].includes(c.type)) || [];
  const hasCriticalConflicts = criticalConflicts.length > 0;
  
  const effectiveIsTemplate = isTemplate || isTemplatePlan;

  // Determine if we should disable auto-balance in RecipeView
  // Disabled if no changes OR if it's a template (templates don't have personal targets usually)
  const shouldDisableAutoBalance = !hasIngredientChanges || effectiveIsTemplate;

  const innerContent = totalLoading ? (
    <div className="flex justify-center items-center h-full min-h-[400px]">
      <Loader2 className="h-12 w-12 animate-spin text-green-500" />
    </div>
  ) : (
    <>
      {(!isSearching) && (
        <div
          data-guide-target="recipe-view-mode-toggle"
          className={cn(
            'overflow-hidden transition-all duration-300 ease-out',
            isMobileViewport && isMobileHeaderHidden
              ? 'max-h-0 opacity-0 -translate-y-2 pointer-events-none'
              : 'max-h-24 opacity-100 translate-y-0'
          )}
        >
          {(isEditable && !readOnly) ? (
            <ViewModeToggle
              mode={mode}
              onModeChange={handleModeChange}
              loading={isSubmitting}
              className={cn("flex-shrink-0", headerBgClass)}
              hasChanges={hasChanges}
              isClientRequestView={isClientRequestView}
              switchCheckedColor={toggleSwitchColor}
              activeIconColor={activeIconColor}
              showSaveIndicator={false}
              saveLabel={hasIngredientChanges ? "Crear variante" : "Guardar"}
              leftElement={asPage ? (
                <button
                  onClick={handleClose}
                  className="text-muted-foreground hover:text-foreground h-8 w-8 flex items-center justify-center transition-colors"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
              ) : null}
            />
          ) : (
            <SimpleHeader title={formData.name} className={headerBgClass} titleClassName={titleClassName} />
          )}
        </div>
      )}

      <div ref={ingredientsContainerRef} className="flex-1 overflow-y-auto styled-scrollbar-green">
        {isSearching ? (
          <div className="p-4 h-full">
            <IngredientSearch
              selectedIngredients={ingredients}
              onIngredientAdded={handleLocalAddIngredient}
              availableFoods={allFoods}
              userRestrictions={userRestrictions}
              onFoodCreated={handleInlineFoodCreated}
              createFoodUserId={userId || user?.id}
              onBack={() => closeIngredientSearch()}
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
            targetUserId={userId}
            conflicts={conflicts}
            recommendations={recommendations}
            userRestrictions={userRestrictions}
            isEditing={isEditingMode}
            onFormChange={handleFormChange}
            onIngredientsChange={isEditable && !readOnly ? handleIngredientsChange : undefined}
            onRemoveIngredient={isEditable && !readOnly ? handleRemoveIngredient : undefined}
            onAddIngredientClick={isEditable && !readOnly ? openIngredientSearch : undefined}
            disableAutoBalance={shouldDisableAutoBalance}
            enableStickyMacros={true}
            isTemplate={effectiveIsTemplate}
            quickEditIngredientKey={quickEditIngredientKey}
            onQuickEditConsumed={() => setQuickEditIngredientKey(null)}
            onFoodCreated={handleInlineFoodCreated}
            hideMacrosTitle={false}
            mealTargetMacros={mealTargetMacros}
          />
        )}

        {!isSearching && isEditable && !readOnly && (
          <div className="flex justify-center pt-4 px-2 gap-3 pb-4 flex-wrap">
            <TooltipProvider>
              {/* Botón "Guardar cambios" — metadatos en-place (siempre) o ingredientes si receta es limpia */}
              {(() => {
                const canSaveInPlace = hasMetadataChanges || (hasIngredientChanges && canEditInPlace);
                return (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span tabIndex={0}>
                        <Button
                          data-guide-target="recipe-view-save-button"
                          type="button"
                          onClick={handleMetadataSaveWithGuide}
                          disabled={isSubmitting || !canSaveInPlace}
                          className={cn(
                            "bg-gradient-to-r from-blue-700 to-blue-900 hover:from-blue-600 hover:to-blue-800 text-white font-bold transition-all duration-300",
                            "disabled:opacity-40 disabled:cursor-not-allowed",
                            canSaveInPlace && "border border-blue-400/40 shadow-[0_0_12px_rgba(59,130,246,0.3)]"
                          )}
                        >
                          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Guardar cambios
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {!canSaveInPlace && (
                      <TooltipContent className="bg-card border-border text-white">
                        <p>
                          {hasIngredientChanges
                            ? 'Esta receta no puede modificarse directamente. Usa "Crear variante".'
                            : 'Cambia nombre, preparación, dificultad o estilo para habilitar.'}
                        </p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                );
              })()}

              {/* Botón "Crear variante" — siempre cyan, solo ingredientes */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0}>
                    <Button
                      data-guide-target="recipe-view-variant-button"
                      type="button"
                      onClick={handleVariantSaveWithGuide}
                      disabled={isSubmitting || !hasChanges}
                      className={cn(
                        "bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-500 hover:to-blue-600 text-white font-bold transition-all duration-300",
                        "disabled:opacity-40 disabled:cursor-not-allowed disabled:from-slate-600 disabled:to-slate-700",
                        hasChanges && "border border-cyan-400/55 shadow-[0_0_15px_rgba(6,182,212,0.35)]"
                      )}
                    >
                      {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Crear variante
                    </Button>
                  </span>
                </TooltipTrigger>
                {!hasChanges && (
                  <TooltipContent className="bg-card border-border text-white">
                    <p>Modifica ingredientes o preparación para crear una nueva variante.</p>
                  </TooltipContent>
                )}
                {hasChanges && hasCriticalConflicts && (
                  <TooltipContent className="bg-card border-border text-white">
                    <p className="text-orange-400">Hay conflictos con las restricciones. Podrás confirmar antes de guardar.</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </div>
    </>
  );

  // Diálogos de guardado compartidos entre modo página y modo modal
  const saveDialogs = (
    <>
      {/* Info: guardar solo metadatos cuando también hay cambios de ingredientes */}
      {(() => {
        const joinWithAnd = (items) => {
          if (items.length === 0) return '';
          if (items.length === 1) return items[0];
          if (items.length === 2) return `${items[0]} y ${items[1]}`;
          return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
        };
        const fieldsSummary = joinWithAnd(changedMetadataFields);
        return (
          <Dialog open={isSaveMetaInfoOpen} onOpenChange={setIsSaveMetaInfoOpen}>
            <DialogContent className="max-w-sm">
              <DialogTitle>Solo se guardarán algunos cambios</DialogTitle>
              <DialogDescription asChild>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    Solo se guardarán los cambios en:{' '}
                    <span className="text-white font-medium">{fieldsSummary}</span>.
                  </p>
                  <p>Los cambios en los alimentos <span className="text-cyan-400 font-medium">no se guardarán</span> — usa "Crear variante" para eso.</p>
                </div>
              </DialogDescription>
              <div className="flex flex-col gap-2 pt-1">
                <Button onClick={() => { setIsSaveMetaInfoOpen(false); doMetadataSave(); }} className="w-full bg-blue-700 hover:bg-blue-600 text-white">
                  {fieldsSummary ? `Entendido, guardar ${fieldsSummary}` : 'Entendido, guardar cambios'}
                </Button>
                <Button variant="ghost" onClick={() => setIsSaveMetaInfoOpen(false)} className="w-full">
                  Cancelar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Confirmación de conflictos: avisa pero no bloquea */}
      <Dialog open={isConflictConfirmOpen} onOpenChange={setIsConflictConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Hay conflictos en esta receta</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Esta receta contiene ingredientes que generan conflictos con las restricciones del usuario:</p>
              <ul className="list-disc pl-4 space-y-1 text-orange-400">
                {criticalConflicts.map((c, i) => (
                  <li key={i}>{c.restrictionName || c.type}</li>
                ))}
              </ul>
              <p>¿Seguro que quieres guardar de todas formas?</p>
            </div>
          </DialogDescription>
          <div className="flex flex-col gap-2 pt-1">
            <Button onClick={handleConflictConfirmed} className="w-full bg-orange-600 hover:bg-orange-700 text-white">
              Sí, guardar con conflictos
            </Button>
            <Button variant="ghost" onClick={() => setIsConflictConfirmOpen(false)} className="w-full">
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Elección: modificar in-place vs crear variante (rama sin hijos ni registros comidos) */}
      <Dialog open={isSaveChoiceOpen} onOpenChange={setIsSaveChoiceOpen}>
        <DialogContent className="max-w-sm">
          <DialogTitle>¿Cómo quieres guardar los cambios?</DialogTitle>
          <DialogDescription>
            Puedes modificar esta receta directamente o guardar los cambios como una nueva versión.
          </DialogDescription>
          <div className="flex flex-col gap-2 pt-1">
            <Button onClick={handleChoiceModifyInPlace} className="w-full bg-violet-600 hover:bg-violet-700 text-white">
              Modificar esta receta
            </Button>
            <Button onClick={handleChoiceCreateVariant} className="w-full bg-cyan-600 hover:bg-cyan-700 text-white">
              Crear nueva versión
            </Button>
            <Button variant="ghost" onClick={() => setIsSaveChoiceOpen(false)} className="w-full">
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Forzado: ocultar + crear variante (tiene hijos o registros comidos) */}
      <Dialog open={isForcedVariantOpen} onOpenChange={setIsForcedVariantOpen}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Esta receta no se puede modificar directamente</DialogTitle>
          <DialogDescription>
            {forcedVariantReason === 'eaten'
              ? 'Bibofit usa los registros de esta receta para calcular tu historial calórico. No se puede modificar, pero puedes ocultarla y crear una nueva versión.'
              : 'Otras versiones de tu receta dependen de esta. No se puede modificar directamente para no perder la trazabilidad, pero puedes ocultarla y crear una nueva versión.'}
          </DialogDescription>
          <div className="flex flex-col gap-2 pt-1">
            <Button onClick={handleForcedHideAndVariant} className="w-full bg-cyan-600 hover:bg-cyan-700 text-white">
              Ocultar esta versión y crear nueva
            </Button>
            <Button variant="ghost" onClick={() => setIsForcedVariantOpen(false)} className="w-full">
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );

  if (asPage) {
    return (
      <>
        <div className="flex flex-col h-full bg-[#0C101D] text-white">
          {innerContent}
        </div>
        {saveDialogs}
        <Dialog open={isModeSwitchConfirmOpen} onOpenChange={handleModeSwitchDialogOpenChange}>
          <DialogContent className="max-w-sm">
            <DialogTitle>¿Cambiar de modo sin guardar?</DialogTitle>
            <DialogDescription>
              Tienes cambios sin guardar. Puedes cambiar de modo y guardar despues.
            </DialogDescription>
            <div className="flex flex-col gap-2 pt-1">
              <Button
                onClick={handleConfirmModeSwitch}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white"
              >
                Cambiar de modo
              </Button>
              <Button
                variant="ghost"
                onClick={handleCancelModeSwitch}
                className="w-full"
              >
                Seguir editando
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={isLeaveConfirmOpen} onOpenChange={setIsLeaveConfirmOpen}>
          <DialogContent className="max-w-sm">
            <DialogTitle>{hasIngredientChanges ? "¿Crear variante?" : "¿Guardar cambios?"}</DialogTitle>
            <DialogDescription>
              Tienes cambios sin guardar en la receta.
            </DialogDescription>
            <div className="flex flex-col gap-2 pt-1">
              <Button
                onClick={handleSaveAndLeave}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                {hasIngredientChanges ? "Salir y Crear variante" : "Salir y guardar"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => { setIsLeaveConfirmOpen(false); onOpenChange(false); setIsSearching(false); }}
                className="w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                Salir sin guardar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="bg-[#0C101D] border-border text-white w-[95vw] max-w-4xl p-0 flex flex-col h-[90vh]">
          {innerContent}
        </DialogContent>
      </Dialog>
      {saveDialogs}
      <Dialog open={isModeSwitchConfirmOpen} onOpenChange={handleModeSwitchDialogOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogTitle>¿Cambiar de modo sin guardar?</DialogTitle>
          <DialogDescription>
            Tienes cambios sin guardar. Puedes cambiar de modo y guardar despues.
          </DialogDescription>
          <div className="flex flex-col gap-2 pt-1">
            <Button
              onClick={handleConfirmModeSwitch}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white"
            >
              Cambiar de modo
            </Button>
            <Button
              variant="ghost"
              onClick={handleCancelModeSwitch}
              className="w-full"
            >
              Seguir editando
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default RecipeEditorModal;
