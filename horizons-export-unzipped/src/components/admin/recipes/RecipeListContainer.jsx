import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Input } from '@/components/ui/input';
import { Loader2, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import RecipeTemplateCard from '@/components/admin/recipes/RecipeTemplateCard';

const RecipeListContainer = ({ onSelectRecipe, selectedRecipeId, onDeleteRecipe }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [allRecipes, setAllRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('recipes')
        .select(`
          *,
          recipe_ingredients:recipe_ingredients(*, food:food(name)),
          recipe_sensitivities:recipe_sensitivities(*, sensitivities:sensitivities(id, name))
        `)
        .order('name', { ascending: true });

      if (error) throw error;

      setAllRecipes(data || []);
    } catch (error) {
      toast({
        title: 'Error de carga',
        description: 'No se pudieron cargar las plantillas de recetas.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const handleDelete = async (recipe) => {
    try {
      if (onDeleteRecipe) {
        await onDeleteRecipe(recipe);
        // Re-fetch to ensure list is up to date if delete handled externally
        fetchInitialData();
      } else {
        // Handle delete internally if no prop provided
        const { error } = await supabase.from('recipes').delete().eq('id', recipe.id);
        if (error) throw error;
        setAllRecipes(prev => prev.filter(r => r.id !== recipe.id));
        toast({ title: 'Receta eliminada', description: 'La plantilla ha sido eliminada correctamente.' });
      }
    } catch (error) {
      console.error(error);
      toast({ 
        title: 'Error', 
        description: 'No se pudo eliminar la receta. Puede estar en uso.', 
        variant: 'destructive' 
      });
    }
  };

  const filteredRecipes = useMemo(() => {
    if (!searchTerm) return allRecipes;
    
    // Normalize string helper: remove accents and lowercase
    const normalize = (str) => 
      str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";

    const lowercasedFilter = normalize(searchTerm);

    return allRecipes.filter(recipe => {
      // Check Recipe Name
      const nameMatch = normalize(recipe.name).includes(lowercasedFilter);
      
      // Check Difficulty
      const difficultyMatch = normalize(recipe.difficulty).includes(lowercasedFilter);
      
      // Check Ingredients
      const ingredientsMatch = recipe.recipe_ingredients?.some(ing => 
        ing.food && normalize(ing.food.name).includes(lowercasedFilter)
      );

      return nameMatch || difficultyMatch || ingredientsMatch;
    });
  }, [searchTerm, allRecipes]);

  return (
    <div className="h-full flex flex-col">
      <h3 className="text-xl font-bold mb-4 text-green-400">Plantillas de Recetas</h3>
      <div className="relative mb-4">
        <Input
          type="text"
          placeholder="Buscar por nombre, ingrediente o dificultad..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input-field pr-10"
        />
        {searchTerm && (
          <button type="button" onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="relative flex-grow overflow-y-auto pr-2 -mr-2 styled-scrollbar">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-green-500" />
          </div>
        ) : (
          <AnimatePresence>
            {filteredRecipes.length > 0 ? (
              <div className="space-y-3">
                {filteredRecipes.map((recipe) => (
                  <motion.div
                    key={recipe.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <RecipeTemplateCard
                        recipe={recipe}
                        onSelect={onSelectRecipe}
                        isSelected={selectedRecipeId === recipe.id}
                        onDelete={handleDelete}
                    />
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-400 py-4">
                No se encontraron resultados.
              </div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

export default RecipeListContainer;