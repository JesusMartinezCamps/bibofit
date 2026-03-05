import { supabase } from '@/lib/supabaseClient';
import {
    fetchFreeRecipeDetails,
    persistFreeRecipeDefinition,
} from '@/lib/freeRecipePersistence';
import { parseRecipeStyleId } from '@/lib/recipeStyles';

export const applyTemporaryChanges = async ({ formData, ingredients, recipeToEdit }) => {
    try {
        // Normalize ingredients to ensure consistent structure
        const normalizedIngredients = ingredients.map(ing => ({
            food_id: ing.food_id,
            grams: ing.grams || ing.quantity || 0,
            is_user_created: ing.is_user_created,
            food: ing.food
        }));

        const updatedRecipeData = {
            ...recipeToEdit,
            custom_name: formData.name,
            name: formData.name,
            custom_instructions: formData.instructions,
            instructions: formData.instructions,
            custom_prep_time_min: formData.prep_time_min,
            prep_time_min: formData.prep_time_min,
            custom_difficulty: formData.difficulty,
            difficulty: formData.difficulty,
            is_customized: true,
            // Store ingredients in ALL possible locations to ensure compatibility
            custom_ingredients: normalizedIngredients,
            ingredients: normalizedIngredients,
            recipe: {
                ...recipeToEdit.recipe,
                name: formData.name,
                instructions: formData.instructions,
                prep_time_min: formData.prep_time_min,
                difficulty: formData.difficulty,
                recipe_ingredients: normalizedIngredients
            },
            recipe_ingredients: normalizedIngredients
        };

        console.log('Applied temporary changes with ingredients:', normalizedIngredients);

        return { success: true, data: updatedRecipeData, action: 'temporary', message: 'Cambios aplicados temporalmente.' };
    } catch (error) {
        console.error("Error applying temporary changes:", error);
        return { success: false, message: `Error al aplicar cambios: ${error.message}` };
    }
};

export const submitChangeRequest = async ({ actionType, recipeToEdit, formData, ingredients, originalIngredients, userId }) => {
    try {
        // 1. Create the new private recipe with the requested changes
        const { data: newPrivateRecipe, error: privateRecipeError } = await supabase
            .from('user_recipes')
            .insert({
                type: 'private',
                user_id: userId,
                name: formData.name,
                instructions: formData.instructions,
                prep_time_min: formData.prep_time_min,
                difficulty: formData.difficulty,
                recipe_style_id: parseRecipeStyleId(formData.recipe_style_id) || parseRecipeStyleId(recipeToEdit.recipe_style_id),
                diet_plan_id: recipeToEdit.diet_plan_id,
                day_meal_id: recipeToEdit.day_meal_id,
            })
            .select('id')
            .single();

        if (privateRecipeError) {
            console.error("Error creating private recipe for change request:", privateRecipeError);
            throw new Error(`No se pudo crear la receta privada para la solicitud: ${privateRecipeError.message}`);
        }

        // 2. Insert ingredients for the new private recipe
        const newIngredientsData = ingredients.map(ing => ({
            user_recipe_id: newPrivateRecipe.id,
            food_id: ing.food_id,
            grams: ing.grams || ing.quantity || 0,
        }));

        const { error: ingredientsError } = await supabase
            .from('recipe_ingredients')
            .insert(newIngredientsData);

        if (ingredientsError) {
            console.error("Error inserting ingredients for private recipe:", ingredientsError);
            await supabase.from('user_recipes').delete().eq('id', newPrivateRecipe.id);
            throw new Error(`No se pudieron guardar los ingredientes de la nueva receta: ${ingredientsError.message}`);
        }

        // 3. Create the change request record
        const changeRequest = {
            user_id: userId,
            status: 'pending',
            request_type: actionType,
            requested_changes_user_recipe_id: newPrivateRecipe.id,
        };

        if (recipeToEdit.is_private_recipe) {
            changeRequest.user_recipe_id = recipeToEdit.id;
        } else {
            const dietPlanRecipeId = recipeToEdit.diet_plan_recipe_id || recipeToEdit.diet_plan_recipe?.id || recipeToEdit.id;
            changeRequest.diet_plan_recipe_id = dietPlanRecipeId;
        }

        const { error: requestError } = await supabase.from('diet_change_requests').insert(changeRequest);

        if (requestError) {
            console.error("Error submitting change request:", requestError);
            await supabase.from('recipe_ingredients').delete().eq('user_recipe_id', newPrivateRecipe.id);
            await supabase.from('user_recipes').delete().eq('id', newPrivateRecipe.id);
            throw new Error(`No se pudo enviar la solicitud de cambio: ${requestError.message}`);
        }

        return {
            success: true,
            action: 'change_request_pending',
            message: 'Tu solicitud de cambio ha sido enviada para revisión.',
            data: {
                id: newPrivateRecipe.id,
                type: 'private_recipe',
                is_private_recipe: true,
                status: 'pending',
                name: formData.name,
                instructions: formData.instructions,
                prep_time_min: formData.prep_time_min,
                difficulty: formData.difficulty,
                recipe_ingredients: ingredients
            }
        };

    } catch (error) {
        return { success: false, message: error.message };
    }
};

export const updateRecipeDetails = async ({ recipeId, recipeType, updates }) => {
    try {
        let error;
        let data;

        const safeUpdates = {
            name: updates.name,
            instructions: updates.instructions,
            prep_time_min: updates.prep_time_min ? parseInt(updates.prep_time_min) : null,
            difficulty: updates.difficulty,
            recipe_style_id: parseRecipeStyleId(updates.recipe_style_id),
        };

        if (recipeType === 'diet_plan_recipe') {
            const { data: resData, error: resError } = await supabase
                .from('diet_plan_recipes')
                .update({
                    custom_name: safeUpdates.name,
                    custom_instructions: safeUpdates.instructions,
                    custom_prep_time_min: safeUpdates.prep_time_min,
                    custom_difficulty: safeUpdates.difficulty,
                    custom_recipe_style_id: safeUpdates.recipe_style_id,
                    is_customized: true
                })
                .eq('id', recipeId)
                .select()
                .single();
            error = resError;
            data = resData;
        } else if (recipeType === 'private_recipe') {
            const { data: resData, error: resError } = await supabase
                .from('user_recipes')
                .update({
                    name: safeUpdates.name,
                    instructions: safeUpdates.instructions,
                    prep_time_min: safeUpdates.prep_time_min,
                    difficulty: safeUpdates.difficulty,
                    recipe_style_id: safeUpdates.recipe_style_id
                })
                .eq('id', recipeId)
                .select()
                .single();
            error = resError;
            data = resData;
        } else if (recipeType === 'free_recipe') {
            const { data: resData, error: resError } = await supabase
                .from('user_recipes')
                .update({
                    name: safeUpdates.name,
                    instructions: safeUpdates.instructions,
                    prep_time_min: safeUpdates.prep_time_min,
                    difficulty: safeUpdates.difficulty,
                    recipe_style_id: safeUpdates.recipe_style_id
                })
                .eq('id', recipeId)
                .select()
                .single();
            error = resError;
            data = resData;
        }

        if (error) throw new Error(error.message);

        return { success: true, message: 'Detalles actualizados correctamente.', data };

    } catch (error) {
        console.error("Error updating recipe details:", error);
        return { success: false, message: `Error al actualizar detalles: ${error.message}` };
    }
};

export const updateDietPlanRecipeCustomization = async ({ dietPlanRecipeId, formData, ingredients }) => {
    try {
        // 1. Update the diet_plan_recipes row
        const { error: updateError } = await supabase
            .from('diet_plan_recipes')
            .update({
                is_customized: true,
                custom_name: formData.name,
                custom_instructions: formData.instructions,
                custom_prep_time_min: formData.prep_time_min ? parseInt(formData.prep_time_min) : null,
                custom_difficulty: formData.difficulty,
                custom_recipe_style_id: parseRecipeStyleId(formData.recipe_style_id),
            })
            .eq('id', dietPlanRecipeId);

        if (updateError) throw updateError;

        // 2. Delete existing custom ingredients
        const { error: deleteError } = await supabase
            .from('recipe_ingredients')
            .delete()
            .eq('diet_plan_recipe_id', dietPlanRecipeId);

        if (deleteError) throw deleteError;

        // 3. Insert new custom ingredients
        const ingredientsToInsert = ingredients.map(ing => ({
            diet_plan_recipe_id: dietPlanRecipeId,
            food_id: parseInt(ing.food_id),
            grams: parseFloat(ing.grams || ing.quantity || 0),
        })).filter(i => !isNaN(i.food_id));

        if (ingredientsToInsert.length > 0) {
            const { error: insertError } = await supabase
                .from('recipe_ingredients')
                .insert(ingredientsToInsert);
            
            if (insertError) throw insertError;
        }
        
        return { success: true, message: 'Receta actualizada correctamente.' };

    } catch (error) {
        console.error("Error updating diet plan recipe customization:", error);
        return { success: false, message: `Error al actualizar: ${error.message}` };
    }
};

export const savePrivateRecipe = async ({ recipeId, userId, formData, ingredients, originalRecipe }) => {
    try {
        // Create NEW private recipe version
        const { data: newRecipe, error: recipeInsertError } = await supabase
            .from('user_recipes')
            .insert({
                type: 'private',
                user_id: userId,
                name: formData.name,
                instructions: formData.instructions,
                prep_time_min: formData.prep_time_min,
                difficulty: formData.difficulty,
                recipe_style_id: parseRecipeStyleId(formData.recipe_style_id),
                diet_plan_id: originalRecipe?.diet_plan_id,
                day_meal_id: originalRecipe?.day_meal_id,
                parent_user_recipe_id: recipeId,
                source_user_recipe_id: originalRecipe?.source_user_recipe_id,
            })
            .select()
            .single();

        if (recipeInsertError) throw new Error(recipeInsertError.message);

        // Insert new ingredients
        const newIngredientsData = ingredients.map(ing => ({
            user_recipe_id: newRecipe.id,
            food_id: ing.food_id,
            grams: ing.grams || ing.quantity || 0,
        }));

        const { error: insertError } = await supabase
            .from('recipe_ingredients')
            .insert(newIngredientsData);

        if (insertError) {
             await supabase.from('user_recipes').delete().eq('id', newRecipe.id);
             throw new Error(insertError.message);
        }

        return { success: true, message: 'Nueva versión de receta privada guardada con éxito.', data: newRecipe };

    } catch (error) {
        console.error("Error saving private recipe:", error);
        return { success: false, message: `Error al guardar la receta privada: ${error.message}` };
    }
};

export const saveDietPlanRecipe = async ({ recipeId, userId, formData, ingredients, originalRecipe, isNew = false }) => {
    try {
        let newRecipeId;
        
        const payload = {
            diet_plan_id: originalRecipe.diet_plan_id || originalRecipe.dietPlanId,
            recipe_id: originalRecipe.recipe_id || originalRecipe.recipeTemplateId || originalRecipe.id,
            day_of_week: originalRecipe.day_of_week,
            day_meal_id: originalRecipe.day_meal_id || originalRecipe.mealId,
            is_customized: true,
            custom_name: formData.name,
            custom_instructions: formData.instructions,
            custom_prep_time_min: formData.prep_time_min,
            custom_difficulty: formData.difficulty,
            custom_recipe_style_id: parseRecipeStyleId(formData.recipe_style_id),
            parent_diet_plan_recipe_id: originalRecipe.diet_plan_recipe_id || originalRecipe.id
        };

        const { data: newRecipe, error: recipeInsertError } = await supabase
            .from('diet_plan_recipes')
            .insert(payload)
            .select()
            .single();

        if (recipeInsertError) throw new Error(recipeInsertError.message);
        newRecipeId = newRecipe.id;

        // Insert new ingredients
        const newIngredientsData = ingredients.map(ing => ({
            diet_plan_recipe_id: newRecipeId,
            food_id: ing.food_id,
            grams: ing.grams || ing.quantity || 0,
        }));

        if (newIngredientsData.length > 0) {
            const { error: insertError } = await supabase
                .from('recipe_ingredients')
                .insert(newIngredientsData);

            if (insertError) {
                await supabase.from('diet_plan_recipes').delete().eq('id', newRecipeId);
                throw new Error(insertError.message);
            }
        }

        return { 
            success: true, 
            message: 'Variante de receta guardada correctamente en el plan.', 
            data: newRecipe,
            action: 'variant_created'
        };

    } catch (error) {
        console.error("Error saving diet plan recipe:", error);
        return { success: false, message: `Error al guardar la receta del plan: ${error.message}` };
    }
};

export const saveFreeRecipe = async ({ recipeId, userId, formData, ingredients, originalRecipe }) => {
    try {
        const dayMealId = originalRecipe?.day_meal_id || originalRecipe?.day_meal?.id || null;
        const dietPlanId = originalRecipe?.diet_plan_id || null;
        const currentStatus = originalRecipe?.status || null;

        const { freeRecipe } = await persistFreeRecipeDefinition({
            userId,
            recipeId,
            dayMealId,
            dietPlanId,
            recipe: {
                name: formData.name,
                instructions: formData.instructions,
                prep_time_min: formData.prep_time_min,
                difficulty: formData.difficulty,
                recipe_style_id: parseRecipeStyleId(formData.recipe_style_id),
                status: currentStatus,
            },
            ingredients,
        });

        const fullRecipe = await fetchFreeRecipeDetails(freeRecipe.id);

        return {
            success: true,
            message: 'Receta libre actualizada con éxito.',
            data: fullRecipe,
        };

    } catch (error) {
        console.error("Error saving free recipe:", error);
        return { success: false, message: `Error al guardar la receta libre: ${error.message}` };
    }
};
