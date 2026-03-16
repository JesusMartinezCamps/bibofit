import React, { useMemo } from 'react';
import { Combobox } from '@/components/ui/combobox';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Info, MinusCircle } from 'lucide-react';

/**
 * DietTypeSelector
 *
 * Props:
 *   dietTypes  – array of diet_type rows con reglas embebidas:
 *                [{ id, name, description, diet_type_food_group_rules: [{ rule_type, food_groups: { name } }] }]
 *   value      – diet_type_id como string (o '' / null si no hay selección)
 *   onChange   – (stringId | '') => void
 *   placeholder – string opcional
 */
const DietTypeSelector = ({ dietTypes = [], value, onChange, placeholder = 'Selecciona (Opcional)' }) => {
  const options = useMemo(() =>
    dietTypes.map((t) => ({ value: String(t.id), label: t.name })),
    [dietTypes]
  );

  const selectedType = useMemo(() =>
    dietTypes.find((t) => String(t.id) === String(value)) || null,
    [dietTypes, value]
  );

  const excludedGroups = useMemo(() => {
    if (!selectedType?.diet_type_food_group_rules) return [];
    return selectedType.diet_type_food_group_rules
      .filter((r) => r.rule_type === 'excluded')
      .map((r) => r.food_groups?.name)
      .filter(Boolean);
  }, [selectedType]);

  const limitedGroups = useMemo(() => {
    if (!selectedType?.diet_type_food_group_rules) return [];
    return selectedType.diet_type_food_group_rules
      .filter((r) => r.rule_type === 'limited')
      .map((r) => r.food_groups?.name)
      .filter(Boolean);
  }, [selectedType]);

  const hasRules = excludedGroups.length > 0 || limitedGroups.length > 0;

  return (
    <div className="space-y-3">
      <Combobox
        options={options}
        value={value ? String(value) : ''}
        onValueChange={(v) => onChange(v || '')}
        placeholder={placeholder}
        searchPlaceholder="Buscar tipo de dieta..."
        noResultsText="No se encontraron resultados."
      />

      {selectedType && (
        <div className="rounded-xl border border-border bg-card/40 p-4 space-y-3 text-sm">
          {/* Descripción nutricional */}
          <div className="flex gap-2.5">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-muted-foreground" />
            <p className="text-muted-foreground leading-relaxed">{selectedType.description}</p>
          </div>

          {/* Qué hace la app con esta dieta */}
          {hasRules && (
            <div className="space-y-2 pt-1 border-t border-border">
              <p className="text-xs font-medium text-foreground/70 uppercase tracking-wide">
                Cómo afecta a tus alimentos
              </p>

              {excludedGroups.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs text-red-400">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>No compatibles — se marcarán en rojo</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {excludedGroups.map((name) => (
                      <Badge
                        key={name}
                        className="bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20"
                      >
                        {name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {limitedGroups.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs text-orange-400">
                    <MinusCircle className="w-3.5 h-3.5" />
                    <span>Uso reducido recomendado — se marcarán en naranja</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {limitedGroups.map((name) => (
                      <Badge
                        key={name}
                        className="bg-orange-500/10 text-orange-400 border-orange-500/30 hover:bg-orange-500/20"
                      >
                        {name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {!hasRules && (
                <p className="text-xs text-muted-foreground italic">
                  Sin restricciones de grupos: todos los alimentos están disponibles.
                </p>
              )}
            </div>
          )}

          {!hasRules && selectedType && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1 border-t border-border">
              <Info className="w-3.5 h-3.5" />
              <span>Sin restricciones de grupos: todos los alimentos están disponibles.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DietTypeSelector;
