import React from 'react';
import {
  X,
  AlertTriangle,
  ThumbsUp,
  ArrowRightLeft,
  Plus,
  Minus,
  Lock,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import CaloriesIcon from '@/components/icons/CaloriesIcon';
import ProteinIcon from '@/components/icons/ProteinIcon';
import CarbsIcon from '@/components/icons/CarbsIcon';
import FatsIcon from '@/components/icons/FatsIcon';

const NutrientBadge = ({ nutrient, type = 'vitamin' }) => {
  const toneClasses = type === 'mineral'
    ? 'bg-sky-500/12 dark:bg-sky-900/20 border-sky-500/35 dark:border-sky-500/40 text-sky-700 dark:text-sky-300'
    : 'bg-emerald-500/12 dark:bg-emerald-900/20 border-emerald-500/35 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300';

  return (
    <Badge
      variant="outline"
      className={cn('text-[10px] px-1.5 py-0 h-5', toneClasses)}
    >
      {nutrient.name}
    </Badge>
  );
};

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
    case 'diet_type_excluded':
      return 'bg-red-500/5 dark:bg-muted/65 border-red-500/30 text-red-400';
    case 'diet_type_limited':
      return 'bg-orange-500/5 dark:bg-muted/65 border-orange-500/30 text-orange-400';
    case 'condition_recommend':
    case 'preferred':
      return 'bg-green-600/5 dark:bg-muted/65 border-green-500/30 text-green-600 dark:text-green-400';
    default:
      return 'bg-muted/65 border-border/50 text-foreground';
  }
};

const DiffBadge = ({ action }) => {
  if (action === 'add') {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 rounded-full px-1.5 py-0 h-4 shrink-0">
        <Plus className="w-2.5 h-2.5" />
        Añadido
      </span>
    );
  }
  if (action === 'remove') {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-red-400/70 bg-red-500/10 border border-red-500/20 rounded-full px-1.5 py-0 h-4 shrink-0">
        <Minus className="w-2.5 h-2.5" />
        Eliminado
      </span>
    );
  }
  return null;
};

const StatusDisplay = ({ type, conflicts, recommendations, isEditing }) => {
  if (type === 'condition_recommend' || type === 'preferred') {
    const reasonText = recommendations.map((r) => r.restrictionName).join(', ');
    return (
      <div className="mt-1.5 flex items-center gap-1.5 text-green-600 dark:text-green-400 text-xs font-medium animate-in fade-in">
        <ThumbsUp className="w-3.5 h-3.5 shrink-0" />
        <span>{reasonText}</span>
      </div>
    );
  }

  if (isEditing && (type === 'condition_avoid' || type === 'sensitivity' || type === 'non-preferred' || type === 'diet_type_excluded')) {
    const reasonText = conflicts.map((c) => c.restrictionName).join(', ');
    return (
      <div className="mt-1.5 flex items-center gap-1.5 text-red-400 text-xs font-medium animate-in fade-in">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        <span>{reasonText}</span>
      </div>
    );
  }

  if (isEditing && type === 'diet_type_limited') {
    const reasonText = conflicts.map((c) => c.restrictionName).join(', ');
    return (
      <div className="mt-1.5 flex items-center gap-1.5 text-orange-400 text-xs font-medium animate-in fade-in">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        <span>{reasonText}</span>
      </div>
    );
  }

  return null;
};

const FoodStateBadge = ({ food, isUserCreated }) => {
  if (!food || !isUserCreated) return null;

  const status = (food.status || '').toLowerCase();
  const variants = {
    pending: 'bg-violet-500/20 text-violet-700 dark:text-violet-200 border-violet-400/40',
    approved_private: 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-200 border-indigo-400/40',
    approved_general: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-200 border-emerald-400/40',
  };

  const label =
    status === 'pending'
      ? 'Privado · Pendiente'
      : status === 'approved_general'
        ? 'Global · Aprobado'
        : 'Privado · Aprobado';

  return (
    <Badge
      variant="outline"
      className={cn('text-[10px] px-1.5 py-0 h-5', variants[status] || variants.approved_private)}
    >
      {label}
    </Badge>
  );
};

const scaleMacrosByMultiplier = (macros, multiplier) => ({
  calories: (macros?.calories || 0) * multiplier,
  proteins: (macros?.proteins || 0) * multiplier,
  carbs: (macros?.carbs || 0) * multiplier,
  fats: (macros?.fats || 0) * multiplier,
});

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
  multiplier = 1,
}) => {
  const { food, quantity, macros, vitamins, minerals, conflictType, conflictDetails, recommendationDetails, diffAction, is_ghost, locked } = ingredient;

  const foodGroupName =
    allFoodGroups?.find((g) => String(g.id) === String(ingredient.food_group_id))?.name ||
    ingredient.food?.food_to_food_groups?.[0]?.food_group?.name ||
    'Otros';

  const statusColorClasses = is_ghost
    ? 'bg-muted/30 border-border/30 text-muted-foreground/50'
    : getStatusColorClasses(conflictType);
  const safeMultiplier = Number.isFinite(Number(multiplier)) ? Math.max(1, Number(multiplier)) : 1;
  const baseQuantity = quantity === '' || quantity === null || Number.isNaN(Number(quantity)) ? 0 : Number(quantity);
  const displayQuantity = Math.round(baseQuantity * safeMultiplier);
  const scaledMacros = scaleMacrosByMultiplier(macros, safeMultiplier);
  const unitLabel = food.food_unit === 'unidades' ? 'ud' : 'g';
  // Ghosts are never interactive
  const canManageIngredient = !is_ghost && typeof onRemove === 'function' && typeof onReplace === 'function';
  const canQuickEdit = !is_ghost && typeof onQuickEdit === 'function';
  const hasConflict = !is_ghost && ['condition_avoid', 'sensitivity', 'non-preferred', 'diet_type_excluded', 'diet_type_limited'].includes(conflictType);
  const isRecommended = !is_ghost && ['condition_recommend', 'preferred'].includes(conflictType);
  const isUserCreated = !!ingredient.is_user_created || !!food.is_user_created || !!food.user_id;
  const isEditingCompactMobile = isEditing;

  if (displayAsBullet) {
    return (
      <li className="border-b border-border/50 last:border-0">
        <div
          className={cn(
            'grid items-center gap-2 py-2',
            canManageIngredient
              ? 'grid-cols-[minmax(2rem,5%)_minmax(0,1fr)_minmax(2rem,5%)]'
              : 'grid-cols-1'
          )}
        >
          {canManageIngredient && (
            <div className="flex justify-center">
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
                className="bg-blue-600/90 text-white rounded-full p-1 transition-opacity hover:bg-blue-500 shadow-lg"
                title="Reemplazar ingrediente"
              >
                <ArrowRightLeft className="w-4 h-4" />
              </button>
            </div>
          )}

          <div
            className={cn(
              'flex items-center justify-between text-sm rounded-sm transition-colors w-full group min-w-0',
              canQuickEdit && 'cursor-pointer hover:bg-muted/20'
            )}
            onClick={() => canQuickEdit && onQuickEdit()}
          >
            <div className="flex items-center min-w-0 mr-4 w-full flex-wrap gap-x-1">
              {locked && !is_ghost && (
                <Lock className="w-3 h-3 shrink-0 text-amber-600/80 dark:text-amber-400/80" title="Cantidad bloqueada — el autocuadre no modificará este ingrediente" />
              )}
              <span
                className={cn(
                  'text-base truncate transition-colors',
                  is_ghost
                    ? 'text-muted-foreground/50 line-through'
                    : hasConflict
                      ? 'text-red-400 group-hover:text-red-300'
                      : isRecommended
                        ? 'text-green-600 dark:text-green-400 group-hover:text-green-600 dark:group-hover:text-green-400'
                        : 'group-hover:text-green-600',
                  !is_ghost && statusColorClasses.split(' ').find((c) => c.startsWith('text-'))
                )}
              >
                {food.name}
              </span>
              {!is_ghost && (
                <span className={cn(
                  'text-xs whitespace-nowrap',
                  hasConflict ? 'text-red-400' : isRecommended ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
                )}>
                  ({displayQuantity}{food.food_unit === 'unidades' ? ' ud' : 'g'})
                </span>
              )}
              <div className="shrink-0">
                <FoodStateBadge food={food} isUserCreated={isUserCreated} />
              </div>
              {hasConflict && <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
              {isRecommended && <ThumbsUp className="w-3.5 h-3.5 text-green-600 dark:text-green-400 shrink-0" />}
              {diffAction && <DiffBadge action={diffAction} />}
            </div>
          </div>

          {canManageIngredient && (
            <div className="flex justify-center">
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
                className="bg-red-600/90 text-white rounded-full p-1 transition-opacity hover:bg-red-500 shadow-lg"
                title="Eliminar ingrediente"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </li>
    );
  }

  return (
    <div
      data-ingredient-food-id={food.id}
      className={cn(
        'rounded-lg border transition-all duration-300',
        isEditingCompactMobile ? 'p-2 sm:p-3' : 'p-3',
        statusColorClasses
          .split(' ')
          .filter((c) => (
            c.startsWith('bg-')
            || c.startsWith('border-')
            || c.startsWith('dark:bg-')
            || c.startsWith('dark:border-')
          ))
      )}
    >
      <div
        className={cn(
          'grid items-start',
          isEditingCompactMobile ? 'gap-1.5 sm:gap-2' : 'gap-2',
          canManageIngredient
            ? 'grid-cols-[minmax(2rem,5%)_minmax(0,1fr)_minmax(2rem,5%)]'
            : 'grid-cols-1'
        )}
      >
        {canManageIngredient && (
          <div
            className={cn(
              'flex justify-center',
              isEditing ? 'items-center h-8 sm:h-9' : 'pt-1'
            )}
          >
            <button
              onClick={onReplace}
              className={cn(
                'bg-blue-600/90 text-white rounded-full transition-opacity hover:bg-blue-500 shadow-lg',
                isEditingCompactMobile ? 'p-0.5 sm:p-1' : 'p-1'
              )}
              title="Reemplazar ingrediente"
            >
              <ArrowRightLeft className={cn(isEditingCompactMobile ? 'w-3.5 h-3.5 sm:w-4 sm:h-4' : 'w-4 h-4')} />
            </button>
          </div>
        )}

        <div className="min-w-0">
          {isEditing ? (
            <div className={cn('flex flex-col', isEditingCompactMobile ? 'gap-1.5 sm:gap-2' : 'gap-2')}>
              <div className="flex items-center gap-1 min-h-8 sm:min-h-9">
                <div className="w-3/5 flex flex-col justify-center transition-all min-w-0">
                  <div
                    className={cn('font-semibold', isEditingCompactMobile ? 'text-sm sm:text-base' : '')}
                    style={{ color: statusColorClasses.split(' ').find((c) => c.startsWith('text-'))?.replace('text-', '') }}
                  >
                    {food.name}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate mt-0.5">{foodGroupName}</div>
                </div>
                <div className="w-2/5 inline-flex items-center justify-end">
                  <div className="flex flex-col items-end">
                    <div className="inline-flex items-center">
                      <Input
                        type="number"
                        value={quantity}
                        onChange={onQuantityChange}
                        className={cn(
                          'input-field bg-transparent border-dashed text-center',
                          isEditingCompactMobile ? 'h-8 w-14 sm:h-9 sm:w-20 text-sm' : 'w-20'
                        )}
                      />
                      <span className={cn('font-normal text-muted-foreground ml-1', isEditingCompactMobile ? 'text-xs sm:text-sm' : 'text-sm')}>{unitLabel}</span>
                    </div>
                    {safeMultiplier !== 1 && (
                      <span className="text-[10px] text-cyan-300 mt-0.5">
                        x{safeMultiplier}: {displayQuantity}
                        {unitLabel}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className={cn('w-full', isEditingCompactMobile && 'px-1 sm:px-0')}>
                {renderMacros({
                  macros: scaledMacros,
                  isFreeMealView,
                  smallText: isEditingCompactMobile,
                  fullWidth: isEditingCompactMobile,
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start">
              <div className="flex flex-col min-w-0">
                <div className={cn(
                  'font-semibold flex flex-wrap items-center gap-2',
                  is_ghost ? 'text-muted-foreground/50' : statusColorClasses.split(' ').find((c) => c.startsWith('text-'))
                )}>
                  {locked && !is_ghost && (
                    <Lock className="w-3 h-3 shrink-0 text-amber-500/70" title="Cantidad bloqueada — el autocuadre no modificará este ingrediente" />
                  )}
                  <span className={cn(is_ghost && 'line-through')}>{food.name}</span>
                  {!is_ghost && (
                    <span className={cn(
                      'text-sm font-normal font-numeric',
                      hasConflict ? 'text-red-400' : isRecommended ? 'text-green-400' : 'text-muted-foreground'
                    )}>
                      ({displayQuantity}{food.food_unit === 'unidades' ? ' ud' : 'g'})
                    </span>
                  )}
                  <FoodStateBadge food={food} isUserCreated={isUserCreated} />
                  {diffAction && <DiffBadge action={diffAction} />}

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

              {!isEditing && <div className="mt-2 sm:mt-0 sm:w-auto">{renderMacros({ macros: scaledMacros, isFreeMealView })}</div>}
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
        </div>

        {canManageIngredient && (
          <div
            className={cn(
              'flex justify-center',
              isEditing ? 'items-center h-8 sm:h-9' : 'pt-1'
            )}
          >
            <button
              onClick={onRemove}
              className={cn(
                'bg-red-600/90 text-white rounded-full transition-opacity hover:bg-red-500 shadow-lg',
                isEditingCompactMobile ? 'p-0.5 sm:p-1' : 'p-1'
              )}
              title="Eliminar ingrediente"
            >
              <X className={cn(isEditingCompactMobile ? 'w-3.5 h-3.5 sm:w-4 sm:h-4' : 'w-4 h-4')} />
            </button>
          </div>
        )}

        {isEditing && (vitamins.length > 0 || minerals.length > 0) && (
          <div
            className={cn(
              'border-t border-border/50 flex flex-wrap gap-1.5 col-span-full',
              isEditingCompactMobile ? 'mt-1.5 pt-1.5 sm:mt-2 sm:pt-2' : 'mt-2 pt-2'
            )}
          >
            {vitamins.map((v) => (
              <NutrientBadge key={`v-${v.id}`} nutrient={v} type="vitamin" />
            ))}
            {minerals.map((m) => (
              <NutrientBadge key={`m-${m.id}`} nutrient={m} type="mineral" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default IngredientCard;
