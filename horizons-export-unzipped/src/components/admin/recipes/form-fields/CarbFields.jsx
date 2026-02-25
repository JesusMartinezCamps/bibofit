import React, { useState, useMemo, useEffect } from 'react';
    import { InputWithUnit } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
    import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
    import { ChevronDown, ChevronsRight, CornerDownLeft } from 'lucide-react';
    import { Button } from '@/components/ui/button';
    import { cn } from '@/lib/utils';

    const SyncButton = ({ onClick, colorClass }) => (
      <div className="w-6 h-6 flex items-center justify-center">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className={cn("h-5 w-5", colorClass, "hover:bg-slate-200/50")} onClick={onClick}>
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
        const fixedNum = number.toFixed(2);
        return fixedNum.endsWith('.00') ? String(parseInt(number, 10)) : Number(fixedNum).toString();
    };


    const CarbFields = ({
      formData,
      manualCarbTypeBreakdown,
      manualCarbClassificationBreakdown,
      carbSubtypeBreakdown,
      onManualBreakdownChange,
      onSubtypeChange,
      allCarbTypes,
      allCarbClassifications,
      groupedCarbSubtypes,
      handleTotalCarbsSync,
      handleCarbTypeSync,
      handleCarbClassificationSync,
    }) => {
      const [openState, setOpenState] = useState({
        types: {},
        classifications: {},
      });

      useEffect(() => {
        const newOpenState = { types: {}, classifications: {} };
        let shouldUpdate = false;

        allCarbClassifications.forEach(classification => {
          const subtypes = (groupedCarbSubtypes && groupedCarbSubtypes[classification.id]) || [];
          const hasSubtypeData = subtypes.some(subtype =>
            carbSubtypeBreakdown?.[classification.id]?.[subtype.id] > 0
          );
          if (hasSubtypeData && !openState.classifications[classification.id]) {
            newOpenState.classifications[classification.id] = true;
            shouldUpdate = true;

            const typeId = classification.carb_type_id;
            if (typeId && !openState.types[typeId]) {
              newOpenState.types[typeId] = true;
            }
          }
        });

        allCarbTypes.forEach(type => {
          const classificationsForType = allCarbClassifications.filter(c => c.carb_type_id === type.id);
          const hasClassificationData = classificationsForType.some(c => manualCarbClassificationBreakdown?.[c.id] > 0);
          if (hasClassificationData && !openState.types[type.id]) {
            newOpenState.types[type.id] = true;
            shouldUpdate = true;
          }
        });

        if (shouldUpdate) {
          setOpenState(prev => ({
            types: { ...prev.types, ...newOpenState.types },
            classifications: { ...prev.classifications, ...newOpenState.classifications },
          }));
        }
      }, [manualCarbClassificationBreakdown, carbSubtypeBreakdown, allCarbTypes, allCarbClassifications, groupedCarbSubtypes]);


      const toggleOpen = (level, id) => {
        setOpenState(prev => ({
          ...prev,
          [level]: { ...prev[level], [id]: !prev[level][id] },
        }));
      };

      const handleInputChange = (level, id, value) => {
        onManualBreakdownChange(level, id, value);
        const numValue = parseFloat(value);
        const stateLevel = level === 'carbType' ? 'types' : 'classifications';
        
        if (numValue > 0) {
          if (!openState[stateLevel][id]) {
            setOpenState(prev => ({ ...prev, [stateLevel]: { ...prev[stateLevel], [id]: true } }));
          }
        } else {
          const sumOfChildren = level === 'carbType' 
            ? (allCarbClassifications.filter(c => c.carb_type_id === id).reduce((acc, c) => acc + (parseFloat(manualCarbClassificationBreakdown?.[c.id]) || 0), 0))
            : (groupedCarbSubtypes[id]?.reduce((acc, st) => acc + (parseFloat(carbSubtypeBreakdown?.[id]?.[st.id]) || 0), 0) || 0);

          if (sumOfChildren === 0 && openState[stateLevel][id]) {
            setOpenState(prev => ({ ...prev, [stateLevel]: { ...prev[stateLevel], [id]: false } }));
          }
        }
      };

      const sortedCarbTypes = useMemo(() => {
        return [...allCarbTypes].sort((a, b) => a.id - b.id);
      }, [allCarbTypes]);

      const calculatedClassificationValues = useMemo(() => {
        return allCarbClassifications.reduce((acc, classification) => {
          const subtypes = (groupedCarbSubtypes && groupedCarbSubtypes[classification.id]) || [];
          const sumOfSubtypes = subtypes.reduce((sum, subtype) => sum + (parseFloat(carbSubtypeBreakdown?.[classification.id]?.[subtype.id]) || 0), 0);
          
          const manualValue = parseFloat(manualCarbClassificationBreakdown?.[classification.id]);
          
          acc[classification.id] = sumOfSubtypes > 0 ? sumOfSubtypes : manualValue || 0;
          return acc;
        }, {});
      }, [carbSubtypeBreakdown, manualCarbClassificationBreakdown, allCarbClassifications, groupedCarbSubtypes]);

      const calculatedTypeValues = useMemo(() => {
        return allCarbTypes.reduce((acc, type) => {
          const classificationsForType = allCarbClassifications.filter(c => c.carb_type_id === type.id);
          const sumOfClassifications = classificationsForType.reduce((sum, classification) => {
            return sum + (calculatedClassificationValues[classification.id] || 0);
          }, 0);

          const manualValue = parseFloat(manualCarbTypeBreakdown?.[type.id]);

          acc[type.id] = sumOfClassifications > 0 ? sumOfClassifications : manualValue || 0;
          return acc;
        }, {});
      }, [calculatedClassificationValues, manualCarbTypeBreakdown, allCarbTypes, allCarbClassifications]);

      const calculatedTotalCarbs = useMemo(() => {
        return allCarbTypes.reduce((sum, type) => {
          return sum + (calculatedTypeValues[type.id] || 0);
        }, 0);
      }, [calculatedTypeValues, allCarbTypes]);

      const totalCarbs = formatNumber(formData.total_carbs || 0);
      const formattedCalculatedTotalCarbs = formatNumber(calculatedTotalCarbs);
      const showTotalCarbsSync = calculatedTotalCarbs > 0 && totalCarbs !== formattedCalculatedTotalCarbs;

      return (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Label className="text-lg">Hidratos Totales (g)</Label>
            <InputWithUnit
              id="total_carbs"
              name="total_carbs"
              type="number"
              value={formData.total_carbs}
              onChange={(e) => onManualBreakdownChange('total_carbs', null, e.target.value)}
              placeholder="0" unit="g" className="w-32 text-right"
            />
          </div>
          
            <div className="text-right text-xs text-gray-500 flex items-center justify-end gap-2 h-6">
              {calculatedTotalCarbs > 0 && (
                <>
                  Calculado del desglose: 
                  <span className={cn("font-mono", showTotalCarbsSync && "text-orange-400")}>{formattedCalculatedTotalCarbs} g</span>
                </>
              )}
              {showTotalCarbsSync ? (
                  <SyncButton onClick={() => handleTotalCarbsSync(calculatedTotalCarbs, calculatedTypeValues, calculatedClassificationValues)} colorClass="text-orange-400 hover:bg-orange-200/50" />
              ) : <div className="w-6 h-6"></div>}
            </div>


          <div className="space-y-3">
            {sortedCarbTypes.map(carbType => {
              const classificationsForType = allCarbClassifications
                .filter(c => c.carb_type_id === carbType.id)
                .sort((a,b) => a.id - b.id);

              const manualTypeValue = (manualCarbTypeBreakdown && manualCarbTypeBreakdown[carbType.id]) || '';
              const isTypeOpen = openState.types[carbType.id] ?? false;

              const calculatedTypeValue = calculatedTypeValues[carbType.id] || 0;
              const formattedCalculatedTypeValue = formatNumber(calculatedTypeValue);
              const showTypeSync = calculatedTypeValue > 0 && formatNumber(manualTypeValue) !== formattedCalculatedTypeValue;

              return (
                <div key={carbType.id} className="p-4 rounded-lg border border-gray-700/80">
                  <div className="space-y-1">
                    <div className="flex items-center gap-4">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Label htmlFor={`carb_type_${carbType.id}`} className="flex-1 cursor-help text-lg text-orange-400">{carbType.name}</Label>
                          </TooltipTrigger>
                          <TooltipContent className="bg-[#282d34] text-white border-gray-600 max-w-xs">
                            <p>{carbType.description}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <InputWithUnit
                        id={`carb_type_${carbType.id}`}
                        type="number" min="0" step="0.1"
                        value={manualTypeValue}
                        onChange={(e) => handleInputChange('carbType', carbType.id, e.target.value)}
                        placeholder="0" unit="g" className="w-32 text-right"
                      />
                    </div>
                    <div className="text-right text-xs text-gray-500 flex items-center justify-end gap-2 h-6">
                      {classificationsForType.length > 0 && calculatedTypeValue > 0 && (
                          <>
                            Calculado del desglose: 
                            <span className={cn("font-mono", showTypeSync && "text-orange-400")}>{formattedCalculatedTypeValue} g</span>
                          </>
                      )}
                      {showTypeSync ? (
                        <SyncButton onClick={() => handleCarbTypeSync(carbType.id, calculatedTypeValue, calculatedClassificationValues)} colorClass="text-orange-400 hover:bg-orange-200/50" />
                      ) : (classificationsForType.length > 0 && calculatedTypeValue > 0 && <div className="w-6 h-6"></div>)}
                    </div>
                  </div>

                  {classificationsForType.length > 0 && (
                    <Collapsible open={isTypeOpen} onOpenChange={() => toggleOpen('types', carbType.id)} className="mt-2">
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" className="w-full justify-start p-2 -ml-2 text-sm text-gray-400 hover:text-white hover:bg-slate-700">
                          <ChevronDown className={`h-4 w-4 mr-2 transform transition-transform ${isTypeOpen ? 'rotate-180' : ''}`} />
                          Desglose por Clasificación
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2 pl-4 border-l-2 border-orange-500/30 space-y-3">
                        {classificationsForType.map(classification => {
                          const subtypes = ((groupedCarbSubtypes && groupedCarbSubtypes[classification.id]) || []).sort((a,b) => a.id - b.id);
                          const manualClassificationValue = (manualCarbClassificationBreakdown && manualCarbClassificationBreakdown[classification.id]) || '';
                          const isClassificationOpen = openState.classifications[classification.id] ?? false;
                          
                          const calculatedClassificationValue = calculatedClassificationValues[classification.id] || 0;
                          const formattedCalculatedClassificationValue = formatNumber(calculatedClassificationValue);
                          const showClassificationSync = calculatedClassificationValue > 0 && formatNumber(manualClassificationValue) !== formattedCalculatedClassificationValue;

                          return (
                            <div key={classification.id} className="p-3 rounded-md border border-gray-600/50">
                              <div className="space-y-1">
                                <div className="flex items-center gap-4">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Label htmlFor={`carb_class_${classification.id}`} className="flex-1 cursor-help">{classification.name}</Label>
                                      </TooltipTrigger>
                                      <TooltipContent className="bg-[#282d34] text-white border-gray-600 max-w-xs"><p>{classification.description}</p></TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  <InputWithUnit
                                    id={`carb_class_${classification.id}`}
                                    type="number" min="0" step="0.1"
                                    value={manualClassificationValue}
                                    onChange={(e) => handleInputChange('carbClassification', classification.id, e.target.value)}
                                    placeholder="0" unit="g" className="w-28 text-right"
                                  />
                                </div>
                                <div className="text-right text-xs text-gray-500 flex items-center justify-end gap-2 h-6">
                                  {subtypes.length > 0 && calculatedClassificationValue > 0 && (
                                      <>
                                        Calculado del desglose: 
                                        <span className={cn("font-mono", showClassificationSync && "text-orange-400")}>{formattedCalculatedClassificationValue} g</span>
                                      </>
                                  )}
                                  {showClassificationSync ? (
                                    <SyncButton onClick={() => handleCarbClassificationSync(classification.id, calculatedClassificationValue)} colorClass="text-orange-400 hover:bg-orange-200/50" />
                                  ) : (subtypes.length > 0 && calculatedClassificationValue > 0 && <div className="w-6 h-6"></div>)}
                                </div>
                              </div>
                              
                              {subtypes.length > 0 && (
                                <Collapsible open={isClassificationOpen} onOpenChange={() => toggleOpen('classifications', classification.id)} className="mt-2">
                                  <CollapsibleTrigger asChild>
                                    <Button variant="ghost" className="w-full justify-start p-2 -ml-2 text-xs text-gray-400 hover:text-white hover:bg-slate-700">
                                      <ChevronsRight className={`h-4 w-4 mr-2 transform transition-transform ${isClassificationOpen ? 'rotate-90' : ''}`} />
                                      Desglose por Subtipos
                                    </Button>
                                  </CollapsibleTrigger>
                                  <CollapsibleContent className="mt-2 space-y-2 pl-4 border-l-2 border-orange-400/50">
                                    {subtypes.map(subtype => (
                                      <div key={subtype.id} className="flex items-center gap-4">
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger asChild><Label htmlFor={`carb_subtype_${subtype.id}`} className="flex-1 cursor-help text-sm text-gray-300">{subtype.name}</Label></TooltipTrigger>
                                            <TooltipContent className="bg-[#282d34] text-white border-gray-600 max-w-xs"><p>{subtype.description}</p></TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                        <InputWithUnit
                                          id={`carb_subtype_${subtype.id}`}
                                          type="number" min="0" step="0.1"
                                          value={(carbSubtypeBreakdown && carbSubtypeBreakdown[classification.id]?.[subtype.id]) || ''}
                                          onChange={(e) => onSubtypeChange(classification.id, subtype.id, e.target.value)}
                                          placeholder="0" unit="g" className="w-24 text-right"
                                        />
                                      </div>
                                    ))}
                                  </CollapsibleContent>
                                </Collapsible>
                              )}
                            </div>
                          );
                        })}
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    };

    export default CarbFields;