import React from 'react';
    import { cn } from '@/lib/utils';
    import { Target } from 'lucide-react';
    import ProteinIcon from '@/components/icons/ProteinIcon';
    import CarbsIcon from '@/components/icons/CarbsIcon';
    import FatsIcon from '@/components/icons/FatsIcon';
    import CaloriesIcon from '@/components/icons/CaloriesIcon';

    const TargetMacrosRow = ({ targetMacros, gridStyle }) => {
      if (!targetMacros) {
        return null;
      }

      const { target_calories, target_proteins, target_carbs, target_fats } = targetMacros;

      return (
        <div
          className={cn(
            "grid items-center mt-1 pt-2 border-t border-dashed border-slate-600 text-sm font-bold gap-x-2 pl-4 text-[#4AD1E0]",
          )}
          style={gridStyle}
        >
          <span/>
          <span className="font-bold flex items-center gap-2"><Target className="w-4 h-4" />OBJETIVOS</span>
          <span />
          <span className="flex items-center justify-center gap-1 font-mono"><CaloriesIcon className="w-4 h-4" />{Math.round(target_calories || 0)}</span>
          <span className="flex items-center justify-center gap-1 font-mono"><ProteinIcon className="w-4 h-4" />{Math.round(target_proteins || 0)}</span>
          <span className="flex items-center justify-center gap-1 font-mono"><CarbsIcon className="w-4 h-4" />{Math.round(target_carbs || 0)}</span>
          <span className="flex items-center justify-center gap-1 font-mono"><FatsIcon className="w-4 h-4" />{Math.round(target_fats || 0)}</span>
          <span />
        </div>
      );
    };

    export default TargetMacrosRow;