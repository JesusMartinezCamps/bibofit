import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Loader2, Bot, RefreshCw, Check } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import AddRecipeToPlanDialog from '@/components/plans/AddRecipeToPlanDialog';
import AdminRecipeModal from '@/components/admin/recipes/AdminRecipeModal';
import PlanRecipeCard from './PlanRecipeCard';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import MealTargetMacros from '@/components/shared/MealTargetMacros';
import { format } from 'date-fns';
import { invokeAutoBalanceBatch, invokeScaleDietPlan, invokeAutoBalancePlanAllMoments } from '@/lib/autoBalanceClient';

// ---------------------------------------------------------------------------
// MealSection — sección individual de un momento del día
// ---------------------------------------------------------------------------
const MealSection = ({ meal, recipes, onAdd, onEdit, onDelete, allFoods, userRestrictions, userDayMeal, onAutoBalance, isBalancing, isAlreadyBalanced, isDirty, planUserId, readOnly = false, pendingChange = null }) => (
    <div key={meal.id} className="bg-card/75 p-4 rounded-lg border border-border">
        <div className="flex items-center gap-3 mb-4 flex-wrap justify-between">
            <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-foreground dark:text-white">{meal.name}</h3>
                {!readOnly && (
                    <Button onClick={() => onAdd(meal)} size="icon" variant="ghost" className="h-8 w-8 text-green-500 hover:bg-green-500/10 hover:text-green-400">
                        <Plus className="h-6 w-6" />
                    </Button>
                )}
                {/* Bot mini — solo visible si el momento tiene recetas, targets y hay algo dirty */}
                {!readOnly && recipes.length > 0 && userDayMeal && isDirty && !pendingChange && (
                    <Button
                        type="button"
                        onClick={() => onAutoBalance(userDayMeal, recipes, planUserId)}
                        disabled={isBalancing || isAlreadyBalanced}
                        size="icon"
                        variant="outline"
                        className="h-8 w-8 border-cyan-500 bg-cyan-400/10 text-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={isAlreadyBalanced ? "Autocuadre ya aplicado" : "Autocuadrar Macros"}
                    >
                        {isBalancing
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : isAlreadyBalanced
                                ? <Check className="h-4 w-4" />
                                : <Bot className="h-4 w-4" />}
                    </Button>
                )}
            </div>
            {userDayMeal && (
                <MealTargetMacros mealTargetMacros={userDayMeal} />
            )}
        </div>
        {meal.preferences && (
            <p className="text-sm italic text-muted-foreground mb-4 pl-2 border-l-2 border-green-500/50">
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
                    <p className="text-sm text-muted-foreground text-center italic py-4 bg-card/40 rounded-lg">No hay recetas asignadas a esta comida.</p>
                </div>
            )}
        </div>
    </div>
);

// ---------------------------------------------------------------------------
// PlanView
// ---------------------------------------------------------------------------
const PlanView = ({
    plan,
    onUpdate,
    userDayMeals,
    isAssignedPlan = false,
    readOnly = false,
    isTemplate = false,
    // Nuevo sistema granular (reemplaza pendingRecalc booleano)
    pendingChange = null,       // { type: 'linear_scale'|'macro_redistribution', oldTdee, newTdee } | null
    dirtyMealIds = [],          // string[] de user_day_meal.id con targets recién guardados
    onDirtyMealsCleared,        // callback para limpiar dirtyMealIds en el padre
    onRecalculate,              // async () => void — guarda targets y actualiza savedSnapshot
}) => {
    const { toast } = useToast();
    const [recipes, setRecipes] = useState([]);
    const [dayMeals, setDayMeals] = useState([]);
    const [allFoods, setAllFoods] = useState([]);
    const [loadingData, setLoadingData] = useState(true);
    const [balancingMealId, setBalancingMealId] = useState(null);
    const [balancedMealIds, setBalancedMealIds] = useState({});
    const [isPlanBalancing, setIsPlanBalancing] = useState(false);

    const [isAddRecipeOpen, setIsAddRecipeOpen] = useState(false);
    const [mealToAddTo, setMealToAddTo] = useState(null);
    const [isRecipeEditorOpen, setIsRecipeEditorOpen] = useState(false);
    const [recipeToEdit, setRecipeToEdit] = useState(null);
    const [mealTargetMacros, setMealTargetMacros] = useState(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [recipeToDelete, setRecipeToDelete] = useState({ id: null, isPrivate: false });
    const [isAddingViaConflict, setIsAddingViaConflict] = useState(false);

    const fetchIdRef = useRef(0);

    // -------------------------------------------------------------------------
    // Advertir al cerrar/recargar la pestaña si hay cambios pendientes
    // (la navegación SPA queda cubierta por el banner en el CardHeader)
    // -------------------------------------------------------------------------
    useEffect(() => {
        const hasPendingWork = !readOnly && (pendingChange !== null || dirtyMealIds.length > 0);
        if (!hasPendingWork) return;
        const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [readOnly, pendingChange, dirtyMealIds]);

    const fetchPlanData = useCallback(async () => {
        if (!plan?.id) return;

        const currentFetchId = ++fetchIdRef.current;
        setLoadingData(true);

        try {
            let foodsData = [];
            try {
                const { data, error } = await supabase.from('food')
                    .select('*, food_sensitivities(sensitivity_id), food_medical_conditions(condition_id, relation_type)');
                if (error) console.warn("Could not fetch all foods:", error.message);
                else foodsData = data || [];
            } catch (e) {
                console.error("Exception fetching foods:", e);
            }

            const { data: planRecipesData, error: planRecipesError } = await supabase.from('diet_plan_recipes')
                .select(`*, recipe:recipe_id(*, recipe_ingredients(*, food(*))), day_meal:day_meal_id!inner(id,name,display_order), custom_ingredients:recipe_ingredients(*, food(*)), recipe_macros(*)`)
                .eq('diet_plan_id', plan.id)
                .eq('is_archived', false)
                .not('day_meal_id', 'is', null);

            if (planRecipesError) throw new Error("No se pudieron cargar las recetas del plan.");

            const { data: privateRecipesData } = await supabase.from('user_recipes')
                .select(`*, recipe_ingredients(*, food(*)), day_meal:day_meal_id!inner(id,name,display_order)`)
                .eq('diet_plan_id', plan.id)
                .in('type', ['private', 'variant'])
                .eq('is_archived', false);

            if (currentFetchId === fetchIdRef.current) {
                setAllFoods(foodsData);
                setRecipes([
                    ...(planRecipesData || []).map(r => ({
                        ...r,
                        is_private: false,
                        recipe_ingredients: r.recipe?.recipe_ingredients || [],
                        custom_ingredients: r.custom_ingredients || [],
                        recipe_macros: r.recipe_macros || [],
                    })),
                    ...(privateRecipesData || []).map(r => ({ ...r, is_private: true })),
                ]);
            }
        } catch (error) {
            if (currentFetchId === fetchIdRef.current) {
                toast({ title: "Error", description: `No se pudieron cargar datos esenciales: ${error.message}`, variant: "destructive" });
            }
        } finally {
            if (currentFetchId === fetchIdRef.current) setLoadingData(false);
        }
    }, [plan.id, toast]);

    useEffect(() => { fetchPlanData(); }, [fetchPlanData]);

    // Cuando hay un cambio global pendiente, invalidar balanceos previos
    useEffect(() => {
        if (pendingChange !== null) setBalancedMealIds({});
    }, [pendingChange]);

    useEffect(() => {
        if (!userDayMeals) return;
        setDayMeals(
            userDayMeals
                .map(m => ({ id: m.day_meal.id, name: m.day_meal.name, preferences: m.preferences, display_order: m.day_meal.display_order }))
                .sort((a, b) => a.display_order - b.display_order)
        );
    }, [userDayMeals]);

    // -------------------------------------------------------------------------
    // Refetch optimizado para un solo momento
    // -------------------------------------------------------------------------
    const refetchMealRecipes = useCallback(async (dayMealId) => {
        const [publicRes, privateRes] = await Promise.all([
            supabase.from('diet_plan_recipes')
                .select('*, recipe:recipe_id(*, recipe_ingredients(*, food(*))), day_meal:day_meal_id!inner(id,name,display_order), custom_ingredients:recipe_ingredients(*, food(*)), recipe_macros(*)')
                .eq('diet_plan_id', plan.id)
                .eq('day_meal_id', dayMealId)
                .eq('is_archived', false)
                .not('day_meal_id', 'is', null),
            supabase.from('user_recipes')
                .select('*, recipe_ingredients(*, food(*)), day_meal:day_meal_id!inner(id,name,display_order)')
                .eq('diet_plan_id', plan.id)
                .eq('day_meal_id', dayMealId)
                .in('type', ['private', 'variant'])
                .eq('is_archived', false),
        ]);
        const updated = [
            ...(publicRes.data || []).map(r => ({ ...r, is_private: false, recipe_ingredients: r.recipe?.recipe_ingredients || [], custom_ingredients: r.custom_ingredients || [], recipe_macros: r.recipe_macros || [] })),
            ...(privateRes.data || []).map(r => ({ ...r, is_private: true })),
        ];
        setRecipes(prev => [...prev.filter(r => r.day_meal_id !== dayMealId), ...updated]);
    }, [plan.id]);

    // -------------------------------------------------------------------------
    // Autocuadre de PLAN COMPLETO (escenarios 1 y 2)
    // -------------------------------------------------------------------------
    const handlePlanAutoBalance = useCallback(async () => {
        if (!pendingChange || readOnly) return;
        setIsPlanBalancing(true);
        try {
            if (pendingChange.type === 'linear_scale') {
                // Optimistic: escalar gramos localmente para respuesta inmediata
                const factor = pendingChange.newTdee / pendingChange.oldTdee;
                setRecipes(prev => prev.map(r => ({
                    ...r,
                    custom_ingredients: (r.custom_ingredients || []).map(ing => ({
                        ...ing,
                        grams: ing.grams != null
                            ? Math.round(Number(ing.grams) * factor / 5) * 5  // nearest 5g optimistic
                            : ing.grams,
                    })),
                })));
                // Edge function persiste con redondeo preciso
                await invokeScaleDietPlan({
                    diet_plan_id: plan.id,
                    user_id: plan.user_id,
                    old_tdee: pendingChange.oldTdee,
                    new_tdee: pendingChange.newTdee,
                });
                // Guardar targets → limpia pendingChange
                await onRecalculate?.();
                toast({ title: 'Plan escalado', description: 'Las cantidades se han ajustado proporcionalmente.', className: 'bg-cyan-600/25 text-white' });
            } else {
                // macro_redistribution: primero guardar targets en BD, luego balancear
                await onRecalculate?.();
                await invokeAutoBalancePlanAllMoments({
                    diet_plan_id: plan.id,
                    user_id: plan.user_id,
                });
                await fetchPlanData();
                toast({ title: 'Plan autocuadrado', description: 'Todos los momentos han sido reajustados.', className: 'bg-cyan-600/25 text-white' });
            }
            setBalancedMealIds({});
        } catch (error) {
            toast({ title: 'Error en Autocuadre', description: error.message, variant: 'destructive' });
        } finally {
            setIsPlanBalancing(false);
        }
    }, [pendingChange, readOnly, plan.id, plan.user_id, onRecalculate, fetchPlanData, toast]);

    // -------------------------------------------------------------------------
    // Autocuadre de MOMENTO(S) — escenario 3: linked meals
    // Pulsar el Bot en cualquier momento dirty balancea TODOS los dirty juntos
    // -------------------------------------------------------------------------
    const handleAutoBalance = useCallback(async (userDayMeal, momentRecipes, userId) => {
        if (readOnly) return;
        const momentId = userDayMeal.id;
        const dayMealId = userDayMeal.day_meal_id;

        // Si hay linked meals (dirtyMealIds), balancearlos todos a la vez
        if (dirtyMealIds.length > 0) {
            setBalancingMealId(momentId);
            try {
                await invokeAutoBalancePlanAllMoments({
                    diet_plan_id: plan.id,
                    user_id: userId,
                    meal_ids: dirtyMealIds,
                });
                // Refetch de todos los momentos afectados
                const affectedDayMealIds = (userDayMeals || [])
                    .filter(udm => dirtyMealIds.includes(String(udm.id)))
                    .map(udm => udm.day_meal_id);
                await Promise.all(affectedDayMealIds.map(refetchMealRecipes));
                // Marcar todos los linked como balanceados y limpiar dirty
                const newBalanced = {};
                dirtyMealIds.forEach(id => { newBalanced[id] = true; });
                setBalancedMealIds(prev => ({ ...prev, ...newBalanced }));
                onDirtyMealsCleared?.();
                toast({ title: 'Autocuadre Exitoso', description: `${dirtyMealIds.length} momento(s) ajustados.`, className: 'bg-cyan-600/25 text-white' });
            } catch (error) {
                toast({ title: 'Error en Autocuadre', description: error.message, variant: 'destructive' });
            } finally {
                setBalancingMealId(null);
            }
            return;
        }

        // Sin linked meals: batch normal del momento
        setBalancingMealId(momentId);
        try {
            const recipeIds = momentRecipes.map(r => ({ id: r.id, is_private: r.is_private }));
            const data = await invokeAutoBalanceBatch({
                moment_id: momentId,
                recipe_ids: recipeIds,
                date: format(new Date(), 'yyyy-MM-dd'),
                user_id: userId,
            });
            if (data.success) {
                await refetchMealRecipes(dayMealId);
                setBalancedMealIds(prev => ({ ...prev, [momentId]: true }));
                toast({ title: 'Autocuadre Exitoso', description: `${data.recipesProcessed} de ${data.totalRecipes} recetas ajustadas.`, className: 'bg-cyan-600/25 text-white' });
            } else {
                throw new Error(data.error || 'Error desconocido durante el autocuadre.');
            }
        } catch (error) {
            toast({ title: 'Error en Autocuadre', description: error.message, variant: 'destructive' });
        } finally {
            setBalancingMealId(null);
        }
    }, [readOnly, dirtyMealIds, plan.id, userDayMeals, refetchMealRecipes, onDirtyMealsCleared, toast]);

    // -------------------------------------------------------------------------
    // Handlers de recetas
    // -------------------------------------------------------------------------
    const handleOpenAddRecipe = (meal) => {
        if (readOnly) return;
        setMealToAddTo(meal);
        setIsAddRecipeOpen(true);
    };

    const handleEditRecipe = (recipe, userDayMeal) => {
        setRecipeToEdit(recipe);
        setMealTargetMacros(userDayMeal);
        setIsAddingViaConflict(false);
        setIsRecipeEditorOpen(true);
    };

    const handleDeleteRecipeFromPlan = (recipeId, isPrivate) => {
        if (readOnly) return;
        const recipe = recipes.find(r => r.id === recipeId && r.is_private === isPrivate);
        setRecipeToDelete({ id: recipeId, isPrivate, dayMealId: recipe?.day_meal_id });
        setIsDeleteDialogOpen(true);
    };

    const confirmDeleteRecipe = async () => {
        if (!recipeToDelete.id) return;
        let promise, successMessage;
        if (recipeToDelete.isPrivate) {
            promise = supabase.from('user_recipes').update({ diet_plan_id: null, day_meal_id: null }).eq('id', recipeToDelete.id);
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
            if (recipeToDelete.dayMealId) {
                const udm = userDayMeals?.find(u => u.day_meal_id === recipeToDelete.dayMealId);
                if (udm) setBalancedMealIds(prev => { const next = { ...prev }; delete next[udm.id]; return next; });
            }
            toast({ title: 'Éxito', description: successMessage, variant: 'success' });
        }
        setIsDeleteDialogOpen(false);
        setRecipeToDelete({ id: null, isPrivate: false, dayMealId: null });
    };

    const handleRecipeAddedToPlan = async (recipe) => {
        if (!mealToAddTo) return;
        try {
            const { data: originalRecipe, error: recipeError } = await supabase.from('recipes').select('*, recipe_ingredients(*)').eq('id', recipe.id).single();
            if (recipeError) throw recipeError;

            const { data: newPlanRecipe, error: planRecipeError } = await supabase.from('diet_plan_recipes')
                .insert({ diet_plan_id: plan.id, recipe_id: recipe.id, day_meal_id: mealToAddTo.id, is_customized: true, custom_name: originalRecipe.name, custom_prep_time_min: originalRecipe.prep_time_min, custom_difficulty: originalRecipe.difficulty, custom_instructions: originalRecipe.instructions })
                .select('id').single();
            if (planRecipeError) throw planRecipeError;

            if (originalRecipe.recipe_ingredients?.length > 0) {
                const { error: ingredientsError } = await supabase.from('recipe_ingredients').insert(
                    originalRecipe.recipe_ingredients.map(ing => ({ diet_plan_recipe_id: newPlanRecipe.id, food_id: ing.food_id, grams: ing.grams }))
                );
                if (ingredientsError) throw ingredientsError;
            }

            const { data: fullNewRecord, error: fetchNewError } = await supabase.from('diet_plan_recipes')
                .select('*, recipe:recipe_id(*, recipe_ingredients(*, food(*))), day_meal:day_meal_id!inner(id,name,display_order), custom_ingredients:recipe_ingredients(*, food(*)), recipe_macros(*)')
                .eq('id', newPlanRecipe.id).single();
            if (fetchNewError) throw fetchNewError;

            setRecipes(prev => [...prev, { ...fullNewRecord, is_private: false }]);
            const udm = userDayMeals?.find(u => u.day_meal_id === mealToAddTo.id);
            if (udm) setBalancedMealIds(prev => { const next = { ...prev }; delete next[udm.id]; return next; });
            toast({ title: 'Éxito', description: `${recipe.name} añadida al plan.`, variant: 'success' });
            setIsAddRecipeOpen(false);
        } catch (error) {
            toast({ title: 'Error', description: `No se pudo añadir la receta: ${error.message}`, variant: 'destructive' });
        }
    };

    const handleOpenEditorForConflict = (recipeTemplate, conflicts) => {
        const userDayMealForConflict = userDayMeals?.find(udm => udm.day_meal_id === mealToAddTo.id);
        setRecipeToEdit({ is_customized: false, recipe: recipeTemplate, day_meal_id: mealToAddTo.id, dietPlanId: plan.id, recipeTemplateId: recipeTemplate.id, mealId: mealToAddTo.id, conflicts });
        setMealTargetMacros(userDayMealForConflict);
        setIsAddRecipeOpen(false);
        setIsAddingViaConflict(true);
        setIsRecipeEditorOpen(true);
    };

    const handleSaveSuccess = async (resultData, action) => {
        setIsRecipeEditorOpen(false);
        if ((action === 'variant_created' || action === 'customized_update') && resultData) {
            try {
                const { data: fullNewRecord, error: fetchNewError } = await supabase.from('diet_plan_recipes')
                    .select('*, recipe:recipe_id(*, recipe_ingredients(*, food(*))), day_meal:day_meal_id!inner(id,name,display_order), custom_ingredients:recipe_ingredients(*, food(*)), recipe_macros(*)')
                    .eq('id', resultData.id).single();
                if (fetchNewError) throw fetchNewError;
                setRecipes(prev => {
                    if (isAddingViaConflict) return [...prev, { ...fullNewRecord, is_private: false }];
                    return [...prev.filter(r => r.id !== recipeToEdit.id), { ...fullNewRecord, is_private: false }];
                });
            } catch {
                fetchPlanData();
            }
        } else {
            fetchPlanData();
        }
    };

    if (loadingData) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-green-400" /></div>;
    }

    const userRestrictions = {
        sensitivities: plan.sensitivities?.flatMap(s => s.sensitivities ? [s.sensitivities.id] : []) || [],
        conditions: plan.medical_conditions?.flatMap(c => c.medical_conditions ? [c.medical_conditions.id] : []) || [],
    };

    const dirtyMealIdSet = new Set(dirtyMealIds.map(String));

    return (
        <>
            <Card className="bg-card/75 border-border text-foreground dark:text-white overflow-hidden shadow-xl">
                <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <CardTitle>Momentos del Día</CardTitle>
                            <CardDescription>Gestiona las recetas para cada momento del día en este plan.</CardDescription>
                        </div>
                        {/* Botón plan-level: aparece cuando hay un cambio global pendiente */}
                        {pendingChange && !readOnly && (
                            <Button
                                type="button"
                                onClick={handlePlanAutoBalance}
                                disabled={isPlanBalancing}
                                variant="outline"
                                className="flex-shrink-0 border-cyan-500 bg-cyan-400/10 text-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isPlanBalancing
                                    ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    : <Bot className="w-4 h-4 mr-2" />}
                                {pendingChange.type === 'linear_scale' ? 'Escalar plan' : 'Autocuadrar plan'}
                            </Button>
                        )}
                        {/* Botón "Actualizar targets" legacy — ya no necesario con el flujo nuevo,
                            pero se mantiene como fallback por si onRecalculate se llama de forma directa */}
                        {!pendingChange && !readOnly && onRecalculate && false /* oculto */ && (
                            <Button size="sm" onClick={onRecalculate} className="bg-amber-600 hover:bg-amber-700 text-white flex-shrink-0">
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Actualizar targets
                            </Button>
                        )}
                    </div>
                    {pendingChange && !readOnly && (
                        <p className="text-xs text-cyan-400/80 mt-1">
                            {pendingChange.type === 'linear_scale'
                                ? 'Las calorías han cambiado. Pulsa "Escalar plan" para ajustar las cantidades proporcionalmente.'
                                : 'La distribución de macros ha cambiado. Pulsa "Autocuadrar plan" para reajustar todas las recetas.'}
                        </p>
                    )}
                </CardHeader>
                <CardContent>
                    <div className="space-y-6">
                        {dayMeals.map(meal => {
                            const udm = userDayMeals?.find(u => u.day_meal_id === meal.id);
                            const isDirty = udm ? dirtyMealIdSet.has(String(udm.id)) : false;
                            return (
                                <MealSection
                                    key={meal.id}
                                    meal={meal}
                                    recipes={recipes.filter(r => r.day_meal_id === meal.id)}
                                    allFoods={allFoods}
                                    onAdd={handleOpenAddRecipe}
                                    onEdit={handleEditRecipe}
                                    onDelete={handleDeleteRecipeFromPlan}
                                    userRestrictions={userRestrictions}
                                    userDayMeal={udm}
                                    onAutoBalance={handleAutoBalance}
                                    isBalancing={balancingMealId === udm?.id}
                                    isAlreadyBalanced={!!balancedMealIds[udm?.id]}
                                    isDirty={isDirty}
                                    planUserId={plan.user_id}
                                    readOnly={readOnly}
                                    pendingChange={pendingChange}
                                />
                            );
                        })}
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
                                    ? "Esta acción desasignará la receta privada de este plan, pero no la eliminará permanentemente."
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
                isAdminView={!readOnly}
                isAssignedPlan={isAssignedPlan}
                isReadOnly={readOnly}
            />
        </>
    );
};

export default PlanView;
