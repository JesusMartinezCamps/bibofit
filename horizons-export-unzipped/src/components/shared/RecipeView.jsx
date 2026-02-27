import React, { useMemo, useState, useEffect, useRef } from 'react';
import { calculateMacros } from '@/lib/macroCalculator';
import CaloriesIcon from '@/components/icons/CaloriesIcon';
import ProteinIcon from '@/components/icons/ProteinIcon';
import CarbsIcon from '@/components/icons/CarbsIcon';
import FatsIcon from '@/components/icons/FatsIcon';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Sparkles, ShieldAlert, CheckCircle2, Clock, ChefHat, X, PlusCircle, AlertTriangle, Loader2, ThumbsUp, Bot, ArrowRightLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getConflictInfo } from '@/lib/restrictionChecker.js';
import { useAuth } from '@/contexts/AuthContext';
import { invokeAutoBalanceRecipe } from '@/lib/autoBalanceClient';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import IngredientSearch from '@/components/plans/IngredientSearch';
import { Badge } from '@/components/ui/badge';

const EditableField = ({ value, onChange, isEditing, placeholder, type = 'input', options = [], className = '' }) => {
  const textareaRef = useRef(null);

  // Ajustar altura al montar y cuando cambia value
  useEffect(() => {
    if (isEditing && type === 'textarea' && textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [value, isEditing, type]);

  if (!isEditing) {
    if (type === 'p') {
      return <p className={cn("text-gray-300 whitespace-pre-wrap", className)}>{value || placeholder}</p>;
    }
    return <span className={cn("text-gray-300", className)}>{value || placeholder}</span>;
  }

  if (type === 'textarea') {
    const handleAutoGrow = (e) => {
      e.target.style.height = "auto";
      e.target.style.height = e.target.scrollHeight + "px";
      onChange(e);
    };

    return (
      <Textarea
        ref={textareaRef}
        name="textarea-field"
        value={value}
        onChange={handleAutoGrow}
        placeholder={placeholder}
        className={cn(
          "input-field w-full bg-transparent border-dashed resize-none overflow-hidden",
          className
        )}
        style={{
          minHeight: "50px",
          whiteSpace: "pre-wrap"
        }}
      />
    );
  }

  if (type === 'select') {
    return (
      <Select name={onChange.name} value={value} onValueChange={onChange}>
        <SelectTrigger className={cn("input-field bg-transparent border-dashed w-auto", isEditing && "sm:pr-1 sm:pl-2", className)}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="bg-[#282d34] border border-gray-700 text-white">
          {options.map(opt => <SelectItem key={opt.value} value={opt.value} className="focus:bg-gray-700 focus:text-white">{opt.label}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }

  return <Input name={onChange.name} value={value} onChange={onChange} placeholder={placeholder} className={cn("input-field h-auto p-0 bg-transparent border-dashed", className, isEditing && "sm:p-0.5")} />;
};

const NutrientBadge = ({ nutrient }) => (
  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-slate-800/50 border-slate-700 text-gray-300">
    {nutrient.name}
  </Badge>
);

const IngredientCard = ({
  ingredient,
  isFreeMealView,
  isEditing,
  onRemove,
  onReplace,
  onQuickEdit,
  onQuantityChange,
  displayAsBullet = false,
  allFoodGroups
}) => {
  const { food, quantity, macros, vitamins, minerals, conflictType, conflictDetails, recommendationDetails } = ingredient;

  const foodGroupName = allFoodGroups?.find(g => String(g.id) === String(ingredient.food_group_id))?.name ||
    ingredient.food?.food_to_food_groups?.[0]?.food_group?.name || "Otros";

  const renderMacros = (macros, smallText = false, fixedWidth = false, hideUnits = false, fullWidth = false, tooltip = false) => (
    <div className={cn(
      "flex items-center font-numeric",
      smallText && !tooltip ? "text-xs" : "gap-x-4 text-sm",
      tooltip && "text-base gap-x-4",
      !fullWidth && (isFreeMealView && !fixedWidth ? 'justify-between' : 'justify-start sm:justify-end'),
      fullWidth && 'justify-between w-full',
      fixedWidth && "gap-0"
    )}>
      <div className={cn("flex items-center text-orange-400", fixedWidth && "w-[80px] justify-end")} title="Calorías">
        <CaloriesIcon className={cn("w-3 h-3", !hideUnits && "mr-1.5", hideUnits && "mr-1", tooltip && "w-4 h-4 mr-1.5")} />
        <span>{Math.round(macros.calories)}</span>
        {!hideUnits && <span className={cn("text-[10px] text-orange-400/80 ml-0.5", tooltip && "text-xs")}>kcal</span>}
      </div>
      <div className={cn("flex items-center text-red-400", fixedWidth && "w-[60px] justify-end")} title="Proteínas">
        <ProteinIcon className={cn("w-3 h-3", !hideUnits && "mr-1.5", hideUnits && "mr-1", tooltip && "w-4 h-4 mr-1.5")} />
        <span>{Math.round(macros.proteins)}</span>
        {!hideUnits && <span className={cn("text-[10px] text-red-400/80 ml-0.5", tooltip && "text-xs")}>g</span>}
      </div>
      <div className={cn("flex items-center text-yellow-400", fixedWidth && "w-[60px] justify-end")} title="Carbohidratos">
        <CarbsIcon className={cn("w-3 h-3", !hideUnits && "mr-1.5", hideUnits && "mr-1", tooltip && "w-4 h-4 mr-1.5")} />
        <span>{Math.round(macros.carbs)}</span>
        {!hideUnits && <span className={cn("text-[10px] text-yellow-400/80 ml-0.5", tooltip && "text-xs")}>g</span>}
      </div>
      <div className={cn("flex items-center text-green-400", fixedWidth && "w-[60px] justify-end")} title="Grasas">
        <FatsIcon className={cn("w-3 h-3", !hideUnits && "mr-1.5", hideUnits && "mr-1", tooltip && "w-4 h-4 mr-1.5")} />
        <span>{Math.round(macros.fats)}</span>
        {!hideUnits && <span className={cn("text-[10px] text-green-400/80 ml-0.5", tooltip && "text-xs")}>g</span>}
      </div>
    </div>
  );

  const getStatusDisplay = (type, conflicts, recommendations) => {
    if (type === 'condition_recommend' || type === 'preferred') {
      const reasonText = recommendations.map(r => r.restrictionName).join(', ');
      return (
        <div className="mt-1.5 flex items-center gap-1.5 text-green-400 text-xs font-medium animate-in fade-in">
          <ThumbsUp className="w-3.5 h-3.5 shrink-0" />
          <span>{reasonText}</span>
        </div>
      );
    }
    if (isEditing && (type === 'condition_avoid' || type === 'sensitivity' || type === 'non-preferred')) {
      const reasonText = conflicts.map(c => c.restrictionName).join(', ');
      return (
        <div className="mt-1.5 flex items-center gap-1.5 text-red-400 text-xs font-medium animate-in fade-in">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>{reasonText}</span>
        </div>
      );
    }
    return null;
  };

  const getStatusColorClasses = (type) => {
    switch (type) {
      case 'condition_avoid':
      case 'sensitivity':
      case 'non-preferred':
        return "bg-gradient-to-br from-red-900/30 via-slate-800/20 to-slate-800/20 border-red-500/50 text-red-300";
      case 'condition_recommend':
      case 'preferred':
        return "bg-gradient-to-br from-green-900/30 via-slate-800/20 to-slate-800/20 border-green-500/50 text-green-300";
      default:
        return "bg-gradient-to-br from-slate-800/60 via-slate-800/40 to-slate-800/40 border-slate-700/50 text-gray-200";
    }
  };

  const statusColorClasses = getStatusColorClasses(conflictType);
  const displayQuantity = (quantity === '' || quantity === null || isNaN(quantity)) ? 0 : Math.round(Number(quantity));
  const canManageIngredient = typeof onRemove === 'function' && typeof onReplace === 'function';

  if (displayAsBullet) {
    const hasConflict = ['condition_avoid', 'sensitivity', 'non-preferred'].includes(conflictType);
    const isRecommended = ['condition_recommend', 'preferred'].includes(conflictType);

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
            "flex items-center justify-between text-sm py-2 rounded-sm transition-colors w-full group relative z-50",
            onQuickEdit && "cursor-pointer hover:bg-slate-800/20",
            canManageIngredient && "pl-8 pr-8"
          )}
          onClick={() => onQuickEdit && onQuickEdit()}
        >
          <div className="flex items-center min-w-0 mr-4 w-[90%]">
            <span className={cn("text-base truncate transition-colors",
              hasConflict ? "text-red-400 group-hover:text-red-300" : (isRecommended ? "text-green-400 group-hover:text-green-300" : "group-hover:text-green-300"),
              statusColorClasses.split(' ').find(c => c.startsWith('text-'))
            )}>
              {food.name}
            </span>
            <span className="text-gray-500 text-xs ml-2 whitespace-nowrap">({displayQuantity}{food.food_unit === 'unidades' ? ' ud' : 'g'})</span>
            {hasConflict && <AlertTriangle className="w-3.5 h-3.5 text-red-500 ml-2 shrink-0" />}
            {isRecommended && <ThumbsUp className="w-3.5 h-3.5 text-green-500 ml-2 shrink-0" />}
          </div>
        </div>
      </li>
    );
  }

  const hasConflict = ['condition_avoid', 'sensitivity', 'non-preferred'].includes(conflictType);

  return (
    <div data-ingredient-food-id={food.id} className={cn("relative p-3 rounded-lg border transition-all duration-300", statusColorClasses.split(' ').filter(c => c.startsWith('bg-') || c.startsWith('border-')))}>
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
            <div className={cn("w-3/5 flex flex-col justify-center transition-all", canManageIngredient && "pl-7")}>
              <div className="font-semibold" style={{ color: statusColorClasses.split(' ').find(c => c.startsWith('text-'))?.replace('text-', '') }}>
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
            {renderMacros(macros)}
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start">
          <div className="flex flex-col">
            <div className={cn("font-semibold flex flex-wrap items-center gap-2", statusColorClasses.split(' ').find(c => c.startsWith('text-')))}>
              <span>{food.name}</span>
              <span className="text-sm font-normal text-gray-400 font-numeric">
                ({displayQuantity}{food.food_unit === 'unidades' ? ' ud' : 'g'})
              </span>

              {!isEditing && hasConflict && (
                <span className="inline-flex items-center gap-1.5 text-red-400 text-xs font-medium ml-1 px-2 py-0.5 rounded-full bg-red-900/20 border border-red-500/20">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{conflictDetails.map(c => c.restrictionName).join(', ')}</span>
                </span>
              )}
            </div>
            {!isEditing && getStatusDisplay(conflictType, conflictDetails, recommendationDetails)}
          </div>

          {!isEditing && (
            <div className="mt-2 sm:mt-0 sm:w-auto">
              {renderMacros(macros)}
            </div>
          )}
        </div>
      )}

      {isEditing && getStatusDisplay(conflictType, conflictDetails, recommendationDetails)}

      {isEditing && (vitamins.length > 0 || minerals.length > 0) && (
        <div className="mt-2 pt-2 border-t border-slate-700/50 flex flex-wrap gap-1.5">
          {vitamins.map(v => <NutrientBadge key={`v-${v.id}`} nutrient={v} />)}
          {minerals.map(m => <NutrientBadge key={`m-${m.id}`} nutrient={m} />)}
        </div>
      )}
    </div>
  );
};

const renderTotalMacros = (macros, isTotal = false) => {
    if (!macros) return null;
    return (
        <div className="grid grid-cols-4 gap-2">
            <div className="flex flex-col items-center p-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
                <div className="flex items-center gap-1 text-orange-400 mb-1">
                    <CaloriesIcon className="w-4 h-4" />
                    <span className="text-xs font-medium">Calorías</span>
                </div>
                <span className="text-lg font-bold text-white">{Math.round(macros.calories || 0)}</span>
            </div>
            <div className="flex flex-col items-center p-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
                <div className="flex items-center gap-1 text-red-400 mb-1">
                    <ProteinIcon className="w-4 h-4" />
                    <span className="text-xs font-medium">Proteínas</span>
                </div>
                <span className="text-lg font-bold text-white">{Math.round(macros.proteins || 0)}g</span>
            </div>
            <div className="flex flex-col items-center p-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
                <div className="flex items-center gap-1 text-yellow-400 mb-1">
                    <CarbsIcon className="w-4 h-4" />
                    <span className="text-xs font-medium">Carbs</span>
                </div>
                <span className="text-lg font-bold text-white">{Math.round(macros.carbs || 0)}g</span>
            </div>
            <div className="flex flex-col items-center p-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
                <div className="flex items-center gap-1 text-green-400 mb-1">
                    <FatsIcon className="w-4 h-4" />
                    <span className="text-xs font-medium">Grasas</span>
                </div>
                <span className="text-lg font-bold text-white">{Math.round(macros.fats || 0)}g</span>
            </div>
        </div>
    );
};

const renderTargetMacros = (targets) => {
    if (!targets) return null;
    return (
        <div className="grid grid-cols-4 gap-2 opacity-70">
             <div className="flex flex-col items-center">
                <span className="text-xs text-gray-400">Meta</span>
                <span className="text-sm font-medium text-orange-400">{Math.round(targets.target_calories || 0)}</span>
            </div>
             <div className="flex flex-col items-center">
                <span className="text-xs text-gray-400">Meta</span>
                <span className="text-sm font-medium text-red-400">{Math.round(targets.target_proteins || 0)}g</span>
            </div>
             <div className="flex flex-col items-center">
                <span className="text-xs text-gray-400">Meta</span>
                <span className="text-sm font-medium text-yellow-400">{Math.round(targets.target_carbs || 0)}g</span>
            </div>
             <div className="flex flex-col items-center">
                <span className="text-xs text-gray-400">Meta</span>
                <span className="text-sm font-medium text-green-400">{Math.round(targets.target_fats || 0)}g</span>
            </div>
        </div>
    );
};

const IngredientQuickEditDialog = ({
  open,
  ingredient,
  allFoods,
  allVitamins,
  allMinerals,
  selectedIngredients,
  userRestrictions,
  onOpenChange,
  onSave
}) => {
  const [quantity, setQuantity] = useState('');
  const [selectedFoodId, setSelectedFoodId] = useState(null);
  const [isReplacing, setIsReplacing] = useState(false);

  useEffect(() => {
    if (!ingredient) return;
    const initialQty = ingredient.quantity ?? ingredient.grams ?? 0;
    setQuantity(String(initialQty));
    setSelectedFoodId(ingredient.food?.id ?? ingredient.food_id ?? null);
    setIsReplacing(false);
  }, [ingredient]);

  if (!ingredient) return null;

  const selectedFood = (allFoods || []).find((food) => String(food.id) === String(selectedFoodId)) || ingredient.food;
  const defaultQty = selectedFood?.food_unit === 'unidades' ? 1 : 100;
  const parsedQty = Number(quantity);
  const safeQty = Number.isFinite(parsedQty) ? parsedQty : 0;
  const originalQty = Number(ingredient.quantity ?? ingredient.grams ?? 0) || defaultQty;
  const ratio = originalQty > 0 ? safeQty / originalQty : 0;
  const selectedIngredientForCalc = {
    ...ingredient,
    food: selectedFood,
    food_id: selectedFood?.id || ingredient.food_id,
    grams: safeQty,
    quantity: safeQty
  };
  const originalIngredientForCalc = {
    ...ingredient,
    food: selectedFood,
    food_id: selectedFood?.id || ingredient.food_id,
    grams: originalQty,
    quantity: originalQty
  };
  const originalMacros = selectedFood ? calculateMacros([originalIngredientForCalc], allFoods || []) : (ingredient.macros || { calories: 0, proteins: 0, carbs: 0, fats: 0 });
  const updatedCalc = selectedFood ? calculateMacros([selectedIngredientForCalc], allFoods || []) : null;
  const updatedMacros = {
    calories: updatedCalc ? updatedCalc.calories : (originalQty > 0 ? originalMacros.calories * ratio : 0),
    proteins: updatedCalc ? updatedCalc.proteins : (originalQty > 0 ? originalMacros.proteins * ratio : 0),
    carbs: updatedCalc ? updatedCalc.carbs : (originalQty > 0 ? originalMacros.carbs * ratio : 0),
    fats: updatedCalc ? updatedCalc.fats : (originalQty > 0 ? originalMacros.fats * ratio : 0)
  };
  const selectedVitamins = (selectedFood?.food_vitamins || [])
    .map((fv) => {
      const vitaminData = (allVitamins || []).find(v => v.id === (fv.vitamin_id || fv.vitamin?.id));
      if (!vitaminData) return null;
      return { ...vitaminData, mg_per_100g: typeof fv.mg_per_100g === 'number' ? fv.mg_per_100g : null };
    })
    .filter(Boolean);
  const selectedMinerals = (selectedFood?.food_minerals || [])
    .map((fm) => {
      const mineralData = (allMinerals || []).find(m => m.id === (fm.mineral_id || fm.mineral?.id));
      if (!mineralData) return null;
      return { ...mineralData, mg_per_100g: typeof fm.mg_per_100g === 'number' ? fm.mg_per_100g : null };
    })
    .filter(Boolean);
  const searchSelectedIngredients = (selectedIngredients || []).filter(
    (ing) => String(ing.food_id) !== String(ingredient.food_id || ingredient.food?.id)
  );

  if (isReplacing) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-[#0E1528] border-slate-700 text-white max-w-2xl p-0">
          <div className="p-4 h-[70vh]">
            <IngredientSearch
              selectedIngredients={searchSelectedIngredients}
              availableFoods={allFoods}
              userRestrictions={userRestrictions}
              onBack={() => setIsReplacing(false)}
              onIngredientAdded={(newIngredientData) => {
                const selected = (allFoods || []).find((food) => String(food.id) === String(newIngredientData.food_id));
                const initial = selected?.food_unit === 'unidades' ? 1 : 100;
                setSelectedFoodId(newIngredientData.food_id);
                setQuantity(String(initial));
                setIsReplacing(false);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0E1528] border-slate-700 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl bg-clip-text text-transparent bg-gradient-to-r from-green-300 to-teal-400">
            Ajustar Ingrediente
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-slate-700/70 bg-slate-900/60 p-3">
            <p className="text-sm text-slate-400">Ingrediente</p>
            <p className="text-lg font-semibold text-slate-100">{selectedFood?.name || ingredient.food?.name}</p>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full border-blue-500 bg-blue-600/20 text-white p-1 transition-opacity hover:text-blue-100 hover:bg-blue-500/30"
            onClick={() => setIsReplacing(true)}
          >
            <ArrowRightLeft className="w-4 h-4 mr-2" />
            Reemplazar ingrediente
          </Button>

          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-xs text-slate-400 mb-1">Cantidad</p>
              <Input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="input-field bg-transparent border-dashed text-center"
              />
            </div>
            <div className="pt-6 text-slate-300 text-sm">
              {selectedFood?.food_unit === 'unidades' ? 'ud' : 'g'}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-700/70 bg-slate-900/60 p-3">
              <p className="text-xs text-slate-400 mb-1">Macros originales</p>
              <div className="space-y-1 text-sm">
                <p className="text-orange-300">Kcal: {Math.round(originalMacros.calories || 0)}</p>
                <p className="text-red-300">Prot: {Math.round(originalMacros.proteins || 0)}g</p>
                <p className="text-yellow-300">Carbs: {Math.round(originalMacros.carbs || 0)}g</p>
                <p className="text-green-300">Grasas: {Math.round(originalMacros.fats || 0)}g</p>
              </div>
            </div>
            <div className="rounded-lg border border-cyan-700/60 bg-cyan-900/20 p-3">
              <p className="text-xs text-cyan-300 mb-1">Macros actualizadas</p>
              <div className="space-y-1 text-sm">
                <p className="text-orange-300">Kcal: {Math.round(updatedMacros.calories || 0)}</p>
                <p className="text-red-300">Prot: {Math.round(updatedMacros.proteins || 0)}g</p>
                <p className="text-yellow-300">Carbs: {Math.round(updatedMacros.carbs || 0)}g</p>
                <p className="text-green-300">Grasas: {Math.round(updatedMacros.fats || 0)}g</p>
              </div>
            </div>
          </div>

          {(selectedVitamins.length > 0 || selectedMinerals.length > 0) && (
            <div className="rounded-lg border border-slate-700/70 bg-slate-900/60 p-3">
              <p className="text-xs text-slate-400 mb-2">Vitaminas y Minerales</p>
              <div className="flex flex-wrap gap-2">
                {selectedVitamins.map((v) => (
                  <Badge key={`qv-${v.id}`} variant="outline" className="border-emerald-500/40 text-emerald-300 bg-emerald-900/20">
                    {v.name}{typeof v.mg_per_100g === 'number' ? ` (${v.mg_per_100g} mg/100g)` : ''}
                  </Badge>
                ))}
                {selectedMinerals.map((m) => (
                  <Badge key={`qm-${m.id}`} variant="outline" className="border-sky-500/40 text-sky-300 bg-sky-900/20">
                    {m.name}{typeof m.mg_per_100g === 'number' ? ` (${m.mg_per_100g} mg/100g)` : ''}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <Button
            type="button"
            className="w-full bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-500 hover:to-teal-500"
            onClick={() => onSave({
              quantity: safeQty,
              food: selectedFood
            })}
          >
            Cambiar alimento
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const RecipeView = ({
  recipe,
  allFoods,
  allVitamins,
  allMinerals,
  allFoodGroups,
  macros: totalMacros,
  isFreeMealView = false,
  conflicts: propConflicts,
  recommendations: propRecommendations,
  userRestrictions: propUserRestrictions,
  isEditing = false,
  onFormChange,
  onIngredientsChange,
  onRemoveIngredient,
  onAddIngredientClick,
  actionButton,
  mealTargetMacros,
  disableAutoBalance = false,
  enableStickyMacros = true,
  headerSlot = null,
  isTemplate = false, // New prop
  quickEditIngredientKey = null,
  onQuickEditConsumed
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [internalRestrictions, setInternalRestrictions] = useState(null);
  const [loadingRestrictions, setLoadingRestrictions] = useState(false);
  const [isBalancing, setIsBalancing] = useState(false);
  const [fetchedTargets, setFetchedTargets] = useState(null);
  const [replacingIngredient, setReplacingIngredient] = useState(null);
  const [quantityEditorIngredient, setQuantityEditorIngredient] = useState(null);

  const recipeImageUrl = useMemo(() => {
    if (!recipe) return null;
    return (
      recipe.img_url ||
      recipe.image_url ||
      recipe.recipe?.img_url ||
      recipe.recipe?.image_url ||
      recipe.recipe?.recipe?.img_url ||
      recipe.recipe?.recipe?.image_url ||
      null
    );
  }, [recipe]);

  // Fetch targets
  useEffect(() => {
    if (mealTargetMacros || !isEditing || !user || !recipe?.day_meal_id || isTemplate) return;

    const fetchTargets = async () => {
      try {
        const { data, error } = await supabase
          .from('user_day_meals')
          .select('target_calories, target_proteins, target_carbs, target_fats')
          .eq('user_id', user.id)
          .eq('day_meal_id', recipe.day_meal_id)
          .limit(1)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching meal targets:', error);
        } else if (data) {
          setFetchedTargets(data);
        }
      } catch (err) {
        console.error('Error fetching targets:', err);
      }
    };

    fetchTargets();
  }, [mealTargetMacros, isEditing, user, recipe, isTemplate]);

  // Fetch restrictions
  useEffect(() => {
    if (propConflicts || propUserRestrictions || !user) return;

    const fetchRestrictions = async () => {
      setLoadingRestrictions(true);
      try {
        const [sensRes, condRes, indRes, prefRes, nonPrefRes] = await Promise.all([
          supabase.from('user_sensitivities').select('sensitivity:sensitivities(id, name)').eq('user_id', user.id),
          supabase.from('user_medical_conditions').select('condition:medical_conditions(id, name)').eq('user_id', user.id),
          supabase.from('user_individual_food_restrictions').select('food(id, name)').eq('user_id', user.id),
          supabase.from('preferred_foods').select('food(id, name)').eq('user_id', user.id),
          supabase.from('non_preferred_foods').select('food(id, name)').eq('user_id', user.id),
        ]);

        setInternalRestrictions({
          sensitivities: (sensRes.data || []).map(s => s.sensitivity).filter(Boolean),
          medical_conditions: (condRes.data || []).map(c => c.condition).filter(Boolean),
          individual_food_restrictions: (indRes.data || []).map(i => i.food).filter(Boolean),
          preferred_foods: (prefRes.data || []).map(p => p.food).filter(Boolean),
          non_preferred_foods: (nonPrefRes.data || []).map(np => np.food).filter(Boolean),
        });
      } catch (err) {
        console.error("Error fetching user restrictions for recipe view:", err);
      } finally {
        setLoadingRestrictions(false);
      }
    };

    fetchRestrictions();
  }, [user, propConflicts, propUserRestrictions]);

  const { conflicts, recommendations } = useMemo(() => {
    const hasGranularPropConflicts = Array.isArray(propConflicts)
      && propConflicts.some(c => c && c.foodId !== undefined && c.foodId !== null);

    if (hasGranularPropConflicts) {
      return { conflicts: propConflicts, recommendations: propRecommendations || [] };
    }
    const activeRestrictions = propUserRestrictions || internalRestrictions;
    if (!activeRestrictions || !recipe || !recipe.ingredients) return { conflicts: [], recommendations: [] };

    const cList = [];
    const rList = [];

    recipe.ingredients.forEach(ing => {
      let food = ing.food;
      if (!food && allFoods) {
        const foodId = ing.food_id;
        food = allFoods.find(f => String(f.id) === String(foodId));
      }

      if (food && allFoods) {
        const foodId = food.id;
        const fullFood = allFoods.find(f => String(f.id) === String(foodId));
        if (fullFood) {
          food = fullFood;
        }
      }

      if (!food) return;

      const info = getConflictInfo(food, activeRestrictions);
      if (info) {
        if (['condition_avoid', 'sensitivity', 'individual_restriction', 'non-preferred'].includes(info.type) || info.type === 'condition_avoid') {
          let type = info.type;
          if (info.type === 'individual_restriction') type = 'condition_avoid';

          cList.push({
            foodId: food.id,
            type: type,
            restrictionName: info.reason
          });
        } else if (['condition_recommend', 'preferred'].includes(info.type)) {
          rList.push({
            foodId: food.id,
            restrictionName: info.reason
          });
        }
      }
    });
    return { conflicts: cList, recommendations: rList };
  }, [recipe, propConflicts, propRecommendations, propUserRestrictions, internalRestrictions, allFoods]);

  const getConflictTypeForFood = (food) => {
    if (!food || !conflicts) return null;
    const avoidConflict = conflicts.find(c => c.foodId === food.id && (c.type === 'condition_avoid' || c.type === 'sensitivity' || c.type === 'non-preferred'));
    if (avoidConflict) return avoidConflict.type;
    const recommendation = recommendations.find(r => r.foodId === food.id);
    if (recommendation) return 'condition_recommend';
    return null;
  };

  const ingredientsWithDetails = useMemo(() => {
    if (!recipe || !recipe.ingredients || !allFoods || !allVitamins || !allMinerals) return [];
    return recipe.ingredients.map((ing, originalIndex) => {
        let food = ing.food;
        if (!food && allFoods) {
            const foodId = ing.food_id;
            food = allFoods.find(f => String(f.id) === String(foodId));
        }
        if (food && allFoods) {
            const foodId = food.id;
            const fullFood = allFoods.find(f => String(f.id) === String(foodId));
            if (fullFood) food = fullFood;
        }
        if (!food) return null;
        
        const qty = (ing.grams !== undefined && ing.grams !== null && ing.grams !== '') ? Number(ing.grams) : 0;
        const ingredientWithFood = { ...ing, food, quantity: qty };
        const ingredientMacros = calculateMacros([ingredientWithFood], allFoods);
        const vitamins = (food.food_vitamins || [])
          .map((fv) => {
            const vitaminData = allVitamins.find(v => v.id === (fv.vitamin_id || fv.vitamin?.id));
            if (!vitaminData) return null;
            return {
              ...vitaminData,
              mg_per_100g: typeof fv.mg_per_100g === 'number' ? fv.mg_per_100g : null
            };
          })
          .filter(Boolean);
        const minerals = (food.food_minerals || [])
          .map((fm) => {
            const mineralData = allMinerals.find(m => m.id === (fm.mineral_id || fm.mineral?.id));
            if (!mineralData) return null;
            return {
              ...mineralData,
              mg_per_100g: typeof fm.mg_per_100g === 'number' ? fm.mg_per_100g : null
            };
          })
          .filter(Boolean);
        const foodConflicts = conflicts.filter(c => c.foodId === food.id);
        const foodRecommendations = recommendations.filter(r => r.foodId === food.id);
        const conflictType = getConflictTypeForFood(food);
        const foodGroupId = food.food_to_food_groups?.[0]?.food_group?.id || ing.food_group_id || null;

        return {
            ...ing,
            originalIndex,
            food,
            macros: ingredientMacros,
            vitamins,
            minerals,
            quantity: (ing.grams !== undefined && ing.grams !== null) ? ing.grams : ing.quantity,
            conflictType,
            conflictDetails: foodConflicts,
            recommendationDetails: foodRecommendations,
            food_group_id: foodGroupId,
        };
    }).filter(Boolean);
  }, [recipe, allFoods, allVitamins, allMinerals, conflicts, recommendations]);

  const groupedAndSortedIngredients = useMemo(() => {
    return [...ingredientsWithDetails].sort((a, b) => {
      const nameA = a.food?.name || '';
      const nameB = b.food?.name || '';
      return nameA.localeCompare(nameB, 'es', { sensitivity: 'base' });
    });
  }, [ingredientsWithDetails]);

  useEffect(() => {
    if (!quickEditIngredientKey || !groupedAndSortedIngredients.length) return;
    const target = groupedAndSortedIngredients.find(
      (ing) => String(ing.local_id || ing.id) === String(quickEditIngredientKey)
    );
    if (target) {
      setQuantityEditorIngredient(target);
      if (onQuickEditConsumed) onQuickEditConsumed();
    }
  }, [quickEditIngredientKey, groupedAndSortedIngredients, onQuickEditConsumed]);

  const handleQuantityChange = (ingredient, newQuantity) => {
    const targetIndex = ingredient.originalIndex;
    if (targetIndex !== undefined && targetIndex !== null) {
        const newIngredients = [...recipe.ingredients];
        if (newIngredients[targetIndex]) {
            newIngredients[targetIndex] = { ...newIngredients[targetIndex], grams: newQuantity, quantity: newQuantity };
            onIngredientsChange(newIngredients);
        }
    } else {
        const identifier = ingredient.local_id || ingredient.id;
        const newIngredients = recipe.ingredients.map(ing =>
          (ing.local_id || ing.id) === identifier ? { ...ing, grams: newQuantity, quantity: newQuantity } : ing
        );
        onIngredientsChange(newIngredients);
    }
  };

  const handleAutoBalance = async () => {
    const activeTargets = mealTargetMacros || fetchedTargets;
    if (!activeTargets || [activeTargets.target_proteins, activeTargets.target_carbs, activeTargets.target_fats].some(t => t === 0 || t === null || t === undefined)) {
      toast({ title: 'Objetivos no definidos', description: 'No se encontraron objetivos de macros válidos.', variant: 'destructive' });
      return;
    }
    setIsBalancing(true);
    try {
        const ingredientsForFunction = recipe.ingredients.map(ing => ({
            food_id: Number(ing.food_id || ing.food?.id),
            quantity: Number(ing.grams || ing.quantity) || 0,
        })).filter(ing => ing.food_id);

        const data = await invokeAutoBalanceRecipe({
            ingredients: ingredientsForFunction,
            targets: activeTargets,
        });
        if (data.balancedIngredients) {
            const newIngredients = recipe.ingredients.map(ing => {
                const balanced = data.balancedIngredients.find(b => String(b.food_id) === String(ing.food_id || ing.food?.id));
                if (balanced) return { ...ing, grams: balanced.quantity, quantity: balanced.quantity };
                return ing;
            });
            onIngredientsChange(newIngredients);
            toast({ title: '¡Receta autocuadrada!', description: 'Se han ajustado las cantidades.', className: "bg-cyan-600/25 text-white border-none backdrop-blur-md" });
        } else {
            throw new Error(data.error || 'Respuesta inesperada.');
        }
    } catch (error) {
        console.error("Auto-balance error:", error);
        toast({ title: 'Error al autocuadrar', description: error.message, variant: 'destructive' });
    } finally {
        setIsBalancing(false);
    }
  };

  const handleQuickEditSave = ({ quantity, food }) => {
    if (!quantityEditorIngredient) return;
    const hasFoodChanged = food && String(food.id) !== String(quantityEditorIngredient.food_id || quantityEditorIngredient.food?.id);
    if (!hasFoodChanged) {
      handleQuantityChange(quantityEditorIngredient, quantity);
      setQuantityEditorIngredient(null);
      return;
    }

    const replacementIngredient = {
      local_id: crypto.randomUUID(),
      food_id: food.id,
      grams: quantity,
      quantity: quantity,
      food_group_id: food?.food_to_food_groups?.[0]?.food_group_id || null,
      food
    };
    const targetIndex = quantityEditorIngredient.originalIndex;
    if (targetIndex !== undefined && targetIndex !== null && recipe.ingredients[targetIndex]) {
      const newIngredients = [...recipe.ingredients];
      newIngredients[targetIndex] = replacementIngredient;
      onIngredientsChange(newIngredients);
    } else {
      const identifier = quantityEditorIngredient.local_id || quantityEditorIngredient.id;
      const newIngredients = recipe.ingredients.map((ing) =>
        (ing.local_id || ing.id) === identifier ? replacementIngredient : ing
      );
      onIngredientsChange(newIngredients);
    }
    toast({ title: 'Ingrediente actualizado', description: `Se cambió por ${food.name}.` });
    setQuantityEditorIngredient(null);
  };

  const handleReplaceSelection = (newFoodData) => {
    if (!replacingIngredient) return;
    const newIngredient = {
      local_id: crypto.randomUUID(),
      food_id: newFoodData.food_id,
      grams: newFoodData.quantity || 100,
      quantity: newFoodData.quantity || 100,
      food_group_id: allFoods?.find(f => String(f.id) === String(newFoodData.food_id))?.food_to_food_groups?.[0]?.food_group_id || null,
    };
    const targetIndex = replacingIngredient.originalIndex;
    if (targetIndex !== undefined && targetIndex !== null && recipe.ingredients[targetIndex]) {
        const newIngredients = [...recipe.ingredients];
        newIngredients[targetIndex] = newIngredient;
        onIngredientsChange(newIngredients);
    } else {
        const identifier = replacingIngredient.local_id || replacingIngredient.id;
        const newIngredients = recipe.ingredients.map(ing =>
          (ing.local_id || ing.id) === identifier ? newIngredient : ing
        );
        onIngredientsChange(newIngredients);
    }
    setReplacingIngredient(null);
    toast({ title: "Ingrediente reemplazado", description: `Se ha sustituido por ${newFoodData.food_name}.` });
  };

  const greenCount = recommendations.length;
  const redCount = conflicts.length;
  const showAutoBalance = isEditing && recipe.ingredients?.length > 0 && (mealTargetMacros || recipe.day_meal_id) && !disableAutoBalance;
  const canManageIngredientsInView = !!onIngredientsChange && !!onRemoveIngredient;

  if (replacingIngredient) {
    return (
      <div className="h-full p-4 md:p-6">
        <IngredientSearch
          selectedIngredients={recipe.ingredients}
          onIngredientAdded={handleReplaceSelection}
          availableFoods={allFoods}
          userRestrictions={propUserRestrictions || internalRestrictions}
          onBack={() => setReplacingIngredient(null)}
        />
      </div>
    );
  }

  if (!recipe) return null;
  if (loadingRestrictions) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-sky-500" /></div>;

  return (
    <div className="text-white space-y-6 p-2 sm:p-4 md:p-6">
      <div className="text-center mt-6 relative z-10">
        {recipeImageUrl && (
          <div className="mb-4 overflow-hidden rounded-xl border border-slate-700/70 bg-slate-900/70">
            <img
              src={recipeImageUrl}
              alt={`Imagen de ${recipe.name || 'receta'}`}
              className="w-full h-44 sm:h-56 object-cover"
              loading="lazy"
            />
          </div>
        )}
        {isEditing ? (
          <EditableField
            value={recipe.name}
            onChange={(e) => onFormChange({ target: { name: 'name', value: e.target.value } })}
            isEditing={isEditing}
            placeholder="Nombre de la Receta"
            className="text-3xl font-bold leading-tight whitespace-pre-wrap break-normal resize-none text-center w-full"
            autoGrow
          />
        ) : (
          <>
            <h2 className="text-3xl font-bold text-center break-words bg-clip-text text-transparent bg-gradient-to-r from-green-300 to-teal-400">
              {recipe.name}
            </h2>
            <div className="flex justify-center gap-3 mt-2">
              {greenCount > 0 && (
                <span className="flex items-center text-sm text-green-400 gap-1.5 bg-green-900/20 px-2 py-1 rounded-full border border-green-500/30">
                  <ThumbsUp className="w-4 h-4" /> {greenCount} Recomendados
                </span>
              )}
              {redCount > 0 && (
                <span className="flex items-center text-sm text-red-400 gap-1.5 bg-red-900/20 px-2 py-1 rounded-full border border-red-500/30">
                  <AlertTriangle className="w-4 h-4" /> {redCount} Conflictos
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {isTemplate && (
        <div className="flex justify-center -mt-2 mb-4 relative z-10">
            <Badge variant="outline" className="border-purple-500 text-purple-400 bg-purple-900/20">
                Modo Plantilla
            </Badge>
        </div>
      )}

      {headerSlot && (
        <div className="relative z-10">
          {headerSlot}
        </div>
      )}

      <div className={cn("grid grid-cols-2 gap-4 rounded-lg relative z-10", isEditing ? "sm:p-0.5" : "p-3 bg-slate-800/50")}>
        <div className="flex items-center gap-1 sm:gap-3">
          {!isEditing && <ChefHat className="w-5 h-5 text-gray-400" />}
          <span className="font-semibold text-gray-200">Dificultad:</span>
          <EditableField
            value={recipe.difficulty}
            onChange={(value) => onFormChange({ target: { name: 'difficulty', value } })}
            isEditing={isEditing}
            placeholder="No especificada"
            type="select"
            options={[{ value: 'Fácil', label: 'Fácil' }, { value: 'Media', label: 'Media' }, { value: 'Difícil', label: 'Difícil' }]}
            className={isEditing ? "py-1 pr-1 pl-2" : ""}
          />
        </div>
        <div className="flex items-center gap-1 sm:gap-3">
          {!isEditing && <Clock className="w-5 h-5 text-gray-400" />}
          <span className="font-semibold text-gray-200">Tiempo:</span>
          {isEditing ? (
            <div className="flex items-center">
              <Input
                type="number"
                value={recipe.prep_time_min}
                onChange={(e) => onFormChange({ target: { name: 'prep_time_min', value: e.target.value } })}
                className="input-field bg-transparent border-dashed w-20 text-center sm:p-0.5"
              />
              <span className="ml-2 text-gray-300">min</span>
            </div>
          ) : (
            <span className="text-gray-300">{recipe.prep_time_min ? `${recipe.prep_time_min} min` : 'N/A'}</span>
          )}
        </div>
      </div>

      <div className="relative z-10">
        <h3 className="text-xl font-semibold mb-3 border-b border-gray-700 pb-2 bg-clip-text text-transparent bg-gradient-to-r from-green-300 to-teal-400">Preparación</h3>
        <EditableField
          value={recipe.instructions}
          onChange={(e) => onFormChange({ target: { name: 'instructions', value: e.target.value } })}
          isEditing={isEditing}
          placeholder="Añade aquí las instrucciones..."
          type={isEditing ? "textarea" : "p"}
          className="text-gray-300 whitespace-pre-wrap"
        />
      </div>

      <div className={cn(enableStickyMacros && "sticky top-0 bg-[#0C101D] -mx-2 px-2 sm:-mx-4 sm:px-4 md:-mx-6 md:px-6 py-2 shadow-xl border-b border-gray-800/60 mb-4", "z-30")}>
        <h3 className="text-xl font-semibold mb-3 border-b border-gray-700 pb-2 bg-clip-text text-transparent bg-gradient-to-r from-green-300 to-teal-400">Macros Totales</h3>
        {renderTotalMacros(totalMacros, true)}
        {isEditing && (mealTargetMacros || fetchedTargets) && !isTemplate && (
          <div className="mt-4">
            <h4 className="text-sm font-semibold text-gray-400 mb-2 uppercase tracking-wider">Macros Objetivo (Límite)</h4>
            {renderTargetMacros(mealTargetMacros || fetchedTargets)}
          </div>
        )}
      </div>

      {actionButton && <div className="my-4 relative z-10">{actionButton}</div>}

      <div className="relative z-10">
        <div className="flex justify-between items-center mb-3 border-b border-gray-700 pb-2">
          <h3 className="text-xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-green-300 to-teal-400">Ingredientes</h3>
          {onAddIngredientClick && (
            <Button variant="ghost" size="icon" onClick={onAddIngredientClick} className="text-green-400 hover:bg-green-500/10 hover:text-green-300">
              <PlusCircle className="w-6 h-6" />
            </Button>
          )}
        </div>
        <div className="space-y-4">
          {isEditing ? (
            groupedAndSortedIngredients.length > 0 ? (
              <div className="space-y-3">
                {groupedAndSortedIngredients.map((ing, index) => (
                  <IngredientCard
                    key={ing.local_id || `${ing.food_id}-${index}`}
                    ingredient={ing}
                    isFreeMealView={isFreeMealView}
                    isEditing={isEditing}
                    onRemove={() => onRemoveIngredient(ing)}
                    onReplace={() => setReplacingIngredient(ing)}
                    onQuantityChange={(e) => handleQuantityChange(ing, e.target.value)}
                    allFoodGroups={allFoodGroups}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-10 border-2 border-dashed border-gray-700 rounded-lg">
                <p className="text-gray-500">No hay ingredientes en esta receta.</p>
                {isEditing && <p className="text-gray-500 mt-2">Haz clic en el <PlusCircle className="inline w-4 h-4 mx-1" /> para añadir el primero.</p>}
              </div>
            )
          ) : (
            <ul className="space-y-0">
              {groupedAndSortedIngredients.length > 0 ? (
                groupedAndSortedIngredients.map((ing, index) => (
                  <IngredientCard
                    key={ing.local_id || `${ing.food_id}-${index}`}
                    ingredient={ing}
                    isFreeMealView={isFreeMealView}
                    isEditing={isEditing}
                    displayAsBullet={true}
                    allFoodGroups={allFoodGroups}
                    onRemove={canManageIngredientsInView ? () => onRemoveIngredient(ing) : undefined}
                    onReplace={canManageIngredientsInView ? () => setReplacingIngredient(ing) : undefined}
                    onQuickEdit={canManageIngredientsInView ? () => setQuantityEditorIngredient(ing) : undefined}
                  />
                ))
              ) : (
                <div className="text-center py-10 border-2 border-dashed border-gray-700 rounded-lg">
                  <p className="text-gray-500">No hay ingredientes en esta receta.</p>
                </div>
              )}
            </ul>
          )}

          {showAutoBalance && (mealTargetMacros || fetchedTargets) && (
            <div className="mt-4 pt-2 border-t border-gray-800">
              <Button
                type="button"
                onClick={handleAutoBalance}
                disabled={isBalancing || disableAutoBalance}
                variant="outline"
                className="w-full bg-slate-800 border-cyan-500 text-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-300 mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isBalancing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Bot className="w-4 h-4 mr-2" />}
                Autocuadrar Macros
              </Button>
            </div>
          )}
        </div>
      </div>

      <IngredientQuickEditDialog
        open={!!quantityEditorIngredient}
        ingredient={quantityEditorIngredient}
        allFoods={allFoods}
        allVitamins={allVitamins}
        allMinerals={allMinerals}
        selectedIngredients={recipe?.ingredients || []}
        userRestrictions={propUserRestrictions || internalRestrictions}
        onOpenChange={(isOpen) => {
          if (!isOpen) setQuantityEditorIngredient(null);
        }}
        onSave={handleQuickEditSave}
      />
    </div>
  );
};

export default RecipeView;
