import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, BookTemplate, CheckCircle, AlertTriangle, UtensilsCrossed, XCircle, PlusCircle } from 'lucide-react';
import RecipeForm from '@/components/admin/recipes/RecipeForm';
import IngredientBuilder from '@/components/admin/recipes/IngredientBuilder';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const FreeMealApprovalModal = ({ freeMeal, isOpen, onOpenChange, onAction }) => {
    const [formData, setFormData] = useState({ name: '', prep_time_min: 15, difficulty: 'Fácil', instructions: '' });
    const [ingredients, setIngredients] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [availableFoods, setAvailableFoods] = useState([]);
    const [planRestrictions, setPlanRestrictions] = useState({ sensitivities: [], conditions: [], preferredFoods: [], nonPreferredFoods: [], allMedicalConditions: [], allSensitivities: [] });
    const { toast } = useToast();
    const navigate = useNavigate();
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    const fetchPrerequisites = useCallback(async () => {
        if (!freeMeal || !isOpen) return;
        setIsLoading(true);
        try {
            const userId = freeMeal.user_id;
            const [foodsRes, profileRes, sensitivitiesRes, conditionsRes, preferredRes, nonPreferredRes] = await Promise.all([
                supabase.from('food').select('*, food_sensitivities(*, sensitivities(name)), food_medical_conditions(*, medical_conditions(name)), food_to_food_groups(food_group_id)'),
                supabase.from('profiles').select('user_sensitivities(sensitivity_id), user_medical_conditions(condition_id)').eq('user_id', userId).single(),
                supabase.from('sensitivities').select('id, name'),
                supabase.from('medical_conditions').select('id, name'),
                supabase.from('preferred_foods').select('food_id').eq('user_id', userId),
                supabase.from('non_preferred_foods').select('food_id').eq('user_id', userId),
            ]);

            if (foodsRes.error) throw foodsRes.error;
            if (profileRes.error) throw profileRes.error;
            if (sensitivitiesRes.error) throw sensitivitiesRes.error;
            if (conditionsRes.error) throw conditionsRes.error;
            if (preferredRes.error) throw preferredRes.error;
            if (nonPreferredRes.error) throw nonPreferredRes.error;

            setPlanRestrictions({
                sensitivities: profileRes.data.user_sensitivities.map(s => s.sensitivity_id),
                conditions: profileRes.data.user_medical_conditions.map(c => c.condition_id),
                preferredFoods: preferredRes.data.map(f => f.food_id),
                nonPreferredFoods: nonPreferredRes.data.map(f => f.food_id),
                allMedicalConditions: conditionsRes.data || [],
                allSensitivities: sensitivitiesRes.data || [],
            });

            setAvailableFoods(foodsRes.data || []);

            setFormData({
                name: freeMeal.name,
                prep_time_min: freeMeal.prep_time_min || 15,
                difficulty: freeMeal.difficulty || 'Fácil',
                instructions: freeMeal.instructions || '',
            });

            const mappedIngredients = freeMeal.ingredients.map(ing => {
                const foodDetails = foodsRes.data.find(f => f.id === ing.food_id);
                return {
                    local_id: ing.id,
                    food_id: ing.food_id ? String(ing.food_id) : `free-${ing.id}`,
                    quantity: ing.grams,
                    food_group_id: String(foodDetails?.food_to_food_groups?.[0]?.food_group_id || ''),
                    name: ing.name || foodDetails?.name,
                    is_free: !ing.food_id,
                    status: ing.status,
                };
            });
            setIngredients(mappedIngredients);

        } catch (error) {
            toast({ title: "Error", description: `No se pudieron cargar los datos: ${error.message}`, variant: "destructive" });
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
                from: '/admin-panel/content/free-recipe-requests' 
            } 
        });
    };

    const conflictingIngredientsData = useMemo(() => {
        const conflicts = [];
        ingredients.forEach(ing => {
            if (ing.is_free) return;
            const food = availableFoods.find(f => String(f.id) === String(ing.food_id));
            if (!food) return;

            const conditionConflict = food.food_medical_conditions.find(fmc => planRestrictions.conditions.includes(fmc.condition_id) && fmc.relation_type === 'contraindicated');
            if (conditionConflict) {
                conflicts.push({ id: `${food.id}-cond`, foodName: food.name, restrictionName: conditionConflict.medical_conditions.name, isPathology: true });
            }

            const sensitivityConflict = food.food_sensitivities.find(fs => planRestrictions.sensitivities.includes(fs.sensitivity_id));
            if (sensitivityConflict) {
                conflicts.push({ id: `${food.id}-sens`, foodName: food.name, restrictionName: sensitivityConflict.sensitivities.name, isPathology: false });
            }
        });
        return conflicts;
    }, [ingredients, availableFoods, planRestrictions]);

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (name, value) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleActionClick = async (type) => {
        setIsLoading(true);
        try {
            const hasPendingIngredients = ingredients.some(ing => ing.is_free);
            if (hasPendingIngredients && (type === 'approve_private' || type === 'approve_general')) {
                toast({
                    title: "Acción Requerida",
                    description: "Debes crear o enlazar todos los ingredientes libres antes de aprobar la receta.",
                    variant: "destructive"
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
                ingredients: ingredients.map(i => ({ food_id: i.food_id, grams: i.quantity, food_group_id: i.food_group_id })),
            };
            await onAction(type, freeMeal, dataToSave);
            onOpenChange(false);
        } catch (error) {
            toast({ title: "Error", description: `No se pudo completar la acción: ${error.message}`, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };
    
    if (!freeMeal) return null;

    const pendingIngredients = ingredients.filter(ing => ing.is_free);

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
                    ) : (
                        <>
                            <RecipeForm 
                                formData={formData}
                                onFormChange={handleFormChange}
                                onSelectChange={handleSelectChange}
                            />
                            {pendingIngredients.length > 0 && (
                                <div className="p-4 border border-purple-500/30 rounded-lg bg-purple-500/10">
                                    <h5 className="text-sm font-semibold text-purple-300 mb-3">Ingredientes Libres Pendientes</h5>
                                    <div className="space-y-2">
                                        {pendingIngredients.map(ing => (
                                            <div key={ing.local_id} className="flex items-center justify-between bg-gray-800/50 p-2 rounded-md">
                                                <span className="text-purple-300 font-medium">{ing.name}</span>
                                                <Button size="sm" onClick={() => handleCreateFood(ing)} className="bg-purple-600 hover:bg-purple-700">
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
                                        {conflictingIngredientsData.map(conflict => (
                                            <li key={conflict.id}>
                                                <span className="font-semibold">{conflict.foodName}</span>: Conflicto con <span className="font-semibold">{conflict.restrictionName}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            <IngredientBuilder
                                ingredients={ingredients}
                                onIngredientsChange={setIngredients}
                                availableFoods={availableFoods}
                                planRestrictions={planRestrictions}
                                displayMode="conflict"
                            />
                        </>
                    )}
                </div>
                {!isLoading && (
                    <DialogFooter className="!flex-col sm:!flex-col md:!flex-row gap-2 mt-4">
                        <Button variant="destructive" onClick={() => handleActionClick('reject')} disabled={isLoading} className="bg-gradient-to-br from-red-600/50 to-red-900/50 hover:from-red-600/60 hover:to-red-900/60">
                           {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />} Rechazar
                        </Button>
                        <Button variant="ghost" onClick={() => handleActionClick('keep_as_free_recipe')} disabled={isLoading} className="text-white bg-gradient-to-br from-[hsl(121.85deg_65%_49%_/_58%)] to-[hsl(211,51.05%,50.44%)] hover:opacity-90">
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UtensilsCrossed className="mr-2 h-4 w-4" />} Dejar como Receta Libre
                        </Button>
                        <div className="flex-grow"></div>
                        <Button 
                            className="bg-gradient-to-br from-violet-700/50 to-blue-900/50 text-white hover:from-violet-700/60 hover:to-blue-900/60"
                            onClick={() => handleActionClick('approve_private')}
                            disabled={isLoading}
                        >
                           {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />} Guardar como Receta Privada
                        </Button>
                        
                        {/* Only Admins can save as Template (Global) */}
                        {isAdmin && (
                            <Button 
                                className="bg-gradient-to-br from-emerald-400/50 to-teal-700/50 text-white hover:from-emerald-400/60 hover:to-teal-700/60"
                                onClick={() => handleActionClick('approve_general')}
                                disabled={isLoading}
                            >
                               {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BookTemplate className="mr-2 h-4 w-4" />} Guardar como Plantilla
                            </Button>
                        )}
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default FreeMealApprovalModal;