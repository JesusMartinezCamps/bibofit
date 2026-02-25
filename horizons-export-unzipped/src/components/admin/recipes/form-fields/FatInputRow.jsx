import React from 'react';
import { Label } from '@/components/ui/label';
import { InputWithUnit } from '@/components/ui/input';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const FatInputRow = ({ type, value, onChange, isRow }) => {
    const containerClass = isRow ? "flex flex-row items-center justify-between gap-4" : "flex flex-col gap-2 items-center text-center justify-between h-full";

    return (
        <div className={cn(containerClass)}>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Label htmlFor={`fat_type_${type.id}`} className={cn("cursor-pointer text-sm", isRow ? "flex-1" : "flex-grow flex items-center justify-center")}>
                            {type.name}
                        </Label>
                    </TooltipTrigger>
                    <TooltipContent className="bg-[#282d34] text-white border-gray-600 max-w-xs">
                        <p className="font-bold mb-2">{type.name}</p>
                        <p className="text-sm text-gray-300">{type.description}</p>
                        {type.benefit_description && <p className="text-sm mt-2 text-green-400">Beneficios: {type.benefit_description}</p>}
                        {type.risk_description && <p className="text-sm mt-2 text-red-400">Riesgos: {type.risk_description}</p>}
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
            <InputWithUnit
                id={`fat_type_${type.id}`}
                name={`fat_type_${type.id}`}
                type="number"
                min="0"
                step="0.01"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="0"
                unit="g"
                className={cn("text-right", isRow ? "w-32" : "w-24")}
            />
        </div>
    );
};

export default FatInputRow;