import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Eye, Lock } from 'lucide-react';
import CalorieAdjustment from './constructor/CalorieAdjustment';
import MacroDistribution from './constructor/MacroDistribution';
import MealMacroConfiguration from './constructor/MealMacroConfiguration';
import RecipeAssignment from './constructor/RecipeAssignment';
import RecipeEditorModal from '@/components/shared/RecipeEditorModal/RecipeEditorModal';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useRole } from '@/hooks/useRole';

const DietConstructor = ({ userId, dietPlan, onPlanUpdate, isTemplate }) => {
    const { toast } = useToast();
    const navigate = useNavigate();
    const { canAutoBalanceMacros, isFree } = useRole();
    const [calculatedTdee, setCalculatedTdee] = useState(0);
    const [calorieOverrides, setCalorieOverrides] = useState([]);
    const [macrosPct, setMacrosPct] = useState({ protein: 30, carbs: 40, fat: 30 });
    const [meals, setMeals] = useState([]);
    const [planRecipes, setPlanRecipes] = useState([]);
    const [allFoods, setAllFoods] = useState([]);
    const [loading, setLoading] = useState(true);
    const debounceTimeout = useRef(null);
    const isMounted = useRef(true);
    const isInitialLoad = useRef(true);
    
    const [recipeToEdit, setRecipeToEdit] = useState(null);
    const [isEditorOpen, setIsEditorOpen] = useState(false);

    const effectiveTdee = useMemo(() => {
        if(isTemplate) return 2500; // Default for templates
        
        // Find the most recent override (assuming all overrides are valid from their creation date)
        const applicableOverride = calorieOverrides
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
        
        return applicableOverride ? applicableOverride.manual_calories : calculatedTdee;
    }, [calculatedTdee, calorieOverrides, isTemplate]);

    const fetchData = useCallback(async () => {
        if (!isMounted.current) return;
        setLoading(true);
        isInitialLoad.current = true;
        try {
            const { data: foodsData, error: foodsError } = await supabase.from('food').select('*, food_to_food_groups(food_groups(*))');
            if (foodsError) throw foodsError;
            if (isMounted.current) setAllFoods(foodsData);

            if (!isTemplate && userId) {
                const { data: profile, error: profileError } = await supabase.from('profiles').select('tdee_kcal').eq('user_id', userId).single();
                if (profileError) throw profileError;
                if (isMounted.current) setCalculatedTdee(profile.tdee_kcal || 0);
            }

            if (dietPlan) {
                setMacrosPct({ protein: dietPlan.protein_pct || 30, carbs: dietPlan.carbs_pct || 40, fat: dietPlan.fat_pct || 30 });
                
                const { data: recipes, error: recipesError } = await supabase
                    .from('diet_plan_recipes')
                    .select('*, recipe:recipe_id(*, recipe_ingredients(*, food(*))), day_meal:day_meal_id!inner(id, name, display_order), custom_ingredients:diet_plan_recipe_ingredients(*, food(*))')
                    .eq('diet_plan_id', dietPlan.id);
                if (recipesError) throw recipesError;
                if (isMounted.current) setPlanRecipes(recipes);

                // Use created_at for sorting overrides
                const { data: overrides, error: overridesError } = await supabase.from('diet_plan_calorie_overrides').select('*').eq('diet_plan_id', dietPlan.id).order('created_at', { ascending: false });
                if (overridesError) throw overridesError;
                if (isMounted.current) setCalorieOverrides(overrides);
            }

            let userMeals;
            if (!isTemplate && userId) {
                const { data, error } = await supabase.from('user_day_meals').select('*, day_meal:day_meal_id!inner(id, name, display_order)').eq('user_id', userId).order('display_order', { foreignTable: 'day_meal', ascending: true });
                if(error) throw error;
                userMeals = data;
            } else {
                 const { data, error } = await supabase.from('day_meals').select('*').order('display_order', { ascending: true });
                 if(error) throw error;
                 userMeals = data.map(dm => ({ day_meal: dm, id: dm.id, user_id: null }));
            }
            
            if (isMounted.current) {
                const totalMeals = userMeals.length;
                const equitablePct = totalMeals > 0 ? Math.round(100 / totalMeals) : 0;
                const initializedMeals = userMeals.map(meal => ({
                    ...meal,
                    protein_pct: meal.protein_pct ?? equitablePct,
                    carbs_pct: meal.carbs_pct ?? equitablePct,
                    fat_pct: meal.fat_pct ?? equitablePct,
                }));
                setMeals(initializedMeals);
            }

        } catch (error) {
            toast({ title: 'Error', description: `No se pudieron cargar los datos del constructor: ${error.message}`, variant: 'destructive' });
        } finally {
            if (isMounted.current) {
                setLoading(false);
                setTimeout(() => {
                    if (isMounted.current) {
                        isInitialLoad.current = false;
                    }
                }, 100);
            }
        }
    }, [userId, dietPlan, toast, isTemplate]);

    useEffect(() => {
        isMounted.current = true;
        fetchData();
        return () => { isMounted.current = false; if(debounceTimeout.current) clearTimeout(debounceTimeout.current); };
    }, [fetchData]);

    useEffect(() => {
        if (loading || isInitialLoad.current) return;
        if (!canAutoBalanceMacros && isFree) return; // Prevent auto-save if free user restricted

        if (debounceTimeout.current) clearTimeout(debounceTimeout.current);

        debounceTimeout.current = setTimeout(async () => {
            if (!isMounted.current) return;
            try {
                const { error: planError } = await supabase.from('diet_plans').update({
                    protein_pct: macrosPct.protein,
                    carbs_pct: macrosPct.carbs,
                    fat_pct: macrosPct.fat,
                    updated_at: new Date().toISOString()
                }).eq('id', dietPlan.id);
                if (planError) throw planError;
            } catch (error) {
                toast({ title: 'Error de guardado', description: `No se pudo guardar la distribución general: ${error.message}`, variant: 'destructive' });
            }
        }, 1500);

        return () => clearTimeout(debounceTimeout.current);
    }, [macrosPct, dietPlan?.id, toast, loading, canAutoBalanceMacros, isFree]);

    const handleMacroPctChange = (newMacros) => {
        if (!canAutoBalanceMacros) {
            toast({
                title: "Función Bloqueada",
                description: "Mejora tu plan para poder usar esta función y ajustar tus macros.",
                variant: "destructive"
            });
            return;
        }
        setMacrosPct(newMacros);
    };

    const handleSaveMealConfig = async (newMeals) => {
        if (isTemplate) return;
        if (!canAutoBalanceMacros) {
             toast({
                title: "Función Bloqueada",
                description: "Mejora tu plan para poder usar esta función y configurar tus comidas.",
                variant: "destructive"
            });
            return;
        }

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

            await Promise.all(updates);
            toast({ title: 'Guardado', description: 'Configuración de macros por comida guardada.', className: 'bg-green-600 text-white' });
            fetchData();
        } catch (error) {
            toast({ title: 'Error de guardado', description: `No se pudo guardar: ${error.message}`, variant: 'destructive' });
        }
    };

    const handleRecipeClick = (recipe) => {
        setRecipeToEdit(recipe);
        setIsEditorOpen(true);
    };

    const handleEditorSave = () => {
        setIsEditorOpen(false);
        setRecipeToEdit(null);
        fetchData(); 
        if (onPlanUpdate) onPlanUpdate();
    };

    const goToPlanView = () => {
        if (!dietPlan) return;
        const targetPath = dietPlan.is_template 
            ? `/admin-panel/plan-detail/${dietPlan.id}`
            : `/plan/dieta/${userId}/${new Date().toISOString().slice(0,10)}`;
        navigate(targetPath);
    };
    
    if (loading) return <div className="flex justify-center items-center py-10 h-full"><Loader2 className="h-8 w-8 animate-spin text-green-500" /></div>;

    return (
        <>
            <Card className="bg-transparent border-none text-white overflow-hidden shadow-none">
                <CardHeader>
                  <div className="flex justify-between items-start">
                      <div>
                          <CardTitle className="text-2xl flex items-center gap-2">
                              Constructor del Plan - <span className="text-green-400">{dietPlan?.name}</span>
                              {isFree && <span className="px-2 py-0.5 rounded-full bg-gray-700 text-gray-300 text-xs flex items-center gap-1 border border-gray-600"><Lock className="w-3 h-3"/> Free</span>}
                          </CardTitle>
                          <CardDescription>{isTemplate ? "Estás editando una plantilla global." : "Configura el plan de dieta del cliente."}</CardDescription>
                      </div>
                      <Button variant="outline-diet" size="sm" onClick={goToPlanView}>
                          <Eye className="mr-2 h-4 w-4" />
                          Ir al Plan
                      </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-8">
                    {!isTemplate && <CalorieAdjustment
                        calculatedTdee={calculatedTdee}
                        calorieOverrides={calorieOverrides}
                        dietPlanId={dietPlan.id}
                        onOverridesUpdate={fetchData}
                        readOnly={!canAutoBalanceMacros && isFree}
                    />}
                    <MacroDistribution
                        effectiveTdee={effectiveTdee}
                        macrosPct={macrosPct}
                        onMacrosPctChange={handleMacroPctChange}
                        readOnly={!canAutoBalanceMacros && isFree}
                    />
                    {!isTemplate && <MealMacroConfiguration
                        meals={meals}
                        onSaveConfiguration={handleSaveMealConfig}
                        effectiveTdee={effectiveTdee}
                        macrosPct={macrosPct}
                        readOnly={!canAutoBalanceMacros && isFree}
                    />}
                    <RecipeAssignment
                        meals={meals}
                        planRecipes={planRecipes}
                        allFoods={allFoods}
                        onRecipeClick={handleRecipeClick}
                        userId={userId}
                        dietPlanId={dietPlan.id}
                        isTemplate={isTemplate}
                    />
                </CardContent>
            </Card>

            {isEditorOpen && (
                <RecipeEditorModal
                    open={isEditorOpen}
                    onOpenChange={setIsEditorOpen}
                    recipeToEdit={recipeToEdit}
                    onSaveSuccess={handleEditorSave}
                    isAdminView={true}
                    dietPlanRecipeId={recipeToEdit?.id}
                    userId={userId}
                />
            )}
        </>
    );
};

export default DietConstructor;