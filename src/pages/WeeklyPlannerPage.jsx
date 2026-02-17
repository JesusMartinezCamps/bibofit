import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Plus, ShoppingCart } from 'lucide-react';
import { addDays, format, getDay, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import AddRecipeToPlanDialog from '@/components/plans/AddRecipeToPlanDialog';
import RecipeCard from '@/components/shared/WeeklyDietPlanner/RecipeCard';
import RecipeEditorModal from '@/components/shared/RecipeEditorModal/RecipeEditorModal';

const WeeklyPlannerPage = () => {
    const { user: authUser } = useAuth();
    const { userId: paramUserId } = useParams();
    const navigate = useNavigate();
    const { toast } = useToast();

    const userId = paramUserId || authUser.id;
    const isAdminView = authUser.id !== userId;

    const [days, setDays] = useState([]);
    const [plannedMeals, setPlannedMeals] = useState([]);
    const [userDayMeals, setUserDayMeals] = useState([]);
    const [activePlan, setActivePlan] = useState(null);
    const [loading, setLoading] = useState(true);
    const [allFoods, setAllFoods] = useState([]);
    const [isAddRecipeOpen, setIsAddRecipeOpen] = useState(false);
    const [addRecipeParams, setAddRecipeParams] = useState({ meal: null, dayOfWeek: null });

    const [selectedMealLogs, setSelectedMealLogs] = useState(new Set());
    const [selectionCounts, setSelectionCounts] = useState({});
    
    const [recipeToEdit, setRecipeToEdit] = useState(null);
    const [isEditorOpen, setIsEditorOpen] = useState(false);

    const today = new Date();

    const fetchPlannerData = useCallback(async () => {
        setLoading(true);
        try {
            const { data: plan, error: planError } = await supabase.from('diet_plans').select('*').eq('user_id', userId).eq('is_active', true).single();
            if (planError && planError.code !== 'PGRST116') throw planError;
            setActivePlan(plan);

            const { data: dayMeals, error: dayMealsError } = await supabase.from('user_day_meals').select('*, day_meal:day_meal_id(*)').eq('user_id', userId).order('display_order', { foreignTable: 'day_meal', ascending: true });
            if (dayMealsError) throw dayMealsError;
            setUserDayMeals(dayMeals || []);

            if (plan) {
                const { data: recipes, error: recipesError } = await supabase
                    .from('diet_plan_recipes')
                    .select('*, recipe:recipe_id(*, recipe_ingredients(*, food(*))), day_meal:day_meal_id!inner(id, name, display_order), custom_ingredients:diet_plan_recipe_ingredients(*, food(*))')
                    .eq('diet_plan_id', plan.id);
                if (recipesError) throw recipesError;

                const { data: foods, error: foodsError } = await supabase.from('food').select('*');
                if (foodsError) throw foodsError;
                setAllFoods(foods || []);
                
                const mealsWithType = (recipes || []).map(r => ({ ...r, type: 'recipe', dnd_id: `pr-${r.id}` }));
                setPlannedMeals(mealsWithType);
            } else {
                setPlannedMeals([]);
            }
        } catch (error) {
            toast({ title: "Error", description: `No se pudo cargar el planificador: ${error.message}`, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [userId, toast]);

    const fetchLogs = useCallback(async () => {
        const { data: logs, error } = await supabase.from('daily_meal_logs').select('*').eq('user_id', userId);
        if (error) {
            console.error("Error fetching logs:", error);
            return;
        }

        const newSelectedMealLogs = new Set();
        const newSelectionCounts = {};
        const todayStr = format(today, 'yyyy-MM-dd');

        (logs || []).forEach(log => {
            if (log.diet_plan_recipe_id) {
                const dnd_id = `pr-${log.diet_plan_recipe_id}`;
                if (log.log_date === todayStr) {
                    newSelectedMealLogs.add(dnd_id);
                }
                newSelectionCounts[dnd_id] = (newSelectionCounts[dnd_id] || 0) + 1;
            }
        });

        setSelectedMealLogs(newSelectedMealLogs);
        setSelectionCounts(newSelectionCounts);
    }, [userId, today]);
    
    useEffect(() => {
        const next7Days = Array.from({ length: 7 }).map((_, i) => addDays(today, i));
        setDays(next7Days);
        fetchPlannerData();
        fetchLogs();
    }, [fetchPlannerData, fetchLogs]);

    const handleAddRecipeClick = (day, meal) => {
        if (!day || !meal) return;
        const dayOfWeek = getDay(day);
        setAddRecipeParams({ 
            meal: meal, 
            dayOfWeek: dayOfWeek === 0 ? 7 : dayOfWeek 
        });
        setIsAddRecipeOpen(true);
    };

    const handleRecipeAdded = () => {
        fetchPlannerData();
        fetchLogs();
        setIsAddRecipeOpen(false);
    };

    const handleToggleMealSelection = useCallback(async (item) => {
        if (!item || !item.dnd_id) return;
        const logDate = format(new Date(), 'yyyy-MM-dd');
        const dnd_id = item.dnd_id;

        const isCurrentlySelected = selectedMealLogs.has(dnd_id);

        try {
            if (isCurrentlySelected) {
                const { error } = await supabase.from('daily_meal_logs').delete()
                    .eq('user_id', userId)
                    .eq('log_date', logDate)
                    .eq('diet_plan_recipe_id', item.id);
                if (error) throw error;
                toast({ title: 'Comida desmarcada', description: `${item.recipe?.name || 'Receta'} ya no está marcada para hoy.` });
            } else {
                const { error } = await supabase.from('daily_meal_logs').insert({
                    user_id: userId,
                    log_date: logDate,
                    diet_plan_recipe_id: item.id,
                    user_day_meal_id: item.day_meal?.id,
                });
                if (error) throw error;
                toast({ title: 'Comida marcada', description: `${item.recipe?.name || 'Receta'} marcada como comida de hoy.` });
            }
            fetchLogs();
        } catch (error) {
            toast({ title: 'Error', description: `No se pudo actualizar el registro: ${error.message}`, variant: 'destructive' });
        }
    }, [userId, toast, fetchLogs, selectedMealLogs]);

    const handleRecipeClick = (recipe) => {
        setRecipeToEdit(recipe);
        setIsEditorOpen(true);
    };

    const handleShoppingListClick = () => {
        navigate('/shopping-list', {
            state: {
                initialMode: 'planned',
                initialDate: new Date().toISOString()
            }
        });
    };

    return (
        <>
            <Helmet>
                <title>{`Planificador Semanal - Gsus Martz`}</title>
                <meta name="description" content="Planifica tus comidas para los próximos 7 días." />
            </Helmet>
            <main className="w-full px-4 py-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="space-y-6"
                >
                    <div className="flex justify-between items-center">
                      <h1 className="text-3xl font-bold text-white">Planificador Semanal</h1>
                      <Button onClick={handleShoppingListClick} className="bg-green-600 hover:bg-green-700">
                        <ShoppingCart className="mr-2 h-5 w-5" />
                        Lista de la Compra
                      </Button>
                    </div>

                    {loading ? (
                        <div className="flex justify-center items-center py-20">
                            <Loader2 className="h-12 w-12 animate-spin text-green-500" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
                            {days.map(day => {
                                if (!isValid(day)) return null;
                                const dayOfWeek = getDay(day) === 0 ? 7 : getDay(day);
                                const dayMeals = plannedMeals.filter(m => m.day_of_week === dayOfWeek);

                                return (
                                    <Card key={format(day, 'yyyy-MM-dd')} className="bg-slate-800/60 border-slate-700 text-white flex flex-col">
                                        <CardHeader className="text-center pb-2">
                                            <CardTitle className="text-lg">{capitalize(format(day, 'EEEE', { locale: es }))}</CardTitle>
                                            <p className="text-sm text-gray-400">{format(day, 'dd/MM')}</p>
                                        </CardHeader>
                                        <CardContent className="space-y-3 flex-grow overflow-y-auto">
                                            {userDayMeals.map(meal => {
                                                if (!meal || !meal.day_meal) return null;
                                                const mealsForSlot = dayMeals.filter(m => m.day_meal && m.day_meal.id === meal.day_meal_id);
                                                return (
                                                  <div key={meal.id} className="p-3 bg-slate-900/50 rounded-lg">
                                                      <div className="flex justify-between items-center mb-2">
                                                          <h4 className="font-semibold text-gray-300">{meal.day_meal.name}</h4>
                                                          <Button variant="ghost" size="icon" className="h-6 w-6 text-green-400 hover:text-green-300 hover:bg-green-500/10" onClick={() => handleAddRecipeClick(day, meal)}>
                                                              <Plus className="h-4 w-4"/>
                                                          </Button>
                                                      </div>
                                                      <div className="space-y-2">
                                                      {mealsForSlot.length > 0 ? mealsForSlot.map(item => (
                                                          <RecipeCard
                                                              key={item.dnd_id}
                                                              recipe={item}
                                                              isAdminView={isAdminView}
                                                              user={authUser}
                                                              allFoods={allFoods}
                                                              handleRecipeClick={() => handleRecipeClick(item)}
                                                              handleRemoveRecipe={null}
                                                              isListView={true}
                                                              onSelectToggle={() => handleToggleMealSelection(item)}
                                                              isSelected={selectedMealLogs.has(item.dnd_id)}
                                                              selectionCount={selectionCounts[item.dnd_id] || 0}
                                                              inPlanner={true}
                                                          />
                                                      )) : (
                                                          <p className="text-xs text-gray-500 italic text-center py-2">Sin planificar</p>
                                                      )}
                                                      </div>
                                                  </div>
                                                );
                                            })}
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </motion.div>
            </main>
            {activePlan && (
                <AddRecipeToPlanDialog
                    open={isAddRecipeOpen}
                    onOpenChange={setIsAddRecipeOpen}
                    dietPlanId={activePlan.id}
                    onRecipeAdded={handleRecipeAdded}
                    userId={userId}
                    preselectedMeal={addRecipeParams.meal}
                    dayOfWeek={addRecipeParams.dayOfWeek}
                />
            )}
            {recipeToEdit && (
                <RecipeEditorModal
                    open={isEditorOpen}
                    onOpenChange={setIsEditorOpen}
                    recipeToEdit={recipeToEdit}
                    onSaveSuccess={() => {
                        setIsEditorOpen(false);
                        fetchPlannerData();
                    }}
                    isAdminView={isAdminView}
                    userId={userId}
                />
            )}
        </>
    );
};

const capitalize = (s) => {
    if (typeof s !== 'string' || !s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
};

export default WeeklyPlannerPage;