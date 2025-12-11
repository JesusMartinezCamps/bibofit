import React, { useMemo } from 'react';
    import RecipeCard from './RecipeCard';
    import { Button } from '@/components/ui/button';
    import { Plus } from 'lucide-react';
    import { format } from 'date-fns';
    import { es } from 'date-fns/locale';
    import { cn } from '@/lib/utils';
    import FreeRecipeCard from '@/components/plans/FreeRecipeCard'; // Import FreeRecipeCard

    const WeekView = ({
      weekDates,
      isAdminView,
      user,
      allFoods,
      handleRecipeClick,
      onAddRecipeClick,
      plannedMeals,
      userRestrictions,
      dayElementsRef,
      userDayMeals,
      handleRemovePlannedMeal,
    }) => {
      
      const capitalize = (s) => {
        if (typeof s !== 'string') return ''
        return s.charAt(0).toUpperCase() + s.slice(1)
      }

      const sortedUserDayMeals = useMemo(() => {
        return [...(userDayMeals || [])].sort((a, b) => (a.day_meal?.display_order || 0) - (b.day_meal?.display_order || 0));
      }, [userDayMeals]);

      return (
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-3">
          {weekDates.map((date, index) => {
            const dateString = format(date, 'yyyy-MM-dd');
            const dayPlannedMeals = plannedMeals.filter(log => log.plan_date === dateString);
            
            return (
              <div 
                key={dateString} 
                ref={el => dayElementsRef.current[index] = el}
                className="bg-gray-800/50 p-2 rounded-lg min-h-[200px]"
              >
                <h4 className="font-bold text-center text-white pb-2 mb-2 border-b border-gray-700 capitalize">
                  <span className="text-lg mr-2">{format(date, 'd')}</span>
                  {capitalize(format(date, 'eeee', { locale: es }))}
                </h4>
                <div className="space-y-2">
                  {sortedUserDayMeals.map(meal => {
                    const plannedMealForSlot = dayPlannedMeals.find(pm => pm.day_meal_id === meal.day_meal.id);
                    
                    let itemForSlot = null;
                    let recipeObjectForModal = null;

                    if (plannedMealForSlot) {
                        if (plannedMealForSlot.diet_plan_recipe) {
                            itemForSlot = { ...plannedMealForSlot.diet_plan_recipe, type: 'recipe' };
                            recipeObjectForModal = {
                                ...itemForSlot,
                                ingredients: itemForSlot.custom_ingredients?.length > 0 
                                    ? itemForSlot.custom_ingredients 
                                    : itemForSlot.recipe?.recipe_ingredients || [],
                                name: itemForSlot.is_customized ? itemForSlot.custom_name : itemForSlot.recipe?.name,
                                instructions: itemForSlot.is_customized ? itemForSlot.custom_instructions : itemForSlot.recipe?.instructions,
                                prep_time_min: itemForSlot.is_customized ? itemForSlot.custom_prep_time_min : itemForSlot.recipe?.prep_time_min,
                                difficulty: itemForSlot.is_customized ? itemForSlot.custom_difficulty : itemForSlot.recipe?.difficulty,
                            };
                        } else if (plannedMealForSlot.private_recipe) {
                            itemForSlot = { ...plannedMealForSlot.private_recipe, type: 'private_recipe', is_private: true, id: plannedMealForSlot.private_recipe.id };
                            recipeObjectForModal = {
                                ...itemForSlot,
                                ingredients: itemForSlot.private_recipe_ingredients || [],
                            };
                        } else if (plannedMealForSlot.free_recipe) {
                            itemForSlot = { ...plannedMealForSlot.free_recipe, type: 'free_recipe' };
                            recipeObjectForModal = {
                                ...itemForSlot,
                                ingredients: itemForSlot.free_recipe_ingredients || [],
                                name: itemForSlot.name,
                                instructions: itemForSlot.instructions,
                                prep_time_min: itemForSlot.prep_time_min,
                                difficulty: itemForSlot.difficulty,
                            };
                        }
                    }

                    return (
                      <div
                        key={`${dateString}-${meal.id}`}
                        className="p-2 rounded-md bg-gray-900/40"
                      >
                        <div className="flex justify-between items-center mb-2">
                          <h5 className="font-semibold text-sm text-gray-300">{meal.day_meal.name}</h5>
                        </div>
                        <div className="space-y-2 min-h-[50px]">
                          {itemForSlot ? (
                            <div key={plannedMealForSlot.id}>
                                {itemForSlot.type === 'free_recipe' ? (
                                    <FreeRecipeCard
                                        freeMeal={recipeObjectForModal}
                                        allFoods={allFoods}
                                        handleCardClick={(r) => handleRecipeClick(r, null, date)}
                                        handleRemove={() => handleRemovePlannedMeal(plannedMealForSlot.id)}
                                        isListView={false}
                                    />
                                ) : (
                                    <RecipeCard
                                        recipe={itemForSlot}
                                        user={user}
                                        allFoods={allFoods}
                                        handleRecipeClick={(recipe, adj) => handleRecipeClick(recipeObjectForModal, adj, date)}
                                        handleRemoveRecipe={() => handleRemovePlannedMeal(plannedMealForSlot.id)}
                                        isListView={false}
                                        adjustment={null}
                                        userRestrictions={userRestrictions}
                                        isAdminView={isAdminView}
                                    />
                                )}
                            </div>
                          ) : (
                            <button 
                              className="w-full h-full text-center p-2 rounded-md border-2 border-dashed border-gray-600 hover:border-sky-500 hover:bg-sky-500/10 transition-all"
                              onClick={() => onAddRecipeClick(meal, date, 'plan_only')}
                            >
                              <p className="text-sm text-sky-400/80 italic">Vacío</p>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          })}
        </div>
      );
    };

    export default WeekView;