import React, { useState, useEffect } from 'react';
    import { Button } from '@/components/ui/button';
    import { Eye } from 'lucide-react';
    import RecipeCard from '@/components/shared/WeeklyDietPlanner/RecipeCard';
    import { useAuth } from '@/contexts/AuthContext';
    import { supabase } from '@/lib/supabaseClient';
    import { useNavigate } from 'react-router-dom';

    const RecipeAssignment = ({ meals, planRecipes, allFoods, onRecipeClick, userId, dietPlanId, isTemplate }) => {
        const { user } = useAuth();
        const navigate = useNavigate();
        const [mealCounts, setMealCounts] = useState({});

        useEffect(() => {
            const fetchMealCounts = async () => {
                if (!userId) return;
                try {
                    const { data, error } = await supabase
                        .from('daily_meal_logs')
                        .select('diet_plan_recipe_id, free_recipe_id')
                        .eq('user_id', userId);

                    if (error) throw error;

                    const counts = {};
                    data.forEach(log => {
                        const key = log.diet_plan_recipe_id ? `pr-${log.diet_plan_recipe_id}` : `fr-${log.free_recipe_id}`;
                        if(key) counts[key] = (counts[key] || 0) + 1;
                    });
                    setMealCounts(counts);
                } catch (error) {
                    console.error("Error fetching meal counts:", error);
                }
            };

            if(!isTemplate) {
                fetchMealCounts();
            }
        }, [userId, planRecipes, isTemplate]);
        
        const sortedMeals = [...meals].sort((a, b) => a.day_meal.display_order - b.day_meal.display_order);

        return (
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h4 className="font-semibold text-lg">{isTemplate ? 'Recetas de la Plantilla' : 'Recetas del Plan'}</h4>
                    <Button variant="outline-diet" onClick={() => navigate(`/admin-panel/plan-detail/${dietPlanId}`)}>
                        <Eye className="mr-2 h-4 w-4" />
                        {isTemplate ? 'Gestionar Recetas de Plantilla' : 'Ver Plan Semanal'}
                    </Button>
                </div>
                <div className="space-y-6">
                    {sortedMeals.map(meal => {
                        const recipesForMeal = planRecipes
                            .filter(pr => pr.day_meal_id === meal.day_meal.id)
                            .sort((a, b) => (mealCounts[`pr-${b.id}`] || 0) - (mealCounts[`pr-${a.id}`] || 0));

                        return (
                            <div key={meal.id}>
                                <div className="flex items-center gap-3 mb-4">
                                    <h3 className="text-xl font-bold text-white">{meal.day_meal.name}</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {recipesForMeal.map(pr => (
                                        <RecipeCard
                                            key={pr.id}
                                            recipe={pr}
                                            isAdminView={true}
                                            user={user}
                                            allFoods={allFoods}
                                            handleRecipeClick={onRecipeClick}
                                            isListView={true}
                                            selectionCount={mealCounts[`pr-${pr.id}`] || 0}
                                            inPlanner={true}
                                        />
                                    ))}
                                    {recipesForMeal.length === 0 && (
                                         <div className="md:col-span-2 lg:col-span-3">
                                            <p className="text-sm text-gray-500 text-center italic py-4 bg-gray-900/40 rounded-lg">No hay recetas asignadas a esta comida.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    export default RecipeAssignment;