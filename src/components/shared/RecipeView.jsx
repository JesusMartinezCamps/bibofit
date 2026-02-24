
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { calculateMacros } from '@/lib/macroCalculator';
import CaloriesIcon from '@/components/icons/CaloriesIcon';
import ProteinIcon from '@/components/icons/ProteinIcon';
import CarbsIcon from '@/components/icons/CarbsIcon';
import FatsIcon from '@/components/icons/FatsIcon';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sparkles, ShieldAlert, CheckCircle2, Clock, ChefHat, X, PlusCircle, AlertTriangle, Loader2, ThumbsUp, Bot, ArrowRightLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { getConflictInfo } from '@/lib/restrictionChecker.js';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import IngredientSearch from '@/components/plans/IngredientSearch';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';

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
  onQuantityChange,
  displayAsBullet = false,
  allFoodGroups,
  isOpen,
  onOpenChange,
  popoverId
}) => {
  const { food, quantity, macros, vitamins, minerals, conflictType, conflictDetails, recommendationDetails } = ingredient;
  const [popoverOpen, setPopoverOpen] = useState(false);
  const triggerRef = useRef(null);

  const effectiveOpen = displayAsBullet ? !!isOpen : popoverOpen;

  const handlePopoverOpenChange = (open) => {
    if (displayAsBullet && onOpenChange) {
      onOpenChange(popoverId, open);
    } else {
      setPopoverOpen(open);
    }
  };

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

  if (displayAsBullet) {
    const baseMacros = {
      calories: 0,
      proteins: parseFloat(food.proteins || 0),
      carbs: parseFloat(food.total_carbs || 0),
      fats: parseFloat(food.total_fats || 0)
    };
    baseMacros.calories = (baseMacros.proteins * 4) + (baseMacros.carbs * 4) + (baseMacros.fats * 9);
    const baseUnitLabel = food.food_unit === 'unidades' ? 'por unidad' : 'por 100g';

    const hasConflict = ['condition_avoid', 'sensitivity', 'non-preferred'].includes(conflictType);
    const isRecommended = ['condition_recommend', 'preferred'].includes(conflictType);

    return (
      <li className="border-b border-slate-800/50 last:border-0 relative">
        <Popover open={effectiveOpen} onOpenChange={handlePopoverOpenChange}>
          <PopoverTrigger asChild>
            <div
              ref={triggerRef}
              className="flex items-center justify-between text-sm py-2 hover:bg-slate-800/20 rounded-sm transition-colors cursor-pointer w-full group relative z-50"
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <div className="flex items-center min-w-0 mr-4 w-[90%]">
                <div className={cn("w-1.5 h-1.5 rounded-full mr-3 flex-shrink-0 transition-colors",
                  hasConflict ? "bg-red-500" : (isRecommended ? "bg-green-500" : "bg-slate-600 group-hover:bg-green-400")
                )} />
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
          </PopoverTrigger>
          <PopoverContent
            className="w-80 text-white p-4 z-[10050] shadow-xl shadow-black/50 border-slate-700/50 relative"
            style={{ backgroundColor: 'rgb(10 19 31 / 95%)' }}
            onInteractOutside={(e) => {
              if (triggerRef.current && triggerRef.current.contains(e.target)) {
                e.preventDefault();
              }
            }}
          >
            <div className="flex flex-col gap-3">
              <div>
                <h4 className="font-bold text-lg leading-tight bg-clip-text text-transparent bg-gradient-to-r from-green-300 to-teal-400">{food.name}</h4>
                <p className="text-xs text-gray-400 mt-1">Grupo: <span className="text-gray-300">{foodGroupName}</span></p>

                {hasConflict && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-red-400 text-xs font-medium animate-in fade-in">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{conflictDetails.map(c => c.restrictionName).join(', ')}</span>
                  </div>
                )}
                {isRecommended && getStatusDisplay(conflictType, conflictDetails, recommendationDetails)}

                <div className="mt-2 bg-slate-800/50 p-2 rounded-md border border-slate-700/30">
                  <p className="text-[10px] text-gray-400 mb-1 uppercase tracking-wider font-semibold">Macros {baseUnitLabel}</p>
                  {renderMacros(baseMacros, false, false, false, true, true)}
                </div>
              </div>
              <div className="h-px bg-slate-700/50" />
              <div>
                <p className="text-xs font-semibold text-purple-300 uppercase tracking-wider mb-2">Micronutrientes</p>
                {(vitamins.length > 0 || minerals.length > 0) ? (
                  <div className="flex flex-wrap gap-1.5">
                    {vitamins.map(v => <NutrientBadge key={`v-${v.id}`} nutrient={v} />)}
                    {minerals.map(m => <NutrientBadge key={`m-${m.id}`} nutrient={m} />)}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 italic">No hay datos registrados.</p>
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </li>
    );
  }

  const hasConflict = ['condition_avoid', 'sensitivity', 'non-preferred'].includes(conflictType);

  return (
    <div data-ingredient-food-id={food.id} className={cn("relative p-3 rounded-lg border transition-all duration-300", statusColorClasses.split(' ').filter(c => c.startsWith('bg-') || c.startsWith('border-')))}>
      {isEditing && (
        <>
          <button onClick={onReplace} className="absolute -top-2 -left-2 bg-blue-600/90 text-white rounded-full p-1 transition-opacity hover:bg-blue-500 z-10 shadow-lg" title="Reemplazar ingrediente">
            <ArrowRightLeft className="w-4 h-4" />
          </button>
          <button onClick={onRemove} className="absolute -top-2 -right-2 bg-red-600/90 text-white rounded-full p-1 transition-opacity hover:bg-red-500 z-10 shadow-lg" title="Eliminar ingrediente">
            <X className="w-4 h-4" />
          </button>
        </>
      )}

      {isEditing ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center">
            <div className={cn("w-3/5 flex flex-col justify-center transition-all", isEditing && "pl-3")}>
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
  isTemplate = false // New prop
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [internalRestrictions, setInternalRestrictions] = useState(null);
  const [loadingRestrictions, setLoadingRestrictions] = useState(false);
  const [isBalancing, setIsBalancing] = useState(false);
  const [fetchedTargets, setFetchedTargets] = useState(null);
  const [replacingIngredient, setReplacingIngredient] = useState(null);
  const [openIngredientPopoverId, setOpenIngredientPopoverId] = useState(null);

  const recipeIdentity = useMemo(() => {
    if (!recipe) return null;
    return (
      recipe.id ??
      recipe.diet_plan_recipe_id ??
      recipe.dietPlanRecipeId ??
      recipe.recipe_id ??
      recipe.private_recipe_id ??
      recipe.name ??
      null
    );
  }, [recipe]);

  useEffect(() => {
    setOpenIngredientPopoverId(null);
  }, [isEditing, recipeIdentity]);

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
        const foodId = ing.food_id || ing.user_created_food_id;
        const isUserCreated = !!ing.user_created_food_id;
        food = allFoods.find(f => String(f.id) === String(foodId) && f.is_user_created === isUserCreated);
      }

      if (food && allFoods) {
        const foodId = food.id;
        const isUserCreated = !!(food.is_user_created || ing.user_created_food_id);
        const fullFood = allFoods.find(f => String(f.id) === String(foodId) && f.is_user_created === isUserCreated);
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
            const foodId = ing.food_id || ing.user_created_food_id;
            const isUserCreated = !!ing.user_created_food_id;
            food = allFoods.find(f => String(f.id) === String(foodId) && f.is_user_created === isUserCreated);
        }
        if (food && allFoods) {
            const foodId = food.id;
            const isUserCreated = !!(food.is_user_created || ing.user_created_food_id);
            const fullFood = allFoods.find(f => String(f.id) === String(foodId) && f.is_user_created === isUserCreated);
            if (fullFood) food = fullFood;
        }
        if (!food) return null;
        
        const qty = (ing.grams !== undefined && ing.grams !== null && ing.grams !== '') ? Number(ing.grams) : 0;
        const ingredientWithFood = { ...ing, food, quantity: qty };
        const ingredientMacros = calculateMacros([ingredientWithFood], allFoods);
        const vitamins = food.food_vitamins?.map(fv => allVitamins.find(v => v.id === (fv.vitamin_id || fv.vitamin?.id))).filter(Boolean) || [];
        const minerals = food.food_minerals?.map(fm => allMinerals.find(m => m.id === (fm.mineral_id || fm.mineral?.id))).filter(Boolean) || [];
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

  const handleIngredientPopoverChange = (id, open) => {
    setOpenIngredientPopoverId(open ? id : null);
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
            food_group_id: ing.food_group_id ? Number(ing.food_group_id) : (
              ing.food?.food_to_food_groups?.[0]?.food_group?.id ||
              allFoods?.find(f => String(f.id) === String(ing.food_id || ing.food?.id))?.food_to_food_groups?.[0]?.food_group_id || null
            )
        })).filter(ing => ing.food_id);

        const { data, error } = await supabase.functions.invoke('auto-balance-macros', {
            body: { ingredients: ingredientsForFunction, targets: activeTargets, allFoods, allFoodGroups },
        });
        if (error) throw error;
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

  const handleReplaceSelection = (newFoodData) => {
    if (!replacingIngredient) return;
    const newIngredient = {
      local_id: crypto.randomUUID(),
      food_id: newFoodData.food_id,
      grams: newFoodData.quantity || 100,
      quantity: newFoodData.quantity || 100,
      food_group_id: allFoods?.find(f => String(f.id) === String(newFoodData.food_id))?.food_to_food_groups?.[0]?.food_group_id || null,
      is_user_created: newFoodData.is_user_created
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
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {openIngredientPopoverId && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="fixed inset-0 bg-black/70 z-[10000]"
              onClick={() => setOpenIngredientPopoverId(null)}
              style={{ pointerEvents: 'auto' }}
            />
          )}
        </AnimatePresence>,
        document.body
      )}

      <div className="text-center mt-6 relative z-10">
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
          {isEditing && (
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
                    popoverId={ing.local_id || `${ing.food_id}-${index}`}
                    isOpen={openIngredientPopoverId === (ing.local_id || `${ing.food_id}-${index}`)}
                    onOpenChange={handleIngredientPopoverChange}
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
                    popoverId={ing.local_id || `${ing.food_id}-${index}`}
                    isOpen={openIngredientPopoverId === (ing.local_id || `${ing.food_id}-${index}`)}
                    onOpenChange={handleIngredientPopoverChange}
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
    </div>
  );
};

export default RecipeView;
