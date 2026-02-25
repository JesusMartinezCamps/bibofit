import React, { useMemo } from 'react';
import { X, Calendar } from 'lucide-react';
import CaloriesIcon from '@/components/icons/CaloriesIcon';
import ProteinIcon from '@/components/icons/ProteinIcon';
import CarbsIcon from '@/components/icons/CarbsIcon';
import FatsIcon from '@/components/icons/FatsIcon';
import { cn } from '@/lib/utils';
import { calculateMacros as calculateMacrosFromIngredients } from '@/lib/macroCalculator';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const FreeMealCard = ({ freeMeal, handleCardClick, handleRemove, isListView = false, selectionIndicator, allFoods = [] }) => {
  const macros = useMemo(() => {
    if (!freeMeal || !freeMeal.ingredients) {
      return { calories: 0, proteins: 0, carbs: 0, fats: 0 };
    }
    // Pass allFoods to calculator to find food details if not present on ingredient
    return calculateMacrosFromIngredients(freeMeal.ingredients, allFoods);
  }, [freeMeal, allFoods]);

  const ingredientList = useMemo(() => {
    if (!freeMeal || !freeMeal.ingredients) return [];
    return freeMeal.ingredients.map(ing => {
      const foodDetails = ing.food || allFoods.find(f => String(f.id) === String(ing.food_id));
      const unit = foodDetails?.food_unit === 'unidades' ? 'ud' : 'g';
      return `${foodDetails?.name || 'Ingrediente desconocido'} (${Math.round(ing.grams || 0)}${unit})`;
    }).join(', ');
  }, [freeMeal, allFoods]);

  const lastEatenDate = useMemo(() => {
      if (!freeMeal.meal_date) return null;
      try {
        const date = parseISO(freeMeal.meal_date);
        return formatDistanceToNow(date, { addSuffix: true, locale: es });
      } catch (error) {
        return null;
      }
  }, [freeMeal.meal_date]);

  const macroDisplay = (
    <div className={`flex items-center gap-x-3 gap-y-1 text-sm font-mono flex-wrap ${isListView ? '' : 'justify-around mt-2 text-xs'}`}>
      <span className="flex items-center text-orange-400" title="Calorías"><CaloriesIcon className="w-4 h-4 mr-1"/>{Math.round(macros.calories || 0)}</span>
      <span className="flex items-center text-red-400" title="Proteínas"><ProteinIcon className="w-4 h-4 mr-1"/>{Math.round(macros.proteins || 0)}g</span>
      <span className="flex items-center text-yellow-400" title="Carbohidratos"><CarbsIcon className="w-4 h-4 mr-1"/>{Math.round(macros.carbs || 0)}g</span>
      <span className="flex items-center text-green-400" title="Grasas"><FatsIcon className="w-4 h-4 mr-1"/>{Math.round(macros.fats || 0)}g</span>
    </div>
  );

  if (isListView) {
    return (
      <div className="relative group h-full">
        <button onClick={() => handleCardClick(freeMeal)} className="w-full h-full text-left bg-gradient-to-br from-blue-900/80 via-blue-900/60 to-slate-800/80 p-5 rounded-xl transition-all flex flex-col justify-between shadow-lg border border-blue-700/50 hover:border-blue-500/50 hover:shadow-blue-500/10">
          <div>
            <div className="flex items-start justify-between gap-3">
              <p className="text-xl font-bold mb-1 line-clamp-2 flex-1 text-white">{freeMeal.name}</p>
            </div>
             {lastEatenDate && (
                <div className="flex items-center text-xs text-gray-400 mb-2">
                    <Calendar className="w-3 h-3 mr-1.5" />
                    Última vez: {lastEatenDate}
                </div>
            )}
            <p className="text-sm text-gray-400 line-clamp-3">{ingredientList}</p>
          </div>
          <div className="mt-4 flex justify-between items-center">
            {macroDisplay}
            {selectionIndicator}
          </div>
        </button>
        {handleRemove && (
          <button 
            onClick={(e) => { e.stopPropagation(); handleRemove(freeMeal.id); }} 
            className="absolute -top-2 -right-2 bg-red-600/90 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  // Week view
  return (
    <div className="relative group">
      <button onClick={() => handleCardClick(freeMeal)} className="w-full text-left bg-gradient-to-br from-blue-900/80 via-blue-900/60 to-slate-800/80 p-3 rounded-lg hover:shadow-blue-500/10 transition-all shadow-lg border border-blue-700/50">
        <div className="flex justify-between items-start flex-wrap gap-x-2 mb-1">
          <p className="text-white whitespace-normal font-medium text-sm">{freeMeal.name}</p>
        </div>
        <div className="min-h-[36px] flex flex-col justify-center">{macroDisplay}</div>
      </button>
      {handleRemove && (
        <button 
          onClick={(e) => { e.stopPropagation(); handleRemove(); }} 
          className="absolute top-1 right-1 bg-red-500/80 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};

export default FreeMealCard;