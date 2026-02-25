// This file is no longer used for creating snacks and will be repurposed or removed later.
// For now, it's kept to avoid breaking any potential dependencies for editing functionality.
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import IngredientSearch from './IngredientSearch';
import { useSnackLogging } from './hooks/useSnackLogging';
import { calculateMacros } from '@/lib/macroCalculator';
import MacroDisplay from './UI/MacroDisplay';
import IngredientRowConflict from './UI/IngredientRowConflict';
import CreateFoodFromMealDialog from './CreateFoodFromMealDialog';

const SnackDialog = ({ open, onOpenChange, userId, onSaveSuccess, mealDate, preselectedMealId, activePlanId, mealToEdit }) => {
  const {
    isSubmitting,
    name, setName,
    ingredients, setIngredients,
    availableFoods, setAvailableFoods,
    userRestrictions,
    handleSubmit,
  } = useSnackLogging({ open, onOpenChange, userId, onSaveSuccess, mealDate, preselectedMealId, activePlanId });

  const [view, setView] = useState('form');
  const [isCreateFoodModalOpen, setIsCreateFoodModalOpen] = useState(false);
  const [ingredientToCreate, setIngredientToCreate] = useState(null);
  const lastIngredientRef = useRef(null);

  useEffect(() => {
    if (open && mealToEdit) {
        setName(mealToEdit.name || '');
        const ingredientsData = mealToEdit.snack_ingredients.map(ing => {
          const foodDetails = ing.food || ing.user_created_food;
          return {
            food_id: foodDetails.id,
            food_name: foodDetails.name,
            quantity: ing.grams,
            is_free: false,
            food_unit: foodDetails.food_unit,
            is_user_created: !!ing.user_created_food_id
          };
        });
        setIngredients(ingredientsData);
    }
  }, [open, mealToEdit, setName, setIngredients]);

  useEffect(() => {
    if (lastIngredientRef.current) {
      lastIngredientRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [ingredients.length]);

  const handleOpenChange = (isOpen) => {
    if (!isOpen) {
      setView('form');
      onOpenChange(false);
    }
  };

  const handleIngredientAdded = (newIngredient) => {
    setIngredients(prev => [...prev, newIngredient]);
    setView('form');
  };
  
  const handleOpenCreateFoodModal = (food) => {
    setIngredientToCreate({ name: food.name });
    setIsCreateFoodModalOpen(true);
  };

  const handleFoodCreated = (newFood) => {
    if (newFood) {
      const adaptedNewFood = { ...newFood, is_user_created: true };
      const newIngredient = {
        food_id: adaptedNewFood.id,
        food_name: adaptedNewFood.name,
        quantity: adaptedNewFood.food_unit === 'unidades' ? 1 : 100,
        is_free: false,
        is_user_created: true,
        food: adaptedNewFood,
      };
      setIngredients(prev => [...prev, newIngredient]);
      setAvailableFoods(prev => [...prev, adaptedNewFood]);
    }
    setIngredientToCreate(null);
    setView('form');
  };

  const removeIngredient = (index) => {
    const newIngredients = [...ingredients];
    newIngredients.splice(index, 1);
    setIngredients(newIngredients);
  };

  const updateIngredientGrams = (index, grams) => {
    const newIngredients = [...ingredients];
    newIngredients[index].quantity = grams;
    setIngredients(newIngredients);
  };
  
  const totalMacros = useMemo(() => {
    return calculateMacros(ingredients, availableFoods);
}, [ingredients, availableFoods]);

  return (
    <>
      {/* The Dialog component is kept for now but its trigger is removed from the main flow */}
       <CreateFoodFromMealDialog
        open={isCreateFoodModalOpen}
        onOpenChange={setIsCreateFoodModalOpen}
        onFoodCreated={handleFoodCreated}
        foodToCreate={ingredientToCreate}
      />
    </>
  );
};

export default SnackDialog;