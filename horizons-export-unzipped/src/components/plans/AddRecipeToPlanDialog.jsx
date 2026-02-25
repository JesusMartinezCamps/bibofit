import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import RecipeCard from '@/components/admin/recipes/RecipeCard';
import { Loader2, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import RecipeEditorModal from '@/components/shared/RecipeEditorModal/RecipeEditorModal';
import { useAuth } from '@/contexts/AuthContext';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from '@/lib/utils';

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
                                "flex items-center justify-center w-full py-2 text-xs font-medium rounded-md transition-all duration-300 ease-in-out border border-slate-700 mt-1 gap-2",
                                isOpen 
                                    ? "bg-gradient-to-b from-slate-800/50 to-slate-900/50 text-slate-300 border-slate-800 shadow-inner" 
                                    : "bg-slate-700 text-white hover:bg-slate-600 shadow-sm"
                            )}
                        >
                            {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            {isOpen ? 'Ocultar variantes' : `Ver ${variants.length} variantes`}
                        </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-4 pt-4 pl-4 border-l-2 border-slate-800 mt-2 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
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
    const [planRestrictions, setPlanRestrictions] = useState(null);
    const [allSensitivities, setAllSensitivities] = useState([]);
    const [allConditions, setAllConditions] = useState([]);
    const [recipeToView, setRecipeToView] = useState(null);
    const [isRecipeViewOpen, setIsRecipeViewOpen] = useState(false);

    const isAdminView = user?.id !== userId;

    const fetchPlanRestrictions = useCallback(async () => {
        if (isTemplate) {
            const { data: sensitivities, error: sensError } = await supabase.from('sensitivities').select('id, name');
            if(sensError) console.error(sensError);
            else setAllSensitivities(sensitivities || []);

            const { data: conditions, error: condError } = await supabase.from('medical_conditions').select('id, name');
            if(condError) console.error(condError);
            else setAllConditions(conditions || []);

            setPlanRestrictions({ 
                sensitivities: new Set(propPlanRestrictions?.sensitivities || []), 
                conditions: new Set(propPlanRestrictions?.conditions || []) 
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
    }, [userId, isTemplate, toast, propPlanRestrictions]);
    
    const fetchInitialData = useCallback(async () => {
        if (!planRestrictions) return;
        setLoading(true);

        try {
            let recipesQuery, privateRecipesQuery;
            const currentMealId = preselectedMeal?.day_meal?.id || preselectedMeal?.id;

            if (mode === 'plan_only') {
                 recipesQuery = supabase
                    .from('diet_plan_recipes')
                    .select(`
                        *, 
                        recipe:recipe_id(*, recipe_ingredients(*, food(*, food_sensitivities(*, sensitivities(id,name)), food_medical_conditions(*, medical_conditions(id, name)))), recipe_sensitivities(*, sensitivities(id, name)), recipe_medical_conditions(*, medical_conditions(id, name)), recipe_macros(*)),
                        custom_ingredients:diet_plan_recipe_ingredients(*, food(*, food_sensitivities(*, sensitivities(id,name)), food_medical_conditions(*, medical_conditions(id, name))))
                    `)
                    .eq('diet_plan_id', dietPlanId)
                    .eq('day_meal_id', currentMealId);
                
                privateRecipesQuery = supabase
                    .from('private_recipes')
                    .select('*, private_recipe_ingredients(*, food(*, food_sensitivities(*, sensitivities(id,name)), food_medical_conditions(*, medical_conditions(id, name))))')
                    .eq('diet_plan_id', dietPlanId)
                    .eq('day_meal_id', currentMealId);

            } else {
                 recipesQuery = supabase.from('recipes')
                    .select('*, recipe_ingredients(*, food(*, food_sensitivities(*, sensitivities(id,name)), food_medical_conditions(*, medical_conditions(id, name)))), recipe_sensitivities(*, sensitivities(id, name)), recipe_medical_conditions(*, medical_conditions(id, name)), recipe_macros(*)');

                 privateRecipesQuery = (!isTemplate && userId)
                    ? supabase.from('private_recipes')
                        .select('*, private_recipe_ingredients(*, food(*, food_sensitivities(*, sensitivities(id,name)), food_medical_conditions(*, medical_conditions(id, name))))')
                        .eq('user_id', userId)
                    : Promise.resolve({ data: [], error: null });
            }

            const [recipesRes, privateRecipesRes, existingPlanRecipesRes, foodsRes] = await Promise.all([
                recipesQuery,
                privateRecipesQuery,
                supabase.from('diet_plan_recipes').select('recipe_id, day_meal_id').eq('diet_plan_id', dietPlanId),
                supabase.from('food').select('*, food_sensitivities(*, sensitivities(id,name)), food_medical_conditions(*, medical_conditions(id, name))')
            ]);
            
            if (recipesRes.error) throw recipesRes.error;
            if (privateRecipesRes.error) throw privateRecipesRes.error;
            if (existingPlanRecipesRes.error) throw existingPlanRecipesRes.error;
            if (foodsRes.error) throw foodsRes.error;

            setAllFoods(foodsRes.data || []);
            setPlanRecipes(existingPlanRecipesRes.data || []);

            const processRecipe = (recipe, isPrivate = false, isFromPlan = false) => {
                const baseRecipe = isFromPlan && !isPrivate ? recipe.recipe : recipe;
                if (!baseRecipe) return null;
                
                const conflicts = { sensitivities: [], conditions: [] };
                const recommendations = { conditions: [] };
                
                let ingredients = [];
                // Determine ingredients source
                if (isFromPlan && !isPrivate && recipe.custom_ingredients && recipe.custom_ingredients.length > 0) {
                    ingredients = recipe.custom_ingredients;
                } else if (isPrivate) {
                    ingredients = baseRecipe.private_recipe_ingredients || [];
                } else if (baseRecipe.recipe_ingredients) {
                    ingredients = baseRecipe.recipe_ingredients || [];
                }

                // Check ingredient conflicts
                if (ingredients && ingredients.length > 0) {
                    ingredients.forEach(ing => {
                        if (!ing.food) return;
                        
                        ing.food.food_sensitivities?.forEach(fs => {
                            if (planRestrictions.sensitivities.has(fs.sensitivity_id)) {
                                if (!conflicts.sensitivities.find(s => s.id === fs.sensitivity_id)) {
                                    const sensitivityDetails = allSensitivities.find(s => s.id === fs.sensitivity_id);
                                    if(sensitivityDetails) conflicts.sensitivities.push(sensitivityDetails);
                                }
                            }
                        });
                        
                        ing.food.food_medical_conditions?.forEach(fmc => {
                            if (planRestrictions.conditions.has(fmc.condition_id)) {
                                const conditionDetails = allConditions.find(c => c.id === fmc.condition_id);
                                if (!conditionDetails) return;
                                
                                if (fmc.relation_type === 'evitar' || fmc.relation_type === 'to_avoid') {
                                    if (!conflicts.conditions.find(c => c.id === fmc.condition_id)) {
                                        conflicts.conditions.push(conditionDetails);
                                    }
                                } else if (fmc.relation_type === 'recommended' || fmc.relation_type === 'recomendado') {
                                    if (!recommendations.conditions.find(c => c.id === fmc.condition_id)) {
                                        recommendations.conditions.push(conditionDetails);
                                    }
                                }
                            }
                        });
                    });
                }
                
                // Also check Recipe-level restrictions (if applicable for non-private recipes)
                if (!isPrivate && baseRecipe.recipe_sensitivities) {
                     baseRecipe.recipe_sensitivities.forEach(rs => {
                        if (planRestrictions.sensitivities.has(rs.sensitivity_id)) {
                             if (!conflicts.sensitivities.find(s => s.id === rs.sensitivity_id)) {
                                const sensitivityDetails = allSensitivities.find(s => s.id === rs.sensitivity_id);
                                if(sensitivityDetails) conflicts.sensitivities.push(sensitivityDetails);
                            }
                        }
                     });
                }

                if (!isPrivate && baseRecipe.recipe_medical_conditions) {
                     baseRecipe.recipe_medical_conditions.forEach(rmc => {
                        if (planRestrictions.conditions.has(rmc.condition_id)) {
                            const conditionDetails = allConditions.find(c => c.id === rmc.condition_id);
                            if (conditionDetails) {
                                // Assume recipe level conditions are "bad" unless specified otherwise, or treat as avoiding
                                // Logic can be refined based on table structure for recipe_medical_conditions if it has relation_type
                                if (!conflicts.conditions.find(c => c.id === rmc.condition_id)) {
                                    conflicts.conditions.push(conditionDetails);
                                }
                            }
                        }
                     });
                }
                
                let recipeName = baseRecipe.name;
                if (isFromPlan && !isPrivate && recipe.is_customized && recipe.custom_name) {
                    recipeName = recipe.custom_name;
                }

                const processed = { ...recipe, conflicts, recommendations, is_private: isPrivate, name: recipeName };
                
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
    }, [dietPlanId, userId, toast, planRestrictions, allSensitivities, allConditions, isTemplate, mode, preselectedMeal]);

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
            day_meal_id: preselectedMeal?.day_meal?.id || preselectedMeal?.id,
            type: recipe.is_private ? 'private_recipe' : (recipe.diet_plan_id ? 'diet_plan_recipe' : 'recipe')
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
        if (!planRestrictions) return {};
        return {
            sensitivities: allSensitivities.filter(s => planRestrictions.sensitivities.has(s.id)),
            medical_conditions: allConditions.filter(c => planRestrictions.conditions.has(c.id)),
            individual_food_restrictions: [],
            preferred_foods: [],
            non_preferred_foods: []
        };
    }, [planRestrictions, allSensitivities, allConditions]);

    // Grouping and Filtering Logic
    const groupedRecipes = useMemo(() => {
        const getPriority = (recipe) => {
            if (recipe.is_private) return 0; // Highest priority
            if (recipe.conflicts.conditions.length > 0) return 4;
            if (recipe.conflicts.sensitivities.length > 0) return 3;
            if (recipe.recommendations.conditions.length > 0) return 1;
            return 2; // No conflicts, no recommendations
        };
        
        const normalizeText = (text) => {
            return text ? text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
        };

        const term = normalizeText(searchTerm);

        let recipesInCurrentMeal = new Set();
        if (mode !== 'plan_only') {
           recipesInCurrentMeal = new Set(
                planRecipes
                    .filter(pr => pr.day_meal_id === preselectedMeal?.id)
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

             const parentId = r.parent_recipe_id || r.parent_private_recipe_id;
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

             const parentId = r.parent_recipe_id || r.parent_private_recipe_id;
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

        // 2. Filter groups
        return allItems.filter(group => {
            if (!term) return true;

            const checkRecipe = (r) => {
                if (!r) return false;
                if (normalizeText(r.name).includes(term)) return true;
                if (r.difficulty && normalizeText(r.difficulty).includes(term)) return true;
                if (r.recipe_ingredients && r.recipe_ingredients.length > 0) {
                    return r.recipe_ingredients.some(ing => {
                        return ing.food && normalizeText(ing.food.name).includes(term);
                    });
                }
                return false;
            };

            const rootMatch = checkRecipe(group.root);
            const variantMatch = group.variants.some(checkRecipe);

            return rootMatch || variantMatch;
        });

    }, [allRecipes, planRecipes, searchTerm, preselectedMeal, mode]);

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
                Planifica una receta para el <span className="text-sky-300">{mealName}</span> del <i className="text-sky-300">{dateString}</i>
            </span>
        );
    }, [preselectedMeal, mealDate, isConstructor]);

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent 
                    className="bg-[#1a1e23] border-gray-700 text-white max-w-4xl lg:max-w-6xl flex flex-col h-[90vh]"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                >
                    <DialogHeader>
                        <DialogTitle>{dialogTitle}</DialogTitle>
                    </DialogHeader>
                    <div className="relative mt-4 flex-shrink-0">
                        <Input 
                            type="text" 
                            placeholder="Buscar recetas por nombre, ingrediente o dificultad..." 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)} 
                            className="input-field pr-10" 
                        />
                         {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                    <div className="flex-grow overflow-y-auto pr-2 styled-scrollbar-sky mt-4">
                        {loading ? (
                            <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-sky-500" /></div>
                        ) : groupedRecipes.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-min pb-6">
                                {groupedRecipes.map((group, idx) => (
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
                            <div className="text-center text-gray-400 p-8"><p>No se encontraron recetas, o ya están todas añadidas.</p></div>
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
                />
            )}
        </>
    );
};

export default AddRecipeToPlanDialog;