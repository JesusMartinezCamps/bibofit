import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { InputWithUnit } from '@/components/ui/input';
import { Combobox } from '@/components/ui/combobox';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import CaloriesIcon from '@/components/icons/CaloriesIcon';
import ProteinIcon from '@/components/icons/ProteinIcon';
import CarbsIcon from '@/components/icons/CarbsIcon';
import FatsIcon from '@/components/icons/FatsIcon';
import { calculateMacros as calculateMacrosFromIngredients } from '@/lib/macroCalculator';
import IngredientSensitivitiesBadge from './IngredientSensitivitiesBadge';
import IngredientMicronutrients from './IngredientMicronutrients';

const IngredientRow = React.memo(({
  ingredient,
  allFoods,
  availableFoods,
  onIngredientChange,
  onRemove,
  gridStyle,
  planRestrictions,
  displayMode = 'inform' // 'inform' or 'conflict'
}) => {

  const foodDetails = useMemo(() => availableFoods.find(f => String(f.id) === String(ingredient.food_id)), [availableFoods, ingredient.food_id]);
  const macros = useMemo(() => calculateMacrosFromIngredients([ingredient], allFoods), [ingredient, allFoods]);
  
  // Get food group name safely to display below the ingredient name
  const foodGroupName = useMemo(() => {
     return foodDetails?.food_to_food_groups?.[0]?.food_group?.name;
  }, [foodDetails]);

  const getConflictInfo = (food, restrictions) => {
    if (!food || !restrictions) return null;

    if (restrictions.nonPreferredFoods?.includes(food.id)) return { type: 'hated', reason: 'Odiado' };
    if (restrictions.preferredFoods?.includes(food.id)) return { type: 'preferred', reason: 'Preferido' };

    const conditionAvoid = food.food_medical_conditions?.find(fmc => 
        (restrictions.conditions || []).includes(fmc.condition_id) && fmc.relation_type === 'contraindicated'
    );
    if (conditionAvoid) {
        const condition = restrictions.allMedicalConditions?.find(c => c.id === conditionAvoid.condition_id);
        return { type: 'condition_avoid', reason: condition?.name || 'Condición' };
    }

    const sensitivity = food.food_sensitivities?.find(fs => 
        (restrictions.sensitivities || []).includes(fs.sensitivity_id)
    );
    if (sensitivity) {
        const sensitivityDetails = restrictions.allSensitivities?.find(s => s.id === sensitivity.sensitivity_id);
        return { type: 'sensitivity', reason: sensitivityDetails?.name || 'Sensibilidad' };
    }

    const conditionRecommend = food.food_medical_conditions?.find(fmc => 
        (restrictions.conditions || []).includes(fmc.condition_id) && fmc.relation_type === 'recommended'
    );
    if (conditionRecommend) {
        const condition = restrictions.allMedicalConditions?.find(c => c.id === conditionRecommend.condition_id);
        return { type: 'condition_recommend', reason: condition?.name || 'Recomendado' };
    }

    return null;
  };
  
  const foodsForCombobox = useMemo(() => {
    const conflictPriority = {
      'preferred': 1,
      'condition_recommend': 2,
      null: 3,
      'sensitivity': 4,
      'hated': 5,
      'condition_avoid': 6
    };

    return availableFoods
      .map(food => {
          const conflictInfo = displayMode === 'conflict' ? getConflictInfo(food, planRestrictions) : null;
          const label = conflictInfo ? `${food.name} (${conflictInfo.reason})` : food.name;
          return {
              value: String(food.id),
              label: label,
              conflictType: conflictInfo?.type || null
          }
      })
      .sort((a, b) => {
          const priorityA = conflictPriority[a.conflictType];
          const priorityB = conflictPriority[b.conflictType];
          if (priorityA !== priorityB) {
              return priorityA - priorityB;
          }
          return a.label.localeCompare(b.label);
      });
  }, [availableFoods, planRestrictions, displayMode]);

  const selectedFoodConflictInfo = useMemo(() => {
    if (displayMode !== 'conflict' || !foodDetails) return null;
    return getConflictInfo(foodDetails, planRestrictions);
  }, [foodDetails, planRestrictions, displayMode]);

  const handleGramsChange = (e) => {
    const value = e.target.value;
    if (value === '') {
        onIngredientChange(ingredient.local_id, 'grams', '');
    } else {
        const numValue = parseFloat(value);
        if (!isNaN(numValue) && numValue >= 0) {
            onIngredientChange(ingredient.local_id, 'grams', String(numValue));
        }
    }
  };

  const handleFoodChange = (value) => {
    const newFoodId = value || '';
    const newFood = availableFoods.find(f => String(f.id) === newFoodId);
    
    let newGrams = '';
    if (newFood) {
      newGrams = newFood.food_unit === 'unidades' ? '1' : '100';
    }

    const updatedIngredient = {
        food_id: newFoodId,
        grams: newGrams,
        food_group_id: newFood ? (newFood.food_to_food_groups?.[0]?.food_group_id || null) : null
    };

    onIngredientChange(ingredient.local_id, updatedIngredient);
  };
  
  const hasValue = useMemo(() => parseFloat(ingredient.grams) > 0, [ingredient.grams]);

  const conflictClasses = useMemo(() => {
    if (displayMode !== 'conflict' || !selectedFoodConflictInfo) {
      return {
        border: 'border-slate-600',
        text: 'text-slate-300',
        bg: 'bg-slate-950',
        hoverBorder: 'hover:border-slate-500',
        hoverText: 'hover:text-slate-200',
        focusRing: 'focus:ring-slate-500',
      };
    }
    switch (selectedFoodConflictInfo.type) {
      case 'sensitivity':
        return {
          border: 'border-orange-500',
          text: 'text-orange-200',
          bg: 'bg-orange-900/40',
          hoverBorder: 'hover:border-orange-400',
          hoverText: 'hover:text-orange-200',
          focusRing: 'focus:ring-orange-500',
        };
      case 'condition_avoid':
      case 'hated':
        return {
          border: 'border-red-500',
          text: 'text-red-200',
          bg: 'bg-red-900/40',
          hoverBorder: 'hover:border-red-400',
          hoverText: 'hover:text-red-200',
          focusRing: 'focus:ring-red-500',
        };
      case 'condition_recommend':
      case 'preferred':
        return {
          border: 'border-green-500',
          text: 'text-green-200',
          bg: 'bg-green-900/40',
          hoverBorder: 'hover:border-green-400',
          hoverText: 'hover:text-green-200',
          focusRing: 'focus:ring-green-500',
        };
      default:
        return {
          border: 'border-slate-600',
          text: 'text-slate-300',
          bg: 'bg-slate-950',
          hoverBorder: 'hover:border-slate-500',
          hoverText: 'hover:text-slate-200',
          focusRing: 'focus:ring-slate-500',
        };
    }
  }, [selectedFoodConflictInfo, displayMode]);

  const comboboxClasses = cn(
    "h-9 text-xs w-full",
    displayMode === 'inform' && "border-[#3DB477] text-[#3DB477] hover:text-[#3DB477]",
    displayMode === 'conflict' && [
      conflictClasses.border,
      conflictClasses.text,
      conflictClasses.bg,
      conflictClasses.hoverBorder,
      conflictClasses.hoverText,
    ]
  );

  const quantityInputClasses = cn(
    "h-9 text-xs w-full text-center font-numeric",
    hasValue && foodDetails ? conflictClasses.border : 'border-gray-600',
    hasValue && foodDetails ? conflictClasses.text : 'text-gray-400',
    hasValue && foodDetails ? conflictClasses.focusRing : 'focus:ring-[#3DB477]',
  );

  const quantityUnitClasses = cn(
    "font-numeric",
    hasValue && foodDetails ? conflictClasses.text : 'text-gray-400'
  );

  return (
    <div className={cn("flex flex-col p-2 rounded-lg", conflictClasses.bg)}>
      <div
          className="grid items-center text-sm gap-x-2 rounded-md"
          style={gridStyle}
      >
          <div className="flex flex-col w-full">
            <Combobox
                options={foodsForCombobox}
                value={ingredient.food_id ? String(ingredient.food_id) : ''}
                onValueChange={handleFoodChange}
                placeholder="Alimento..."
                triggerClassName={comboboxClasses}
                searchPlaceholder="Buscar alimento..."
                noResultsText="No se encontró el alimento."
            />
            {/* Show Food Group Name in small text */}
            {foodGroupName && (
                <span className="text-[10px] text-gray-400 pl-1 mt-0.5 truncate block w-full">
                    {foodGroupName}
                </span>
            )}
          </div>
          
          <InputWithUnit
              type="number" 
              placeholder="0"
              min="0"
              step={foodDetails?.food_unit === 'unidades' ? '1' : '5'}
              value={ingredient.grams} 
              onChange={handleGramsChange}
              unit={foodDetails?.food_unit === 'unidades' ? 'Ud.' : 'g'}
              className={quantityInputClasses}
              unitClassName={quantityUnitClasses}
          />
          <span className="flex items-center justify-center gap-1 font-numeric text-orange-400"><CaloriesIcon className="w-4 h-4"/>{Math.round(macros.calories)}</span>
          <span className="flex items-center justify-center gap-1 font-numeric text-red-400"><ProteinIcon className="w-4 h-4"/>{Math.round(macros.proteins)}</span>
          <span className="flex items-center justify-center gap-1 font-numeric text-yellow-400"><CarbsIcon className="w-4 h-4"/>{Math.round(macros.carbs)}</span>
          <span className="flex items-center justify-center gap-1 font-numeric text-green-400"><FatsIcon className="w-4 h-4"/>{Math.round(macros.fats)}</span>
          
          <Button 
              type="button" 
              variant="ghost" 
              size="icon" 
              onClick={() => onRemove(ingredient.local_id)} 
              className="text-red-500 hover:text-red-400 hover:bg-red-500/10 h-8 w-8 justify-self-end"
          >
              <Trash2 className="h-4 w-4" />
          </Button>
      </div>
      {foodDetails && (
        <div className="pl-2 mt-1 flex flex-col gap-1">
          <IngredientSensitivitiesBadge 
            food={foodDetails} 
            displayMode={displayMode}
            conflictInfo={selectedFoodConflictInfo}
          />
          {/* Render micronutrients directly without the 'Micronutrientes clave' label */}
          <IngredientMicronutrients food={foodDetails} />
        </div>
      )}
    </div>
  );
});

IngredientRow.displayName = 'IngredientRow';

export default IngredientRow;