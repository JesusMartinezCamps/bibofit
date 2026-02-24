import React, { useState, useMemo, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { InputWithUnit } from '@/components/ui/input';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { ChevronDown, CornerDownLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import FatInputRow from './FatInputRow';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';

const SyncButton = ({ onClick }) => (
  <div className="w-6 h-6 flex items-center justify-center">
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" variant="ghost" size="icon" className="h-5 w-5 text-green-400 hover:bg-green-200/50" onClick={onClick}>
            <CornerDownLeft className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent><p>Usar valor calculado y actualizar desglose</p></TooltipContent>
      </Tooltip>
    </TooltipProvider>
  </div>
);

const formatNumber = (num) => {
    const number = parseFloat(num);
    if (isNaN(number)) return "0";
    return Number(number.toFixed(2)).toString();
};

const FatFields = ({
  formData,
  manualFatClassificationBreakdown,
  fatClassificationBreakdown,
  fatTypeBreakdown,
  onManualBreakdownChange,
  onFatTypeChange,
  allFatClassifications,
  groupedFatTypes,
  setOpenSection,
  handleTotalFatsSync,
  handleFatClassificationSync
}) => {
  const [openState, setOpenState] = useState({});

  useEffect(() => {
      const newOpenState = {};
      let shouldUpdate = false;
      Object.keys(manualFatClassificationBreakdown).forEach(id => {
        const value = parseFloat(manualFatClassificationBreakdown[id]);
        if(value > 0 && !openState[id]) {
            newOpenState[id] = true;
            shouldUpdate = true;
        } else if ((!value || value === 0) && openState[id]) {
            const typesInClassification = groupedFatTypes[id] || [];
            const sumOfTypes = typesInClassification.reduce((sum, type) => sum + (parseFloat(fatTypeBreakdown[type.id]) || 0), 0);
            if(sumOfTypes === 0) {
              newOpenState[id] = false;
              shouldUpdate = true;
            }
        }
      });

      if(shouldUpdate) {
        setOpenState(prev => ({...prev, ...newOpenState}));
      }

  }, [manualFatClassificationBreakdown, fatTypeBreakdown, groupedFatTypes]);

  const toggleOpen = (id) => {
    setOpenState(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const totalFats = formatNumber(formData.total_fats || 0);

  const calculatedTotalFats = useMemo(() => {
    return Object.values(fatClassificationBreakdown || {}).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
  }, [fatClassificationBreakdown]);

  const formattedCalculatedTotalFats = formatNumber(calculatedTotalFats);
  const showTotalFatsSync = calculatedTotalFats > 0 && totalFats !== formattedCalculatedTotalFats;
  
  const { unhealthyFats, healthyFats, insaturatedFats } = useMemo(() => {
    const unhealthy = [];
    const healthy = [];
    const insaturated = {};
    const unhealthyNames = ['Grasas Trans', 'Colesterol', 'Grasa Saturada'];
    const insaturatedNames = ['Grasa Monoinsaturada', 'Grasa Poliinsaturada'];

    allFatClassifications.forEach(classification => {
      if (unhealthyNames.includes(classification.name)) {
        unhealthy.push(classification);
      } else if (insaturatedNames.includes(classification.name)) {
        insaturated[classification.name] = classification;
      } else {
        healthy.push(classification);
      }
    });
    return { unhealthyFats: unhealthy, healthyFats: healthy, insaturatedFats: insaturated };
  }, [allFatClassifications]);

  const renderClassification = (classification) => {
    const typesInClassification = groupedFatTypes[classification.id] || [];
    if (!classification) return null;

    const manualValue = manualFatClassificationBreakdown[classification.id] || '';
    const calculatedValue = parseFloat(fatClassificationBreakdown[classification.id] || 0);
    const hasManualValue = parseFloat(manualValue) > 0;
    const isOpen = openState[classification.id] ?? hasManualValue;

    const formattedCalculatedValue = formatNumber(calculatedValue);
    const showSyncButton = calculatedValue > 0 && formatNumber(manualValue) !== formattedCalculatedValue;

    const omega3Types = typesInClassification.filter(t => t.name.startsWith('Omega-3'));
    const omega6Types = typesInClassification.filter(t => t.name.startsWith('Omega-6'));
    const otherTypes = typesInClassification.filter(t => !t.name.startsWith('Omega-3') && !t.name.startsWith('Omega-6'));
    const isPoliunsaturated = classification.name === 'Grasa Poliinsaturada';

    const isUnhealthy = unhealthyFats.some(uf => uf.id === classification.id);
    const labelColor = isUnhealthy ? 'text-red-400' : 'text-green-400';
    const borderColor = isUnhealthy ? 'border-red-700/80' : 'border-gray-700/80';
    const syncColor = isUnhealthy ? 'text-red-400 hover:bg-red-200/50' : 'text-green-400 hover:bg-green-200/50';
    const focusRingColor = isUnhealthy ? 'focus:ring-red-500' : 'focus:ring-green-500';

    return (
      <div className="w-full">
        <div key={classification.id} className={cn("p-4 rounded-lg border flex flex-col h-full", borderColor)}>
          <div className="space-y-2 flex-grow">
            <div className="flex items-center gap-4">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Label htmlFor={`fat_class_${classification.id}`} className={cn("flex-1 cursor-help text-lg", labelColor)}>{classification.name}</Label>
                  </TooltipTrigger>
                  <TooltipContent className="bg-[#282d34] text-white border-gray-600 max-w-xs">
                    <p className="font-bold mb-2">{classification.name}</p>
                    {classification.benefits && <p className="text-sm text-green-400">Beneficios: {classification.benefits}</p>}
                    {classification.risks && <p className="text-sm mt-2 text-red-400">Riesgos: {classification.risks}</p>}
                    {classification.recomendations && <p className="text-sm mt-2 text-blue-400">Recomendaciones: {classification.recomendations}</p>}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <InputWithUnit
                id={`fat_class_${classification.id}`}
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                unit="g"
                value={manualValue}
                onChange={(e) => onManualBreakdownChange('fatClassification', classification.id, e.target.value)}
                className={cn("w-32 text-right", focusRingColor)}
              />
            </div>
            {typesInClassification.length > 0 && (
              <div className="text-xs text-gray-400 text-right flex items-center justify-end gap-2 h-6">
                {calculatedValue > 0 && (
                  <>
                    Calculado del desglose: 
                    <span className={cn("font-mono", showSyncButton && syncColor)}>{formattedCalculatedValue} g</span>
                  </>
                )}
                {showSyncButton ? <SyncButton onClick={() => handleFatClassificationSync(classification.id)} /> : (calculatedValue > 0 && <div className="w-6 h-6"></div>)}
              </div>
            )}
          </div>

          {typesInClassification.length > 0 && (
            <Collapsible open={isOpen} onOpenChange={() => toggleOpen(classification.id)} className="mt-4">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-start p-2 -ml-2 text-sm text-gray-400 hover:text-white hover:bg-slate-700">
                  <ChevronDown className={`h-4 w-4 mr-2 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                  Desglose por Tipos de Grasa
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4 pt-4 border-t border-gray-700/50 space-y-4">
                {isPoliunsaturated ? (
                  <>
                    {omega3Types.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-gray-300">Omega 3</Label>
                        {omega3Types.map(type => <FatInputRow key={type.id} type={type} value={fatTypeBreakdown[type.id] || ''} onChange={(value) => onFatTypeChange(type.id, value)} isRow={true} />)}
                      </div>
                    )}
                    {omega6Types.length > 0 && (
                      <div className="space-y-2">
                         <Label className="text-gray-300">Omega 6</Label>
                        {omega6Types.map(type => <FatInputRow key={type.id} type={type} value={fatTypeBreakdown[type.id] || ''} onChange={(value) => onFatTypeChange(type.id, value)} isRow={true} />)}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-2">
                    {otherTypes.map(type => <FatInputRow key={type.id} type={type} value={fatTypeBreakdown[type.id] || ''} onChange={(value) => onFatTypeChange(type.id, value)} isRow={true} />)}
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </div>
    );
  };

  const renderUnhealthyClassification = (classification) => {
    if (!classification) return null;
    const isUnhealthy = unhealthyFats.some(uf => uf.id === classification.id);
    const labelColor = isUnhealthy ? 'text-red-400' : 'text-green-400';
    const borderColor = isUnhealthy ? 'border-red-700/80' : 'border-gray-700/80';
    const focusRingColor = isUnhealthy ? 'focus:ring-red-500' : 'focus:ring-green-500';

    return (
      <div key={classification.id} className={cn("p-4 rounded-lg border", borderColor)}>
        <div className="flex items-center gap-4">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Label htmlFor={`fat_class_${classification.id}`} className={cn("flex-1 cursor-help text-lg", labelColor)}>{classification.name}</Label>
              </TooltipTrigger>
              <TooltipContent className="bg-[#282d34] text-white border-gray-600 max-w-xs">
                <p className="font-bold mb-2">{classification.name}</p>
                {classification.benefits && <p className="text-sm text-green-400">Beneficios: {classification.benefits}</p>}
                {classification.risks && <p className="text-sm mt-2 text-red-400">Riesgos: {classification.risks}</p>}
                {classification.recomendations && <p className="text-sm mt-2 text-blue-400">Recomendaciones: {classification.recomendations}</p>}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <InputWithUnit
            id={`fat_class_${classification.id}`}
            type="number"
            min="0"
            step="0.01"
            placeholder="0"
            unit="g"
            value={manualFatClassificationBreakdown[classification.id] || ''}
            onChange={(e) => onManualBreakdownChange('fatClassification', classification.id, e.target.value)}
            className={cn("w-32 text-right", focusRingColor)}
          />
        </div>
      </div>
    );
  };

  const satFat = unhealthyFats.find(f => f.name === 'Grasa Saturada');
  const cholesterol = unhealthyFats.find(f => f.name === 'Colesterol');
  const transFat = unhealthyFats.find(f => f.name === 'Grasas Trans');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Label className="text-lg">Grasas Totales (g):</Label>
         <InputWithUnit
            id="total_fats"
            name="total_fats"
            type="number"
            value={formData.total_fats}
            onChange={(e) => onManualBreakdownChange('total_fats', null, e.target.value)}
            placeholder="0" unit="g" className="w-32 text-right"
        />
      </div>
      <div className="text-xs text-gray-500 text-right flex items-center justify-end gap-2 h-6">
        {calculatedTotalFats > 0 && (
          <>
              Calculado del desglose: 
              <span className={cn("font-mono", showTotalFatsSync && "text-green-400")}>{formattedCalculatedTotalFats} g</span>
          </>
        )}
        {showTotalFatsSync ? <SyncButton onClick={handleTotalFatsSync} /> : (calculatedTotalFats > 0 && <div className="w-6 h-6"></div>)}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {satFat && renderUnhealthyClassification(satFat)}
        {cholesterol && renderUnhealthyClassification(cholesterol)}
      </div>

      {transFat && (
        <div className="w-full">
          {renderUnhealthyClassification(transFat)}
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-3">
        <div className="md:w-1/2">
            {insaturatedFats['Grasa Monoinsaturada'] && renderClassification(insaturatedFats['Grasa Monoinsaturada'])}
        </div>
        <div className="md:w-1/2">
            {insaturatedFats['Grasa Poliinsaturada'] && renderClassification(insaturatedFats['Grasa Poliinsaturada'])}
        </div>
      </div>

    </div>
  );
};

export default FatFields;