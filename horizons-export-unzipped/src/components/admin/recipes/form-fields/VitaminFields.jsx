import React from 'react';
import { Combobox } from '@/components/ui/combobox';
import { InputWithUnit } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';


const VitaminFields = ({ allVitamins, selectedVitamins, onSelectedVitaminsChange }) => {

  const handleAmountChange = (vitaminId, amount) => {
    const updatedVitamins = selectedVitamins.map(v => 
      v.vitamin_id === vitaminId ? { ...v, mg_per_100g: amount } : v
    );
    onSelectedVitaminsChange(updatedVitamins);
  };
  
  const handleRemoveVitamin = (vitaminIdToRemove) => {
    onSelectedVitaminsChange(selectedVitamins.filter(v => v.vitamin_id !== vitaminIdToRemove));
  };
  
  const handleSelectionChange = (ids) => {
      const added = ids.filter(id => !selectedVitamins.some(sv => sv.vitamin_id === id));
      const removed = selectedVitamins.filter(sv => !ids.includes(sv.vitamin_id));
      
      let updatedVitamins = [...selectedVitamins];
      if (added.length > 0) {
           const newVitamins = added.map(vitaminId => ({ vitamin_id: vitaminId, mg_per_100g: '' }));
           updatedVitamins = [...updatedVitamins, ...newVitamins];
      }
      if (removed.length > 0) {
          const removedIds = new Set(removed.map(r => r.vitamin_id));
          updatedVitamins = updatedVitamins.filter(uv => !removedIds.has(uv.vitamin_id));
      }
      onSelectedVitaminsChange(updatedVitamins);
  };

  return (
    <div className="space-y-4">
        <Combobox
          options={allVitamins.map(v => ({ value: v.id, label: v.name }))}
          selectedValues={selectedVitamins.map(v => v.vitamin_id)}
          onSelectedValuesChange={handleSelectionChange}
          placeholder="Seleccionar vitaminas..."
          searchPlaceholder="Buscar vitamina..."
          noResultsText="No se encontraron vitaminas."
          keepOptionsOnSelect={true}
        />

      <div className="space-y-3">
        {selectedVitamins.map(({ vitamin_id, mg_per_100g }) => {
          const vitaminInfo = allVitamins.find(v => v.id === vitamin_id);
          if (!vitaminInfo) return null;
          
          return (
            <div key={vitamin_id} className="flex items-center gap-3 p-2 bg-gray-900/40 rounded-md border border-gray-700/60">
              <span className="flex-1 font-medium text-white">{vitaminInfo.name}</span>
              <InputWithUnit
                type="number"
                value={mg_per_100g || ''}
                onChange={(e) => handleAmountChange(vitamin_id, e.target.value)}
                placeholder="0.0"
                unit="mg"
                className="w-32"
                min="0"
                step="any"
              />
              <Button 
                type="button" 
                variant="ghost" 
                size="icon" 
                onClick={() => handleRemoveVitamin(vitamin_id)}
                className="text-red-500 hover:bg-red-500/10 hover:text-red-400"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VitaminFields;