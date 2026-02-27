import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Bot, Loader2, Plus } from 'lucide-react';
import { invokeAutoBalanceRecipe } from '@/lib/autoBalanceClient';
import { useToast } from '@/components/ui/use-toast';
import { calculateMacros } from '@/lib/macroCalculator';
import { useIngredientBuilder } from './hooks/useIngredientBuilder';
import { INGREDIENT_LAYOUTS } from './layouts/layoutTypes';
import IngredientLayoutSelector from './layouts/IngredientLayoutSelector';
import { useIngredientAssistant } from './layouts/useIngredientAssistant';
import HealthLayout from './layouts/HealthLayout';
import MacrosLayout from './layouts/MacrosLayout';
import ListLayout from './layouts/ListLayout';
import { v4 as uuidv4 } from 'uuid';

const IngredientBuilder = ({ 
  ingredients = [], 
  onIngredientsChange = () => {},
  planRestrictions = {},
  onMacrosChange = () => {},
  mealTargetMacros,
  availableFoods: availableFoodsProp,
  displayMode = 'inform',
  defaultLayout = INGREDIENT_LAYOUTS.MACROS,
}) => {
  const [isBalancing, setIsBalancing] = useState(false);
  const [layout, setLayout] = useState(defaultLayout);
  
  const {
    allFoods,
    localIngredients,
    setLocalIngredients,
    handleIngredientChange,
    handleAddIngredient,
    handleRemoveIngredient,
  } = useIngredientBuilder(ingredients, onIngredientsChange);

  const { toast } = useToast();

  const availableFoods = useMemo(() => {
    return availableFoodsProp || allFoods;
  }, [availableFoodsProp, allFoods]);

  const totalMacros = useMemo(() => {
    return calculateMacros(localIngredients, allFoods);
  }, [localIngredients, allFoods]);

  useEffect(() => {
    if (onMacrosChange) {
      onMacrosChange(totalMacros);
    }
  }, [totalMacros, onMacrosChange]);

  useEffect(() => {
    if (!Object.values(INGREDIENT_LAYOUTS).includes(defaultLayout)) return;
    setLayout(defaultLayout);
  }, [defaultLayout]);

  const assistant = useIngredientAssistant({
    layout,
    ingredients: localIngredients,
    allFoods: availableFoods,
    mealTargetMacros,
    planRestrictions,
  });

  const handleAddFoodFromAssistant = useCallback(
    (food) => {
      if (!food) return;
      const defaultAmount = food.food_unit === 'unidades' ? '1' : '100';
      const ingredientToAdd = {
        local_id: uuidv4(),
        food_id: String(food.id),
        grams: defaultAmount,
        quantity: Number(defaultAmount),
        food_group_id: food.food_to_food_groups?.[0]?.food_group_id || null,
      };
      const updatedIngredients = [...localIngredients, ingredientToAdd];
      setLocalIngredients(updatedIngredients);
    },
    [localIngredients, setLocalIngredients]
  );

  const handleListIngredientsReplace = useCallback(
    (updatedIngredients) => {
      const normalized = updatedIngredients.map((ing) => ({
        ...ing,
        food_id: String(ing.food_id || ing.food?.id || ''),
        grams: ing.grams ?? ing.quantity ?? '',
      }));
      setLocalIngredients(normalized);
    },
    [setLocalIngredients]
  );

  const handleAutoBalance = async () => {
    if (!mealTargetMacros || [mealTargetMacros.target_proteins, mealTargetMacros.target_carbs, mealTargetMacros.target_fats].some(t => t === 0 || !t)) {
      toast({
        title: 'Objetivos no definidos',
        description: 'Por favor, define los macros objetivo para poder autocuadrar.',
        variant: 'destructive',
      });
      return;
    }

    setIsBalancing(true);

    try {
      const ingredientsForFunction = localIngredients.map(ing => ({
        food_id: Number(ing.food_id),
        quantity: Number(ing.quantity) || 0,
      })).filter(ing => ing.food_id);
      const data = await invokeAutoBalanceRecipe({
        ingredients: ingredientsForFunction,
        targets: mealTargetMacros
      });

      if (data.balancedIngredients) {
         const balanced = data.balancedIngredients.map(ing => ({
            ...ing,
            grams: ing.quantity,
            quantity: ing.quantity,
         }));
        setLocalIngredients(balanced);
        onIngredientsChange(balanced);
        toast({
          title: '¡Receta autocuadrada!',
          description: 'Se han ajustado las cantidades de los ingredientes.',
          variant: 'success'
        });
      } else {
         throw new Error(data.error || 'Respuesta inesperada de la función.');
      }
    } catch (error) {
      toast({
        title: 'Error al autocuadrar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsBalancing(false);
    }
  };

  const renderLayout = () => {
    const commonProps = {
      ingredients: localIngredients,
      allFoods,
      availableFoods,
      onIngredientChange: handleIngredientChange,
      onRemoveIngredient: handleRemoveIngredient,
      planRestrictions,
      displayMode,
      totalMacros,
      mealTargetMacros,
    };

    if (layout === INGREDIENT_LAYOUTS.HEALTH) {
      return (
        <HealthLayout
          {...commonProps}
          assistant={assistant}
          onPickFood={handleAddFoodFromAssistant}
        />
      );
    }

    if (layout === INGREDIENT_LAYOUTS.LIST) {
      return (
        <ListLayout
          ingredients={localIngredients}
          allFoods={availableFoods}
          totalMacros={totalMacros}
          mealTargetMacros={mealTargetMacros}
          planRestrictions={planRestrictions}
          onIngredientsReplace={handleListIngredientsReplace}
        />
      );
    }

    return (
      <MacrosLayout
        {...commonProps}
        assistant={assistant}
        onPickFood={handleAddFoodFromAssistant}
      />
    );
  };
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-lg font-semibold text-[#5ebe7d]">Constructor de Ingredientes</h4>
      </div>

      <IngredientLayoutSelector value={layout} onChange={setLayout} />

      {renderLayout()}

      <div className="flex flex-col sm:flex-row gap-2 mt-3">
        <Button 
          type="button" 
          onClick={handleAddIngredient} 
          variant="outline-dark" 
          className="w-full border-green-500 text-green-400"
        >
          <Plus className="w-4 h-4 mr-2" />
          Añadir Ingrediente
        </Button>
          {mealTargetMacros && (
          <Button 
            type="button" 
            onClick={handleAutoBalance} 
            disabled={isBalancing}
            variant="outline"
            className="w-full bg-slate-800 border-cyan-500 text-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-300"
          >
            {isBalancing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Bot className="w-4 h-4 mr-2" />}
            Autocuadrar Macros
          </Button>
        )}
      </div>
    </div>
  );
};

export default IngredientBuilder;
