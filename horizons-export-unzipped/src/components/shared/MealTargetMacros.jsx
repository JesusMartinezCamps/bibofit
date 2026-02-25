import React from 'react';
import ProteinIcon from '@/components/icons/ProteinIcon';
import CarbsIcon from '@/components/icons/CarbsIcon';
import FatsIcon from '@/components/icons/FatsIcon';
import CaloriesIcon from '@/components/icons/CaloriesIcon';
import { cn } from '@/lib/utils';

const MacroItem = ({ icon: Icon, value, unit, colorClass, label }) => (
  <div className={cn("flex items-center gap-1.5", colorClass)} title={`${label} Objetivo`}>
    <Icon className="w-4 h-4" />
    <span className="text-sm font-numeric">{Math.round(value || 0)}{unit}</span>
  </div>
);

const MealTargetMacros = ({ mealTargetMacros, adjustment, className }) => {
  if (!mealTargetMacros) return null;

  let {
    target_calories,
    target_proteins,
    target_carbs,
    target_fats
  } = mealTargetMacros;

  const isAdjusted = !!adjustment;

  if (isAdjusted) {
    target_calories -= adjustment.adjustment_calories || 0;
    target_proteins -= adjustment.adjustment_proteins || 0;
    target_carbs -= adjustment.adjustment_carbs || 0;
    target_fats -= adjustment.adjustment_fats || 0;
  }
  
  return (
    <div className={cn("flex items-center gap-4", className)}>
      <MacroItem
        icon={CaloriesIcon}
        value={Math.max(0, target_calories)}
        unit=""
        colorClass={isAdjusted ? "text-cyan-300" : "text-orange-400"}
        label="Calorías"
      />
      <MacroItem
        icon={ProteinIcon}
        value={Math.max(0, target_proteins)}
        unit="g"
        colorClass={isAdjusted ? "text-cyan-300" : "text-red-400"}
        label="Proteína"
      />
      <MacroItem
        icon={CarbsIcon}
        value={Math.max(0, target_carbs)}
        unit="g"
        colorClass={isAdjusted ? "text-cyan-300" : "text-yellow-400"}
        label="Carbohidratos"
      />
      <MacroItem
        icon={FatsIcon}
        value={Math.max(0, target_fats)}
        unit="g"
        colorClass={isAdjusted ? "text-cyan-300" : "text-green-400"}
        label="Grasas"
      />
    </div>
  );
};

export default MealTargetMacros;