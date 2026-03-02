import React from 'react';
import { cn } from '@/lib/utils';
import { getFoodStatusMeta } from '@/lib/food/foodStatus';

const FoodStatusBadge = ({
  status,
  moderationStatus,
  className,
}) => {
  const meta = getFoodStatusMeta({ status, moderationStatus });
  if (!meta) return null;

  return (
    <span
      className={cn(
        'text-xs px-2 py-1 rounded-full border font-medium whitespace-nowrap',
        meta.className,
        className
      )}
    >
      {meta.label}
    </span>
  );
};

export default FoodStatusBadge;
