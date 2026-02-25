import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Loader2 } from 'lucide-react';
import AddRecipeToPlanDialog from '@/components/plans/AddRecipeToPlanDialog';
import RecipeEditorModal from '@/components/shared/RecipeEditorModal/RecipeEditorModal';
import RecipeCard from '@/components/shared/WeeklyDietPlanner/RecipeCard';
import { useAuth } from '@/contexts/AuthContext';

const MealSection = ({ meal, recipes, onAdd, onEdit, onDelete, allFoods, planRestrictions, user, readOnly }) => (
    <div key={meal.id} className="bg-slate-900/50 rounded-lg border border-gray-800 overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-3 border-b border-gray-800 bg-slate-900/80">
            <h3 className="text-lg font-bold text-white">{meal.name}</h3>
            {!readOnly && (
                <Button onClick={() => onAdd(meal)} size="icon" variant="ghost" className="h-7 w-7 text-green-500 hover:bg-green-500/10 hover:text-green-400">
                    <Plus className="h-5 w-5" />
                </Button>
            )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-y-3 gap-x-0 md:gap-4 p-0 md:p-4">
            {recipes.length > 0 ? (
                recipes.map(pr => (
                    <RecipeCard
                        key={pr.id}
                        recipe={pr}
                        user={user}
                        allFoods={allFoods}
                        handleRecipeClick={onEdit}
                        handleRemoveRecipe={readOnly ? undefined : onDelete}
                        isListView={true}
                        userRestrictions={planRestrictions}
                        isAdminView={true}
                        hideQuantities={true}
                        hideMacros={true}
                        readOnly={readOnly}
                    />
                ))
            ) : (
                <div className="md:col-span-2 lg:col-span-3 xl:col-span-4 p-4">
                    <p className="text-sm text-gray-500 text-center italic py-4 bg-gray-900/40 rounded-lg">No hay recetas asignadas a esta comida.</p>
                </div>
            )}
        </div>
    </div>
);

const PlanRecipesView = ({ plan, onUpdate, readOnly = false, clientRestrictions }) => {
    const { toast } = useToast();
    const { user } = useAuth();
    const [recipes, setRecipes] = useState([]);
    const [dayMeals, setDayMeals] = useState([]);
    const [allFoods, setAllFoods] = useState([]);
    const [loading, setLoading] = useState(true);
    const [planRestrictions, setPlanRestrictions] = useState({ sensitivities: [], conditions: [] });
    
    const [isAddRecipeOpen, setIsAddRecipeOpen] = useState(false);
    const [mealToAddTo, setMealToAddTo] = useState(null);
    
    const [isRecipeEditorOpen, setIsRecipeEditorOpen] = useState(false);
    const [recipeToView, setRecipeToView] = useState(null);
    const [isAddingRecipe, setIsAddingRecipe] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [recipesRes, mealsRes, foodsRes, planSensitivitiesRes, planConditionsRes, allConditionsRes] = await Promise.all([
                supabase.from('diet_plan_recipes')
                    .select('*, recipe:recipe_id(*, recipe_ingredients(*, food(*, food_sensitivities(*), food_medical_conditions(*)))), custom_ingredients:diet_plan_recipe_ingredients(*, food(*, food_sensitivities(*), food_medical_conditions(*)))')
                    .eq('diet_plan_id', plan.id)
                    .not('day_meal_id', 'is', null),
                supabase.from('day_meals').select('*').order('display_order'),
                supabase.from('food').select('*, food_sensitivities(*), food_medical_conditions(*)'),
                supabase.from('diet_plan_sensitivities').select('sensitivity_id').eq('diet_plan_id', plan.id),
                supabase.from('diet_plan_medical_conditions').select('condition_id').eq('diet_plan_id', plan.id),
                supabase.from('medical_conditions').select('id, name'),
            ]);

            if (recipesRes.error) throw recipesRes.error;
            if (mealsRes.error) throw mealsRes.error;
            if (foodsRes.error) throw foodsRes.error;
            if (planSensitivitiesRes.error) throw planSensitivitiesRes.error;
            if (planConditionsRes.error) throw planConditionsRes.error;
            if (allConditionsRes.error) throw allConditionsRes.error;
            
            // If clientRestrictions are provided (in preview mode), use them. 
            // Otherwise, use the plan's own restrictions.
            let restrictions;
            if (clientRestrictions) {
                // Combine plan restrictions with client specific restrictions for conflict checking
                 restrictions = {
                    sensitivities: [...new Set([...clientRestrictions.sensitivities, ...planSensitivitiesRes.data.map(s => s.sensitivity_id)])],
                    conditions: [...new Set([...clientRestrictions.conditions, ...planConditionsRes.data.map(c => c.condition_id)])],
                    allMedicalConditions: allConditionsRes.data || [],
                };
            } else {
                 restrictions = {
                    sensitivities: planSensitivitiesRes.data.map(s => s.sensitivity_id),
                    conditions: planConditionsRes.data.map(c => c.condition_id),
                    allMedicalConditions: allConditionsRes.data || [],
                };
            }

            setPlanRestrictions(restrictions);

            setRecipes(recipesRes.data || []);
            setDayMeals(mealsRes.data || []);
            setAllFoods(foodsRes.data || []);
        } catch (error) {
            toast({ title: 'Error', description: `No se pudieron cargar los datos: ${error.message}`, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [plan, toast, clientRestrictions]);
    
    useEffect(() => {
        if (plan) fetchData();
    }, [plan, fetchData]);

    const handleDeleteRecipe = async (recipeId) => {
        if (readOnly) return;
        const { error } = await supabase.from('diet_plan_recipes').delete().eq('id', recipeId);
        if (error) {
            toast({ title: 'Error al eliminar', description: error.message, variant: 'destructive' });
        } else {
            toast({ title: 'Receta eliminada' });
            setRecipes(prev => prev.filter(r => r.id !== recipeId));
        }
    };

    const handleAddRecipe = (meal) => {
        if (readOnly) return;
        setMealToAddTo(meal);
        setIsAddRecipeOpen(true);
    };
    
    const handleViewRecipe = (planRecipe) => {
        setRecipeToView(planRecipe);
        setIsAddingRecipe(false);
        setIsRecipeEditorOpen(true);
    };

    const handleRecipeAdded = useCallback(async (recipe) => {
        if (!mealToAddTo) return;
        
        try {
            const { data: newPlanRecipe, error } = await supabase
                .from('diet_plan_recipes')
                .insert({
                    diet_plan_id: plan.id,
                    recipe_id: recipe.id,
                    day_meal_id: mealToAddTo.id,
                    is_customized: false,
                })
                .select('id')
                .single();

            if (error) throw error;

            const { data: fullRecord, error: fetchError } = await supabase
                 .from('diet_plan_recipes')
                 .select('*, recipe:recipe_id(*, recipe_ingredients(*, food(*, food_sensitivities(*), food_medical_conditions(*)))), custom_ingredients:diet_plan_recipe_ingredients(*, food(*, food_sensitivities(*), food_medical_conditions(*)))')
                 .eq('id', newPlanRecipe.id)
                 .single();

            if (fetchError) throw fetchError;

            setRecipes(prev => [...prev, fullRecord]);
            toast({ title: 'Éxito', description: `${recipe.name} añadida al plan.` });
            setIsAddRecipeOpen(false);
        } catch (error) {
            toast({ title: 'Error', description: `No se pudo añadir la receta: ${error.message}`, variant: 'destructive' });
        }
    }, [plan.id, mealToAddTo, toast]);

    const handleOpenEditorForConflict = (recipe, conflicts) => {
        if (readOnly) return;
        const mealForRecipe = mealToAddTo;
        if (!mealForRecipe) {
            toast({ title: 'Error', description: 'No se ha seleccionado un momento del día.', variant: 'destructive' });
            return;
        }

        const detachedRecipe = {
            is_customized: false,
            recipe: recipe,
            day_meal_id: mealForRecipe.id,
            dietPlanId: plan.id,
            recipeTemplateId: recipe.id,
            mealId: mealForRecipe.id,
            conflicts: conflicts
        };
        setRecipeToView(detachedRecipe);
        setIsAddRecipeOpen(false);
        setIsAddingRecipe(true);
        setIsRecipeEditorOpen(true);
    };

    const handleEditorSaveSuccess = async (resultData, action) => {
        setIsRecipeEditorOpen(false);
        
        if (action === 'variant_created' && resultData) {
            try {
                 const { data: fullRecord, error: fetchError } = await supabase
                     .from('diet_plan_recipes')
                     .select('*, recipe:recipe_id(*, recipe_ingredients(*, food(*, food_sensitivities(*), food_medical_conditions(*)))), custom_ingredients:diet_plan_recipe_ingredients(*, food(*, food_sensitivities(*), food_medical_conditions(*)))')
                     .eq('id', resultData.id)
                     .single();
                 
                 if (fetchError) throw fetchError;
                 
                 setRecipes(prev => {
                     if (isAddingRecipe) {
                        return [...prev, fullRecord];
                     } else {
                        const filtered = prev.filter(r => r.id !== recipeToView.id);
                        return [...filtered, fullRecord];
                     }
                 });

            } catch (err) {
                 console.error("Error fetching new variant:", err);
                 fetchData();
            }
        } else {
            fetchData();
        }
        
        toast({ title: 'Éxito', description: 'La operación se completó correctamente.' });
    };

    if (loading) {
        return <div className="flex justify-center items-center py-20"><Loader2 className="w-10 h-10 animate-spin text-green-400" /></div>;
    }

    return (
        <>
            <Card className="bg-slate-900/50 border-gray-700 text-white overflow-hidden shadow-xl">
                {!readOnly && (
                    <CardHeader>
                        <CardTitle>Recetas en la Plantilla</CardTitle>
                        <CardDescription>Estas son las recetas base para este plan, organizadas por momento del día.</CardDescription>
                    </CardHeader>
                )}
                <CardContent className={readOnly ? "pt-6" : ""}>
                    <div className="space-y-6">
                        {dayMeals.map(meal => (
                            <MealSection
                                key={meal.id}
                                meal={meal}
                                recipes={recipes.filter(r => r.day_meal_id === meal.id)}
                                allFoods={allFoods}
                                onAdd={handleAddRecipe}
                                onEdit={handleViewRecipe}
                                onDelete={handleDeleteRecipe}
                                planRestrictions={planRestrictions}
                                user={user}
                                readOnly={readOnly}
                            />
                        ))}
                    </div>
                </CardContent>
            </Card>

            <AddRecipeToPlanDialog
                open={isAddRecipeOpen}
                onOpenChange={(isOpen) => {
                    setIsAddRecipeOpen(isOpen);
                    if (!isOpen) setMealToAddTo(null);
                }}
                dietPlanId={plan.id}
                isTemplate={true}
                onRecipeSelected={handleRecipeAdded}
                preselectedMeal={mealToAddTo}
                planRestrictions={planRestrictions}
                onEditConflict={handleOpenEditorForConflict}
            />
            
            <RecipeEditorModal
                open={isRecipeEditorOpen}
                onOpenChange={setIsRecipeEditorOpen}
                recipeToEdit={recipeToView}
                planRestrictions={planRestrictions}
                onSaveSuccess={handleEditorSaveSuccess}
                isTemplatePlan={plan.is_template}
                isAdding={isAddingRecipe}
                isAdminView={true}
                readOnly={readOnly}
            />
        </>
    );
};

export default PlanRecipesView;