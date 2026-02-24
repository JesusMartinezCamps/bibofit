import React, { useMemo } from 'react';
    import { Button } from '@/components/ui/button';
    import { calculateMacros } from '@/lib/macroCalculator';
    import { AlertTriangle, Trash2 } from 'lucide-react';
    import { cn } from '@/lib/utils';
    import CaloriesIcon from '@/components/icons/CaloriesIcon';
    import ProteinIcon from '@/components/icons/ProteinIcon';
    import CarbsIcon from '@/components/icons/CarbsIcon';
    import FatsIcon from '@/components/icons/FatsIcon';
    import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
    
    const PlanRecipeCard = ({ recipe, onEdit, onDelete, allFoods, userRestrictions }) => {
    
        const ingredients = useMemo(() => {
            if (recipe.is_private) {
                 return recipe.private_recipe_ingredients || [];
            }
            return recipe.custom_ingredients?.length > 0 
                ? recipe.custom_ingredients 
                : recipe.recipe?.recipe_ingredients || [];
        }, [recipe]);
    
        const macros = useMemo(() => {
            const ingredientsWithFood = ingredients.map(ing => ({
                ...ing,
                food: allFoods.find(f => f.id === ing.food_id)
            })).filter(ing => ing.food);
            return calculateMacros(ingredientsWithFood, allFoods);
        }, [ingredients, allFoods]);
    
        const unsafeFoodsSet = useMemo(() => {
            if (!userRestrictions || (!userRestrictions.sensitivities?.length && !userRestrictions.conditions?.length)) {
                return new Set();
            }
            
            const unsafe = new Set();
            ingredients.forEach(ing => {
                const food = allFoods.find(f => f.id === ing.food_id);
                if (!food) return;
    
                const foodSensitivityIds = new Set(food.food_sensitivities?.map(fs => fs.sensitivity_id) || []);
                
                (userRestrictions.sensitivities || []).forEach(s_id => {
                    if (foodSensitivityIds.has(s_id)) unsafe.add(food.name);
                });
    
                (food.food_medical_conditions || []).forEach(fmc => {
                    if ((userRestrictions.conditions || []).includes(fmc.condition_id) && fmc.relation_type === 'evitar') {
                        unsafe.add(food.name);
                    }
                });
            });
    
            return unsafe;
        }, [ingredients, allFoods, userRestrictions]);
    
        const isSafe = unsafeFoodsSet.size === 0;
        const name = recipe.is_private ? recipe.name : (recipe.custom_name || recipe.recipe?.name || "Receta sin nombre");
        
        const ingredientList = useMemo(() => {
            return ingredients.map(ing => {
                const food = allFoods.find(f => f.id === ing.food_id);
                if (!food) return null;
                const unit = food.food_unit === 'unidades' ? 'ud' : 'g';
                const text = `${food.name} (${Math.round(ing.grams || 0)}${unit})`;
                const isUnsafe = unsafeFoodsSet.has(food.name);
                return (
                    <span key={ing.id || food.id} className={cn(isUnsafe ? "text-red-400" : "text-gray-400")}>
                        {text}
                    </span>
                );
            });
        }, [ingredients, allFoods, unsafeFoodsSet]);
    
        return (
            <div className="relative group h-full">
                <button 
                    onClick={() => onEdit(recipe)}
                    className={cn(
                        "w-full h-full text-left bg-gradient-to-br p-5 rounded-xl transition-all flex flex-col justify-between shadow-lg border",
                        recipe.is_private ? 'from-blue-900/60 to-purple-900/40' : 'from-slate-900 via-slate-900 to-slate-800/80',
                        isSafe ? "border-slate-700 hover:border-green-500/50 hover:shadow-green-500/10" : "border-red-500/60 hover:border-red-500 hover:shadow-red-500/10"
                    )}
                >
                    <div className="flex-1">
                        <div className="flex items-start justify-between">
                            <h4 className="text-xl font-bold text-white mb-2 line-clamp-2 pr-4">{name}</h4>
                            {!isSafe && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="p-1.5 bg-red-500/20 text-red-400 rounded-full flex-shrink-0">
                                                <AlertTriangle className="h-5 w-5" />
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent className="bg-red-900 border-red-700 text-white max-w-xs">
                                            <p className="font-bold mb-1">Receta no segura</p>
                                            <p className="text-sm">Contiene: {Array.from(unsafeFoodsSet).join(', ')}</p>
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
                    <div className="mt-4 pt-4 border-t border-slate-700/50">
                        <div className="flex items-center justify-between md:justify-start gap-4 text-sm font-mono">
                            <span className="flex items-center text-orange-400" title="Calorías"><CaloriesIcon className="w-4 h-4 mr-1"/>{Math.round(macros.calories || 0)}</span>
                            <span className="flex items-center text-red-400" title="Proteínas"><ProteinIcon className="w-4 h-4 mr-1"/>{Math.round(macros.proteins || 0)}g</span>
                            <span className="flex items-center text-yellow-400" title="Carbohidratos"><CarbsIcon className="w-4 h-4 mr-1"/>{Math.round(macros.carbs || 0)}g</span>
                            <span className="flex items-center text-green-400" title="Grasas"><FatsIcon className="w-4 h-4 mr-1"/>{Math.round(macros.fats || 0)}g</span>
                        </div>
                    </div>
                </button>
                <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(recipe.id, recipe.is_private); }} 
                    className="absolute -top-2 -right-2 bg-red-600/90 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 z-10"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        );
    };
    
    export default PlanRecipeCard;