import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Calendar, List, Plus, Trash2, Lock, Layers, Search, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabaseClient';
import { format, startOfDay, addDays } from 'date-fns';
import ProteinIcon from '@/components/icons/ProteinIcon';
import CarbsIcon from '@/components/icons/CarbsIcon';
import FatsIcon from '@/components/icons/FatsIcon';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import ModalStateToggle from '@/components/shared/ModalStateToggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TooltipProvider } from "@/components/ui/tooltip";

const STORAGE_KEY = 'shoppingListModalMode';

const normalizeText = (text) => {
    return text
        ? text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
        : "";
};

const SmartHighlight = ({ text, highlight }) => {
    if (!highlight || !highlight.trim() || !text) return text;

    const normalizedHighlight = normalizeText(highlight);
    if (!normalizeText(text).includes(normalizedHighlight)) return text;

    const result = [];
    let remainingText = text;
    let remainingNormalized = normalizeText(text);

    while (remainingNormalized.includes(normalizedHighlight)) {
        const startIndex = remainingNormalized.indexOf(normalizedHighlight);
        
        if (startIndex > 0) {
            result.push(<span key={`${result.length}-text`}>{remainingText.substring(0, startIndex)}</span>);
        }

        const originalMatch = remainingText.substring(startIndex, startIndex + normalizedHighlight.length);
        result.push(
            <span key={`${result.length}-highlight`} className="bg-yellow-500/40 text-yellow-100 font-bold rounded px-0.5 shadow-[0_0_10px_rgba(234,179,8,0.2)]">
                {originalMatch}
            </span>
        );

        remainingText = remainingText.substring(startIndex + normalizedHighlight.length);
        remainingNormalized = remainingNormalized.substring(startIndex + normalizedHighlight.length);
    }

    if (remainingText) {
        result.push(<span key={`${result.length}-end`}>{remainingText}</span>);
    }

    return <>{result}</>;
};

const PrivateShoppingList = ({ items, onAdd, onToggle, onRemove, loading, searchQuery }) => {
    const [newItemName, setNewItemName] = useState('');

    const handleAddClick = () => {
        if (newItemName.trim()) {
            onAdd(newItemName.trim());
            setNewItemName('');
        }
    };

    const sortedItems = useMemo(() => {
        return [...items].sort((a, b) => {
            const nameA = a.item_name || '';
            const nameB = b.item_name || '';
            if (a.is_checked === b.is_checked) {
                return nameA.localeCompare(nameB);
            }
            return a.is_checked ? 1 : -1;
        });
    }, [items]);

    return (
        <div>
            <h3 className="text-lg font-semibold flex items-center gap-2 text-[rgb(206_165_255)] mb-3 border-b border-[#9d59ef]/20 pb-2">
                <Lock className="w-5 h-5" />
                Lista Privada
            </h3>
            <div className="flex gap-2 mb-4">
                <Input
                    type="text"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="Añadir artículo..."
                    className="bg-slate-800 border-slate-600 text-white focus:border-[#9d59ef]"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddClick()}
                />
                <Button onClick={handleAddClick} size="icon" className="bg-[#9d59ef] hover:bg-[#9d59ef]/90 flex-shrink-0">
                    <Plus className="w-5 h-5" />
                </Button>
            </div>
            <div className="space-y-3">
                {loading && <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#9d59ef]" />}
                {!loading && sortedItems.map((item) => (
                    <div
                        key={item.id}
                        className={cn(
                            "flex items-center space-x-3 p-2 rounded-md transition-colors group",
                            item.is_checked ? 'bg-slate-800/30 opacity-60' : 'bg-[#9d59ef]/20'
                        )}
                    >
                        <Checkbox
                            id={`private-item-${item.id}`}
                            checked={item.is_checked}
                            onCheckedChange={() => onToggle(item.id, !item.is_checked)}
                            className="border-[#9d59ef]/80 data-[state=checked]:bg-[#9d59ef]/50 data-[state=checked]:border-[#9d59ef] data-[state=checked]:text-white mt-1"
                        />
                        <Label htmlFor={`private-item-${item.id}`} className={cn("flex-1 text-base w-full block cursor-pointer", item.is_checked ? "text-gray-400 line-through" : "text-gray-200")}>
                            <SmartHighlight text={item.item_name} highlight={searchQuery} />
                        </Label>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-500/70 transition-opacity"
                            onClick={() => onRemove(item.id)}
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    );
};

const ShoppingListGroup = ({ title, icon, items, checkedItems, onCheckedChange, searchQuery }) => {
    const sortedItems = useMemo(() => {
        return [...items].sort((a, b) => {
            const safeCheckedItems = checkedItems || new Set();
            const isAChecked = safeCheckedItems.has(a.id);
            const isBChecked = safeCheckedItems.has(b.id);
            const nameA = a.name || '';
            const nameB = b.name || '';

            if (isAChecked === isBChecked) {
                return nameA.localeCompare(nameB);
            }
            return isAChecked ? 1 : -1;
        });
    }, [items, checkedItems]);

    if (items.length === 0) return null;

    const formatRecipeList = (recipeCounts) => {
        if (!recipeCounts) return null;
        return Object.entries(recipeCounts)
            .map(([name, count], idx) => (
                <span key={idx}>
                    <SmartHighlight text={name} highlight={searchQuery} />
                    {count > 1 ? ` (x${count})` : ''}
                    {idx < Object.entries(recipeCounts).length - 1 ? ', ' : ''}
                </span>
            ));
    };

    return (
        <div>
            <h3 className="text-lg font-semibold flex items-center gap-2 text-cyan-400 mb-3 border-b border-cyan-800/20 pb-2">
                {icon}
                {title}
            </h3>
            <div className="space-y-3">
                {sortedItems.map((item, index) => {
                    const safeCheckedItems = checkedItems || new Set();
                    const isChecked = safeCheckedItems.has(item.id);
                    const itemKey = item.uniqueKey || `${item.id}-${index}`;
                    return (
                        <div
                            key={itemKey}
                            className={cn(
                                "flex items-start space-x-3 p-2 rounded-md cursor-pointer transition-colors hover:bg-[rgb(30_84_111_/_70%)]",
                                isChecked ? 'bg-[rgb(11_28_37_/_18%)] opacity-60' : 'bg-[rgb(30_84_111_/_32%)]'
                            )}
                            onClick={() => onCheckedChange(item.id, !isChecked)}
                        >
                            <Checkbox
                                id={`item-${itemKey}`}
                                checked={isChecked}
                                className="border-[rgb(53_127_169)] data-[state=checked]:bg-[rgb(4_114_133_/_50%)] data-[state=checked]:border-[rgb(53_127_169)] data-[state=checked]:text-white mt-1"
                            />
                            <div className="flex-1 pointer-events-none">
                                <Label htmlFor={`item-${itemKey}`} className={cn("text-base w-full block", isChecked ? "text-gray-400 line-through" : "text-gray-200")}>
                                    <SmartHighlight text={item.name} highlight={searchQuery} />
                                    {(item.totalQuantity || item.displayQuantity) && (
                                        <span className={cn("font-bold", isChecked ? "text-cyan-400/50" : "text-cyan-400")}>
                                            {' '} - {Math.round(item.totalQuantity || item.displayQuantity)} {item.unit}
                                        </span>
                                    )}
                                </Label>
                                 {item.recipeCounts && (
                                    <p className="text-xs text-gray-400 mt-1 italic pl-1">
                                        Para: {formatRecipeList(item.recipeCounts)}
                                    </p>
                                )}
                                {!item.recipeCounts && item.recipeName && (
                                    <p className="text-xs text-gray-400 mt-1 italic pl-1">
                                        Para: <SmartHighlight text={item.recipeName} highlight={searchQuery} />
                                    </p>
                                )}
                                {item.recipeNames && item.recipeNames.length > 0 && (
                                     <p className="text-xs text-gray-400 mt-1 italic pl-1">
                                        Para: {item.recipeNames.map((name, idx) => (
                                            <span key={idx}>
                                                <SmartHighlight text={name} highlight={searchQuery} />
                                                {idx < item.recipeNames.length - 1 ? ', ' : ''}
                                            </span>
                                        ))}
                                     </p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const GlobalShoppingListDialog = ({ open, onOpenChange, initialMode = 'planned', initialDate, fromHeader = false }) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    
    // Read from localStorage on initial mount
    const getSavedMode = () => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved === 'complete' || saved === 'planned') {
                return saved;
            }
        } catch (error) {
            console.error('Error reading from localStorage:', error);
        }
        // Fallback to initialMode logic
        return initialMode === 'week' ? 'planned' : (initialMode === 'day' ? 'complete' : (initialMode || 'planned'));
    };

    const [listMode, setListMode] = useState(getSavedMode());
    
    const [listData, setListData] = useState({ proteins: [], carbs: [], fats: [], others: [] });
    const [checkedItems, setCheckedItems] = useState(new Set());
    const [hasChanges, setHasChanges] = useState(false);
    const [privateItems, setPrivateItems] = useState([]);
    const [loadingPrivate, setLoadingPrivate] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const listDataRef = useRef(listData);
    const checkedItemsRef = useRef(checkedItems);
    const listModeRef = useRef(listMode);
    const initialDateRef = useRef(initialDate);

    useEffect(() => { listDataRef.current = listData; }, [listData]);
    useEffect(() => { checkedItemsRef.current = checkedItems; }, [checkedItems]);
    useEffect(() => { listModeRef.current = listMode; }, [listMode]);
    useEffect(() => { initialDateRef.current = initialDate; }, [initialDate]);

    const getListDate = useCallback((mode, date) => {
        const dateToUse = date || new Date();
        return format(dateToUse, 'yyyy-MM-dd');
    }, []);

    const syncShoppingList = useCallback(async () => {
        if (!hasChanges || !user) return;
    
        const currentListData = listDataRef.current;
        const allItems = [
            ...currentListData.proteins,
            ...currentListData.carbs,
            ...currentListData.fats,
            ...currentListData.others,
        ];
    
        if (allItems.length === 0) {
            setHasChanges(false);
            return;
        }
    
        const currentCheckedItems = checkedItemsRef.current;
        const currentListMode = listModeRef.current;
        const listDate = getListDate(currentListMode, initialDateRef.current);
    
        const uniqueItemsMap = new Map();
        allItems.forEach(item => {
            if (!item.is_user_created) {
                 uniqueItemsMap.set(item.id, {
                    user_id: user.id,
                    food_id: item.id,
                    list_type: currentListMode,
                    list_date: listDate,
                    is_checked: currentCheckedItems.has(item.id),
                });
            }
        });
        
        const upsertData = Array.from(uniqueItemsMap.values());
    
        if(upsertData.length > 0) {
            const { error } = await supabase.from('shopping_list_items').upsert(upsertData, {
                onConflict: 'user_id,food_id,list_date,list_type',
            });
            if (error) console.error('Error syncing shopping list:', error);
        }
        setHasChanges(false);
    }, [user, hasChanges, getListDate]);

    const handleOpenChangeWithSync = useCallback((newOpenState) => {
        if (!newOpenState) {
            syncShoppingList();
            setSearchQuery('');
        }
        onOpenChange(newOpenState);
    }, [onOpenChange, syncShoppingList]);

    const handleModeChangeWithSync = useCallback((newMode) => {
        syncShoppingList().then(() => {
            setListMode(newMode);
            setSearchQuery('');
            // Persist to localStorage
            try {
                localStorage.setItem(STORAGE_KEY, newMode);
            } catch (error) {
                console.error('Error saving to localStorage:', error);
            }
        });
    }, [syncShoppingList]);

    useEffect(() => {
        if (open) {
            // When opening, use the saved mode from localStorage
            const mode = getSavedMode();
            setListMode(mode);
        }
    }, [open]);

    const handleCheckedChange = (itemId, isChecked) => {
        setCheckedItems(prev => {
            const newSet = new Set(prev);
            if (isChecked) newSet.add(itemId);
            else newSet.delete(itemId);
            return newSet;
        });
        setHasChanges(true);
    };

    const fetchPrivateItems = useCallback(async () => {
        if (!open || !user) return;
        setLoadingPrivate(true);
        const { data, error } = await supabase
            .from('private_shopping_list_items')
            .select('*')
            .eq('user_id', user.id);

        if (error) console.error("Error fetching private items:", error);
        else setPrivateItems(data || []);
        setLoadingPrivate(false);
    }, [open, user]);

    const handleAddPrivateItem = async (itemName) => {
        const newItem = {
            user_id: user.id,
            item_name: itemName,
            is_checked: false,
        };
        const { data, error } = await supabase.from('private_shopping_list_items').insert(newItem).select().single();
        if (error) console.error("Error adding private item:", error);
        else setPrivateItems(prev => [...prev, data]);
    };

    const handleTogglePrivateItem = async (id, is_checked) => {
        setPrivateItems(prev => prev.map(item => item.id === id ? { ...item, is_checked } : item));
        const { error } = await supabase.from('private_shopping_list_items').update({ is_checked }).eq('id', id);
        if (error) console.error("Error toggling private item:", error);
    };

    const handleRemovePrivateItem = async (id) => {
        setPrivateItems(prev => prev.filter(item => item.id !== id));
        const { error } = await supabase.from('private_shopping_list_items').delete().eq('id', id);
        if (error) console.error("Error removing private item:", error);
    };

    const getIngredients = (item) => {
        if (!item) return [];
        if (item.custom_ingredients && Array.isArray(item.custom_ingredients) && item.custom_ingredients.length > 0) {
            return item.custom_ingredients;
        }
        if (item.recipe && Array.isArray(item.recipe.recipe_ingredients) && item.recipe.recipe_ingredients.length > 0) {
            return item.recipe.recipe_ingredients;
        }
        if (Array.isArray(item.private_recipe_ingredients) && item.private_recipe_ingredients.length > 0) {
            return item.private_recipe_ingredients;
        }
        if (Array.isArray(item.free_recipe_ingredients) && item.free_recipe_ingredients.length > 0) {
            return item.free_recipe_ingredients;
        }
        return [];
    };

    const getMacroCategory = (food) => {
        let roles = [];
        
        if (food.food_to_food_groups && Array.isArray(food.food_to_food_groups)) {
            roles = food.food_to_food_groups
                .map(r => r.food_groups?.macro_role)
                .filter(Boolean);
        } 
        else if (food.user_created_food_to_food_groups && Array.isArray(food.user_created_food_to_food_groups)) {
            roles = food.user_created_food_to_food_groups
                .map(r => r.food_groups?.macro_role)
                .filter(Boolean);
        }

        const hasRole = (target) => roles.some(role => role && role.toLowerCase() === target.toLowerCase());
        
        if (hasRole('proteins') || hasRole('Proteínas')) return 'proteins';
        if (hasRole('carbs') || hasRole('Hidratos de Carbono')) return 'carbs';
        if (hasRole('fats') || hasRole('Grasas')) return 'fats';
        
        const p = parseFloat(food.proteins || 0);
        const c = parseFloat(food.total_carbs || 0);
        const f = parseFloat(food.total_fats || 0);

        if (p > 10 && p >= c && p >= f) return 'proteins';
        if (c > 15 && c >= p && c >= f) return 'carbs';
        if (f > 10 && f >= p && f >= c) return 'fats';

        return 'others';
    };

    const fetchShoppingData = useCallback(async () => {
        if (!open || !user) return;

        setLoading(true);
        setHasChanges(false);
        fetchPrivateItems();

        try {
            const dateToUse = initialDate || new Date();
            const startDate = format(startOfDay(dateToUse), 'yyyy-MM-dd');

            const { data: foods, error: foodsError } = await supabase.from('food')
                .select('*, food_to_food_groups(food_groups(macro_role))');
            if (foodsError) throw foodsError;

            const { data: userFoods, error: userFoodsError } = await supabase.from('user_created_foods')
                .select('*, user_created_food_to_food_groups(food_groups(macro_role))')
                .eq('user_id', user.id);
            if (userFoodsError) throw userFoodsError;

            const allFoodsMap = new Map();
            (foods || []).forEach(f => allFoodsMap.set(`std_${f.id}`, { ...f, is_user_created: false }));
            (userFoods || []).forEach(f => allFoodsMap.set(`uc_${f.id}`, { ...f, is_user_created: true }));

            let allMealsToProcess = [];

            if (listMode === 'complete') {
                const { data: activePlan, error: planError } = await supabase
                    .from('diet_plans').select('id').eq('user_id', user.id).eq('is_active', true).maybeSingle();
                
                if (planError) throw planError;

                if (activePlan) {
                    const [planRecipes, privateRecipes] = await Promise.all([
                        supabase.from('diet_plan_recipes')
                            .select('id, custom_name, is_customized, custom_ingredients:diet_plan_recipe_ingredients(food_id, grams), recipe:recipes(name, recipe_ingredients(food_id, grams))')
                            .eq('diet_plan_id', activePlan.id),
                        supabase.from('private_recipes')
                            .select('id, name, private_recipe_ingredients(food_id, grams)')
                            .eq('diet_plan_id', activePlan.id)
                    ]);

                    if (planRecipes.error) throw planRecipes.error;
                    if (privateRecipes.error) throw privateRecipes.error;

                    if (planRecipes.data) allMealsToProcess = [...allMealsToProcess, ...planRecipes.data];
                    if (privateRecipes.data) allMealsToProcess = [...allMealsToProcess, ...privateRecipes.data];
                }

            } else {
                const endDate = format(addDays(new Date(startDate), 6), 'yyyy-MM-dd');
                
                const { data: plannedLogs, error: plannedError } = await supabase.from('planned_meals')
                    .select('diet_plan_recipe_id, private_recipe_id, free_recipe_id')
                    .eq('user_id', user.id)
                    .gte('plan_date', startDate)
                    .lte('plan_date', endDate);
                
                if (plannedError) throw plannedError;

                if (plannedLogs && plannedLogs.length > 0) {
                    const dietIds = [...new Set(plannedLogs.map(p => p.diet_plan_recipe_id).filter(Boolean))];
                    const privateIds = [...new Set(plannedLogs.map(p => p.private_recipe_id).filter(Boolean))];
                    const freeIds = [...new Set(plannedLogs.map(p => p.free_recipe_id).filter(Boolean))];

                    const [dietRecipes, privateRecipes, freeRecipes] = await Promise.all([
                        dietIds.length ? supabase.from('diet_plan_recipes').select('id, custom_name, is_customized, custom_ingredients:diet_plan_recipe_ingredients(food_id, grams), recipe:recipes(name, recipe_ingredients(food_id, grams))').in('id', dietIds) : { data: [] },
                        privateIds.length ? supabase.from('private_recipes').select('id, name, private_recipe_ingredients(food_id, grams)').in('id', privateIds) : { data: [] },
                        freeIds.length ? supabase.from('free_recipes').select('id, name, free_recipe_ingredients(food_id, user_created_food_id, grams)').in('id', freeIds) : { data: [] }
                    ]);

                    const dietMap = new Map((dietRecipes.data || []).map(r => [r.id, r]));
                    const privateMap = new Map((privateRecipes.data || []).map(r => [r.id, r]));
                    const freeMap = new Map((freeRecipes.data || []).map(r => [r.id, r]));

                    plannedLogs.forEach(log => {
                        if (log.diet_plan_recipe_id && dietMap.has(log.diet_plan_recipe_id)) {
                            allMealsToProcess.push(dietMap.get(log.diet_plan_recipe_id));
                        } else if (log.private_recipe_id && privateMap.has(log.private_recipe_id)) {
                            allMealsToProcess.push(privateMap.get(log.private_recipe_id));
                        } else if (log.free_recipe_id && freeMap.has(log.free_recipe_id)) {
                            allMealsToProcess.push(freeMap.get(log.free_recipe_id));
                        }
                    });
                }
            }

            const completeModeAggregationMap = new Map();
            const ingredientsMap = new Map();
            let recipeNamesMap = new Map();

            allMealsToProcess.forEach(recipe => {
                if (!recipe) return;
                const recipeName = recipe.custom_name || recipe.name || recipe.recipe?.name || "Receta";
                const ingredients = getIngredients(recipe);
                
                ingredients.forEach(ing => {
                    let foodKey = null;
                    if (ing.food_id) {
                        if (allFoodsMap.has(`std_${ing.food_id}`)) foodKey = `std_${ing.food_id}`;
                    } 
                    if (!foodKey && (ing.user_created_food_id)) {
                        foodKey = `uc_${ing.user_created_food_id}`;
                    }
                    
                    const food = foodKey ? allFoodsMap.get(foodKey) : null;
                    
                    if (!food) return;
                    
                    const quantity = parseFloat(ing.grams || ing.quantity || 0);
                    const category = getMacroCategory(food);

                    if (listMode === 'planned') {
                        if (ingredientsMap.has(food.id)) {
                            const existing = ingredientsMap.get(food.id);
                            existing.totalQuantity += quantity;
                            
                            if (!recipeNamesMap.has(food.id)) recipeNamesMap.set(food.id, {});
                            const counts = recipeNamesMap.get(food.id);
                            counts[recipeName] = (counts[recipeName] || 0) + 1;
                        } else {
                            recipeNamesMap.set(food.id, { [recipeName]: 1 });
                            ingredientsMap.set(food.id, { 
                                ...food, 
                                totalQuantity: quantity, 
                                unit: food.food_unit === 'unidades' ? 'ud(s)' : 'g', 
                                category
                            });
                        }
                    } else {
                        if (completeModeAggregationMap.has(food.id)) {
                            const existing = completeModeAggregationMap.get(food.id);
                            if (!existing.recipeNames.includes(recipeName)) {
                                existing.recipeNames.push(recipeName);
                            }
                        } else {
                             completeModeAggregationMap.set(food.id, {
                                ...food,
                                displayQuantity: null,
                                unit: food.food_unit === 'unidades' ? 'ud(s)' : 'g',
                                recipeNames: [recipeName],
                                uniqueKey: `${food.id}_complete_unique`,
                                category
                             });
                        }
                    }
                });
            });

            const categorized = { proteins: [], carbs: [], fats: [], others: [] };
            
            if (listMode === 'planned') {
                Array.from(ingredientsMap.values()).forEach(food => {
                    const itemWithRecipes = { ...food, recipeCounts: recipeNamesMap.get(food.id) };
                    const cat = food.category || 'others';
                    if (categorized[cat]) {
                        categorized[cat].push(itemWithRecipes);
                    } else {
                        categorized.others.push(itemWithRecipes);
                    }
                });
            } 
            else {
                Array.from(completeModeAggregationMap.values()).forEach(item => {
                     const cat = item.category || 'others';
                    if (categorized[cat]) {
                        categorized[cat].push(item);
                    } else {
                        categorized.others.push(item);
                    }
                });
            }

            Object.values(categorized).forEach(arr => arr.sort((a,b) => (a.name || '').localeCompare(b.name || '')));
            setListData(categorized);

            const listDateKey = getListDate(listMode, dateToUse);
            const { data: savedItems, error: savedItemsError } = await supabase.from('shopping_list_items').select('food_id, is_checked').eq('user_id', user.id).eq('list_type', listMode).eq('list_date', listDateKey);
            if (savedItemsError) throw savedItemsError;

            const newCheckedItems = new Set();
            (savedItems || []).forEach(item => { if (item.is_checked) newCheckedItems.add(item.food_id); });
            setCheckedItems(newCheckedItems);

        } catch (error) {
            console.error("Error fetching shopping list data:", error);
        } finally {
            setLoading(false);
        }
    }, [open, user, listMode, initialDate, fetchPrivateItems, getListDate]);

    useEffect(() => {
        fetchShoppingData();
    }, [fetchShoppingData]);

    const filteredData = useMemo(() => {
        if (!searchQuery.trim()) return { listData, privateItems };

        const normalizedQuery = normalizeText(searchQuery);

        const filterItemList = (items) => {
            return items.filter(item => {
                if (item.name && normalizeText(item.name).includes(normalizedQuery)) return true;
                
                if (item.recipeCounts) {
                    const matchesRecipe = Object.keys(item.recipeCounts).some(name => normalizeText(name).includes(normalizedQuery));
                    if (matchesRecipe) return true;
                }

                if (item.recipeName && normalizeText(item.recipeName).includes(normalizedQuery)) return true;
                if (item.recipeNames && item.recipeNames.some(r => normalizeText(r).includes(normalizedQuery))) return true;

                return false;
            });
        };

        const filteredPrivate = privateItems.filter(item => 
            item.item_name && normalizeText(item.item_name).includes(normalizedQuery)
        );

        return {
            listData: {
                proteins: filterItemList(listData.proteins),
                carbs: filterItemList(listData.carbs),
                fats: filterItemList(listData.fats),
                others: filterItemList(listData.others),
            },
            privateItems: filteredPrivate
        };

    }, [listData, privateItems, searchQuery]);

    const renderListContent = () => {
        if (loading) {
            return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-cyan-500" /></div>;
        }

        const { proteins, carbs, fats, others } = filteredData.listData;
        const currentPrivateItems = filteredData.privateItems;
        const totalItems = proteins.length + carbs.length + fats.length + others.length + currentPrivateItems.length;

        const isEmptySearch = searchQuery.trim() && totalItems === 0;

        if (isEmptySearch) {
             return (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400 h-full">
                    <p>No se encontraron resultados para "{searchQuery}"</p>
                </div>
             );
        }

        const noItemsMessage = listMode === 'planned'
            ? "No se encontraron comidas planificadas para los próximos 7 días."
            : "No se encontraron recetas en tu plan de dieta activo.";

        return totalItems > 0 ? (
            <div className="space-y-6">
                <PrivateShoppingList items={currentPrivateItems} onAdd={handleAddPrivateItem} onToggle={handleTogglePrivateItem} onRemove={handleRemovePrivateItem} loading={loadingPrivate} searchQuery={searchQuery} />
                <ShoppingListGroup title="Proteínas" icon={<ProteinIcon className="w-5 h-5" />} items={proteins} checkedItems={checkedItems} onCheckedChange={handleCheckedChange} searchQuery={searchQuery} />
                <ShoppingListGroup title="Hidratos de Carbono" icon={<CarbsIcon className="w-5 h-5" />} items={carbs} checkedItems={checkedItems} onCheckedChange={handleCheckedChange} searchQuery={searchQuery} />
                <ShoppingListGroup title="Grasas" icon={<FatsIcon className="w-5 h-5" />} items={fats} checkedItems={checkedItems} onCheckedChange={handleCheckedChange} searchQuery={searchQuery} />
                <ShoppingListGroup title="Otros" icon={null} items={others} checkedItems={checkedItems} onCheckedChange={handleCheckedChange} searchQuery={searchQuery} />
            </div>
        ) : (
            <div className="space-y-6">
                <PrivateShoppingList items={currentPrivateItems} onAdd={handleAddPrivateItem} onToggle={handleTogglePrivateItem} onRemove={handleRemovePrivateItem} loading={loadingPrivate} searchQuery={searchQuery} />
                <p className="text-center text-gray-400 py-10">{noItemsMessage}</p>
            </div>
        );
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChangeWithSync}>
            <DialogContent className="bg-[#1a1e23] border-gray-700 text-white w-[95vw] max-w-4xl p-0 flex flex-col h-[80vh] max-h-[80vh]">
                <TooltipProvider>
                    <ModalStateToggle
                        mode={listMode}
                        onModeChange={(checked) => handleModeChangeWithSync(checked ? 'planned' : 'complete')}
                        loading={loading}
                        optionOne={{ value: 'complete', label: 'Completa', icon: Layers }}
                        optionTwo={{ value: 'planned', label: 'Planificada', icon: Calendar }}
                        className="rounded-t-lg"
                        fromHeader={fromHeader}
                        onClose={() => handleOpenChangeWithSync(false)}
                    />
                </TooltipProvider>
                
                <div className="px-4 mt-4 flex-shrink-0">
                     <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input 
                            placeholder="Buscar ingrediente o receta..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 pr-9 bg-slate-800/50 border-slate-700 focus:border-cyan-500/50 focus:ring-cyan-500/20 placeholder:text-gray-500"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto styled-scrollbar-cyan px-4 pt-2 pb-6">
                    <DialogHeader className="mt-4 mb-4 flex-shrink-0">
                        <DialogTitle>Lista de la Compra</DialogTitle>
                    </DialogHeader>
                    {renderListContent()}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default GlobalShoppingListDialog;