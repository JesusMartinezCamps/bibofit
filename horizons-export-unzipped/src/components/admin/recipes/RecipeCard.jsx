import React, { useMemo } from 'react';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, ChefHat, AlertTriangle, ThumbsUp, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import CaloriesIcon from '@/components/icons/CaloriesIcon';
import ProteinIcon from '@/components/icons/ProteinIcon';
import CarbsIcon from '@/components/icons/CarbsIcon';
import FatsIcon from '@/components/icons/FatsIcon';
import { getConflictInfo } from '@/lib/restrictionChecker';
import { calculateMacros } from '@/lib/macroCalculator';

const normalizeText = (text) => {
    return text
        ? text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
        : "";
};

const HighlightedText = ({ text, highlight }) => {
    if (!highlight || !text || !highlight.trim()) return text;

    const normalizedText = normalizeText(text);
    const normalizedHighlight = normalizeText(highlight);
    
    if (!normalizedText.includes(normalizedHighlight)) return text;

    // Safety check: if normalization changed length (e.g. ligatures), fallback to plain text to prevent slicing errors
    if (normalizedText.length !== text.length) {
         return text; 
    }

    const matchIndices = [];
    let startIndex = 0;
    let searchIndex = normalizedText.indexOf(normalizedHighlight, startIndex);

    while (searchIndex !== -1) {
        matchIndices.push({ start: searchIndex, end: searchIndex + normalizedHighlight.length });
        startIndex = searchIndex + normalizedHighlight.length;
        searchIndex = normalizedText.indexOf(normalizedHighlight, startIndex);
    }

    if (matchIndices.length === 0) return text;

    const result = [];
    let lastIndex = 0;

    matchIndices.forEach((match, i) => {
        if (match.start > lastIndex) {
            result.push(<span key={`text-${i}`}>{text.substring(lastIndex, match.start)}</span>);
        }
        result.push(
            <span key={`highlight-${i}`} className="bg-yellow-500/40 text-yellow-100 font-bold rounded px-0.5 shadow-[0_0_10px_rgba(234,179,8,0.2)]">
                {text.substring(match.start, match.end)}
            </span>
        );
        lastIndex = match.end;
    });

    if (lastIndex < text.length) {
        result.push(<span key="text-end">{text.substring(lastIndex)}</span>);
    }

    return <>{result}</>;
};

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
  isPlanner = false,
  userRestrictions,
  highlight = '',
  selected = false
}) => {
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

  const hasConflicts = conflicts?.sensitivities?.length > 0 || conflicts?.conditions?.length > 0;
  const hasRecommendations = recommendations?.conditions?.length > 0;

  const handleAddClick = (e) => {
    e.stopPropagation();
    if (!onAdd) return;
    if (hasConflicts && onEditConflict) {
      onEditConflict(recipe, conflicts);
    } else {
      onAdd(recipe);
    }
  };
  
  const themeClasses = {
      green: {
          badge: "bg-green-900/20 text-green-400 border-green-500/30",
          button: "bg-green-600/30 hover:bg-green-500 text-white",
          buttonConflict: "bg-red-600 hover:bg-red-500 text-white",
          border: "border-gray-800 hover:border-green-500/50"
      },
      sky: {
          badge: "bg-sky-900/20 text-sky-400 border-sky-500/30",
          button: "bg-sky-600 hover:bg-sky-500 text-white",
          buttonConflict: "bg-red-600 hover:bg-red-500 text-white",
          border: "border-gray-800 hover:border-sky-500/50"
      }
  }[themeColor] || themeClasses.green;

  return (
    <Card 
        style={
          recipe.image_url
            ? {
                backgroundImage: `linear-gradient(rgba(2, 6, 23, 0.9), rgba(2, 6, 23, 0.55)), url(${recipe.image_url})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : undefined
        }
        className={cn(
            "bg-[#12161d] transition-all duration-300 flex flex-col h-full group cursor-pointer relative overflow-hidden border",
            themeClasses.border,
            selected && "ring-2 ring-green-400/80 border-green-400"
        )}
        onClick={() => onCardClick && onCardClick(recipe)}
    >
      {recipe.is_private && (
          <div className="absolute top-2 right-2 z-10">
              <Lock className="w-4 h-4 text-gray-500" />
          </div>
      )}
      <CardHeader className="p-4 pb-2 space-y-2">
        <div className="flex justify-between items-start">
          <h3 className="font-bold text-lg text-gray-100 leading-tight line-clamp-2 group-hover:text-white transition-colors">
            <HighlightedText text={recipe.name} highlight={highlight} />
          </h3>
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
            <div className="flex items-center gap-3 text-xs text-gray-400">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {recipe.prep_time_min || 0}m</span>
                <span className="flex items-center gap-1">
                    <ChefHat className="w-3 h-3" /> 
                    <HighlightedText text={recipe.difficulty || 'Fácil'} highlight={highlight} />
                </span>
            </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-2 flex-grow">
        <div className="space-y-1 mb-4">
             <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-2">Ingredientes:</p>
             <ul className="space-y-1">
                {(recipe.recipe_ingredients || []).slice(0, 6).map((ing, i) => {
                    let ingredientColorClass = "text-gray-400"; // Default
                    let conflictIcon = null;

                    if (userRestrictions && ing.food) {
                        const conflictInfo = getConflictInfo(ing.food, userRestrictions);
                        if (conflictInfo) {
                            if (['condition_avoid', 'sensitivity', 'individual_restriction', 'non-preferred'].includes(conflictInfo.type)) {
                                ingredientColorClass = "text-red-400 font-medium";
                                conflictIcon = <AlertTriangle className="w-3 h-3 inline ml-1 text-red-500" />;
                            } else if (['condition_recommend', 'preferred'].includes(conflictInfo.type)) {
                                ingredientColorClass = "text-green-400 font-medium";
                                conflictIcon = <ThumbsUp className="w-3 h-3 inline ml-1 text-green-500" />;
                            }
                        }
                    }
                    
                    return (
                        <li key={i} className={cn("text-xs truncate flex items-center", ingredientColorClass)}>
                            <span>• <HighlightedText text={ing.food?.name || 'Ingrediente desconocido'} highlight={highlight} /></span>
                            {conflictIcon}
                        </li>
                    );
                })}
                {(recipe.recipe_ingredients || []).length > 6 && (
                    <li className="text-xs text-gray-500 italic pl-2">
                        +{(recipe.recipe_ingredients.length - 6)} más...
                    </li>
                )}
             </ul>
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0 flex flex-col gap-3 mt-auto">
        <div className="flex items-center justify-between w-full text-xs text-gray-400 bg-slate-900/50 p-2 rounded-md border border-slate-800">
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
        </div>

        {onAdd && (
          <Button 
              className={cn(
                  "w-full h-9 text-sm font-medium shadow-lg shadow-black/20",
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
      </CardFooter>
    </Card>
  );
};

export default RecipeCard;
