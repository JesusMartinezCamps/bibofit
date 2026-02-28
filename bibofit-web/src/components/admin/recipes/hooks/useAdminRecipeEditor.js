import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { calculateMacros } from '@/lib/macroCalculator';

const calculateRecipeNutrients = (ingredients, allFoodsData) => {
    const vitaminIds = new Set();
    const mineralIds = new Set();

    ingredients.forEach(ing => {
        const food = allFoodsData.find(f => String(f.id) === String(ing.food_id));
        if (!food) return;

        food.food_vitamins?.forEach(v => vitaminIds.add(v.vitamin_id));
        food.food_minerals?.forEach(m => mineralIds.add(m.mineral_id));
    });

    return {
        vitaminIds: Array.from(vitaminIds),
        mineralIds: Array.from(mineralIds),
    };
};

export const useAdminRecipeEditor = ({ recipeToEdit, onSaveSuccess, userId, planRestrictions, allFoodsData, isTemporaryEdit = false, key: stateKey = 0 }) => {
    const { toast } = useToast();
    const [recipeData, setRecipeData] = useState(null);
    const [ingredients, setIngredients] = useState([]);
    const [macros, setMacros] = useState({ calories: 0, proteins: 0, carbs: 0, fats: 0 });
    const [loading, setLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [recipeNutrients, setRecipeNutrients] = useState({ vitaminIds: [], mineralIds: [] });
    const [selectedAllergies, setSelectedAllergies] = useState([]);

    const isNewRecipeFromTemplate = useMemo(() => recipeToEdit && !recipeToEdit.is_customized && recipeToEdit.recipe, [recipeToEdit]);

    const mapInMemoryIngredients = useCallback((sourceIngredients = []) => {
        return (sourceIngredients || []).map((ing, index) => {
            const foodId = ing?.food_id ?? ing?.food?.id;
            const fallbackFood = allFoodsData.find((f) => String(f.id) === String(foodId));
            return {
                ...ing,
                id: ing?.id ?? `tmp-${index}`,
                food_id: foodId,
                grams: Number(ing?.grams ?? ing?.quantity ?? 0),
                food: ing?.food || fallbackFood || null,
                local_id: ing?.local_id || ing?.id || `tmp-local-${index}`,
            };
        }).filter((ing) => ing.food_id != null);
    }, [allFoodsData]);

    const fetchIngredients = useCallback(async () => {
        if (!recipeToEdit) return [];

        if (isTemporaryEdit) {
            const inMemoryIngredients = recipeToEdit?.custom_ingredients?.length > 0
                ? recipeToEdit.custom_ingredients
                : (recipeToEdit?.ingredients?.length > 0
                    ? recipeToEdit.ingredients
                    : recipeToEdit?.recipe?.recipe_ingredients || []);
            return mapInMemoryIngredients(inMemoryIngredients);
        }
        
        let ingredientsData = [];
        let error;

        if (recipeToEdit.is_private) {
            ({ data: ingredientsData, error } = await supabase
                .from('private_recipe_ingredients')
                .select('*, food(*, food_sensitivities(*, sensitivities(name)), food_medical_conditions(*), food_vitamins(*), food_minerals(*))')
                .eq('private_recipe_id', recipeToEdit.id));
        } else if (recipeToEdit.is_customized) {
            ({ data: ingredientsData, error } = await supabase
                .from('diet_plan_recipe_ingredients')
                .select('*, food(*, food_sensitivities(*, sensitivities(name)), food_medical_conditions(*), food_vitamins(*), food_minerals(*))')
                .eq('diet_plan_recipe_id', recipeToEdit.id));
        } else if (recipeToEdit.recipe?.id) { // Template recipe
            ({ data: ingredientsData, error } = await supabase
                .from('recipe_ingredients')
                .select('*, food(*, food_sensitivities(*, sensitivities(name)), food_medical_conditions(*), food_vitamins(*), food_minerals(*))')
                .eq('recipe_id', recipeToEdit.recipe.id));
        }

        if (error) {
            toast({ title: 'Error', description: `No se pudieron cargar los ingredientes: ${error.message}`, variant: 'destructive' });
            return [];
        }
        return ingredientsData.map(ing => ({ 
            ...ing,
            local_id: ing.id || Math.random().toString(),
        }));
    }, [recipeToEdit, toast, isTemporaryEdit, mapInMemoryIngredients]);

    useEffect(() => {
        // Reset editor state whenever the caller indicates we should reinitialize (e.g., modal reopen)
        setRecipeData(null);
        setIngredients([]);
    }, [stateKey]);

    useEffect(() => {
        const initialize = async () => {
            if (!recipeToEdit || !allFoodsData || allFoodsData.length === 0) return;
            setLoading(true);
            
            const initialIngredients = await fetchIngredients();
            setIngredients(initialIngredients.map(ing => ({
                ...ing,
                food_id: String(ing.food_id)
            })));

            let initialRecipeData;
            if (recipeToEdit.is_private) {
                initialRecipeData = { ...recipeToEdit };
            } else if (recipeToEdit.is_customized) {
                initialRecipeData = {
                    name: recipeToEdit.custom_name,
                    instructions: recipeToEdit.custom_instructions,
                    prep_time_min: recipeToEdit.custom_prep_time_min,
                    difficulty: recipeToEdit.custom_difficulty,
                };
            } else { // Template
                initialRecipeData = {
                    name: recipeToEdit.custom_name || recipeToEdit.name || recipeToEdit.recipe?.name,
                    instructions: recipeToEdit.custom_instructions || recipeToEdit.instructions || recipeToEdit.recipe?.instructions,
                    prep_time_min: recipeToEdit.custom_prep_time_min ?? recipeToEdit.prep_time_min ?? recipeToEdit.recipe?.prep_time_min,
                    difficulty: recipeToEdit.custom_difficulty || recipeToEdit.difficulty || recipeToEdit.recipe?.difficulty,
                };
            }
            setRecipeData(initialRecipeData);
            setLoading(false);
        };
        initialize();
    }, [recipeToEdit, fetchIngredients, allFoodsData, stateKey]);
    
    useEffect(() => {
        if (ingredients.length > 0 && allFoodsData.length > 0) {
            const ingredientsForMacros = ingredients.map(ing => ({
                food_id: ing.food_id,
                grams: ing.grams
            }));
            const newMacros = calculateMacros(ingredientsForMacros, allFoodsData);
            setMacros(newMacros);
            const newNutrients = calculateRecipeNutrients(ingredientsForMacros, allFoodsData);
            setRecipeNutrients(newNutrients);
        } else {
            setMacros({ calories: 0, proteins: 0, carbs: 0, fats: 0 });
            setRecipeNutrients({ vitaminIds: [], mineralIds: [] });
        }
    }, [ingredients, allFoodsData]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            if (isNewRecipeFromTemplate) {
                const { data, error } = await supabase.from('diet_plan_recipes').insert({
                    diet_plan_id: recipeToEdit.dietPlanId,
                    recipe_id: recipeToEdit.recipeTemplateId,
                    day_meal_id: recipeToEdit.mealId,
                    is_customized: true,
                    custom_name: recipeData.name,
                    custom_prep_time_min: recipeData.prep_time_min,
                    custom_difficulty: recipeData.difficulty,
                    custom_instructions: recipeData.instructions
                }).select().single();

                if (error) throw error;
                
                const newDietPlanRecipeId = data.id;

                const newIngredients = ingredients.map(ing => ({
                    diet_plan_recipe_id: newDietPlanRecipeId,
                    food_id: ing.food_id,
                    grams: ing.grams
                }));

                const { error: ingredientsError } = await supabase.from('diet_plan_recipe_ingredients').insert(newIngredients);
                if(ingredientsError) throw ingredientsError;
                
                toast({ title: 'Éxito', description: 'Receta añadida y personalizada en el plan.' });
                if (onSaveSuccess) onSaveSuccess();

            } else {
                await updateExistingRecipe();
            }
        } catch (error) {
            toast({ title: 'Error al guardar', description: error.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    const updateExistingRecipe = async () => {
        let ingredientsTable, recipeTable, idColumn, recipeId;

        if (recipeToEdit.is_private) {
            ingredientsTable = 'private_recipe_ingredients';
            recipeTable = 'private_recipes';
            idColumn = 'private_recipe_id';
            recipeId = recipeToEdit.id;
        } else { 
            ingredientsTable = 'diet_plan_recipe_ingredients';
            recipeTable = 'diet_plan_recipes';
            idColumn = 'diet_plan_recipe_id';
            recipeId = recipeToEdit.id;
        }

        let recipeDetailsToUpdate;
        if (recipeToEdit.is_private) {
            recipeDetailsToUpdate = {
                name: recipeData.name,
                instructions: recipeData.instructions,
                prep_time_min: recipeData.prep_time_min,
                difficulty: recipeData.difficulty,
                day_meal_id: recipeData.day_meal_id
            };
        } else {
            recipeDetailsToUpdate = {
                custom_name: recipeData.name,
                custom_instructions: recipeData.instructions,
                custom_prep_time_min: recipeData.prep_time_min,
                custom_difficulty: recipeData.difficulty
            };
        }


        const { error: recipeUpdateError } = await supabase
            .from(recipeTable)
            .update(recipeDetailsToUpdate)
            .eq('id', recipeId);

        if (recipeUpdateError) throw recipeUpdateError;

        const { error: deleteError } = await supabase.from(ingredientsTable).delete().eq(idColumn, recipeId);
        if (deleteError) throw deleteError;

        if (ingredients.length > 0) {
            const newIngredients = ingredients.map(ing => ({
                [idColumn]: recipeId,
                food_id: ing.food_id,
                grams: ing.grams,
            }));
            const { error: insertError } = await supabase.from(ingredientsTable).insert(newIngredients);
            if (insertError) throw insertError;
        }
        
        toast({ title: 'Éxito', description: 'Receta actualizada correctamente.' });
        onSaveSuccess();
    };

    return {
        recipeData,
        setRecipeData,
        ingredients,
        setIngredients,
        macros,
        loading,
        isSaving,
        handleSave,
        recipeNutrients,
        selectedAllergies,
        setSelectedAllergies,
    };
};
