import React, { useMemo, useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabaseClient';
import { format, addDays } from 'date-fns';
import ProteinIcon from '@/components/icons/ProteinIcon';
import CarbsIcon from '@/components/icons/CarbsIcon';
import FatsIcon from '@/components/icons/FatsIcon';
import { Button } from '@/components/ui/button';

const ShoppingListGroup = ({ title, icon, items, checkedItems, onCheckedChange }) => {
    if (items.length === 0) return null;
    return (
        <div>
            <h3 className="text-lg font-semibold flex items-center gap-2 text-green-400 mb-3 border-b border-green-500/20 pb-2">
                {icon}
                {title}
            </h3>
            <div className="space-y-3">
                {items.map((item) => (
                    <div key={`${item.id}-${title}`} className="flex items-start space-x-3 p-2 rounded-md bg-gray-800/50">
                        <Checkbox 
                            id={`item-${item.id}-${title}`} 
                            checked={checkedItems.has(item.id)}
                            onCheckedChange={(checked) => onCheckedChange(item.id, checked)}
                            className="border-gray-600 data-[state=checked]:bg-green-500 data-[state=checked]:text-white mt-1" 
                        />
                        <div className="flex-1">
                            <Label htmlFor={`item-${item.id}-${title}`} className="text-base text-gray-200 cursor-pointer">
                                {item.name}
                                {item.totalQuantity && (
                                    <span className="font-bold text-green-400"> - {Math.round(item.totalQuantity)} {item.unit}</span>
                                )}
                            </Label>
                             {item.recipeNames && item.recipeNames.size > 0 && (
                                <p className="text-xs text-gray-400 mt-1 italic pl-1">
                                    Para: {Array.from(item.recipeNames).join(', ')}
                                </p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};


const ShoppingListDialog = ({ open, onOpenChange, userId, currentDate, activePlan, viewMode }) => {
    const [plannedItems, setPlannedItems] = useState([]);
    const [allFoods, setAllFoods] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dailyListData, setDailyListData] = useState({ proteins: [], carbs: [], fats: [], others: [] });
    const [checkedItems, setCheckedItems] = useState(new Set());
    const [weekLogs, setWeekLogs] = useState([]);

    const handleCheckedChange = (itemId, isChecked) => {
        setCheckedItems(prev => {
            const newSet = new Set(prev);
            if (isChecked) {
                newSet.add(itemId);
            } else {
                newSet.delete(itemId);
            }
            return newSet;
        });
    };

    useEffect(() => {
        const fetchShoppingData = async () => {
            if (!open) return;
            if (!userId || !activePlan) {
                if (!activePlan) setLoading(false);
                return;
            }
            
            setLoading(true);
            setCheckedItems(new Set());
            setWeekLogs([]);
            setPlannedItems([]);
            
            try {
                const { data: foods, error: foodsError } = await supabase
                    .from('food')
                    .select('*, food_to_macro_roles(macro_roles(id, name))');
                if (foodsError) throw foodsError;
                setAllFoods(foods);

                if (viewMode === 'week') {
                    const weekDates = Array.from({ length: 7 }).map((_, i) => addDays(currentDate, i));
                    const startDate = format(weekDates[0], 'yyyy-MM-dd');
                    const endDate = format(weekDates[weekDates.length - 1], 'yyyy-MM-dd');

                    const { data: logs, error: logError } = await supabase
                        .from('planned_meals')
                        .select('diet_plan_recipe_id, private_recipe_id')
                        .eq('user_id', userId)
                        .gte('plan_date', startDate)
                        .lte('plan_date', endDate);

                    if (logError) throw logError;
                    setWeekLogs(logs || []);
                    
                    const dietPlanRecipeIds = logs.map(l => l.diet_plan_recipe_id).filter(Boolean);
                    const privateRecipeIds = logs.map(l => l.private_recipe_id).filter(Boolean);

                    const [recipesRes, privateRecipesRes] = await Promise.all([
                        dietPlanRecipeIds.length > 0 ? supabase.from('diet_plan_recipes').select('*, recipe:recipe_id(name, recipe_ingredients(*)), custom_name, custom_ingredients:diet_plan_recipe_ingredients(*)').in('id', dietPlanRecipeIds) : Promise.resolve({ data: [] }),
                        privateRecipeIds.length > 0 ? supabase.from('private_recipes').select('*, name, private_recipe_ingredients(*)').in('id', privateRecipeIds) : Promise.resolve({ data: [] })
                    ]);

                    if (recipesRes.error) throw recipesRes.error;
                    if (privateRecipesRes.error) throw privateRecipesRes.error;
                    
                    setPlannedItems([...(recipesRes.data || []), ...(privateRecipesRes.data || [])]);

                } else if (viewMode === 'list') {
                    const foodIds = new Set();

                    const { data: planRecipes, error: planRecipesError } = await supabase
                        .from('diet_plan_recipes')
                        .select('custom_ingredients:diet_plan_recipe_ingredients(food_id), recipe:recipe_id(recipe_ingredients(food_id)), private_recipe:private_recipe_id(*, private_recipe_ingredients(food_id))')
                        .eq('diet_plan_id', activePlan.id);

                    if (planRecipesError) throw planRecipesError;
                    
                    (planRecipes || []).forEach(recipe => {
                        if (recipe.private_recipe && recipe.private_recipe.private_recipe_ingredients) {
                            recipe.private_recipe.private_recipe_ingredients.forEach(ing => foodIds.add(ing.food_id));
                        } else {
                            const ingredients = recipe.custom_ingredients?.length > 0 ? recipe.custom_ingredients : recipe.recipe?.recipe_ingredients || [];
                            ingredients.forEach(ing => foodIds.add(ing.food_id));
                        }
                    });
                    
                    if (foodIds.size > 0) {
                        const { data: foodDetails, error: foodDetailsError } = await supabase
                            .from('food')
                            .select('*, food_to_macro_roles(macro_roles(id, name))')
                            .in('id', Array.from(foodIds));
                        if (foodDetailsError) throw foodDetailsError;
                        
                        const categorized = { proteins: [], carbs: [], fats: [], others: [] };
                        foodDetails.forEach(food => {
                            const roles = food.food_to_macro_roles.map(r => r.macro_roles.name);
                            let added = false;
                            if (roles.includes('Proteínas')) { categorized.proteins.push(food); added = true; }
                            if (roles.includes('Hidratos de Carbono')) { categorized.carbs.push(food); added = true; }
                            if (roles.includes('Grasas')) { categorized.fats.push(food); added = true; }
                            if(!added) { categorized.others.push(food); }
                        });

                        Object.values(categorized).forEach(arr => arr.sort((a,b) => a.name.localeCompare(b.name)));
                        setDailyListData(categorized);
                    } else {
                        setDailyListData({ proteins: [], carbs: [], fats: [], others: [] });
                    }
                }

            } catch (error) {
                console.error("Error fetching shopping list data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchShoppingData();
    }, [open, userId, currentDate, activePlan, viewMode]);

    const weeklyShoppingList = useMemo(() => {
        if (viewMode !== 'week' || loading || !plannedItems || !allFoods.length) {
            return { proteins: [], carbs: [], fats: [], others: [] };
        }
    
        const ingredientsMap = new Map();
    
        weekLogs.forEach(log => {
            let recipeItem;
            if (log.diet_plan_recipe_id) {
                recipeItem = plannedItems.find(p => p.id === log.diet_plan_recipe_id && !p.user_id);
            } else if (log.private_recipe_id) {
                recipeItem = plannedItems.find(p => p.id === log.private_recipe_id && p.user_id);
            }
    
            if (!recipeItem) return;
    
            const recipeName = recipeItem.custom_name || recipeItem.recipe?.name || recipeItem.name || "Receta sin nombre";
            let ingredientsSource = recipeItem.private_recipe_ingredients || recipeItem.custom_ingredients || recipeItem.recipe?.recipe_ingredients || [];
    
            ingredientsSource.forEach(ing => {
                const food = allFoods.find(f => String(f.id) === String(ing.food_id));
                if (!food) return;
    
                const quantity = parseFloat(ing.grams || ing.quantity || 0);
    
                if (ingredientsMap.has(food.id)) {
                    const existing = ingredientsMap.get(food.id);
                    existing.totalQuantity += quantity;
                    existing.recipeNames.add(recipeName);
                } else {
                    ingredientsMap.set(food.id, {
                        ...food,
                        totalQuantity: quantity,
                        unit: food.food_unit === 'unidades' ? 'ud(s)' : 'g',
                        recipeNames: new Set([recipeName])
                    });
                }
            });
        });
        
        const categorized = { proteins: [], carbs: [], fats: [], others: [] };
        Array.from(ingredientsMap.values()).forEach(food => {
             const roles = food.food_to_macro_roles.map(r => r.macro_roles.name);
             let added = false;
             if (roles.includes('Proteínas')) { categorized.proteins.push(food); added = true; }
             if (roles.includes('Hidratos de Carbono')) { categorized.carbs.push(food); added = true; }
             if (roles.includes('Grasas')) { categorized.fats.push(food); added = true; }
             if (!added) { categorized.others.push(food); }
        });
        
        Object.values(categorized).forEach(arr => arr.sort((a,b) => a.name.localeCompare(b.name)));

        return categorized;

    }, [plannedItems, allFoods, loading, viewMode, weekLogs]);

    const description = viewMode === 'week' 
        ? "Ingredientes para las recetas planificadas en los próximos 7 días. Las comidas libres no se incluyen."
        : "Lista de la compra simplificada para las recetas de hoy.";

    const renderListContent = () => {
        if (loading) {
            return (
                <div className="flex justify-center items-center py-10">
                    <Loader2 className="h-8 w-8 animate-spin text-green-500" />
                </div>
            );
        }

        const listContent = viewMode === 'week' ? weeklyShoppingList : dailyListData;
        const { proteins, carbs, fats, others } = listContent;
        const totalItems = proteins.length + carbs.length + fats.length + others.length;

        const noItemsMessage = viewMode === 'week' 
            ? "No hay recetas marcadas en el planificador para generar una lista."
            : "No hay recetas en el plan de hoy para generar una lista.";

        return totalItems > 0 ? (
            <div className="space-y-6">
                <ShoppingListGroup title="Proteínas" icon={<ProteinIcon className="w-5 h-5" />} items={proteins} checkedItems={checkedItems} onCheckedChange={handleCheckedChange} />
                <ShoppingListGroup title="Hidratos de Carbono" icon={<CarbsIcon className="w-5 h-5" />} items={carbs} checkedItems={checkedItems} onCheckedChange={handleCheckedChange} />
                <ShoppingListGroup title="Grasas" icon={<FatsIcon className="w-5 h-5" />} items={fats} checkedItems={checkedItems} onCheckedChange={handleCheckedChange} />
                <ShoppingListGroup title="Otros" icon={null} items={others} checkedItems={checkedItems} onCheckedChange={handleCheckedChange} />
            </div>
        ) : (
            <p className="text-center text-gray-400 py-10">{noItemsMessage}</p>
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-[#1a1e23] border-gray-700 text-white w-[95vw] max-w-lg p-0 flex flex-col h-[90vh] max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle>Lista de la Compra</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onOpenChange(false)}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full"
                >
                    <X className="h-5 w-5" />
                </Button>
                <div className="flex-1 overflow-y-auto styled-scrollbar-green pr-4">
                    {renderListContent()}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ShoppingListDialog;