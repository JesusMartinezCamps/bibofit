import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, Edit, Check, Sparkles } from 'lucide-react';
import AdminRecipeModal from '@/components/admin/recipes/AdminRecipeModal';
import { getConflictInfo } from '@/lib/restrictionChecker';
import { motion, AnimatePresence } from 'framer-motion';

const ConflictResolutionDialog = ({ open, onOpenChange, conflicts, onRecipeUpdate, onResolveComplete, clientRestrictions, planRestrictions }) => {
    const [editingRecipe, setEditingRecipe] = useState(null);
    const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
    const [resolvedRecipes, setResolvedRecipes] = useState(new Set());
    const criticalConflictTypes = useMemo(() => new Set(['condition_avoid', 'sensitivity', 'non-preferred']), []);
    useEffect(() => {
        if (!open) return;
        setResolvedRecipes(new Set());
        setEditingRecipe(null);
        setIsRecipeModalOpen(false);
    }, [open, conflicts]);

    const matchesRestrictionLabel = (reason, restrictionName) => {
        if (!reason || !restrictionName) return false;

        return reason === restrictionName ||
            reason.includes(`: ${restrictionName}`) ||
            reason.includes(`por: ${restrictionName}`);
    };
    const resolveRecipeImage = (recipe) => {
        return (
            recipe?.image_url ||
            recipe?.img_url ||
            recipe?.recipe?.image_url ||
            recipe?.recipe?.img_url ||
            null
        );
    };
    const getIngredientsFromRecipe = (recipe) => {
        return recipe?.custom_ingredients?.length > 0
            ? recipe.custom_ingredients
            : (recipe?.ingredients || recipe?.recipe?.recipe_ingredients || []);
    };

    const normalizeIngredientQuantityForTargetFood = (ingredient, targetFood) => {
        const sourceUnit = ingredient?.food?.food_unit || 'gramos';
        const targetUnit = targetFood?.food_unit || 'gramos';
        const currentQty = Number(ingredient?.grams ?? ingredient?.quantity ?? 0);
        const hasCurrentQty = Number.isFinite(currentQty) && currentQty > 0;

        if (sourceUnit === targetUnit) {
            return hasCurrentQty ? currentQty : (targetUnit === 'unidades' ? 1 : 100);
        }

        return targetUnit === 'unidades' ? 1 : 100;
    };

    const getFoodId = (ingredient) => String(ingredient?.food_id ?? ingredient?.food?.id ?? '');

    const buildSubstitutionMapFromEdition = (originalRecipe, updatedRecipe) => {
        const originalIngredients = getIngredientsFromRecipe(originalRecipe);
        const updatedIngredients = getIngredientsFromRecipe(updatedRecipe);
        const substitutions = new Map();

        const originalFoodsById = new Map();
        const updatedFoodsById = new Map();
        originalIngredients.forEach((ing) => {
            const foodId = getFoodId(ing);
            if (!foodId || !ing?.food) return;
            if (!originalFoodsById.has(foodId)) originalFoodsById.set(foodId, ing.food);
        });
        updatedIngredients.forEach((ing) => {
            const foodId = getFoodId(ing);
            if (!foodId || !ing?.food) return;
            if (!updatedFoodsById.has(foodId)) updatedFoodsById.set(foodId, ing.food);
        });

        const minLen = Math.min(originalIngredients.length, updatedIngredients.length);
        for (let i = 0; i < minLen; i += 1) {
            const before = originalIngredients[i];
            const after = updatedIngredients[i];
            const beforeId = getFoodId(before);
            const afterId = getFoodId(after);
            if (!beforeId || !afterId || beforeId === afterId) continue;
            if (after?.food) {
                substitutions.set(beforeId, { food_id: after.food.id, food: after.food });
            }
        }

        const countDiff = (ingredients) => {
            const counts = new Map();
            ingredients.forEach((ing) => {
                const foodId = getFoodId(ing);
                if (!foodId) return;
                counts.set(foodId, (counts.get(foodId) || 0) + 1);
            });
            return counts;
        };

        const oldCounts = countDiff(originalIngredients);
        const newCounts = countDiff(updatedIngredients);
        const removedCriticalIds = [];
        const addedSafeIds = [];

        oldCounts.forEach((oldCount, foodId) => {
            const diff = oldCount - (newCounts.get(foodId) || 0);
            if (diff <= 0) return;
            for (let i = 0; i < diff; i += 1) removedCriticalIds.push(foodId);
        });

        newCounts.forEach((newCount, foodId) => {
            const diff = newCount - (oldCounts.get(foodId) || 0);
            if (diff <= 0) return;
            for (let i = 0; i < diff; i += 1) addedSafeIds.push(foodId);
        });

        const pairCount = Math.min(removedCriticalIds.length, addedSafeIds.length);
        for (let i = 0; i < pairCount; i += 1) {
            const fromId = removedCriticalIds[i];
            const toId = addedSafeIds[i];
            if (substitutions.has(fromId)) continue;
            const targetFood = updatedFoodsById.get(toId);
            if (!targetFood) continue;
            substitutions.set(fromId, { food_id: targetFood.id, food: targetFood });
        }

        return substitutions;
    };

    const applySubstitutionMapToRecipe = (recipe, substitutionMap, restrictions) => {
        if (!recipe || !substitutionMap || substitutionMap.size === 0) return null;

        const clone = typeof structuredClone === 'function'
            ? structuredClone(recipe)
            : JSON.parse(JSON.stringify(recipe));

        const ingredients = getIngredientsFromRecipe(clone);
        if (!Array.isArray(ingredients) || ingredients.length === 0) return null;
        const existingFoodIds = new Set(
            ingredients
                .map((ingredient) => getFoodId(ingredient))
                .filter(Boolean),
        );
        const shouldSkipRecipe = Array.from(substitutionMap.entries()).some(([fromId, substitution]) => {
            const targetId = String(substitution?.food_id ?? '');
            if (!targetId || targetId === fromId) return false;
            return existingFoodIds.has(fromId) && existingFoodIds.has(targetId);
        });

        // If the recipe already contains the target food for a replacement that would apply,
        // skip the entire recipe for this propagation cycle to avoid mixed/duplicate variants.
        if (shouldSkipRecipe) return null;

        let hasChanges = false;
        const updatedIngredients = ingredients.map((ingredient) => {
            const currentId = getFoodId(ingredient);
            const substitution = substitutionMap.get(currentId);
            if (!substitution) return ingredient;
            const targetId = String(substitution.food_id);

            // Avoid propagating when it would duplicate an already present ingredient.
            // Example: recipe already has chia + nuez, and propagation tries nuez -> chia.
            if (targetId !== currentId && existingFoodIds.has(targetId)) {
                return ingredient;
            }

            const replacementConflict = getConflictInfo(substitution.food, restrictions);
            if (replacementConflict && criticalConflictTypes.has(replacementConflict.type)) {
                return ingredient;
            }

            hasChanges = true;
            const normalizedQty = normalizeIngredientQuantityForTargetFood(ingredient, substitution.food);
            return {
                ...ingredient,
                food_id: substitution.food_id,
                food: substitution.food,
                grams: normalizedQty,
                quantity: normalizedQty
            };
        });

        if (!hasChanges) return null;

        clone.ingredients = updatedIngredients;
        clone.custom_ingredients = updatedIngredients;
        if (clone.recipe?.recipe_ingredients) {
            clone.recipe.recipe_ingredients = updatedIngredients;
        }
        return clone;
    };

    // Flatten conflicts to be recipe-centric instead of type-centric, and resolve specific foods
    const recipeConflictsByMeal = useMemo(() => {
        const recipeMap = new Map();

        // 1. Group by Recipe ID
        Object.entries(conflicts || {}).forEach(([restrictionName, recipes]) => {
            if (!Array.isArray(recipes)) return;
            recipes.forEach(recipe => {
                if (!recipeMap.has(recipe.id)) {
                    recipeMap.set(recipe.id, {
                        recipe,
                        conflictNames: []
                    });
                }
                recipeMap.get(recipe.id).conflictNames.push(restrictionName);
            });
        });

        // 2. Resolve foods for each restriction in each recipe
        const flattened = Array.from(recipeMap.values()).map(({ recipe, conflictNames }) => {
            // Determine ingredients source (handling potential different structures)
            const ingredients = recipe.custom_ingredients?.length > 0 
                ? recipe.custom_ingredients 
                : (recipe.ingredients || recipe.recipe?.recipe_ingredients || []);

            const detailedConflicts = conflictNames.map(restrictionName => {
                const conflictingFoods = [];
                
                ingredients.forEach(ing => {
                    const food = ing.food;
                    if (!food) return;

                    // Check if this specific food triggers the current restriction name
                    const info = getConflictInfo(food, clientRestrictions);
                    if (info && matchesRestrictionLabel(info.reason, restrictionName)) {
                        conflictingFoods.push(food.name);
                    }
                });

                return {
                    name: restrictionName,
                    foods: [...new Set(conflictingFoods)] // Remove duplicates
                };
            });

            return {
                recipe,
                conflicts: detailedConflicts,
                mealName: recipe?.day_meal?.name || recipe?.day_meals?.name || 'Comida',
                mealOrder: Number(recipe?.day_meal?.display_order ?? recipe?.day_meals?.display_order ?? 999),
                imageUrl: resolveRecipeImage(recipe)
            };
        });

        const grouped = new Map();
        flattened.forEach((item) => {
            const key = `${item.mealOrder}-${item.mealName}`;
            if (!grouped.has(key)) {
                grouped.set(key, { mealName: item.mealName, mealOrder: item.mealOrder, items: [] });
            }
            grouped.get(key).items.push(item);
        });

        return Array.from(grouped.values())
            .sort((a, b) => a.mealOrder - b.mealOrder || a.mealName.localeCompare(b.mealName))
            .map((section) => ({
                ...section,
                items: section.items.sort((a, b) => {
                    const aName = a.recipe?.custom_name || a.recipe?.recipe?.name || a.recipe?.name || '';
                    const bName = b.recipe?.custom_name || b.recipe?.recipe?.name || b.recipe?.name || '';
                    return aName.localeCompare(bName);
                }),
            }));
    }, [conflicts, clientRestrictions]);

    const remainingRecipesCount = useMemo(() => {
        return recipeConflictsByMeal.reduce((acc, section) => {
            const unresolvedInSection = section.items.filter(item => !resolvedRecipes.has(item.recipe.id)).length;
            return acc + unresolvedInSection;
        }, 0);
    }, [recipeConflictsByMeal, resolvedRecipes]);
    const allConflictsResolved = remainingRecipesCount === 0;

  const resolvedRestrictions = useMemo(() => ({
        sensitivities: clientRestrictions?.sensitivities || [],
        medical_conditions: clientRestrictions?.medical_conditions || clientRestrictions?.conditions || [],
        individual_food_restrictions: planRestrictions?.individual_food_restrictions || [],
        preferred_foods: planRestrictions?.preferred_foods || [],
        non_preferred_foods: planRestrictions?.non_preferred_foods || []
    }), [clientRestrictions, planRestrictions]);

    const handleEditRecipe = (recipe) => {
        setEditingRecipe(recipe);
        setIsRecipeModalOpen(true);
    };

    const handleRecipeSaveSuccess = (updatedRecipe) => {
        console.log("LOG 2: Received updated recipe in ConflictResolutionDialog", updatedRecipe.id, updatedRecipe);
        const originalEditedItem = recipeConflictsByMeal
            .flatMap((section) => section.items)
            .find((item) => Number(item.recipe?.id) === Number(updatedRecipe?.id));
        const substitutionMap = buildSubstitutionMapFromEdition(
            originalEditedItem?.recipe,
            updatedRecipe
        );
        const propagatedRecipes = [];

        if (onRecipeUpdate) {
            onRecipeUpdate(updatedRecipe);
            if (substitutionMap.size > 0) {
                const otherConflictItems = recipeConflictsByMeal
                    .flatMap((section) => section.items)
                    .filter((item) => Number(item.recipe?.id) !== Number(updatedRecipe?.id));

                otherConflictItems.forEach((item) => {
                    const propagated = applySubstitutionMapToRecipe(item.recipe, substitutionMap, resolvedRestrictions);
                    if (propagated) {
                        propagatedRecipes.push(propagated);
                        onRecipeUpdate(propagated);
                    }
                });
            }
        }
        setResolvedRecipes((prev) => {
            const next = new Set(prev);
            next.add(updatedRecipe.id);
            propagatedRecipes.forEach((propagated) => next.add(propagated.id));
            return next;
        });
        setIsRecipeModalOpen(false);
        setEditingRecipe(null);
    };
    const handleConfirm = () => {
        if (remainingRecipesCount > 0) return;

        onOpenChange(false);

        if (onResolveComplete) {
            onResolveComplete();
        }
    };
    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent
                    className="bg-[#0f1115] text-white w-screen !max-w-none h-[100dvh] !max-h-none rounded-none border-0 flex flex-col overflow-hidden [&>button]:hidden"
                    onEscapeKeyDown={(event) => event.preventDefault()}
                    onInteractOutside={(event) => event.preventDefault()}
                >
                    <DialogHeader className="border-b border-slate-800/80 px-6 py-5">
                        <DialogTitle className={`flex items-center gap-2 ${allConflictsResolved ? 'text-emerald-400' : 'text-orange-400'}`}>
                            {allConflictsResolved ? <CheckCircle className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
                            Conflictos de Restricciones Detectados
                        </DialogTitle>
                        <DialogDescription>
                            Las siguientes recetas contienen ingredientes que entran en conflicto con las restricciones del cliente.
                            Debes editar o confirmar estas recetas para continuar.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="space-y-8">
                            {recipeConflictsByMeal.map((section) => (
                                <section key={`${section.mealOrder}-${section.mealName}`} className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-base font-semibold text-slate-200">{section.mealName}</h3>
                                        <Badge variant="outline" className="border-slate-600 text-slate-300 bg-slate-900/60">
                                            {section.items.length} receta{section.items.length === 1 ? '' : 's'}
                                        </Badge>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        {section.items.map(({ recipe, conflicts, imageUrl }) => {
                                            const isResolved = resolvedRecipes.has(recipe.id);
                                            const recipeName = recipe.custom_name || recipe.recipe?.name || recipe.name;

                                            return (
                                                <article
                                                    key={recipe.id}
                                                    className={`relative overflow-hidden rounded-xl border min-h-[220px] ${isResolved ? 'border-green-500/40' : 'border-red-500/30'}`}
                                                >
                                                    {imageUrl ? (
                                                        <div className="absolute inset-0">
                                                            <img src={imageUrl} alt={recipeName || 'Receta'} className="h-full w-full object-cover" />
                                                            <div className="absolute inset-0 bg-black/65" />
                                                        </div>
                                                    ) : (
                                                        <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900" />
                                                    )}

                                                    <div className="relative z-10 p-4 h-full flex flex-col">
                                                        <div className="flex items-start justify-between gap-3 mb-3">
                                                            <h4 className="font-bold text-lg text-white leading-tight">{recipeName}</h4>
                                                            {isResolved && (
                                                                <Badge className="bg-green-500/20 text-green-300 border-green-500/30 gap-1 px-2 py-0.5 text-xs shrink-0">
                                                                    <Check className="w-3 h-3" /> Resuelto
                                                                </Badge>
                                                            )}
                                                        </div>

                                                        {!isResolved ? (
                                                            <div className="space-y-2 flex-1">
                                                                {conflicts.map((conflict, idx) => (
                                                                    <div key={`${recipe.id}-${idx}`} className="bg-red-950/45 border border-red-500/30 rounded px-3 py-2">
                                                                        <div className="flex items-center gap-2 text-red-200 font-medium text-sm">
                                                                            <AlertTriangle className="w-3.5 h-3.5" />
                                                                            <span>{conflict.name}</span>
                                                                        </div>
                                                                        <p className="text-red-100/80 text-xs mt-1 pl-5">
                                                                            {conflict.foods.length > 0 ? conflict.foods.join(', ') : 'Ingrediente no identificado'}
                                                                        </p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <p className="text-sm text-green-300/90 mt-1">Conflictos gestionados correctamente.</p>
                                                        )}

                                                        {!isResolved && (
                                                            <div className="mt-4">
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => handleEditRecipe(recipe)}
                                                                    className="border-orange-400/60 bg-orange-900/25 text-orange-200 hover:bg-orange-900/45 hover:text-orange-100"
                                                                >
                                                                    <Edit className="w-4 h-4 mr-2" />
                                                                    Editar receta
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </article>
                                            );
                                        })}
                                    </div>
                                </section>
                            ))}

                            <AnimatePresence mode="wait">
                                {recipeConflictsByMeal.length === 0 && (
                                    <motion.div
                                        key="conflicts-resolved"
                                        initial={{ opacity: 0, y: 12, scale: 0.98 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -8, scale: 0.98 }}
                                        transition={{ duration: 0.35, ease: 'easeOut' }}
                                        className="relative overflow-hidden rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-950/60 via-slate-900/80 to-slate-900/90 p-7"
                                    >
                                        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_55%)]" />
                                        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
                                            <div className="flex items-start gap-3">
                                                <motion.div
                                                    animate={{ scale: [1, 1.08, 1], rotate: [0, 6, -4, 0] }}
                                                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                                                    className="mt-0.5 rounded-xl border border-emerald-400/35 bg-emerald-500/10 p-2.5 text-emerald-300"
                                                >
                                                    <Sparkles className="w-5 h-5" />
                                                </motion.div>
                                                <div>
                                                    <motion.h4
                                                        className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-green-200 to-teal-200"
                                                        animate={{ opacity: [0.8, 1, 0.8] }}
                                                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                                                    >
                                                        Conflictos resueltos con éxito
                                                    </motion.h4>
                                                    <p className="mt-1 text-sm text-slate-300/90">
                                                        Todo está listo para generar la dieta. Ya puedes continuar con la asignación final.
                                                    </p>
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={handleConfirm}
                                                className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-emerald-200 text-sm font-medium hover:bg-emerald-500/20 transition-colors"
                                            >
                                                Listo para asignar
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    <DialogFooter className="border-t border-slate-800/80 px-6 py-4">
                        <div className="flex items-center justify-between w-full">
                             <p className="text-sm text-gray-400">
                                {remainingRecipesCount > 0 
                                    ? `Quedan ${remainingRecipesCount} recetas con conflictos por resolver.`
                                    : "Todos los conflictos han sido revisados."}
                             </p>
                             <div className="flex gap-2">
                                <Button variant="ghost" className="hover:bg-blue-900/20 hover:text-blue-100" onClick={() => onOpenChange(false)}>
                                    Volver al onboarding
                                </Button>
                                <Button
                                    onClick={handleConfirm}
                                    disabled={remainingRecipesCount > 0}
                                    variant="outline"
                                    className="border-gray-500/60 bg-emerald-500/10 hover:text-green-400 text-emerald-300 hover:bg-emerald-500/20 disabled:bg-gray-700 disabled:text-gray-400"
                                >
                                    Listo para Asignar
                                </Button>
                             </div>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AdminRecipeModal 
                open={isRecipeModalOpen}
                onOpenChange={setIsRecipeModalOpen}
                recipeToEdit={editingRecipe}
                onSaveSuccess={handleRecipeSaveSuccess}
                forcedRestrictions={resolvedRestrictions}
                isTemporaryEdit={true}
                isTemplatePlan={true}
            />
        </>
    );
};

export default ConflictResolutionDialog;
