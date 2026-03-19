import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X, AlertTriangle, ThumbsDown, ThumbsUp, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { getConflictInfo } from '@/lib/restrictionChecker.js';

const ConflictBadge = ({ conflict }) => {
  if (!conflict) return null;

  const config = {
    'non-preferred': { icon: <ThumbsDown size={14} />, color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
    'preferred': { icon: <ThumbsUp size={14} />, color: 'bg-green-500/20 text-green-300 border-green-500/30' },
    'condition_avoid': { icon: <AlertTriangle size={14} />, color: 'bg-red-500/20 text-red-300 border-red-500/30' },
    'condition_recommend': { icon: <ThumbsUp size={14} />, color: 'bg-green-500/20 text-green-300 border-green-500/30' },
    'sensitivity': { icon: <AlertTriangle size={14} />, color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
    'individual_restriction': { icon: <AlertTriangle size={14} />, color: 'bg-red-500/20 text-red-300 border-red-500/30' },
  };

  const { icon, color } = config[conflict.type] || {};

  return (
    <Badge variant="outline" className={cn('text-xs font-normal flex items-center gap-1.5', color)}>
      {icon}
      {conflict.reason}
    </Badge>
  );
};


const IngredientRowConflict = ({
  ingredient,
  index,
  onQuantityChange,
  onRemove,
  availableFoods,
  userRestrictions,
}) => {
  const [quantity, setQuantity] = useState(ingredient.quantity || ingredient.grams || 100);
  const rowRef = useRef(null);
  
  const foodDetails = useMemo(() => {
    if (!availableFoods || !ingredient) return null;
    return availableFoods.find(f => 
        String(f.id) === String(ingredient.food_id) && 
        !!f.is_user_created === !!ingredient.is_user_created
    );
  }, [availableFoods, ingredient]);

  const isUserCreated = foodDetails?.is_user_created || ingredient.is_user_created;

  const conflict = useMemo(() => {
    if (!foodDetails || !userRestrictions) return null;
    return getConflictInfo(foodDetails, userRestrictions);
  }, [foodDetails, userRestrictions]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (String(quantity) !== String(ingredient.quantity || ingredient.grams)) {
        onQuantityChange(index, quantity);
      }
    }, 500);

    return () => clearTimeout(handler);
  }, [quantity, index, onQuantityChange, ingredient.quantity, ingredient.grams]);

  const handleQuantityChange = (e) => {
    setQuantity(e.target.value);
  };
  
  const handleFocus = (e) => {
    if (window.innerWidth < 768) { // Only on mobile devices
      setTimeout(() => {
        if (rowRef.current) {
          const elementRect = rowRef.current.getBoundingClientRect();
          const absoluteElementTop = elementRect.top + window.pageYOffset;
          const middle = absoluteElementTop - (window.innerHeight / 2) + (elementRect.height / 2);
          
          window.scrollTo({
            top: middle,
            behavior: 'smooth'
          });
        }
      }, 100); // Delay to allow keyboard to show up
    }
  };

  const unit = foodDetails?.food_unit === 'unidades' ? 'ud' : 'g';
  const foodStatus = (foodDetails?.status || '').toLowerCase();
  const privateBadgeLabel =
    foodStatus === 'pending'
      ? 'Privado · Pendiente'
      : foodStatus === 'approved_general'
        ? 'Global · Aprobado'
        : 'Privado · Aprobado';

  const borderColor = useMemo(() => {
    if (isUserCreated) return 'border-purple-500/50';
    if (!conflict) return 'border-border';
    switch (conflict.type) {
      case 'preferred':
      case 'condition_recommend':
        return 'border-green-500/50';
      case 'non-preferred':
      case 'sensitivity':
        return 'border-orange-500/50';
      case 'condition_avoid':
      case 'individual_restriction':
        return 'border-red-500/50';
      default:
        return 'border-border';
    }
  }, [conflict, isUserCreated]);


  return (
    <div ref={rowRef} className={cn(
        "flex items-center gap-2 p-2 rounded-lg border bg-muted/65 transition-colors",
        borderColor
    )}>
      <div className="flex-1 space-y-1">
        <span className="font-medium text-foreground">{foodDetails?.name || ingredient.food_name}</span>
        <div className="flex items-center gap-2 flex-wrap">
            {conflict && <ConflictBadge conflict={conflict} />}
            {isUserCreated && (
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs font-normal flex items-center gap-1.5',
                    foodStatus === 'pending'
                      ? 'bg-violet-500/20 text-violet-200 border-violet-400/40'
                      : foodStatus === 'approved_general'
                        ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40'
                        : 'bg-indigo-500/20 text-indigo-200 border-indigo-400/40'
                  )}
                >
                    <Pencil size={12} /> {privateBadgeLabel}
                </Badge>
            )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative">
          <Input
            type="number"
            value={quantity}
            onChange={handleQuantityChange}
            onFocus={handleFocus}
            className="w-24 bg-card/70 border-input pr-8 text-right"
            min="0"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{unit}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => onRemove(index)} className="text-red-600 dark:text-red-500 hover:bg-red-100/60 dark:hover:bg-red-900/50">
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default IngredientRowConflict;
