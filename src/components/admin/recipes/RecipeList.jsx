import React from 'react';
import { motion } from 'framer-motion';
import { Loader2, PlusCircle } from 'lucide-react';
import RecipeCard from './RecipeCard';

const RecipeList = ({ recipes, onAddRecipe, onEditRecipe, onDeleteRecipe, loading, isAdminView, isSelector }) => {
  if (loading) {
    return (
      <div className="flex justify-center items-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-green-500" />
      </div>
    );
  }

  if (!recipes || recipes.length === 0) {
    return (
      <div className="text-center text-gray-400 py-10">
        <p>No se encontraron recetas.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {recipes.map((item, index) => {
        const recipeData = item.recipe || item;
        return (
          <motion.div
            key={recipeData.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="relative group"
          >
            <RecipeCard
              recipe={recipeData}
              onEdit={onEditRecipe}
              onDelete={onDeleteRecipe}
              isAdminView={isAdminView}
            />
            {isSelector && (
              <button
                onClick={() => onAddRecipe(item)}
                className="absolute inset-0 bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-xl"
              >
                <PlusCircle className="w-12 h-12 text-green-400" />
              </button>
            )}
          </motion.div>
        );
      })}
    </div>
  );
};

export default RecipeList;