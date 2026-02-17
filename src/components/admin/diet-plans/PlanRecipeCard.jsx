import React, { useMemo } from 'react';
import { calculateMacros } from '@/lib/macroCalculator';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import CaloriesIcon from '@/components/icons/CaloriesIcon';
import ProteinIcon from '@/components/icons/ProteinIcon';
import CarbsIcon from '@/components/icons/CarbsIcon';
import FatsIcon from '@/components/icons/FatsIcon';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

const PlanRecipeCard = ({ recipe, onEdit, onDelete, allFoods, userRestrictions, readOnly = false }) => {
    
    // Determine the correct list of ingredients to use
    const ingredients = useMemo(() => {
        if (!recipe) return [];
        if (recipe.is_private) {
            return recipe.private_recipe_ingredients || [];
        }
        // If the recipe is customized in the plan and has custom ingredients, use them.
        // Otherwise, fallback to the base recipe ingredients.
        if (recipe.custom_ingredients && recipe.custom_ingredients.length > 0) {
            return recipe.custom_ingredients;
        }
        return recipe.recipe?.recipe_ingredients || [];
    }, [recipe]);

    // Construct a local food list if the global allFoods is missing or empty.
    // This handles RLS cases where allFoods fetch might fail but ingredients have nested food data.
    const localAllFoods = useMemo(() => {
        if (allFoods && allFoods.length > 0) return allFoods;
        return ingredients.map(i => i.food).filter(Boolean);
    }, [allFoods, ingredients]);

    const macros = useMemo(() => {
        const calculated = calculateMacros(ingredients, localAllFoods);
        // If calculation yields zero (e.g., missing food data), try to use stored macros from the join
        if (calculated.calories === 0 && recipe.recipe_macros && recipe.recipe_macros.length > 0) {
             const stored = recipe.recipe_macros[0];
             return {
                 calories: Number(stored.calories) || 0,
                 proteins: Number(stored.proteins) || 0,
                 carbs: Number(stored.carbs) || 0,
                 fats: Number(stored.fats) || 0
             };
        }
        return calculated;
    }, [ingredients, localAllFoods, recipe]);

    const unsafeFoodsSet = useMemo(() => {
        // Handle potential variations in restrictions object structure
        const sensitivities = userRestrictions?.sensitivities || [];
        const conditions = userRestrictions?.conditions || userRestrictions?.medical_conditions || [];
        
        if (!sensitivities.length && !conditions.length) {
            return new Set();
        }
        
        const unsafe = new Set();
        
        // Normalize to Sets of String IDs to handle mixed types (number vs string) safely
        const sensitivityIds = new Set(sensitivities.map(s => String(typeof s === 'object' ? s.id : s)));
        const conditionIds = new Set(conditions.map(c => String(typeof c === 'object' ? c.id : c)));

        ingredients.forEach(ing => {
            const foodId = ing.food_id || ing.user_created_food_id;
            // Use localAllFoods to handle cases where global allFoods is empty
            const food = localAllFoods.find(f => String(f.id) === String(foodId));
            if (!food) return;

            // Check Sensitivities
            (food.food_sensitivities || []).forEach(fs => {
                // Handle both direct structure and nested structure if any
                const sId = fs.sensitivity_id || (fs.sensitivity && fs.sensitivity.id);
                if (sId && sensitivityIds.has(String(sId))) {
                    unsafe.add(food.name);
                }
            });

            // Check Medical Conditions (Pathologies)
            (food.food_medical_conditions || []).forEach(fmc => {
                // Try to find condition_id in various potential structures
                const cId = fmc.condition_id || (fmc.condition && fmc.condition.id) || (fmc.medical_conditions && fmc.medical_conditions.id);
                
                // Check if user has this condition
                if (cId && conditionIds.has(String(cId))) {
                    // Check if the food should be avoided for this condition
                    // Handle both Spanish and English relation types from DB, case insensitive
                    // 'to_avoid' is often used in English, 'evitar' in Spanish data
                    const relation = (fmc.relation_type || '').toLowerCase().trim();
                    if (['evitar', 'to_avoid'].includes(relation)) {
                        unsafe.add(food.name);
                    }
                }
            });
        });

        return unsafe;
    }, [ingredients, localAllFoods, userRestrictions]);

    const isSafe = unsafeFoodsSet.size === 0;
    
    // Determine the name with fallbacks
    const name = useMemo(() => {
        if (!recipe) return "Receta Desconocida";
        if (recipe.is_private) return recipe.name;
        return recipe.custom_name || recipe.recipe?.name || "Receta sin nombre";
    }, [recipe]);
    
    const ingredientList = useMemo(() => {
        return ingredients.map((ing, index) => {
            const foodId = ing.food_id || ing.user_created_food_id;
            const food = localAllFoods.find(f => String(f.id) === String(foodId)) || ing.food;
            
            if (!food) return null;
            
            const unit = food.food_unit === 'unidades' ? 'ud' : 'g';
            const text = `${food.name} (${Math.round(ing.grams || 0)}${unit})`;
            const isUnsafe = unsafeFoodsSet.has(food.name);
            
            return (
                <span key={ing.id || `${foodId}-${index}`} className={cn(isUnsafe ? "text-red-400 font-bold" : "text-gray-400")}>
                    {text}
                </span>
            );
        });
    }, [ingredients, localAllFoods, unsafeFoodsSet]);

    const handleEdit = () => {
        onEdit(recipe);
    };

    if (!recipe) return null;

    return (
        <div className="relative group h-full">
            <button 
                onClick={handleEdit}
                className={cn(
                    "w-full h-full text-left bg-gradient-to-br p-5 rounded-xl transition-all flex flex-col justify-between shadow-lg border",
                    recipe.is_private ? 'from-slate-900 via-slate-900 to-violet-800/50' : 'from-slate-900 via-slate-900 to-slate-800/80', 
                    isSafe ? "border-slate-700 hover:border-green-500/50 hover:shadow-green-500/10" : "border-red-500/80 bg-red-900/10 hover:border-red-500 hover:shadow-red-500/20",
                    readOnly ? "cursor-pointer hover:border-green-500/30" : ""
                )}
            >
                <div className="flex-1">
                    <div className="flex items-start justify-between">
                        <h4 className={cn("text-xl font-bold mb-2 line-clamp-2 pr-10", isSafe ? "text-white" : "text-red-200")}>{name}</h4>
                        {!isSafe && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="p-1.5 bg-red-500/20 text-red-400 rounded-full flex-shrink-0 border border-red-500/50 animate-pulse">
                                            <AlertTriangle className="h-5 w-5" />
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-red-950 border-red-800 text-red-100 max-w-xs z-50">
                                        <p className="font-bold mb-1">Conflicto detectado</p>
                                        <p className="text-sm">Contiene alimentos no permitidos: <span className="font-semibold text-white">{Array.from(unsafeFoodsSet).join(', ')}</span></p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                    </div>
                    <p className="text-sm text-gray-400 line-clamp-3">
                        {ingredientList.filter(Boolean).length > 0 ? 
                            ingredientList.filter(Boolean).reduce((prev, curr) => [prev, ', ', curr]) 
                            : 'Sin ingredientes'}
                    </p>
                </div>
                <div className={cn("mt-4 pt-4 border-t", isSafe ? "border-slate-700/50" : "border-red-500/30")}>
                    <div className="flex items-center justify-between md:justify-start gap-4 text-sm font-mono">
                        <span className="flex items-center text-orange-400" title="Calorías"><CaloriesIcon className="w-4 h-4 mr-1"/>{Math.round(macros.calories || 0)}</span>
                        <span className="flex items-center text-red-400" title="Proteínas"><ProteinIcon className="w-4 h-4 mr-1"/>{Math.round(macros.proteins || 0)}g</span>
                        <span className="flex items-center text-yellow-400" title="Carbohidratos"><CarbsIcon className="w-4 h-4 mr-1"/>{Math.round(macros.carbs || 0)}g</span>
                        <span className="flex items-center text-green-400" title="Grasas"><FatsIcon className="w-4 h-4 mr-1"/>{Math.round(macros.fats || 0)}g</span>
                    </div>
                </div>
            </button>
            {!readOnly && (
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(recipe.id, recipe.is_private); }}
                    className="absolute -top-2 -right-2 bg-red-600/90 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 z-10"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            )}
        </div>
    );
};

export default PlanRecipeCard;