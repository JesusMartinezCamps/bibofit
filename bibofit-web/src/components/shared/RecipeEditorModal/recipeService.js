import { supabase } from '@/lib/supabaseClient';
import {
    fetchFreeRecipeDetails,
    persistFreeRecipeDefinition,
} from '@/lib/freeRecipePersistence';
import { parseRecipeStyleId } from '@/lib/recipeStyles';

// =============================================================================
// VARIANTES PERSONALES (flujo inmediato, sin aprobación)
// =============================================================================

/**
 * Crea una nueva variante personal de una receta.
 * El nodo padre puede ser un diet_plan_recipe (primera bifurcación desde la base)
 * o un user_recipe existente (bifurcación dentro del árbol personal).
 *
 * Nunca crea diet_change_requests. La variante queda activa de inmediato.
 */
export const createVariant = async ({
    parentNodeId,
    parentNodeType,   // 'diet_plan_recipe' | 'user_recipe'
    userId,
    formData,
    ingredients,
    variantLabel,     // string corto pre-computado en el hook
    diffSummary,      // array jsonb pre-computado en el hook
    dietPlanId,
    dayMealId,
}) => {
    try {
        // Resolver source_diet_plan_recipe_id (raíz canónica del árbol)
        let sourceDietPlanRecipeId = null;
        if (parentNodeType === 'diet_plan_recipe') {
            sourceDietPlanRecipeId = parentNodeId;
        } else if (parentNodeType === 'user_recipe') {
            const { data: parentRecipe, error: parentError } = await supabase
                .from('user_recipes')
                .select('source_diet_plan_recipe_id')
                .eq('id', parentNodeId)
                .single();
            if (parentError) throw new Error(`No se pudo leer el nodo padre: ${parentError.message}`);
            sourceDietPlanRecipeId = parentRecipe?.source_diet_plan_recipe_id ?? null;
        }

        const insertPayload = {
            type: 'variant',
            user_id: userId,
            name: formData.name,
            instructions: formData.instructions || null,
            prep_time_min: formData.prep_time_min ? parseInt(formData.prep_time_min) : null,
            difficulty: formData.difficulty || null,
            recipe_style_id: parseRecipeStyleId(formData.recipe_style_id),
            diet_plan_id: dietPlanId || null,
            day_meal_id: dayMealId || null,
            source_diet_plan_recipe_id: sourceDietPlanRecipeId,
            variant_label: variantLabel || null,
            diff_summary: diffSummary?.length ? diffSummary : null,
            parent_user_recipe_id: parentNodeType === 'user_recipe' ? parentNodeId : null,
        };

        const { data: newRecipe, error: recipeError } = await supabase
            .from('user_recipes')
            .insert(insertPayload)
            .select()
            .single();

        if (recipeError) throw new Error(recipeError.message);

        const ingredientsData = ingredients
            .map(ing => ({
                user_recipe_id: newRecipe.id,
                food_id: parseInt(ing.food_id),
                grams: parseFloat(ing.grams || ing.quantity || 0),
                locked: !!ing.locked,
            }))
            .filter(i => !isNaN(i.food_id));

        if (ingredientsData.length > 0) {
            const { error: ingError } = await supabase
                .from('recipe_ingredients')
                .insert(ingredientsData);

            if (ingError) {
                await supabase.from('user_recipes').delete().eq('id', newRecipe.id);
                throw new Error(ingError.message);
            }
        }

        return {
            success: true,
            message: 'Variante creada correctamente.',
            data: newRecipe,
            action: 'variant_created',
        };
    } catch (error) {
        console.error('Error creating variant:', error);
        return { success: false, message: `Error al crear la variante: ${error.message}` };
    }
};

/**
 * Archiva un user_recipe (nodo del árbol personal).
 * No elimina nada. No toca hijos. Los daily_meal_logs permanecen intactos.
 */
export const archiveUserRecipe = async (recipeId) => {
    const { error } = await supabase.rpc('archive_user_recipe', { p_recipe_id: recipeId });
    if (error) return { success: false, message: `Error al archivar: ${error.message}` };
    return { success: true, message: 'Receta archivada.' };
};

// =============================================================================
// VERSIONES DE RECETAS BASE DEL PLAN (flujo admin/coach)
// =============================================================================

/**
 * Crea una nueva versión de una diet_plan_recipe y archiva la anterior.
 * La versión archivada sigue accesible en el historial.
 * Los planned_meals de fechas futuras se actualizan al nuevo nodo.
 *
 * Reemplaza updateDietPlanRecipeCustomization (que editaba in-place).
 */
export const versionDietPlanRecipe = async ({ oldDietPlanRecipeId, formData, ingredients, originalRecipe }) => {
    try {
        // 1. Crear nueva versión
        const { data: newRecipe, error: insertError } = await supabase
            .from('diet_plan_recipes')
            .insert({
                diet_plan_id: originalRecipe.diet_plan_id,
                recipe_id: originalRecipe.recipe_id || originalRecipe.recipe?.id || null,
                day_meal_id: originalRecipe.day_meal_id,
                is_customized: true,
                custom_name: formData.name,
                custom_instructions: formData.instructions || null,
                custom_prep_time_min: formData.prep_time_min ? parseInt(formData.prep_time_min) : null,
                custom_difficulty: formData.difficulty || null,
                custom_recipe_style_id: parseRecipeStyleId(formData.recipe_style_id),
                parent_diet_plan_recipe_id: oldDietPlanRecipeId,
            })
            .select()
            .single();

        if (insertError) throw insertError;

        // 2. Insertar ingredientes para la nueva versión
        const ingredientsData = ingredients
            .map(ing => ({
                diet_plan_recipe_id: newRecipe.id,
                food_id: parseInt(ing.food_id),
                grams: parseFloat(ing.grams || ing.quantity || 0),
                locked: !!ing.locked,
            }))
            .filter(i => !isNaN(i.food_id));

        if (ingredientsData.length > 0) {
            const { error: ingError } = await supabase
                .from('recipe_ingredients')
                .insert(ingredientsData);

            if (ingError) {
                await supabase.from('diet_plan_recipes').delete().eq('id', newRecipe.id);
                throw ingError;
            }
        }

        // 3. Redirigir planned_meals futuros al nuevo nodo
        const today = new Date().toISOString().split('T')[0];
        const { error: plannedMealsError } = await supabase
            .from('planned_meals')
            .update({ diet_plan_recipe_id: newRecipe.id })
            .eq('diet_plan_recipe_id', oldDietPlanRecipeId)
            .gte('plan_date', today);

        if (plannedMealsError) {
            console.warn('No se pudieron redirigir planned_meals:', plannedMealsError.message);
        }

        // 4. Archivar la versión anterior
        const { error: archiveError } = await supabase
            .from('diet_plan_recipes')
            .update({ is_archived: true, archived_at: new Date().toISOString() })
            .eq('id', oldDietPlanRecipeId);

        if (archiveError) {
            console.warn('No se pudo archivar la versión anterior:', archiveError.message);
        }

        return {
            success: true,
            message: 'Nueva versión de receta guardada en el plan.',
            data: newRecipe,
            action: 'version_created',
        };
    } catch (error) {
        console.error('Error versioning diet plan recipe:', error);
        return { success: false, message: `Error al guardar la nueva versión: ${error.message}` };
    }
};

/**
 * Archiva un diet_plan_recipe vía RPC (valida permisos de coach/admin en DB).
 * Devuelve el conteo de variantes de usuario que apuntaban al nodo archivado.
 */
export const archiveDietPlanRecipe = async (recipeId) => {
    const { data, error } = await supabase.rpc('archive_diet_plan_recipe', { p_recipe_id: recipeId });
    if (error) return { success: false, message: `Error al archivar: ${error.message}` };
    return {
        success: true,
        message: 'Receta archivada del plan.',
        activeVariantsCount: data?.active_variants_count ?? 0,
    };
};

// =============================================================================
// SOLICITUD AL COACH (flujo de aprobación — solo para cambios en receta base)
// =============================================================================

/**
 * Envía una solicitud al coach para que modifique la receta base del plan.
 * Esta función NO crea variantes personales — es un canal de comunicación
 * con el coach, no un mecanismo de personalización.
 */
export const submitPlanAmendment = async ({ recipeToEdit, formData, ingredients, userId }) => {
    try {
        // Crear la user_recipe con los cambios propuestos (tipo 'variant', pendiente de revisión)
        const { data: proposalRecipe, error: recipeError } = await supabase
            .from('user_recipes')
            .insert({
                type: 'variant',
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

        if (recipeError) throw new Error(recipeError.message);

        const ingredientsData = ingredients.map(ing => ({
            user_recipe_id: proposalRecipe.id,
            food_id: ing.food_id,
            grams: ing.grams || ing.quantity || 0,
            locked: !!ing.locked,
        }));

        const { error: ingError } = await supabase
            .from('recipe_ingredients')
            .insert(ingredientsData);

        if (ingError) {
            await supabase.from('user_recipes').delete().eq('id', proposalRecipe.id);
            throw new Error(ingError.message);
        }

        const changeRequest = {
            user_id: userId,
            status: 'pending',
            request_type: 'save',
            requested_changes_user_recipe_id: proposalRecipe.id,
            diet_plan_recipe_id: recipeToEdit.diet_plan_recipe_id || recipeToEdit.id,
        };

        const { error: requestError } = await supabase
            .from('diet_change_requests')
            .insert(changeRequest);

        if (requestError) {
            await supabase.from('recipe_ingredients').delete().eq('user_recipe_id', proposalRecipe.id);
            await supabase.from('user_recipes').delete().eq('id', proposalRecipe.id);
            throw new Error(requestError.message);
        }

        return {
            success: true,
            action: 'plan_amendment_pending',
            message: 'Tu propuesta ha sido enviada al coach para revisión.',
            data: { id: proposalRecipe.id },
        };
    } catch (error) {
        return { success: false, message: error.message };
    }
};

// =============================================================================
// UTILIDADES DE ACTUALIZACIÓN (sin cambios de ingredientes)
// =============================================================================

export const applyTemporaryChanges = async ({ formData, ingredients, recipeToEdit }) => {
    try {
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

        return { success: true, data: updatedRecipeData, action: 'temporary', message: 'Cambios aplicados temporalmente.' };
    } catch (error) {
        return { success: false, message: `Error al aplicar cambios: ${error.message}` };
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
        } else {
            // user_recipe (free, private, variant)
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
        console.error('Error updating recipe details:', error);
        return { success: false, message: `Error al actualizar detalles: ${error.message}` };
    }
};

export const saveDietPlanRecipe = async ({ formData, ingredients, originalRecipe }) => {
    try {
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

        const newIngredientsData = ingredients.map(ing => ({
            diet_plan_recipe_id: newRecipe.id,
            food_id: ing.food_id,
            grams: ing.grams || ing.quantity || 0,
            locked: !!ing.locked,
        }));

        if (newIngredientsData.length > 0) {
            const { error: insertError } = await supabase
                .from('recipe_ingredients')
                .insert(newIngredientsData);

            if (insertError) {
                await supabase.from('diet_plan_recipes').delete().eq('id', newRecipe.id);
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
        console.error('Error saving diet plan recipe:', error);
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
        console.error('Error saving free recipe:', error);
        return { success: false, message: `Error al guardar la receta libre: ${error.message}` };
    }
};

// Mantenido por compatibilidad con código que aún lo llame durante la transición.
// @deprecated — usar createVariant para variantes personales, submitPlanAmendment para solicitudes al coach.
export const submitChangeRequest = submitPlanAmendment;

// =============================================================================
// GUARD DE TRAZABILIDAD
// =============================================================================

/**
 * Comprueba si un nodo de user_recipe puede editarse in-place.
 * Un nodo NO puede editarse in-place si:
 *  - Tiene registros de comida (daily_meal_logs) — datos históricos de calorías
 *  - Tiene ramas hijas (otras variantes creadas a partir de él) — evita huérfanos
 */
export const checkRecipeEditability = async (recipeId) => {
    const [eatenRes, childrenRes] = await Promise.all([
        supabase
            .from('daily_meal_logs')
            .select('id', { count: 'exact', head: true })
            .eq('user_recipe_id', recipeId),
        supabase
            .from('user_recipes')
            .select('id', { count: 'exact', head: true })
            .eq('parent_user_recipe_id', recipeId)
            .eq('is_archived', false),
    ]);

    const hasEatenRecords = (eatenRes.count ?? 0) > 0;
    const hasChildren = (childrenRes.count ?? 0) > 0;

    return {
        canModifyInPlace: !hasEatenRecords && !hasChildren,
        hasEatenRecords,
        hasChildren,
    };
};

/**
 * Actualiza in-place una user_recipe (variante personal) y reemplaza sus ingredientes.
 * Solo usar cuando checkRecipeEditability devuelva canModifyInPlace: true.
 */
export const updateUserRecipeInPlace = async ({ recipeId, formData, ingredients }) => {
    try {
        const { error: updateError } = await supabase
            .from('user_recipes')
            .update({
                name: formData.name,
                instructions: formData.instructions || null,
                prep_time_min: formData.prep_time_min ? parseInt(formData.prep_time_min) : null,
                difficulty: formData.difficulty || null,
                recipe_style_id: parseRecipeStyleId(formData.recipe_style_id),
            })
            .eq('id', recipeId);

        if (updateError) throw updateError;

        // Reemplazar ingredientes
        const { error: deleteError } = await supabase
            .from('recipe_ingredients')
            .delete()
            .eq('user_recipe_id', recipeId);

        if (deleteError) throw deleteError;

        const ingredientsData = ingredients
            .map(ing => ({
                user_recipe_id: recipeId,
                food_id: parseInt(ing.food_id),
                grams: parseFloat(ing.grams || ing.quantity || 0),
                locked: !!ing.locked,
            }))
            .filter(i => !isNaN(i.food_id));

        if (ingredientsData.length > 0) {
            const { error: ingError } = await supabase
                .from('recipe_ingredients')
                .insert(ingredientsData);
            if (ingError) throw ingError;
        }

        return {
            success: true,
            message: 'Receta actualizada correctamente.',
            data: { id: recipeId },
            action: 'updated_in_place',
        };
    } catch (error) {
        console.error('Error updating user recipe in-place:', error);
        return { success: false, message: `Error al actualizar la receta: ${error.message}` };
    }
};
