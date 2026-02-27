
import { useState, useCallback, useEffect } from 'react';
import { getConflictWithSubstitutions } from '@/lib/restrictionChecker';

export const useConflictResolution = (recipes, userRestrictions, allFoods) => {
    const [conflictMap, setConflictMap] = useState({});
    const [autoSubstitutions, setAutoSubstitutions] = useState([]);
    const [pendingConfirmations, setPendingConfirmations] = useState([]);
    const [manualReviewItems, setManualReviewItems] = useState([]);
    const [isAnalyzing, setIsLoading] = useState(false);

    const analyzeRecipesForConflicts = useCallback(async () => {
        if (!recipes || !userRestrictions || !allFoods) return;
        
        setIsLoading(true);
        const map = {};
        const auto = [];
        const pending = [];
        const manual = [];

        try {
            for (const recipe of recipes) {
                const ingredients = recipe.custom_ingredients?.length > 0 
                    ? recipe.custom_ingredients 
                    : (recipe.ingredients || recipe.recipe?.recipe_ingredients || []);

                let recipeHasConflict = false;

                for (const ing of ingredients) {
                    const food = ing.food;
                    if (!food) continue;

                    const result = await getConflictWithSubstitutions(food, userRestrictions, allFoods);
                    
                    if (result.hasConflict) {
                        recipeHasConflict = true;
                        
                        const conflictDetails = {
                            recipeId: recipe.id,
                            recipeName: recipe.custom_name || recipe.recipe?.name || recipe.name,
                            ingredient: ing,
                            conflict: result.conflict,
                            substitutions: result.substitutions
                        };

                        if (result.autoSubstitution) {
                            auto.push({
                                ...conflictDetails,
                                targetFoodId: result.autoSubstitution.target_food_id,
                                reason: result.autoSubstitution.reason
                            });
                        } else if (result.substitutions.length > 0) {
                            pending.push(conflictDetails);
                        } else {
                            manual.push(conflictDetails);
                        }
                    }
                }

                if (recipeHasConflict) {
                    map[recipe.id] = recipe;
                }
            }

            setConflictMap(map);
            setAutoSubstitutions(auto);
            setPendingConfirmations(pending);
            setManualReviewItems(manual);

        } catch (error) {
            console.error("Error analyzing conflicts:", error);
        } finally {
            setIsLoading(false);
        }
    }, [recipes, userRestrictions, allFoods]);

    const applyAutoSubstitutions = useCallback(() => {
        // En un caso real, esto actualizaría el estado global de las recetas
        // modificando los arrays de ingredients localmente.
        console.log("Applying auto substitutions:", autoSubstitutions);
        return autoSubstitutions;
    }, [autoSubstitutions]);

    const resolveConflict = useCallback((recipeId, originalFoodId, newFoodId) => {
        // Lógica para mover items de pending/manual a resueltos
        setPendingConfirmations(prev => prev.filter(item => !(item.recipeId === recipeId && item.ingredient.food.id === originalFoodId)));
        setManualReviewItems(prev => prev.filter(item => !(item.recipeId === recipeId && item.ingredient.food.id === originalFoodId)));
    }, []);

    const confirmSubstitution = useCallback((conflictItem, selectedTargetId) => {
        resolveConflict(conflictItem.recipeId, conflictItem.ingredient.food.id, selectedTargetId);
        // Además, debería despachar una actualización a los ingredientes de la receta
    }, [resolveConflict]);

    return {
        isAnalyzing,
        analyzeRecipesForConflicts,
        autoSubstitutions,
        pendingConfirmations,
        manualReviewItems,
        conflictMap,
        applyAutoSubstitutions,
        resolveConflict,
        confirmSubstitution
    };
};
