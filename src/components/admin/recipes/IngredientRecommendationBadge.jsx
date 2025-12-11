import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2 } from 'lucide-react';

const IngredientRecommendationBadge = ({ food, displayMode, conflictInfo }) => {
  if (!food || displayMode !== 'conflict') {
    return null;
  }

  const isRecommended = conflictInfo?.type === 'condition_recommend' || conflictInfo?.type === 'preferred';

  if (!isRecommended) {
    return null;
  }

  return (
    <div className="pl-2 mt-1 flex items-start gap-2">
      <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
      <div className="flex flex-wrap gap-1">
        <Badge variant="default" className="text-xs bg-green-500/20 text-green-300 border-green-500/50">
          {conflictInfo.reason}
        </Badge>
      </div>
    </div>
  );
};

export default IngredientRecommendationBadge;