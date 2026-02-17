import React, { useState, useMemo, useCallback } from 'react';
import { useSimplifiedFoodForm } from '@/components/admin/recipes/hooks/useSimplifiedFoodForm';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, Zap, Mountain, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Combobox } from '@/components/ui/combobox';
import VitaminFields from './form-fields/VitaminFields';
import SimplifiedMineralFields from './form-fields/SimplifiedMineralFields';
import FoodFormSection from './FoodFormSection';

const NutrientRow = ({ label, name, value, onValueChange, unit, isSub, isCalculated, portionValue, isBold }) => (
  <div className={cn("grid grid-cols-12 gap-2 items-center py-2 border-b border-gray-700/50", isSub && "pl-6")}>
    <div className={cn("col-span-5", isBold && "font-bold")}>{label}</div>
    <div className="col-span-4">
      <div className="relative flex items-center">
        <Input
          type="number"
          name={name}
          value={value}
          onChange={onValueChange}
          placeholder="0"
          className={cn(
            "bg-transparent border-0 text-right pr-6 focus-visible:ring-0 focus-visible:ring-offset-0",
            isCalculated && "text-green-400 font-bold"
          )}
          readOnly={isCalculated}
          min="0"
          step="0.01"
        />
        {!isCalculated && <span className="absolute right-0 text-gray-400 text-xs">{unit}</span>}
      </div>
    </div>
    {portionValue !== null && (
      <div className="col-span-3 text-right text-gray-400 pr-2">
        {portionValue}
      </div>
    )}
  </div>
);

const SimplifiedFoodForm = ({ onFoodActionComplete, isClientRequest, userId, foodToCreate }) => {
  const {
    state,
    formHandlers,
    formState,
    isSubmitting,
    isLoading,
    handleSubmit,
    isMineralsOpen,
    setIsMineralsOpen,
  } = useSimplifiedFoodForm({ onFoodActionComplete, isClientRequest, userId, foodToCreate });

  const { allVitamins, allMinerals, allSensitivities, allStores, allFoodGroups } = state;
  const { formData, selectedVitamins, selectedMinerals, selectedSensitivities, selectedStores, selectedFoodGroups } = formState;
  const { handleChange, handleSelectChange, setSelectedVitamins, setSelectedSensitivities, setSelectedStores, setSelectedFoodGroups } = formHandlers;

  const [portionSize, setPortionSize] = useState(125);

  const calculatedKcal = useMemo(() => {
    const proteins = parseFloat(formData.proteins) || 0;
    const carbs = parseFloat(formData.total_carbs) || 0;
    const fats = parseFloat(formData.total_fats) || 0;
    return (proteins * 4 + carbs * 4 + fats * 9).toFixed(0);
  }, [formData.proteins, formData.total_carbs, formData.total_fats]);

  const getPortionValue = useCallback((value) => {
    if (formData.food_unit !== 'unidades' || !value) return null;
    const per100 = parseFloat(value) || 0;
    const portion = parseFloat(portionSize) || 0;
    return `${((per100 / 100) * portion).toFixed(1)}`;
  }, [formData.food_unit, portionSize]);

  const groupedFoodGroups = useMemo(() => allFoodGroups.reduce((acc, group) => {
    const origen = group.origen || 'Sin categoría';
    if (!acc[origen]) {
      acc[origen] = [];
    }
    acc[origen].push({ value: group.id, label: group.name });
    return acc;
  }, {}), [allFoodGroups]);

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-green-500" /></div>;
  }

  const buttonText = isSubmitting 
    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...</> 
    : 'Enviar Solicitud';

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="name">Nombre del Alimento</Label>
          <Input id="name" name="name" value={formData.name} onChange={handleChange} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="food_unit">Unidad de Medida</Label>
          <Select value={formData.food_unit || 'gramos'} onValueChange={(value) => handleSelectChange('food_unit', value)}>
            <SelectTrigger id="food_unit"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="gramos">Gramos / Mililitros</SelectItem>
              <SelectItem value="unidades">Unidad</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
            <Label htmlFor="store">Lugar de Compra</Label>
             <Combobox
                options={allStores.map(s => ({ value: s.id, label: s.name }))}
                selectedValues={selectedStores}
                onSelectedValuesChange={setSelectedStores}
                placeholder="Seleccionar lugares..."
                searchPlaceholder="Buscar lugar..."
                noResultsText="No se encontraron lugares."
            />
        </div>
        <div className="space-y-2">
            <Label htmlFor="food_group">Grupo de Alimento</Label>
            <Combobox
                optionsGrouped={groupedFoodGroups}
                selectedValues={selectedFoodGroups}
                onSelectedValuesChange={setSelectedFoodGroups}
                placeholder="Seleccionar grupo..."
                searchPlaceholder="Buscar grupo..."
                noResultsText="Grupo no encontrado."
            />
        </div>
      </div>

      <div className="border border-gray-700 rounded-lg overflow-hidden">
        <div className="grid grid-cols-12 gap-2 p-3 bg-gray-800/60 font-bold">
          <div className="col-span-5">Información nutricional</div>
          <div className="col-span-4 text-right">Por 100 g/ml</div>
          {formData.food_unit === 'unidades' && (
            <div className="col-span-3 text-right flex items-center justify-end">
              <span>Por porción (</span>
              <Input 
                type="number" 
                value={portionSize} 
                onChange={(e) => setPortionSize(e.target.value)}
                className="w-16 h-6 bg-transparent border-0 border-b border-gray-500 text-right focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <span>g)</span>
            </div>
          )}
        </div>

        <div className="p-3">
          <NutrientRow label="Energía (kcal)" value={calculatedKcal} isCalculated isBold unit="kcal" portionValue={getPortionValue(calculatedKcal)} />
          
          <NutrientRow label="Grasas" name="total_fats" value={formData.total_fats} onValueChange={handleChange} unit="g" isBold portionValue={getPortionValue(formData.total_fats)} />
          <NutrientRow label="de las cuales saturadas" name="fats_saturated" value={formData.fats_saturated} onValueChange={handleChange} unit="g" isSub portionValue={getPortionValue(formData.fats_saturated)} />
          <NutrientRow label="de las cuales monoinsaturadas" name="fats_monounsaturated" value={formData.fats_monounsaturated} onValueChange={handleChange} unit="g" isSub portionValue={getPortionValue(formData.fats_monounsaturated)} />
          <NutrientRow label="de las cuales poliinsaturadas" name="fats_polyunsaturated" value={formData.fats_polyunsaturated} onValueChange={handleChange} unit="g" isSub portionValue={getPortionValue(formData.fats_polyunsaturated)} />

          <NutrientRow label="Hidratos de carbono" name="total_carbs" value={formData.total_carbs} onValueChange={handleChange} unit="g" isBold portionValue={getPortionValue(formData.total_carbs)} />
          <NutrientRow label="de los cuales azúcares" name="carbs_sugars" value={formData.carbs_sugars} onValueChange={handleChange} unit="g" isSub portionValue={getPortionValue(formData.carbs_sugars)} />
          
          <NutrientRow label="Fibra alimentaria" name="fibers" value={formData.fibers} onValueChange={handleChange} unit="g" isBold portionValue={getPortionValue(formData.fibers)} />
          <NutrientRow label="Proteínas" name="proteins" value={formData.proteins} onValueChange={handleChange} unit="g" isBold portionValue={getPortionValue(formData.proteins)} />
          <NutrientRow label="Sal" name="salt" value={formData.salt} onValueChange={formHandlers.handleChange} unit="g" isBold portionValue={getPortionValue(formData.salt)} />
        </div>
      </div>

      <div className="space-y-4">
        <FoodFormSection title="Vitaminas" icon={<Zap className="h-5 w-5 text-blue-400" />} borderColor="border-blue-500/50" isCollapsible={true}>
          <VitaminFields allVitamins={allVitamins} selectedVitamins={selectedVitamins} onSelectedVitaminsChange={setSelectedVitamins} />
        </FoodFormSection>
        <FoodFormSection 
          title="Minerales" 
          icon={<Mountain className="h-5 w-5 text-gray-400" />} 
          borderColor="border-gray-500/50" 
          isCollapsible={true} 
          forceOpen={isMineralsOpen}
          onOpenChange={setIsMineralsOpen}
        >
           <SimplifiedMineralFields allMinerals={allMinerals} selectedMinerals={selectedMinerals} onSelectedMineralsChange={formHandlers.setSelectedMinerals} />
        </FoodFormSection>
        <FoodFormSection title="Intolerancias / Alérgenos" icon={<Shield className="h-5 w-5 text-orange-400" />} borderColor="border-orange-500/50" isCollapsible={true}>
          <Combobox options={allSensitivities.map(s => ({ value: s.id, label: s.name }))} selectedValues={selectedSensitivities} onSelectedValuesChange={setSelectedSensitivities} placeholder="Seleccionar..." searchPlaceholder="Buscar..." noResultsText="No encontrada." keepOptionsOnSelect={true} />
        </FoodFormSection>
      </div>

      <Button type="submit" variant="diet" className="w-full" disabled={isSubmitting}>{buttonText}</Button>
    </form>
  );
};

export default SimplifiedFoodForm;