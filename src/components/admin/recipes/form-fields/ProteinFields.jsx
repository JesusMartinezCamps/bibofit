import React, { useMemo, useEffect } from 'react';
import { InputWithUnit } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Combobox } from '@/components/ui/combobox';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { CornerDownLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SyncButton = ({ onClick }) => (
  <div className="w-6 h-6 flex items-center justify-center">
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" variant="ghost" size="icon" className="h-5 w-5 text-red-400 hover:bg-red-200/50" onClick={onClick}>
            <CornerDownLeft className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent><p>Usar valor calculado</p></TooltipContent>
      </Tooltip>
    </TooltipProvider>
  </div>
);

const formatNumber = (num) => {
    const number = parseFloat(num);
    if (isNaN(number)) return "0";
    return Number(number.toFixed(2)).toString();
};

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
  isProteinSourceDisabled,
}) => {
  const calculatedTotalProteins = useMemo(() => {
    const sum = Object.values(aminoAcidBreakdown).reduce((acc, val) => {
      if (val) {
        return acc + (parseFloat(val) || 0) / 1000;
      }
      return acc;
    }, 0);
    return sum;
  }, [aminoAcidBreakdown]);

  useEffect(() => {
    const animalSource = allProteinSources.find(s => s.name === 'Animal');
    if (animalSource && String(formData.protein_source_id) === String(animalSource.id)) {
      const allAminoIds = allAminograms.map(a => a.id);
      onSelectedDominantAminosChange(allAminoIds);
    }
  }, [formData.protein_source_id, allProteinSources, allAminograms, onSelectedDominantAminosChange]);

  const handleAminoAcidChange = (aminoId, value) => {
    const newBreakdown = {
      ...aminoAcidBreakdown,
      [aminoId]: value,
    };
    setAminoAcidBreakdown(newBreakdown);
  };
  
  const aminogramOptions = useMemo(() => {
      if (!allAminograms) return [];
      return allAminograms.map(a => ({ value: a.id, label: a.name }));
  }, [allAminograms]);

  const handleDominantCheck = (aminoId, checked) => {
    const newSelection = checked
      ? [...selectedDominantAminos, aminoId]
      : selectedDominantAminos.filter(id => id !== aminoId);
    onSelectedDominantAminosChange(newSelection);
  };

  const handleLimitingCheck = (aminoId, checked) => {
    const newSelection = checked
      ? [...selectedLimitingAminos, aminoId]
      : selectedLimitingAminos.filter(id => id !== aminoId);
    onSelectedLimitingAminosChange(newSelection);
  };

  const manualTotalProteins = formatNumber(formData.proteins || 0);
  const formattedCalculatedTotalProteins = formatNumber(calculatedTotalProteins);
  const showSyncButton = calculatedTotalProteins > 0 && manualTotalProteins !== formattedCalculatedTotalProteins;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start">
        <div className="w-full sm:w-1/3 lg:w-1/4 flex-shrink-0 space-y-2">
          <Label htmlFor="proteins">Proteínas Totales (g)</Label>
          <InputWithUnit
            id="proteins"
            name="proteins"
            type="number"
            value={formData.proteins}
            onChange={handleChange}
            placeholder="0"
            unit="g"
            min="0"
            step="0.1"
          />
          <div className="text-xs text-gray-400 text-center pt-1 flex items-center justify-center gap-1 h-6">
            {calculatedTotalProteins > 0 && (
                <>
                  Calculado: 
                  <span className={cn("font-mono", showSyncButton && "text-red-300")}>{formattedCalculatedTotalProteins} g</span>
                </>
            )}
            {showSyncButton ? <SyncButton onClick={() => handleChange({ target: { name: 'proteins', value: formattedCalculatedTotalProteins } })} /> : (calculatedTotalProteins > 0 && <div className="w-6 h-6"></div>)}
          </div>
        </div>
        <div className="w-full sm:w-2/3 lg:w-3/4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="protein_source_id">Fuente de Proteína</Label>
              <Select
                name="protein_source_id"
                value={String(formData.protein_source_id || '')}
                onValueChange={(value) => handleSelectChange('protein_source_id', value)}
                disabled={isProteinSourceDisabled}
              >
                <SelectTrigger id="protein_source_id">
                  <SelectValue placeholder="Seleccionar fuente..." />
                </SelectTrigger>
                <SelectContent>
                  {allProteinSources && allProteinSources.map(source => (
                    <SelectItem key={source.id} value={String(source.id)}>{source.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Aminoácidos Dominantes</Label>
                    <Combobox
                        options={aminogramOptions}
                        selectedValues={selectedDominantAminos}
                        onSelectedValuesChange={onSelectedDominantAminosChange}
                        placeholder="Seleccionar..."
                        searchPlaceholder="Buscar aminoácido..."
                        noResultsText="No encontrado."
                        keepOptionsOnSelect={true}
                        showSelectedBadges={false}
                    />
                </div>
                <div className="space-y-2">
                    <Label>Aminoácidos Limitantes</Label>
                    <Combobox
                        options={aminogramOptions}
                        selectedValues={selectedLimitingAminos}
                        onSelectedValuesChange={onSelectedLimitingAminosChange}
                        placeholder="Seleccionar..."
                        searchPlaceholder="Buscar aminoácido..."
                        noResultsText="No encontrado."
                        keepOptionsOnSelect={true}
                        showSelectedBadges={false}
                    />
                </div>
            </div>
        </div>
      </div>

      <div className="space-y-3 pt-4">
        <Label className="text-gray-300">Desglose de Aminoácidos (mg por 100g de alimento)</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allAminograms && allAminograms.map(aminoInfo => {
            const isDominant = selectedDominantAminos.includes(aminoInfo.id);
            const isLimiting = selectedLimitingAminos.includes(aminoInfo.id);
            const value = aminoAcidBreakdown[aminoInfo.id] || '';
            const hasValue = value && parseFloat(value) > 0;

            const cardClass = cn(
              "p-2 rounded-md border border-gray-700 space-y-2 transition-all",
              {
                "amino-dominant": isDominant,
                "amino-limiting": isLimiting && !isDominant,
                "amino-valued": hasValue && !isDominant && !isLimiting,
              }
            );

            return (
              <div key={aminoInfo.id} className={cardClass}>
                <div className="flex items-center justify-between">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Label htmlFor={`amino_mg_${aminoInfo.id}`} className="cursor-pointer">{aminoInfo.name}</Label>
                      </TooltipTrigger>
                      <TooltipContent className="bg-[#282d34] text-white border-gray-600 max-w-xs">
                        <p className="font-bold mb-2">{aminoInfo.name}</p>
                        <p className="text-sm text-gray-300">{aminoInfo.funcion}</p>
                        {aminoInfo.beneficios && <p className="text-sm mt-2 text-green-400">Beneficios: {aminoInfo.beneficios}</p>}
                        {aminoInfo.deficiencias && <p className="text-sm mt-2 text-red-400">Deficiencias: {aminoInfo.deficiencias}</p>}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <div className="flex items-center space-x-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Checkbox
                            checked={isDominant}
                            onCheckedChange={(checked) => handleDominantCheck(aminoInfo.id, checked)}
                            className="h-5 w-5 border-green-400 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                          />
                        </TooltipTrigger>
                        <TooltipContent>Dominante</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Checkbox
                            checked={isLimiting}
                            onCheckedChange={(checked) => handleLimitingCheck(aminoInfo.id, checked)}
                            className="h-5 w-5 border-red-400 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
                          />
                        </TooltipTrigger>
                        <TooltipContent>Limitante</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
                <InputWithUnit
                  id={`amino_mg_${aminoInfo.id}`}
                  type="number"
                  min="0"
                  step="1"
                  value={value}
                  onChange={(e) => handleAminoAcidChange(aminoInfo.id, e.target.value)}
                  placeholder="0"
                  unit="mg"
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ProteinFields;