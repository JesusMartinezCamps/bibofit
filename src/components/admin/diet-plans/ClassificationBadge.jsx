import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const ClassificationBadge = ({ type, value, className }) => {
  const styles = {
    objective: "bg-blue-900/30 text-blue-300 border-blue-700/50 hover:bg-blue-800/40",
    condition: "bg-red-900/30 text-red-300 border-red-700/50 hover:bg-red-800/40",
    lifestyle: "bg-purple-900/30 text-purple-300 border-purple-700/50 hover:bg-purple-800/40",
    nutrition_style: "bg-green-900/30 text-green-300 border-green-700/50 hover:bg-green-800/40",
  };

  return (
    <Badge variant="outline" className={cn("text-xs font-medium px-2 py-0.5 border", styles[type], className)}>
      {value}
    </Badge>
  );
};

export default ClassificationBadge;