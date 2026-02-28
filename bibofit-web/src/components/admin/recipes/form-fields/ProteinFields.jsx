import React from 'react';
import { Label } from '@/components/ui/label';
import { Select as ShadcnSelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
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
    zIndex: 50
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
  const selectedDominant = aminogramOptions.filter(opt => selectedDominantAminos.includes(opt.value));
  const selectedLimiting = aminogramOptions.filter(opt => selectedLimitingAminos.includes(opt.value));

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
            className="input-field"
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
            <SelectTrigger id="protein_source_id" className="bg-gray-800/50 border-gray-600 text-white">
              <SelectValue placeholder="Seleccionar fuente..." />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700 text-white">
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
          <ReactSelect
            isMulti
            options={aminogramOptions}
            value={selectedDominant}
            onChange={(options) => onSelectedDominantAminosChange(options ? options.map(o => o.value) : [])}
            placeholder="Seleccionar dominantes..."
            styles={customStyles}
            classNamePrefix="react-select"
            noOptionsMessage={() => "No se encontraron aminoácidos."}
          />
        </div>

        <div className="space-y-2">
          <Label>Aminoácidos Limitantes</Label>
          <ReactSelect
            isMulti
            options={aminogramOptions}
            value={selectedLimiting}
            onChange={(options) => onSelectedLimitingAminosChange(options ? options.map(o => o.value) : [])}
            placeholder="Seleccionar limitantes..."
            styles={customStyles}
            classNamePrefix="react-select"
            noOptionsMessage={() => "No se encontraron aminoácidos."}
          />
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-gray-300">Desglose de Aminoácidos (mg/100g)</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 bg-gray-900/30 p-4 rounded-lg border border-gray-800">
          {allAminograms && allAminograms.map(amino => (
            <div key={amino.id} className="space-y-1">
              <Label htmlFor={`amino-${amino.id}`} className="text-xs text-gray-400 truncate block" title={amino.name}>
                {amino.name}
              </Label>
              <Input
                id={`amino-${amino.id}`}
                type="number"
                value={aminoAcidBreakdown[amino.id] || ''}
                onChange={(e) => handleAminoValueChange(amino.id, e.target.value)}
                className="h-8 text-xs bg-gray-800 border-gray-700"
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