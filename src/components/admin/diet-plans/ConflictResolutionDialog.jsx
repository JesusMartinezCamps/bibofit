import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, CheckCircle, Edit, Check } from 'lucide-react';
import AdminRecipeModal from '@/components/admin/recipes/AdminRecipeModal';
import { getConflictInfo } from '@/lib/restrictionChecker';

const ConflictResolutionDialog = ({ open, onOpenChange, conflicts, onRecipeUpdate, onResolveComplete, clientRestrictions, planRestrictions }) => {
    const [editingRecipe, setEditingRecipe] = useState(null);
    const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
    const [resolvedRecipes, setResolvedRecipes] = useState(new Set());

    // Flatten conflicts to be recipe-centric instead of type-centric, and resolve specific foods
    const recipeConflicts = useMemo(() => {
        const recipeMap = new Map();

        // 1. Group by Recipe ID
        Object.entries(conflicts).forEach(([restrictionName, recipes]) => {
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
        return Array.from(recipeMap.values()).map(({ recipe, conflictNames }) => {
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
                    if (info && info.reason === restrictionName) {
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
                conflicts: detailedConflicts
            };
        });
    }, [conflicts, clientRestrictions]);

    const remainingRecipesCount = recipeConflicts.filter(item => !resolvedRecipes.has(item.recipe.id)).length;

  const resolvedRestrictions = useMemo(() => ({
        sensitivities: clientRestrictions?.sensitivities || [],
        medical_conditions: clientRestrictions?.conditions || [],
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
        // Critical: Ensure updatedRecipe contains the ingredients list.
        // AdminRecipeModal now returns the FULL updated recipe object including 'ingredients'.
        if (onRecipeUpdate) {
            onRecipeUpdate(updatedRecipe);
        }
        setResolvedRecipes(prev => new Set(prev).add(updatedRecipe.id));
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
                <DialogContent className="bg-[#1a1e23] border-gray-700 text-white max-w-3xl max-h-[80vh] flex flex-col overflow-hidden">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-orange-400">
                            <AlertTriangle className="w-6 h-6" />
                            Conflictos de Restricciones Detectados
                        </DialogTitle>
                        <DialogDescription>
                            Las siguientes recetas contienen ingredientes que entran en conflicto con las restricciones del cliente.
                            Debes editar o confirmar estas recetas para continuar.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto mt-4 pr-2">
                        <div className="space-y-4">
                            {recipeConflicts.map(({ recipe, conflicts }) => {
                                const isResolved = resolvedRecipes.has(recipe.id);
                                return (
                                    <div key={recipe.id} className={`p-4 rounded-lg border transition-colors ${isResolved ? 'bg-green-900/20 border-green-500/30' : 'bg-slate-800 border-gray-700'}`}>
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <h4 className="font-bold text-lg text-white">{recipe.custom_name || recipe.recipe?.name || recipe.name}</h4>
                                                    {isResolved && (
                                                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30 gap-1 px-2 py-0.5 text-xs">
                                                            <Check className="w-3 h-3" /> Resuelto
                                                        </Badge>
                                                    )}
                                                </div>
                                                
                                                {!isResolved && (
                                                    <div className="space-y-3">
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                            {conflicts.map((conflict, idx) => (
                                                                <div key={idx} className="bg-red-950/30 border border-red-500/20 rounded px-3 py-2 flex flex-col justify-center">
                                                                    <div className="flex items-center gap-2 text-red-300 font-medium text-sm mb-1">
                                                                         <AlertTriangle className="w-3.5 h-3.5" />
                                                                         {conflict.name}
                                                                    </div>
                                                                    {conflict.foods.length > 0 ? (
                                                                        <div className="text-red-200/60 text-xs pl-5 leading-tight">
                                                                            {conflict.foods.join(', ')}
                                                                        </div>
                                                                    ) : (
                                                                         <div className="text-red-200/40 text-[10px] pl-5 italic">
                                                                            Ingrediente no identificado
                                                                         </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {isResolved && <p className="text-sm text-green-400/80 mt-1">Conflictos gestionados correctamente.</p>}
                                            </div>

                                            {!isResolved && (
                                                <Button 
                                                    size="sm" 
                                                    variant="outline" 
                                                    onClick={() => handleEditRecipe(recipe)} 
                                                    className="shrink-0 border-orange-500/50 bg-orange-900/20 text-orange-300 hover:bg-orange-900/40 hover:text-orange-200 mt-1"
                                                >
                                                    <Edit className="w-4 h-4 mr-2" />
                                                    Editar Receta
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <DialogFooter className="mt-6 pt-4 border-t border-gray-700">
                        <div className="flex items-center justify-between w-full">
                             <p className="text-sm text-gray-400">
                                {remainingRecipesCount > 0 
                                    ? `Quedan ${remainingRecipesCount} recetas con conflictos por resolver.`
                                    : "Todos los conflictos han sido revisados."}
                             </p>
                             <div className="flex gap-2">
                                <Button variant="ghost" onClick={() => onOpenChange(false)}>
                                    Cerrar
                                </Button>
                                <Button 
                                    onClick={handleConfirm}
                                    disabled={remainingRecipesCount > 0}
                                    className="bg-green-600 hover:bg-green-500 text-white disabled:bg-gray-700 disabled:text-gray-400"
                                >
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Confirmar y Asignar
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