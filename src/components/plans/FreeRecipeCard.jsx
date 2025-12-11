import React, { useMemo } from 'react';
import { X, UtensilsCrossed, Hourglass } from 'lucide-react';
import CaloriesIcon from '@/components/icons/CaloriesIcon';
import ProteinIcon from '@/components/icons/ProteinIcon';
import CarbsIcon from '@/components/icons/CarbsIcon';
import FatsIcon from '@/components/icons/FatsIcon';
import { cn } from '@/lib/utils';
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

    // Safety check: if normalization changed length (rare for standard latin/accented text), 
    // fallback to plain text to avoid index mismatch errors during slicing.
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

const FreeRecipeCard = ({
  freeMeal,
  allFoods,
  handleCardClick,
  handleRemove,
  isListView = false,
  selectionIndicator,
  searchQuery = '',
}) => {
  const { name, free_recipe_ingredients: ingredients, status } = freeMeal;

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
      const foodDetails = ing.food || ing.user_created_food;
      if (!foodDetails) return null;
      const unit = foodDetails.food_unit === 'unidades' ? 'ud' : 'g';
      const text = `${foodDetails.name} (${Math.round(ing.grams || 0)}${unit})`;
      
      return (
          <span key={index}>
             <HighlightedText text={text} highlight={searchQuery} />
          </span>
      );
    }).filter(Boolean);
  }, [ingredients, searchQuery]);

  if (isListView) {
    return (
      <div className="relative group h-full">
        <button
          onClick={() => handleCardClick(freeMeal)}
          className="w-full h-full text-left bg-gradient-to-br from-blue-900/40 via-slate-800/40 to-slate-800/60 p-5 rounded-xl transition-all flex flex-col justify-between shadow-lg border border-sky-700/50 hover:border-sky-500/50 hover:shadow-sky-500/10"
        >
          <div className="flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                {status === 'pending' ? (
                  <Hourglass className="w-5 h-5 text-sky-400" />
                ) : (
                  <UtensilsCrossed className="w-5 h-5 text-sky-400" />
                )}
                <p className="text-xl font-bold mb-2 line-clamp-2 text-white">
                  <HighlightedText text={name || 'Receta Libre'} highlight={searchQuery} />
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-400 line-clamp-3">
              {ingredientList.length > 0 
                ? ingredientList.reduce((prev, curr) => [prev, ', ', curr])
                : 'Sin ingredientes'
              }
            </p>
          </div>
          <div className="mt-4 flex justify-between items-center">
            <div className="flex items-center gap-x-3 text-sm font-mono flex-wrap">
              <span className="flex items-center text-orange-400" title="Calorías"><CaloriesIcon className="w-4 h-4 mr-1.5" />{Math.round(macros.calories || 0)}</span>
              <span className="flex items-center text-red-400" title="Proteínas"><ProteinIcon className="w-4 h-4 mr-1.5" />{Math.round(macros.proteins || 0)}g</span>
              <span className="flex items-center text-yellow-400" title="Carbohidratos"><CarbsIcon className="w-4 h-4 mr-1.5" />{Math.round(macros.carbs || 0)}g</span>
              <span className="flex items-center text-green-400" title="Grasas"><FatsIcon className="w-4 h-4 mr-1.5" />{Math.round(macros.fats || 0)}g</span>
            </div>
            {selectionIndicator}
          </div>
        </button>
        {handleRemove && (
          <button
            onClick={(e) => { e.stopPropagation(); handleRemove(); }}
            className="absolute -top-2 -right-2 bg-red-600/90 text-white rounded-full p-1 transition-colors hover:bg-red-500"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  // Week view (original compact version)
  return (
    <div className="relative group flex overflow-hidden rounded-lg shadow-lg border border-sky-700/50 bg-gradient-to-br from-blue-900/40 via-slate-800/40 to-slate-800/60">
      <button onClick={() => handleCardClick(freeMeal)} className="flex-1 text-left p-3 w-4/5">
        <div className="flex items-center gap-2 mb-1">
          {status === 'pending' ? (
            <Hourglass className="w-4 h-4 text-sky-400" />
          ) : (
            <UtensilsCrossed className="w-4 h-4 text-sky-400" />
          )}
          <p className="text-white font-medium text-sm whitespace-normal truncate">{name || 'Receta Libre'}</p>
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