import React from 'react';
import { Badge } from '@/components/ui/badge';

const NutrientSummary = ({ macros, allVitamins, allMinerals, recipeNutrients }) => {
  const renderNutrientBadges = (allNutrients, selectedIds) => {
    if (!selectedIds || selectedIds.length === 0) {
      return <p className="text-sm text-gray-500 italic">No se han detectado nutrientes de este tipo.</p>;
    }
    return allNutrients
      .filter(nutrient => selectedIds.includes(nutrient.id))
      .map(nutrient => (
        <Badge key={nutrient.id} variant="outline" className="bg-green-900/50 border-green-700/50 text-green-300">
          {nutrient.name}
        </Badge>
      ));
  };

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-lg font-semibold text-green-400 mb-2">Resumen de Macros</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="bg-slate-800/70 p-3 rounded-lg">
            <p className="text-sm text-gray-400">Calorías</p>
            <p className="text-xl font-bold text-white">{Math.round(macros?.calories || 0)}</p>
          </div>
          <div className="bg-slate-800/70 p-3 rounded-lg">
            <p className="text-sm text-gray-400">Proteínas</p>
            <p className="text-xl font-bold text-white">{Math.round(macros?.proteins || 0)}g</p>
          </div>
          <div className="bg-slate-800/70 p-3 rounded-lg">
            <p className="text-sm text-gray-400">Carbs</p>
            <p className="text-xl font-bold text-white">{Math.round(macros?.carbs || 0)}g</p>
          </div>
          <div className="bg-slate-800/70 p-3 rounded-lg">
            <p className="text-sm text-gray-400">Grasas</p>
            <p className="text-xl font-bold text-white">{Math.round(macros?.fats || 0)}g</p>
          </div>
        </div>
      </div>
      <div>
        <h4 className="text-lg font-semibold text-green-400 mb-2">Resumen de Micronutrientes</h4>
        <div className="space-y-4">
          <div>
            <h5 className="font-semibold text-gray-300 mb-2">Vitaminas en la receta</h5>
            <div className="flex flex-wrap gap-2">
              {renderNutrientBadges(allVitamins, recipeNutrients?.vitaminIds)}
            </div>
          </div>
          <div>
            <h5 className="font-semibold text-gray-300 mb-2">Minerales en la receta</h5>
            <div className="flex flex-wrap gap-2">
              {renderNutrientBadges(allMinerals, recipeNutrients?.mineralIds)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NutrientSummary;