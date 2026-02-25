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
  const [formKey, setFormKey] = useState(Date.now());
  const [mobileView, setMobileView] = useState('form');

  // Update function: when save completes, we don't clear the selected recipe immediately if we want to keep editing, 
  // or we can refresh the list. For smoother UX, we keep the form mounted but trigger a refresh in the list.
  // However, the requirement says "update without requiring full page reload".
  // Best approach: Clear selection to reset to "New Mode" OR keep selected to allow further edits.
  // Usually "Save" implies finishing. Let's clear selection to return to "Create New" state or just refresh the list data.
  
  const handleRecipeActionComplete = useCallback(() => {
    // We trigger a re-render of the list to show updated data, but we can choose to keep the form open or reset it.
    // If we want to reset to "Create New" after save:
    setSelectedRecipe(null);
    setFormKey(Date.now()); 
  }, []);

  const handleSelectRecipe = (recipe) => {
    setSelectedRecipe(recipe);
    setFormKey(Date.now());
    setMobileView('form');
  };

  const handleCreateNew = () => {
    setSelectedRecipe(null);
    setFormKey(Date.now());
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
                  onSelectRecipe={handleSelectRecipe}
                  selectedRecipeId={selectedRecipe?.id}
                  onActionComplete={handleRecipeActionComplete} 
                  // Pass a key that updates when an action completes to force list refresh
                  key={`search-${formKey}`}                
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
                key={formKey}
                selectedRecipe={selectedRecipe} 
                onSave={handleRecipeActionComplete}
              />
            </div>
          </div>
        </div>
      </motion.div>
    </main>
  );
};

export default CreateRecipePage;