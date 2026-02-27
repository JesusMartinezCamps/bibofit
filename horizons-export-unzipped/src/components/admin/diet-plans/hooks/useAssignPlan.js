import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { format, addMonths } from 'date-fns';
import { saveDietPlanRecipeIngredients, calculateMacros, saveRecipeMacros } from '@/lib/macroCalculator';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { invokeAutoBalanceDietPlans } from '@/lib/autoBalanceClient';

export const useAssignPlan = ({ open, onOpenChange, onSuccess, preselectedClient, template, mode = 'adminAssign', forcedUserId }) => {
    const { toast } = useToast();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [clients, setClients] = useState([]);
    const [selectedClientId, setSelectedClientId] = useState('');
    const [clientRestrictions, setClientRestrictions] = useState(null);
    const [newPlanName, setNewPlanName] = useState('');
    
    // Initialize date range: Today to 3 months from now
    const [dateRange, setDateRange] = useState(() => {
        const start = new Date();
        const end = addMonths(start, 3);
        return [start, end];
    });

    const [isAssigning, setIsAssigning] = useState(false);
    const [conflicts, setConflicts] = useState({});
    const [isCheckingConflicts, setIsCheckingConflicts] = useState(false);
    const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
    const [templateRecipes, setTemplateRecipes] = useState([]);
    const [modifiedRecipes, setModifiedRecipes] = useState(new Map());

    const planRestrictionsForEditor = useMemo(() => {
        if (!clientRestrictions) return { sensitivities: [], conditions: [] };
        return {
            sensitivities: clientRestrictions.sensitivities.map(s => s.id),
            conditions: clientRestrictions.conditions.map(c => c.id)
        };
    }, [clientRestrictions]);
    
    const updateRecipeInState = (updatedRecipe) => {
        setModifiedRecipes(prev => new Map(prev).set(updatedRecipe.id, updatedRecipe));
        
        const newConflicts = { ...conflicts };
        Object.keys(newConflicts).forEach(key => {
            newConflicts[key] = newConflicts[key].filter(r => r.id !== updatedRecipe.id);
            if (newConflicts[key].length === 0) {
                delete newConflicts[key];
            }
        });
        setConflicts(newConflicts);
    };

    const fetchTemplateRecipes = useCallback(async () => {
        if (!template?.id) return;
        const { data, error } = await supabase
            .from('diet_plan_recipes')
            .select('*, recipe:recipe_id(*, recipe_ingredients(*, food(*, food_sensitivities(sensitivity_id), food_medical_conditions(*)))), custom_ingredients:diet_plan_recipe_ingredients(*, food(*, food_sensitivities(sensitivity_id), food_medical_conditions(*))))')
            .eq('diet_plan_id', template.id);
        if (error) {
            toast({ title: 'Error', description: 'No se pudieron cargar las recetas de la plantilla.', variant: 'destructive' });
            setTemplateRecipes([]);
        } else {
            setTemplateRecipes(data || []);
        }
    }, [template, toast]);

    useEffect(() => {
        if (open) {
            fetchTemplateRecipes();
            const start = new Date();
            const end = addMonths(start, 3);
            setDateRange([start, end]);

            const fetchClients = async () => {
                try {
                    let clientIds = [];

                     if (mode === 'selfAssign') {
                        // Self-assign mode: only the authenticated user is allowed
                        setClients(preselectedClient ? [preselectedClient] : [{ user_id: forcedUserId || user.id, full_name: user.full_name || user.email }]);
                        return;
                     }
                    
                    if (user?.role === 'admin') {
                        const { data: clientRoles, error: rolesError } = await supabase
                            .from('user_roles')
                            .select('user_id, roles!inner(role)')
                            .eq('roles.role', 'client');

                        if (rolesError) throw rolesError;
                        clientIds = clientRoles?.map(r => r.user_id) || [];
                    } else {
                         const { data: myClients, error: clientsError } = await supabase
                            .from('coach_clients')
                            .select('client_id')
                            .eq('coach_id', user.id);
                        
                        if (clientsError) throw clientsError;
                        clientIds = myClients?.map(c => c.client_id) || [];
                    }

                    if (clientIds.length === 0) {
                        setClients([]);
                        return;
                    }

                    const { data: clientsData, error: clientsError } = await supabase
                        .from('profiles')
                        .select('user_id, full_name')
                        .in('user_id', clientIds)
                        .order('full_name');

                    if (clientsError) throw clientsError;
                    
                    setClients(clientsData || []);

                } catch (error) {
                    console.error("Error fetching clients:", error);
                    toast({ title: 'Error', description: 'No se pudieron cargar los clientes.', variant: 'destructive' });
                }
            };

            if (!preselectedClient) {
                fetchClients();
            } else {
                setClients([preselectedClient]);
            }
            
            if(preselectedClient) {
                setSelectedClientId(preselectedClient.user_id);
            } else if (mode === 'selfAssign') {
                setSelectedClientId(forcedUserId || user.id);
            }
            if (template) {
                const fallbackName = user?.full_name ? `${template.name} de ${user.full_name}` : template.name;
                setNewPlanName(mode === 'selfAssign' ? fallbackName : template.name);
            }
        } else {
            setSelectedClientId('');
            setNewPlanName('');
            setClientRestrictions(null);
            setConflicts({});
            setModifiedRecipes(new Map());
        }
    }, [open, preselectedClient, template, toast, fetchTemplateRecipes, user, mode, forcedUserId]);

    // Update plan name when client is selected
    useEffect(() => {
        if (selectedClientId && template && clients.length > 0 && mode !== 'selfAssign') {
            const client = clients.find(c => c.user_id === selectedClientId);
            if (client) {
                setNewPlanName(`${template.name} de ${client.full_name}`);
            }
        }
    }, [selectedClientId, template, clients, mode]);

    const checkConflicts = useCallback(() => {
        if (!clientRestrictions || !templateRecipes.length) {
            setConflicts({});
            return;
        }
        setIsCheckingConflicts(true);
        const newConflicts = {};

        const clientSensitivityIds = new Set(clientRestrictions.sensitivities.map(s => s.id));
        const clientConditionIds = new Set(clientRestrictions.conditions.map(c => c.id));

        templateRecipes.forEach(recipe => {
            const ingredientsSource = recipe.custom_ingredients?.length > 0 
                ? recipe.custom_ingredients 
                : recipe.recipe?.recipe_ingredients || [];

            const ingredients = ingredientsSource.map(i => i?.food).filter(Boolean);
            
            ingredients.forEach(food => {
                if (!food) return;
                (food.food_sensitivities || []).forEach(fs => {
                    if (clientSensitivityIds.has(fs.sensitivity_id)) {
                        const restriction = clientRestrictions.sensitivities.find(s => s.id === fs.sensitivity_id);
                        if (restriction) {
                            if (!newConflicts[restriction.name]) newConflicts[restriction.name] = [];
                            if (!newConflicts[restriction.name].some(r => r.id === recipe.id)) {
                                newConflicts[restriction.name].push(recipe);
                            }
                        }
                    }
                });
                (food.food_medical_conditions || []).forEach(fmc => {
                    if (clientConditionIds.has(fmc.condition_id) && fmc.relation_type === 'to_avoid') {
                        const restriction = clientRestrictions.conditions.find(c => c.id === fmc.condition_id);
                        if (restriction) {
                            if (!newConflicts[restriction.name]) newConflicts[restriction.name] = [];
                            if (!newConflicts[restriction.name].some(r => r.id === recipe.id)) {
                                newConflicts[restriction.name].push(recipe);
                            }
                        }
                    }
                });
            });
        });
        setConflicts(newConflicts);
        setIsCheckingConflicts(false);
    }, [clientRestrictions, templateRecipes]);

    useEffect(() => {
        const fetchClientRestrictions = async () => {
            if (!selectedClientId) {
                setClientRestrictions(null);
                setConflicts({});
                return;
            }
            try {
                const { data: sensitivities, error: sensError } = await supabase.from('user_sensitivities').select('sensitivities(id, name)').eq('user_id', selectedClientId);
                if (sensError) throw sensError;

                const { data: conditions, error: condError } = await supabase.from('user_medical_conditions').select('medical_conditions(id, name)').eq('user_id', selectedClientId);
                if (condError) throw condError;

                setClientRestrictions({
                    sensitivities: sensitivities.map(s => s.sensitivities).filter(Boolean),
                    conditions: conditions.map(c => c.medical_conditions).filter(Boolean),
                });
            } catch (error) {
                toast({ title: 'Error', description: 'No se pudieron cargar las restricciones del cliente.', variant: 'destructive' });
            }
        };
        fetchClientRestrictions();
    }, [selectedClientId, toast]);

    useEffect(() => {
        checkConflicts();
    }, [clientRestrictions, templateRecipes, checkConflicts]);

    const handleAssign = async (
        mealConfigs = [],
        globalMacrosOverride = null,
        effectiveTdeeOverride = null,
        offlineOverrides = []
    ) => {
        const [startDate, endDate] = dateRange;
        if (!selectedClientId || !template?.id || !newPlanName || !startDate || !endDate) {
            toast({ title: 'Campos requeridos', description: 'Por favor, selecciona cliente, nombre y un rango de fechas.', variant: 'destructive' });
            return;
        }
        if (mode === 'selfAssign' && selectedClientId !== (forcedUserId || user.id)) {
            toast({ title: 'Permiso denegado', description: 'Solo puedes asignarte un plan a ti mismo.', variant: 'destructive' });
            return;
        }
        if (Object.keys(conflicts).length > 0) {
            toast({ title: 'Conflictos detectados', description: 'Resuelve los conflictos antes de asignar el plan.', variant: 'destructive' });
            return;
        }
        setIsAssigning(true);
        
        try {
            // Determine effective macros (use override if present, else template defaults)
            const proteinPct = globalMacrosOverride?.protein ?? template.protein_pct;
            const carbsPct = globalMacrosOverride?.carbs ?? template.carbs_pct;
            const fatPct = globalMacrosOverride?.fat ?? template.fat_pct;

            // 1. Fetch Client TDEE (needed for calculations)
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('tdee_kcal')
                .eq('user_id', selectedClientId)
                .maybeSingle(); 
            
            if (profileError) throw profileError;
            const baseTdee = profile?.tdee_kcal || 2000;
            const effectiveTdee = effectiveTdeeOverride || baseTdee;

            // 2. Create Plan First
            const { data: newPlan, error: planError } = await supabase
                .from('diet_plans')
                .insert({
                    user_id: selectedClientId,
                    name: newPlanName,
                    start_date: format(startDate, 'yyyy-MM-dd'),
                    end_date: format(endDate, 'yyyy-MM-dd'),
                    protein_pct: proteinPct,
                    carbs_pct: carbsPct,
                    fat_pct: fatPct,
                    is_active: true,
                    is_template: false,
                    source_template_id: template.id,
                })
                .select('id')
                .single();

            if (planError) throw planError;

            // 2b. Persist calorie override if provided
            const latestOverride = offlineOverrides
                ?.filter(o => o?.manual_calories)
                ?.sort((a, b) => new Date(b.created_at || new Date()) - new Date(a.created_at || new Date()))[0];

            if (latestOverride) {
                const { error: overrideError } = await supabase
                    .from('diet_plan_calorie_overrides')
                    .insert({
                        diet_plan_id: newPlan.id,
                        user_id: selectedClientId,
                        manual_calories: latestOverride.manual_calories
                    });
                if (overrideError) throw overrideError;
            }

            // 3. Insert plan-specific user day meals (Macro Objectives)
            if (mealConfigs.length > 0) {
                 const totalDailyGrams = {
                     protein: (effectiveTdee * (proteinPct / 100)) / 4,
                     carbs: (effectiveTdee * (carbsPct / 100)) / 4,
                     fat: (effectiveTdee * (fatPct / 100)) / 9
                 };

                const userDayMealsToInsert = mealConfigs.map(config => {
                    const p_grams = totalDailyGrams.protein * (config.protein_pct / 100);
                    const c_grams = totalDailyGrams.carbs * (config.carbs_pct / 100);
                    const f_grams = totalDailyGrams.fat * (config.fat_pct / 100);
                    const cals = (p_grams * 4) + (c_grams * 4) + (f_grams * 9);

                    return {
                        user_id: selectedClientId,
                        day_meal_id: config.day_meal_id,
                        diet_plan_id: newPlan.id,
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
                    console.error("Error inserting plan-specific user day meals:", udmError);
                    toast({ title: 'Advertencia', description: 'Se creó el plan pero hubo un error guardando los objetivos de macros.', variant: 'destructive' });
                }
            }

            // 4. Calculate Macros using NEW Edge Function
            let adjustedRecipeMap = new Map();

            if (mealConfigs.length > 0) {
                const recipesByMeal = templateRecipes.reduce((acc, recipe) => {
                    const mealId = recipe.day_meal_id;
                    if (!acc[mealId]) acc[mealId] = [];
                    
                    const recipeId = recipe.recipe_id;
                    acc[mealId].push({
                        templateRecipeId: recipe.id,
                        recipeId: recipeId
                    });
                    return acc;
                }, {});

                const mealsPayload = mealConfigs.map(config => {
                    const recipesForThisMoment = recipesByMeal[config.day_meal_id] || [];
                    const recipeIds = recipesForThisMoment.map(r => r.recipeId);
                    
                    return {
                        day_meal_id: config.day_meal_id,
                        protein_pct: config.protein_pct,
                        carbs_pct: config.carbs_pct,
                        fat_pct: config.fat_pct,
                        recipe_ids: recipeIds
                    };
                });
                
                const hasRecipesToProcess = mealsPayload.some(m => m.recipe_ids.length > 0);

                if (hasRecipesToProcess) {
                    const payload = {
                        user_id: selectedClientId,
                        tdee: effectiveTdee,
                        macro_distribution: {
                            protein: proteinPct,
                            carbs: carbsPct,
                            fat: fatPct
                        },
                        meals: mealsPayload
                    };
        
                    let batchResult = null;
                    try {
                        batchResult = await invokeAutoBalanceDietPlans(payload);
                    } catch (batchError) {
                        console.error("Error calculating macros via edge function:", batchError);
                        toast({ title: 'Advertencia', description: 'Hubo un problema calculando las cantidades automáticas. Se usarán las cantidades originales.', variant: 'warning' });
                    }
                    
                    if (batchResult && batchResult.results) {
                        batchResult.results.forEach(res => {
                             const recipesForThisMoment = recipesByMeal[res.day_meal_id];
                             const matchedTemplateRecipe = recipesForThisMoment?.find(r => r.recipeId === res.recipe_id);
                             
                             if (matchedTemplateRecipe && res.ingredients) {
                                 adjustedRecipeMap.set(matchedTemplateRecipe.templateRecipeId, res.ingredients);
                             }
                        });
                    }
                }
            }

            // 5. Insert Recipes with proper ingredient handling
            for (const recipe of templateRecipes) {
                const modifiedVersion = modifiedRecipes.get(recipe.id);
                
                let ingredientsToSave = [];
                let source = "original";
                let recipePayload = {};
                
                // --- LOGIC SPLIT: Modified vs Original/Auto-Balanced ---
                
                if (modifiedVersion) {                    
                    // CASE 1: MANUAL MODIFICATION
                    // As requested: New independent recipe, ignoring original recipe_id, strictly using custom_ingredients
                    recipePayload = {
                        diet_plan_id: newPlan.id,
                        recipe_id: null, // Detach from original recipe
                        day_meal_id: recipe.day_meal_id,
                        is_customized: true,
                        custom_name: modifiedVersion.custom_name || modifiedVersion.name,
                        custom_prep_time_min: modifiedVersion.custom_prep_time_min || modifiedVersion.prep_time_min,
                        custom_difficulty: modifiedVersion.custom_difficulty || modifiedVersion.difficulty,
                        custom_instructions: modifiedVersion.custom_instructions || modifiedVersion.instructions,
                        parent_diet_plan_recipe_id: recipe.id // Maintain hierarchy link
                    };
                    
                    ingredientsToSave = modifiedVersion.custom_ingredients || [];
                    source = "manual-modified-custom-ingredients";

                } else {                    
                    // CASE 2: STANDARD / AUTO-BALANCED
                    // Standard copy of template recipe
                    recipePayload = {
                        diet_plan_id: newPlan.id,
                        recipe_id: recipe.recipe_id, // Keep link to original recipe
                        day_meal_id: recipe.day_meal_id,
                        is_customized: true,
                        custom_name: recipe.custom_name || recipe.recipe?.name,
                        custom_prep_time_min: recipe.custom_prep_time_min || recipe.recipe?.prep_time_min,
                        custom_difficulty: recipe.custom_difficulty || recipe.recipe?.difficulty,
                        custom_instructions: recipe.custom_instructions || recipe.recipe?.instructions,
                        parent_diet_plan_recipe_id: recipe.id
                    };

                    // Check for Auto-balanced ingredients
                    if (adjustedRecipeMap.has(recipe.id)) {
                        ingredientsToSave = adjustedRecipeMap.get(recipe.id);
                        source = "auto-balanced";
                    } else {
                        // Fallback to original ingredients
                        ingredientsToSave = recipe.custom_ingredients?.length > 0 
                            ? recipe.custom_ingredients 
                            : recipe.recipe?.recipe_ingredients;
                        source = "original-template";
                    }
                }

                // Insert the diet_plan_recipe entry
                const { data: newPlanRecipe, error: recipeInsertError } = await supabase
                    .from('diet_plan_recipes')
                    .insert(recipePayload)
                    .select('id')
                    .single();

                if (recipeInsertError) throw recipeInsertError;
                const newRecipeId = newPlanRecipe.id;
                
                // Normalization of ingredients
                const normalizedIngredients = (ingredientsToSave || []).map((ing, idx) => {
                    const foodId = ing.food_id || ing.food?.id;
                    const grams = parseFloat(ing.grams || ing.quantity || 0);
                    
                    const normalized = {
                        diet_plan_recipe_id: newRecipeId,
                        food_id: foodId ? parseInt(foodId, 10) : undefined,
                        grams: grams,
                        food: ing.food // Preserve for macro calculation
                    };

                    return normalized;
                }).filter(i => {
                    const isValid = i.food_id && i.grams > 0;
                    if (!isValid) console.warn(`[DEBUG] Recipe ${recipe.id}: Dropping invalid ingredient`, i);
                    return isValid;
                });
                
                // Save the ingredients
                if (normalizedIngredients.length > 0) {
                    const result = await saveDietPlanRecipeIngredients(newRecipeId, normalizedIngredients);
                    if (!result.success) {
                        console.error(`[DEBUG] Recipe ${recipe.id}: Error saving ingredients:`, result.error);
                    }
                }

                // Calculate and save macros immediately based on the final ingredients
                const macros = calculateMacros(normalizedIngredients);
                await saveRecipeMacros(null, newRecipeId, macros);
            }
            
            toast({ title: 'Éxito', description: 'Plan asignado correctamente con todas las modificaciones.' });
            if(onSuccess) onSuccess();
            onOpenChange(false);

            // Navigate to the appropriate detail page
            if (mode === 'selfAssign') {
                navigate(`/my-plan`);
            } else {
                navigate(`/admin-panel/plan-detail/${newPlan.id}?scroll=recipes`);
            }
            
        } catch (error) {
            console.error("Assign error", error);
            toast({ title: 'Error', description: `No se pudo asignar el plan: ${error.message}`, variant: 'destructive' });
        } finally {
            setIsAssigning(false);
        }
    };
    
    return {
        clients,
        selectedClientId,
        setSelectedClientId,
        clientRestrictions,
        newPlanName,
        setNewPlanName,
        dateRange,
        setDateRange,
        isAssigning,
        isCheckingConflicts,
        conflicts,
        isConflictModalOpen,
        setIsConflictModalOpen,
        planRestrictionsForEditor,
        updateRecipeInState,
        handleAssign
    };
};
