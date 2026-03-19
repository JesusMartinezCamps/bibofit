import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Utensils, Clock, BarChart3, Sparkles, Calendar, Loader2, X, Hourglass, Search, FileText, AlertTriangle, ThumbsUp, ArrowLeft } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import FreeRecipeViewDialog from '@/components/plans/FreeRecipeViewDialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { getConflictInfo } from '@/lib/restrictionChecker.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FREE_RECIPE_STATUS, normalizeFreeRecipeStatus } from '@/lib/recipeEntity';
import HighlightedText from '@/components/shared/HighlightedText';
import {
  filterRecipesByQuery,
  getIngredientHighlightForQuery,
  RECIPE_SEARCH_MATCH_TYPE_LABELS,
} from '@/lib/recipeSearch';
import { normalizeText } from '@/lib/textSearch';

const RepeatFreeRecipeDialog = ({ open, onOpenChange, onSelectRecipe, planId, userId, onDeleteRecipe, allFoods = [], asPage = false }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [recipes, setRecipes] = useState([]);
  const [templateRecipes, setTemplateRecipes] = useState([]);
  const [recipeToDelete, setRecipeToDelete] = useState(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all', 'free', 'template'
  const [userRestrictions, setUserRestrictions] = useState({
      sensitivities: [],
      medical_conditions: [],
      preferred_foods: [],
      non_preferred_foods: []
  });

  // Preview/Select logic
  const [selectedRecipeForPreview, setSelectedRecipeForPreview] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false); // Loading state for template creation

  const fetchRecipes = useCallback(async () => {
    if (!open || !userId) return;
    setLoading(true);
    try {
        // 1. Fetch User Restrictions
        const [
            sensitivitiesRes,
            conditionsRes,
            preferredRes,
            nonPreferredRes,
            individualFoodsRes
        ] = await Promise.all([
            supabase.from('user_sensitivities').select('sensitivity:sensitivities(id, name)').eq('user_id', userId),
            supabase.from('user_medical_conditions').select('condition:medical_conditions(id, name)').eq('user_id', userId),
            supabase.from('preferred_foods').select('food(id, name)').eq('user_id', userId),
            supabase.from('non_preferred_foods').select('food(id, name)').eq('user_id', userId),
            supabase.from('user_individual_food_restrictions').select('food:food_id(id, name)').eq('user_id', userId),
        ]);

        setUserRestrictions({
            sensitivities: (sensitivitiesRes.data || []).map(s => s.sensitivity).filter(Boolean),
            medical_conditions: (conditionsRes.data || []).map(c => c.condition).filter(Boolean),
            preferred_foods: (preferredRes.data || []).map(p => p.food).filter(Boolean),
            non_preferred_foods: (nonPreferredRes.data || []).map(np => np.food).filter(Boolean),
            individual_food_restrictions: (individualFoodsRes.data || []).map(i => i.food).filter(Boolean),
        });

      // 2. Fetch Free Recipes with deep food relations
      const { data: freeData, error: freeError } = await supabase
        .from('user_recipes')
        .select(`
          *,
          recipe_style:recipe_style_id(id, name),
          ingredients:recipe_ingredients(
            *,
            food(
                *,
                food_to_food_groups(food_group:food_groups(*)),
                food_sensitivities(sensitivity:sensitivities(*)),
                food_medical_conditions(relation_type, condition:medical_conditions(*))
            )
          ),
          occurrences:free_recipe_occurrences(meal_date)
        `)
        .eq('user_id', userId)
        .eq('type', 'free');
      
      if (freeError) throw freeError;

      const processedFreeRecipes = freeData.map(recipe => {
        const latestOccurrence = recipe.occurrences.length > 0 
          ? recipe.occurrences.reduce((latest, current) => new Date(current.meal_date) > new Date(latest.meal_date) ? current : latest)
          : null;
        return { ...recipe, last_used: latestOccurrence?.meal_date, type: 'free' };
      });

      setRecipes(processedFreeRecipes);

      // 3. Fetch Template Recipes with deep food relations
      const { data: templateData, error: templateError } = await supabase
        .from('recipes')
        .select(`
            *,
            recipe_style:recipe_style_id(id, name),
            ingredients:recipe_ingredients(
                *, 
                food(
                    *,
                    food_to_food_groups(food_group:food_groups(*)),
                    food_sensitivities(sensitivity:sensitivities(*)),
                    food_medical_conditions(relation_type, condition:medical_conditions(*))
                )
            )
        `)
        .limit(50);

      if (templateError) throw templateError;

      const processedTemplates = templateData.map(recipe => ({
        ...recipe,
        type: 'template',
        ingredients: recipe.ingredients // Align structure
      }));

      setTemplateRecipes(processedTemplates);

    } catch (error) {
      console.error("Error fetching recipes:", error);
    } finally {
      setLoading(false);
    }
  }, [open, userId]);

  useEffect(() => {
    if (open) {
        fetchRecipes();
        setSearchQuery('');
        setFilterType('all');
    }
  }, [open, fetchRecipes]);

  // Helper to analyze ingredients against restrictions
  const analyzeIngredients = useCallback((ingredients) => {
      let greenCount = 0;
      let redCount = 0;
      const coloredIngredients = [];

      if (!ingredients || ingredients.length === 0) {
          return { greenCount: 0, redCount: 0, display: <span className="text-muted-foreground italic">No hay ingredientes</span> };
      }

      const items = ingredients.map((ing, index) => {
        const foodId = ing.food_id;
        const isUserCreated = !!ing.is_user_created;
        
        // Fallback to ing.food which now has deep data from our updated queries
        const fullFood = allFoods?.find(f => String(f.id) === String(foodId) && f.is_user_created === isUserCreated);
        let foodToCheck = fullFood || ing.food;

        // If the food from props doesn't have sensitivities but the one from recipe fetch does, merge them
        if (ing.food && foodToCheck) {
             if (ing.food.food_sensitivities && (!foodToCheck.food_sensitivities || foodToCheck.food_sensitivities.length === 0)) {
                 foodToCheck = { ...foodToCheck, food_sensitivities: ing.food.food_sensitivities };
             }
             if (ing.food.food_medical_conditions && (!foodToCheck.food_medical_conditions || foodToCheck.food_medical_conditions.length === 0)) {
                 foodToCheck = { ...foodToCheck, food_medical_conditions: ing.food.food_medical_conditions };
             }
        }
        
        const foodDetails = foodToCheck || ing.food;
        const unit = foodDetails?.food_unit === 'unidades' ? 'ud' : 'g';
        const quantity = ing.grams ?? ing.quantity;
        const name = foodDetails?.name || 'Ingrediente no encontrado';
        const text = `${name} (${Math.round(quantity || 0)}${unit})`;

        if (!foodToCheck) {
            coloredIngredients.push({ text, colorClass: 'text-muted-foreground' });
            return (
              <span key={index} className="text-muted-foreground">
                <HighlightedText
                  text={text}
                  highlight={getIngredientHighlightForQuery({ food: foodDetails, query: searchQuery, allowFuzzy: true })}
                  className="text-yellow-400 font-bold bg-yellow-400/10 rounded-[2px] px-0.5"
                />
              </span>
            );
        }

        const conflict = getConflictInfo(foodToCheck, userRestrictions);
        let colorClass = 'text-muted-foreground'; // Neutral default

        if (conflict) {
            if (conflict.type === 'preferred' || conflict.type === 'condition_recommend') {
                colorClass = 'text-green-400 font-medium';
                greenCount++;
            } else {
                // Avoid types: sensitivity, condition_avoid, individual_restriction, non-preferred
                colorClass = 'text-red-400 font-bold'; // Make it more visible red
                redCount++;
            }
        }
        
        coloredIngredients.push({ text, colorClass });
        return (
            <span key={index} className={colorClass}>
                <HighlightedText
                  text={text}
                  highlight={getIngredientHighlightForQuery({ food: foodDetails, query: searchQuery, allowFuzzy: true })}
                  className="text-yellow-400 font-bold bg-yellow-400/10 rounded-[2px] px-0.5"
                />
            </span>
        );
      });

      // Join elements with commas
      const display = items.reduce((prev, curr, i) => [prev, <span key={`sep-${i}`}>, </span>, curr]);

      return { greenCount, redCount, display };
  }, [allFoods, searchQuery, userRestrictions]);

  const { filteredItems, searchMatchTypes, searchHasFuzzyMatch } = useMemo(() => {
    let combined = [];

    // 1. Filter by Type first
    let currentFree = recipes;
    let currentTemplate = templateRecipes;

    if (filterType === 'free') {
        currentTemplate = [];
    } else if (filterType === 'template') {
        currentFree = [];
    }

    // 2. Deduplicate Free Recipes (only if we are showing them)
    const seenFree = new Set();
    const uniqueFree = currentFree.filter(recipe => {
        const duplicate = seenFree.has(recipe.name);
        seenFree.add(recipe.name);
        return !duplicate;
    });

    // 3. Filter out templates that are already linked to existing free recipes
    const usedTemplateIds = new Set(currentFree.map(r => r.parent_recipe_id).filter(Boolean));
    const availableTemplates = currentTemplate.filter(t => !usedTemplateIds.has(t.id));
    
    combined = [...uniqueFree, ...availableTemplates];

    // 4. Process items to add analysis data
    const processedItems = combined.map(item => {
        const analysis = analyzeIngredients(item.ingredients);
        return { ...item, ...analysis };
    });

    const searchResult = filterRecipesByQuery({
      items: processedItems,
      query: searchQuery,
      allFoods,
      allowFuzzy: true,
    });

    const resultItems = searchQuery.trim() ? searchResult.items : processedItems;

    // 6. Sort
    // Priority 1: Red Count (Ascending) - Less reds is better
    // Priority 2: Green Count (Descending) - More greens is better
    // Priority 3: Date (Newest first) - For free recipes mainly
    const sortedItems = [...resultItems].sort((a, b) => {
        if (a.redCount !== b.redCount) {
            return a.redCount - b.redCount; 
        }
        if (a.greenCount !== b.greenCount) {
            return b.greenCount - a.greenCount;
        }
        
        const dateA = a.last_used ? new Date(a.last_used).getTime() : 0;
        const dateB = b.last_used ? new Date(b.last_used).getTime() : 0;
        return dateB - dateA;
    });
    
    return {
      filteredItems: sortedItems,
      searchMatchTypes: searchResult.matchTypes,
      searchHasFuzzyMatch: searchResult.hasFuzzyMatch,
    };

  }, [recipes, templateRecipes, searchQuery, filterType, analyzeIngredients]);

  const hasActiveSearch = normalizeText(searchQuery).trim().length > 0;
  const showSearchLegend = hasActiveSearch && filteredItems.length > 0 && searchMatchTypes.length > 0;
  const searchLegendText = searchMatchTypes.map((type) => RECIPE_SEARCH_MATCH_TYPE_LABELS[type]).join(' · ');

  const handleSelectClick = (recipe) => {
    setSelectedRecipeForPreview(recipe);
    setIsPreviewOpen(true);
  };

  const handleConfirmSelect = async (recipe) => {
    if (recipe.type === 'template') {
        setIsCreating(true);
        try {
            // 1. Create Free Recipe Header
            const { data: newFreeRecipe, error: createError } = await supabase
                .from('user_recipes')
                .insert({
                    type: 'free',
                    user_id: userId,
                    name: recipe.name,
                    instructions: recipe.instructions,
                    prep_time_min: recipe.prep_time_min,
                    difficulty: recipe.difficulty,
                    status: FREE_RECIPE_STATUS.APPROVED_PRIVATE,
                    diet_plan_id: planId || null,
                    parent_recipe_id: recipe.id, // Link to original template
                })
                .select()
                .single();

            if (createError) throw createError;

            // 2. Create Ingredients
            const ingredientsToInsert = recipe.ingredients.map(ing => ({
                user_recipe_id: newFreeRecipe.id,
                food_id: ing.food_id, 
                grams: ing.grams,
                status: 'linked'
            }));

            const { error: ingError } = await supabase
                .from('recipe_ingredients')
                .insert(ingredientsToInsert);

            if (ingError) throw ingError;

            // 3. Construct full object to pass back
            const fullNewRecipe = {
                ...newFreeRecipe,
                ingredients: recipe.ingredients, 
                type: 'free_recipe',
                is_newly_created: true
            };
            
            onSelectRecipe(fullNewRecipe);
            
            toast({
                title: "Receta añadida",
                description: "La plantilla se ha guardado como una de tus recetas libres.",
            });

            setIsPreviewOpen(false);
            onOpenChange(false);

        } catch (error) {
            console.error("Error creating free recipe from template:", error);
            toast({
                title: "Error",
                description: "No se pudo añadir la receta.",
                variant: "destructive"
            });
        } finally {
            setIsCreating(false);
        }
    } else {
        await onSelectRecipe(recipe);
        setIsPreviewOpen(false);
        onOpenChange(false);
    }
  };

  const handleRecipeUpdate = (updatedRecipe) => {
      setRecipes(prev => prev.map(r => r.id === updatedRecipe.id ? { ...r, ...updatedRecipe } : r));
      setSelectedRecipeForPreview(updatedRecipe);
  };

  const handleDeleteClick = (e, recipe) => {
    e.stopPropagation();
    setRecipeToDelete(recipe);
    setIsConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (recipeToDelete) {
      const success = await onDeleteRecipe(recipeToDelete.id);
      if (success) {
        setRecipes(prev => prev.filter(r => r.id !== recipeToDelete.id));
      }
    }
    setIsConfirmOpen(false);
    setRecipeToDelete(null);
  };

  const getLastEatenDate = (mealDate) => {
    if (!mealDate) return null;
    try {
      const date = parseISO(mealDate);
      return formatDistanceToNow(date, { addSuffix: true, locale: es });
    } catch (error) {
      return null;
    }
  };

  const getStatusBadge = (status) => {
    if (normalizeFreeRecipeStatus(status) !== FREE_RECIPE_STATUS.PENDING) {
      return null; 
    }
    return (
      <span className="text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wider font-medium whitespace-nowrap bg-blue-500/20 text-blue-300 border-blue-500/50">
        Pendiente
      </span>
    );
  };

  const innerContent = (
    <>
      <div className="px-4 pt-4 pb-2 flex-shrink-0 space-y-4">
        {asPage ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenChange(false)}
              className="text-muted-foreground hover:text-foreground h-8 w-8 flex items-center justify-center flex-shrink-0 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Repetir una Receta</h1>
              <p className="text-sm text-muted-foreground">Selecciona una receta libre anterior o una plantilla.</p>
            </div>
          </div>
        ) : (
          <DialogHeader>
            <DialogTitle className="text-center text-2xl">Repetir una Receta</DialogTitle>
            <DialogDescription className="text-center">
              Selecciona una receta libre anterior o una plantilla.
            </DialogDescription>
          </DialogHeader>
        )}
            
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Buscar receta, ingrediente, grupo, estilo o dificultad..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 bg-muted border-border focus:border-sky-500"
                />
                {searchQuery && (
                    <button 
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            <div className="flex justify-center">
                <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-full h-9 text-sm">
                        <SelectValue placeholder="Filtrar recetas" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Filtrar por todas las recetas</SelectItem>
                        <SelectItem value="free">Filtrar por mis recetas libres</SelectItem>
                        <SelectItem value="template">Filtrar por plantillas de recetas</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            {showSearchLegend && (
              <div className="rounded-md border border-border/60 bg-card/55 px-3 py-1.5 text-[11px] text-muted-foreground">
                Coincidencia por: <span className="text-foreground/90">{searchLegendText}</span>
                {searchHasFuzzyMatch ? <span className="ml-1 text-foreground/75">(incluye typo)</span> : null}
              </div>
            )}
          </div>
          
          <ScrollArea className="flex-1 w-full rounded-md px-4 pt-2 pb-4">
            {loading ? (
              <div className="flex justify-center items-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
              </div>
            ) : (
              <div className="space-y-3">
                {filteredItems.length > 0 ? (
                  filteredItems.map(recipe => {
                    const lastEaten = getLastEatenDate(recipe.last_used);
                    const isTemplate = recipe.type === 'template';
                    const normalizedStatus = normalizeFreeRecipeStatus(recipe.status);

                    return (
                      <div key={`${recipe.type}-${recipe.id}`} className="relative group">
                        <button
                          onClick={() => handleSelectClick(recipe)}
                          className={cn(
                            "w-full text-left p-4 rounded-lg transition-colors flex flex-col gap-3 border",
                            isTemplate 
                                ? "bg-card/80 hover:bg-muted/80 border-border/50" 
                                : "bg-muted/70 hover:bg-muted/80 border-border/50"
                          )}
                        >
                          <div className="flex justify-between items-start w-full pr-6">
                            <div className="flex flex-col gap-1">
                                {lastEaten && (
                                    <div className="flex items-center text-xs text-muted-foreground">
                                        <Calendar className="w-3 h-3 mr-1.5" />
                                        {lastEaten}
                                    </div>
                                )}
                                {isTemplate && (
                                    <div className="flex items-center text-xs text-purple-400">
                                        <FileText className="w-3 h-3 mr-1.5" />
                                        Plantilla
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-2 pl-2">
                                {getStatusBadge(recipe.status)}
                                {recipe.greenCount > 0 && (
                                    <span className="flex items-center text-xs text-green-400 gap-0.5" title={`${recipe.greenCount} alimentos recomendados`}>
                                        <ThumbsUp className="w-3 h-3" /> {recipe.greenCount}
                                    </span>
                                )}
                                {recipe.redCount > 0 && (
                                    <span className="flex items-center text-xs text-red-400 gap-0.5" title={`${recipe.redCount} alimentos a evitar`}>
                                        <AlertTriangle className="w-3 h-3" /> {recipe.redCount}
                                    </span>
                                )}
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            {normalizedStatus === FREE_RECIPE_STATUS.PENDING ? (
                              <Hourglass className="h-5 w-5 text-sky-400 flex-shrink-0" />
                            ) : (
                              <Utensils className={cn("h-5 w-5 flex-shrink-0", isTemplate ? "text-purple-400" : "text-sky-400")} />
                            )}
                            <p className="font-semibold text-lg text-foreground">
                                <HighlightedText
                                  text={recipe.name}
                                  highlight={searchQuery}
                                  className="text-yellow-400 font-bold bg-yellow-400/10 rounded-[2px] px-0.5"
                                />
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            {recipe.difficulty && (
                              <span className="flex items-center gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> {recipe.difficulty}</span>
                            )}
                            {recipe.prep_time_min && (
                              <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {recipe.prep_time_min} min</span>
                            )}
                          </div>
                          <div className="text-xs border-t border-border/50 pt-2 mt-2 w-full">
                            <p className="line-clamp-3 leading-relaxed">
                                {recipe.display}
                            </p>
                          </div>
                        </button>
                        
                        {!isTemplate && (
                             <button 
                                onClick={(e) => handleDeleteClick(e, recipe)}
                                className="absolute top-2 right-2 bg-red-500/70 text-white rounded-full p-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all hover:bg-red-500 z-10"
                                title="Eliminar receta permanentemente"
                                style={{ marginTop: '0.5rem', padding: '0.25rem' }}
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground italic py-10">
                    <Sparkles className="h-10 w-10 mb-4 text-gray-600" />
                    {searchQuery ? "No se encontraron resultados." : "No hay recetas disponibles."}
                  </div>
                )}
              </div>
            )}
            <ScrollBar orientation="vertical" className="[&>div]:bg-[rgb(59,159,189)]" />
          </ScrollArea>

      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará la receta "{recipeToDelete?.name}" y todas sus apariciones en el plan de forma permanente. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsConfirmOpen(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Eliminar Permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {!asPage && selectedRecipeForPreview && (
          <FreeRecipeViewDialog
            open={isPreviewOpen}
            onOpenChange={setIsPreviewOpen}
            freeMeal={selectedRecipeForPreview}
            onSelect={handleConfirmSelect}
            onUpdate={handleRecipeUpdate}
            isActionLoading={isCreating}
          />
      )}
    </>
  );

  if (asPage) {
    if (isPreviewOpen && selectedRecipeForPreview) {
      return (
        <FreeRecipeViewDialog
          open={true}
          asPage={true}
          onOpenChange={(open) => { if (!open) setIsPreviewOpen(false); }}
          freeMeal={selectedRecipeForPreview}
          onSelect={handleConfirmSelect}
          onUpdate={handleRecipeUpdate}
          isActionLoading={isCreating}
        />
      );
    }
    return (
      <div className="flex flex-col h-full bg-background text-white">
        {innerContent}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background border-border text-white sm:max-w-md p-0 sm:p-0 flex flex-col h-[80vh] sm:h-[650px]">
        {innerContent}
      </DialogContent>
    </Dialog>
  );
};

export default RepeatFreeRecipeDialog;
