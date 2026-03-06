
import React, { useMemo } from 'react';
import { X, Scale, Hourglass, AlertTriangle, Clock, ChefHat, GitBranch, Link2 } from 'lucide-react';
import CaloriesIcon from '@/components/icons/CaloriesIcon';
import ProteinIcon from '@/components/icons/ProteinIcon';
import CarbsIcon from '@/components/icons/CarbsIcon';
import FatsIcon from '@/components/icons/FatsIcon';
import { cn } from '@/lib/utils';
import { calculateMacros as calculateMacrosFromIngredients } from '@/lib/macroCalculator';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import HighlightedText from '@/components/shared/HighlightedText';
import { analyzeRecipeConflicts } from '@/lib/recipeConflictAnalyzer';
import { useTheme } from '@/contexts/ThemeContext';
import { RecipeCardBackground, RecipeCardPanel } from '@/components/shared/recipe-card/RecipeCardBase';
import { getIngredientHighlightForQuery } from '@/lib/recipeSearch';
import {
  getRecipeDifficulty,
  getRecipeDisplayName,
  getRecipeIngredients,
  getRecipePrepTime,
  inferRecipeEntityType,
  RECIPE_ENTITY_TYPES,
} from '@/lib/recipeEntity';

const RecipeCard = ({
  recipe,
  user,
  allFoods = [], // Default to empty array to prevent find errors
  handleRecipeClick,
  handleRemoveRecipe,
  isListView = false,
  adjustment,
  userRestrictions,
  isAdminView,
  selectionIndicator,
  searchQuery = '',
  hideQuantities = false,
  hideMacros = false
}) => {
  const { isDark } = useTheme();
  const recipeType = useMemo(() => inferRecipeEntityType(recipe), [recipe]);
  const isPrivate = recipeType === RECIPE_ENTITY_TYPES.PRIVATE;

  const recipeName = useMemo(() => {
    if (!recipe) return 'Receta Desconocida';
    return getRecipeDisplayName(recipe) || (isPrivate ? 'Receta Privada' : 'Receta');
  }, [recipe, isPrivate]);

  const recipeIngredients = useMemo(() => {
    return getRecipeIngredients(recipe);
  }, [recipe]);

  const recipeDifficulty = useMemo(() => {
    return getRecipeDifficulty(recipe);
  }, [recipe]);

  const recipePrepTime = useMemo(() => {
    return getRecipePrepTime(recipe);
  }, [recipe]);

  const imageUrl = useMemo(() => {
    if (!recipe) return null;
    return recipe.img_url || recipe.image_url || recipe.recipe?.img_url || recipe.recipe?.image_url || null;
  }, [recipe]);

  const adjustedIngredients = useMemo(() => {
    if (!recipeIngredients) return [];
    let ingredients = recipeIngredients.map(ing => ({
        food_id: ing.food_id,
        quantity: ing.grams || ing.quantity || 0,
        food: ing.food // Preserve nested food object if available
    }));
    
    if (adjustment) {
        return ingredients.map(ing => {
            const ingAdjustment = adjustment.find(adj => adj.food_id === ing.food_id);
            return {
                ...ing,
                quantity: ingAdjustment ? ingAdjustment.adjusted_grams : ing.quantity
            };
        });
    }
    return ingredients;
  }, [recipeIngredients, adjustment]);

  const { unsafeFoodsSet, recommendedFoodsSet } = useMemo(() => {
    const { unsafeFoodNames, recommendedFoodNames } = analyzeRecipeConflicts({
      recipe: {
        ...recipe,
        recipe_ingredients: adjustedIngredients
      },
      allFoods,
      userRestrictions
    });

    return { unsafeFoodsSet: unsafeFoodNames, recommendedFoodsSet: recommendedFoodNames };
  }, [recipe, adjustedIngredients, allFoods, userRestrictions]);

  const isSafe = unsafeFoodsSet.size === 0;

  const ingredientList = useMemo(() => {
    if (!adjustedIngredients || adjustedIngredients.length === 0) return [];
    return adjustedIngredients.map((ing, index) => {
        const food = allFoods.find(f => f.id === ing.food_id) || ing.food;
        if (!food) return null;
        
        let text = food.name;
        if (!hideQuantities) {
            const unit = food.food_unit === 'unidades' ? 'ud' : 'g';
            text = `${food.name} (${Math.round(ing.quantity || 0)}${unit})`;
        }

        const ingredientHighlight = getIngredientHighlightForQuery({
          food,
          query: searchQuery,
          allowFuzzy: true,
        });
        
        const isUnsafe = unsafeFoodsSet.has(food.name);
        const isRecommended = recommendedFoodsSet.has(food.name);
        
        let className = "text-muted-foreground";
        if (isUnsafe) className = "text-red-700 dark:text-red-400 font-medium";
        else if (isRecommended) className = "text-green-700 dark:text-green-400 font-medium";
        
        return (
            <span key={ing.food_id || index} className={className}>
                <HighlightedText text={text} highlight={ingredientHighlight} />
            </span>
        );
    }).filter(Boolean);
  }, [adjustedIngredients, allFoods, unsafeFoodsSet, recommendedFoodsSet, searchQuery, hideQuantities]);

  const macros = useMemo(() => {
    if (!adjustedIngredients) {
      return { calories: 0, proteins: 0, carbs: 0, fats: 0 };
    }
    return calculateMacrosFromIngredients(adjustedIngredients, allFoods);
  }, [adjustedIngredients, allFoods]);

  const changeRequest = recipe?.changeRequest;
  const isPending = changeRequest?.status === 'pending';
  const lineageMeta = useMemo(() => {
    const userRecipeType = recipe?.user_recipe_type || null;
    const isVariantNode = (
      userRecipeType === 'variant' ||
      recipe?.type === 'variant' ||
      Boolean(recipe?.source_diet_plan_recipe_id) ||
      Boolean(recipe?.parent_user_recipe_id)
    );
    const isPlanVersionNode = Boolean(recipe?.parent_diet_plan_recipe_id);
    const variantHint = recipe?.variant_label?.trim() || null;

    let variantSubtitle = null;
    if (isVariantNode) {
      if (recipe?.parent_user_recipe_id) variantSubtitle = 'Deriva de otra variante';
      else if (recipe?.source_diet_plan_recipe_id) variantSubtitle = 'Vinculada a receta base del plan';
      else variantSubtitle = 'Vinculada dentro del árbol personal';
    }

    return {
      isVariantNode,
      isPlanVersionNode,
      variantHint,
      variantSubtitle,
    };
  }, [recipe]);

  if (!recipe) return null;

  const renderLineageBadges = ({ compact = false } = {}) => {
    if (!lineageMeta.isVariantNode && !lineageMeta.isPlanVersionNode && !lineageMeta.variantHint) return null;

    return (
      <div className={cn('flex flex-wrap items-center gap-1.5', compact ? 'mt-1' : 'mt-1.5')}>
        {lineageMeta.isVariantNode && (
          <span className="inline-flex items-center rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-cyan-700 dark:text-cyan-200">
            <GitBranch className="mr-1 h-3 w-3" />
            Variante vinculada
          </span>
        )}
        {lineageMeta.isPlanVersionNode && (
          <span className="inline-flex items-center rounded-full border border-amber-500/45 bg-amber-500/12 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-200">
            <Link2 className="mr-1 h-3 w-3" />
            Versión del plan
          </span>
        )}
        {lineageMeta.variantHint && (
          <span className="inline-flex items-center rounded-full border border-cyan-600/35 bg-card/80 px-2 py-0.5 text-[10px] font-medium text-cyan-700 dark:text-cyan-100">
            {lineageMeta.variantHint}
          </span>
        )}
        {lineageMeta.isVariantNode && lineageMeta.variantSubtitle && !compact && (
          <span className="text-[11px] text-cyan-800/80 dark:text-cyan-200/80">
            {lineageMeta.variantSubtitle}
          </span>
        )}
      </div>
    );
  };

  const macroDisplay = (
    <div className={cn(
        "flex items-center gap-x-3 gap-y-1 text-sm font-mono flex-wrap drop-shadow-md",
        isListView ? '' : 'justify-around mt-2 text-xs'
    )}>
      <span className={cn("flex items-center", adjustment ? "text-cyan-700 dark:text-cyan-300" : "text-orange-500")} title="Calorías"><CaloriesIcon className="w-4 h-4 mr-1"/>{Math.round(macros.calories || 0)}</span>
      <span className={cn("flex items-center", adjustment ? "text-cyan-700 dark:text-cyan-300" : "text-red-500")} title="Proteínas"><ProteinIcon className="w-4 h-4 mr-1"/>{Math.round(macros.proteins || 0)}g</span>
      <span className={cn("flex items-center", adjustment ? "text-cyan-700 dark:text-cyan-300" : "text-yellow-500")} title="Carbohidratos"><CarbsIcon className="w-4 h-4 mr-1"/>{Math.round(macros.carbs || 0)}g</span>
      <span className={cn("flex items-center", adjustment ? "text-cyan-700 dark:text-cyan-300" : "text-green-500")} title="Grasas"><FatsIcon className="w-4 h-4 mr-1"/>{Math.round(macros.fats || 0)}g</span>
    </div>
  );

  const TitleWithTooltip = ({ children }) => {
    if (isSafe || !isAdminView) {
      return children;
    }
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{children}</TooltipTrigger>
          <TooltipContent className="bg-red-900 border-red-700 text-white max-w-xs z-50">
            <p className="font-bold mb-1">Conflicto de receta detectado</p>
            <p className="text-sm">Contiene: {Array.from(unsafeFoodsSet).join(', ')}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };
  
  const bgStyle = imageUrl
    ? { backgroundImage: `url(${imageUrl})` }
    : {
        background: isDark
          ? 'linear-gradient(135deg, hsl(220 16% 22%) 0%, hsl(222 20% 16%) 100%)'
          : 'linear-gradient(135deg, hsl(0 0% 100%) 0%, hsl(210 33% 96%) 100%)',
      };

  if (isListView) {
    return (
      <RecipeCardBackground
        className={cn(
          'relative group h-full rounded-xl overflow-hidden shadow-lg border transition-all',
          (lineageMeta.isVariantNode || lineageMeta.isPlanVersionNode) && 'ring-1',
          lineageMeta.isVariantNode && 'ring-cyan-500/45',
          !lineageMeta.isVariantNode && lineageMeta.isPlanVersionNode && 'ring-amber-500/45',
          isSafe
            ? (isPrivate
              ? 'border-border hover:border-violet-400/50 hover:shadow-violet-500/10'
              : (isPending ? 'border-purple-700/50' : 'border-border hover:border-green-500/50 hover:shadow-green-500/10'))
            : 'border-red-500/60 hover:border-red-500 hover:shadow-red-500/10'
        )}
        backgroundStyle={bgStyle}
        overlayClassName={cn(
          imageUrl
            ? (isDark ? 'bg-black/45' : 'bg-white/30')
            : (
              isPrivate
                ? (isDark ? 'bg-violet-900/20' : 'bg-violet-200/35')
                : (!isSafe ? (isDark ? 'bg-red-900/40' : 'bg-red-200/45') : (isDark ? 'bg-black/10' : 'bg-transparent'))
            )
        )}
        gradientClassName={cn(
          isDark && 'bg-[linear-gradient(to_top,rgba(0,0,0,0.48)_0%,rgba(0,0,0,0.38)_40%,rgba(0,0,0,0)_100%)]'
        )}
      >
        {(lineageMeta.isVariantNode || lineageMeta.isPlanVersionNode) && (
          <div
            className={cn(
              'pointer-events-none absolute left-0 top-0 z-20 h-full w-1.5',
              lineageMeta.isVariantNode
                ? 'bg-gradient-to-b from-cyan-300/90 via-cyan-400/80 to-cyan-600/70'
                : 'bg-gradient-to-b from-amber-200/90 via-amber-400/80 to-amber-600/70'
            )}
          />
        )}
        <button onClick={() => handleRecipeClick && handleRecipeClick({ ...recipe, is_private_recipe: isPrivate }, adjustment)} className="w-full h-full text-left p-4 flex flex-col justify-between">
          <RecipeCardPanel className="p-3 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                {isPending && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="mt-1.5 cursor-pointer">
                          <Hourglass className="w-4 h-4 drop-shadow-md" style={{color: 'rgb(163 87 161)'}} />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Cambio solicitado pendiente</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                <TitleWithTooltip>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={cn(
                      'text-xl font-bold line-clamp-2 flex-1 min-w-0',
                      !isSafe && isAdminView ? 'text-red-400' : (isPending ? 'text-[rgb(159,102,163)]' : 'text-foreground dark:text-white')
                    )}>
                      <HighlightedText text={recipeName} highlight={searchQuery} />
                    </p>
                    {unsafeFoodsSet.size > 0 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/15 dark:bg-red-900/40 text-red-700 dark:text-red-400 border border-red-500/35 backdrop-blur-sm">
                        <AlertTriangle className="w-3 h-3 mr-1" /> {unsafeFoodsSet.size}
                      </span>
                    )}
                  </div>
                </TitleWithTooltip>
                {renderLineageBadges()}
              </div>
              {adjustment && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Scale className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent className="bg-blue-800 border-blue-600 text-white z-50">
                      <p>Receta equilibrada</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {Math.round(recipePrepTime)}m
              </span>
              <span className="flex items-center gap-1">
                <ChefHat className="w-3 h-3" />
                {recipeDifficulty}
              </span>
            </div>
            <p className="text-sm line-clamp-3 text-foreground/85 dark:text-gray-200">
              {ingredientList.length > 0
                ? ingredientList.reduce((prev, curr) => [prev, ', ', curr])
                : 'Sin ingredientes'}
            </p>
          </RecipeCardPanel>

          {!hideMacros && (
            <RecipeCardPanel className="p-2 mt-3 flex justify-between items-center relative z-20">
              {macroDisplay}
              {selectionIndicator}
            </RecipeCardPanel>
          )}
        </button>

        {handleRemoveRecipe && (
          <button 
            onClick={(e) => { e.stopPropagation(); handleRemoveRecipe(recipe.id, isPrivate); }} 
            className={cn(
              'absolute z-20 top-2 right-2 bg-red-600/70 text-white rounded-full p-1 transition-opacity hover:bg-red-500 backdrop-blur-sm',
              'md:opacity-0 md:group-hover:opacity-100 opacity-100'
            )}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </RecipeCardBackground>
    );
  }

  // Week view (compact)
  return (
    <RecipeCardBackground
      className={cn(
        'relative group flex h-24 overflow-hidden rounded-lg shadow-lg border',
        (lineageMeta.isVariantNode || lineageMeta.isPlanVersionNode) && 'ring-1',
        lineageMeta.isVariantNode && 'ring-cyan-500/45',
        !lineageMeta.isVariantNode && lineageMeta.isPlanVersionNode && 'ring-amber-500/45',
        isSafe ? 'border-border' : 'border-red-500/60'
      )}
      backgroundStyle={bgStyle}
      overlayClassName={cn(
        imageUrl
          ? (isDark ? 'bg-black/35' : 'bg-white/25')
          : (isPrivate ? (isDark ? 'bg-violet-900/30' : 'bg-violet-200/40') : (!isSafe ? (isDark ? 'bg-red-900/50' : 'bg-red-200/45') : (isDark ? 'bg-black/25' : 'bg-transparent')))
      )}
      gradientClassName={cn(
        isDark && 'bg-[linear-gradient(to_top,rgba(0,0,0,0)_0%,rgba(0,0,0,0.29)_40%,rgba(0,0,0,0)_100%)]'
      )}
    >
      {(lineageMeta.isVariantNode || lineageMeta.isPlanVersionNode) && (
        <div
          className={cn(
            'pointer-events-none absolute left-0 top-0 z-20 h-full w-1',
            lineageMeta.isVariantNode
              ? 'bg-gradient-to-b from-cyan-300/90 via-cyan-400/80 to-cyan-600/70'
              : 'bg-gradient-to-b from-amber-200/90 via-amber-400/80 to-amber-600/70'
          )}
        />
      )}
      <button onClick={() => handleRecipeClick && handleRecipeClick({ ...recipe, is_private_recipe: isPrivate }, adjustment)} className="block w-full h-full text-left p-2.5 pr-12">
        <RecipeCardPanel className="p-2.5 h-full flex flex-col justify-between">
          <div className="flex justify-between items-start flex-wrap gap-x-2">
            <div className="flex items-center gap-2 min-w-0">
              {changeRequest?.status === 'pending' && (
                <Hourglass className="w-3 h-3 text-purple-400 animate-pulse" />
              )}
              <TitleWithTooltip>
                <p className={cn(
                  'font-medium text-sm whitespace-normal line-clamp-2',
                  !isSafe && isAdminView ? 'text-red-400' : 'text-foreground dark:text-white'
                )}>
                  {recipeName}
                </p>
              </TitleWithTooltip>
            </div>
            <div className="flex items-center gap-1">
              {adjustment && (
                <Scale className="w-3 h-3 text-blue-400" title="Receta equilibrada" />
              )}
            </div>
          </div>
          {renderLineageBadges({ compact: true })}
          <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {Math.round(recipePrepTime)}m
            </span>
            <span className="flex items-center gap-1">
              <ChefHat className="w-3 h-3" />
              {recipeDifficulty}
            </span>
          </div>
        </RecipeCardPanel>
      </button>
      {handleRemoveRecipe && (
        <button
          onClick={(e) => { e.stopPropagation(); handleRemoveRecipe(); }}
          className="absolute bottom-0 right-0 z-20 h-10 w-10 flex items-center justify-center bg-red-500/45 hover:bg-red-500/65 transition-colors backdrop-blur-sm rounded-tl-lg rounded-br-lg"
        >
          <X className="w-4 h-4 text-white" />
        </button>
      )}
    </RecipeCardBackground>
  );
};

export default RecipeCard;
