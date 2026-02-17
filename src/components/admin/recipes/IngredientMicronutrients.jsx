import React from 'react';
import { Badge } from '@/components/ui/badge';

const MicronutrientBadge = ({ children, type }) => {
  const baseClasses = "text-[10px] font-normal px-1.5 py-0.5";
  const typeClasses = {
    vitamin: "bg-blue-900/50 border-blue-700/50 text-blue-300",
    mineral: "bg-purple-900/50 border-purple-700/50 text-purple-300",
  };
  return <Badge variant="outline" className={`${baseClasses} ${typeClasses[type]}`}>{children}</Badge>;
};

const IngredientMicronutrients = ({ food }) => {
  if (!food) return null;

  const vitamins = food.food_vitamins?.map(v => v.vitamins?.name).filter(Boolean) || [];
  const minerals = food.food_minerals?.map(m => m.minerals?.name).filter(Boolean) || [];

  if (vitamins.length === 0 && minerals.length === 0) {
    return null;
  }

  // Display micronutrients directly (no label/heading)
  return (
    <div className="flex flex-col gap-1.5">
      {vitamins.length > 0 && (
        <div className="flex flex-wrap gap-1 items-center">
          {vitamins.map(name => <MicronutrientBadge key={`vit-${name}`} type="vitamin">{name}</MicronutrientBadge>)}
        </div>
      )}
      {minerals.length > 0 && (
        <div className="flex flex-wrap gap-1 items-center">
          {minerals.map(name => <MicronutrientBadge key={`min-${name}`} type="mineral">{name}</MicronutrientBadge>)}
        </div>
      )}
    </div>
  );
};

export default IngredientMicronutrients;