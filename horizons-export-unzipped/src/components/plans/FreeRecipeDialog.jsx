// This file is kept for potential future use or alternative flows, but is now disconnected from the main "add free recipe" flow.
import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useFreeRecipeDialog } from '@/components/plans/hooks/useFreeRecipeDialog';
import FreeRecipeDialogUI from '@/components/plans/UI/FreeRecipeDialogUI';
import IngredientSearch from '@/components/plans/IngredientSearch';
import SimplifiedFoodForm from '@/components/admin/recipes/SimplifiedFoodForm';
import { Loader2 } from 'lucide-react';

const FreeRecipeDialog = ({ open, onOpenChange, userId, onRecipeCreated, dayMealId, dietPlanId, date }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const targetUserId = userId || user.id;

  const [view, setView] = useState('main'); // 'main', 'search', 'createFood'
  const [foodToCreate, setFoodToCreate] = useState(null);
  const [availableFoods, setAvailableFoods] = useState([]);
  const [userRestrictions, setUserRestrictions] = useState(null);
  const [loadingInitialData, setLoadingInitialData] = useState(true);

  const fetchInitialData = useCallback(async () => {
    setLoadingInitialData(true);
    try {
      const [foodsRes, userFoodsRes, restrictionsRes] = await Promise.all([
        supabase.from('food').select(`
          id, name, proteins, total_carbs, total_fats, food_unit,
          food_sensitivities(sensitivities(id, name)),
          food_medical_conditions(relation_type, medical_conditions(id, name))
        `),
        supabase.from('user_created_foods').select(`
          id, name, proteins, total_carbs, total_fats, food_unit,
          user_created_food_sensitivities(sensitivities(id, name)),
          user_created_food_vitamins(vitamins(id, name)),
          user_created_food_minerals(minerals(id, name))
        `).eq('user_id', targetUserId).in('status', ['approved_private', 'pending']),
        supabase.rpc('get_user_restrictions', { p_user_id: targetUserId })
      ]);

      if (foodsRes.error) throw foodsRes.error;
      if (userFoodsRes.error) throw userFoodsRes.error;
      if (restrictionsRes.error) throw restrictionsRes.error;

      const transformedFoods = (foodsRes.data || []).map(food => ({
        ...food,
        food_sensitivities: food.food_sensitivities.map(fs => fs.sensitivities),
        food_medical_conditions: food.food_medical_conditions,
        is_user_created: false
      }));

      const transformedUserFoods = (userFoodsRes.data || []).map(userFood => ({
        ...userFood,
        food_sensitivities: userFood.user_created_food_sensitivities.map(fs => fs.sensitivities),
        food_vitamins: userFood.user_created_food_vitamins.map(fv => fv.vitamins),
        food_minerals: userFood.user_created_food_minerals.map(fm => fm.minerals),
        food_medical_conditions: [],
        is_user_created: true
      }));

      setAvailableFoods([...transformedFoods, ...transformedUserFoods]);
      setUserRestrictions(restrictionsRes.data);

    } catch (error) {
      console.error('Error fetching initial data for FreeRecipeDialog:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los datos necesarios para crear la receta.',
        variant: 'destructive',
      });
    } finally {
      setLoadingInitialData(false);
    }
  }, [targetUserId, toast]);

  const handleSuccess = (newLog, newFreeMealWithOccurrence) => {
    if (onRecipeCreated) {
      onRecipeCreated(newLog, newFreeMealWithOccurrence);
    }
    onOpenChange(false);
  };

  const {
    recipeName, setRecipeName,
    prepTime, setPrepTime,
    difficulty, setDifficulty,
    instructions, setInstructions,
    ingredients, setIngredients,
    macros,
    handleIngredientAdded,
    handleQuantityChange,
    handleRemoveIngredient,
    handleSave,
    isSaving,
  } = useFreeRecipeDialog({
    targetUserId,
    dayMealId,
    dietPlanId,
    date,
    onSuccess: handleSuccess,
    availableFoods,
  });

  useEffect(() => {
    if (open) {
      fetchInitialData();
    } else {
      // Reset state when dialog closes
      setView('main');
      setRecipeName('');
      setPrepTime('');
      setDifficulty('Fácil');
      setInstructions('');
      setIngredients([]);
    }
  }, [open, fetchInitialData, setRecipeName, setPrepTime, setDifficulty, setInstructions, setIngredients]);

  const handleOpenCreateFoodModal = (food) => {
    setFoodToCreate(food);
    setView('createFood');
  };

  const handleFoodCreated = (newFood) => {
    const newIngredient = {
      id: newFood.id,
      name: newFood.name,
      quantity: 100,
      is_free: false,
      food_unit: newFood.food_unit || 'gramos',
      is_user_created: true
    };
    handleIngredientAdded(newIngredient);
    fetchInitialData(); // Refetch to include the new food
    setView('main');
  };
  
  const handleDialogClose = (isOpen) => {
    if (isSaving) return;
    onOpenChange(isOpen);
  }

  const renderContent = () => {
    if (loadingInitialData) {
      return (
        <div className="flex justify-center items-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-green-500" />
        </div>
      );
    }

    switch (view) {
      case 'search':
        return (
          <IngredientSearch
            selectedIngredients={ingredients}
            onIngredientAdded={(ingredient) => {
              handleIngredientAdded(ingredient);
              setView('main');
            }}
            onOpenCreateFoodModal={handleOpenCreateFoodModal}
            availableFoods={availableFoods}
            userRestrictions={userRestrictions}
            onBack={() => setView('main')}
          />
        );
      case 'createFood':
        return (
          <SimplifiedFoodForm
            onFoodActionComplete={handleFoodCreated}
            onCancel={() => setView('main')}
            isClientRequest={true}
            userId={targetUserId}
            foodToCreate={foodToCreate}
          />
        );
      case 'main':
      default:
        return (
          <FreeRecipeDialogUI
            recipeName={recipeName}
            setRecipeName={setRecipeName}
            prepTime={prepTime}
            setPrepTime={setPrepTime}
            difficulty={difficulty}
            setDifficulty={setDifficulty}
            instructions={instructions}
            setInstructions={setInstructions}
            ingredients={ingredients}
            macros={macros}
            onQuantityChange={handleQuantityChange}
            onRemoveIngredient={handleRemoveIngredient}
            onAddIngredient={() => setView('search')}
            onOpenCreateFoodModal={handleOpenCreateFoodModal}
            availableFoods={availableFoods}
            userRestrictions={userRestrictions}
          />
        );
    }
  };

  const getDialogTitle = () => {
    switch (view) {
      case 'search': return 'Añadir Ingrediente';
      case 'createFood': return 'Crear Nuevo Alimento';
      default: return 'Crear Receta Libre';
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col bg-gray-900 border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-green-400">{getDialogTitle()}</DialogTitle>
        </DialogHeader>
        <div className="flex-grow overflow-y-auto pr-4 -mr-4 styled-scrollbar-green">
          {renderContent()}
        </div>
        {view === 'main' && (
          <DialogFooter>
            <Button onClick={handleSave} disabled={isSaving || !recipeName || ingredients.length === 0} className="bg-green-600 hover:bg-green-700 w-full">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Guardar Receta
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default FreeRecipeDialog;