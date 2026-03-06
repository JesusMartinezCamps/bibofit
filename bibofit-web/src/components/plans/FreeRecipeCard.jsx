import React, { useMemo } from 'react';
import { X, UtensilsCrossed, Hourglass, Clock, ChefHat } from 'lucide-react';
import CaloriesIcon from '@/components/icons/CaloriesIcon';
import ProteinIcon from '@/components/icons/ProteinIcon';
import CarbsIcon from '@/components/icons/CarbsIcon';
import FatsIcon from '@/components/icons/FatsIcon';
import { calculateMacros } from '@/lib/macroCalculator';
import HighlightedText from '@/components/shared/HighlightedText';
import { FREE_RECIPE_STATUS, normalizeFreeRecipeStatus } from '@/lib/recipeEntity';
import { cn } from '@/lib/utils';
import { RecipeCardBackground, RecipeCardPanel } from '@/components/shared/recipe-card/RecipeCardBase';
import { useTheme } from '@/contexts/ThemeContext';
import { getIngredientHighlightForQuery } from '@/lib/recipeSearch';

const FreeRecipeCard = ({
  freeMeal,
  allFoods,
  handleCardClick,
  handleRemove,
  isListView = false,
  selectionIndicator,
  searchQuery = '',
}) => {
  const { isDark } = useTheme();
  const { name, recipe_ingredients: ingredients, status, prep_time_min, difficulty } = freeMeal;
  const normalizedStatus = normalizeFreeRecipeStatus(status);

  const macros = useMemo(() => {
    if (!ingredients || !allFoods) {
      return { calories: 0, proteins: 0, carbs: 0, fats: 0 };
    }
    const ingredientsWithQuantity = ingredients.map(ing => ({
      ...ing,
      quantity: ing.grams,
    }));
    return calculateMacros(ingredientsWithQuantity, allFoods);
  }, [ingredients, allFoods]);

  const ingredientList = useMemo(() => {
    if (!ingredients) return [];
    return ingredients.map((ing, index) => {
      const foodDetails = ing.food;
      if (!foodDetails) return null;
      const unit = foodDetails.food_unit === 'unidades' ? 'ud' : 'g';
      const text = `${foodDetails.name} (${Math.round(ing.grams || 0)}${unit})`;
      const ingredientHighlight = getIngredientHighlightForQuery({
        food: foodDetails,
        query: searchQuery,
        allowFuzzy: true,
      });
      
      return (
          <span key={index}>
             <HighlightedText text={text} highlight={ingredientHighlight} />
          </span>
      );
    }).filter(Boolean);
  }, [ingredients, searchQuery]);

  const listBgStyle = useMemo(
    () =>
      isDark
        ? { background: 'linear-gradient(135deg, rgba(12,74,110,0.35) 0%, rgba(15,23,42,0.65) 45%, rgba(8,47,73,0.75) 100%)' }
        : { background: 'linear-gradient(135deg, rgba(240,249,255,0.96) 0%, rgba(224,242,254,0.92) 45%, rgba(186,230,253,0.9) 100%)' },
    [isDark]
  );

  if (isListView) {
    return (
      <RecipeCardBackground
        className="relative group h-full rounded-xl overflow-hidden shadow-lg border border-sky-300/70 dark:border-sky-700/50 transition-all hover:border-sky-500/70 hover:shadow-sky-500/10"
        backgroundStyle={listBgStyle}
        overlayClassName="bg-sky-100/20 dark:bg-sky-900/10"
      >
        <button onClick={() => handleCardClick(freeMeal)} className="w-full h-full text-left p-4 flex flex-col justify-between">
          <RecipeCardPanel className="p-3 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                {normalizedStatus === FREE_RECIPE_STATUS.PENDING ? (
                  <Hourglass className="w-5 h-5 text-sky-700 dark:text-sky-300 mt-0.5" />
                ) : (
                  <UtensilsCrossed className="w-5 h-5 text-sky-700 dark:text-sky-300 mt-0.5" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full border border-sky-500/45 bg-sky-200/50 dark:bg-sky-500/15 px-2 py-0.5 text-[11px] font-medium text-sky-800 dark:text-sky-100">
                      Receta libre
                    </span>
                    {normalizedStatus === FREE_RECIPE_STATUS.PENDING && (
                      <span className="inline-flex items-center rounded-full border border-cyan-500/45 bg-cyan-200/50 dark:bg-cyan-500/15 px-2 py-0.5 text-[11px] font-medium text-cyan-800 dark:text-cyan-100">
                        Pendiente
                      </span>
                    )}
                  </div>
                  <p className="text-xl font-bold line-clamp-2 mt-1 text-sky-900 dark:text-sky-100">
                    <HighlightedText text={name || 'Receta Libre'} highlight={searchQuery} />
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-sky-800/80 dark:text-sky-100/80">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {Math.round(prep_time_min ?? 0)}m
              </span>
              <span className="flex items-center gap-1">
                <ChefHat className="w-3 h-3" />
                {difficulty || 'Fácil'}
              </span>
            </div>

            <p className="text-sm line-clamp-3 text-sky-900/80 dark:text-sky-50/90">
              {ingredientList.length > 0
                ? ingredientList.reduce((prev, curr) => [prev, ', ', curr])
                : 'Sin ingredientes'}
            </p>
          </RecipeCardPanel>

          <RecipeCardPanel className="p-2 mt-3 flex justify-between items-center relative z-20">
            <div className="flex items-center gap-x-3 gap-y-1 text-sm font-mono flex-wrap">
              <span className="flex items-center text-orange-600 dark:text-orange-300" title="Calorías"><CaloriesIcon className="w-4 h-4 mr-1.5" />{Math.round(macros.calories || 0)}</span>
              <span className="flex items-center text-red-600 dark:text-red-300" title="Proteínas"><ProteinIcon className="w-4 h-4 mr-1.5" />{Math.round(macros.proteins || 0)}g</span>
              <span className="flex items-center text-yellow-700 dark:text-yellow-300" title="Carbohidratos"><CarbsIcon className="w-4 h-4 mr-1.5" />{Math.round(macros.carbs || 0)}g</span>
              <span className="flex items-center text-green-700 dark:text-green-300" title="Grasas"><FatsIcon className="w-4 h-4 mr-1.5" />{Math.round(macros.fats || 0)}g</span>
            </div>
            {selectionIndicator}
          </RecipeCardPanel>
        </button>

        {handleRemove && (
          <button
            onClick={(e) => { e.stopPropagation(); handleRemove(); }}
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

  // Week view (original compact version)
  return (
    <div className="relative group flex overflow-hidden rounded-lg shadow-lg border border-sky-700/50 bg-gradient-to-br from-blue-900/40 via-slate-800/40 to-slate-800/60">
      <button onClick={() => handleCardClick(freeMeal)} className="flex-1 text-left p-3 w-4/5">
        <div className="flex items-center gap-2 mb-1">
          {normalizedStatus === FREE_RECIPE_STATUS.PENDING ? (
            <Hourglass className="w-4 h-4 text-sky-400" />
          ) : (
            <UtensilsCrossed className="w-4 h-4 text-sky-400" />
          )}
          <p className="text-sky-100 font-medium text-sm whitespace-normal truncate">{name || 'Receta Libre'}</p>
        </div>
        <div className="mt-1 flex items-center gap-3 text-[11px] text-sky-100/85">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {Math.round(prep_time_min ?? 0)}m
          </span>
          <span className="flex items-center gap-1">
            <ChefHat className="w-3 h-3" />
            {difficulty || 'Fácil'}
          </span>
        </div>
      </button>
      {handleRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); handleRemove(); }}
          className="w-1/5 flex items-center justify-center bg-red-500/20 hover:bg-red-500/40 transition-colors"
        >
          <X className="w-4 h-4 text-red-400" />
        </button>
      )}
    </div>
  );
};

export default FreeRecipeCard;
