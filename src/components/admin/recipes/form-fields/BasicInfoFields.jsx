import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';

const BasicInfoFields = ({ 
  formData, 
  handleChange, 
  handleSelectChange, 
  foodGroups, 
  seasons, 
  stores,
  macroRoles,
  selectedFoodGroups,
  onSelectedFoodGroupsChange,
  selectedSeasons,
  onSelectedSeasonsChange,
  selectedStores,
  onSelectedStoresChange,
  selectedMacroRoles,
  onSelectedMacroRolesChange,
}) => {
  
  if (!foodGroups || foodGroups.length === 0) {
    return null;
  }

  const groupedFoodGroups = foodGroups.reduce((acc, group) => {
    const origen = group.origen || 'Sin categoría';
    if (!acc[origen]) {
      acc[origen] = [];
    }
    acc[origen].push({ value: group.id, label: group.name });
    return acc;
  }, {});

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-2">
        <Label htmlFor="name">Nombre del Alimento</Label>
        <Input id="name" name="name" value={formData.name} onChange={handleChange} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="food_unit">Unidad de Medida</Label>
        <Select value={formData.food_unit || 'gramos'} onValueChange={(value) => handleSelectChange('food_unit', value)}>
          <SelectTrigger id="food_unit">
            <SelectValue placeholder="Seleccionar unidad..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="gramos">Gramos</SelectItem>
            <SelectItem value="unidades">Unidad</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="food_group_id">Grupo Alimenticio</Label>
        <Combobox
          optionsGrouped={groupedFoodGroups}
          selectedValues={selectedFoodGroups}
          onSelectedValuesChange={onSelectedFoodGroupsChange}
          placeholder="Seleccionar grupos..."
          searchPlaceholder="Buscar grupo..."
          noResultsText="No se encontraron grupos."
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="macro_role_id">Macro Roles</Label>
        <Combobox
          options={macroRoles.map(mr => ({ value: mr.id, label: mr.name }))}
          selectedValues={selectedMacroRoles}
          onSelectedValuesChange={onSelectedMacroRolesChange}
          placeholder="Seleccionar roles..."
          searchPlaceholder="Buscar rol..."
          noResultsText="No se encontraron roles."
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="season_id">Temporada</Label>
        <Combobox
          options={seasons.map(s => ({ value: s.id, label: s.name }))}
          selectedValues={selectedSeasons}
          onSelectedValuesChange={onSelectedSeasonsChange}
          placeholder="Seleccionar temporadas..."
          searchPlaceholder="Buscar temporada..."
          noResultsText="No se encontraron temporadas."
          allYearOptionName="Todo el año"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="store_id">Lugar de Compra Habitual</Label>
        <Combobox
          options={stores.map(s => ({ value: s.id, label: s.name }))}
          selectedValues={selectedStores}
          onSelectedValuesChange={onSelectedStoresChange}
          placeholder="Seleccionar lugares..."
          searchPlaceholder="Buscar lugar..."
          noResultsText="No se encontraron lugares."
        />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="food_url">URL de la Fuente</Label>
        <Input id="food_url" name="food_url" value={formData.food_url || ''} onChange={handleChange} placeholder="https://ejemplo.com/info-alimento" />
      </div>
    </div>
  );
};

export default BasicInfoFields;