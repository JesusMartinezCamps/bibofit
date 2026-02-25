import { supabase } from '@/lib/supabaseClient';

export const createRecipeHandlers = (
  formData, 
  setFormData, 
  ingredients, 
  setIngredients, 
  selectedSensitivities, 
  setSelectedSensitivities,
  selectedRecipe,
  setSelectedRecipe,
  resetForm,
  toast
) => {
  const handleFormChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  
  const handleSelectChange = (name, value) => setFormData({ ...formData, [name]: value });
  
  const handleIngredientChange = (local_id, field, value) => 
    setIngredients(prev => prev.map(ing => ing.local_id === local_id ? { ...ing, [field]: value } : ing));
  
  const addIngredient = () => setIngredients([...ingredients, { local_id: Date.now(), food_id: '', quantity: '' }]);
  
  const removeIngredient = (local_id) => {
    if (ingredients.length > 1) setIngredients(prev => prev.filter(ing => ing.local_id !== local_id));
    else setIngredients([{ local_id: Date.now(), food_id: '', quantity: '' }]);
  };

  const handleSensitivityChange = (sensitivityId, checked) => {
    if (checked) {
      setSelectedSensitivities(prev => [...prev, sensitivityId]);
    } else {
      setSelectedSensitivities(prev => prev.filter(id => id !== sensitivityId));
    }
  };

  const handleSelectRecipe = async (recipe) => {
    if (selectedRecipe?.id === recipe.id) {
      setSelectedRecipe(null);
      resetForm();
      return;
    }

    try {
      const { data: recipeSensitivities, error: sensitivitiesError } = await supabase
        .from('recipe_sensitivities')
        .select('sensitivity_id')
        .eq('recipe_id', recipe.id);

      if (sensitivitiesError) throw sensitivitiesError;

      const { data: sensitivities, error: sensitivitiesDataError } = await supabase
        .from('sensitivities')
        .select('*');

      if (sensitivitiesDataError) throw sensitivitiesDataError;

      const fullRecipeData = {
        ...recipe,
        avoided_sensitivities: recipeSensitivities.map(ra => 
          sensitivities.find(a => a.id === ra.sensitivity_id)
        ).filter(Boolean)
      };

      setSelectedRecipe(fullRecipeData);
      
      setFormData({
        name: fullRecipeData.name || '',
        prep_time_min: fullRecipeData.prep_time_min || '',
        difficulty: fullRecipeData.difficulty || 'Fácil',
        instructions: fullRecipeData.instructions || '',
      });
      const recipeIngredients = fullRecipeData.ingredients?.map((ing, i) => ({ local_id: `${ing.food_id}-${i}`, food_id: String(ing.food_id), quantity: ing.grams ?? '' })) || [];
      setIngredients(recipeIngredients.length > 0 ? recipeIngredients : [{ local_id: Date.now(), food_id: '', quantity: '' }]);
      setSelectedSensitivities(fullRecipeData.avoided_sensitivities?.map(a => a.id) || []);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los detalles de la receta.',
        variant: 'destructive'
      });
      setSelectedRecipe(null);
    }
  };

  const handleDeleteRecipe = async (recipe) => {
    const { error: ingredientsError } = await supabase
      .from('recipe_ingredients')
      .delete()
      .eq('recipe_id', recipe.id);

    if (ingredientsError) {
      toast({
        title: 'Error',
        description: `No se pudieron eliminar los ingredientes de la receta: ${ingredientsError.message}`,
        variant: 'destructive',
      });
      return;
    }

    await supabase
      .from('recipe_sensitivities')
      .delete()
      .eq('recipe_id', recipe.id);
    
    const { error: recipeError } = await supabase
      .from('recipes')
      .delete()
      .eq('id', recipe.id);

    if (recipeError) {
      if (recipeError.code === '23503') { 
        toast({
          title: 'Error al eliminar',
          description: 'No se puede eliminar la receta. Es posible que esté asignada a un plan de dieta o sea la base de una receta personalizada.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error',
          description: `No se pudo eliminar la receta: ${recipeError.message}`,
          variant: 'destructive',
        });
      }
    } else {
      toast({
        title: '¡Éxito!',
        description: `La receta "${recipe.name}" ha sido eliminada.`,
      });
      if (selectedRecipe?.id === recipe.id) {
        setSelectedRecipe(null);
        resetForm();
      }
    }
  };

  return {
    handleFormChange,
    handleSelectChange,
    handleIngredientChange,
    addIngredient,
    removeIngredient,
    handleSensitivityChange,
    handleSelectRecipe,
    handleDeleteRecipe
  };
};