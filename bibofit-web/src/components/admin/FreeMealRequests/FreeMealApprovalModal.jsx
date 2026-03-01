import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import {
  Loader2,
  BookTemplate,
  CheckCircle,
  AlertTriangle,
  UtensilsCrossed,
  XCircle,
  PlusCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import RecipeView from '@/components/shared/RecipeView';
import IngredientSearch from '@/components/plans/IngredientSearch';
import { calculateMacros } from '@/lib/macroCalculator';

const normalizeKnownIngredient = (ingredient, foods = []) => {
  const food = foods.find((f) => String(f.id) === String(ingredient.food_id)) || ingredient.food;
  if (!food) return null;

  const grams = ingredient.grams ?? ingredient.quantity ?? '';

  return {
    local_id: String(ingredient.local_id || ingredient.id || crypto.randomUUID()),
    food_id: String(food.id),
    grams,
    quantity: grams,
    food_group_id: food.food_to_food_groups?.[0]?.food_group_id || ingredient.food_group_id || null,
    food,
    is_free: false,
  };
};

const FreeMealApprovalModal = ({ freeMeal, isOpen, onOpenChange, onAction }) => {
  const [formData, setFormData] = useState({
    name: '',
    prep_time_min: 15,
    difficulty: 'Fácil',
    instructions: '',
  });
  const [ingredients, setIngredients] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearchingIngredient, setIsSearchingIngredient] = useState(false);

  const [availableFoods, setAvailableFoods] = useState([]);
  const [allVitamins, setAllVitamins] = useState([]);
  const [allMinerals, setAllMinerals] = useState([]);
  const [allFoodGroups, setAllFoodGroups] = useState([]);

  const [planRestrictions, setPlanRestrictions] = useState({
    sensitivities: [],
    conditions: [],
    preferredFoods: [],
    nonPreferredFoods: [],
    allMedicalConditions: [],
    allSensitivities: [],
  });

  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const fetchPrerequisites = useCallback(async () => {
    if (!freeMeal || !isOpen) return;

    setIsLoading(true);
    try {
      const userId = freeMeal.user_id;
      const [foodsRes, profileRes, sensitivitiesRes, conditionsRes, preferredRes, nonPreferredRes, vitaminsRes, mineralsRes, foodGroupsRes] =
        await Promise.all([
          supabase
            .from('food')
            .select('*, food_sensitivities(*, sensitivities(name)), food_medical_conditions(*, medical_conditions(name)), food_to_food_groups(food_group_id), food_vitamins(vitamin_id), food_minerals(mineral_id)'),
          supabase
            .from('profiles')
            .select('user_sensitivities(sensitivity_id), user_medical_conditions(condition_id)')
            .eq('user_id', userId)
            .single(),
          supabase.from('sensitivities').select('id, name'),
          supabase.from('medical_conditions').select('id, name'),
          supabase.from('preferred_foods').select('food_id').eq('user_id', userId),
          supabase.from('non_preferred_foods').select('food_id').eq('user_id', userId),
          supabase.from('vitamins').select('id, name'),
          supabase.from('minerals').select('id, name'),
          supabase.from('food_groups').select('id, name'),
        ]);

      if (foodsRes.error) throw foodsRes.error;
      if (profileRes.error) throw profileRes.error;
      if (sensitivitiesRes.error) throw sensitivitiesRes.error;
      if (conditionsRes.error) throw conditionsRes.error;
      if (preferredRes.error) throw preferredRes.error;
      if (nonPreferredRes.error) throw nonPreferredRes.error;
      if (vitaminsRes.error) throw vitaminsRes.error;
      if (mineralsRes.error) throw mineralsRes.error;
      if (foodGroupsRes.error) throw foodGroupsRes.error;

      setPlanRestrictions({
        sensitivities: profileRes.data.user_sensitivities.map((s) => s.sensitivity_id),
        conditions: profileRes.data.user_medical_conditions.map((c) => c.condition_id),
        preferredFoods: preferredRes.data.map((f) => f.food_id),
        nonPreferredFoods: nonPreferredRes.data.map((f) => f.food_id),
        allMedicalConditions: conditionsRes.data || [],
        allSensitivities: sensitivitiesRes.data || [],
      });

      setAvailableFoods(foodsRes.data || []);
      setAllVitamins(vitaminsRes.data || []);
      setAllMinerals(mineralsRes.data || []);
      setAllFoodGroups(foodGroupsRes.data || []);

      setFormData({
        name: freeMeal.name,
        prep_time_min: freeMeal.prep_time_min || 15,
        difficulty: freeMeal.difficulty || 'Fácil',
        instructions: freeMeal.instructions || '',
      });

      const mappedIngredients = (freeMeal.ingredients || []).map((ing) => {
        const foodDetails = foodsRes.data.find((f) => String(f.id) === String(ing.food_id));

        if (!ing.food_id || !foodDetails) {
          return {
            local_id: String(ing.id),
            food_id: ing.food_id ? String(ing.food_id) : `free-${ing.id}`,
            grams: ing.grams,
            quantity: ing.grams,
            food_group_id: String(foodDetails?.food_to_food_groups?.[0]?.food_group_id || ''),
            name: ing.name || foodDetails?.name,
            is_free: true,
            status: ing.status,
          };
        }

        return {
          local_id: String(ing.id),
          food_id: String(ing.food_id),
          grams: ing.grams,
          quantity: ing.grams,
          food_group_id: String(foodDetails?.food_to_food_groups?.[0]?.food_group_id || ''),
          name: foodDetails?.name,
          food: foodDetails,
          is_free: false,
          status: ing.status,
        };
      });

      setIngredients(mappedIngredients);
      setIsSearchingIngredient(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: `No se pudieron cargar los datos: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [freeMeal, isOpen, toast]);

  useEffect(() => {
    fetchPrerequisites();
  }, [fetchPrerequisites]);

  const handleCreateFood = (ingredient) => {
    navigate('/admin/create-food', {
      state: {
        foodToCreate: { name: ingredient.name },
        from: '/admin-panel/content/free-recipe-requests',
      },
    });
  };

  const pendingIngredients = useMemo(
    () => ingredients.filter((ing) => ing.is_free),
    [ingredients]
  );

  const editableIngredients = useMemo(
    () => ingredients.filter((ing) => !ing.is_free),
    [ingredients]
  );

  const conflictingIngredientsData = useMemo(() => {
    const conflicts = [];

    editableIngredients.forEach((ing) => {
      const food = availableFoods.find((f) => String(f.id) === String(ing.food_id));
      if (!food) return;

      const conditionConflict = food.food_medical_conditions.find(
        (fmc) =>
          planRestrictions.conditions.includes(fmc.condition_id) &&
          fmc.relation_type === 'contraindicated'
      );

      if (conditionConflict) {
        conflicts.push({
          id: `${food.id}-cond`,
          foodId: food.id,
          foodName: food.name,
          restrictionName: conditionConflict.medical_conditions.name,
          type: 'condition_avoid',
          isPathology: true,
        });
      }

      const sensitivityConflict = food.food_sensitivities.find((fs) =>
        planRestrictions.sensitivities.includes(fs.sensitivity_id)
      );

      if (sensitivityConflict) {
        conflicts.push({
          id: `${food.id}-sens`,
          foodId: food.id,
          foodName: food.name,
          restrictionName: sensitivityConflict.sensitivities.name,
          type: 'sensitivity',
          isPathology: false,
        });
      }
    });

    return conflicts;
  }, [editableIngredients, availableFoods, planRestrictions]);

  const macros = useMemo(() => {
    if (!editableIngredients.length || !availableFoods.length) {
      return { calories: 0, proteins: 0, carbs: 0, fats: 0 };
    }
    return calculateMacros(editableIngredients, availableFoods);
  }, [editableIngredients, availableFoods]);

  const recipeForView = useMemo(
    () => ({
      ...formData,
      ingredients: editableIngredients,
    }),
    [formData, editableIngredients]
  );

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleIngredientsChange = (newIngredients) => {
    const normalizedKnown = newIngredients
      .map((ing) => normalizeKnownIngredient(ing, availableFoods))
      .filter(Boolean);

    setIngredients((prev) => {
      const pending = prev.filter((ing) => ing.is_free);
      return [...normalizedKnown, ...pending];
    });
  };

  const handleRemoveKnownIngredient = (ingredientToRemove) => {
    const ingredientId = ingredientToRemove.local_id || ingredientToRemove.id;
    setIngredients((prev) =>
      prev.filter((ing) => String(ing.local_id || ing.id) !== String(ingredientId))
    );
  };

  const handleIngredientAdded = (newIngredientData) => {
    const selectedFood = availableFoods.find(
      (food) => String(food.id) === String(newIngredientData.food_id)
    );
    if (!selectedFood) return;

    const defaultQuantity = selectedFood.food_unit === 'unidades' ? 1 : 100;
    const quantity = newIngredientData.quantity || defaultQuantity;

    const ingredientToAdd = {
      local_id: String(crypto.randomUUID()),
      food_id: String(selectedFood.id),
      grams: quantity,
      quantity,
      food_group_id: selectedFood.food_to_food_groups?.[0]?.food_group_id || null,
      food: selectedFood,
      is_free: false,
    };

    setIngredients((prev) => [...prev, ingredientToAdd]);
    setIsSearchingIngredient(false);
  };

  const handleActionClick = async (type) => {
    setIsLoading(true);
    try {
      const hasPendingIngredients = ingredients.some((ing) => ing.is_free);

      if (hasPendingIngredients && (type === 'approve_private' || type === 'approve_general')) {
        toast({
          title: 'Accion Requerida',
          description:
            'Debes crear o enlazar todos los ingredientes libres antes de aprobar la receta.',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      const dataToSave = {
        name: formData.name,
        instructions: formData.instructions,
        prep_time_min: formData.prep_time_min,
        difficulty: formData.difficulty,
        userId: freeMeal.user_id,
        ingredients: ingredients.map((i) => ({
          food_id: i.food_id,
          grams: i.grams ?? i.quantity,
          food_group_id: i.food_group_id,
        })),
      };

      await onAction(type, freeMeal, dataToSave);
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: `No se pudo completar la accion: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!freeMeal) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1a1e23] border-gray-700 text-white w-[95vw] max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Revisar y Gestionar Receta Libre</DialogTitle>
          <DialogDescription>
            Modifica los detalles si es necesario y cambia el estado de la solicitud.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 styled-scrollbar-green space-y-6 py-4">
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-green-500" />
            </div>
          ) : isSearchingIngredient ? (
            <IngredientSearch
              selectedIngredients={editableIngredients}
              availableFoods={availableFoods}
              userRestrictions={{
                sensitivities: [],
                medical_conditions: [],
                individual_food_restrictions: [],
                preferred_foods: [],
                non_preferred_foods: [],
              }}
              onBack={() => setIsSearchingIngredient(false)}
              onIngredientAdded={handleIngredientAdded}
              createFoodUserId={freeMeal?.user_id || user?.id}
            />
          ) : (
            <>
              {pendingIngredients.length > 0 && (
                <div className="p-4 border border-purple-500/30 rounded-lg bg-purple-500/10">
                  <h5 className="text-sm font-semibold text-purple-300 mb-3">
                    Ingredientes Libres Pendientes
                  </h5>
                  <div className="space-y-2">
                    {pendingIngredients.map((ing) => (
                      <div
                        key={ing.local_id}
                        className="flex items-center justify-between bg-gray-800/50 p-2 rounded-md"
                      >
                        <span className="text-purple-300 font-medium">{ing.name}</span>
                        <Button
                          size="sm"
                          onClick={() => handleCreateFood(ing)}
                          className="bg-purple-600 hover:bg-purple-700"
                        >
                          <PlusCircle className="w-4 h-4 mr-2" /> Crear Alimento
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {conflictingIngredientsData.length > 0 && (
                <div className="p-4 border border-orange-500/30 rounded-lg bg-orange-500/10">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-5 h-5 text-orange-400" />
                    <h5 className="text-sm font-semibold text-orange-300">
                      Conflicto de Restricciones Detectado
                    </h5>
                  </div>
                  <ul className="space-y-1 text-sm text-orange-200/90 list-disc list-inside">
                    {conflictingIngredientsData.map((conflict) => (
                      <li key={conflict.id}>
                        <span className="font-semibold">{conflict.foodName}</span>: Conflicto con{' '}
                        <span className="font-semibold">{conflict.restrictionName}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <RecipeView
                recipe={recipeForView}
                allFoods={availableFoods}
                allVitamins={allVitamins}
                allMinerals={allMinerals}
                allFoodGroups={allFoodGroups}
                macros={macros}
                isEditing={true}
                onFormChange={handleFormChange}
                onIngredientsChange={handleIngredientsChange}
                onRemoveIngredient={handleRemoveKnownIngredient}
                onAddIngredientClick={() => setIsSearchingIngredient(true)}
                disableAutoBalance={true}
                conflicts={conflictingIngredientsData.map((c) => ({
                  foodId: c.foodId,
                  type: c.type,
                  restrictionName: c.restrictionName,
                }))}
              />
            </>
          )}
        </div>

        {!isLoading && (
          <DialogFooter className="!flex-col sm:!flex-col md:!flex-row gap-2 mt-4">
            <Button
              variant="destructive"
              onClick={() => handleActionClick('reject')}
              disabled={isLoading}
              className="bg-gradient-to-br from-red-600/50 to-red-900/50 hover:from-red-600/60 hover:to-red-900/60"
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="mr-2 h-4 w-4" />
              )}
              Rechazar
            </Button>

            <Button
              variant="ghost"
              onClick={() => handleActionClick('keep_as_free_recipe')}
              disabled={isLoading}
              className="text-white bg-gradient-to-br from-[hsl(121.85deg_65%_49%_/_58%)] to-[hsl(211,51.05%,50.44%)] hover:opacity-90"
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UtensilsCrossed className="mr-2 h-4 w-4" />
              )}
              Dejar como Receta Libre
            </Button>

            <div className="flex-grow" />

            <Button
              className="bg-gradient-to-br from-violet-700/50 to-blue-900/50 text-white hover:from-violet-700/60 hover:to-blue-900/60"
              onClick={() => handleActionClick('approve_private')}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              Guardar como Receta Privada
            </Button>

            {isAdmin && (
              <Button
                className="bg-gradient-to-br from-emerald-400/50 to-teal-700/50 text-white hover:from-emerald-400/60 hover:to-teal-700/60"
                onClick={() => handleActionClick('approve_general')}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <BookTemplate className="mr-2 h-4 w-4" />
                )}
                Guardar como Plantilla
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default FreeMealApprovalModal;
