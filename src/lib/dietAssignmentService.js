import { supabase } from '@/lib/supabaseClient';
import { 
    buildMacroBalancingParams, 
    callMacroBalancingEdgeFunction, 
    fetchRecipesForTemplate
} from './dietPlanBalancingService';
import { saveDietPlanRecipeIngredients, calculateMacros, saveRecipeMacros } from '@/lib/macroCalculator';
import { format } from 'date-fns';

/**
 * Fetches full details of template recipes needed for copying to a new plan.
 * This includes nested recipe data, ingredients, and custom overrides.
 */
const fetchFullTemplateRecipes = async (templateId) => {
    const { data, error } = await supabase
        .from('diet_plan_recipes')
        .select(`
            *,
            recipe:recipe_id(
                *,
                recipe_ingredients(
                    *,
                    food(
                        *,
                        food_sensitivities(sensitivity_id),
                        food_medical_conditions(*)
                    )
                )
            ),
            custom_ingredients:diet_plan_recipe_ingredients(
                *,
                food(
                    *,
                    food_sensitivities(sensitivity_id),
                    food_medical_conditions(*)
                )
            )
        `)
        .eq('diet_plan_id', templateId);

    if (error) {
        console.error("Error fetching full template recipes:", error);
        throw new Error("No se pudieron cargar las recetas de la plantilla.");
    }
    return data || [];
};

/**
 * Creates the diet plan structure in the database.
 * This function acts as the "Service Layer" equivalent of the logic previously found in useAssignPlan hook.
 * 
 * @param {string} userId - Target user ID
 * @param {object} planData - Plan configuration (dates, calories, macros, etc)
 * @param {array} templateRecipes - Full recipe objects from the template
 * @param {object} edgeResult - Result from the auto-balancing edge function (optional)
 */
const createUserDietFromTemplate = async (userId, planData, templateRecipes, edgeResult) => {
    const { 
        planName, 
        startDate, 
        endDate, 
        template, 
        dailyCalories, 
        globalMacros, 
        mealMacroDistribution 
    } = planData;

    // 1. Create the Diet Plan record
    const { data: newPlan, error: planError } = await supabase
        .from('diet_plans')
        .insert({
            user_id: userId,
            name: planName,
            start_date: startDate, // Assumes ISO YYYY-MM-DD
            end_date: endDate,
            protein_pct: globalMacros.protein,
            carbs_pct: globalMacros.carbs,
            fat_pct: globalMacros.fat,
            is_active: true,
            is_template: false,
            source_template_id: template.id,
        })
        .select('id')
        .single();

    if (planError) throw new Error(`Error creando el plan: ${planError.message}`);
    const newPlanId = newPlan.id;

    // 2. Create User Day Meals (Macro Objectives)
    if (mealMacroDistribution && mealMacroDistribution.length > 0) {
        // Calculate daily grams based on TDEE (dailyCalories)
        const dailyProteins = (dailyCalories * (globalMacros.protein / 100)) / 4;
        const dailyCarbs = (dailyCalories * (globalMacros.carbs / 100)) / 4;
        const dailyFats = (dailyCalories * (globalMacros.fat / 100)) / 9;

        const userDayMealsToInsert = mealMacroDistribution.map(config => {
            // Calculate specific target for this meal
            const p_grams = dailyProteins * (config.protein_pct / 100);
            const c_grams = dailyCarbs * (config.carbs_pct / 100);
            const f_grams = dailyFats * (config.fat_pct / 100);
            const cals = (p_grams * 4) + (c_grams * 4) + (f_grams * 9);

            return {
                user_id: userId,
                day_meal_id: config.day_meal_id || config.id, // Handle inconsistent ID naming if any
                diet_plan_id: newPlanId,
                protein_pct: config.protein_pct,
                carbs_pct: config.carbs_pct,
                fat_pct: config.fat_pct,
                target_calories: Math.round(cals),
                target_proteins: Math.round(p_grams),
                target_carbs: Math.round(c_grams),
                target_fats: Math.round(f_grams),
                preferences: config.preferences || ''
            };
        });

        const { error: udmError } = await supabase.from('user_day_meals').insert(userDayMealsToInsert);
        if (udmError) {
            console.error("Error inserting user_day_meals:", udmError);
            // We continue, as the plan was created, but log the error.
        }
    }

    // 3. Process Recipes and insert them into the new plan
    // Create a map of balanced ingredients from Edge Function result for easy lookup
    // Edge result format: { results: [ { day_meal_id, recipe_id, ingredients: [] } ] }
    const adjustedRecipeMap = new Map();
    if (edgeResult && edgeResult.results) {
        edgeResult.results.forEach(res => {
            // We use a composite key or just look up by matching the recipe in the loop
            // Since template recipes might be reused, we need to be careful.
            // The edge function should return enough info to match. 
            // For now, mapping by original recipe_id for the specific day_meal context
            const key = `${res.day_meal_id}-${res.recipe_id}`;
            adjustedRecipeMap.set(key, res.ingredients);
        });
    }

    for (const recipe of templateRecipes) {
        // Determine ingredients: Auto-balanced vs Original
        let ingredientsToSave = [];
        
        const balanceKey = `${recipe.day_meal_id}-${recipe.recipe_id}`;
        
        if (adjustedRecipeMap.has(balanceKey)) {
            ingredientsToSave = adjustedRecipeMap.get(balanceKey);
        } else {
            // Fallback to original ingredients (Custom overrides -> Original Recipe Ingredients)
            ingredientsToSave = recipe.custom_ingredients?.length > 0 
                ? recipe.custom_ingredients 
                : recipe.recipe?.recipe_ingredients;
        }

        // Prepare Diet Plan Recipe Record
        const recipePayload = {
            diet_plan_id: newPlanId,
            recipe_id: recipe.recipe_id, 
            day_meal_id: recipe.day_meal_id,
            is_customized: true,
            custom_name: recipe.custom_name || recipe.recipe?.name,
            custom_prep_time_min: recipe.custom_prep_time_min || recipe.recipe?.prep_time_min,
            custom_difficulty: recipe.custom_difficulty || recipe.recipe?.difficulty,
            custom_instructions: recipe.custom_instructions || recipe.recipe?.instructions,
            parent_diet_plan_recipe_id: recipe.id
        };

        // Insert Recipe
        const { data: newPlanRecipe, error: recipeInsertError } = await supabase
            .from('diet_plan_recipes')
            .insert(recipePayload)
            .select('id')
            .single();

        if (recipeInsertError) {
            console.error(`Error copying recipe ${recipe.id}:`, recipeInsertError);
            continue; // Skip this recipe if insertion fails
        }
        
        const newRecipeId = newPlanRecipe.id;

        // Normalize and Save Ingredients
        const normalizedIngredients = (ingredientsToSave || []).map((ing) => {
            const foodId = ing.food_id || ing.food?.id;
            // Handle different property names for quantity
            const grams = parseFloat(ing.grams || ing.quantity || 0);
            
            return {
                diet_plan_recipe_id: newRecipeId,
                food_id: foodId ? parseInt(foodId, 10) : undefined,
                grams: grams,
                food: ing.food // Preserve for macro calculation if available
            };
        }).filter(i => i.food_id && i.grams > 0);
        
        if (normalizedIngredients.length > 0) {
            await saveDietPlanRecipeIngredients(newRecipeId, normalizedIngredients);
            
            // Calculate and save macros
            const macros = calculateMacros(normalizedIngredients);
            await saveRecipeMacros(null, newRecipeId, macros);
        }
    }

    return { success: true, planId: newPlanId };
};

/**
 * Assigns a diet plan template to a user, creating the plan structure
 * and then triggering the auto-balancing logic via Edge Function.
 * 
 * Flow:
 * 1. Fetch recipes for the template (for edge function logic)
 * 2. Fetch full template recipes (for copying details)
 * 3. Build Payload & Invoke Edge Function
 * 4. Create Plan via createUserDietFromTemplate with all data
 * 
 * @param {string} userId - The ID of the user to assign the plan to.
 * @param {object} planData - Configuration object for the plan.
 * @param {boolean} isOnboarding - Flag to indicate if this is part of onboarding flow.
 */
export const assignDietPlanToUser = async (userId, planData, isOnboarding = false) => {
    try {
        const { 
            planName, 
            startDate, 
            endDate, 
            template, 
            dailyCalories, 
            globalMacros, 
            mealMacroDistribution, 
            overrides = [] 
        } = planData || {};

        // Validation Checks
        if (!planName) throw new Error("Missing required field: planName");
        if (!startDate) throw new Error("Missing required field: startDate");
        if (!endDate) throw new Error("Missing required field: endDate");
        if (!template) throw new Error("Missing required field: template");
        if (!dailyCalories) throw new Error("Missing required field: dailyCalories");
        if (!globalMacros) throw new Error("Missing required field: globalMacros");
        if (!mealMacroDistribution || mealMacroDistribution.length === 0) throw new Error("Missing required field: mealMacroDistribution");

        // 1. Fetch Recipes for Payload Construction (Lightweight/Grouped)
        const groupedRecipes = await fetchRecipesForTemplate(template.id);
        
        // 2. Fetch Full Recipes for Copying (Heavyweight/Detailed)
        const fullTemplateRecipes = await fetchFullTemplateRecipes(template.id);

        // 3. Build Payload and Call Edge Function
        const payload = buildMacroBalancingParams({
            templateId: template.id,
            userId: userId,
            caloriesTarget: dailyCalories,
            macroDistribution: globalMacros,
            mealTargets: mealMacroDistribution,
            startDate: startDate,
            endDate: endDate,
            planName: planName,
            groupedRecipes: groupedRecipes
        });

        // This returns the calculated/balanced ingredients but DOES NOT create the plan in DB
        const edgeResult = await callMacroBalancingEdgeFunction(payload);

        // 4. Create the Diet Plan in Database using the service logic
        const result = await createUserDietFromTemplate(userId, planData, fullTemplateRecipes, edgeResult);
        
        if (!result.success) {
            throw new Error("Failed to create diet plan records.");
        }

        const newPlanId = result.planId;

        // Handle Overrides (if any)
        if (overrides && overrides.length > 0 && newPlanId) {
            // Fix: diet_plan_calorie_overrides does not have effective_date. 
            // It relies on created_at for history tracking.
            const overridesPayload = overrides.map(o => ({
                user_id: userId,
                diet_plan_id: newPlanId,
                manual_calories: o.manual_calories
                // created_at is automatically set by default
            }));

            const { error: overridesError } = await supabase
                .from('diet_plan_calorie_overrides')
                .insert(overridesPayload);
                
            if (overridesError) {
                console.error("Error inserting overrides:", overridesError);
            }
        }

        return result;

    } catch (error) {
        console.error("Assign Diet Plan Error:", error);
        return { success: false, error };
    }
};