import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Bot, Loader2, Plus } from 'lucide-react';
import { invokeAutoBalanceRecipe } from '@/lib/autoBalanceClient';
import { useToast } from '@/components/ui/use-toast';
import TotalsRow from './TotalsRow';
import TargetMacrosRow from './TargetMacrosRow';
import { calculateMacros } from '@/lib/macroCalculator';
import { useIngredientBuilder } from './hooks/useIngredientBuilder';
import IngredientRow from './IngredientRow';

const macroGridStyle = { gridTemplateColumns: 'minmax(150px, 1fr) 100px repeat(4, minmax(70px, auto)) 40px' };

const IngredientBuilder = ({ 
  ingredients = [], 
  onIngredientsChange = () => {},
  planRestrictions = {},
  onMacrosChange = () => {},
  mealTargetMacros,
  availableFoods: availableFoodsProp,
  displayMode = 'inform'
}) => {
  const [isBalancing, setIsBalancing] = useState(false);
  
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
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-lg font-semibold text-[#5ebe7d]">Constructor de Ingredientes</h4>
      </div>
      
      <div className="rounded-lg bg-slate-950/50 border border-slate-800">
        <div className="overflow-x-auto no-scrollbar">
          <div className="p-3 min-w-[750px]">
            <div className="space-y-2 mt-2">
                {localIngredients.map((ing, index) => (
                  <IngredientRow
                    key={ing.local_id}
                    ingredient={ing}
                    allFoods={allFoods}
                    availableFoods={availableFoods}
                    onIngredientChange={handleIngredientChange}
                    onRemove={handleRemoveIngredient}
                    planRestrictions={planRestrictions}
                    gridStyle={macroGridStyle}
                    displayMode={displayMode}
                  />
                ))}
            </div>
            
            <div className="space-y-2">
              <TotalsRow totalMacros={totalMacros} gridStyle={macroGridStyle} />
              {mealTargetMacros && (
                <TargetMacrosRow targetMacros={mealTargetMacros} gridStyle={macroGridStyle} />
              )}
            </div>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2 mt-3 p-3 pt-0">
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
    </div>
  );
};

export default IngredientBuilder;
