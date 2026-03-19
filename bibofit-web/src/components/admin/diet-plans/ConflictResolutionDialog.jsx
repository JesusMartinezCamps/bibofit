import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, Edit, Check, Sparkles, ArrowLeft } from 'lucide-react';
import AdminRecipeModal from '@/components/admin/recipes/AdminRecipeModal';
import { getConflictInfo } from '@/lib/restrictionChecker';
import { motion, AnimatePresence } from 'framer-motion';

const ConflictResolutionDialog = ({ open, onOpenChange, conflicts, onRecipeUpdate, onResolveComplete, clientRestrictions, planRestrictions, targetUserId = null }) => {
    const [editingRecipe, setEditingRecipe] = useState(null);
    const [resolvedRecipes, setResolvedRecipes] = useState(new Set());
    const criticalConflictTypes = useMemo(
        () => new Set(['condition_avoid', 'sensitivity', 'individual_restriction', 'non-preferred', 'diet_type_excluded']),
        []
    );
    useEffect(() => {
        if (!open) return;
        setResolvedRecipes(new Set());
        setEditingRecipe(null);
    }, [open]);

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
    const getIngredientIdentity = (ingredient) => String(ingredient?.local_id ?? ingredient?.id ?? '');

    const buildSubstitutionMapFromEdition = (originalRecipe, updatedRecipe, restrictions) => {
        const originalIngredients = getIngredientsFromRecipe(originalRecipe);
        const updatedIngredients = getIngredientsFromRecipe(updatedRecipe);
        const substitutions = new Map();
        const blockedSourceIds = new Set();

        if (!Array.isArray(originalIngredients) || !Array.isArray(updatedIngredients)) {
            return substitutions;
        }

        const updatedIngredientsByIdentity = new Map();
        updatedIngredients.forEach((ing) => {
            const identity = getIngredientIdentity(ing);
            if (!identity) return;
            updatedIngredientsByIdentity.set(identity, ing);
        });

        originalIngredients.forEach((beforeIngredient) => {
            const sourceFoodId = getFoodId(beforeIngredient);
            if (!sourceFoodId || blockedSourceIds.has(sourceFoodId)) return;

            const sourceFood = beforeIngredient?.food;
            if (!sourceFood) return;

            const sourceConflict = getConflictInfo(sourceFood, restrictions);
            if (!sourceConflict || !criticalConflictTypes.has(sourceConflict.type)) {
                return;
            }

            const identity = getIngredientIdentity(beforeIngredient);
            if (!identity) return;

            // If ingredient was removed, do not propagate deletions to other recipes.
            const afterIngredient = updatedIngredientsByIdentity.get(identity);
            if (!afterIngredient) return;

            const targetFoodId = getFoodId(afterIngredient);
            if (!targetFoodId || targetFoodId === sourceFoodId) return;

            const targetFood = afterIngredient?.food;
            if (!targetFood) return;

            const targetConflict = getConflictInfo(targetFood, restrictions);
            if (targetConflict && criticalConflictTypes.has(targetConflict.type)) {
                return;
            }

            const existing = substitutions.get(sourceFoodId);
            if (existing && String(existing.food_id) !== String(targetFood.id)) {
                substitutions.delete(sourceFoodId);
                blockedSourceIds.add(sourceFoodId);
                return;
            }

            substitutions.set(sourceFoodId, { food_id: targetFood.id, food: targetFood });
        });

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
        preferred_foods: planRestrictions?.preferred_foods || clientRestrictions?.preferred_foods || [],
        non_preferred_foods: planRestrictions?.non_preferred_foods || clientRestrictions?.non_preferred_foods || [],
        diet_type_id: planRestrictions?.diet_type_id ?? clientRestrictions?.diet_type_id ?? null,
        diet_type_name: planRestrictions?.diet_type_name ?? clientRestrictions?.diet_type_name ?? null,
        diet_type_rules: planRestrictions?.diet_type_rules || clientRestrictions?.diet_type_rules || []
    }), [clientRestrictions, planRestrictions]);

    const handleEditRecipe = (recipe) => {
        setEditingRecipe(recipe);
    };

    const handleRecipeSaveSuccess = (updatedRecipe) => {
        const originalEditedItem = recipeConflictsByMeal
            .flatMap((section) => section.items)
            .find((item) => Number(item.recipe?.id) === Number(updatedRecipe?.id));
        const substitutionMap = buildSubstitutionMapFromEdition(
            originalEditedItem?.recipe,
            updatedRecipe,
            resolvedRestrictions
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
                    className="bg-[#0f1115] pb-0 pr-0 pl-1 text-white w-screen !max-w-none h-[100dvh] !max-h-none rounded-none border-0 flex flex-col overflow-hidden [&>button]:hidden"
                    onEscapeKeyDown={(event) => event.preventDefault()}
                    onInteractOutside={(event) => event.preventDefault()}
                >
                    <DialogHeader className="border-b border-border/80 px-6 py-5">
                        <DialogTitle className={`flex items-center gap-2 ${allConflictsResolved ? 'text-emerald-400' : 'text-orange-400'}`}>
                            {allConflictsResolved ? <CheckCircle className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
                            Conflictos de Restricciones Detectados
                        </DialogTitle>
                        <DialogDescription>
                            Revisa las siguientes Recetas para eliminar alimentos en conflicto.
                        </DialogDescription>
                    </DialogHeader>

                    <div className={editingRecipe ? 'flex-1 overflow-y-auto p-0 sm:p-6' : 'flex-1 overflow-y-auto p-6'}>
                        {editingRecipe ? (
                            <div className="h-full flex flex-col gap-4">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-fit text-white hover:bg-white/10"
                                    onClick={() => setEditingRecipe(null)}
                                >
                                    <ArrowLeft className="w-4 h-2 mr-2" />
                                    Volver a conflictos
                                </Button>
                                <div className="flex-1 min-h-0">
                                    <AdminRecipeModal
                                        asPage={true}
                                        open={Boolean(editingRecipe)}
                                        onOpenChange={(editorOpen) => {
                                            if (!editorOpen) setEditingRecipe(null);
                                        }}
                                        recipeToEdit={editingRecipe}
                                        onSaveSuccess={handleRecipeSaveSuccess}
                                        forcedRestrictions={resolvedRestrictions}
                                        isTemporaryEdit={true}
                                        isTemplatePlan={true}
                                        userId={targetUserId}
                                        isConflictCorrectionMode={true}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-8">
                                {recipeConflictsByMeal.map((section) => (
                                    <section key={`${section.mealOrder}-${section.mealName}`} className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-200">{section.mealName}</h3>
                                            <Badge variant="outline" className="border-input text-muted-foreground bg-card/80">
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
                                                                        <div key={`${recipe.id}-${idx}`} className="bg-slate-900/50 border border-red-500/30 rounded px-3 py-2">
                                                                            <div className="flex items-center gap-2 text-red-600 font-medium text-sm">
                                                                                <AlertTriangle className=" w-3.5 h-3.5" />
                                                                                <span>{conflict.name}</span>
                                                                            </div>
                                                                            <p className="text-red-600/90 text-xs mt-1 pl-5">
                                                                                {conflict.foods.length > 0 ? conflict.foods.join(', ') : 'Ingrediente no identificado'}
                                                                            </p>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <p className="text-sm text-green-400/90 mt-1">Conflictos gestionados correctamente.</p>
                                                            )}

                                                            {!isResolved && (
                                                                <div className="mt-4">
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        onClick={() => handleEditRecipe(recipe)}
                                                                        className="border-orange-400/60 bg-orange-400/20 dark:text-orange-400 text-orange-600 hover:bg-orange-700/45 hover:text-orange-100"
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
                                            className="relative overflow-hidden rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-600/80 to-emerald-600/90 dark:from-emerald-950/60 dark:via-slate-900/80 dark:to-slate-900/90 p-7"
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
                                                        <p className="mt-1 text-sm text-muted-foreground/90">
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
                        )}
                    </div>

                    {!editingRecipe && (
                        <DialogFooter className="border-t border-border/80 px-6 py-4">
                            <div className="flex items-center justify-between w-full">
                                 <p className="text-sm text-muted-foreground">
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
                                        className="border-gray-500/60 bg-emerald-500/10 hover:text-green-400 text-emerald-300 hover:bg-emerald-500/20 disabled:bg-muted disabled:text-muted-foreground"
                                    >
                                        Listo para Asignar
                                    </Button>
                                 </div>
                            </div>
                        </DialogFooter>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
};

export default ConflictResolutionDialog;
