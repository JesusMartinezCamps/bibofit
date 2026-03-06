import React, { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, ChefHat, AlertTriangle, ThumbsUp, Lock, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import CaloriesIcon from '@/components/icons/CaloriesIcon';
import ProteinIcon from '@/components/icons/ProteinIcon';
import CarbsIcon from '@/components/icons/CarbsIcon';
import FatsIcon from '@/components/icons/FatsIcon';
import { calculateMacros } from '@/lib/macroCalculator';
import HighlightedText from '@/components/shared/HighlightedText';
import { analyzeRecipeConflicts } from '@/lib/recipeConflictAnalyzer';
import { RecipeCardBackground, RecipeCardPanel } from '@/components/shared/recipe-card/RecipeCardBase';
import { useTheme } from '@/contexts/ThemeContext';
import { getIngredientHighlightForQuery } from '@/lib/recipeSearch';

const RecipeCard = ({ 
  recipe, 
  onAdd, 
  onEditConflict, 
  conflicts, 
  recommendations, 
  allFoods, 
  addButtonText = "Añadir",
  themeColor = "green",
  onCardClick,
  onDelete,
  isPlanner = false,
  userRestrictions,
  highlight = '',
  selected = false
}) => {
  const { isDark } = useTheme();
  // Calculate macros using the robust utility
  // Prioritize DB macros if available, otherwise calculate from ingredients
  const macros = useMemo(() => {
    if (recipe.recipe_macros && recipe.recipe_macros.length > 0) {
        return recipe.recipe_macros[0];
    }
    
    if (recipe.recipe_ingredients && recipe.recipe_ingredients.length > 0) {
        return calculateMacros(recipe.recipe_ingredients, allFoods || []);
    }

    return {
      calories: 0,
      proteins: 0,
      carbs: 0,
      fats: 0
    };
  }, [recipe.recipe_macros, recipe.recipe_ingredients, allFoods]);

  const analysis = useMemo(() => analyzeRecipeConflicts({
    recipe,
    allFoods,
    userRestrictions
  }), [recipe, allFoods, userRestrictions]);

  const effectiveConflicts = userRestrictions ? analysis.conflicts : (conflicts || analysis.conflicts);
  const effectiveRecommendations = userRestrictions ? analysis.recommendations : (recommendations || analysis.recommendations);
  const hasConflicts = effectiveConflicts?.sensitivities?.length > 0 || effectiveConflicts?.conditions?.length > 0;
  const hasRecommendations = effectiveRecommendations?.conditions?.length > 0;
  const imageUrl = recipe?.image_url || recipe?.img_url || recipe?.recipe?.image_url || recipe?.recipe?.img_url || null;
  const backgroundStyle = imageUrl
    ? { backgroundImage: `url(${imageUrl})` }
    : {
      background: isDark
        ? 'linear-gradient(135deg, hsl(220 16% 22%) 0%, hsl(222 20% 16%) 100%)'
        : 'linear-gradient(135deg, hsl(0 0% 100%) 0%, hsl(210 33% 96%) 100%)',
    };

  const handleAddClick = (e) => {
    e.stopPropagation();
    if (!onAdd) return;
    if (hasConflicts && onEditConflict) {
      onEditConflict(recipe, effectiveConflicts);
    } else {
      onAdd(recipe);
    }
  };
  
  const themeClasses = {
      green: {
          button: "bg-green-600/30 hover:bg-green-500 text-white",
          buttonConflict: "bg-red-600 hover:bg-red-500 text-white",
          border: "border-border hover:border-green-500/50"
      },
      sky: {
          button: "bg-sky-600 hover:bg-sky-500 text-white",
          buttonConflict: "bg-red-600 hover:bg-red-500 text-white",
          border: "border-border hover:border-sky-500/50"
      }
  }[themeColor] || themeClasses.green;

  return (
    <RecipeCardBackground
      className={cn(
        'relative group h-full rounded-xl overflow-hidden border shadow-lg transition-all duration-300 cursor-pointer flex flex-col',
        themeClasses.border,
        selected && 'ring-2 ring-green-400/80 border-green-400'
      )}
      backgroundStyle={backgroundStyle}
      overlayClassName={imageUrl ? (isDark ? 'bg-black/55' : 'bg-white/35') : (isDark ? 'bg-black/10' : 'bg-transparent')}
      gradientStyle={{
        background: isDark
          ? 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0, 0, 0, 0.28) 40%, rgba(0,0,0,0) 100%)'
          : 'linear-gradient(to top, rgba(255,255,255,0.55) 0%, rgba(255, 255, 255, 0.12) 40%, rgba(255,255,255,0) 100%)',
      }}
      onClick={() => onCardClick && onCardClick(recipe)}
    >
      {recipe.is_private && (
        <div className="absolute top-2 right-2 z-20">
          <Lock className="w-4 h-4 text-muted-foreground" />
        </div>
      )}

      <div className="flex h-full flex-col p-4 gap-2">
        <RecipeCardPanel className="p-3 space-y-2">
          <div className="flex items-start gap-2">
            <h3 className="font-bold text-lg text-foreground leading-tight line-clamp-2 transition-colors flex-1 min-w-0">
              <HighlightedText text={recipe.name} highlight={highlight} />
            </h3>
            {onDelete && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 -mr-1 -mt-1 text-red-400 hover:text-red-300 hover:bg-red-900/30 shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(recipe);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {hasConflicts && (
              <Badge variant="outline" className="bg-red-900/20 text-red-400 border-red-500/30 flex items-center gap-1 px-2 py-0.5 h-6">
                <AlertTriangle className="w-3 h-3" />
                Conflictos
              </Badge>
            )}
            {hasRecommendations && (
              <Badge variant="outline" className="bg-green-900/20 text-green-400 border-green-500/30 flex items-center gap-1 px-2 py-0.5 h-6">
                <ThumbsUp className="w-3 h-3" />
                Recomendado
              </Badge>
            )}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {recipe.prep_time_min || 0}m</span>
              <span className="flex items-center gap-1">
                <ChefHat className="w-3 h-3" />
                <HighlightedText text={recipe.difficulty || 'Fácil'} highlight={highlight} />
              </span>
            </div>
          </div>
        </RecipeCardPanel>

        <RecipeCardPanel className="p-3 flex-grow space-y-1">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">Ingredientes:</p>
          <ul className="space-y-1">
            {(recipe.recipe_ingredients || []).slice(0, 6).map((ing, i) => {
              let ingredientColorClass = 'text-muted-foreground';
              let conflictIcon = null;

              if (ing.food) {
                const isUnsafe = analysis.unsafeFoodNames.has(ing.food.name);
                const isRecommended = analysis.recommendedFoodNames.has(ing.food.name);
                if (isUnsafe) {
                  ingredientColorClass = 'text-red-400 font-medium';
                  conflictIcon = <AlertTriangle className="w-3 h-3 inline ml-1 text-red-500" />;
                } else if (isRecommended) {
                  ingredientColorClass = 'text-green-400 font-medium';
                  conflictIcon = <ThumbsUp className="w-3 h-3 inline ml-1 text-green-500" />;
                }
              }
              const ingredientHighlight = getIngredientHighlightForQuery({
                food: ing.food,
                query: highlight,
                allowFuzzy: true,
              });

              return (
                <li key={i} className={cn('text-xs truncate flex items-center', ingredientColorClass)}>
                  <span>• <HighlightedText text={ing.food?.name || 'Ingrediente desconocido'} highlight={ingredientHighlight} /></span>
                  {conflictIcon}
                </li>
              );
            })}
            {(recipe.recipe_ingredients || []).length > 6 && (
              <li className="text-xs text-muted-foreground italic pl-2">
                +{(recipe.recipe_ingredients.length - 6)} más...
              </li>
            )}
          </ul>
        </RecipeCardPanel>

        <div className="mt-auto space-y-3">
          <RecipeCardPanel className="p-2 flex items-center justify-between w-full text-xs text-muted-foreground">
            <div className="flex items-center gap-1" title="Calorías">
              <CaloriesIcon className="w-3 h-3 text-orange-400" />
              <span>{Math.round(macros.calories)}</span>
            </div>
            <div className="flex items-center gap-1" title="Proteínas">
              <ProteinIcon className="w-3 h-3 text-red-400" />
              <span>{Math.round(macros.proteins)}g</span>
            </div>
            <div className="flex items-center gap-1" title="Carbohidratos">
              <CarbsIcon className="w-3 h-3 text-yellow-400" />
              <span>{Math.round(macros.carbs)}g</span>
            </div>
            <div className="flex items-center gap-1" title="Grasas">
              <FatsIcon className="w-3 h-3 text-green-400" />
              <span>{Math.round(macros.fats)}g</span>
            </div>
          </RecipeCardPanel>

          {onAdd && (
            <Button
              className={cn(
                'w-full h-9 text-sm font-medium shadow-lg shadow-black/20',
                hasConflicts && onEditConflict ? themeClasses.buttonConflict : themeClasses.button
              )}
              onClick={handleAddClick}
            >
              {hasConflicts && onEditConflict ? (
                <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Revisar Conflictos</span>
              ) : (
                addButtonText
              )}
            </Button>
          )}
        </div>
      </div>
    </RecipeCardBackground>
  );
};

export default RecipeCard;
