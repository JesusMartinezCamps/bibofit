import React, { useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select as ShadcnSelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ReactSelect from 'react-select';

const customStyles = {
  control: (base, state) => ({
    ...base,
    background: 'rgba(31, 41, 55, 0.5)',
    borderColor: state.isFocused ? '#3DB477' : '#4b5563',
    borderRadius: '0.5rem',
    paddingTop: '2px',
    paddingBottom: '2px',
    color: 'white',
    boxShadow: 'none',
    '&:hover': {
      borderColor: state.isFocused ? '#3DB477' : '#6b7280'
    }
  }),
  menu: (base) => ({
    ...base,
    background: '#1f2937',
    border: '1px solid #374151',
    borderRadius: '0.5rem',
    zIndex: 9999
  }),
  menuPortal: (base) => ({ 
    ...base, 
    zIndex: 9999 
  }),
  option: (base, state) => ({
    ...base,
    background: state.isFocused ? 'rgba(61, 180, 119, 0.2)' : 'transparent',
    color: 'white',
    cursor: 'pointer',
    '&:active': {
      background: '#3DB477'
    }
  }),
  singleValue: (base) => ({
    ...base,
    color: 'white'
  }),
  multiValue: (base) => ({
    ...base,
    background: 'rgba(61, 180, 119, 0.2)',
    borderRadius: '0.25rem',
  }),
  multiValueLabel: (base) => ({
    ...base,
    color: 'white',
  }),
  multiValueRemove: (base) => ({
    ...base,
    color: '#d1d5db',
    ':hover': {
      background: '#ef4444',
      color: 'white',
    },
  }),
  input: (base) => ({
    ...base,
    color: 'white',
  }),
  placeholder: (base) => ({
    ...base,
    color: '#9ca3af',
  }),
};

const BasicInfoFields = ({ 
  formData, 
  handleChange, 
  handleSelectChange, 
  foodGroups = [], 
  seasons = [], 
  stores = [],
  macroRoles = [],
  selectedFoodGroups = [],
  onSelectedFoodGroupsChange,
  selectedSeasons = [],
  onSelectedSeasonsChange,
  selectedStores = [],
  onSelectedStoresChange,
  selectedMacroRoles = [],
  onSelectedMacroRolesChange,
}) => {
  
  useEffect(() => {
    // Debug logging to verify data reception
    console.log("BasicInfoFields - macroRoles received:", macroRoles);
  }, [macroRoles]);

  // Format options for React Select
  const groupedFoodGroupsOptions = Object.entries((foodGroups || []).reduce((acc, group) => {
    const origen = group.origen || 'Sin categoría';
    if (!acc[origen]) {
      acc[origen] = [];
    }
    acc[origen].push({ value: group.id, label: group.name });
    return acc;
  }, {})).map(([label, options]) => ({ label, options }));

  const allFoodGroupOptions = groupedFoodGroupsOptions.flatMap(g => g.options);
  // Ensure type safety when filtering selected options
  const selectedFoodGroupObjects = allFoodGroupOptions.filter(opt => 
    selectedFoodGroups.some(val => String(val) === String(opt.value))
  );

  const macroRoleOptions = (macroRoles || []).map(mr => ({ value: mr.id, label: mr.name }));
  const selectedMacroRoleObjects = macroRoleOptions.filter(opt => 
    selectedMacroRoles.some(val => String(val) === String(opt.value))
  );

  const seasonOptions = (seasons || []).map(s => ({ value: s.id, label: s.name }));
  const selectedSeasonObjects = seasonOptions.filter(opt => 
    selectedSeasons.some(val => String(val) === String(opt.value))
  );

  const storeOptions = (stores || []).map(s => ({ value: s.id, label: s.name }));
  const selectedStoreObjects = storeOptions.filter(opt => 
    selectedStores.some(val => String(val) === String(opt.value))
  );
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-2">
        <Label htmlFor="name">Nombre del Alimento</Label>
        <Input id="name" name="name" value={formData.name} onChange={handleChange} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="food_unit">Unidad de Medida</Label>
        <ShadcnSelect value={formData.food_unit || 'gramos'} onValueChange={(value) => handleSelectChange('food_unit', value)}>
          <SelectTrigger id="food_unit">
            <SelectValue placeholder="Seleccionar unidad..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="gramos">Gramos</SelectItem>
            <SelectItem value="unidades">Unidad</SelectItem>
          </SelectContent>
        </ShadcnSelect>
      </div>
      <div className="space-y-2">
        <Label htmlFor="food_group_id">Grupo Alimenticio</Label>
        <ReactSelect
          isMulti
          options={groupedFoodGroupsOptions}
          value={selectedFoodGroupObjects}
          onChange={(options) => onSelectedFoodGroupsChange(options ? options.map(o => o.value) : [])}
          placeholder="Seleccionar grupos..."
          styles={customStyles}
          classNamePrefix="react-select"
          noOptionsMessage={() => "No se encontraron grupos."}
          menuPortalTarget={document.body}
          menuPosition={'fixed'}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="macro_role_id">Macro Roles</Label>
        <ReactSelect
          isMulti
          options={macroRoleOptions}
          value={selectedMacroRoleObjects}
          onChange={(options) => onSelectedMacroRolesChange(options ? options.map(o => o.value) : [])}
          placeholder="Seleccionar roles..."
          styles={customStyles}
          classNamePrefix="react-select"
          noOptionsMessage={() => "No se encontraron roles."}
          menuPortalTarget={document.body}
          menuPosition={'fixed'}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="season_id">Temporada</Label>
        <ReactSelect
          isMulti
          options={seasonOptions}
          value={selectedSeasonObjects}
          onChange={(options) => onSelectedSeasonsChange(options ? options.map(o => o.value) : [])}
          placeholder="Seleccionar temporadas..."
          styles={customStyles}
          classNamePrefix="react-select"
          noOptionsMessage={() => "No se encontraron temporadas."}
          menuPortalTarget={document.body}
          menuPosition={'fixed'}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="store_id">Lugar de Compra Habitual</Label>
        <ReactSelect
          isMulti
          options={storeOptions}
          value={selectedStoreObjects}
          onChange={(options) => onSelectedStoresChange(options ? options.map(o => o.value) : [])}
          placeholder="Seleccionar lugares..."
          styles={customStyles}
          classNamePrefix="react-select"
          noOptionsMessage={() => "No se encontraron lugares."}
          menuPortalTarget={document.body}
          menuPosition={'fixed'}
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