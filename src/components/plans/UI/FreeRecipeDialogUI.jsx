import React, { useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import IngredientRowConflict from './IngredientRowConflict';
import MacroDisplay from './MacroDisplay';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion, AnimatePresence } from 'framer-motion';


const FreeRecipeDialogUI = ({
  recipeName, setRecipeName,
  prepTime, setPrepTime,
  difficulty, setDifficulty,
  instructions, setInstructions,
  ingredients,
  macros,
  onQuantityChange,
  onRemoveIngredient,
  onAddIngredient,
  onOpenCreateFoodModal,
  availableFoods,
  userRestrictions,
}) => {
  const lastIngredientRef = useRef(null);

  useEffect(() => {
    if (lastIngredientRef.current) {
        lastIngredientRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [ingredients.length]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <label htmlFor="recipeName" className="block text-sm font-medium text-gray-300 mb-1">Nombre de la Receta</label>
          <Input
            id="recipeName"
            type="text"
            placeholder="Ej: Pollo al curry con arroz"
            value={recipeName}
            onChange={(e) => setRecipeName(e.target.value)}
            className="input-field"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4"> {/* Changed to grid-cols-2 for mobile */}
        <div>
          <label htmlFor="prepTime" className="block text-sm font-medium text-gray-300 mb-1">Tiempo (min)</label>
          <Input
            id="prepTime"
            type="number"
            placeholder="Ej: 30"
            value={prepTime}
            onChange={(e) => setPrepTime(e.target.value)}
            className="input-field"
          />
        </div>
        <div>
          <label htmlFor="difficulty" className="block text-sm font-medium text-gray-300 mb-1">Dificultad</label>
          <Select value={difficulty} onValueChange={setDifficulty}>
              <SelectTrigger className="input-field">
                  <SelectValue placeholder="Selecciona dificultad" />
              </SelectTrigger>
              <SelectContent>
                  <SelectItem value="Fácil">Fácil</SelectItem>
                  <SelectItem value="Media">Media</SelectItem>
                  <SelectItem value="Difícil">Difícil</SelectItem>
              </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <label htmlFor="instructions" className="block text-sm font-medium text-gray-300 mb-1">Instrucciones</label>
        <Textarea
          id="instructions"
          placeholder="Describe los pasos para preparar la receta..."
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          className="input-field min-h-[120px]"
        />
      </div>

      <MacroDisplay macros={macros} title="Macros Totales de la Receta" />
      
      <div>
        <h3 className="text-lg font-semibold mb-2 text-green-400">Ingredientes</h3>
        <AnimatePresence>
            {ingredients.length > 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2 mb-2">
                {ingredients.map((ing, index) => (
                    <motion.div
                        key={`${ing.food_id}-${index}`}
                        ref={index === ingredients.length - 1 ? lastIngredientRef : null}
                        layout
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                    >
                    <IngredientRowConflict
                        ingredient={ing}
                        index={index}
                        onQuantityChange={onQuantityChange}
                        onRemove={onRemoveIngredient}
                        onOpenCreateFoodModal={onOpenCreateFoodModal}
                        availableFoods={availableFoods}
                        userRestrictions={userRestrictions}
                    />
                    </motion.div>
                ))}
                </motion.div>
            )}
        </AnimatePresence>
        <Button variant="outline" onClick={onAddIngredient} className="mt-4 w-full border-dashed border-emerald-500/40 text-emerald-400 bg-emerald-900/10 hover:bg-emerald-900/20 hover:text-emerald-300 hover:border-emerald-500/60 mb-2">
          <PlusCircle className="mr-2 h-4 w-4" />
          Añadir Ingrediente
        </Button>
      </div>

    </div>
  );
};

export default FreeRecipeDialogUI;