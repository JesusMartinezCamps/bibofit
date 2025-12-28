import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Loader2, Zap } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import AddRecipeToPlanDialog from '@/components/plans/AddRecipeToPlanDialog';
import AdminRecipeModal from '@/components/admin/recipes/AdminRecipeModal';
import PlanRecipeCard from './PlanRecipeCard';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import MealTargetMacros from '@/components/shared/MealTargetMacros';
import { format } from 'date-fns';

const MealSection = ({ meal, recipes, onAdd, onEdit, onDelete, allFoods, userRestrictions, userDayMeal, onAutoBalance, isBalancing, planUserId, readOnly = false }) => (
    <div key={meal.id} className="bg-slate-900/50 p-4 rounded-lg border border-gray-800">
        <div className="flex items-center gap-3 mb-4 flex-wrap justify-between">
            <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-white">{meal.name}</h3>
                {!readOnly && (
                    <Button onClick={() => onAdd(meal)} size="icon" variant="ghost" className="h-8 w-8 text-green-500 hover:bg-green-500/10 hover:text-green-400">
                        <Plus className="h-6 w-6" />
                    </Button>
                )}
                {!readOnly && recipes.length > 0 && (
                    <Button 
                        onClick={() => onAutoBalance(userDayMeal.id, recipes, planUserId)} 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8 text-blue-500 hover:bg-blue-500/10 hover:text-blue-400"
                        disabled={isBalancing}
                    >
                        {isBalancing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Zap className="h-5 w-5" />}
                    </Button>
                )}
            </div>
            {userDayMeal && (
                <MealTargetMacros mealTargetMacros={userDayMeal} />
            )}
        </div>
        {meal.preferences && (
            <p className="text-sm italic text-gray-400 mb-4 pl-2 border-l-2 border-green-500/50">
                Nota: {meal.preferences}
            </p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {recipes.length > 0 ? (
                recipes.map(pr => (
                    <PlanRecipeCard
                        key={`${pr.id}-${pr.is_private}`}
                        recipe={pr}
                        allFoods={allFoods}
                        onEdit={() => onEdit(pr, userDayMeal)}
                        onDelete={() => onDelete(pr.id, pr.is_private)}
                        userRestrictions={userRestrictions}
                        readOnly={readOnly}
                    />
                ))
            ) : (
                <div className="md:col-span-2 lg:col-span-3 xl:col-span-4">
                    <p className="text-sm text-gray-500 text-center italic py-4 bg-gray-900/40 rounded-lg">No hay recetas asignadas a esta comida.</p>
                </div>
            )}
        </div>
    </div>
);

const PlanView = ({ plan, onUpdate, userDayMeals, isAssignedPlan = false, readOnly = false }) => {
    const { toast } = useToast();
    const [recipes, setRecipes] = useState([]);
    const [dayMeals, setDayMeals] = useState([]);
    const [allFoods, setAllFoods] = useState([]);
    const [loadingData, setLoadingData] = useState(true);
    const [isBalancing, setIsBalancing] = useState(false);

    const [isAddRecipeOpen, setIsAddRecipeOpen] = useState(false);
    const [mealToAddTo, setMealToAddTo] = useState(null);
    const [isRecipeEditorOpen, setIsRecipeEditorOpen] = useState(false);
    const [recipeToEdit, setRecipeToEdit] = useState(null);
    const [mealTargetMacros, setMealTargetMacros] = useState(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [recipeToDelete, setRecipeToDelete] = useState({ id: null, isPrivate: false });
    const [isAddingViaConflict, setIsAddingViaConflict] = useState(false);

    const fetchPlanData = useCallback(async () => {
        setLoadingData(true);
        try {
            const [
                { data: foodsData, error: foodsError },
                { data: planRecipesData, error: planRecipesError },
                { data: privateRecipesData, error: privateRecipesError }
            ] = await Promise.all([
                supabase.from('food').select('*, food_sensitivities(sensitivity_id), food_medical_conditions(condition_id, relation_type)'),
                supabase.from('diet_plan_recipes')
                    .select(`*, recipe:recipe_id(*), day_meal:day_meal_id!inner(id,name,display_order), custom_ingredients:diet_plan_recipe_ingredients(*, food(*))`)
                    .eq('diet_plan_id', plan.id)
                    .not('day_meal_id', 'is', null), // Ensure we only get recipes assigned to a meal
                supabase.from('private_recipes')
                    .select(`*, private_recipe_ingredients(*, food(*)), day_meal:day_meal_id!inner(id,name,display_order)`)
                    .eq('diet_plan_id', plan.id)
            ]);

            if (foodsError) throw foodsError;
            if (planRecipesError) throw planRecipesError;
            if (privateRecipesError) throw privateRecipesError;

            setAllFoods(foodsData || []);
            
            const combinedRecipes = [
                ...(planRecipesData || []).map(r => ({ ...r, is_private: false })),
                ...(privateRecipesData || []).map(r => ({ ...r, is_private: true }))
            ];
            setRecipes(combinedRecipes);

            const sortedMeals = (userDayMeals || [])
                .map(m => ({
                    id: m.day_meal.id,
                    name: m.day_meal.name,
                    preferences: m.preferences,
                    display_order: m.day_meal.display_order,
                }))
                .sort((a, b) => a.display_order - b.display_order);
            setDayMeals(sortedMeals);
            
        } catch (error) {
            toast({ title: "Error", description: `No se pudieron cargar datos esenciales: ${error.message}`, variant: "destructive" });
        } finally {
            setLoadingData(false);
        }
    }, [plan.id, userDayMeals, toast]);

    useEffect(() => {
        fetchPlanData();
    }, [fetchPlanData]);

    const handleAutoBalance = async (momentId, momentRecipes, userId) => {
        if (readOnly) return;
        setIsBalancing(true);
        try {
            const recipeIds = momentRecipes.map(r => ({ id: r.id, is_private: r.is_private }));
            const { data, error } = await supabase.functions.invoke('auto-balance-macros-batch', {
                body: {
                    moment_id: momentId,
                    recipe_ids: recipeIds,
                    date: format(new Date(), 'yyyy-MM-dd'),
                    user_id: userId,
                }
            });

            if (error) throw error;

            if (data.success) {
                toast({
                    title: 'Autocuadre Exitoso',
                    description: `${data.recipesProcessed} de ${data.totalRecipes} recetas fueron ajustadas.`,
                    className: 'bg-cyan-600/25 text-white'
                });
                fetchPlanData(); // Refresh data
            } else {
                throw new Error(data.error || 'Ocurrió un error desconocido durante el autocuadre.');
            }
        } catch (error) {
            toast({
                title: 'Error en Autocuadre',
                description: error.message,
                variant: 'destructive'
            });
        } finally {
            setIsBalancing(false);
        }
    };

    const handleOpenAddRecipe = (meal) => {
        if (readOnly) return;
        setMealToAddTo(meal);
        setIsAddRecipeOpen(true);
    };

    const handleEditRecipe = (recipe, userDayMeal) => {
        if (readOnly) return;
        setRecipeToEdit(recipe);
        setMealTargetMacros(userDayMeal);
        setIsAddingViaConflict(false);
        setIsRecipeEditorOpen(true);
    };

    const handleDeleteRecipeFromPlan = (recipeId, isPrivate) => {
        if (readOnly) return;
        setRecipeToDelete({ id: recipeId, isPrivate });
        setIsDeleteDialogOpen(true);
    };

    const confirmDeleteRecipe = async () => {
        if (!recipeToDelete.id) return;
    
        let promise;
        let successMessage;
    
        if (recipeToDelete.isPrivate) {
            promise = supabase
                .from('private_recipes')
                .update({ diet_plan_id: null, day_meal_id: null })
                .eq('id', recipeToDelete.id);
            successMessage = 'Receta privada desasignada del plan.';
        } else {
            promise = supabase.from('diet_plan_recipes').delete().eq('id', recipeToDelete.id);
            successMessage = 'Receta eliminada del plan.';
        }
    
        const { error } = await promise;
    
        if (error) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } else {
            setRecipes(prev => prev.filter(r => !(r.id === recipeToDelete.id && r.is_private === recipeToDelete.isPrivate)));
            toast({ title: 'Éxito', description: successMessage });
        }
        setIsDeleteDialogOpen(false);
        setRecipeToDelete({ id: null, isPrivate: false });
    };

    const handleRecipeAddedToPlan = async (recipe) => {
        if (!mealToAddTo) return;
        
        try {
            const { data: originalRecipe, error: recipeError } = await supabase
                .from('recipes')
                .select('*, recipe_ingredients(*)')
                .eq('id', recipe.id)
                .single();
    
            if (recipeError) throw recipeError;
    
            const { data: newPlanRecipe, error: planRecipeError } = await supabase
                .from('diet_plan_recipes')
                .insert({
                    diet_plan_id: plan.id,
                    recipe_id: recipe.id,
                    day_meal_id: mealToAddTo.id,
                    is_customized: true,
                    custom_name: originalRecipe.name,
                    custom_prep_time_min: originalRecipe.prep_time_min,
                    custom_difficulty: originalRecipe.difficulty,
                    custom_instructions: originalRecipe.instructions,
                })
                .select('id')
                .single();
    
            if (planRecipeError) throw planRecipeError;
    
            if (originalRecipe.recipe_ingredients && originalRecipe.recipe_ingredients.length > 0) {
                const newIngredients = originalRecipe.recipe_ingredients.map(ing => ({
                    diet_plan_recipe_id: newPlanRecipe.id,
                    food_id: ing.food_id,
                    grams: ing.grams,
                }));
    
                const { error: ingredientsError } = await supabase
                    .from('diet_plan_recipe_ingredients')
                    .insert(newIngredients);
    
                if (ingredientsError) throw ingredientsError;
            }
    
            const { data: fullNewRecord, error: fetchNewError } = await supabase
                .from('diet_plan_recipes')
                .select(`*, recipe:recipe_id(*), day_meal:day_meal_id!inner(id,name,display_order), custom_ingredients:diet_plan_recipe_ingredients(*, food(*))`)
                .eq('id', newPlanRecipe.id)
                .single();
            
            if (fetchNewError) throw fetchNewError;
    
            setRecipes(prev => [...prev, { ...fullNewRecord, is_private: false }]);
            toast({ title: 'Éxito', description: `${recipe.name} añadida al plan.` });
            setIsAddRecipeOpen(false);
        } catch (error) {
            toast({ title: 'Error', description: `No se pudo añadir la receta: ${error.message}`, variant: 'destructive' });
        }
    };

    const handleOpenEditorForConflict = (recipeTemplate, conflicts) => {
        const userDayMealForConflict = userDayMeals?.find(udm => udm.day_meal_id === mealToAddTo.id);
        const detachedRecipe = {
          is_customized: false,
          recipe: recipeTemplate,
          day_meal_id: mealToAddTo.id,
          dietPlanId: plan.id,
          recipeTemplateId: recipeTemplate.id,
          mealId: mealToAddTo.id,
          conflicts: conflicts
        };
        setRecipeToEdit(detachedRecipe);
        setMealTargetMacros(userDayMealForConflict);
        setIsAddRecipeOpen(false);
        setIsAddingViaConflict(true);
        setIsRecipeEditorOpen(true);
    };

    const handleSaveSuccess = async (resultData, action) => {
        setIsRecipeEditorOpen(false);

        // Handle both variant_created (template) and customized_update (assigned plan)
        if ((action === 'variant_created' || action === 'customized_update') && resultData) {
            try {
                 const { data: fullNewRecord, error: fetchNewError } = await supabase
                     .from('diet_plan_recipes')
                     .select(`*, recipe:recipe_id(*), day_meal:day_meal_id!inner(id,name,display_order), custom_ingredients:diet_plan_recipe_ingredients(*, food(*))`)
                     .eq('id', resultData.id)
                     .single();
                 
                 if (fetchNewError) throw fetchNewError;

                 setRecipes(prev => {
                     // If we are adding via conflict (new variant from global), append.
                     if (isAddingViaConflict) {
                        return [...prev, { ...fullNewRecord, is_private: false }];
                     }
                     // If editing existing, replace.
                     const filtered = prev.filter(r => r.id !== recipeToEdit.id);
                     return [...filtered, { ...fullNewRecord, is_private: false }];
                 });

            } catch (err) {
                 console.error("Error refreshing variant data:", err);
                 fetchPlanData(); // fallback
            }
        } else {
             fetchPlanData();
        }
    }
    
    if (loadingData) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-green-400" /></div>;
    }

    const userRestrictions = {
        sensitivities: plan.sensitivities?.flatMap(s => s.sensitivities ? [s.sensitivities.id] : []) || [],
        conditions: plan.medical_conditions?.flatMap(c => c.medical_conditions ? [c.medical_conditions.id] : []) || [],
    };
    
    return (
        <>
            <Card className="bg-slate-900/50 border-gray-700 text-white overflow-hidden shadow-xl">
                <CardHeader>
                    <CardTitle>Momentos del Día</CardTitle>
                    <CardDescription>Gestiona las recetas para cada momento del día en este plan.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-6">
                        {dayMeals.map(meal => (
                            <MealSection
                                key={meal.id}
                                meal={meal}
                                recipes={recipes.filter(r => r.day_meal_id === meal.id)}
                                allFoods={allFoods}
                                onAdd={handleOpenAddRecipe}
                                onEdit={handleEditRecipe}
                                onDelete={handleDeleteRecipeFromPlan}
                                userRestrictions={userRestrictions}
                                userDayMeal={userDayMeals?.find(udm => udm.day_meal_id === meal.id)}
                                onAutoBalance={handleAutoBalance}
                                isBalancing={isBalancing}
                                planUserId={plan.user_id}
                                readOnly={readOnly}
                            />
                        ))}
                    </div>
                </CardContent>
            </Card>

            {!readOnly && (
                <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                            <AlertDialogDescription>
                                {recipeToDelete.isPrivate
                                    ? "Esta acción desasignará la receta privada de este plan, pero no la eliminará permanentemente. Seguirá visible en el historial de Comidas Libres."
                                    : "Esta acción eliminará la receta de este plan de dieta."}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setRecipeToDelete({ id: null, isPrivate: false })}>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={confirmDeleteRecipe} className={recipeToDelete.isPrivate ? "bg-blue-600 hover:bg-blue-700" : "bg-red-600 hover:bg-red-700"}>
                                {recipeToDelete.isPrivate ? "Desasignar" : "Eliminar"}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
            
            <AddRecipeToPlanDialog
                open={isAddRecipeOpen}
                onOpenChange={setIsAddRecipeOpen}
                dietPlanId={plan.id}
                onRecipeSelected={handleRecipeAddedToPlan}
                userId={plan?.user_id}
                preselectedMeal={mealToAddTo}
                onEditConflict={handleOpenEditorForConflict}
                isConstructor={true}
            />

            <AdminRecipeModal
                open={isRecipeEditorOpen}
                onOpenChange={setIsRecipeEditorOpen}
                recipeToEdit={recipeToEdit}
                onSaveSuccess={handleSaveSuccess}
                userId={plan?.user_id}
                planRestrictions={userRestrictions}
                mealTargetMacros={mealTargetMacros}
                isAdminView={true} // Allow edits
                isAssignedPlan={isAssignedPlan} // NEW PROP
            />
        </>
    )
}
export default PlanView;
