import React from 'react';
import { Label } from '@/components/ui/label';
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from '@/lib/utils';

const CheckboxGrid = ({ title, options, selectedIds, onSelectionChange, color }) => {
  const checkboxColorClass = color === 'green'
    ? "data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
    : "data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500";

  const handleCheckedChange = (id, checked) => {
    if (checked) {
      onSelectionChange([...selectedIds, id]);
    } else {
      onSelectionChange(selectedIds.filter(selectedId => selectedId !== id));
    }
  };

  if (!options || options.length === 0) {
    return (
      <div className="space-y-3">
        <h3 className={cn("text-lg font-semibold", color === 'green' ? 'text-green-400' : 'text-red-400')}>{title}</h3>
        <div className="rounded-md border border-gray-700 p-4 bg-gray-800/50">
          <p className="text-gray-400">No hay opciones disponibles.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className={cn("text-lg font-semibold", color === 'green' ? 'text-green-400' : 'text-red-400')}>{title}</h3>
      <div className="rounded-md border border-gray-700 p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-3 bg-gray-800/50">
        {options.map((option) => (
          <div key={option.id} className="flex items-center space-x-2">
            <Checkbox
              id={`${title}-${option.id}`}
              checked={selectedIds.includes(option.id)}
              onCheckedChange={(checked) => handleCheckedChange(option.id, checked)}
              className={cn("transition-colors", checkboxColorClass)}
            />
            <Label
              htmlFor={`${title}-${option.id}`}
              className="text-sm font-medium leading-none text-gray-300 cursor-pointer"
            >
              {option.name}
            </Label>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CheckboxGrid;