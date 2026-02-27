import React from 'react';
import { Button } from '@/components/ui/button';
import { LAYOUT_OPTIONS } from './layoutTypes';
import { cn } from '@/lib/utils';

const IngredientLayoutSelector = ({ value, onChange }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
      {LAYOUT_OPTIONS.map((option) => {
        const isActive = option.id === value;
        return (
          <Button
            key={option.id}
            type="button"
            variant="outline"
            onClick={() => onChange(option.id)}
            className={cn(
              'h-auto flex flex-col items-start p-3 border-slate-700 text-left whitespace-normal',
              isActive && 'border-green-500 bg-green-500/10 text-green-300'
            )}
          >
            <span className="font-semibold">{option.name}</span>
            <span className="text-xs text-slate-300">{option.description}</span>
          </Button>
        );
      })}
    </div>
  );
};

export default IngredientLayoutSelector;
