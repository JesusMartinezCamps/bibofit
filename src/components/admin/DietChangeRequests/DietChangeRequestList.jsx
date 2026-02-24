import React, { useState, useMemo, useEffect } from 'react';
import { Loader2, MailQuestion, Inbox, CheckCircle, X, Check, Save, Copy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import DietChangeRequestCard from './DietChangeRequestCard';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { calculateMacros } from '@/lib/macroCalculator';
import { cn } from '@/lib/utils';
import ClientRestrictionsDisplay from '@/components/admin/diet-plans/ClientRestrictionsDisplay';
import MacroVisualizer from '@/components/shared/MacroVisualizer/MacroVisualizer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const IngredientComparison = ({ original, requested, allFoods, clientRestrictions }) => {
    
    const getConflictInfo = (foodId) => {
        const food = allFoods.find(f => f.id === foodId);
        if (!food || !clientRestrictions) {
            return { className: 'bg-green-500/40 text-green-300', message: '' };
        }

        if (clientRestrictions.sensitivities && food.food_sensitivities) {
            for (const clientSens of clientRestrictions.sensitivities) {
                if (food.food_sensitivities.some(fs => fs.sensitivity_id === clientSens.id)) {
                    return { 
                        className: 'bg-orange-600/40 text-orange-300', 
                        message: `Conflicto: ${clientSens.name}` 
                    };
                }
            }
        }
        
        if (clientRestrictions.conditions && food.food_medical_conditions) {
             for (const clientCond of clientRestrictions.conditions) {
                const relation = food.food_medical_conditions.find(fmc => fmc.condition_id === clientCond.id);
                if (relation) {
                    if (relation.relation_type === 'contraindicated') {
                        return { 
                            className: 'bg-red-600/40 text-red-300',
                            message: `Conflicto: ${clientCond.name}`
                        };
                    }
                    if (relation.relation_type === 'recommended') {
                         return { 
                            className: 'bg-green-900/40 text-green-200',
                            message: `Recomendado: ${clientCond.name}`
                        };
                    }
                }
            }
        }
       
        return { className: 'bg-green-500/40 text-green-300', message: '' };
    };

    const originalMap = new Map((original || []).map(ing => [ing.food_id, ing]));
    const requestedMap = new Map((requested || []).map(ing => [ing.food_id, ing]));
    const allFoodIds = new Set([...originalMap.keys(), ...requestedMap.keys()]);

    const comparison = Array.from(allFoodIds).map(foodId => {
        const originalIng = originalMap.get(foodId);
        const requestedIng = requestedMap.get(foodId);
        
        const foodName = originalIng?.food?.name || requestedIng?.food?.name || allFoods.find(f => f.id === foodId)?.name || 'Alimento desconocido';
        
        const originalGrams = originalIng?.grams;
        const requestedGrams = requestedIng?.grams;

        let status = 'unchanged';
        if (originalGrams === undefined) status = 'added';
        else if (requestedGrams === undefined) status = 'removed';
        else if (originalGrams !== requestedGrams) status = 'modified';

        return { food: { food_id: foodId, name: foodName }, originalGrams, requestedGrams, status };
    }).filter(Boolean);

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-center font-semibold text-gray-300">
                <div>Original</div>
                <div>Solicitado</div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    {comparison.map(({ food, originalGrams, status }) => {
                        if (status === 'added') return <div key={`${food.food_id}-orig-placeholder`} className="min-h-[2.5rem] flex items-center"></div>;
                        return (
                            <div key={`${food.food_id}-orig`} className={cn(
                                "p-2 rounded-md text-sm flex justify-between items-center min-h-[2.5rem]",
                                status === 'removed' ? "bg-red-900/40 text-red-400 line-through" : 
                                status === 'modified' ? "bg-purple-600/40 text-purple-300" :
                                "bg-slate-700/50 text-gray-300"
                            )}>
                                <span>{food.name}</span>
                                <span className="font-mono">{originalGrams}g</span>
                            </div>
                        );
                    })}
                </div>
                <div className="space-y-2">
                    {comparison.map(({ food, requestedGrams, status }) => {
                        if (status === 'removed') return <div key={`${food.food_id}-req-placeholder`} className="min-h-[2.5rem] flex items-center"></div>;
                        
                        const conflictInfo = status === 'added' ? getConflictInfo(food.food_id) : { className: '', message: '' };

                        return (
                            <div key={`${food.food_id}-req`} className={cn(
                                "p-2 rounded-md text-sm flex justify-between items-center min-h-[2.5rem]",
                                status === 'added' ? conflictInfo.className :
                                status === 'modified' ? "bg-purple-600/40 text-purple-300" :
                                "bg-slate-700/50 text-gray-300"
                            )}>
                                <div className="flex flex-col">
                                    <span>{food.name}</span>
                                    {conflictInfo.message && (
                                        <span className="text-xs opacity-80">{conflictInfo.message}</span>
                                    )}
                                </div>
                                <span className="font-mono">{requestedGrams}g</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};


const ReviewModal = ({ request, allFoods, clientRestrictions, open, onOpenChange, onAction }) => {
  const [recipeName, setRecipeName] = useState('');

  useEffect(() => {
    if (request?.requested_changes_recipe) {
      setRecipeName(request.requested_changes_recipe.name || '');
    }
  }, [request]);

   const originalIngredientsWithDetails = useMemo(() => {
    if (!request) return [];
    const source = request.private_recipe_id ? request.private_recipe : request.diet_plan_recipe;
    if (!source) return [];

    let ingredients = [];
    if (request.private_recipe_id) { // original is private
         ingredients = source.private_recipe_ingredients || [];
    } else if (source.is_customized) { // original is customized diet plan recipe
         ingredients = source.custom_ingredients || [];
    } else { // original is base recipe from plan
         ingredients = source.recipe?.recipe_ingredients || [];
    }

    return ingredients.map(ing => {
        const foodDetails = allFoods.find(f => f.id === ing.food_id);
        return { ...ing, food: foodDetails, quantity: ing.grams, grams: ing.grams };
    });
}, [request, allFoods]);

const requestedIngredientsWithDetails = useMemo(() => {
    if (!request?.requested_changes_recipe?.private_recipe_ingredients) return [];
    return request.requested_changes_recipe.private_recipe_ingredients.map(ing => {
        const foodDetails = allFoods.find(f => f.id === ing.food_id);
        return { ...ing, food: foodDetails, quantity: ing.grams, grams: ing.grams };
    });
}, [request, allFoods]);
  
  const originalMacros = useMemo(() => calculateMacros(originalIngredientsWithDetails, allFoods), [originalIngredientsWithDetails, allFoods]);
  const requestedMacros = useMemo(() => calculateMacros(requestedIngredientsWithDetails, allFoods), [requestedIngredientsWithDetails, allFoods]);

  if (!request) return null;
  
  const isDuplicateRequest = request.request_type === 'duplicate';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gradient-to-br from-[#1a1e23] to-[#101418] border-gray-700 text-white max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-2xl text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
            Revisar Solicitud de {isDuplicateRequest ? 'Duplicado' : 'Reemplazo'}
          </DialogTitle>
          <DialogDescription>Cliente: {request.profile.full_name}</DialogDescription>
        </DialogHeader>
        <div className="flex-grow overflow-y-auto pr-4 styled-scrollbar-green space-y-6">
          <div>
            <h3 className="font-semibold text-xl text-blue-400 border-b border-blue-800 pb-2 mb-4">Macros Originales</h3>
            <MacroVisualizer 
                currentTarget={originalMacros} 
                actual={originalMacros} 
                loading={false} 
            />
          </div>
          
          <div>
            <h3 className="font-semibold text-xl text-green-400 border-b border-green-800 pb-2 mb-4">Macros Solicitados</h3>
            <MacroVisualizer 
                currentTarget={requestedMacros} 
                actual={requestedMacros} 
                loading={false} 
            />
          </div>
          
          <div>
            <h3 className="font-semibold text-xl text-orange-400 border-b border-orange-800 pb-2 mb-4">Restricciones del Cliente</h3>
            <ClientRestrictionsDisplay restrictions={clientRestrictions} />
          </div>

          <div>
              <h3 className="font-semibold text-xl text-purple-400 border-b border-purple-800 pb-2 mb-4">Comparativa de Ingredientes</h3>
              <IngredientComparison 
                  original={originalIngredientsWithDetails}
                  requested={requestedIngredientsWithDetails}
                  allFoods={allFoods}
                  clientRestrictions={clientRestrictions}
              />
          </div>

          <div>
            <h3 className="font-semibold text-xl text-yellow-400 border-b border-yellow-800 pb-4 mb-4">Nombre de la Receta</h3>
            <div className="px-1">
              <Label htmlFor="recipeName">Nombre final de la receta</Label>
              <Input
                id="recipeName"
                value={recipeName}
                onChange={(e) => setRecipeName(e.target.value)}
                className="mt-2 mb-2"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="mt-6 gap-2 flex-shrink-0 flex-col sm:flex-row">
          <Button variant="destructive" onClick={() => onAction(request, 'rejected', null, recipeName)}>
            <X className="mr-2 h-4 w-4" /> Rechazar
          </Button>
          <div className="flex-grow" />
          <Button variant="outline" onClick={() => onAction(request, 'approved', 'save_copy', recipeName)} className="border-violet-700 bg-violet-600 hover:text-violet-100 hover:bg-violet-700">
              <Copy className="mr-2 h-4 w-4" /> Aceptar y Guardar Copia
          </Button>
          <Button onClick={() => onAction(request, 'approved', 'replace', recipeName)} className="bg-green-600 hover:bg-green-700 hover:text-green-100">
            <Save className="mr-2 h-4 w-4" /> Aceptar y Reemplazar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const DietChangeRequestList = ({ 
  userChangeRequests, 
  loadingRequests, 
  selectedUser, 
  activeTab, 
  onActionComplete,
  allFoods,
  clientRestrictions,
}) => {
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const { toast } = useToast();

  const handleReview = (request) => {
    setSelectedRequest(request);
    setModalOpen(true);
  };

  const handleAction = async (request, status, approvalType, finalRecipeName) => {
    try {
        const requestedRecipe = request.requested_changes_recipe;

        if (status === 'rejected') {
            if (requestedRecipe) {
                await supabase.from('private_recipe_ingredients').delete().eq('private_recipe_id', requestedRecipe.id);
                await supabase.from('private_recipes').delete().eq('id', requestedRecipe.id);
            }
        } else if (status === 'approved') {
            if (!requestedRecipe) throw new Error("No se encontró la receta con los cambios solicitados.");

            if (approvalType === 'replace') {
                // 1. Rename the temporary recipe to become the new permanent private recipe
                const { error: renameError } = await supabase.from('private_recipes').update({ name: finalRecipeName }).eq('id', requestedRecipe.id);
                if (renameError) throw renameError;
                const newPrivateRecipeId = requestedRecipe.id;

                // 2. Find all meal logs for the original recipe and UPDATE them (MIGRATE)
                // This ensures "times_eaten" count is preserved on the new recipe.
                let mealLogsQuery = supabase.from('daily_meal_logs').update({
                    private_recipe_id: newPrivateRecipeId,
                    diet_plan_recipe_id: null
                });

                if (request.private_recipe_id) {
                    mealLogsQuery = mealLogsQuery.eq('private_recipe_id', request.private_recipe_id);
                } else if (request.diet_plan_recipe_id) {
                    mealLogsQuery = mealLogsQuery.eq('diet_plan_recipe_id', request.diet_plan_recipe_id);
                }
                
                const { error: logsError } = await mealLogsQuery;
                if (logsError) throw logsError;

                // 3. Update planned_meals to point to the new recipe (instead of deleting)
                // This prevents gaps in the schedule.
                let plannedMealsUpdateQuery = supabase.from('planned_meals').update({
                    private_recipe_id: newPrivateRecipeId,
                    diet_plan_recipe_id: null
                });
                
                if (request.private_recipe_id) {
                    plannedMealsUpdateQuery = plannedMealsUpdateQuery.eq('private_recipe_id', request.private_recipe_id);
                } else if (request.diet_plan_recipe_id) {
                    plannedMealsUpdateQuery = plannedMealsUpdateQuery.eq('diet_plan_recipe_id', request.diet_plan_recipe_id);
                }
                
                const { error: updatePlannedError } = await plannedMealsUpdateQuery;
                if (updatePlannedError) console.warn("Could not update planned_meals:", updatePlannedError.message);


            } else if (approvalType === 'save_copy') {
                // "Save Copy" means we keep the original (and its logs/history) and create a new one.
                // The new one (requestedRecipe) is already created as a separate entity, so it starts with 0 logs.
                // We DO NOT migrate logs here.

                const originalRecipeName = request.private_recipe_id
                    ? request.private_recipe.name
                    : (request.diet_plan_recipe.custom_name || request.diet_plan_recipe.recipe.name);
                
                const newRecipeName = finalRecipeName === originalRecipeName
                    ? `* ${finalRecipeName}`
                    : finalRecipeName;

                // Rename the temporary recipe
                const { error: renameError } = await supabase.from('private_recipes').update({ name: newRecipeName }).eq('id', requestedRecipe.id);
                if (renameError) throw renameError;

                // Add the new private recipe to the plan (at the same slot as the original to make it visible)
                const originalRecipe = request.diet_plan_recipe || request.private_recipe;
                const planId = originalRecipe.diet_plan_id;
                const dayMealId = originalRecipe.day_meal_id;
                
                if (planId && dayMealId) {
                    // Fix: Use maybeSingle() to handle case where no planned meal exists (e.g. 0 rows) gracefully
                     const { data: plannedMeal, error: plannedMealError } = await supabase.from('planned_meals')
                        .select('plan_date')
                        .eq('user_id', request.user_id)
                        .eq(request.diet_plan_recipe_id ? 'diet_plan_recipe_id' : 'private_recipe_id', originalRecipe.id)
                        .limit(1)
                        .maybeSingle();

                    if (plannedMeal) {
                         await supabase.from('planned_meals').insert({
                            user_id: request.user_id,
                            diet_plan_id: planId,
                            private_recipe_id: requestedRecipe.id,
                            day_meal_id: dayMealId,
                            plan_date: plannedMeal.plan_date,
                        });
                    }
                }
            }
        }

        const { error: updateStatusError } = await supabase
            .from('diet_change_requests')
            .update({ status: status, admin_comment: approvalType || '' })
            .eq('id', request.id);

        if (updateStatusError) throw updateStatusError;

        const recipeName = request.diet_plan_recipe?.custom_name || request.diet_plan_recipe?.recipe?.name || request.private_recipe?.name || 'Receta sin nombre';
        const toastMessage = `Solicitud para ${recipeName}: ${status === 'approved' ? 'Aceptada' : 'Rechazada'}`;

        toast({
            title: 'Solicitud Procesada',
            description: toastMessage,
            variant: 'default',
        });
        
        // IMPORTANT: Close modal immediately after success
        setModalOpen(false);
        setSelectedRequest(null);

        // Safely call the refresh callback
        if (onActionComplete) {
            try {
                await onActionComplete();
            } catch (error) {
                console.error("Error updating list (onActionComplete failed):", error);
            }
        }

    } catch (error) {
        toast({ title: 'Error', description: `No se pudo procesar la solicitud: ${error.message}`, variant: 'destructive' });
    }
  };

  const getTitle = () => {
    switch (activeTab) {
      case 'pending': return 'Solicitudes Pendientes';
      case 'approved': return 'Solicitudes Aprobadas';
      case 'rejected': return 'Solicitudes Rechazadas';
      default: return 'Solicitudes de Cambio de Dieta';
    }
  };

  const getDescription = () => {
    if (!selectedUser) return 'Selecciona un usuario para ver sus solicitudes de cambio de dieta';
    switch (activeTab) {
      case 'pending': return `Mostrando solicitudes pendientes de ${selectedUser.full_name}`;
      case 'approved': return `Mostrando solicitudes aprobadas de ${selectedUser.full_name}`;
      case 'rejected': return `Mostrando solicitudes rechazadas de ${selectedUser.full_name}`;
      default: return '';
    }
  };

  const getEmptyMessage = () => {
    switch (activeTab) {
      case 'pending': return 'Este usuario no tiene solicitudes pendientes.';
      case 'approved': return 'Este usuario no tiene solicitudes aprobadas.';
      case 'rejected': return 'Este usuario no tiene solicitudes rechazadas.';
      default: return 'No hay solicitudes para este usuario.';
    }
  };

  return (
    <>
      <Card className="md:col-span-2 bg-[#1a1e23] border-gray-700 text-white">
        <CardHeader>
          <CardTitle className="flex items-center">
            <MailQuestion className="mr-2" /> {getTitle()}
          </CardTitle>
          <CardDescription>{getDescription()}</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingRequests ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin h-8 w-8 text-[#5ebe7d]" />
            </div>
          ) : !selectedUser ? (
            <div className="text-center py-12 text-gray-400">
              <Inbox className="mx-auto h-12 w-12" />
              <p>Selecciona un usuario de la lista</p>
            </div>
          ) : userChangeRequests.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
              <p>{getEmptyMessage()}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {userChangeRequests.map(request => (
                <DietChangeRequestCard 
                  key={request.id} 
                  request={request} 
                  onReview={handleReview}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ReviewModal
        request={selectedRequest}
        allFoods={allFoods}
        clientRestrictions={clientRestrictions}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onAction={handleAction}
      />
    </>
  );
};

export default DietChangeRequestList;