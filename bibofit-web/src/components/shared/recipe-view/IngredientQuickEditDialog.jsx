import React, { useEffect, useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import IngredientSearch from '@/components/plans/IngredientSearch';
import { calculateMacros } from '@/lib/macroCalculator';

const IngredientQuickEditDialog = ({
  open,
  ingredient,
  allFoods,
  allVitamins,
  allMinerals,
  selectedIngredients,
  userRestrictions,
  onOpenChange,
  onSave,
}) => {
  const [quantity, setQuantity] = useState('');
  const [selectedFoodId, setSelectedFoodId] = useState(null);
  const [isReplacing, setIsReplacing] = useState(false);

  useEffect(() => {
    if (!ingredient) return;
    const initialQty = ingredient.quantity ?? ingredient.grams ?? 0;
    setQuantity(String(initialQty));
    setSelectedFoodId(ingredient.food?.id ?? ingredient.food_id ?? null);
    setIsReplacing(false);
  }, [ingredient]);

  if (!ingredient) return null;

  const selectedFood =
    (allFoods || []).find((food) => String(food.id) === String(selectedFoodId)) || ingredient.food;

  const defaultQty = selectedFood?.food_unit === 'unidades' ? 1 : 100;
  const parsedQty = Number(quantity);
  const safeQty = Number.isFinite(parsedQty) ? parsedQty : 0;
  const originalQty = Number(ingredient.quantity ?? ingredient.grams ?? 0) || defaultQty;
  const ratio = originalQty > 0 ? safeQty / originalQty : 0;

  const selectedIngredientForCalc = {
    ...ingredient,
    food: selectedFood,
    food_id: selectedFood?.id || ingredient.food_id,
    grams: safeQty,
    quantity: safeQty,
  };

  const originalIngredientForCalc = {
    ...ingredient,
    food: selectedFood,
    food_id: selectedFood?.id || ingredient.food_id,
    grams: originalQty,
    quantity: originalQty,
  };

  const originalMacros = selectedFood
    ? calculateMacros([originalIngredientForCalc], allFoods || [])
    : ingredient.macros || { calories: 0, proteins: 0, carbs: 0, fats: 0 };

  const updatedCalc = selectedFood ? calculateMacros([selectedIngredientForCalc], allFoods || []) : null;

  const updatedMacros = {
    calories: updatedCalc ? updatedCalc.calories : originalQty > 0 ? originalMacros.calories * ratio : 0,
    proteins: updatedCalc ? updatedCalc.proteins : originalQty > 0 ? originalMacros.proteins * ratio : 0,
    carbs: updatedCalc ? updatedCalc.carbs : originalQty > 0 ? originalMacros.carbs * ratio : 0,
    fats: updatedCalc ? updatedCalc.fats : originalQty > 0 ? originalMacros.fats * ratio : 0,
  };

  const selectedVitamins = (selectedFood?.food_vitamins || [])
    .map((fv) => {
      const vitaminData = (allVitamins || []).find((v) => v.id === (fv.vitamin_id || fv.vitamin?.id));
      if (!vitaminData) return null;
      return { ...vitaminData, mg_per_100g: typeof fv.mg_per_100g === 'number' ? fv.mg_per_100g : null };
    })
    .filter(Boolean);

  const selectedMinerals = (selectedFood?.food_minerals || [])
    .map((fm) => {
      const mineralData = (allMinerals || []).find((m) => m.id === (fm.mineral_id || fm.mineral?.id));
      if (!mineralData) return null;
      return { ...mineralData, mg_per_100g: typeof fm.mg_per_100g === 'number' ? fm.mg_per_100g : null };
    })
    .filter(Boolean);

  const searchSelectedIngredients = (selectedIngredients || []).filter(
    (ing) => String(ing.food_id) !== String(ingredient.food_id || ingredient.food?.id)
  );

  if (isReplacing) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-[#0E1528] border-slate-700 text-white max-w-2xl p-0">
          <div className="p-4 h-[70vh]">
            <IngredientSearch
              selectedIngredients={searchSelectedIngredients}
              availableFoods={allFoods}
              userRestrictions={userRestrictions}
              onBack={() => setIsReplacing(false)}
              onIngredientAdded={(newIngredientData) => {
                const selected = (allFoods || []).find(
                  (food) => String(food.id) === String(newIngredientData.food_id)
                );
                const initial = selected?.food_unit === 'unidades' ? 1 : 100;
                setSelectedFoodId(newIngredientData.food_id);
                setQuantity(String(initial));
                setIsReplacing(false);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0E1528] border-slate-700 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl bg-clip-text text-transparent bg-gradient-to-r from-green-300 to-teal-400">
            Ajustar Ingrediente
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-slate-700/70 bg-slate-900/60 p-3">
            <p className="text-sm text-slate-400">Ingrediente</p>
            <p className="text-lg font-semibold text-slate-100">{selectedFood?.name || ingredient.food?.name}</p>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full border-blue-500 bg-blue-600/20 text-white p-1 transition-opacity hover:text-blue-100 hover:bg-blue-500/30"
            onClick={() => setIsReplacing(true)}
          >
            <ArrowRightLeft className="w-4 h-4 mr-2" />
            Reemplazar ingrediente
          </Button>

          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-xs text-slate-400 mb-1">Cantidad</p>
              <Input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="input-field bg-transparent border-dashed text-center"
              />
            </div>
            <div className="pt-6 text-slate-300 text-sm">
              {selectedFood?.food_unit === 'unidades' ? 'ud' : 'g'}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-700/70 bg-slate-900/60 p-3">
              <p className="text-xs text-slate-400 mb-1">Macros originales</p>
              <div className="space-y-1 text-sm">
                <p className="text-orange-300">Kcal: {Math.round(originalMacros.calories || 0)}</p>
                <p className="text-red-300">Prot: {Math.round(originalMacros.proteins || 0)}g</p>
                <p className="text-yellow-300">Carbs: {Math.round(originalMacros.carbs || 0)}g</p>
                <p className="text-green-300">Grasas: {Math.round(originalMacros.fats || 0)}g</p>
              </div>
            </div>
            <div className="rounded-lg border border-cyan-700/60 bg-cyan-900/20 p-3">
              <p className="text-xs text-cyan-300 mb-1">Macros actualizadas</p>
              <div className="space-y-1 text-sm">
                <p className="text-orange-300">Kcal: {Math.round(updatedMacros.calories || 0)}</p>
                <p className="text-red-300">Prot: {Math.round(updatedMacros.proteins || 0)}g</p>
                <p className="text-yellow-300">Carbs: {Math.round(updatedMacros.carbs || 0)}g</p>
                <p className="text-green-300">Grasas: {Math.round(updatedMacros.fats || 0)}g</p>
              </div>
            </div>
          </div>

          {(selectedVitamins.length > 0 || selectedMinerals.length > 0) && (
            <div className="rounded-lg border border-slate-700/70 bg-slate-900/60 p-3">
              <p className="text-xs text-slate-400 mb-2">Vitaminas y Minerales</p>
              <div className="flex flex-wrap gap-2">
                {selectedVitamins.map((v) => (
                  <Badge key={`qv-${v.id}`} variant="outline" className="border-emerald-500/40 text-emerald-300 bg-emerald-900/20">
                    {v.name}
                    {typeof v.mg_per_100g === 'number' ? ` (${v.mg_per_100g} mg/100g)` : ''}
                  </Badge>
                ))}
                {selectedMinerals.map((m) => (
                  <Badge key={`qm-${m.id}`} variant="outline" className="border-sky-500/40 text-sky-300 bg-sky-900/20">
                    {m.name}
                    {typeof m.mg_per_100g === 'number' ? ` (${m.mg_per_100g} mg/100g)` : ''}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <Button
            type="button"
            className="w-full bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-500 hover:to-teal-500"
            onClick={() =>
              onSave({
                quantity: safeQty,
                food: selectedFood,
              })
            }
          >
            Cambiar alimento
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default IngredientQuickEditDialog;
