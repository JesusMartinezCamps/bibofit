import React, { useState, useEffect, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Combobox } from '@/components/ui/combobox';
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

  useEffect(() => {
    const fetchDietTypes = async () => {
      const { data, error } = await supabase
        .from('diet_types')
        .select('name')
        .order('name');
      
      if (!error && data) {
        setDietTypes(data.map(d => d.name));
      }
    };
    fetchDietTypes();
  }, []);

  const allOptions = {
      ...AXIS_OPTIONS_STATIC,
      nutrition_style: dietTypes
  };
  const optionSets = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(allOptions).map(([axis, options]) => [
          axis,
          options.map((option) => ({ value: option, label: option })),
        ])
      ),
    [allOptions]
  );

  if (readOnly) {
      return (
          <div className="space-y-2">
              {Object.entries(selectedValues).map(([axis, values]) => {
                  if (!values || values.length === 0) return null;
                  if (!AXIS_LABELS[axis]) return null; 
                  return (
                      <div key={axis} className="flex flex-wrap gap-1 items-center text-sm">
                           <span className="text-muted-foreground text-xs w-24">{AXIS_LABELS[axis]}:</span>
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Object.entries(allOptions).map(([axis]) => (
        <div key={axis} className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                {AXIS_LABELS[axis]}
            </label>
            <Combobox
              options={optionSets[axis] || []}
              selectedValues={selectedValues[axis] || []}
              onSelectedValuesChange={(newValues) => onChange(axis, newValues)}
              placeholder="Seleccionar..."
              searchPlaceholder={`Buscar ${AXIS_LABELS[axis]?.toLowerCase() || '...'}...`}
              noResultsText="No encontrado."
              triggerClassName="w-full md:w-[250px]"
              keepOptionsOnSelect
            />
        </div>
      ))}
    </div>
  );
};

export default ClassificationManager;
