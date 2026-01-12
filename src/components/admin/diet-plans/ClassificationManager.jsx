import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabaseClient';

export const AXIS_OPTIONS_STATIC = {
  objective: [
    "Pérdida de peso", "Recomposición corporal", "Mantenimiento", 
    "Ganancia muscular", "Energía", "Proteína", "Recuperación post-entreno"
  ],
  lifestyle: [
    "Estudiante", "Trabajador de oficina", "Programador", "Viajero", 
    "Padre/Madre ocupado", "Minimalista", "Batch-cooking", "Sin cocinar", "Gourmet"
  ]
};

const AXIS_LABELS = {
    objective: "Objetivo",
    lifestyle: "Estilo de Vida",
    nutrition_style: "Estilo Nutricional (Diet Types)"
};

const ClassificationManager = ({ selectedValues = {}, onChange, readOnly = false }) => {
  const [dietTypes, setDietTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDietTypes = async () => {
      const { data, error } = await supabase
        .from('diet_types')
        .select('name')
        .order('name');
      
      if (!error && data) {
        setDietTypes(data.map(d => d.name));
      }
      setLoading(false);
    };
    fetchDietTypes();
  }, []);

  // Helper to toggle a value in an array
  const toggleValue = (axis, value) => {
    const currentValues = selectedValues[axis] || [];
    let newValues;
    if (currentValues.includes(value)) {
      newValues = currentValues.filter(v => v !== value);
    } else {
      newValues = [...currentValues, value];
    }
    onChange(axis, newValues);
  };

  if (readOnly) {
      return (
          <div className="space-y-2">
              {Object.entries(selectedValues).map(([axis, values]) => {
                  if (!values || values.length === 0) return null;
                  if (!AXIS_LABELS[axis]) return null; 
                  return (
                      <div key={axis} className="flex flex-wrap gap-1 items-center text-sm">
                           <span className="text-gray-400 text-xs w-24">{AXIS_LABELS[axis]}:</span>
                           <div className="flex flex-wrap gap-1">
                               {values.map(v => (
                                   <Badge key={v} variant="secondary" className="text-xs">{v}</Badge>
                               ))}
                           </div>
                      </div>
                  )
              })}
          </div>
      )
  }

  const allOptions = {
      ...AXIS_OPTIONS_STATIC,
      nutrition_style: dietTypes
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Object.entries(allOptions).map(([axis, options]) => (
        <div key={axis} className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                {AXIS_LABELS[axis]}
            </label>
            <div className="flex flex-wrap gap-2">
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            role="combobox"
                            size="sm"
                            className={cn(
                                "justify-between text-left font-normal h-auto min-h-[2rem] py-1 w-full md:w-[250px]",
                                (selectedValues[axis] || []).length > 0 ? "text-white border-green-500/50 bg-green-500/10" : "text-gray-400"
                            )}
                        >
                            {(selectedValues[axis] || []).length > 0 
                                ? `${(selectedValues[axis] || []).length} seleccionados`
                                : "Seleccionar..."}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[250px] p-0 bg-[#1a1e23] border-gray-700 text-white" align="start">
                        <Command className="bg-transparent">
                            <CommandInput placeholder={`Buscar ${AXIS_LABELS[axis]?.toLowerCase() || '...'}...`} className="h-9" />
                            <CommandEmpty>No encontrado.</CommandEmpty>
                            <CommandGroup className="max-h-64 overflow-y-auto styled-scrollbar-green">
                                {options.map((option) => {
                                    const isSelected = (selectedValues[axis] || []).includes(option);
                                    return (
                                        <CommandItem
                                            key={option}
                                            value={option}
                                            onSelect={() => toggleValue(axis, option)}
                                            className="cursor-pointer hover:bg-gray-800 aria-selected:bg-gray-800"
                                        >
                                            <div className={cn(
                                                "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                isSelected ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible"
                                            )}>
                                                <Check className={cn("h-4 w-4")} />
                                            </div>
                                            {option}
                                        </CommandItem>
                                    );
                                })}
                            </CommandGroup>
                        </Command>
                    </PopoverContent>
                </Popover>
                 {(selectedValues[axis] || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                        {(selectedValues[axis] || []).map(val => (
                            <Badge key={val} variant="secondary" className="bg-slate-800 text-gray-300 hover:bg-slate-700 flex items-center gap-1 text-xs font-normal">
                                {val}
                                <X 
                                    className="h-3 w-3 cursor-pointer hover:text-white" 
                                    onClick={() => toggleValue(axis, val)}
                                />
                            </Badge>
                        ))}
                    </div>
                )}
            </div>
        </div>
      ))}
    </div>
  );
};

export default ClassificationManager;