import React from 'react';
import { Combobox } from '@/components/ui/combobox';
import { InputWithUnit } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const MineralFields = ({ allMinerals, selectedMinerals, onSelectedMineralsChange }) => {
  const handleAddMinerals = (newMineralIds) => {
    const newMinerals = newMineralIds
      .filter(mineralId => !selectedMinerals.some(sm => sm.mineral_id === mineralId))
      .map(mineralId => ({ mineral_id: mineralId, mg_per_100g: '' }));
    
    onSelectedMineralsChange([...selectedMinerals, ...newMinerals]);
  };

  const handleAmountChange = (mineralId, amount) => {
    const updatedMinerals = selectedMinerals.map(m => 
      m.mineral_id === mineralId ? { ...m, mg_per_100g: amount } : m
    );
    onSelectedMineralsChange(updatedMinerals);
  };
  
  const handleRemoveMineral = (mineralId) => {
    onSelectedMineralsChange(selectedMinerals.filter(m => m.mineral_id !== mineralId));
  };

  return (
    <div className="space-y-4">
      <Combobox
        options={allMinerals.map(m => ({ value: m.id, label: m.name }))}
        selectedValues={selectedMinerals.map(m => m.mineral_id)}
        onSelectedValuesChange={(ids) => {
            const added = ids.filter(id => !selectedMinerals.some(sm => sm.mineral_id === id));
            const removed = selectedMinerals.filter(sm => !ids.includes(sm.mineral_id));
            
            let updatedMinerals = [...selectedMinerals];
            if (added.length > 0) {
                 const newMinerals = added.map(mineralId => ({ mineral_id: mineralId, mg_per_100g: '' }));
                 updatedMinerals = [...updatedMinerals, ...newMinerals];
            }
            if (removed.length > 0) {
                const removedIds = new Set(removed.map(r => r.mineral_id));
                updatedMinerals = updatedMinerals.filter(um => !removedIds.has(um.mineral_id));
            }
            onSelectedMineralsChange(updatedMinerals);
        }}
        placeholder="Seleccionar minerales..."
        searchPlaceholder="Buscar mineral..."
        noResultsText="No se encontraron minerales."
        keepOptionsOnSelect={true}
      />
      
      <div className="space-y-3">
        {selectedMinerals.map(({ mineral_id, mg_per_100g }) => {
          const mineralInfo = allMinerals.find(m => m.id === mineral_id);
          if (!mineralInfo) return null;
          
          return (
            <div key={mineral_id} className="flex items-center gap-3 p-2 bg-gray-900/40 rounded-md border border-gray-700/60">
              <span className="flex-1 font-medium text-white">{mineralInfo.name}</span>
              <InputWithUnit
                type="number"
                value={mg_per_100g || ''}
                onChange={(e) => handleAmountChange(mineral_id, e.target.value)}
                placeholder="0.0"
                unit="mg"
                className="w-32"
                min="0"
                step="0.1"
              />
              <Button 
                type="button" 
                variant="ghost" 
                size="icon" 
                onClick={() => handleRemoveMineral(mineral_id)}
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

export default MineralFields;