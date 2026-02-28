import React from 'react';
import CaloriesIcon from '@/components/icons/CaloriesIcon';
import ProteinIcon from '@/components/icons/ProteinIcon';
import CarbsIcon from '@/components/icons/CarbsIcon';
import FatsIcon from '@/components/icons/FatsIcon';

export const MacroSummaryGrid = ({ macros }) => {
  if (!macros) return null;

  return (
    <div className="grid grid-cols-4 gap-2">
      <div className="flex flex-col items-center p-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
        <div className="flex items-center gap-1 text-orange-400 mb-1">
          <CaloriesIcon className="w-4 h-4" />
          <span className="text-xs font-medium">Calorias</span>
        </div>
        <span className="text-lg font-bold text-white">{Math.round(macros.calories || 0)}</span>
      </div>
      <div className="flex flex-col items-center p-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
        <div className="flex items-center gap-1 text-red-400 mb-1">
          <ProteinIcon className="w-4 h-4" />
          <span className="text-xs font-medium">Proteinas</span>
        </div>
        <span className="text-lg font-bold text-white">{Math.round(macros.proteins || 0)}g</span>
      </div>
      <div className="flex flex-col items-center p-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
        <div className="flex items-center gap-1 text-yellow-400 mb-1">
          <CarbsIcon className="w-4 h-4" />
          <span className="text-xs font-medium">Carbs</span>
        </div>
        <span className="text-lg font-bold text-white">{Math.round(macros.carbs || 0)}g</span>
      </div>
      <div className="flex flex-col items-center p-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
        <div className="flex items-center gap-1 text-green-400 mb-1">
          <FatsIcon className="w-4 h-4" />
          <span className="text-xs font-medium">Grasas</span>
        </div>
        <span className="text-lg font-bold text-white">{Math.round(macros.fats || 0)}g</span>
      </div>
    </div>
  );
};

export const MacroTargetGrid = ({ targets }) => {
  if (!targets) return null;

  return (
    <div className="grid grid-cols-4 gap-2 opacity-70">
      <div className="flex flex-col items-center">
        <span className="text-xs text-gray-400">Meta</span>
        <span className="text-sm font-medium text-orange-400">{Math.round(targets.target_calories || 0)}</span>
      </div>
      <div className="flex flex-col items-center">
        <span className="text-xs text-gray-400">Meta</span>
        <span className="text-sm font-medium text-red-400">{Math.round(targets.target_proteins || 0)}g</span>
      </div>
      <div className="flex flex-col items-center">
        <span className="text-xs text-gray-400">Meta</span>
        <span className="text-sm font-medium text-yellow-400">{Math.round(targets.target_carbs || 0)}g</span>
      </div>
      <div className="flex flex-col items-center">
        <span className="text-xs text-gray-400">Meta</span>
        <span className="text-sm font-medium text-green-400">{Math.round(targets.target_fats || 0)}g</span>
      </div>
    </div>
  );
};
