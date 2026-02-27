import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import { isEqual } from 'lodash';

export const useIngredientBuilder = (initialIngredients = [], onIngredientsChange) => {
    const [allFoods, setAllFoods] = useState([]);
    const [allFoodGroups, setAllFoodGroups] = useState([]);
    const [localIngredients, setLocalIngredients] = useState([]);
    const isInitialLoad = useRef(true);

    useEffect(() => {
        const fetchInitialData = async () => {
            const [foodsRes, foodGroupsRes] = await Promise.all([
                supabase.from('food').select('*, food_unit, food_sensitivities(sensitivity_id, sensitivities(id, name)), food_medical_conditions(condition_id, relation_type), food_to_food_groups(food_group_id, food_group:food_groups(id, name)), food_vitamins(vitamin_id, vitamins(id, name)), food_minerals(mineral_id, minerals(id, name))'),
                supabase.from('food_groups').select('*')
            ]);
            setAllFoods(foodsRes.data || []);
            setAllFoodGroups(foodGroupsRes.data || []);
        };
        fetchInitialData();
    }, []);

    const processIngredients = useCallback((ingredientsToProcess) => {
        if (!ingredientsToProcess || !allFoods.length) return [];
        return ingredientsToProcess.map(ing => {
            const foodDetails = allFoods.find(f => String(f.id) === String(ing.food_id));
            const grams = ing.grams ?? ing.quantity ?? '';
            return {
                ...ing,
                food: foodDetails,
                food_group_id: foodDetails?.food_to_food_groups?.[0]?.food_group_id || null,
                local_id: ing.local_id || uuidv4(),
                grams: grams,
                quantity: parseFloat(grams) || 0,
            };
        });
    }, [allFoods]);

    useEffect(() => {
        if (!allFoods.length) return;

        if (isInitialLoad.current && initialIngredients && initialIngredients.length > 0) {
            setLocalIngredients(processIngredients(initialIngredients));
            isInitialLoad.current = false;
        } else if (!isInitialLoad.current) {
            const processedInitial = processIngredients(initialIngredients);
            const localIds = new Set(localIngredients.map(i => i.local_id));
            const initialIds = new Set(processedInitial.map(i => i.local_id));

            if (!isEqual(localIds, initialIds) || !isEqual(processedInitial, localIngredients)) {
                 setLocalIngredients(processedInitial);
            }
        }
    }, [initialIngredients, allFoods, processIngredients, localIngredients]);
    
    const triggerChange = useCallback((updatedIngredients) => {
        onIngredientsChange(updatedIngredients);
    }, [onIngredientsChange]);

    const updateLocalIngredients = useCallback((newIngredients) => {
        const processed = newIngredients.map(ing => {
            const grams = ing.grams ?? ing.quantity ?? '';
            const foodDetails = allFoods.find(f => String(f.id) === String(ing.food_id));
            return {
                ...ing,
                food: foodDetails, 
                food_group_id: foodDetails?.food_to_food_groups?.[0]?.food_group_id || ing.food_group_id || null,
                local_id: ing.local_id || uuidv4(),
                grams: grams,
                quantity: parseFloat(grams) || 0,
            };
        });
        setLocalIngredients(processed);
        triggerChange(processed);
    }, [triggerChange, allFoods]);
    
    const handleIngredientChange = useCallback((localId, fieldOrObject, value) => {
        const newIngredients = localIngredients.map(ing => {
            if (ing.local_id === localId) {
                let updatedIng;
                if (typeof fieldOrObject === 'object') {
                    updatedIng = { ...ing, ...fieldOrObject };
                } else {
                    updatedIng = { ...ing, [fieldOrObject]: value };
                }

                // If food ID changed, update food details and group
                if (updatedIng.food_id && updatedIng.food_id !== ing.food_id) {
                    const newFoodDetails = allFoods.find(f => String(f.id) === String(updatedIng.food_id));
                    updatedIng.food = newFoodDetails;
                    updatedIng.food_group_id = newFoodDetails?.food_to_food_groups?.[0]?.food_group_id || null;
                    
                    // Intelligent quantity initialization is handled by this logic
                    if (typeof fieldOrObject === 'object' && 'grams' in fieldOrObject) {
                        // Grams were explicitly passed, do nothing
                    } else if (newFoodDetails) {
                        updatedIng.grams = newFoodDetails.food_unit === 'unidades' ? '1' : '100';
                    }
                }
                
                return updatedIng;
            }
            return ing;
        });
        updateLocalIngredients(newIngredients);
    }, [localIngredients, updateLocalIngredients, allFoods]);


    const handleAddIngredient = useCallback(() => {
        const newIngredient = { local_id: uuidv4(), food_id: '', grams: '', quantity: 0, food_group_id: null };
        const newIngredients = [...localIngredients, newIngredient];
        updateLocalIngredients(newIngredients);
    }, [localIngredients, updateLocalIngredients]);

    const handleRemoveIngredient = useCallback((localId) => {
        const newIngredients = localIngredients.filter(ing => ing.local_id !== localId);
        updateLocalIngredients(newIngredients);
    }, [localIngredients, updateLocalIngredients]);

    return {
        allFoods,
        allFoodGroups,
        localIngredients,
        setLocalIngredients: updateLocalIngredients,
        handleIngredientChange,
        handleAddIngredient,
        handleRemoveIngredient,
    };
};
