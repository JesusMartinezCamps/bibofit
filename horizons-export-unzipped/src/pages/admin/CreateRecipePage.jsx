import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import RecipeFormContainer from '@/components/admin/recipes/RecipeFormContainer';
import RecipeListContainer from '@/components/admin/recipes/RecipeListContainer';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import AdminMobileViewSwitcher from '@/components/admin/AdminMobileViewSwitcher';
import { cn } from '@/lib/utils';
import Breadcrumbs from '@/components/Breadcrumbs';

const CreateRecipePage = () => {
  const location = useLocation();
  const initialRecipeToEdit = location.state?.recipeToEdit || null;
  const [selectedRecipe, setSelectedRecipe] = useState(initialRecipeToEdit);
  const [listRefreshToken, setListRefreshToken] = useState(0);
  const [formResetSignal, setFormResetSignal] = useState(0);
  const [mobileView, setMobileView] = useState('form');

  const handleRecipeActionComplete = useCallback((savedRecipe) => {
    setListRefreshToken((prev) => prev + 1);
    if (savedRecipe?.id) {
      setSelectedRecipe(savedRecipe);
    }
  }, []);

  const handleToggleSelectRecipe = (recipe) => {
    setSelectedRecipe((prev) => (prev?.id === recipe.id ? null : recipe));
    setMobileView('form');
  };

  const handleCreateNew = () => {
    setSelectedRecipe(null);
    setFormResetSignal((prev) => prev + 1);
  };

  const breadcrumbItems = [
    { label: 'Gestión de Contenidos', href: '/admin-panel/content' },
    { label: 'Nutrición', href: '/admin-panel/content/nutrition' },
    { label: 'Gestión de Recetas' },
  ];

  return (
    <main className="w-full px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Breadcrumbs items={breadcrumbItems} />
        <AdminMobileViewSwitcher view={mobileView} setView={setMobileView} />

        <div className="mt-4 flex flex-col md:flex-row gap-8 md:items-start h-full">
          <div className={cn("w-full md:w-[30%]", mobileView === 'form' && 'hidden md:block')}>
            <div className="h-full flex flex-col bg-slate-900/50 p-4 rounded-lg border border-slate-800 overflow-hidden">
                <RecipeListContainer
                  onSelectRecipe={handleToggleSelectRecipe}
                  selectedRecipeId={selectedRecipe?.id}
                  refreshToken={listRefreshToken}
                />
            </div>
          </div>

          <div className={cn("w-full md:w-[70%]", mobileView === 'search' && 'hidden md:block')}>
            <div className="h-full flex flex-col bg-slate-900/50 p-6 rounded-lg border border-slate-800">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-cyan-400">
                  {selectedRecipe ? `Editando: ${selectedRecipe.name}` : 'Creando Nueva Receta'}
                </h2>
                {selectedRecipe && (
                  <Button 
                    onClick={handleCreateNew} 
                    variant="outline-dark" 
                    className="border-green-500 text-green-400 hover:bg-green-500/10"
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Crear Nueva
                  </Button>
                )}
              </div>
              <RecipeFormContainer
                selectedRecipe={selectedRecipe} 
                onSave={handleRecipeActionComplete}
                resetSignal={formResetSignal}
              />
            </div>
          </div>
        </div>
      </motion.div>
    </main>
  );
};

export default CreateRecipePage;
