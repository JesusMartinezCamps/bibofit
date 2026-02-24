import React, { useMemo } from 'react';
import { X, Apple, Utensils } from 'lucide-react';
import { cn } from '@/lib/utils';
import { calculateMacros } from '@/lib/macroCalculator';
import ProteinIcon from '@/components/icons/ProteinIcon';
import CarbsIcon from '@/components/icons/CarbsIcon';
import FatsIcon from '@/components/icons/FatsIcon';

const SnackCard = ({ snack, allFoods, onRemove, onToggle, onClick, isSelected }) => {

  const macros = useMemo(() => {
    if (!snack.snack_ingredients || !allFoods) {
      return { calories: 0, proteins: 0, carbs: 0, fats: 0 };
    }
    return calculateMacros(snack.snack_ingredients, allFoods);
  }, [snack.snack_ingredients, allFoods]);

  const ingredientList = useMemo(() => {
    if (!snack.snack_ingredients) return 'Sin ingredientes.';
    return snack.snack_ingredients.map(ing => {
      const food = ing.food || ing.user_created_food;
      if (!food) return 'Ingrediente desconocido';
      const unit = food.food_unit === 'unidades' ? 'ud' : 'g';
      return `${food.name} (${Math.round(ing.grams || 0)}${unit})`;
    }).join(', ');
  }, [snack.snack_ingredients]);


  return (
    <div className="relative group h-full">
      <button 
        onClick={() => onClick(snack)}
        className={cn(
          "w-full h-full text-left bg-gradient-to-br p-5 rounded-xl transition-all flex flex-col justify-between shadow-lg border",
          isSelected 
            ? 'from-orange-900/40 via-slate-800/40 to-orange-800/60 border-orange-700 hover:border-orange-500/50 hover:shadow-orange-500/10' 
            : 'from-orange-900/40 via-slate-800/40 to-slate-800/60 border-orange-700/50 hover:border-orange-500/50 hover:shadow-orange-500/10',
        )}
      >
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className={cn(
              "text-xl font-bold line-clamp-2 flex-1",
              isSelected ? "text-orange-300" : "text-white"
            )}>
              {snack.name}
            </p>
          </div>
          <p className="text-sm text-gray-400 line-clamp-3 mt-2">
            {ingredientList}
          </p>
        </div>
        <div className="mt-4 flex justify-between items-center">
          <div className="flex items-center gap-x-3 gap-y-1 text-sm font-mono flex-wrap">
            <span className="flex items-center text-orange-300" title="Calorías"><Apple className="w-4 h-4 mr-1 text-orange-300"/>{Math.round(macros.calories || 0)}</span>
            <span className="flex items-center text-orange-300" title="Proteínas"><ProteinIcon className="w-4 h-4 mr-1 text-orange-300"/>{Math.round(macros.proteins || 0)}g</span>
            <span className="flex items-center text-orange-300" title="Carbohidratos"><CarbsIcon className="w-4 h-4 mr-1 text-orange-300"/>{Math.round(macros.carbs || 0)}g</span>
            <span className="flex items-center text-orange-300" title="Grasas"><FatsIcon className="w-4 h-4 mr-1 text-orange-300"/>{Math.round(macros.fats || 0)}g</span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle(snack);
            }}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs transition-all duration-200 border',
              isSelected ? 'bg-orange-900/30 text-orange-300 border-orange-800/50' : 'bg-gray-700/50 text-gray-400 border-gray-600/50 hover:border-gray-500/50'
            )}
            title={isSelected ? "Desmarcar como comido" : "Marcar como comido"}
          >
            <Utensils className={cn('w-4 h-4', isSelected ? 'text-orange-400' : 'text-gray-500')} />
            <span>Comido</span>
          </button>
        </div>
      </button>
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(snack.occurrence_id); }}
          className="absolute -top-2 -right-2 bg-red-600/90 text-white rounded-full p-1 transition-colors hover:bg-red-500"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default SnackCard;