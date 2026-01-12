import React, { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Combobox } from '@/components/ui/combobox';
import FatSubgroup from './FatSubgroup';
import CarbAndFiberFields from './CarbAndFiberFields';
import CarbDetailsFields from './CarbDetailsFields';
import FatInputRow from './FatInputRow';
import ProteinFields from './ProteinFields';

const MacroFields = ({ 
  formData, 
  handleChange,
  fatBreakdown,
  carbBreakdown,
  aminoAcidBreakdown,
  onBreakdownChange,
  groupedFatTypes,
  fatTypesOrder,
  allCarbTypes,
  allAminograms,
  allCarbSubtypes,
  selectedCarbSubtypes,
  onSelectedCarbSubtypesChange,
  carbNutritionalData,
  onCarbDataChange,
  allProteinSources,
  handleSelectChange,
  setAminoAcidBreakdown,
  selectedDominantAminos,
  onSelectedDominantAminosChange,
  selectedLimitingAminos,
  onSelectedLimitingAminosChange,
  isProteinSourceDisabled,
}) => {

  const totalFats = useMemo(() => {
    return Object.values(fatBreakdown).reduce((sum, val) => sum + (parseFloat(val) || 0), 0).toFixed(1);
  }, [fatBreakdown]);

  const totalCarbs = useMemo(() => {
    return Object.values(carbBreakdown).reduce((sum, val) => sum + (parseFloat(val) || 0), 0).toFixed(1);
  }, [carbBreakdown]);

  const { topRowFats, otherFats } = useMemo(() => {
    const topRowNames = ['Grasas saturadas', 'Grasas trans', 'Colesterol'];
    const topRow = [];
    const others = [];
    (fatTypesOrder || []).forEach(ft => {
      if (topRowNames.includes(ft.name)) {
        topRow.push(ft);
      } else {
        others.push(ft);
      }
    });
    return { topRowFats: topRow, otherFats: others };
  }, [fatTypesOrder]);

  const otherGroupedFatTypes = useMemo(() => {
    if (!otherFats) return {};
    return otherFats.reduce((acc, fatType) => {
      const type = fatType.type || 'Otros';
      if (!acc[type]) acc[type] = [];
      acc[type].push(fatType);
      return acc;
    }, {});
  }, [otherFats]);

  const sortedGroupedFatTypes = useMemo(() => {
    const groupOrder = [...new Set((fatTypesOrder || []).map(ft => ft.type))];
    return Object.entries(otherGroupedFatTypes).sort(([a], [b]) => {
      return groupOrder.indexOf(a) - groupOrder.indexOf(b);
    });
  }, [otherGroupedFatTypes, fatTypesOrder]);

  return (
    <div className="space-y-6">
      <ProteinFields
        formData={formData}
        handleChange={handleChange}
        handleSelectChange={handleSelectChange}
        allProteinSources={allProteinSources}
        allAminograms={allAminograms}
        aminoAcidBreakdown={aminoAcidBreakdown}
        onBreakdownChange={onBreakdownChange}
        setAminoAcidBreakdown={setAminoAcidBreakdown}
        selectedDominantAminos={selectedDominantAminos}
        onSelectedDominantAminosChange={onSelectedDominantAminosChange}
        selectedLimitingAminos={selectedLimitingAminos}
        onSelectedLimitingAminosChange={onSelectedLimitingAminosChange}
        isProteinSourceDisabled={isProteinSourceDisabled}
      />

      <div className="flex flex-col sm:flex-row gap-4 items-start">
        <div className="w-full sm:w-[15%] flex-shrink-0 space-y-2">
          <Label>Grasas Totales</Label>
          <div className="h-10 flex items-center justify-center px-3 rounded-md border border-input bg-gray-800/30">
            <span className="font-mono">{totalFats} g</span>
          </div>
        </div>
        <div className="w-full sm:w-[85%] space-y-4">
            {topRowFats.length > 0 && (
                <div className="px-4 grid grid-cols-3 gap-x-6 gap-y-4">
                    {topRowFats.map(type => (
                         <FatInputRow
                            key={type.id}
                            type={type}
                            value={fatBreakdown[type.id] || ''}
                            onChange={(value) => onBreakdownChange('fat', type.id, value)}
                        />
                    ))}
                </div>
            )}
            {sortedGroupedFatTypes.map(([type, fatTypes]) => (
                <FatSubgroup
                    key={type}
                    title={type}
                    fatTypes={fatTypes}
                    breakdown={fatBreakdown}
                    onChange={onBreakdownChange}
                />
            ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start">
        <div className="w-full sm:w-[15%] flex-shrink-0 space-y-2">
          <Label>Hidratos Totales</Label>
            <div className="h-10 flex items-center justify-center px-3 rounded-md border border-input bg-gray-800/30">
              <span className="font-mono">{totalCarbs} g</span>
            </div>
        </div>
        <div className="w-full sm:w-[85%] space-y-4">
            <div className="macro-subgroup">
                <Label className="text-gray-300 mb-2 block px-4">Desglose General</Label>
                <div className="px-4">
                    <CarbAndFiberFields carbTypes={allCarbTypes} breakdown={carbBreakdown} onChange={onBreakdownChange} />
                </div>
            </div>
            
            <div className="macro-subgroup">
                <Label className="text-gray-300 mb-4 block px-4">Análisis Detallado de Carbohidratos</Label>
                <div className="px-4 space-y-4">
                    <Combobox
                      options={allCarbSubtypes.map(s => ({ value: s.id, label: s.name }))}
                      selectedValues={selectedCarbSubtypes}
                      onSelectedValuesChange={onSelectedCarbSubtypesChange}
                      placeholder="Seleccionar subtipos de CH..."
                      searchPlaceholder="Buscar subtipo..."
                      noResultsText="No se encontraron subtipos."
                    />
                    {selectedCarbSubtypes.length > 0 && (
                      <CarbDetailsFields
                        allSubtypes={allCarbSubtypes}
                        selectedSubtypeIds={selectedCarbSubtypes}
                        carbData={carbNutritionalData}
                        onCarbDataChange={onCarbDataChange}
                      />
                    )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default MacroFields;