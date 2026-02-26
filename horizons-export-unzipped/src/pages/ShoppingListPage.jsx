import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2, Calendar, Search, X, ChevronDown, ChevronUp, Lock, ArrowLeft, Plus, Trash2, ShoppingCart, RefreshCw, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from '@/components/ui/use-toast';
import ContentStateToggle from '@/components/shared/ContentStateToggle';
import ProteinIcon from '@/components/icons/ProteinIcon';
import CarbsIcon from '@/components/icons/CarbsIcon';
import FatsIcon from '@/components/icons/FatsIcon';
import { format, startOfDay, addDays } from 'date-fns';

const STORAGE_KEY = 'shoppingListModalMode';
const SHOPPING_CACHE_TTL_MS = 3 * 60 * 1000;

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

const PrivateShoppingList = ({ items, onAdd, onToggle, onRemove, loading, searchQuery, isOpen, onOpenChange }) => {
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
        <Card className="bg-slate-900/50 border-purple-500/20 overflow-hidden transition-all duration-300">
            <Collapsible open={isOpen} onOpenChange={onOpenChange}>
                <CollapsibleTrigger className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors">
                    <h3 className="text-lg font-semibold flex items-center gap-2 text-[rgb(206_165_255)]">
                        <Lock className="w-5 h-5" />
                        Lista Privada
                        <span className="text-sm font-normal text-gray-500 ml-2">({items.length})</span>
                    </h3>
                    {isOpen ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <div className="p-4 pt-0 animate-in slide-in-from-top-2 duration-200">
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
                            {!loading && sortedItems.length === 0 && <p className="text-gray-500 text-sm italic text-center">Tu lista privada está vacía.</p>}
                            {!loading && sortedItems.map((item) => (
                                <div
                                    key={item.id}
                                    className={cn(
                                        "flex items-center space-x-3 p-2 rounded-md transition-colors group",
                                        item.is_checked ? 'bg-slate-800/30 opacity-60' : 'bg-[#9d59ef]/10 hover:bg-[#9d59ef]/20'
                                    )}
                                >
                                    <Checkbox
                                        id={`private-item-${item.id}`}
                                        checked={item.is_checked}
                                        onCheckedChange={() => onToggle(item.id, !item.is_checked)}
                                        className="border-[#9d59ef]/80 data-[state=checked]:bg-[#9d59ef]/50 data-[state=checked]:border-[#9d59ef] data-[state=checked]:text-white mt-1"
                                    />
                                    <Label htmlFor={`private-item-${item.id}`} className={cn("flex-1 text-base w-full block cursor-pointer select-none", item.is_checked ? "text-gray-400 line-through" : "text-gray-200")}>
                                        <SmartHighlight text={item.item_name} highlight={searchQuery} />
                                    </Label>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-red-500/70 transition-opacity hover:text-red-400 hover:bg-red-500/10"
                                        onClick={() => onRemove(item.id)}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                </CollapsibleContent>
            </Collapsible>
        </Card>
    );
};

const ShoppingListGroup = ({ title, icon, items, checkedItems, onCheckedChange, searchQuery, isOpen, onOpenChange, colorClass = "text-cyan-400" }) => {
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

    if (items.length === 0) return null;

    return (
        <Card className="bg-slate-900/50 border-slate-700 overflow-hidden transition-all duration-300">
            <Collapsible open={isOpen} onOpenChange={onOpenChange}>
                <CollapsibleTrigger className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors">
                    <h3 className={cn("text-lg font-semibold flex items-center gap-2", colorClass)}>
                        {icon}
                        {title}
                        <span className="text-sm font-normal text-gray-500 ml-2">({items.length})</span>
                    </h3>
                    {isOpen ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <div className="p-4 pt-0 space-y-3 animate-in slide-in-from-top-2 duration-200">
                        {sortedItems.map((item, index) => {
                            const safeCheckedItems = checkedItems || new Set();
                            const isChecked = safeCheckedItems.has(item.id);
                            const itemKey = item.uniqueKey || `${item.id}-${index}`;
                            return (
                                <div
                                    key={itemKey}
                                    className={cn(
                                        "flex items-start space-x-3 p-3 rounded-lg cursor-pointer transition-all duration-200",
                                        isChecked ? 'bg-slate-800/40 opacity-50' : 'bg-slate-800/60 hover:bg-slate-800'
                                    )}
                                    onClick={() => onCheckedChange(item.id, !isChecked)}
                                >
                                    <Checkbox
                                        id={`item-${itemKey}`}
                                        checked={isChecked}
                                        className="border-gray-500 data-[state=checked]:bg-cyan-600 data-[state=checked]:border-cyan-600 data-[state=checked]:text-white mt-1"
                                    />
                                    <div className="flex-1 pointer-events-none">
                                        <Label htmlFor={`item-${itemKey}`} className={cn("text-base w-full block font-medium select-none", isChecked ? "text-gray-400 line-through" : "text-gray-200")}>
                                            <SmartHighlight text={item.name} highlight={searchQuery} />
                                            {(item.totalQuantity || item.displayQuantity) && (
                                                <span className={cn("ml-2 font-bold", isChecked ? "text-gray-500" : "text-cyan-400")}>
                                                    {Math.round(item.totalQuantity || item.displayQuantity)} {item.unit}
                                                </span>
                                            )}
                                        </Label>
                                         {item.recipeCounts && (
                                            <p className="text-xs text-gray-400 mt-1 italic pl-1 border-l-2 border-gray-700">
                                                Para: {formatRecipeList(item.recipeCounts)}
                                            </p>
                                        )}
                                        {!item.recipeCounts && item.recipeName && (
                                            <p className="text-xs text-gray-400 mt-1 italic pl-1 border-l-2 border-gray-700">
                                                Para: <SmartHighlight text={item.recipeName} highlight={searchQuery} />
                                            </p>
                                        )}
                                        {item.recipeNames && item.recipeNames.length > 0 && (
                                             <p className="text-xs text-gray-400 mt-1 italic pl-1 border-l-2 border-gray-700">
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
                </CollapsibleContent>
            </Collapsible>
        </Card>
    );
};

const ShoppingListPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { toast } = useToast();
    
    // Memoized initial date to prevent infinite re-renders if location.state creates new objects
    const initialDate = useMemo(() => {
        return location.state?.initialDate ? new Date(location.state.initialDate) : new Date();
    }, [location.state?.initialDate]);

    // Initial state from navigation or defaults with lazy initialization
    const [listMode, setListMode] = useState(() => 
        location.state?.initialMode || localStorage.getItem(STORAGE_KEY) || 'planned'
    );

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [listData, setListData] = useState({ proteins: [], carbs: [], fats: [], others: [] });
    const [checkedItems, setCheckedItems] = useState(new Set());
    const [hasChanges, setHasChanges] = useState(false);
    const [privateItems, setPrivateItems] = useState([]);
    const [loadingPrivate, setLoadingPrivate] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const shoppingDataCacheRef = useRef(new Map());
    const foodsCacheRef = useRef({ userId: null, foodsMap: null });
    
    // Collapsible states
    const [openSections, setOpenSections] = useState({
        private: true,
        proteins: true,
        carbs: true,
        fats: true,
        others: true
    });

    // Refs to track state for search functionality
    const previousOpenSectionsRef = useRef(openSections);
    const isSearchingRef = useRef(false);

    const toggleSection = (section) => {
        setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    // Refs to track state for cleanup/sync without triggering effects
    const listDataRef = useRef(listData);
    const checkedItemsRef = useRef(checkedItems);
    const listModeRef = useRef(listMode);
    const initialDateRef = useRef(initialDate);

    // Keep refs in sync
    useEffect(() => { listDataRef.current = listData; }, [listData]);
    useEffect(() => { checkedItemsRef.current = checkedItems; }, [checkedItems]);
    useEffect(() => { listModeRef.current = listMode; }, [listMode]);
    useEffect(() => { initialDateRef.current = initialDate; }, [initialDate]);

    const getListDate = useCallback((mode, date) => {
        const dateToUse = date || new Date();
        return format(dateToUse, 'yyyy-MM-dd');
    }, []);

    const getCacheKey = useCallback((mode, date) => {
        return `${mode}:${getListDate(mode, date)}`;
    }, [getListDate]);

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
            try {
                const { error } = await supabase.from('shopping_list_items').upsert(upsertData, {
                    onConflict: 'user_id,food_id,list_date,list_type',
                });
                if (error) console.error('Error syncing shopping list:', error);
            } catch (e) {
                console.error("Sync Exception:", e);
            }
        }
        setHasChanges(false);
    }, [user, hasChanges, getListDate]);

    // Sync on unmount
    useEffect(() => {
        return () => {
            syncShoppingList();
        };
    }, [syncShoppingList]);

    const handleModeChangeWithSync = useCallback((newMode) => {
        syncShoppingList().then(() => {
            setListMode(newMode);
            setSearchQuery('');
            try {
                localStorage.setItem(STORAGE_KEY, newMode);
            } catch (error) {
                console.error('Error saving to localStorage:', error);
            }
        });
    }, [syncShoppingList]);

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
        if (!user) return;
        setLoadingPrivate(true);
        try {
            const { data, error } = await supabase
                .from('private_shopping_list_items')
                .select('*')
                .eq('user_id', user.id);

            if (error) throw error;
            setPrivateItems(data || []);
        } catch (err) {
            console.error("Error fetching private items:", err);
            // Non-critical, don't block main UI
        } finally {
            setLoadingPrivate(false);
        }
    }, [user]);

    const handleAddPrivateItem = async (itemName) => {
        try {
            const newItem = {
                user_id: user.id,
                item_name: itemName,
                is_checked: false,
            };
            const { data, error } = await supabase.from('private_shopping_list_items').insert(newItem).select().single();
            if (error) throw error;
            setPrivateItems(prev => [...prev, data]);
        } catch (err) {
            console.error("Error adding private item:", err);
            toast({ title: "Error", description: "No se pudo añadir el artículo privado.", variant: "destructive" });
        }
    };

    const handleTogglePrivateItem = async (id, is_checked) => {
        // Optimistic update
        setPrivateItems(prev => prev.map(item => item.id === id ? { ...item, is_checked } : item));
        try {
            const { error } = await supabase.from('private_shopping_list_items').update({ is_checked }).eq('id', id);
            if (error) throw error;
        } catch (err) {
            console.error("Error toggling private item:", err);
            // Revert on error
            setPrivateItems(prev => prev.map(item => item.id === id ? { ...item, is_checked: !is_checked } : item));
            toast({ title: "Error", description: "No se pudo actualizar el estado del artículo.", variant: "destructive" });
        }
    };

    const handleRemovePrivateItem = async (id) => {
        const originalItems = [...privateItems];
        setPrivateItems(prev => prev.filter(item => item.id !== id));
        try {
            const { error } = await supabase.from('private_shopping_list_items').delete().eq('id', id);
            if (error) throw error;
        } catch (err) {
            console.error("Error removing private item:", err);
            setPrivateItems(originalItems);
            toast({ title: "Error", description: "No se pudo eliminar el artículo.", variant: "destructive" });
        }
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

    const fetchShoppingData = useCallback(async ({ force = false, silent = false } = {}) => {
        if (!user) return;

        const dateToUse = initialDate || new Date();
        const cacheKey = getCacheKey(listMode, dateToUse);
        const cached = shoppingDataCacheRef.current.get(cacheKey);
        const isCacheFresh = cached && (Date.now() - cached.fetchedAt < SHOPPING_CACHE_TTL_MS);

        if (!force && isCacheFresh) {
            setListData(cached.listData);
            setCheckedItems(new Set(cached.checkedItems));
            setError(null);
            setLoading(false);
            return;
        }

        if (!silent) {
            setLoading(true);
            setError(null);
        }
        setHasChanges(false);

        try {
            const startDate = format(startOfDay(dateToUse), 'yyyy-MM-dd');

            // 1. Fetch Foods
            let allFoodsMap = foodsCacheRef.current.foodsMap;
            const isFoodsCacheValid = foodsCacheRef.current.userId === user.id && allFoodsMap;

            if (!isFoodsCacheValid) {
                const { data: foods, error: foodsError } = await supabase.from('food')
                    .select('*, food_to_food_groups(food_groups(macro_role))');
                if (foodsError) throw new Error(`Error loading foods: ${foodsError.message}`);

                const { data: userFoods, error: userFoodsError } = await supabase.from('user_created_foods')
                    .select('*, user_created_food_to_food_groups(food_groups(macro_role))')
                    .eq('user_id', user.id);
                if (userFoodsError) throw new Error(`Error loading user foods: ${userFoodsError.message}`);

                allFoodsMap = new Map();
                (foods || []).forEach(f => allFoodsMap.set(`std_${f.id}`, { ...f, is_user_created: false }));
                (userFoods || []).forEach(f => allFoodsMap.set(`uc_${f.id}`, { ...f, is_user_created: true }));

                foodsCacheRef.current = { userId: user.id, foodsMap: allFoodsMap };
            }
            let allMealsToProcess = [];

            // 2. Fetch Meals based on mode
            if (listMode === 'complete') {
                const { data: activePlan, error: planError } = await supabase
                    .from('diet_plans').select('id').eq('user_id', user.id).eq('is_active', true).maybeSingle();
                
                if (planError) throw new Error(`Error checking active plan: ${planError.message}`);

                if (activePlan) {
                    const [planRecipes, privateRecipes] = await Promise.all([
                        supabase.from('diet_plan_recipes')
                            .select('id, custom_name, is_customized, custom_ingredients:diet_plan_recipe_ingredients(food_id, grams), recipe:recipes(name, recipe_ingredients(food_id, grams))')
                            .eq('diet_plan_id', activePlan.id),
                        supabase.from('private_recipes')
                            .select('id, name, private_recipe_ingredients(food_id, grams)')
                            .eq('diet_plan_id', activePlan.id)
                    ]);

                    if (planRecipes.error) throw new Error(`Error loading plan recipes: ${planRecipes.error.message}`);
                    if (privateRecipes.error) throw new Error(`Error loading private recipes: ${privateRecipes.error.message}`);

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
                
                if (plannedError) throw new Error(`Error loading planned meals: ${plannedError.message}`);

                if (plannedLogs && plannedLogs.length > 0) {
                    const dietIds = [...new Set(plannedLogs.map(p => p.diet_plan_recipe_id).filter(Boolean))];
                    const privateIds = [...new Set(plannedLogs.map(p => p.private_recipe_id).filter(Boolean))];
                    const freeIds = [...new Set(plannedLogs.map(p => p.free_recipe_id).filter(Boolean))];

                    const [dietRecipes, privateRecipes, freeRecipes] = await Promise.all([
                        dietIds.length ? supabase.from('diet_plan_recipes').select('id, custom_name, is_customized, custom_ingredients:diet_plan_recipe_ingredients(food_id, grams), recipe:recipes(name, recipe_ingredients(food_id, grams))').in('id', dietIds) : { data: [] },
                        privateIds.length ? supabase.from('private_recipes').select('id, name, private_recipe_ingredients(food_id, grams)').in('id', privateIds) : { data: [] },
                        freeIds.length ? supabase.from('free_recipes').select('id, name, free_recipe_ingredients(food_id, is_user_created, grams)').in('id', freeIds) : { data: [] }
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

            // 3. Process Data
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
                    if (!foodKey && ing.food_id && ing.is_user_created) {
                        foodKey = `uc_${ing.food_id}`;
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

            // 4. Load Saved State
            const listDateKey = getListDate(listMode, dateToUse);
            const { data: savedItems, error: savedItemsError } = await supabase.from('shopping_list_items').select('food_id, is_checked').eq('user_id', user.id).eq('list_type', listMode).eq('list_date', listDateKey);
            if (savedItemsError) throw new Error(`Error loading saved state: ${savedItemsError.message}`);

            const newCheckedItems = new Set();
            (savedItems || []).forEach(item => { if (item.is_checked) newCheckedItems.add(item.food_id); });
            setCheckedItems(newCheckedItems);
            shoppingDataCacheRef.current.set(cacheKey, {
                listData: categorized,
                checkedItems: Array.from(newCheckedItems),
                fetchedAt: Date.now(),
            });

        } catch (error) {
            console.error("Critical error in shopping list:", error);
            setError(error.message);
            toast({ 
                title: "Error de carga", 
                description: "Hubo un problema al cargar tu lista. Inténtalo de nuevo.", 
                variant: "destructive" 
            });
        } finally {
            if (!silent) {
                setLoading(false);
            }
        }
    }, [user, listMode, initialDate, getCacheKey, getListDate, toast]);

    useEffect(() => {
        fetchPrivateItems();
    }, [fetchPrivateItems]);

    useEffect(() => {
        fetchShoppingData();
    }, [fetchShoppingData]);
    useEffect(() => {
        if (loading || error) return;
        const cacheKey = getCacheKey(listMode, initialDate || new Date());
        shoppingDataCacheRef.current.set(cacheKey, {
            listData,
            checkedItems: Array.from(checkedItems),
            fetchedAt: Date.now(),
        });
    }, [checkedItems, error, getCacheKey, initialDate, listData, listMode, loading]);

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

    // Handle search auto-expand logic
    useEffect(() => {
        const hasSearch = searchQuery.trim().length > 0;
        
        if (hasSearch) {
            // If starting a new search, save current collapsed state
            if (!isSearchingRef.current) {
                previousOpenSectionsRef.current = { ...openSections };
                isSearchingRef.current = true;
            }

            // Expand sections that have matches
            setOpenSections(prev => {
                const newState = { ...prev };
                if (filteredData.privateItems.length > 0) newState.private = true;
                if (filteredData.listData.proteins.length > 0) newState.proteins = true;
                if (filteredData.listData.carbs.length > 0) newState.carbs = true;
                if (filteredData.listData.fats.length > 0) newState.fats = true;
                if (filteredData.listData.others.length > 0) newState.others = true;
                return newState;
            });
        } else {
            // If clearing search, restore previous state
            if (isSearchingRef.current) {
                setOpenSections(previousOpenSectionsRef.current);
                isSearchingRef.current = false;
            }
        }
    }, [filteredData, searchQuery]); // Dependencies on filteredData to update as results change

    const handleBack = () => {
        // Navigate back to the previous page or default to dashboard
        if (location.key !== "default") {
            navigate(-1);
        } else {
            navigate('/dashboard');
        }
    };

    const retryFetch = () => {
        setLoading(true);
        setError(null);
        fetchShoppingData({ force: true });
    };

    return (
        <div className="container mx-auto px-4 pt-6 sm:py-6 max-w-4xl min-h-screen">
            <div className="flex flex-col space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={handleBack} className="hover:bg-slate-800 text-gray-400 hover:text-white">
                        <ArrowLeft className="w-6 h-6" />
                    </Button>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                        <ShoppingCart className="w-8 h-8 text-cyan-400" />
                        Lista de la Compra
                    </h1>
                </div>

                {/* Controls */}
                <div className="bg-slate-900/50 p-2 rounded-xl border border-slate-700/50 shadow-xl space-y-4">
                    <ContentStateToggle
                        mode={listMode}
                        onModeChange={handleModeChangeWithSync}
                        loading={loading}
                        optionOne={{ value: 'complete', label: 'Lista', icon: ShoppingCart }}
                        optionTwo={{ value: 'planned', label: 'Comidas Planificadas', icon: Calendar }}
                        isSegmented={true}
                        className="w-full"
                    />
                    
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input 
                            placeholder="Buscar ingrediente o receta..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 pr-9 bg-slate-800 border-slate-700 focus:border-cyan-500/50 focus:ring-cyan-500/20 placeholder:text-gray-500 text-white"
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

                {/* Error State */}
                {error && (
                    <Alert variant="destructive" className="bg-red-900/20 border-red-900/50">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Error al cargar</AlertTitle>
                        <AlertDescription className="flex flex-col gap-2">
                            <p>{error}</p>
                            <Button onClick={retryFetch} variant="outline" size="sm" className="w-fit gap-2 border-red-500 text-red-500 hover:bg-red-500/10">
                                <RefreshCw className="h-4 w-4" /> Reintentar
                            </Button>
                        </AlertDescription>
                    </Alert>
                )}

                {/* Content */}
                {loading ? (
                    <div className="flex flex-col justify-center items-center py-20 space-y-4">
                        <Loader2 className="h-12 w-12 animate-spin text-cyan-500" />
                        <p className="text-gray-400 animate-pulse">Cargando tu lista...</p>
                    </div>
                ) : !error && (
                    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
                        <PrivateShoppingList 
                            items={filteredData.privateItems} 
                            onAdd={handleAddPrivateItem} 
                            onToggle={handleTogglePrivateItem} 
                            onRemove={handleRemovePrivateItem} 
                            loading={loadingPrivate} 
                            searchQuery={searchQuery}
                            isOpen={openSections.private}
                            onOpenChange={() => toggleSection('private')}
                        />
                        
                        <ShoppingListGroup 
                            title="Proteínas" 
                            icon={<ProteinIcon className="w-5 h-5 text-current" />} 
                            items={filteredData.listData.proteins} 
                            checkedItems={checkedItems} 
                            onCheckedChange={handleCheckedChange} 
                            searchQuery={searchQuery}
                            isOpen={openSections.proteins}
                            onOpenChange={() => toggleSection('proteins')}
                            colorClass="text-red-400"
                        />
                        
                        <ShoppingListGroup 
                            title="Hidratos de Carbono" 
                            icon={<CarbsIcon className="w-5 h-5 text-current" />} 
                            items={filteredData.listData.carbs} 
                            checkedItems={checkedItems} 
                            onCheckedChange={handleCheckedChange} 
                            searchQuery={searchQuery}
                            isOpen={openSections.carbs}
                            onOpenChange={() => toggleSection('carbs')}
                            colorClass="text-yellow-400"
                        />
                        
                        <ShoppingListGroup 
                            title="Grasas" 
                            icon={<FatsIcon className="w-5 h-5 text-current" />} 
                            items={filteredData.listData.fats} 
                            checkedItems={checkedItems} 
                            onCheckedChange={handleCheckedChange} 
                            searchQuery={searchQuery}
                            isOpen={openSections.fats}
                            onOpenChange={() => toggleSection('fats')}
                            colorClass="text-green-400"
                        />
                        
                        <ShoppingListGroup 
                            title="Otros" 
                            icon={<ShoppingCart className="w-5 h-5 text-current" />} 
                            items={filteredData.listData.others} 
                            checkedItems={checkedItems} 
                            onCheckedChange={handleCheckedChange} 
                            searchQuery={searchQuery}
                            isOpen={openSections.others}
                            onOpenChange={() => toggleSection('others')}
                            colorClass="text-gray-300"
                        />

                        {(!filteredData.privateItems.length && 
                          !filteredData.listData.proteins.length && 
                          !filteredData.listData.carbs.length && 
                          !filteredData.listData.fats.length && 
                          !filteredData.listData.others.length) && (
                            <div className="text-center py-12 bg-slate-900/30 rounded-xl border border-dashed border-slate-700">
                                <ShoppingCart className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                                <p className="text-gray-400 text-lg">No se encontraron artículos.</p>
                                <p className="text-gray-500 text-sm mt-1">Prueba a cambiar el modo de vista o añadir artículos privados.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ShoppingListPage;
