import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { motion } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import PlanHeader from '@/components/admin/diet-plans/PlanHeader';
import PlanView from '@/components/admin/diet-plans/PlanView';
import MacroDistribution from '@/components/plans/constructor/MacroDistribution';
import MealMacroConfiguration from '@/components/plans/constructor/MealMacroConfiguration';
import PlanRecipesView from '@/components/admin/diet-plans/PlanRecipesView';
import TemplatePropertiesSection from '@/components/admin/diet-plans/TemplatePropertiesSection';
import TemplateUsersSection from '@/components/admin/diet-plans/TemplateUsersSection';
import { cn } from '@/lib/utils';

const AdminDietPlanDetailPage = ({
    planIdOverride,
    mode = 'admin',
    readOnlyProperties = false,
    hideUserAssignmentPanel = false,
    canEditMacros = true,
    canEditRecipes = true
}) => {
    const { planId: routePlanId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { toast } = useToast();
    
    // Determine the effective plan ID (prop takes precedence over route param)
    const planId = planIdOverride || routePlanId;

    const [plan, setPlan] = useState(null);
    const [creator, setCreator] = useState(null);
    const [loading, setLoading] = useState(true);
    const [calculatedTdee, setCalculatedTdee] = useState(0);
    const [calorieOverrides, setCalorieOverrides] = useState([]);
    const [macrosPct, setMacrosPct] = useState({ protein: 30, carbs: 40, fat: 30 });
    const [meals, setMeals] = useState([]);
    const debounceTimeout = useRef(null);

    // Check if we should focus on the macros section
    const shouldFocusMacros = useMemo(() => {
        const searchParams = new URLSearchParams(location.search);
        return searchParams.get('focus') === 'macros';
    }, [location.search]);

    const isTemplate = useMemo(() => plan?.is_template || false, [plan]);

    const effectiveTdee = useMemo(() => {
        // Find the most recent override by created_at
        const applicableOverride = calorieOverrides
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
        
        return applicableOverride ? applicableOverride.manual_calories : calculatedTdee;
    }, [calculatedTdee, calorieOverrides]);

    const fetchData = useCallback(async (forceReload = false) => {
        if (!planId) return;
        if (!forceReload) setLoading(true);
        try {
            // First fetch the basic plan data
            const { data: planData, error: planError } = await supabase
                .from('diet_plans')
                .select(`
                    *,
                    sensitivities:diet_plan_sensitivities(sensitivities(id, name, description)),
                    medical_conditions:diet_plan_medical_conditions(medical_conditions(id, name, description)),
                    source_template:source_template_id(name)
                `)
                .eq('id', planId)
                .single();

            if (planError) throw planError;

            // Fetch Profile Data Separately if user_id exists
            // Fixes PGRST116 by using maybeSingle() and conditional fetching
            if (planData.user_id) {
                const { data: profileData, error: profileError } = await supabase
                    .from('profiles')
                    .select('full_name, user_id, tdee_kcal')
                    .eq('user_id', planData.user_id)
                    .maybeSingle();
                
                if (profileError) console.error("Error fetching profile:", profileError);
                planData.profile = profileData;
            }
            
            // Fetch Creator Info manually if created_by exists
            if (planData.created_by) {
                const { data: creatorData, error: creatorError } = await supabase
                    .from('profiles')
                    .select('user_id, full_name')
                    .eq('user_id', planData.created_by)
                    .maybeSingle(); // Fix: use maybeSingle instead of single
                
                if (creatorError) console.error("Error fetching creator:", creatorError);
                setCreator(creatorData);
            }

            if (!planData.is_template) {
                if (planData.user_id) {
                    const [sensitivitiesRes, conditionsRes] = await Promise.all([
                        supabase.from('user_sensitivities').select('sensitivities(id, name, description)').eq('user_id', planData.user_id),
                        supabase.from('user_medical_conditions').select('medical_conditions(id, name, description)').eq('user_id', planData.user_id),
                    ]);
                    planData.sensitivities = sensitivitiesRes.data || [];
                    planData.medical_conditions = conditionsRes.data || [];
                }

                // Use created_at for sorting overrides
                const { data: overridesRes } = await supabase.from('diet_plan_calorie_overrides').select('*').eq('diet_plan_id', planId).order('created_at', { ascending: false });
                setCalorieOverrides(overridesRes || []);

                setCalculatedTdee(planData.profile?.tdee_kcal || 2500);

                // Fetch USER DAY MEALS linked to THIS PLAN
                if (planData.user_id) {
                    const { data: mealsData, error: mealsError } = await supabase.from('user_day_meals')
                        .select('*, day_meal:day_meal_id(*)')
                        .eq('user_id', planData.user_id)
                        .eq('diet_plan_id', planId) // STRICT FILTER
                        .order('display_order', { foreignTable: 'day_meal', ascending: true });

                    if (mealsError) throw mealsError;
                    setMeals(mealsData || []);
                }
            } else {
                // If it is a template, ensure we have the plan-level restrictions loaded (already in initial query)
                // But just in case we need specific structure matching the other view:
                const [planSensitivitiesRes, planConditionsRes] = await Promise.all([
                    supabase.from('diet_plan_sensitivities').select('sensitivities(id, name, description)').eq('diet_plan_id', planId),
                    supabase.from('diet_plan_medical_conditions').select('medical_conditions(id, name, description)').eq('diet_plan_id', planId)
                ]);
                planData.sensitivities = planSensitivitiesRes.data || [];
                planData.medical_conditions = planConditionsRes.data || [];
                setCalculatedTdee(2500); // Default TDEE for templates
                setMeals([]);
                setCalorieOverrides([]);
            }

            setPlan(planData);
            setMacrosPct({ protein: planData.protein_pct, carbs: planData.carbs_pct, fat: planData.fat_pct });

        } catch (error) {
            console.error("Critical error in AdminDietPlanDetailPage:", error);
            toast({ title: "Error", description: `No se pudo cargar el plan: ${error.message}`, variant: "destructive" });
            if (mode === 'admin') navigate('/admin-panel/content/plan-templates');
        } finally {
            if (!forceReload) setLoading(false);
        }
    }, [planId, toast, navigate, mode]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);
    
    // Auto-save macros effect (debounced)
    useEffect(() => {
        // Skip auto-save if editing macros is disabled or no plan loaded
        if (!canEditMacros || !plan) return;

        if (debounceTimeout.current) {
            clearTimeout(debounceTimeout.current);
        }
        debounceTimeout.current = setTimeout(async () => {
            const { error } = await supabase.from('diet_plans').update({
                protein_pct: macrosPct.protein,
                carbs_pct: macrosPct.carbs,
                fat_pct: macrosPct.fat
            }).eq('id', plan.id);

            if (error) {
                toast({ title: 'Error', description: `No se pudo guardar la configuración de macros del plan: ${error.message}`, variant: 'destructive' });
            }
        }, 1500);

        return () => {
            if (debounceTimeout.current) {
                clearTimeout(debounceTimeout.current);
            }
        };
    }, [macrosPct, plan, toast, canEditMacros]);

    const handleMacrosPctChange = (newMacros) => {
        if (!canEditMacros) return;
        setMacrosPct(newMacros);
    };

    const handleSaveMealConfig = useCallback(async (newMeals) => {
        if (isTemplate || !canEditMacros) return;
        try {
            const totalGrams = {
                protein: Math.round((effectiveTdee * (macrosPct.protein / 100)) / 4),
                carbs: Math.round((effectiveTdee * (macrosPct.carbs / 100)) / 4),
                fat: Math.round((effectiveTdee * (macrosPct.fat / 100)) / 9)
            };

            const updates = newMeals.map(meal => {
                const target_proteins = Math.round(totalGrams.protein * (meal.protein_pct / 100));
                const target_carbs = Math.round(totalGrams.carbs * (meal.carbs_pct / 100));
                const target_fats = Math.round(totalGrams.fat * (meal.fat_pct / 100));
                const target_calories = (target_proteins * 4) + (target_carbs * 4) + (target_fats * 9);

                return supabase.from('user_day_meals').update({
                    protein_pct: meal.protein_pct,
                    carbs_pct: meal.carbs_pct,
                    fat_pct: meal.fat_pct,
                    target_proteins,
                    target_carbs,
                    target_fats,
                    target_calories
                }).eq('id', meal.id);
            });

            const results = await Promise.all(updates);
            const hasError = results.some(res => res.error);

            if (hasError) {
                const errorMsg = results.find(res => res.error)?.error.message;
                throw new Error(errorMsg || 'Ocurrió un error al guardar.');
            }

            toast({ title: 'Guardado', description: 'Configuración de macros por comida guardada.', className: 'bg-green-600 text-white' });
            fetchData(true);
        } catch (error) {
            toast({ title: 'Error', description: `No se pudo guardar: ${error.message}`, variant: 'destructive' });
        }
    }, [isTemplate, effectiveTdee, macrosPct, toast, fetchData, canEditMacros]);

    const handlePlanUpdate = useCallback(() => {
        fetchData(true);
    }, [fetchData]);

    const handleToggleActive = useCallback(async (newActiveState) => {
        if (!plan || plan.is_template || readOnlyProperties) return;
    
        try {
            const { error } = await supabase
                .from('diet_plans')
                .update({ is_active: newActiveState })
                .eq('id', plan.id);
    
            if (error) throw error;
    
            setPlan(prev => ({ ...prev, is_active: newActiveState }));
            toast({
                title: 'Estado del plan actualizado',
                description: `El plan ahora está ${newActiveState ? 'activo' : 'inactivo'}`,
            });
    
            if (newActiveState) {
                const { error: deactivateError } = await supabase
                    .from('diet_plans')
                    .update({ is_active: false })
                    .eq('user_id', plan.user_id)
                    .not('id', 'eq', plan.id);
    
                if (deactivateError) {
                    console.error("Error deactivating other plans:", deactivateError);
                }
            }
        } catch (error) {
            toast({
                title: 'Error',
                description: `No se pudo actualizar el estado del plan: ${error.message}`,
                variant: 'destructive',
            });
        }
    }, [plan, toast, readOnlyProperties]);
    
    if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="w-12 h-12 animate-spin text-green-500" /></div>;
    if (!plan) return <div className="text-center text-red-500 p-8">No se encontró el plan de dieta.</div>;

    const clientName = plan?.profile?.full_name || 'Cliente';

    return (
        <main className="w-full space-y-8">
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                {!isTemplate ? (
                    // CLIENT PLAN VIEW (Assigned Plan)
                    <>
                         {mode === 'admin' && (
                             <h1 className="text-4xl md:text-5xl font-extrabold mb-8 mt-6 text-center bg-gradient-to-r from-[#51ff77bf] to-green-300 bg-clip-text text-transparent">
                                Gestor de Dieta de {clientName}
                            </h1>
                         )}
                        
                        <PlanHeader 
                            plan={plan} 
                            onUpdate={handlePlanUpdate} 
                            onToggleActive={handleToggleActive} 
                            readOnly={readOnlyProperties}
                        />

                        <div className="my-8 grid grid-cols-1 lg:grid-cols-5 gap-8">
                             <div className="lg:col-span-2">
                                <MacroDistribution
                                    effectiveTdee={effectiveTdee}
                                    macrosPct={macrosPct}
                                    onMacrosPctChange={handleMacrosPctChange}
                                    calorieOverrides={calorieOverrides}
                                    dietPlanId={plan.id}
                                    onOverridesUpdate={() => fetchData(true)}
                                    isTemplate={isTemplate}
                                    readOnly={!canEditMacros}
                                />
                            </div>
                            {meals.length > 0 && (
                                <div className="lg:col-span-3">
                                    <MealMacroConfiguration
                                        meals={meals}
                                        onSaveConfiguration={handleSaveMealConfig}
                                        effectiveTdee={effectiveTdee}
                                        macrosPct={macrosPct}
                                        shouldAutoExpand={shouldFocusMacros}
                                        readOnly={!canEditMacros}
                                        hideSaveButton={!canEditMacros}
                                    />
                                </div>
                            )}
                        </div>
                        <PlanView 
                            plan={plan} 
                            onUpdate={handlePlanUpdate} 
                            userDayMeals={meals} 
                            isAssignedPlan={true} 
                            readOnly={!canEditRecipes}
                        />
                    </>
                ) : (
                    // TEMPLATE VIEW
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                            <div className={cn("xl:col-span-3", !hideUserAssignmentPanel && "xl:col-span-2")}>
                                <TemplatePropertiesSection 
                                    plan={plan} 
                                    creator={creator}
                                    onUpdate={handlePlanUpdate} 
                                />
                            </div>
                            {!hideUserAssignmentPanel && (
                                <div className="xl:col-span-1">
                                    <TemplateUsersSection plan={plan} onUpdate={handlePlanUpdate} />
                                </div>
                            )}
                        </div>
                        
                        <div className="grid grid-cols-1">
                            <MacroDistribution
                                effectiveTdee={effectiveTdee}
                                macrosPct={macrosPct}
                                onMacrosPctChange={handleMacrosPctChange}
                                calorieOverrides={calorieOverrides}
                                dietPlanId={plan.id}
                                onOverridesUpdate={() => fetchData(true)}
                                isTemplate={isTemplate}
                                readOnly={!canEditMacros}
                            />
                        </div>
                        
                        <PlanRecipesView 
                            plan={plan} 
                            onUpdate={handlePlanUpdate} 
                            readOnly={!canEditRecipes}
                        />
                    </div>
                )}
            </motion.div>
        </main>
    );
};

export default AdminDietPlanDetailPage;