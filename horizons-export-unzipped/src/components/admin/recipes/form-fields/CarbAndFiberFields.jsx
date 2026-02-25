import React from 'react';
import { InputWithUnit } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const CarbAndFiberFields = ({ carbTypes, breakdown, onChange }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {carbTypes.map(type => (
        <div key={type.id} className="space-y-2">
           <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Label htmlFor={`carb_type_${type.id}`}>{type.name}</Label>
              </TooltipTrigger>
              <TooltipContent className="bg-gray-800 text-white border-gray-700">
                <p>{type.description}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <InputWithUnit
            id={`carb_type_${type.id}`}
            name={`carb_type_${type.id}`}
            type="number"
            min="0"
            step="0.1"
            value={breakdown[type.id] || ''}
            onChange={(e) => onChange('carb', type.id, e.target.value)}
            unit="g"
            placeholder="0.0"
          />
        </div>
      ))}
    </div>
  );
};

export default CarbAndFiberFields;