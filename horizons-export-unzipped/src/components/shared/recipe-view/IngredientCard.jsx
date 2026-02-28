import React from 'react';
import {
  X,
  AlertTriangle,
  ThumbsUp,
  ArrowRightLeft,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import CaloriesIcon from '@/components/icons/CaloriesIcon';
import ProteinIcon from '@/components/icons/ProteinIcon';
import CarbsIcon from '@/components/icons/CarbsIcon';
import FatsIcon from '@/components/icons/FatsIcon';

const NutrientBadge = ({ nutrient }) => (
  <Badge
    variant="outline"
    className="text-[10px] px-1.5 py-0 h-5 bg-slate-800/50 border-slate-700 text-gray-300"
  >
    {nutrient.name}
  </Badge>
);

const renderMacros = ({
  macros,
  isFreeMealView,
  smallText = false,
  fixedWidth = false,
  hideUnits = false,
  fullWidth = false,
  tooltip = false,
}) => (
  <div
    className={cn(
      'flex items-center font-numeric',
      smallText && !tooltip ? 'text-xs' : 'gap-x-4 text-sm',
      tooltip && 'text-base gap-x-4',
      !fullWidth && (isFreeMealView && !fixedWidth ? 'justify-between' : 'justify-start sm:justify-end'),
      fullWidth && 'justify-between w-full',
      fixedWidth && 'gap-0'
    )}
  >
    <div className={cn('flex items-center text-orange-400', fixedWidth && 'w-[80px] justify-end')} title="Calorias">
      <CaloriesIcon className={cn('w-3 h-3', !hideUnits && 'mr-1.5', hideUnits && 'mr-1', tooltip && 'w-4 h-4 mr-1.5')} />
      <span>{Math.round(macros.calories)}</span>
      {!hideUnits && <span className={cn('text-[10px] text-orange-400/80 ml-0.5', tooltip && 'text-xs')}>kcal</span>}
    </div>
    <div className={cn('flex items-center text-red-400', fixedWidth && 'w-[60px] justify-end')} title="Proteinas">
      <ProteinIcon className={cn('w-3 h-3', !hideUnits && 'mr-1.5', hideUnits && 'mr-1', tooltip && 'w-4 h-4 mr-1.5')} />
      <span>{Math.round(macros.proteins)}</span>
      {!hideUnits && <span className={cn('text-[10px] text-red-400/80 ml-0.5', tooltip && 'text-xs')}>g</span>}
    </div>
    <div className={cn('flex items-center text-yellow-400', fixedWidth && 'w-[60px] justify-end')} title="Carbohidratos">
      <CarbsIcon className={cn('w-3 h-3', !hideUnits && 'mr-1.5', hideUnits && 'mr-1', tooltip && 'w-4 h-4 mr-1.5')} />
      <span>{Math.round(macros.carbs)}</span>
      {!hideUnits && <span className={cn('text-[10px] text-yellow-400/80 ml-0.5', tooltip && 'text-xs')}>g</span>}
    </div>
    <div className={cn('flex items-center text-green-400', fixedWidth && 'w-[60px] justify-end')} title="Grasas">
      <FatsIcon className={cn('w-3 h-3', !hideUnits && 'mr-1.5', hideUnits && 'mr-1', tooltip && 'w-4 h-4 mr-1.5')} />
      <span>{Math.round(macros.fats)}</span>
      {!hideUnits && <span className={cn('text-[10px] text-green-400/80 ml-0.5', tooltip && 'text-xs')}>g</span>}
    </div>
  </div>
);

const getStatusColorClasses = (type) => {
  switch (type) {
    case 'condition_avoid':
    case 'sensitivity':
    case 'non-preferred':
      return 'bg-gradient-to-br from-red-900/30 via-slate-800/20 to-slate-800/20 border-red-500/50 text-red-300';
    case 'condition_recommend':
    case 'preferred':
      return 'bg-gradient-to-br from-green-900/30 via-slate-800/20 to-slate-800/20 border-green-500/50 text-green-300';
    default:
      return 'bg-gradient-to-br from-slate-800/60 via-slate-800/40 to-slate-800/40 border-slate-700/50 text-gray-200';
  }
};

const StatusDisplay = ({ type, conflicts, recommendations, isEditing }) => {
  if (type === 'condition_recommend' || type === 'preferred') {
    const reasonText = recommendations.map((r) => r.restrictionName).join(', ');
    return (
      <div className="mt-1.5 flex items-center gap-1.5 text-green-400 text-xs font-medium animate-in fade-in">
        <ThumbsUp className="w-3.5 h-3.5 shrink-0" />
        <span>{reasonText}</span>
      </div>
    );
  }

  if (isEditing && (type === 'condition_avoid' || type === 'sensitivity' || type === 'non-preferred')) {
    const reasonText = conflicts.map((c) => c.restrictionName).join(', ');
    return (
      <div className="mt-1.5 flex items-center gap-1.5 text-red-400 text-xs font-medium animate-in fade-in">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        <span>{reasonText}</span>
      </div>
    );
  }

  return null;
};

const IngredientCard = ({
  ingredient,
  isFreeMealView,
  isEditing,
  onRemove,
  onReplace,
  onQuickEdit,
  onQuantityChange,
  displayAsBullet = false,
  allFoodGroups,
}) => {
  const { food, quantity, macros, vitamins, minerals, conflictType, conflictDetails, recommendationDetails } = ingredient;

  const foodGroupName =
    allFoodGroups?.find((g) => String(g.id) === String(ingredient.food_group_id))?.name ||
    ingredient.food?.food_to_food_groups?.[0]?.food_group?.name ||
    'Otros';

  const statusColorClasses = getStatusColorClasses(conflictType);
  const displayQuantity = quantity === '' || quantity === null || Number.isNaN(quantity) ? 0 : Math.round(Number(quantity));
  const canManageIngredient = typeof onRemove === 'function' && typeof onReplace === 'function';
  const hasConflict = ['condition_avoid', 'sensitivity', 'non-preferred'].includes(conflictType);
  const isRecommended = ['condition_recommend', 'preferred'].includes(conflictType);

  if (displayAsBullet) {
    return (
      <li className="border-b border-slate-800/50 last:border-0 relative">
        {canManageIngredient && (
          <>
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onReplace();
              }}
              className="absolute left-1 top-1/2 -translate-y-1/2 bg-blue-600/90 text-white rounded-full p-1 transition-opacity hover:bg-blue-500 z-[60] shadow-lg"
              title="Reemplazar ingrediente"
            >
              <ArrowRightLeft className="w-4 h-4" />
            </button>
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onRemove();
              }}
              className="absolute right-1 top-1/2 -translate-y-1/2 bg-red-600/90 text-white rounded-full p-1 transition-opacity hover:bg-red-500 z-[60] shadow-lg"
              title="Eliminar ingrediente"
            >
              <X className="w-4 h-4" />
            </button>
          </>
        )}

        <div
          className={cn(
            'flex items-center justify-between text-sm py-2 rounded-sm transition-colors w-full group relative z-50',
            onQuickEdit && 'cursor-pointer hover:bg-slate-800/20',
            canManageIngredient && 'pl-8 pr-8'
          )}
          onClick={() => onQuickEdit && onQuickEdit()}
        >
          <div className="flex items-center min-w-0 mr-4 w-[90%]">
            <span
              className={cn(
                'text-base truncate transition-colors',
                hasConflict
                  ? 'text-red-400 group-hover:text-red-300'
                  : isRecommended
                    ? 'text-green-400 group-hover:text-green-300'
                    : 'group-hover:text-green-300',
                statusColorClasses.split(' ').find((c) => c.startsWith('text-'))
              )}
            >
              {food.name}
            </span>
            <span className="text-gray-500 text-xs ml-2 whitespace-nowrap">
              ({displayQuantity}
              {food.food_unit === 'unidades' ? ' ud' : 'g'})
            </span>
            {hasConflict && <AlertTriangle className="w-3.5 h-3.5 text-red-500 ml-2 shrink-0" />}
            {isRecommended && <ThumbsUp className="w-3.5 h-3.5 text-green-500 ml-2 shrink-0" />}
          </div>
        </div>
      </li>
    );
  }

  return (
    <div
      data-ingredient-food-id={food.id}
      className={cn(
        'relative p-3 rounded-lg border transition-all duration-300',
        statusColorClasses
          .split(' ')
          .filter((c) => c.startsWith('bg-') || c.startsWith('border-'))
      )}
    >
      {canManageIngredient && (
        <>
          <button
            onClick={onReplace}
            className="absolute left-1 top-1/2 -translate-y-1/2 bg-blue-600/90 text-white rounded-full p-1 transition-opacity hover:bg-blue-500 z-10 shadow-lg"
            title="Reemplazar ingrediente"
          >
            <ArrowRightLeft className="w-4 h-4" />
          </button>
          <button
            onClick={onRemove}
            className="absolute right-1 top-1/2 -translate-y-1/2 bg-red-600/90 text-white rounded-full p-1 transition-opacity hover:bg-red-500 z-10 shadow-lg"
            title="Eliminar ingrediente"
          >
            <X className="w-4 h-4" />
          </button>
        </>
      )}

      {isEditing ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center">
            <div className={cn('w-3/5 flex flex-col justify-center transition-all', canManageIngredient && 'pl-7')}>
              <div className="font-semibold" style={{ color: statusColorClasses.split(' ').find((c) => c.startsWith('text-'))?.replace('text-', '') }}>
                {food.name}
              </div>
              <div className="text-[10px] text-gray-400 truncate mt-0.5">{foodGroupName}</div>
            </div>
            <div className="w-2/5 inline-flex items-center justify-end">
              <Input
                type="number"
                value={quantity}
                onChange={onQuantityChange}
                className="input-field bg-transparent border-dashed w-20 text-center"
              />
              <span className="text-sm font-normal text-gray-400 ml-1">{food.food_unit === 'unidades' ? 'ud' : 'g'}</span>
            </div>
          </div>
          <div className="w-full">
            {renderMacros({ macros, isFreeMealView })}
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start">
          <div className="flex flex-col">
            <div className={cn('font-semibold flex flex-wrap items-center gap-2', statusColorClasses.split(' ').find((c) => c.startsWith('text-')))}>
              <span>{food.name}</span>
              <span className="text-sm font-normal text-gray-400 font-numeric">
                ({displayQuantity}
                {food.food_unit === 'unidades' ? ' ud' : 'g'})
              </span>

              {!isEditing && hasConflict && (
                <span className="inline-flex items-center gap-1.5 text-red-400 text-xs font-medium ml-1 px-2 py-0.5 rounded-full bg-red-900/20 border border-red-500/20">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{conflictDetails.map((c) => c.restrictionName).join(', ')}</span>
                </span>
              )}
            </div>
            {!isEditing && (
              <StatusDisplay
                type={conflictType}
                conflicts={conflictDetails}
                recommendations={recommendationDetails}
                isEditing={isEditing}
              />
            )}
          </div>

          {!isEditing && <div className="mt-2 sm:mt-0 sm:w-auto">{renderMacros({ macros, isFreeMealView })}</div>}
        </div>
      )}

      {isEditing && (
        <StatusDisplay
          type={conflictType}
          conflicts={conflictDetails}
          recommendations={recommendationDetails}
          isEditing={isEditing}
        />
      )}

      {isEditing && (vitamins.length > 0 || minerals.length > 0) && (
        <div className="mt-2 pt-2 border-t border-slate-700/50 flex flex-wrap gap-1.5">
          {vitamins.map((v) => (
            <NutrientBadge key={`v-${v.id}`} nutrient={v} />
          ))}
          {minerals.map((m) => (
            <NutrientBadge key={`m-${m.id}`} nutrient={m} />
          ))}
        </div>
      )}
    </div>
  );
};

export default IngredientCard;
