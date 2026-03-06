import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDietPlanRefresh } from '@/contexts/DietPlanContext';
import { Helmet } from 'react-helmet';
import { Loader2 } from 'lucide-react';
import RecipeEditorModal from '@/components/shared/RecipeEditorModal/RecipeEditorModal';

const RecipeViewPage = () => {
  const navigate = useNavigate();
  const { requestRefresh } = useDietPlanRefresh();
  const [recipeData, setRecipeData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('recipe_view_data');
      if (!raw) {
        setError('No se encontraron datos de la receta.');
        return;
      }
      const parsed = JSON.parse(raw);
      setRecipeData(parsed);
    } catch (e) {
      setError('Error al leer los datos de la receta.');
    }
  }, []);

  const handleClose = () => {
    if (recipeData?.returnTo) {
      navigate(recipeData.returnTo);
    } else {
      navigate(-1);
    }
  };

  const handleSaveSuccess = () => {
    sessionStorage.removeItem('recipe_view_data');
    requestRefresh();
    handleClose();
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <p>{error}</p>
      </div>
    );
  }

  if (!recipeData) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-green-500" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{recipeData.recipe?.recipe?.name || recipeData.recipe?.name || 'Receta'} - Bibofit</title>
      </Helmet>
      <div className="w-full h-full flex flex-col">
        <RecipeEditorModal
          asPage={true}
          open={true}
          onOpenChange={(open) => { if (!open) handleClose(); }}
          recipeToEdit={recipeData.recipe}
          onSaveSuccess={handleSaveSuccess}
          isAdminView={recipeData.isAdminView}
          userId={recipeData.userId}
          adjustments={recipeData.adjustments}
          isEditable={true}
        />
      </div>
    </>
  );
};

export default RecipeViewPage;
