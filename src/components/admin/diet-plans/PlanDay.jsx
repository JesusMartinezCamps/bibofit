import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import PlanRecipeCard from './PlanRecipeCard';
import { Droppable, Draggable } from 'react-beautiful-dnd';
import MealTargetMacros from '@/components/shared/MealTargetMacros';

const PlanDay = ({ day, dayIndex, meal, recipes, onAddRecipe, onEditRecipe, onDeleteRecipe, userDayMeals }) => {
    const [isHovered, setIsHovered] = useState(false);
    const dayMealData = userDayMeals?.find(udm => udm.day_meal_id === meal.id);

    return (
        <div 
            className="flex-1 min-w-[280px] bg-slate-900/50 rounded-lg flex flex-col"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="p-3 border-b border-slate-700/50">
                <h3 className="font-bold text-center text-white">{meal.name}</h3>
                {dayMealData && (
                    <div className="mt-2 flex justify-center">
                        <MealTargetMacros mealTargetMacros={dayMealData} />
                    </div>
                )}
            </div>
            <Droppable droppableId={`${dayIndex}-${meal.id}`} type="RECIPE">
                {(provided, snapshot) => (
                    <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`p-3 space-y-4 md:space-y-3 flex-grow transition-colors ${snapshot.isDraggingOver ? 'bg-green-500/10' : ''}`}
                    >
                        {recipes.map((recipe, index) => (
                            <Draggable key={recipe.id} draggableId={String(recipe.id)} index={index}>
                                {(provided, snapshot) => (
                                    <div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                        style={{
                                            ...provided.draggableProps.style,
                                            boxShadow: snapshot.isDragging ? '0 4px 15px rgba(0,0,0,0.5)' : 'none',
                                        }}
                                    >
                                        <PlanRecipeCard 
                                            recipe={recipe} 
                                            onEdit={() => onEditRecipe(recipe)}
                                            onDelete={() => onDeleteRecipe(recipe.id)} 
                                        />
                                    </div>
                                )}
                            </Draggable>
                        ))}
                        {provided.placeholder}
                    </div>
                )}
            </Droppable>
            <div className="p-3 mt-auto">
                <Button 
                    variant="outline" 
                    className={`w-full border-dashed transition-all duration-300 ${isHovered ? 'border-green-500 text-green-400' : 'border-slate-600 text-slate-400'}`}
                    onClick={() => onAddRecipe(dayIndex, meal.id)}
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Añadir Receta
                </Button>
            </div>
        </div>
    );
};

export default PlanDay;