import React, { useMemo } from 'react';
import { X, Scale, Hourglass, ThumbsUp, AlertTriangle } from 'lucide-react';
import CaloriesIcon from '@/components/icons/CaloriesIcon';
import ProteinIcon from '@/components/icons/ProteinIcon';
import CarbsIcon from '@/components/icons/CarbsIcon';
import FatsIcon from '@/components/icons/FatsIcon';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { calculateMacros as calculateMacrosFromIngredients } from '@/lib/macroCalculator';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

const normalizeText = (text) => {
    return text
        ? text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
        : "";
};

const HighlightedText = ({ text, highlight }) => {
    if (!highlight || !text || !highlight.trim()) return text;

    const normalizedText = normalizeText(text);
    const normalizedHighlight = normalizeText(highlight);
    
    if (!normalizedText.includes(normalizedHighlight)) return text;

    if (normalizedText.length !== text.length) {
         return text; 
    }

    const matchIndices = [];
    let startIndex = 0;
    let searchIndex = normalizedText.indexOf(normalizedHighlight, startIndex);

    while (searchIndex !== -1) {
        matchIndices.push({ start: searchIndex, end: searchIndex + normalizedHighlight.length });
        startIndex = searchIndex + normalizedHighlight.length;
        searchIndex = normalizedText.indexOf(normalizedHighlight, startIndex);
    }

    if (matchIndices.length === 0) return text;

    const result = [];
    let lastIndex = 0;

    matchIndices.forEach((match, i) => {
        if (match.start > lastIndex) {
            result.push(<span key={`text-${i}`}>{text.substring(lastIndex, match.start)}</span>);
        }
        result.push(
            <span key={`highlight-${i}`} className="bg-yellow-500/40 text-yellow-100 font-bold rounded px-0.5 shadow-[0_0_10px_rgba(234,179,8,0.2)]">
                {text.substring(match.start, match.end)}
            </span>
        );
        lastIndex = match.end;
    });

    if (lastIndex < text.length) {
        result.push(<span key="text-end">{text.substring(lastIndex)}</span>);
    }

    return <>{result}</>;
};

const RecipeCard = ({
  recipe,
  user,
  allFoods = [], // Default to empty array to prevent find errors
  handleRecipeClick,
  handleRemoveRecipe,
  isListView = false,
  adjustment,
  userRestrictions,
  isAdminView,
  selectionIndicator,
  searchQuery = '',
  hideQuantities = false,
  hideMacros = false
}) => {
  const { toast } = useToast();
  
  const recipeName = useMemo(() => {
    if (!recipe) return "Receta Desconocida";
    if (recipe.is_private_recipe || recipe.type === 'private_recipe') {
      return recipe.name || "Receta Privada";
    }
    // Check all possible name fields to avoid "Receta" fallback if possible
    return recipe.custom_name || recipe.recipe?.name || recipe.name || "Receta";
  }, [recipe]);

  const recipeIngredients = useMemo(() => {
    if (!recipe) return [];
    if (recipe.is_private_recipe || recipe.type === 'private_recipe') {
      return recipe.private_recipe_ingredients || [];
    }
    // Prioritize custom_ingredients if they exist and are not empty.
    if (recipe.custom_ingredients && recipe.custom_ingredients.length > 0) {
        return recipe.custom_ingredients;
    }
    return recipe.recipe?.recipe_ingredients || recipe.recipe_ingredients || [];
  }, [recipe]);

  const adjustedIngredients = useMemo(() => {
    if (!recipeIngredients) return [];
    let ingredients = recipeIngredients.map(ing => ({
        food_id: ing.food_id,
        quantity: ing.grams || ing.quantity || 0,
        food: ing.food // Preserve nested food object if available
    }));
    
    if (adjustment) {
        return ingredients.map(ing => {
            const ingAdjustment = adjustment.find(adj => adj.food_id === ing.food_id);
            return {
                ...ing,
                quantity: ingAdjustment ? ingAdjustment.adjusted_grams : ing.quantity
            };
        });
    }
    return ingredients;
  }, [recipeIngredients, adjustment]);

  const { unsafeFoodsSet, recommendedFoodsSet } = useMemo(() => {
    const unsafe = new Set();
    const recommended = new Set();

    if (!userRestrictions || !adjustedIngredients) {
        return { unsafeFoodsSet: unsafe, recommendedFoodsSet: recommended };
    }
    
    const { sensitivities = [], medical_conditions = [], non_preferred_foods = [], individual_food_restrictions = [] } = userRestrictions;

    // Handle both object arrays (from planner) and ID arrays (from template view)
    const sensitivityIds = new Set(sensitivities.map(s => (typeof s === 'object' ? s.id : s)));
    const conditionIds = new Set(medical_conditions.map(c => (typeof c === 'object' ? c.id : c)));
    const nonPreferredIds = new Set(non_preferred_foods.map(f => (typeof f === 'object' ? f.id : f)));
    const restrictedIds = new Set(individual_food_restrictions.map(f => (typeof f === 'object' ? f.id : f)));

    if (sensitivityIds.size === 0 && conditionIds.size === 0 && nonPreferredIds.size === 0 && restrictedIds.size === 0) {
         return { unsafeFoodsSet: unsafe, recommendedFoodsSet: recommended };
    }

    adjustedIngredients.forEach(ing => {
        // Fallback to ingredient's embedded food object if not found in allFoods
        const food = allFoods.find(f => f.id === ing.food_id) || ing.food;
        if (!food) return;

        // Check Unsafe
        if (nonPreferredIds.has(food.id)) unsafe.add(food.name);
        if (restrictedIds.has(food.id)) unsafe.add(food.name);

        const foodSensitivityIds = new Set(food.food_sensitivities?.map(fs => fs.sensitivity?.id || fs.sensitivity_id).filter(Boolean) || []);
        foodSensitivityIds.forEach(s_id => {
            if (sensitivityIds.has(s_id)) unsafe.add(food.name);
        });

        (food.food_medical_conditions || []).forEach(fmc => {
            const condId = fmc.condition?.id || fmc.condition_id;
            if (conditionIds.has(condId)) {
                 if (fmc.relation_type === 'to_avoid' || fmc.relation_type === 'evitar') {
                    unsafe.add(food.name);
                 } else if (fmc.relation_type === 'recommended' || fmc.relation_type === 'recomendado' || fmc.relation_type === 'preferred') {
                    recommended.add(food.name);
                 }
            }
        });
    });

    return { unsafeFoodsSet: unsafe, recommendedFoodsSet: recommended };
  }, [adjustedIngredients, allFoods, userRestrictions]);

  const isSafe = unsafeFoodsSet.size === 0;

  const ingredientList = useMemo(() => {
    if (!adjustedIngredients || adjustedIngredients.length === 0) return [];
    return adjustedIngredients.map((ing, index) => {
        const food = allFoods.find(f => f.id === ing.food_id) || ing.food;
        if (!food) return null;
        
        let text = food.name;
        if (!hideQuantities) {
            const unit = food.food_unit === 'unidades' ? 'ud' : 'g';
            text = `${food.name} (${Math.round(ing.quantity || 0)}${unit})`;
        }
        
        const isUnsafe = unsafeFoodsSet.has(food.name);
        const isRecommended = recommendedFoodsSet.has(food.name);
        
        let className = "text-gray-400";
        if (isUnsafe) className = "text-red-400 font-medium";
        else if (isRecommended) className = "text-green-400 font-medium";
        
        return (
            <span key={ing.food_id || index} className={className}>
                <HighlightedText text={text} highlight={searchQuery} />
            </span>
        );
    }).filter(Boolean);
  }, [adjustedIngredients, allFoods, unsafeFoodsSet, recommendedFoodsSet, searchQuery, hideQuantities]);

  const macros = useMemo(() => {
    // Relaxed check: Calculate even if allFoods is missing, assuming ingredients have embedded food data
    if (!adjustedIngredients) {
      return { calories: 0, proteins: 0, carbs: 0, fats: 0 };
    }
    return calculateMacrosFromIngredients(adjustedIngredients, allFoods);
  }, [adjustedIngredients, allFoods]);

  if (!recipe) return null;

  const changeRequest = recipe.changeRequest;
  const isPending = changeRequest?.status === 'pending';
  const isPrivate = recipe.is_private_recipe || recipe.type === 'private_recipe';

  const macroDisplay = (
    <div className={cn(
        "flex items-center gap-x-3 gap-y-1 text-sm font-mono flex-wrap",
        isListView ? '' : 'justify-around mt-2 text-xs'
    )}>
      <span className={cn("flex items-center", adjustment ? "text-cyan-300" : "text-orange-400")} title="Calorías"><CaloriesIcon className="w-4 h-4 mr-1"/>{Math.round(macros.calories || 0)}</span>
      <span className={cn("flex items-center", adjustment ? "text-cyan-300" : "text-red-400")} title="Proteínas"><ProteinIcon className="w-4 h-4 mr-1"/>{Math.round(macros.proteins || 0)}g</span>
      <span className={cn("flex items-center", adjustment ? "text-cyan-300" : "text-yellow-400")} title="Carbohidratos"><CarbsIcon className="w-4 h-4 mr-1"/>{Math.round(macros.carbs || 0)}g</span>
      <span className={cn("flex items-center", adjustment ? "text-cyan-300" : "text-green-400")} title="Grasas"><FatsIcon className="w-4 h-4 mr-1"/>{Math.round(macros.fats || 0)}g</span>
    </div>
  );

  const TitleWithTooltip = ({ children }) => {
    if (isSafe || !isAdminView) {
      return children;
    }
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{children}</TooltipTrigger>
          <TooltipContent className="bg-red-900 border-red-700 text-white max-w-xs">
            <p className="font-bold mb-1">Conflicto de receta detectado</p>
            <p className="text-sm">Contiene: {Array.from(unsafeFoodsSet).join(', ')}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };
  
  if (isListView) {
    return (
      <div className="relative group h-full">
        <button onClick={() => handleRecipeClick && handleRecipeClick({ ...recipe, is_private_recipe: isPrivate }, adjustment)} className={cn(
            "w-full h-full text-left bg-gradient-to-br p-5 rounded-xl transition-all flex flex-col justify-between shadow-lg border",
            isPrivate ? 'from-slate-900 via-slate-900 to-violet-800/50' : (isPending ? 'from-[#411a40] to-slate-800/80' : 'from-slate-900 via-slate-900 to-slate-800/80'),
            isSafe ? (isPrivate ? "border-slate-700 hover:border-violet-400/50 hover:shadow-violey-500/10" : (isPending ? "border-purple-700/50" : "border-slate-700 hover:border-green-500/50 hover:shadow-green-500/10")) : "border-red-500/60 bg-red-900/20 hover:border-red-500 hover:shadow-red-500/10"
        )}
        >
          <div className="flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1">
                {isPending && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="mt-1.5 cursor-pointer">
                          <Hourglass className="w-4 h-4" style={{color: 'rgb(163 87 161)'}} />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Cambio solicitado pendiente</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                 <TitleWithTooltip>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <p className={cn(
                      "text-xl font-bold line-clamp-2 flex-1",
                      !isSafe && isAdminView ? "text-red-400" : (isPending ? "text-[rgb(159,102,163)]" : "text-white")
                    )}>
                      <HighlightedText text={recipeName} highlight={searchQuery} />
                    </p>
                    {recommendedFoodsSet.size > 0 && (
                         <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                     <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-900/30 text-green-400 border border-green-500/30">
                                        <ThumbsUp className="w-3 h-3 mr-1" /> {recommendedFoodsSet.size}
                                     </span>
                                </TooltipTrigger>
                                <TooltipContent className="bg-green-900 border-green-700 text-white">
                                    <p>Ingredientes recomendados: {Array.from(recommendedFoodsSet).join(', ')}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                    {unsafeFoodsSet.size > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-900/30 text-red-400 border border-red-500/30">
                            <AlertTriangle className="w-3 h-3 mr-1" /> {unsafeFoodsSet.size}
                        </span>
                    )}
                  </div>
                </TitleWithTooltip>
              </div>
              {adjustment && (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Scale className="w-4 h-4 text-blue-400 flex-shrink-0" />
                        </TooltipTrigger>
                        <TooltipContent className="bg-blue-800 border-blue-600 text-white">
                            <p>Receta equilibrada</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <p className="text-sm text-gray-400 line-clamp-3">
              {ingredientList.length > 0 ? 
                  ingredientList.reduce((prev, curr) => [prev, ', ', curr]) 
                  : 'Sin ingredientes'}
            </p>
          </div>
          {!hideMacros && (
            <div className="mt-4 flex justify-between items-center">
                {macroDisplay}
                {selectionIndicator}
            </div>
          )}
        </button>

        {handleRemoveRecipe && (
          <button 
            onClick={(e) => { e.stopPropagation(); handleRemoveRecipe(recipe.id, isPrivate); }} 
            className={cn(
              "absolute top-2 right-2 bg-red-600/60 text-white rounded-full p-1 transition-opacity hover:bg-red-500",
              "md:opacity-0 md:group-hover:opacity-100 opacity-100"
            )}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  // Week view (compact)
  return (
    <div className={cn(
        "relative group flex overflow-hidden rounded-lg shadow-lg border",
        isPrivate ? 'bg-gradient-to-br from-slate-900 via-slate-900 to-violet-800/50' : 'bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800/80',
        isSafe ? (isPrivate ? "border-slate-700" : "border-slate-700") : "border-red-500/60 bg-red-900/20"
    )}
    >
      <button onClick={() => handleRecipeClick && handleRecipeClick({ ...recipe, is_private_recipe: isPrivate }, adjustment)} className="flex-1 text-left p-3 w-4/5">
        <div className="flex justify-between items-start flex-wrap gap-x-2 mb-1">
          <div className="flex items-center gap-2">
            {changeRequest?.status === 'pending' && (
              <Hourglass className="w-3 h-3 text-purple-400 animate-pulse" />
            )}
            <TitleWithTooltip>
              <p className={cn(
                "text-white font-medium text-sm whitespace-normal",
                !isSafe && isAdminView ? "text-red-400" : "text-white"
              )}>
                {recipeName}
              </p>
            </TitleWithTooltip>
          </div>
          <div className="flex items-center gap-1">
            {recommendedFoodsSet.size > 0 && <ThumbsUp className="w-3 h-3 text-green-400" />}
            {adjustment && (
              <Scale className="w-3 h-3 text-blue-400" title="Receta equilibrada" />
            )}
          </div>
        </div>
      </button>
      {handleRemoveRecipe && (
        <button 
          onClick={(e) => { e.stopPropagation(); handleRemoveRecipe(); }} 
          className="w-1/5 flex items-center justify-center bg-red-500/20 hover:bg-red-500/40 transition-colors"
        >
          <X className="w-4 h-4 text-red-400" />
        </button>
      )}
    </div>
  );
};

export default RecipeCard;