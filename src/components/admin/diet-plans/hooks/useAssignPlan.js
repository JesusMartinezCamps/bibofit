import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { format, addMonths } from 'date-fns';
import { saveDietPlanRecipeIngredients } from '@/lib/macroCalculator';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export const useAssignPlan = ({ open, onOpenChange, onSuccess, preselectedClient, template }) => {
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
            }
            if (template) {
                setNewPlanName(template.name);
            }
        } else {
            setSelectedClientId('');
            setNewPlanName('');
            setClientRestrictions(null);
            setConflicts({});
            setModifiedRecipes(new Map());
        }
    }, [open, preselectedClient, template, toast, fetchTemplateRecipes, user]);

    // Update plan name when client is selected
    useEffect(() => {
        if (selectedClientId && template && clients.length > 0) {
            const client = clients.find(c => c.user_id === selectedClientId);
            if (client) {
                setNewPlanName(`${template.name} de ${client.full_name}`);
            }
        }
    }, [selectedClientId, template, clients]);

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

    const handleAssign = async (mealConfigs = []) => {
        const [startDate, endDate] = dateRange;
        if (!selectedClientId || !template?.id || !newPlanName || !startDate || !endDate) {
            toast({ title: 'Campos requeridos', description: 'Por favor, selecciona cliente, nombre y un rango de fechas.', variant: 'destructive' });
            return;
        }
        if (Object.keys(conflicts).length > 0) {
            toast({ title: 'Conflictos detectados', description: 'Resuelve los conflictos antes de asignar el plan.', variant: 'destructive' });
            return;
        }
        setIsAssigning(true);
        
        try {
            // 1. Fetch Client TDEE (needed for calculations)
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('tdee_kcal')
                .eq('user_id', selectedClientId)
                .maybeSingle(); 
            
            if (profileError) throw profileError;
            const tdee = profile?.tdee_kcal || 2000;

            // 2. Create Plan First
            const { data: newPlan, error: planError } = await supabase
                .from('diet_plans')
                .insert({
                    user_id: selectedClientId,
                    name: newPlanName,
                    start_date: format(startDate, 'yyyy-MM-dd'),
                    end_date: format(endDate, 'yyyy-MM-dd'),
                    protein_pct: template.protein_pct,
                    carbs_pct: template.carbs_pct,
                    fat_pct: template.fat_pct,
                    is_active: true,
                    is_template: false,
                    source_template_id: template.id,
                })
                .select('id')
                .single();

            if (planError) throw planError;

            // 3. Insert plan-specific user day meals (Macro Objectives)
            // This is crucial to keep the DB consistent
            if (mealConfigs.length > 0) {
                 const totalDailyGrams = {
                    protein: (tdee * (template.protein_pct / 100)) / 4,
                    carbs: (tdee * (template.carbs_pct / 100)) / 4,
                    fat: (tdee * (template.fat_pct / 100)) / 9
                };

                const userDayMealsToInsert = mealConfigs.map(config => {
                    const p_grams = totalDailyGrams.protein * (config.protein_pct / 100);
                    const c_grams = totalDailyGrams.carbs * (config.carbs_pct / 100);
                    const f_grams = totalDailyGrams.fat * (config.fat_pct / 100);
                    const cals = (p_grams * 4) + (c_grams * 4) + (f_grams * 9);

                    return {
                        user_id: selectedClientId,
                        day_meal_id: config.day_meal_id,
                        diet_plan_id: newPlan.id, // Linked to the specific plan we just created
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
                    toast({ title: 'Advertencia', description: 'Se creó el plan pero hubo un error guardando los objetivos de macros.', variant: 'warning' });
                }
            }

            // 4. Calculate Macros using NEW Edge Function
            let adjustedRecipeMap = new Map();

            if (mealConfigs.length > 0) {
                // Group recipes by meal moment (day_meal_id) to prepare for edge function payload
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

                // Construct payload for the batch edge function
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
                
                // Only call edge function if we actually have recipes to process
                const hasRecipesToProcess = mealsPayload.some(m => m.recipe_ids.length > 0);

                if (hasRecipesToProcess) {
                    const payload = {
                        user_id: selectedClientId,
                        tdee: tdee,
                        macro_distribution: {
                            protein: template.protein_pct,
                            carbs: template.carbs_pct,
                            fat: template.fat_pct
                        },
                        meals: mealsPayload
                    };
    
                    console.log("Calling auto-balance-macros-dietPlans with payload:", payload);
    
                    const { data: batchResult, error: batchError } = await supabase.functions.invoke('auto-balance-macros-dietPlans', {
                        body: payload
                    });
    
                    if (batchError) {
                        console.error("Error calculating macros via edge function:", batchError);
                        toast({ title: 'Advertencia', description: 'Hubo un problema calculando las cantidades automáticas. Se usarán las cantidades originales.', variant: 'warning' });
                    }
                    
                    if (batchResult && batchResult.results) {
                        batchResult.results.forEach(res => {
                             // Find the template recipe entry that matches both the recipe_id and the meal moment
                             const recipesForThisMoment = recipesByMeal[res.day_meal_id];
                             const matchedTemplateRecipe = recipesForThisMoment?.find(r => r.recipeId === res.recipe_id);
                             
                             if (matchedTemplateRecipe && res.ingredients) {
                                 adjustedRecipeMap.set(matchedTemplateRecipe.templateRecipeId, res.ingredients);
                             }
                        });
                    }
                }
            }

            // 5. Insert Recipes
            for (const recipe of templateRecipes) {
                const modifiedVersion = modifiedRecipes.get(recipe.id);
                const recipeToCopy = modifiedVersion || recipe;

                // Create the diet_plan_recipe entry
                const { data: newPlanRecipe, error: recipeInsertError } = await supabase
                    .from('diet_plan_recipes')
                    .insert({
                        diet_plan_id: newPlan.id,
                        recipe_id: recipeToCopy.recipe_id,
                        day_meal_id: recipeToCopy.day_meal_id,
                        is_customized: true,
                        custom_name: modifiedVersion ? modifiedVersion.custom_name : recipeToCopy.recipe.name,
                        custom_prep_time_min: modifiedVersion ? modifiedVersion.custom_prep_time_min : recipeToCopy.recipe.prep_time_min,
                        custom_difficulty: modifiedVersion ? modifiedVersion.custom_difficulty : recipeToCopy.recipe.difficulty,
                        custom_instructions: modifiedVersion ? modifiedVersion.custom_instructions : recipeToCopy.recipe.instructions,
                        // Reference the parent recipe in the template (for tracking updates later if needed)
                        parent_diet_plan_recipe_id: recipe.id 
                    })
                    .select('id')
                    .single();

                if (recipeInsertError) throw recipeInsertError;

                // Determine ingredients
                // Priority: 1. Adjusted by edge function, 2. Manual modification in UI, 3. Original template ingredients
                let ingredientsToSave = adjustedRecipeMap.get(recipe.id);
                
                if (!ingredientsToSave) {
                    ingredientsToSave = modifiedVersion 
                        ? modifiedVersion.ingredients 
                        : (recipeToCopy.custom_ingredients?.length > 0 ? recipeToCopy.custom_ingredients : recipeToCopy.recipe.recipe_ingredients);
                }
                
                await saveDietPlanRecipeIngredients(newPlanRecipe.id, ingredientsToSave);
            }
            
            toast({ title: 'Éxito', description: 'Plan asignado correctamente.' });
            if(onSuccess) onSuccess();
            onOpenChange(false);
            
            // Navigate and scroll to recipes section
            navigate(`/admin-panel/plan-detail/${newPlan.id}?scroll=recipes`);
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
