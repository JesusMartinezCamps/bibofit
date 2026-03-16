import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Loader2, History, ChevronDown, ChevronUp, Archive } from 'lucide-react';
import AddRecipeToPlanDialog from '@/components/plans/AddRecipeToPlanDialog';
import RecipeEditorModal from '@/components/shared/RecipeEditorModal/RecipeEditorModal';
import RecipeCard from '@/components/shared/WeeklyDietPlanner/RecipeCard';
import { useAuth } from '@/contexts/AuthContext';
import { archiveDietPlanRecipe } from '@/components/shared/RecipeEditorModal/recipeService';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

// Panel colapsable con las versiones anteriores (archivadas) de una receta base
const RecipeVersionHistory = ({ currentRecipeId, planId, planRestrictions }) => {
    const [open, setOpen] = useState(false);
    const [versions, setVersions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [viewingVersion, setViewingVersion] = useState(null);

    const fetchVersions = useCallback(async () => {
        if (!open || versions.length > 0) return;
        setLoading(true);
        try {
            // Recorrer la cadena de parent_diet_plan_recipe_id hacia atrás
            const { data, error } = await supabase
                .from('diet_plan_recipes')
                .select('*, recipe:recipe_id(name, recipe_ingredients(*, food(*))), custom_ingredients:recipe_ingredients(*, food(*))')
                .eq('diet_plan_id', planId)
                .eq('is_archived', true)
                .order('archived_at', { ascending: false });

            if (error) throw error;

            // Filtrar solo los antecesores del nodo actual recorriendo parent_diet_plan_recipe_id
            const ancestors = [];
            let parentId = currentRecipeId;
            const byId = new Map((data || []).map(r => [r.id, r]));

            // Buscar el registro actual para obtener su parent
            const { data: current } = await supabase
                .from('diet_plan_recipes')
                .select('parent_diet_plan_recipe_id')
                .eq('id', currentRecipeId)
                .single();

            parentId = current?.parent_diet_plan_recipe_id;
            while (parentId && byId.has(parentId)) {
                const ancestor = byId.get(parentId);
                ancestors.push(ancestor);
                parentId = ancestor.parent_diet_plan_recipe_id;
            }

            setVersions(ancestors);
        } catch (err) {
            console.error('Error fetching recipe versions:', err);
        } finally {
            setLoading(false);
        }
    }, [open, currentRecipeId, planId, versions.length]);

    useEffect(() => {
        fetchVersions();
    }, [fetchVersions]);

    if (!open) {
        return (
            <button
                onClick={() => setOpen(true)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-1 px-2"
            >
                <History className="w-3 h-3" />
                Ver historial
                <ChevronDown className="w-3 h-3" />
            </button>
        );
    }

    return (
        <div className="border-t border-border/50 mt-2 pt-2">
            <button
                onClick={() => setOpen(false)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-1 px-2 mb-2"
            >
                <History className="w-3 h-3" />
                Ocultar historial
                <ChevronUp className="w-3 h-3" />
            </button>

            {loading && <div className="flex justify-center py-2"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>}

            {!loading && versions.length === 0 && (
                <p className="text-xs text-muted-foreground italic px-2 py-1">No hay versiones anteriores.</p>
            )}

            {versions.map((version) => {
                const name = version.custom_name || version.recipe?.name || 'Versión anterior';
                const archivedDate = version.archived_at
                    ? format(parseISO(version.archived_at), "d MMM yyyy 'a las' HH:mm", { locale: es })
                    : null;
                return (
                    <div
                        key={version.id}
                        className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-muted/40 transition-colors"
                    >
                        <div className="flex items-center gap-2 min-w-0">
                            <Archive className="w-3 h-3 flex-shrink-0 text-muted-foreground/60" />
                            <div className="min-w-0">
                                <p className="text-xs font-medium text-muted-foreground truncate">{name}</p>
                                {archivedDate && (
                                    <p className="text-[10px] text-muted-foreground/60">Archivada {archivedDate}</p>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={() => setViewingVersion(version)}
                            className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2 flex-shrink-0"
                        >
                            Ver
                        </button>
                    </div>
                );
            })}

            {viewingVersion && (
                <RecipeEditorModal
                    open={!!viewingVersion}
                    onOpenChange={(o) => { if (!o) setViewingVersion(null); }}
                    recipeToEdit={viewingVersion}
                    planRestrictions={planRestrictions}
                    onSaveSuccess={() => setViewingVersion(null)}
                    isAdminView={true}
                    readOnly={true}
                />
            )}
        </div>
    );
};

const MealSection = ({ meal, recipes, onAdd, onEdit, onArchive, allFoods, planRestrictions, user, readOnly, planId }) => (
    <div key={meal.id} className="bg-card/75 rounded-lg border border-border overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-3 border-b border-border bg-card/90">
            <h3 className="text-lg font-bold text-foreground dark:text-white">{meal.name}</h3>
            {!readOnly && (
                <Button onClick={() => onAdd(meal)} size="icon" variant="ghost" className="h-7 w-7 text-green-500 hover:bg-green-500/10 hover:text-green-400">
                    <Plus className="h-5 w-5" />
                </Button>
            )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-y-3 gap-x-0 md:gap-4 p-0 md:p-4">
            {recipes.length > 0 ? (
                recipes.map(pr => (
                    <div key={pr.id} className="flex flex-col">
                        <RecipeCard
                            recipe={pr}
                            user={user}
                            allFoods={allFoods}
                            handleRecipeClick={onEdit}
                            handleRemoveRecipe={readOnly ? undefined : onArchive}
                            isListView={true}
                            userRestrictions={planRestrictions}
                            isAdminView={true}
                            hideQuantities={true}
                            hideMacros={true}
                            readOnly={readOnly}
                        />
                        {!readOnly && (
                            <RecipeVersionHistory
                                currentRecipeId={pr.id}
                                planId={planId}
                                planRestrictions={planRestrictions}
                            />
                        )}
                    </div>
                ))
            ) : (
                <div className="md:col-span-2 lg:col-span-3 xl:col-span-4 p-4">
                    <p className="text-sm text-muted-foreground text-center italic py-4 bg-card/40 rounded-lg">No hay recetas asignadas a esta comida.</p>
                </div>
            )}
        </div>
    </div>
);

const PlanRecipesView = ({ plan, readOnly = false, clientRestrictions }) => {
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
                    .select('*, recipe:recipe_id(*, recipe_ingredients(*, food(*, food_sensitivities(*), food_medical_conditions(*)))), custom_ingredients:recipe_ingredients(*, food(*, food_sensitivities(*), food_medical_conditions(*)))')
                    .eq('diet_plan_id', plan.id)
                    .eq('is_archived', false)
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

            let restrictions;
            if (clientRestrictions) {
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

    const handleArchiveRecipe = async (recipeId) => {
        if (readOnly) return;

        const result = await archiveDietPlanRecipe(recipeId);

        if (!result.success) {
            toast({ title: 'Error al archivar', description: result.message, variant: 'destructive' });
            return;
        }

        setRecipes(prev => prev.filter(r => r.id !== recipeId));

        if (result.activeVariantsCount > 0) {
            toast({
                title: 'Receta archivada',
                description: `${result.activeVariantsCount} cliente(s) tienen variantes personales basadas en esta receta. Siguen disponibles como nodos históricos.`,
                duration: 6000,
            });
        } else {
            toast({ title: 'Receta archivada' });
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
                 .select('*, recipe:recipe_id(*, recipe_ingredients(*, food(*, food_sensitivities(*), food_medical_conditions(*)))), custom_ingredients:recipe_ingredients(*, food(*, food_sensitivities(*), food_medical_conditions(*)))')
                 .eq('id', newPlanRecipe.id)
                 .single();

            if (fetchError) throw fetchError;

            setRecipes(prev => [...prev, fullRecord]);
            toast({ title: 'Éxito', description: `${recipe.name} añadida al plan.`, variant: 'success' });
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

        if ((action === 'variant_created' || action === 'version_created') && resultData) {
            try {
                 const { data: fullRecord, error: fetchError } = await supabase
                     .from('diet_plan_recipes')
                     .select('*, recipe:recipe_id(*, recipe_ingredients(*, food(*, food_sensitivities(*), food_medical_conditions(*)))), custom_ingredients:recipe_ingredients(*, food(*, food_sensitivities(*), food_medical_conditions(*)))')
                     .eq('id', resultData.id)
                     .single();

                 if (fetchError) throw fetchError;

                 setRecipes(prev => {
                     if (isAddingRecipe) {
                        return [...prev, fullRecord];
                     } else {
                        // Reemplaza la versión anterior por la nueva en la lista activa
                        const filtered = prev.filter(r => r.id !== recipeToView.id);
                        return [...filtered, fullRecord];
                     }
                 });

            } catch (err) {
                 console.error('Error fetching new version:', err);
                 fetchData();
            }
        } else {
            fetchData();
        }

        toast({ title: 'Éxito', description: 'La operación se completó correctamente.', variant: 'success' });
    };

    if (loading) {
        return <div className="flex justify-center items-center py-20"><Loader2 className="w-10 h-10 animate-spin text-green-400" /></div>;
    }

    return (
        <>
            <Card className="bg-card/75 border-border text-foreground dark:text-white overflow-hidden shadow-xl">
                {!readOnly && (
                    <CardHeader>
                        <CardTitle>Recetas en la Plantilla</CardTitle>
                        <CardDescription>Recetas base del plan. Editar una versión crea una nueva y archiva la anterior.</CardDescription>
                    </CardHeader>
                )}
                <CardContent className={cn(readOnly ? "pt-6" : "")}>
                    <div className="space-y-6">
                        {dayMeals.map(meal => (
                            <MealSection
                                key={meal.id}
                                meal={meal}
                                recipes={recipes.filter(r => r.day_meal_id === meal.id)}
                                allFoods={allFoods}
                                onAdd={handleAddRecipe}
                                onEdit={handleViewRecipe}
                                onArchive={handleArchiveRecipe}
                                planRestrictions={planRestrictions}
                                user={user}
                                readOnly={readOnly}
                                planId={plan.id}
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
                isTemplate={plan.is_template}
                isAdminView={true}
                readOnly={readOnly}
            />
        </>
    );
};

export default PlanRecipesView;
