import React, { useState, useMemo, useCallback } from 'react';
import RecipeCard from './RecipeCard';
import FreeRecipeCard from '@/components/plans/FreeRecipeCard';
import { Button } from '@/components/ui/button';
import { UtensilsCrossed, Utensils, ChevronDown, Apple, RotateCcw, Loader2, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseISO, isValid } from 'date-fns';
import MealTargetMacros from '@/components/shared/MealTargetMacros';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { calculateMacros } from '@/lib/macroCalculator';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';

const normalizeText = (text) => {
    return text
        ? text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
        : "";
};

const getAdjustmentsForRecipe = (dailyIngredientAdjustments, equivalenceAdjustments, recipeId, userDayMealId, logDate, isPrivate) => {
    if (!dailyIngredientAdjustments || !equivalenceAdjustments) return null;
    
    const eqAdjustment = equivalenceAdjustments.find(adj => adj.target_user_day_meal_id === userDayMealId && adj.log_date === logDate);
    if (!eqAdjustment) return null;

    const recipeAdjustments = dailyIngredientAdjustments.filter(dia => {
        return dia.equivalence_adjustment_id === eqAdjustment.id && 
               (isPrivate ? dia.private_recipe_id === recipeId : dia.diet_plan_recipe_id === recipeId);
    });
    
    return recipeAdjustments.length > 0 ? recipeAdjustments : null;
};

const MealHeader = React.memo(({ mealName, mealId, name, items, isAnyRecipeSelectedInMeal, isFreeRecipeSelected, isPrivateRecipeSelected, mealTargetData, mealAdjustment, handleUndoEquivalence, handleAddSnack, handleAddFreeMeal, hasSnacks }) => {
    const [isUndoLoading, setIsUndoLoading] = useState(false);
    const pluralize = (name) => {
        if (!name) return '';
        if (name.toLowerCase().endsWith('s')) return name;
        if (name.toLowerCase() === 'cena') return 'Cenas';
        if (name.toLowerCase() === 'comida') return 'Comidas';
        return `${name}s`;
    };

    const onUndoClick = async () => {
        setIsUndoLoading(true);
        await handleUndoEquivalence(mealAdjustment.source_daily_snack_log_id, mealAdjustment.id);
        setIsUndoLoading(false);
    }

    return (
         <div className="relative flex items-center justify-between flex-wrap gap-x-4 gap-y-2 select-none">
            {/* Invisible Clickable Div Covering Header */}
            <CollapsibleTrigger asChild>
                <div className="absolute inset-0 z-10 cursor-pointer rounded-lg" />
            </CollapsibleTrigger>

            {/* Name and Chevron - z-0 (under trigger) */}
            <div className="flex items-center gap-3 group">
                <h3 className={cn(
                    "text-xl font-bold", 
                    isAnyRecipeSelectedInMeal 
                        ? (isFreeRecipeSelected ? "text-[rgb(132,232,255)]" : "text-[rgb(158,255,211)]")
                        : "text-white"
                )}>{pluralize(mealName)}</h3>
                <ChevronDown className={cn(
                    "h-5 w-5 transition-transform duration-300 group-data-[state=open]:rotate-180", 
                    isAnyRecipeSelectedInMeal 
                        ? (isFreeRecipeSelected ? "text-[rgb(132,232,255)]" : "text-[rgb(158,255,211)]")
                        : "text-gray-400"
                )} />
            </div>
            
            {/* Right side content (Macros + Buttons) - z-20 pointer-events-none (above trigger) */}
            <div className="flex items-center justify-between flex-grow gap-2 relative z-20 pointer-events-none">
                {/* Macros - still pointer-events-none effectively, so clicks pass to trigger behind this div */}
                <div>
                    {mealTargetData ? (
                      <MealTargetMacros mealTargetMacros={mealTargetData} adjustment={mealAdjustment} />
                    ) : <div />}
                </div>

                {/* Buttons - restore pointer events so they are clickable */}
                <div className="flex items-center gap-2 pointer-events-auto">
                    {mealAdjustment && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button 
                                        size="icon" 
                                        variant="ghost" 
                                        className="h-7 w-7 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300 border border-blue-400" 
                                        style={{borderWidth: 'thin'}} 
                                        onClick={onUndoClick}
                                        disabled={isUndoLoading}
                                    >
                                        {isUndoLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <RotateCcw className="h-5 w-5" />}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent className="bg-blue-800 border-blue-600 text-white">
                                    <p>Deshacer Equivalencia</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                    <Button size="icon" variant="ghost" className={cn("h-7 w-7 text-orange-400 hover:bg-orange-500/10 hover:text-orange-300 border border-orange-400", hasSnacks && "bg-orange-300/25")} style={{borderWidth: 'thin'}} onClick={() => handleAddSnack(mealId, name)}>
                        <Apple className="h-5 w-5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300 border border-[#70a3f3]" style={{borderWidth: 'thin'}} onClick={() => handleAddFreeMeal(mealId, name)}>
                        <UtensilsCrossed className="h-5 w-5" />
                    </Button>
                </div>
            </div>
        </div>
    )
});

const ListView = ({
  groupedByMeal,
  isAdminView,
  user,
  allFoods,
  handleRecipeClick,
  handleRemoveRecipe,
  handleFreeMealClick,
  handleRemoveFreeMeal,
  handleAddFreeMeal,
  handleToggleMealSelection,
  selectedMealLogs,
  dailyIngredientAdjustments,
  equivalenceAdjustments,
  mealCounts,
  logDate,
  userRestrictions,
  userDayMeals,
  activePlan,
  handleAddSnack,
  handleUndoEquivalence
}) => {
  const [searchQueries, setSearchQueries] = useState({});
  const foodById = useMemo(() => {
    const map = new Map();
    (allFoods || []).forEach((food) => {
      map.set(food.id, food);
    });
    return map;
  }, [allFoods]);

  const restrictionSets = useMemo(() => {
    const sensitivities = new Set((userRestrictions?.sensitivities || []).map((s) => s.id));
    const conditions = new Set((userRestrictions?.medical_conditions || []).map((c) => c.id));
    const nonPreferred = new Set((userRestrictions?.non_preferred_foods || []).map((f) => f.id));
    const restricted = new Set((userRestrictions?.individual_food_restrictions || []).map((f) => f.id));

    return {
      sensitivities,
      conditions,
      nonPreferred,
      restricted,
      hasAny: sensitivities.size > 0 || conditions.size > 0 || nonPreferred.size > 0 || restricted.size > 0,
    };
  }, [userRestrictions]);

  const currentDate = parseISO(logDate);

  const mealHasSnacks = (items) => {
    if (!items || items.length === 0) return false;
    return items.some(item => item.type === 'snack');
  };

  const handleSearchChange = useCallback((mealId, query) => {
    setSearchQueries(prev => ({
      ...prev,
      [mealId]: query
    }));
  }, []);

  const filterItems = useCallback((items, query) => {
    if (!query) return items;
    const normalizedQuery = normalizeText(query);

    return items.filter(item => {
        // 1. Check Recipe Name
        const name = item.name || item.custom_name || item.recipe?.name || '';
        if (normalizeText(name).includes(normalizedQuery)) return true;

        // 2. Check Ingredients
        let ingredients = [];
        if (item.type === 'recipe') {
             ingredients = item.custom_ingredients?.length > 0 ? item.custom_ingredients : item.recipe?.recipe_ingredients;
        } else if (item.type === 'private_recipe' || item.is_private_recipe) {
             ingredients = item.private_recipe_ingredients;
        } else if (item.type === 'free_recipe') {
             ingredients = item.free_recipe_ingredients;
        } else if (item.type === 'snack') {
             ingredients = item.snack_ingredients;
        }

        if (ingredients && ingredients.length > 0) {
            return ingredients.some(ing => {
                const foodName = ing.food?.name || ing.user_created_food?.name || foodById.get(ing.food_id)?.name || '';
                return normalizeText(foodName).includes(normalizedQuery);
            });
        }

        return false;
    });
  }, [foodById]);

  if (!isValid(currentDate)) {
      return <div>Fecha inválida</div>;
  }

  return (
    <div className="space-y-4">
      {Object.entries(groupedByMeal).map(([mealName, { items, mealId, name }]) => {
        const snackCaloriesCache = new Map();
        const getSnackCalories = (snack) => {
          if (snackCaloriesCache.has(snack.occurrence_id)) return snackCaloriesCache.get(snack.occurrence_id);
          const calories = calculateMacros(snack.snack_ingredients, allFoods).calories;
          snackCaloriesCache.set(snack.occurrence_id, calories);
          return calories;
        };

        const sortedItems = [...items].sort((a, b) => {
          const isASnack = a.type === 'snack';
          const isBSnack = b.type === 'snack';

          if (isASnack && !isBSnack) return -1;
          if (!isASnack && isBSnack) return 1;

          if (isASnack && isBSnack) {
            if (a.isSelected && !b.isSelected) return -1;
            if (!a.isSelected && b.isSelected) return 1;
            if (a.isSelected && b.isSelected) {
              const caloriesA = getSnackCalories(a);
              const caloriesB = getSnackCalories(b);
              return caloriesB - caloriesA;
            }
            return 0;
          }

          const userDayMealId = mealId;
          const logKey = `${logDate}-${userDayMealId}`;
          const selectedLog = selectedMealLogs ? selectedMealLogs.get(logKey) : undefined;
          
          const isASelected = selectedLog?.dnd_id === a.dnd_id;
          const isBSelected = selectedLog?.dnd_id === b.dnd_id;
          
          if (isASelected && !isBSelected) return -1;
          if (!isASelected && isBSelected) return 1;

          const countA = mealCounts[a.dnd_id] || 0;
          const countB = mealCounts[b.dnd_id] || 0;

          if (countA !== countB) {
              return countB - countA;
          }
          
          return 0;
        });

        const filteredItems = filterItems(sortedItems, searchQueries[mealId] || '');

        const mealTargetData = userDayMeals?.find(udm => udm.id === mealId);
        const mealAdjustment = equivalenceAdjustments?.find(adj => adj.target_user_day_meal_id === mealId && adj.log_date === logDate);

        const selectedLogForMeal = selectedMealLogs ? selectedMealLogs.get(`${logDate}-${mealId}`) : undefined;
        const isFreeRecipeSelected = selectedLogForMeal?.dnd_id?.startsWith('free-');
        const isPrivateRecipeSelected = selectedLogForMeal?.dnd_id?.startsWith('private-');
        const isAnyRecipeSelectedInMeal = !!selectedLogForMeal;

        const hasSnacks = mealHasSnacks(items);

        return (
          <Collapsible key={mealId} className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/70 space-y-4 group">
             <MealHeader 
                mealName={mealName}
                mealId={mealId}
                name={name}
                items={items}
                isAnyRecipeSelectedInMeal={isAnyRecipeSelectedInMeal}
                isFreeRecipeSelected={isFreeRecipeSelected}
                isPrivateRecipeSelected={isPrivateRecipeSelected}
                mealTargetData={mealTargetData}
                mealAdjustment={mealAdjustment}
                handleUndoEquivalence={handleUndoEquivalence}
                handleAddSnack={handleAddSnack}
                handleAddFreeMeal={handleAddFreeMeal}
                hasSnacks={hasSnacks}
            />
            
            <CollapsibleContent>
                <div className="mb-4 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input 
                        type="text"
                        placeholder="Buscar receta o ingrediente..."
                        value={searchQueries[mealId] || ''}
                        onChange={(e) => handleSearchChange(mealId, e.target.value)}
                        className="pl-9 bg-slate-900/50 border-slate-700 text-sm w-full focus:ring-green-500/20 focus:border-green-500/50 text-white placeholder:text-gray-500 transition-all duration-200 h-10"
                />
                
                {searchQueries[mealId] && (
                  <button
                    onClick={() => handleSearchChange(mealId, '')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredItems.map(item => {
                    if (item.type === 'snack') {
                        return <div key={item.occurrence_id} className="h-full">{item.itemContent}</div>;
                    }

                    const userDayMealId = groupedByMeal[mealName].mealId;
                    const logKey = `${logDate}-${userDayMealId}`;
                    const selectedLog = selectedMealLogs ? selectedMealLogs.get(logKey) : undefined;
                    const isSelected = selectedLog?.dnd_id === item.dnd_id;
                    const selectionCount = mealCounts[item.dnd_id] || 0;
                    const isPending = item.changeRequest?.status === 'pending';
                    const isFreeRecipe = item.type === 'free_recipe';
                    const isPrivateRecipe = item.type === 'private_recipe' || item.is_private_recipe;
                    
                    const isSafe = (() => {
                        if (item.type === 'free_meal') return true;
                        if (!restrictionSets.hasAny) {
                            return true;
                        }
                        
                        let ingredients = [];
                        if (isPrivateRecipe) {
                            ingredients = item.private_recipe_ingredients || [];
                        } else {
                            ingredients = item.custom_ingredients?.length > 0 
                                ? item.custom_ingredients 
                                    : item.recipe?.recipe_ingredients || [];
                        }
                        
                        const unsafeFoodsSet = new Set();

                        ingredients.forEach(ing => {
                            const food = foodById.get(ing.food_id);
                            if (!food) return;
                            
                            if (restrictionSets.nonPreferred.has(food.id)) unsafeFoodsSet.add(food.name);
                            if (restrictionSets.restricted.has(food.id)) unsafeFoodsSet.add(food.name);

                            // ROBUST CHECK: Handle both direct ID and nested object
                            const foodSensitivityIds = new Set(food.food_sensitivities?.map(fs => fs.sensitivity?.id || fs.sensitivity_id).filter(Boolean) || []);
                            foodSensitivityIds.forEach(id => {
                                if (restrictionSets.sensitivities.has(id)) unsafeFoodsSet.add(food.name);
                            });

                            (food.food_medical_conditions || []).forEach(fmc => {
                              // ROBUST CHECK: Handle both direct ID and nested object
                              const condId = fmc.condition?.id || fmc.condition_id;
                              if (restrictionSets.conditions.has(condId) && (fmc.relation_type === 'to_avoid' || fmc.relation_type === 'evitar')) {
                                unsafeFoodsSet.add(food.name);
                              }
                            });
                        });
                        return unsafeFoodsSet.size === 0;
                    })();
    
                    const selectionIndicator = (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleMealSelection(item, currentDate);
                        }}
                        className={cn(
                          'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs transition-all duration-200 border',
                          isSelected && isPending ? 'bg-[rgba(195,55,204,0.1)] text-[rgb(195,55,204)] border-[rgb(195,55,204)]' :
                          isSelected && isFreeRecipe ? 'bg-[rgba(132,232,255,0.1)] text-[rgb(132,232,255)] border-[rgb(132,232,255)]' : 
                          isSelected ? 'bg-[rgba(158,255,211,0.1)] text-[rgb(158,255,211)] border-[rgb(158,255,211)]' : 
                          !isSafe ? 'bg-red-900/20 text-red-300 border-red-800/30 hover:border-red-700/50' :
                          'bg-gray-700/50 text-gray-400 border-gray-600/50 hover:border-gray-500/50'
                        )}
                        title={isSelected ? "Desmarcar como comida" : "Marcar como comida"}
                      >
                        <Utensils className={cn(
                            'w-4 h-4',
                            isSelected && isPending ? 'text-[rgb(195,55,204)]' :
                            isSelected && isFreeRecipe ? 'text-[rgb(132,232,255)]' : 
                            isSelected ? 'text-[rgb(158,255,211)]' : 
                            !isSafe ? 'text-red-500/70' :
                            'text-gray-500'
                        )} />
                        <span>{selectionCount}</span>
                      </button>
                    );
                    
                    const adjustmentsForThisCard = getAdjustmentsForRecipe(dailyIngredientAdjustments, equivalenceAdjustments, item.id, userDayMealId, logDate, isPrivateRecipe);

                    return (
                      <div key={item.dnd_id} className="h-full">
                        {item.type === 'recipe' || item.type === 'private_recipe' ? (
                          <RecipeCard
                            recipe={item}
                            user={user}
                            allFoods={allFoods}
                            handleRecipeClick={(...args) => handleRecipeClick(...args, currentDate)}
                            handleRemoveRecipe={(isAdminView || item.is_private_recipe || isPending) ? handleRemoveRecipe : null}
                            isListView={true}
                            adjustment={adjustmentsForThisCard}
                            userRestrictions={userRestrictions}
                            isAdminView={isAdminView}
                            selectionIndicator={selectionIndicator}
                            searchQuery={searchQueries[mealId] || ''}
                          />
                        ) : (
                          <FreeRecipeCard
                            freeMeal={item}
                            allFoods={allFoods}
                            handleCardClick={handleFreeMealClick}
                            handleRemove={() => handleRemoveFreeMeal(item.occurrence_id)}
                            isListView={true}
                            selectionIndicator={selectionIndicator}
                            searchQuery={searchQueries[mealId] || ''}
                          />
                        )}
                      </div>
                    )
                  })}
                  {filteredItems.length === 0 && (
                      <div className="md:col-span-2 lg:col-span-3">
                          <p className="text-sm text-gray-500 text-center italic py-4 bg-gray-900/40 rounded-lg">
                            {items.length > 0 ? "No se encontraron recetas con ese criterio." : "No hay recetas asignadas a esta comida."}
                          </p>
                      </div>
                  )}
                </div>
            </CollapsibleContent>
          </Collapsible>
        )
      })}
    </div>
  );
};

export default ListView;
