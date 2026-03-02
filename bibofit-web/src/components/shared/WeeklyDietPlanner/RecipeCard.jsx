
import React, { useMemo } from 'react';
import { X, Scale, Hourglass, AlertTriangle, Clock, ChefHat } from 'lucide-react';
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
  const recipeName = useMemo(() => {
    if (!recipe) return "Receta Desconocida";
    if (recipe.is_private_recipe || recipe.type === 'private_recipe') {
      return recipe.name || "Receta Privada";
    }
    return recipe.custom_name || recipe.recipe?.name || recipe.name || "Receta";
  }, [recipe]);

  const recipeIngredients = useMemo(() => {
    if (!recipe) return [];
    if (recipe.is_private_recipe || recipe.type === 'private_recipe') {
      return recipe.private_recipe_ingredients || [];
    }
    if (recipe.custom_ingredients && recipe.custom_ingredients.length > 0) {
        return recipe.custom_ingredients;
    }
    return recipe.recipe?.recipe_ingredients || recipe.recipe_ingredients || [];
  }, [recipe]);

  const recipeDifficulty = useMemo(() => {
    if (!recipe) return 'Fácil';
    if (recipe.is_private_recipe || recipe.type === 'private_recipe') {
      return recipe.difficulty || 'Fácil';
    }
    return recipe.custom_difficulty || recipe.difficulty || recipe.recipe?.difficulty || 'Fácil';
  }, [recipe]);

  const recipePrepTime = useMemo(() => {
    if (!recipe) return 0;
    if (recipe.is_private_recipe || recipe.type === 'private_recipe') {
      return recipe.prep_time_min ?? 0;
    }
    return recipe.custom_prep_time_min ?? recipe.prep_time_min ?? recipe.recipe?.prep_time_min ?? 0;
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
        
        const isUnsafe = unsafeFoodsSet.has(food.name);
        const isRecommended = recommendedFoodsSet.has(food.name);
        
        let className = "text-muted-foreground";
        if (isUnsafe) className = "text-red-700 dark:text-red-400 font-medium";
        else if (isRecommended) className = "text-green-700 dark:text-green-400 font-medium";
        
        return (
            <span key={ing.food_id || index} className={className}>
                <HighlightedText text={text} highlight={searchQuery} />
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

  if (!recipe) return null;

  const changeRequest = recipe.changeRequest;
  const isPending = changeRequest?.status === 'pending';
  const isPrivate = recipe.is_private_recipe || recipe.type === 'private_recipe';

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
