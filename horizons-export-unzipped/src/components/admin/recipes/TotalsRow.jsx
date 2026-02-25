import React from 'react';
import { cn } from '@/lib/utils';
import CaloriesIcon from '@/components/icons/CaloriesIcon';
import ProteinIcon from '@/components/icons/ProteinIcon';
import CarbsIcon from '@/components/icons/CarbsIcon';
import FatsIcon from '@/components/icons/FatsIcon';

const TotalsRow = ({ totalMacros, gridStyle }) => {
  return (
    <div 
      className={cn(
        "grid items-center mt-2 pt-2 border-t-2 border-slate-700 text-sm font-bold gap-x-2 pl-4",
      )}
      style={gridStyle}
    >
      <span/>
      <span className="font-bold">TOTALES RECETA</span>
      <span/>
      <span className="flex items-center justify-center gap-1 font-mono text-orange-400"><CaloriesIcon className="w-4 h-4"/>{Math.round(totalMacros.calories)}</span>
      <span className="flex items-center justify-center gap-1 font-mono text-red-400"><ProteinIcon className="w-4 h-4"/>{Math.round(totalMacros.proteins)}</span>
      <span className="flex items-center justify-center gap-1 font-mono text-yellow-400"><CarbsIcon className="w-4 h-4"/>{Math.round(totalMacros.carbs)}</span>
      <span className="flex items-center justify-center gap-1 font-mono text-green-400"><FatsIcon className="w-4 h-4"/>{Math.round(totalMacros.fats)}</span>
      <span />
    </div>
  );
};

export default TotalsRow;