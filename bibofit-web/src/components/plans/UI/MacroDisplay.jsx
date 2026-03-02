import React from 'react';
import CaloriesIcon from '@/components/icons/CaloriesIcon';
import ProteinIcon from '@/components/icons/ProteinIcon';
import CarbsIcon from '@/components/icons/CarbsIcon';
import FatsIcon from '@/components/icons/FatsIcon';

const MacroDisplay = ({ macros, title }) => {
  return (
    <div className="p-3 rounded-lg bg-card/75 border border-border">
      <h4 className="text-sm font-medium text-muted-foreground mb-3">{title}</h4>
      <div className="grid grid-cols-4 gap-2 text-center">
        <div className="flex flex-col items-center">
          <CaloriesIcon className="text-orange-400 w-5 h-5" />
          <span className="text-xs text-muted-foreground mt-1">Calorías</span>
          <span className="font-bold text-lg text-orange-700 dark:text-orange-300">{Math.round(macros.calories)}</span>
        </div>
        <div className="flex flex-col items-center">
          <ProteinIcon className="text-red-400 w-5 h-5" />
          <span className="text-xs text-muted-foreground mt-1">Proteínas</span>
          <span className="font-bold text-lg text-red-700 dark:text-red-300">{Math.round(macros.proteins)}g</span>
        </div>
        <div className="flex flex-col items-center">
          <CarbsIcon className="text-yellow-400 w-5 h-5" />
          <span className="text-xs text-muted-foreground mt-1">Carbs</span>
          <span className="font-bold text-lg text-yellow-700 dark:text-yellow-300">{Math.round(macros.carbs)}g</span>
        </div>
        <div className="flex flex-col items-center">
          <FatsIcon className="text-green-400 w-5 h-5" />
          <span className="text-xs text-muted-foreground mt-1">Grasas</span>
          <span className="font-bold text-lg text-green-700 dark:text-green-300">{Math.round(macros.fats)}g</span>
        </div>
      </div>
    </div>
  );
};

export default MacroDisplay;