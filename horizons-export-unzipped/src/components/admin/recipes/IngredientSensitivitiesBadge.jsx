import React from 'react';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';

const IngredientSensitivitiesBadge = ({ food, displayMode, conflictInfo }) => {
  if (!food) return null;

  const shouldDisplay = 
    (displayMode === 'inform' && food.food_sensitivities?.length > 0) || 
    (displayMode === 'conflict' && conflictInfo?.type === 'sensitivity');

  if (!shouldDisplay) {
    return null;
  }

  const sensitivityNames = food.food_sensitivities
    ?.map(fs => fs.sensitivities?.name)
    .filter(Boolean) || [];

  if (sensitivityNames.length === 0) {
    return null;
  }

  return (
    <div className="pl-2 mt-1 flex items-start gap-2">
      <AlertTriangle className="h-4 w-4 text-orange-400 flex-shrink-0 mt-0.5" />
      <div className="flex flex-wrap gap-1">
        {sensitivityNames.map(name => (
          <Badge key={name} variant="destructive" className="text-xs bg-orange-500/20 text-orange-300 border-orange-500/50">
            {name}
          </Badge>
        ))}
      </div>
    </div>
  );
};

export default IngredientSensitivitiesBadge;