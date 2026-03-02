import React, { useMemo } from 'react';
import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getFoodGroupText, getFoodSensitivityText } from '@/lib/food/foodModel';
import CaloriesIcon from '@/components/icons/CaloriesIcon';
import ProteinIcon from '@/components/icons/ProteinIcon';
import CarbsIcon from '@/components/icons/CarbsIcon';
import FatsIcon from '@/components/icons/FatsIcon';

const formatDate = (dateString) => {
  if (!dateString) return null;
  return new Date(dateString).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const FoodCardBase = ({
  food,
  onClick,
  isSelected = false,
  showDate = false,
  statusBadge = null,
  headerAction = null,
  footerActions = null,
  allSensitivities = [],
  className,
}) => {
  const calories = useMemo(() => {
    return (food?.proteins || 0) * 4 + (food?.total_carbs || 0) * 4 + (food?.total_fats || 0) * 9;
  }, [food?.proteins, food?.total_carbs, food?.total_fats]);

  const groupText = useMemo(() => getFoodGroupText(food), [food]);
  const sensitivityText = useMemo(
    () => getFoodSensitivityText(food, allSensitivities),
    [food, allSensitivities]
  );

  return (
    <div
      className={cn(
        'relative bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800/80 p-4 rounded-xl transition-all shadow-lg border border-border/50 hover:shadow-purple-500/10',
        onClick && 'cursor-pointer',
        isSelected && 'border-green-500 ring-2 ring-green-500/50',
        className
      )}
      onClick={onClick}
    >
      <div className="flex justify-between items-start gap-3">
        <div className="flex-1 min-w-0">
          {showDate && food?.created_at && (
            <p className="text-sm text-muted-foreground flex items-center mb-2">
              <Calendar className="w-4 h-4 mr-2" />
              {formatDate(food.created_at)}
            </p>
          )}
          <p className="font-semibold text-white text-lg truncate">{food?.name}</p>
          {sensitivityText && (
            <p className="text-xs text-orange-400 mt-1">Sensibilidades: {sensitivityText}</p>
          )}
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{groupText}</p>
        </div>

        {(statusBadge || headerAction) && (
          <div className="flex flex-col items-end gap-2 shrink-0">
            {statusBadge}
            {headerAction}
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-border flex items-center justify-start gap-x-6 text-sm font-mono flex-wrap">
        <span className="flex items-center text-orange-400" title="Calorías">
          <CaloriesIcon className="w-4 h-4 mr-1.5" />
          {Math.round(calories)}
        </span>
        <span className="flex items-center text-red-400" title="Proteínas">
          <ProteinIcon className="w-4 h-4 mr-1.5" />
          {Math.round(food?.proteins || 0)}g
        </span>
        <span className="flex items-center text-yellow-400" title="Carbohidratos">
          <CarbsIcon className="w-4 h-4 mr-1.5" />
          {Math.round(food?.total_carbs || 0)}g
        </span>
        <span className="flex items-center text-green-400" title="Grasas">
          <FatsIcon className="w-4 h-4 mr-1.5" />
          {Math.round(food?.total_fats || 0)}g
        </span>
      </div>

      {footerActions ? (
        <div className="mt-4" onClick={(event) => event.stopPropagation()}>
          {footerActions}
        </div>
      ) : null}
    </div>
  );
};

export default FoodCardBase;
