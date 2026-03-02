import React from 'react';
import { Label } from '@/components/ui/label';
import { Select as ShadcnSelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Combobox } from '@/components/ui/combobox';

const ProteinFields = ({
  formData,
  handleChange,
  handleSelectChange,
  allProteinSources,
  allAminograms,
  aminoAcidBreakdown,
  setAminoAcidBreakdown,
  selectedDominantAminos,
  onSelectedDominantAminosChange,
  selectedLimitingAminos,
  onSelectedLimitingAminosChange,
  isProteinSourceDisabled
}) => {
  const aminogramOptions = (allAminograms || []).map(a => ({ value: a.id, label: a.name }));

  const handleAminoValueChange = (aminoId, value) => {
    setAminoAcidBreakdown(prev => ({
      ...prev,
      [aminoId]: value
    }));
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="proteins">Proteínas (g/100g)</Label>
          <Input
            id="proteins"
            name="proteins"
            type="number"
            value={formData.proteins}
            onChange={handleChange}
            step="0.01"
           
            placeholder="0.00"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="protein_source_id">Fuente de Proteína</Label>
          <ShadcnSelect
            value={formData.protein_source_id?.toString()}
            onValueChange={(value) => handleSelectChange('protein_source_id', value)}
            disabled={isProteinSourceDisabled}
          >
            <SelectTrigger id="protein_source_id">
              <SelectValue placeholder="Seleccionar fuente..." />
            </SelectTrigger>
            <SelectContent>
              {allProteinSources && allProteinSources.map(source => (
                <SelectItem key={source.id} value={source.id.toString()}>
                  {source.name}
                </SelectItem>
              ))}
            </SelectContent>
          </ShadcnSelect>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label>Aminoácidos Dominantes</Label>
          <Combobox
            options={aminogramOptions}
            selectedValues={selectedDominantAminos}
            onSelectedValuesChange={onSelectedDominantAminosChange}
            placeholder="Seleccionar dominantes..."
            searchPlaceholder="Buscar aminoácido..."
            noResultsText="No se encontraron aminoácidos."
          />
        </div>

        <div className="space-y-2">
          <Label>Aminoácidos Limitantes</Label>
          <Combobox
            options={aminogramOptions}
            selectedValues={selectedLimitingAminos}
            onSelectedValuesChange={onSelectedLimitingAminosChange}
            placeholder="Seleccionar limitantes..."
            searchPlaceholder="Buscar aminoácido..."
            noResultsText="No se encontraron aminoácidos."
          />
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-muted-foreground">Desglose de Aminoácidos (mg/100g)</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 bg-card/30 p-4 rounded-lg border border-border">
          {allAminograms && allAminograms.map(amino => (
            <div key={amino.id} className="space-y-1">
              <Label htmlFor={`amino-${amino.id}`} className="text-xs text-muted-foreground truncate block" title={amino.name}>
                {amino.name}
              </Label>
              <Input
                id={`amino-${amino.id}`}
                type="number"
                value={aminoAcidBreakdown[amino.id] || ''}
                onChange={(e) => handleAminoValueChange(amino.id, e.target.value)}
                className="h-8 text-xs bg-muted border-border"
                placeholder="0"
                step="0.01"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProteinFields;
