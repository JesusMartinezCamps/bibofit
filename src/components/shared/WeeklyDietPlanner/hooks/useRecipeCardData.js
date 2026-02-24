import { useState, useEffect, useCallback } from 'react';
import { calculateMacros, getDietPlanRecipeIngredients } from '@/lib/macroCalculator';

export const useRecipeCardData = (planItems, allFoods, changeRequests) => {
    const [recipeMacros, setRecipeMacros] = useState({});
    const [loading, setLoading] = useState(true);

    const fetchAllRecipeMacros = useCallback(async (currentPlanItems) => {
        const macrosMap = {};
        const recipeItems = currentPlanItems.filter(item => item.type === 'recipe');
        
        for (const planRecipe of recipeItems) {
            try {
                let macros = null;
                if (planRecipe.recipe?.recipe_ingredients) {
                    macros = calculateMacros(planRecipe.recipe.recipe_ingredients, allFoods);
                }
                if (macros) {
                    macrosMap[planRecipe.id] = macros;
                }
            } catch (error) {
                console.error('Error fetching macros for recipe:', planRecipe.id, error);
            }
        }
        setRecipeMacros(macrosMap);
        setLoading(false);
    }, [allFoods]);

    useEffect(() => {
        setLoading(true);
        if (planItems && planItems.length > 0) {
            fetchAllRecipeMacros(planItems);
        } else {
            setLoading(false);
        }
    }, [planItems, fetchAllRecipeMacros]);
    
    const renderRecipeCardContent = useCallback(async (planRecipe) => {
        const useDataFromCustomFields = planRecipe.is_customized || planRecipe.custom_name != null;
        const recipeData = { name: useDataFromCustomFields ? planRecipe.custom_name : planRecipe.recipe?.name };
        
        let macros = recipeMacros[planRecipe.id];
        if (!macros) {
            macros = { proteins: 0, carbs: 0, fats: 0, calories: 0 };
        }
        
        let ingredientsSource = [];
        if (useDataFromCustomFields) {
            try {
                ingredientsSource = await getDietPlanRecipeIngredients(planRecipe.id);
            } catch (error) { console.error('Error loading custom ingredients:', error); }
        } else {
            ingredientsSource = planRecipe.recipe?.recipe_ingredients || [];
        }

        const ingredientList = ingredientsSource.map(ing => {
            const foodDetails = allFoods.find(f => f.id === ing.food_id);
            const foodName = foodDetails?.name || ing.food?.name || 'Ingrediente desconocido';
            const unit = (foodDetails?.food_unit || ing.food?.food_unit) === 'unidades' ? 'ud' : 'g';
            const quantity = ing.grams ?? 0;
            return `${foodName} (${quantity}${unit})`;
        }).join(', ');
        
        const changeRequest = changeRequests.find(req => req.diet_plan_recipe_id === planRecipe.id);
        
        return { useDataFromCustomFields, recipeData, macros, ingredientList, changeRequest };
    }, [allFoods, recipeMacros, changeRequests]);

    return { recipeMacros, loading, renderRecipeCardContent, fetchAllRecipeMacros };
};