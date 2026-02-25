import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Utensils, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const RecipeTemplateCard = ({ recipe, onSelect, isSelected, onDelete }) => {
  const ingredientsList = useMemo(() => {
    return recipe.recipe_ingredients?.map(ing => ing.food?.name).filter(Boolean).join(', ') || 'Sin ingredientes';
  }, [recipe.recipe_ingredients]);

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    onDelete(recipe);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.2 }}
      onClick={() => onSelect(recipe)}
      style={
        recipe.image_url
          ? {
              backgroundImage: `linear-gradient(rgba(2, 6, 23, 0.75), rgba(2, 6, 23, 0.23)), url(${recipe.image_url})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : undefined
      }
      className={cn(
        'p-4 rounded-lg cursor-pointer transition-all duration-200 border-2',
        recipe.image_url ? 'bg-slate-800/20' : 'bg-slate-800/50 hover:bg-slate-700/50',
        isSelected ? 'border-green-500 shadow-lg shadow-green-500/10' : 'border-slate-700 hover:border-slate-600'
      )}
    >
      <div className="flex justify-between items-start">
        <div className="flex-grow">
          <h4 className="font-bold text-white truncate">{recipe.name}</h4>
          <div className="mt-2 space-y-2 text-xs text-slate-400">
            <div className="flex items-start gap-2">
              <Utensils className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
              <p>{ingredientsList}</p>
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-red-500 hover:text-red-400 hover:bg-red-900/30 h-8 w-8 flex-shrink-0 ml-2"
          onClick={handleDeleteClick}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
};

export default RecipeTemplateCard;
