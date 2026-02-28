import React from 'react';
import { Combobox } from '@/components/ui/combobox';
import { Button } from '@/components/ui/button';
import { X, ThumbsUp, ThumbsDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const MedicalConditionFields = ({ allMedicalConditions, selectedMedicalConditions, onSelectedMedicalConditionsChange }) => {
  
  const handleAddCondition = (conditionId) => {
    if (!selectedMedicalConditions.some(mc => mc.condition_id === conditionId)) {
      onSelectedMedicalConditionsChange([...selectedMedicalConditions, { condition_id: conditionId, relation_type: 'to_avoid' }]);
    }
  };

  const handleRelationChange = (conditionId, relationType) => {
    const updatedConditions = selectedMedicalConditions.map(mc => 
      mc.condition_id === conditionId ? { ...mc, relation_type: relationType } : mc
    );
    onSelectedMedicalConditionsChange(updatedConditions);
  };
  
  const handleRemoveCondition = (conditionId) => {
    onSelectedMedicalConditionsChange(selectedMedicalConditions.filter(mc => mc.condition_id !== conditionId));
  };

  const availableConditions = allMedicalConditions.filter(
    c => !selectedMedicalConditions.some(sc => sc.condition_id === c.id)
  );

  return (
    <div className="space-y-4">
      <Combobox
        options={availableConditions.map(c => ({ value: c.id, label: c.name }))}
        onSelect={handleAddCondition}
        placeholder="Añadir condición médica..."
        searchPlaceholder="Buscar condición..."
        noResultsText="No se encontraron condiciones."
      />
      
      <div className="space-y-3">
        {selectedMedicalConditions.map(({ condition_id, relation_type }) => {
          const conditionInfo = allMedicalConditions.find(m => m.id === condition_id);
          if (!conditionInfo) return null;
          
          return (
            <div key={condition_id} className="flex items-center gap-3 p-2 bg-gray-900/40 rounded-md border border-gray-700/60">
              <span className="flex-1 font-medium text-white">{conditionInfo.name}</span>
              <div className="flex items-center gap-1">
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleRelationChange(condition_id, 'recommended')}
                  className={cn(
                    "h-8 px-2 text-xs",
                    relation_type === 'recommended' 
                      ? 'bg-green-500/20 text-green-400 border border-green-500/50' 
                      : 'text-gray-400 hover:bg-green-500/10 hover:text-green-400'
                  )}
                >
                  <ThumbsUp className="w-3.5 h-3.5 mr-1.5" />
                  Recomendado
                </Button>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleRelationChange(condition_id, 'to_avoid')}
                  className={cn(
                    "h-8 px-2 text-xs",
                    relation_type === 'to_avoid' 
                      ? 'bg-red-500/20 text-red-400 border border-red-500/50' 
                      : 'text-gray-400 hover:bg-red-500/10 hover:text-red-400'
                  )}
                >
                  <ThumbsDown className="w-3.5 h-3.5 mr-1.5" />
                  Evitar
                </Button>
              </div>
              <Button 
                type="button" 
                variant="ghost" 
                size="icon" 
                onClick={() => handleRemoveCondition(condition_id)}
                className="text-red-500 hover:bg-red-500/10 hover:text-red-400 h-8 w-8"
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

export default MedicalConditionFields;