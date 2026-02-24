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

  const borderColor = useMemo(() => {
    if (isUserCreated) return 'border-purple-500/50';
    if (!conflict) return 'border-gray-700';
    switch (conflict.type) {
      case 'preferred':
      case 'condition_recommend':
        return 'border-green-500/50';
      case 'non-preferred':
      case 'sensitivity':
        return 'border-orange-500/50';
      case 'condition_avoid':
        return 'border-red-500/50';
      default:
        return 'border-gray-700';
    }
  }, [conflict, isUserCreated]);


  return (
    <div ref={rowRef} className={cn(
        "flex items-center gap-2 p-2 rounded-lg border bg-gray-800/50 transition-colors",
        borderColor
    )}>
      <div className="flex-1 space-y-1">
        <span className="font-medium text-white">{foodDetails?.name || ingredient.food_name}</span>
        <div className="flex items-center gap-2 flex-wrap">
            {conflict && <ConflictBadge conflict={conflict} />}
            {isUserCreated && (
                <Badge variant="outline" className="text-xs font-normal flex items-center gap-1.5 bg-purple-500/20 text-purple-300 border-purple-500/30">
                    <Pencil size={12} /> Alimento Privado
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
            className="w-24 bg-transparent border-gray-600 pr-8 text-right"
            min="0"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{unit}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => onRemove(index)} className="text-red-500 hover:bg-red-900/50">
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default IngredientRowConflict;