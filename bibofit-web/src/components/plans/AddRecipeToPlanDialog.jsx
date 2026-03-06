import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import RecipeCard from '@/components/admin/recipes/RecipeCard';
import { ChevronDown, ChevronUp, Loader2, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import RecipeEditorModal from '@/components/shared/RecipeEditorModal/RecipeEditorModal';
import { useAuth } from '@/contexts/AuthContext';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from '@/lib/utils';
import { normalizeText } from '@/lib/textSearch';
import {
    filterRecipesByQuery,
    RECIPE_SEARCH_MATCH_TYPE_LABELS,
    RECIPE_SEARCH_MATCH_TYPE_ORDER,
} from '@/lib/recipeSearch';
import { analyzeRecipeConflicts } from '@/lib/recipeConflictAnalyzer';
import {
    getRecipeIngredients,
    getRecipeParentId,
    inferRecipeEntityType,
    RECIPE_ENTITY_TYPES,
} from '@/lib/recipeEntity';

const RecipeGroup = ({ group, searchTerm, ...props }) => {
    const [isOpen, setIsOpen] = useState(false);
    const { root, variants } = group;

    // Auto-open if searching and one of the variants matches (but not necessarily the root)
    useEffect(() => {
        if (searchTerm && variants.length > 0) {
            setIsOpen(true);
        } else {
            setIsOpen(false);
        }
    }, [searchTerm, variants.length]);

    return (
        <div className="flex flex-col h-full">
            {root && (
                <RecipeCard
                    recipe={root}
                    highlight={searchTerm}
                    {...props}
                    conflicts={root.conflicts}
                    recommendations={root.recommendations}
                />
            )}
            
            {variants.length > 0 && (
                <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
                    <CollapsibleTrigger asChild>
                        <button 
                            className={cn(
                                "flex items-center justify-center w-full py-2 text-xs font-medium rounded-md transition-all duration-300 ease-in-out border border-border mt-1 gap-2",
                                isOpen 
                                    ? "bg-gradient-to-b from-slate-800/50 to-slate-900/50 text-muted-foreground border-border shadow-inner" 
                                    : "bg-slate-700 text-white hover:bg-slate-600 shadow-sm"
                            )}
                        >
                            {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            {isOpen ? 'Ocultar variantes' : `Ver ${variants.length} variantes`}
                        </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-4 pt-4 pl-4 border-l-2 border-border mt-2 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
                        {variants.map(variant => (
                             <RecipeCard
                                key={variant.id}
                                recipe={variant}
                                highlight={searchTerm}
                                {...props}
                                conflicts={variant.conflicts}
                                recommendations={variant.recommendations}
                                // Variant specific props if needed
                                themeColor={props.themeColor || "sky"} 
                            />
                        ))}
                    </CollapsibleContent>
                </Collapsible>
            )}
            
            {!root && variants.length > 0 && (
                 // Fallback for orphan variants (should rarely happen with global recipes)
                 <div className="space-y-4">
                    {variants.map(variant => (
                         <RecipeCard
                            key={variant.id}
                            recipe={variant}
                            highlight={searchTerm}
                            {...props}
                            conflicts={variant.conflicts}
                            recommendations={variant.recommendations}
                        />
                    ))}
                 </div>
            )}
        </div>
    );
};

const AddRecipeToPlanDialog = ({ open, onOpenChange, dietPlanId, isTemplate = false, onRecipeSelected, userId, preselectedMeal, dayOfWeek, onEditConflict, mode = 'all', planRestrictions: propPlanRestrictions, mealDate, isConstructor = false }) => {
    const { toast } = useToast();
    const { user } = useAuth();
    const [allRecipes, setAllRecipes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [planRecipes, setPlanRecipes] = useState([]);
    const [allFoods, setAllFoods] = useState([]);
    const [recipeStyles, setRecipeStyles] = useState([]);
    const [planRestrictions, setPlanRestrictions] = useState(null);
    const [allSensitivities, setAllSensitivities] = useState([]);
    const [allConditions, setAllConditions] = useState([]);
    const [recipeToView, setRecipeToView] = useState(null);
    const [isRecipeViewOpen, setIsRecipeViewOpen] = useState(false);

    const isAdminView = user?.id !== userId;
    const currentMealId = useMemo(
        () => preselectedMeal?.day_meal?.id || preselectedMeal?.day_meal_id || preselectedMeal?.id || null,
        [preselectedMeal]
    );
    const normalizeIds = useCallback((items = []) => {
        if (!Array.isArray(items)) return [];
        return items
            .map(item => (typeof item === 'object' ? item?.id : item))
            .filter(id => id !== undefined && id !== null);
    }, []);

    const fetchPlanRestrictions = useCallback(async () => {
        if (isTemplate) {
            const { data: sensitivities, error: sensError } = await supabase.from('sensitivities').select('id, name');
            if(sensError) console.error(sensError);
            else setAllSensitivities(sensitivities || []);

            const { data: conditions, error: condError } = await supabase.from('medical_conditions').select('id, name');
            if(condError) console.error(condError);
            else setAllConditions(conditions || []);

            const templateSensitivityIds = normalizeIds(propPlanRestrictions?.sensitivities || []);
            const templateConditionIds = normalizeIds(
                propPlanRestrictions?.conditions || propPlanRestrictions?.medical_conditions || []
            );

            setPlanRestrictions({
                sensitivities: new Set(templateSensitivityIds),
                conditions: new Set(templateConditionIds)
            });
            return;
        }

        if (!userId) {
            setPlanRestrictions(null);
            return;
        }

        try {
            const [sensitivitiesRes, conditionsRes] = await Promise.all([
                supabase.from('user_sensitivities').select('sensitivity_id').eq('user_id', userId),
                supabase.from('user_medical_conditions').select('condition_id').eq('user_id', userId)
            ]);
            
            if (sensitivitiesRes.error) throw sensitivitiesRes.error;
            if (conditionsRes.error) throw conditionsRes.error;
            
            const [allSensitivitiesRes, allConditionsRes] = await Promise.all([
                supabase.from('sensitivities').select('id, name'),
                supabase.from('medical_conditions').select('id, name')
            ]);
            
            setAllSensitivities(allSensitivitiesRes.data || []);
            setAllConditions(allConditionsRes.data || []);

            setPlanRestrictions({
                sensitivities: new Set(sensitivitiesRes.data.map(s => s.sensitivity_id)),
                conditions: new Set(conditionsRes.data.map(c => c.condition_id))
            });
        } catch (error) {
            toast({ title: "Error", description: "No se pudieron cargar las restricciones del cliente.", variant: "destructive" });
            setPlanRestrictions({ sensitivities: new Set(), conditions: new Set() });
        }
    }, [userId, isTemplate, toast, propPlanRestrictions, normalizeIds]);
    
    const fetchInitialData = useCallback(async () => {
        if (!planRestrictions) return;
        setLoading(true);

        try {
            let recipesQuery, privateRecipesQuery;

            if (mode === 'plan_only') {
                 recipesQuery = supabase
                    .from('diet_plan_recipes')
                    .select(`
                        *, 
                        recipe:recipe_id(*, recipe_style:recipe_style_id(id, name), recipe_ingredients(*, food(*, food_to_food_groups(food_group:food_groups(*)), food_sensitivities(*, sensitivities(id,name)), food_medical_conditions(*, medical_conditions(id, name)))), recipe_sensitivities(*, sensitivities(id, name)), recipe_medical_conditions(*, medical_conditions(id, name)), recipe_macros(*)),
                        custom_ingredients:recipe_ingredients(*, food(*, food_to_food_groups(food_group:food_groups(*)), food_sensitivities(*, sensitivities(id,name)), food_medical_conditions(*, medical_conditions(id, name))))
                    `)
                    .eq('diet_plan_id', dietPlanId)
                    .eq('day_meal_id', currentMealId)
                    .eq('is_archived', false);
                
                privateRecipesQuery = supabase
                    .from('user_recipes')
                    .select('*, recipe_style:recipe_style_id(id, name), recipe_ingredients(*, food(*, food_to_food_groups(food_group:food_groups(*)), food_sensitivities(*, sensitivities(id,name)), food_medical_conditions(*, medical_conditions(id, name))))')
                    .in('type', ['private', 'variant'])
                    .eq('diet_plan_id', dietPlanId)
                    .eq('day_meal_id', currentMealId)
                    .eq('is_archived', false);

            } else {
                 recipesQuery = supabase.from('recipes')
                    .select('*, recipe_style:recipe_style_id(id, name), recipe_ingredients(*, food(*, food_to_food_groups(food_group:food_groups(*)), food_sensitivities(*, sensitivities(id,name)), food_medical_conditions(*, medical_conditions(id, name)))), recipe_sensitivities(*, sensitivities(id, name)), recipe_medical_conditions(*, medical_conditions(id, name)), recipe_macros(*)');

                 privateRecipesQuery = (!isTemplate && userId)
                    ? supabase.from('user_recipes')
                        .select('*, recipe_style:recipe_style_id(id, name), recipe_ingredients(*, food(*, food_to_food_groups(food_group:food_groups(*)), food_sensitivities(*, sensitivities(id,name)), food_medical_conditions(*, medical_conditions(id, name))))')
                        .eq('user_id', userId)
                        .in('type', ['private', 'variant'])
                        .eq('is_archived', false)
                    : Promise.resolve({ data: [], error: null });
            }

            const [recipesRes, privateRecipesRes, existingPlanRecipesRes, foodsRes, recipeStylesRes] = await Promise.all([
                recipesQuery,
                privateRecipesQuery,
                supabase.from('diet_plan_recipes').select('recipe_id, day_meal_id').eq('diet_plan_id', dietPlanId).eq('is_archived', false),
                supabase.from('food').select('*, food_to_food_groups(food_group:food_groups(*)), food_sensitivities(*, sensitivities(id,name)), food_medical_conditions(*, medical_conditions(id, name))'),
                supabase.from('recipe_styles').select('id, name').order('display_order').order('name'),
            ]);
            
            if (recipesRes.error) throw recipesRes.error;
            if (privateRecipesRes.error) throw privateRecipesRes.error;
            if (existingPlanRecipesRes.error) throw existingPlanRecipesRes.error;
            if (foodsRes.error) throw foodsRes.error;
            if (recipeStylesRes.error) throw recipeStylesRes.error;

            setAllFoods(foodsRes.data || []);
            setRecipeStyles(recipeStylesRes.data || []);
            setPlanRecipes(existingPlanRecipesRes.data || []);

            const processRecipe = (recipe, isPrivate = false, isFromPlan = false) => {
                const baseRecipe = isFromPlan && !isPrivate ? recipe.recipe : recipe;
                if (!baseRecipe) return null;

                const ingredientSource = isFromPlan && !isPrivate ? recipe : baseRecipe;
                const ingredients = getRecipeIngredients(ingredientSource);

                const analysisRestrictions = {
                    sensitivities: allSensitivities.filter(s => planRestrictions.sensitivities.has(s.id)),
                    medical_conditions: allConditions.filter(c => planRestrictions.conditions.has(c.id)),
                    individual_food_restrictions: [],
                    preferred_foods: [],
                    non_preferred_foods: []
                };

                const { conflicts, recommendations } = analyzeRecipeConflicts({
                    recipe: {
                        ...baseRecipe,
                        is_private: isPrivate,
                        recipe_ingredients: ingredients
                    },
                    allFoods: foodsRes.data || [],
                    userRestrictions: analysisRestrictions
                });
                
                let recipeName = baseRecipe.name;
                if (isFromPlan && !isPrivate && recipe.is_customized && recipe.custom_name) {
                    recipeName = recipe.custom_name;
                }
                const recipeDifficulty = (isFromPlan && !isPrivate && recipe.is_customized && recipe.custom_difficulty)
                    ? recipe.custom_difficulty
                    : baseRecipe.difficulty;

                const processed = { ...recipe, conflicts, recommendations, is_private: isPrivate, name: recipeName, difficulty: recipeDifficulty };
                
                // Assign ingredients for display
                if (isFromPlan) {
                    processed.recipe_ingredients = ingredients;
                } else if (isPrivate) {
                     processed.recipe_ingredients = ingredients;
                } else {
                    processed.recipe_ingredients = ingredients;
                }

                return processed;
            };
            
            let finalRecipes = [];
            if (mode === 'plan_only') {
                const processedPlanRecipes = (recipesRes.data || []).map(r => processRecipe(r, false, true)).filter(Boolean);
                const processedPrivateRecipes = (privateRecipesRes.data || []).map(r => processRecipe(r, true, true)).filter(Boolean);
                finalRecipes = [...processedPlanRecipes, ...processedPrivateRecipes];
            } else {
                const processedGeneralRecipes = (recipesRes.data || []).map(r => processRecipe(r, false, false)).filter(Boolean);
                const processedPrivateRecipes = (privateRecipesRes.data || []).map(r => processRecipe(r, true, false)).filter(Boolean);
                finalRecipes = [...processedPrivateRecipes, ...processedGeneralRecipes];
            }
            
            setAllRecipes(finalRecipes);

        } catch (error) {
            toast({ title: "Error", description: `No se pudieron cargar los datos: ${error.message}`, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [dietPlanId, userId, toast, planRestrictions, isTemplate, mode, currentMealId, allSensitivities, allConditions]);

    useEffect(() => {
        if (open) {
            fetchPlanRestrictions();
        }
    }, [open, fetchPlanRestrictions]);
    
    useEffect(() => {
        if(open && planRestrictions && (userId || isTemplate)){
            fetchInitialData();
        }
    }, [open, planRestrictions, userId, isTemplate, fetchInitialData]);

    const handleAddRecipe = (recipe) => {
        if (onRecipeSelected) {
            onRecipeSelected(recipe);
        }
    };

    const handleCardClick = (recipe) => {
        // Inject dietPlanId and dayMealId to allow saving context in RecipeEditorModal
        // Also inject 'type' if missing to help editor identify it as global recipe
        setRecipeToView({
            ...recipe,
            diet_plan_id: dietPlanId,
            day_meal_id: currentMealId,
            type: recipe.is_private
                ? RECIPE_ENTITY_TYPES.PRIVATE
                : inferRecipeEntityType(recipe)
        });
        setIsRecipeViewOpen(true);
    };

    const handleSaveSuccess = (savedRecipe, action) => {
        // When recipe is saved from editor (variant created), we can automatically select it
        if (onRecipeSelected) {
            onRecipeSelected(savedRecipe);
        }
        setIsRecipeViewOpen(false);
    }

    const fullUserRestrictions = useMemo(() => {
        if (propPlanRestrictions?.sensitivities || propPlanRestrictions?.medical_conditions || propPlanRestrictions?.preferred_foods || propPlanRestrictions?.non_preferred_foods) {
            return propPlanRestrictions;
        }
        if (!planRestrictions) return {};
        return {
            sensitivities: allSensitivities.filter(s => planRestrictions.sensitivities.has(s.id)),
            medical_conditions: allConditions.filter(c => planRestrictions.conditions.has(c.id)),
            individual_food_restrictions: [],
            preferred_foods: [],
            non_preferred_foods: []
        };
    }, [propPlanRestrictions, planRestrictions, allSensitivities, allConditions]);

    // Grouping and Filtering Logic
    const groupedRecipeData = useMemo(() => {
        const getPriority = (recipe) => {
            if (recipe.is_private) return 0; // Highest priority
            if (recipe.conflicts.conditions.length > 0) return 4;
            if (recipe.conflicts.sensitivities.length > 0) return 3;
            if (recipe.recommendations.conditions.length > 0) return 1;
            return 2; // No conflicts, no recommendations
        };
        const hasSearch = normalizeText(searchTerm).trim().length > 0;

        let recipesInCurrentMeal = new Set();
        if (mode !== 'plan_only') {
           recipesInCurrentMeal = new Set(
                planRecipes
                    .filter(pr => pr.day_meal_id === currentMealId)
                    .map(pr => pr.recipe_id)
            );
        }

        // 1. Organize into groups first
        const groups = new Map(); // id -> { root: Recipe, variants: [] }
        const allItems = [];

        // Pre-sort all recipes by priority/name to ensure stable initial order
        const sortedAllRecipes = [...allRecipes].sort((a, b) => {
             const priorityA = getPriority(a);
             const priorityB = getPriority(b);
             if (priorityA !== priorityB) return priorityA - priorityB;
             return a.name.localeCompare(b.name);
        });

        // Initialize groups
        sortedAllRecipes.forEach(r => {
             // Exclude if already in meal (for planner mode)
             const isInMeal = r.is_private ? false : recipesInCurrentMeal.has(r.id);
             if (isInMeal) return;

             const parentId = getRecipeParentId(r);
             if (!parentId) {
                 if (!groups.has(r.id)) {
                     const group = { root: r, variants: [] };
                     groups.set(r.id, group);
                     allItems.push(group);
                 } else {
                     // Should generally not happen if IDs unique, but safe update
                     groups.get(r.id).root = r;
                 }
             }
        });

        // Attach variants
        sortedAllRecipes.forEach(r => {
             const isInMeal = r.is_private ? false : recipesInCurrentMeal.has(r.id);
             if (isInMeal) return;

             const parentId = getRecipeParentId(r);
             if (parentId) {
                if (groups.has(parentId)) {
                    groups.get(parentId).variants.push(r);
                } else {
                    // Parent missing in fetched set? treat as independent group for now
                    const group = { root: null, variants: [r] };
                    // We push to allItems only if not already pushed (orphan case)
                    allItems.push(group);
                }
             }
        });

        if (!hasSearch) {
            return { groups: allItems, matchTypes: [], hasFuzzyMatch: false };
        }

        const matchedTypes = new Set();
        let hasFuzzyMatch = false;

        const matchedGroups = allItems
            .map((group) => {
                const rootSearch = group.root
                    ? filterRecipesByQuery({
                        items: [group.root],
                        query: searchTerm,
                        recipeStyles,
                        allFoods,
                        allowFuzzy: true,
                    })
                    : { items: [], matchTypes: [], hasFuzzyMatch: false };

                const variantsSearch = group.variants.length > 0
                    ? filterRecipesByQuery({
                        items: group.variants,
                        query: searchTerm,
                        recipeStyles,
                        allFoods,
                        allowFuzzy: true,
                    })
                    : { items: [], matchTypes: [], hasFuzzyMatch: false };

                const rootMatched = !!group.root && rootSearch.items.length > 0;
                const matchedVariants = variantsSearch.items || [];
                const hasMatch = rootMatched || matchedVariants.length > 0;
                if (!hasMatch) return null;

                rootSearch.matchTypes.forEach((type) => matchedTypes.add(type));
                variantsSearch.matchTypes.forEach((type) => matchedTypes.add(type));
                if (rootSearch.hasFuzzyMatch || variantsSearch.hasFuzzyMatch) hasFuzzyMatch = true;

                const combinedMatchTypes = RECIPE_SEARCH_MATCH_TYPE_ORDER.filter(
                    (type) => rootSearch.matchTypes.includes(type) || variantsSearch.matchTypes.includes(type)
                );
                const firstMatchType = combinedMatchTypes[0] || null;
                const matchTypeRank = firstMatchType
                    ? RECIPE_SEARCH_MATCH_TYPE_ORDER.indexOf(firstMatchType)
                    : 999;

                const representative = group.root || matchedVariants[0] || group.variants[0] || null;
                const priorityRank = representative ? getPriority(representative) : 999;

                return {
                    ...group,
                    variants: rootMatched ? group.variants : matchedVariants,
                    _searchMeta: {
                        rootMatched,
                        matchTypeRank,
                        fuzzy: rootSearch.hasFuzzyMatch || variantsSearch.hasFuzzyMatch,
                        priorityRank,
                        name: representative?.name || '',
                    },
                };
            })
            .filter(Boolean)
            .sort((a, b) => {
                if (a._searchMeta.rootMatched !== b._searchMeta.rootMatched) {
                    return a._searchMeta.rootMatched ? -1 : 1;
                }
                if (a._searchMeta.matchTypeRank !== b._searchMeta.matchTypeRank) {
                    return a._searchMeta.matchTypeRank - b._searchMeta.matchTypeRank;
                }
                if (a._searchMeta.fuzzy !== b._searchMeta.fuzzy) {
                    return a._searchMeta.fuzzy ? 1 : -1;
                }
                if (a._searchMeta.priorityRank !== b._searchMeta.priorityRank) {
                    return a._searchMeta.priorityRank - b._searchMeta.priorityRank;
                }
                return a._searchMeta.name.localeCompare(b._searchMeta.name, 'es', { sensitivity: 'base' });
            })
            .map(({ _searchMeta, ...group }) => group);

        return {
            groups: matchedGroups,
            matchTypes: RECIPE_SEARCH_MATCH_TYPE_ORDER.filter((type) => matchedTypes.has(type)),
            hasFuzzyMatch,
        };

    }, [allRecipes, allFoods, planRecipes, recipeStyles, searchTerm, currentMealId, mode]);

    const capitalize = (s) => {
        if (typeof s !== 'string') return ''
        return s.charAt(0).toUpperCase() + s.slice(1)
    }

    const dialogTitle = useMemo(() => {
        if (isConstructor) {
            return `Añadir Receta a ${preselectedMeal?.name || 'Comida'}`;
        }
        if (!preselectedMeal || !mealDate) {
            return "Planificar Receta";
        }
        const mealName = preselectedMeal?.day_meal?.name || preselectedMeal?.name || "comida";
        const dateString = capitalize(format(mealDate, "eeee d 'de' MMMM", { locale: es }));
        
        return (
            <span>
                Planifica una receta para el <span className="text-sky-600 dark:text-sky-300">{mealName}</span> del <i className="text-sky-600 dark:text-sky-300">{dateString}</i>
            </span>
        );
    }, [preselectedMeal, mealDate, isConstructor]);

    const hasActiveSearch = normalizeText(searchTerm).trim().length > 0;
    const showSearchLegend = hasActiveSearch && groupedRecipeData.groups.length > 0 && groupedRecipeData.matchTypes.length > 0;
    const searchLegendText = groupedRecipeData.matchTypes
        .map((type) => RECIPE_SEARCH_MATCH_TYPE_LABELS[type])
        .join(' · ');

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent 
                    className="bg-background border-border text-foreground max-w-4xl lg:max-w-6xl flex flex-col h-[90vh]"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                >
                    <DialogHeader>
                        <DialogTitle>{dialogTitle}</DialogTitle>
                    </DialogHeader>
                    <div className="relative mt-4 flex-shrink-0">
                        <Input 
                            type="text" 
                            placeholder="Buscar receta, ingrediente, grupo, estilo o dificultad..." 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)} 
                            className="input-field pr-10" 
                        />
                         {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                    {showSearchLegend && (
                        <div className="mt-3 rounded-md border border-border/60 bg-card/55 px-3 py-1.5 text-[11px] text-muted-foreground">
                            Coincidencia por: <span className="text-foreground/90">{searchLegendText}</span>
                            {groupedRecipeData.hasFuzzyMatch ? <span className="ml-1 text-foreground/75">(incluye typo)</span> : null}
                        </div>
                    )}
                    <div className="flex-grow overflow-y-auto pr-2 styled-scrollbar-sky mt-4">
                        {loading ? (
                            <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-sky-500" /></div>
                        ) : groupedRecipeData.groups.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-min pb-6">
                                {groupedRecipeData.groups.map((group, idx) => (
                                    <RecipeGroup
                                        key={group.root ? group.root.id : `orphan-${idx}`}
                                        group={group}
                                        searchTerm={searchTerm}
                                        onAdd={handleAddRecipe}
                                        onEditConflict={onEditConflict}
                                        allFoods={allFoods}
                                        addButtonText={isConstructor ? "Añadir al plan" : "Planificar receta"}
                                        themeColor="sky"
                                        onCardClick={handleCardClick}
                                        isPlanner={!isConstructor}
                                        userRestrictions={fullUserRestrictions}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center text-muted-foreground p-8"><p>No se encontraron recetas, o ya están todas añadidas.</p></div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
            {isRecipeViewOpen && (
                <RecipeEditorModal
                    open={isRecipeViewOpen}
                    onOpenChange={setIsRecipeViewOpen}
                    recipeToEdit={recipeToView}
                    onSaveSuccess={handleSaveSuccess}
                    isAdminView={isAdminView}
                    userId={userId}
                    planRestrictions={planRestrictions}
                    isTemplate={isTemplate}
                />
            )}
        </>
    );
};

export default AddRecipeToPlanDialog;
