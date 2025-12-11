import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAssignPlan } from './hooks/useAssignPlan';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import DatePicker from 'react-datepicker';
import { es } from 'date-fns/locale';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import MealMacroConfiguration from '@/components/plans/constructor/MealMacroConfiguration';
import ConflictResolutionDialog from './ConflictResolutionDialog';

const AssignPlanDialog = ({ open, onOpenChange, template, onSuccess, preselectedClient }) => {
    const {
        clients,
        selectedClientId,
        setSelectedClientId,
        newPlanName,
        setNewPlanName,
        dateRange,
        setDateRange,
        isAssigning,
        conflicts,
        isConflictModalOpen,
        setIsConflictModalOpen,
        planRestrictionsForEditor,
        updateRecipeInState,
        handleAssign
    } = useAssignPlan({ open, onOpenChange, onSuccess, preselectedClient, template });
    
    const [startDate, endDate] = dateRange;
    const [userMeals, setUserMeals] = useState([]);
    const [isLoadingMeals, setIsLoadingMeals] = useState(false);
    const [clientTdee, setClientTdee] = useState(2000);
    const [step, setStep] = useState(1); // 1: Basic Info, 2: Meal Config

    // Reset state when dialog closes
    useEffect(() => {
        if (!open) {
            setStep(1);
            setUserMeals([]);
            setIsLoadingMeals(false);
            return;
        }
    }, [open]);

    // Fetch user base meals when entering step 2
    useEffect(() => {
        const fetchUserMeals = async () => {
            if (!selectedClientId) {
                setUserMeals([]);
                return;
            }
            
            setIsLoadingMeals(true);
            try {
                // Fetch base user meals (where diet_plan_id IS NULL)
                const { data: mealsData, error: mealsError } = await supabase
                    .from('user_day_meals')
                    .select('*, day_meal:day_meals(*)')
                    .eq('user_id', selectedClientId)
                    .is('diet_plan_id', null)
                    .order('display_order', { foreignTable: 'day_meals', ascending: true });

                const { data: profileData, error: profileError } = await supabase
                    .from('profiles')
                    .select('tdee_kcal')
                    .eq('user_id', selectedClientId)
                    .maybeSingle();

                if (mealsError) throw mealsError;
                if (profileError) throw profileError;
                
                // Initialize meals. We ensure we have valid percentages, defaulting to 0 if null.
                const initializedMeals = (mealsData || []).map(m => ({
                    ...m,
                    // IMPORTANT: We use the existing percentages from the profile as a starting point, or 0
                    protein_pct: m.protein_pct || 0,
                    carbs_pct: m.carbs_pct || 0,
                    fat_pct: m.fat_pct || 0,
                    day_meal: m.day_meal || { name: 'Comida Desconocida' }
                }));
                
                // Sort locally in case DB sort was ambiguous
                initializedMeals.sort((a, b) => (a.day_meal?.display_order || 0) - (b.day_meal?.display_order || 0));

                setUserMeals(initializedMeals);
                setClientTdee(profileData?.tdee_kcal || 2000);
            } catch (err) {
                console.error("Error fetching user base meals:", err);
            } finally {
                setIsLoadingMeals(false);
            }
        };

        if (selectedClientId && open && step === 2) {
            fetchUserMeals();
        }
    }, [selectedClientId, open, step]);

    const handleNext = () => {
        if (step === 1) {
            if (!selectedClientId || !newPlanName || !startDate || !endDate) return;
            setStep(2);
        } else {
            // Pre-calculate the target grams and calories before sending to handleAssign
            // This ensures the hook receives fully computed data for insertion
            const totalGrams = {
                protein: Math.round((clientTdee * (template?.protein_pct || 30) / 100) / 4),
                carbs: Math.round((clientTdee * (template?.carbs_pct || 40) / 100) / 4),
                fat: Math.round((clientTdee * (template?.fat_pct || 30) / 100) / 9)
            };

            const mealsWithTargets = userMeals.map(m => ({
                ...m,
                target_proteins: Math.round(totalGrams.protein * (m.protein_pct / 100)),
                target_carbs: Math.round(totalGrams.carbs * (m.carbs_pct / 100)),
                target_fats: Math.round(totalGrams.fat * (m.fat_pct / 100)),
                target_calories: (Math.round(totalGrams.protein * (m.protein_pct / 100)) * 4) + 
                                 (Math.round(totalGrams.carbs * (m.carbs_pct / 100)) * 4) + 
                                 (Math.round(totalGrams.fat * (m.fat_pct / 100)) * 9)
            }));
            
            handleAssign(mealsWithTargets);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-full sm:w-[90vw] sm:max-w-[90vw] max-w-none h-[80vh] h-auto bg-[#1a1e23] border-gray-700 text-white flex flex-col overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Asignar Plantilla "{template?.name}"</DialogTitle>
                    <DialogDescription>
                        {step === 1 ? "Configura los detalles básicos del plan." : "Ajusta la distribución de macros para las comidas del usuario."}
                    </DialogDescription>
                </DialogHeader>

                {step === 1 && (
                    <div className="grid gap-4 py-4">
                        {!preselectedClient && (
                            <div className="space-y-2">
                                <Label>Cliente</Label>
                                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                                    <SelectTrigger className="bg-gray-800 border-gray-700">
                                        <SelectValue placeholder="Seleccionar cliente" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#1a1e23] border-gray-700 text-white">
                                        {clients.map(client => (
                                            <SelectItem key={client.user_id} value={client.user_id}>
                                                {client.full_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>Nombre del Plan</Label>
                            <Input 
                                value={newPlanName} 
                                onChange={(e) => setNewPlanName(e.target.value)}
                                className="bg-gray-800 border-gray-700" 
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Duración del Plan</Label>
                            <div className="w-full">
                                <DatePicker
                                    selectsRange={true}
                                    startDate={startDate}
                                    endDate={endDate}
                                    onChange={(update) => setDateRange(update)}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-md p-2 text-white"
                                    dateFormat="dd/MM/yyyy"
                                    locale={es}
                                    placeholderText="Seleccionar rango de fechas"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="py-4 space-y-4">
                        {isLoadingMeals ? (
                            <div className="flex justify-center p-8"><Loader2 className="animate-spin text-green-500" /></div>
                        ) : userMeals.length === 0 ? (
                            <div className="text-center p-4 bg-yellow-900/20 rounded-md border border-yellow-700/50">
                                <p className="text-yellow-200">Este usuario no tiene configurados momentos de comida en su perfil base.</p>
                                <p className="text-sm text-gray-400 mt-2">No se podrán distribuir macros automáticamente. Debes configurar los momentos de comida en el perfil del cliente primero.</p>
                            </div>
                        ) : (
                            <MealMacroConfiguration 
                                meals={userMeals}
                                onConfigChange={setUserMeals}
                                effectiveTdee={clientTdee}
                                macrosPct={{ 
                                    protein: template?.protein_pct || 30, 
                                    carbs: template?.carbs_pct || 40, 
                                    fat: template?.fat_pct || 30 
                                }}
                                shouldAutoExpand={true}
                                hideSaveButton={true}
                            />
                        )}
                    </div>
                )}

                <DialogFooter className="flex justify-between sm:justify-between w-full">
                    {step === 2 ? (
                        <Button className="mt-4 sm:mt-0" variant="ghost" onClick={() => setStep(1)} disabled={isAssigning}>
                            Atrás
                        </Button>
                    ) : (
                        <Button variant="ghost" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                    )}
                    
                    <Button 
                        onClick={handleNext} 
                        disabled={isAssigning || (step === 1 && (!selectedClientId || !newPlanName || !startDate || !endDate))}
                        className="bg-green-600 hover:bg-green-500 text-white"
                    >
                        {isAssigning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {step === 1 ? "Siguiente: Macros" : "Confirmar Asignación"}
                    </Button>
                </DialogFooter>
            </DialogContent>
            
            <ConflictResolutionDialog 
                open={isConflictModalOpen}
                onOpenChange={setIsConflictModalOpen}
                conflicts={conflicts}
                onResolve={updateRecipeInState}
                planRestrictions={planRestrictionsForEditor}
            />
        </Dialog>
    );
};

export default AssignPlanDialog;