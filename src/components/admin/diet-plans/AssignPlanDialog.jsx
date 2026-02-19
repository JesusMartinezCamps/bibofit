import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAssignPlan } from './hooks/useAssignPlan';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import DatePicker from 'react-datepicker';
import { es } from 'date-fns/locale';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import MealMacroConfiguration from '@/components/plans/constructor/MealMacroConfiguration';
import ConflictResolutionDialog from './ConflictResolutionDialog';
import MacroDistribution from '@/components/plans/constructor/MacroDistribution';
import CalorieAdjustment from '@/components/plans/constructor/CalorieAdjustment';
import { useAuth } from '@/contexts/AuthContext';
import { useTour } from '@/hooks/useTour';
import TourModal from '@/components/tour/TourModal';
import { cn } from '@/lib/utils';
import { assignDietPlanToUser } from '@/lib/dietAssignmentService';

const AssignPlanDialog = ({ 
    open, 
    onOpenChange, 
    template, 
    onSuccess, 
    preselectedClient, 
    mode = 'adminAssign', 
    forcedUserId,
    preselectedData = null 
}) => {
    const { toast } = useToast();
    const { user } = useAuth();
    
    // Tour Hooks - Correctly using published Context values
    const { 
        isTourActive, 
        currentStepData,
        nextStep,
    } = useTour();
    
    const [showNutritionalConfigModal, setShowNutritionalConfigModal] = useState(false);

    const buildBalancedPercentages = (mealsCount) => {
        if (!mealsCount) return [];

        const base = Math.floor(100 / mealsCount);
        const remainder = 100 % mealsCount;

        return Array.from({ length: mealsCount }, (_, idx) => base + (idx < remainder ? 1 : 0));
    };

    const {
        clients,
        selectedClientId,
        setSelectedClientId,
        clientRestrictions,
        newPlanName,
        setNewPlanName,
        dateRange,
        setDateRange,
        conflicts,
        isConflictModalOpen,
        setIsConflictModalOpen,
        planRestrictionsForEditor,
        updateRecipeInState,
    } = useAssignPlan({ open, onOpenChange, onSuccess, preselectedClient, template, mode, forcedUserId });

    const [startDate, endDate] = dateRange;
    const [userMeals, setUserMeals] = useState([]);
    const [isLoadingMeals, setIsLoadingMeals] = useState(false);
    const [clientTdee, setClientTdee] = useState(2000);
    const [step, setStep] = useState(preselectedData ? 2 : 1); 
    const [autoCreatedMeals, setAutoCreatedMeals] = useState(false);
    const [dailyMacros, setDailyMacros] = useState({ protein: 30, carbs: 40, fat: 30 });
    const [localOverrides, setLocalOverrides] = useState([]);
    const [isAssigning, setIsAssigning] = useState(false); // Local assigning state

    // Safely check for tour step, ensuring we don't crash if tour context is weird
    useEffect(() => {
        if (open && isTourActive && currentStepData?.id === 'macro-distribution' && step === 2) {
            setShowNutritionalConfigModal(true);
        } else {
            setShowNutritionalConfigModal(false);
        }
    }, [open, isTourActive, currentStepData, step]);

    const handleTourStepInfoComplete = async () => {
        setShowNutritionalConfigModal(false);
    };

    useEffect(() => {
        if (open && preselectedData) {
            if (preselectedData.planName) setNewPlanName(preselectedData.planName);
            if (preselectedData.startDate && preselectedData.endDate) {
                setDateRange([preselectedData.startDate, preselectedData.endDate]);
            }
            if (preselectedData.macroDistribution) {
                setDailyMacros(preselectedData.macroDistribution);
            }
            if (preselectedData.dailyCalories) {
                setLocalOverrides([{
                     id: Date.now(),
                     created_at: new Date().toISOString(),
                     manual_calories: preselectedData.dailyCalories
                }]);
            }
        }
    }, [open, preselectedData, setNewPlanName, setDateRange]);

    useEffect(() => {
        if (open) {
            if (preselectedData && step < 2) {
                 setStep(2);
            } else if (step === 1 && !preselectedData) { 
                setDailyMacros({
                    protein: template?.protein_pct || 30,
                    carbs: template?.carbs_pct || 40,
                    fat: template?.fat_pct || 30
                });
                setLocalOverrides([]); 
            }
        } else {
            setStep(preselectedData ? 2 : 1);
            setUserMeals([]);
            setIsLoadingMeals(false);
            setLocalOverrides([]);
            setClientTdee(2000);
            setAutoCreatedMeals(false);
            setIsAssigning(false);
        }
    }, [open, template, preselectedData]);

    useEffect(() => {
        if (!open) return;
        setClientTdee(2000);
        setUserMeals([]);
        setAutoCreatedMeals(false);
    }, [selectedClientId, open]);
    
    const effectiveTdee = useMemo(() => {
        const applicableOverride = [...localOverrides]
             .sort((a, b) => new Date(b.created_at || new Date()) - new Date(a.created_at || new Date()))[0];

        return applicableOverride ? applicableOverride.manual_calories : clientTdee;
    }, [clientTdee, localOverrides]);

    const handleOfflineOverrideChange = (action) => {
        if (action.type === 'add') {
            setLocalOverrides(prev => [...prev, {
                ...action.data,
                created_at: new Date().toISOString()
            }]);
        } else if (action.type === 'update') {
            setLocalOverrides(prev => prev.map(o => o.id === action.id ? { ...o, manual_calories: action.value } : o));
        } else if (action.type === 'delete') {
            setLocalOverrides(prev => prev.filter(o => o.id !== action.id));
        }
    };

    useEffect(() => {
        const fetchUserMeals = async () => {
            if (!selectedClientId) {
                setUserMeals([]);
                return;
            }
            
            setIsLoadingMeals(true);
            setAutoCreatedMeals(false);
            try {
                let { data: mealsData, error: mealsError } = await supabase
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

                const isCurrentUser = user?.id === selectedClientId;

                if ((mealsData?.length || 0) === 0 && isCurrentUser) {
                     const { data: defaultDayMeals, error: dayMealsError } = await supabase
                        .from('day_meals')
                        .select('*')
                        .order('display_order', { ascending: true });

                    if (dayMealsError) throw dayMealsError;

                    if (defaultDayMeals?.length) {
                         const payload = defaultDayMeals.map(dm => ({
                            user_id: selectedClientId,
                            day_meal_id: dm.id,
                            preferences: '',
                            diet_plan_id: null
                        }));

                        const { error: insertError } = await supabase
                            .from('user_day_meals')
                            .insert(payload);

                        if (insertError) throw insertError;

                        const refreshed = await supabase
                            .from('user_day_meals')
                            .select('*, day_meal:day_meals(*)')
                            .eq('user_id', selectedClientId)
                            .is('diet_plan_id', null)
                            .order('display_order', { foreignTable: 'day_meals', ascending: true });

                        if (refreshed.error) throw refreshed.error;
                        mealsData = refreshed.data || [];
                        setAutoCreatedMeals(true);
                    }
                }
                
                const initializedMeals = (mealsData || []).map(m => ({
                    ...m,
                    protein_pct: m.protein_pct || 0,
                    carbs_pct: m.carbs_pct || 0,
                    fat_pct: m.fat_pct || 0,
                    day_meal: m.day_meal || { name: 'Comida Desconocida' }
                }));
                
                initializedMeals.sort((a, b) => (a.day_meal?.display_order || 0) - (b.day_meal?.display_order || 0));
                
                const hasStoredMacros = initializedMeals.reduce((acc, meal) => ({
                    protein: acc.protein + (meal.protein_pct || 0),
                    carbs: acc.carbs + (meal.carbs_pct || 0),
                    fat: acc.fat + (meal.fat_pct || 0)
                }), { protein: 0, carbs: 0, fat: 0 });

                if (
                    initializedMeals.length > 0 &&
                    hasStoredMacros.protein === 0 &&
                    hasStoredMacros.carbs === 0 &&
                    hasStoredMacros.fat === 0
                ) {
                    const balancedPercentages = buildBalancedPercentages(initializedMeals.length);
                    initializedMeals.forEach((meal, idx) => {
                        meal.protein_pct = balancedPercentages[idx];
                        meal.carbs_pct = balancedPercentages[idx];
                        meal.fat_pct = balancedPercentages[idx];
                    });
                }
                setUserMeals(initializedMeals);
                setClientTdee(profileData?.tdee_kcal || 2000);
            } catch (err) {
                console.error("Error fetching user base meals:", err);
            } finally {
                setIsLoadingMeals(false);
            }
        };

        if (selectedClientId && open && (step === 2 || step === 3)) {
            fetchUserMeals(); 
        }
    }, [selectedClientId, open, step, user]);

    const handleNext = async () => {
        if (step === 1) {
            if (!selectedClientId || !newPlanName || !startDate || !endDate) return;
             if (Object.keys(conflicts).length > 0) {
                setIsConflictModalOpen(true);
                return;
            }
            setStep(2);
        } else if (step === 2) {
            const total = dailyMacros.protein + dailyMacros.carbs + dailyMacros.fat;
            if (total !== 100) {
                toast({
                    title: "Error de validación",
                    description: `Los porcentajes deben sumar 100%. Actualmente suman ${total}%.`,
                    variant: "destructive"
                });
                return;
            }
            setStep(3);
        } else {
            // EXECUTE ASSIGNMENT VIA SERVICE
            setIsAssigning(true);

            // 1. Calculate Targets
            const totalGrams = {
                protein: Math.round((effectiveTdee * (dailyMacros.protein / 100)) / 4),
                carbs: Math.round((effectiveTdee * (dailyMacros.carbs / 100)) / 4),
                fat: Math.round((effectiveTdee * (dailyMacros.fat / 100)) / 9)
            };

            const mealsWithTargets = userMeals.map(m => ({
                ...m,
                day_meal_id: m.day_meal_id, // Ensure day_meal_id is passed
                target_proteins: Math.round(totalGrams.protein * (m.protein_pct / 100)),
                target_carbs: Math.round(totalGrams.carbs * (m.carbs_pct / 100)),
                target_fats: Math.round(totalGrams.fat * (m.fat_pct / 100)),
                target_calories: (Math.round(totalGrams.protein * (m.protein_pct / 100)) * 4) + 
                                 (Math.round(totalGrams.carbs * (m.carbs_pct / 100)) * 4) + 
                                 (Math.round(totalGrams.fat * (m.fat_pct / 100)) * 9)
            }));
            
            try {
                // 2. Call Service (which calls Edge Function)
                const assignmentResult = await assignDietPlanToUser(selectedClientId, {
                    template: template,
                    planName: newPlanName,
                    startDate: startDate,
                    endDate: endDate,
                    dailyCalories: effectiveTdee,
                    globalMacros: dailyMacros,
                    mealMacroDistribution: mealsWithTargets, // Pass array with targets
                    overrides: localOverrides
                });

                if (assignmentResult.success) {
                    toast({
                        title: "Plan asignado correctamente",
                        description: `El plan "${newPlanName}" ha sido creado y ajustado automáticamente.`,
                        className: "bg-green-600 text-white border-none"
                    });
                    
                    if (isTourActive && currentStepData?.id === 'macro-distribution') {
                        await nextStep();
                    }

                    if (onSuccess) onSuccess();
                    onOpenChange(false);
                } else {
                    throw assignmentResult.error;
                }
            } catch (err) {
                 console.error("Assignment Error in Dialog:", err);
                 toast({
                    title: "Error al asignar plan",
                    description: err?.message || "Ocurrió un error inesperado al procesar el plan.",
                    variant: "destructive"
                });
            } finally {
                setIsAssigning(false);
            }
        }
    };

    const handleBack = () => {
        if (preselectedData && step === 2) {
            onOpenChange(false);
            return;
        }
        if (step > 1) setStep(step - 1);
        else onOpenChange(false);
    };

    const getDialogTitle = () => {
        switch(step) {
            case 1: return `Asignar Plantilla "${template?.name}"`;
            case 2: return "Distribución Diaria de Macros";
            case 3: return "Reparto por Comida";
            default: return "";
        }
    };

    const getDialogDescription = () => {
        switch(step) {
            case 1: return "Configura los detalles básicos del plan.";
            case 2: return "Ajusta las calorías totales y los objetivos globales de macronutrientes.";
            case 3: return "Ajusta la distribución de macros para las comidas del usuario.";
            default: return "";
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <TourModal 
                isOpen={showNutritionalConfigModal}
                onAccept={handleTourStepInfoComplete}
            />

            <DialogContent className="w-[95vw] sm:w-[80vw] sm:max-w-[80vw] max-w-none h-[80vh] sm:h-[85vh] bg-[#1a1e23] border-gray-700 text-white flex flex-col overflow-hidden p-0 gap-0">
                <div className="p-6 pb-4 border-b border-gray-700 shrink-0 bg-[#1a1e23]">
                    <DialogHeader>
                        <DialogTitle>{getDialogTitle()}</DialogTitle>
                        <DialogDescription>{getDialogDescription()}</DialogDescription>
                    </DialogHeader>
                </div>

                <div className="flex-1 overflow-y-auto p-6 min-h-0">
                    {/* STEP 1: Basic Info */}
                    {step === 1 && (
                        <div className="grid gap-4">
                            {!preselectedClient && mode !== 'selfAssign' && (
                                <div className="space-y-2">
                                    <Label>Cliente</Label>
                                    <Select 
                                        value={selectedClientId} 
                                        onValueChange={setSelectedClientId}
                                        disabled={!!preselectedData} 
                                    >
                                        <SelectTrigger className="bg-gray-800 border-gray-700 disabled:opacity-50">
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
                                    className="bg-gray-800 border-gray-700 disabled:opacity-50"
                                    disabled={!!preselectedData} 
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
                                        className="w-full bg-gray-800 border border-gray-700 rounded-md p-2 text-white disabled:opacity-50"
                                        dateFormat="dd/MM/yyyy"
                                        locale={es}
                                        placeholderText="Seleccionar rango de fechas"
                                        disabled={!!preselectedData} 
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: Daily Macros & Calories */}
                    {step === 2 && (
                        <div className="space-y-6">
                            <CalorieAdjustment 
                                calculatedTdee={clientTdee}
                                calorieOverrides={localOverrides}
                                onOverridesUpdate={() => {}} 
                                isOffline={true}
                                onOfflineChange={handleOfflineOverrideChange}
                            />
                            
                            <MacroDistribution 
                                effectiveTdee={effectiveTdee}
                                macrosPct={dailyMacros}
                                onMacrosPctChange={setDailyMacros}
                                isTemplate={true} 
                                defaultOpen={true}
                            />
                        </div>
                    )}

                    {/* STEP 3: Meal Config */}
                    {step === 3 && (
                        <div className="space-y-4">
                            {isLoadingMeals ? (
                                <div className="flex justify-center p-8"><Loader2 className="animate-spin text-green-500" /></div>
                            ) : userMeals.length === 0 ? (
                                <div className="text-center p-4 bg-yellow-900/20 rounded-md border border-yellow-700/50">
                                    <p className="text-yellow-200">Este usuario no tiene configurados momentos de comida en su perfil base.</p>
                                    <p className="text-sm text-gray-400 mt-2">No se podrán distribuir macros automáticamente. Debes configurar los momentos de comida en el perfil del cliente primero.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {autoCreatedMeals && (
                                        <div className="p-3 rounded-md border border-green-700/50 bg-green-900/20 text-sm text-green-200">
                                            Se han creado automáticamente tus momentos del día base para poder asignar la plantilla.
                                        </div>
                                    )}
                                    <MealMacroConfiguration
                                        meals={userMeals}
                                        onConfigChange={setUserMeals}
                                        effectiveTdee={effectiveTdee}
                                        macrosPct={dailyMacros}
                                        shouldAutoExpand={true}
                                        hideSaveButton={true}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-6 pt-4 border-t border-gray-700 bg-[#1a1e23] shrink-0">
                    <DialogFooter className="flex justify-between sm:justify-between w-full">
                        <Button 
                            variant="ghost" 
                            onClick={handleBack} 
                            disabled={isAssigning}
                            className={cn(
                                "mt-2 hover:bg-gray-600/50 hover:text-gray-300 sm:mt-0",
                                (preselectedData && step === 2) && "hidden"
                            )}
                        >
                            {step === 1 ? "Cancelar" : "Atrás"}
                        </Button>
                        
                        <Button 
                            onClick={handleNext}
                            disabled={
                                isAssigning ||
                                (step === 1 && (!selectedClientId || !newPlanName || !startDate || !endDate)) ||
                                (step === 2 && (dailyMacros.protein + dailyMacros.carbs + dailyMacros.fat) !== 100)
                            }
                            className="bg-green-600 hover:bg-green-500 text-white"
                        >
                            {isAssigning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {step === 1 ? "Siguiente: Macros Diarios" : 
                            step === 2 ? "Siguiente: Reparto por Comida" : 
                            "Asignar y Calcular"}
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
            
            <ConflictResolutionDialog 
                open={isConflictModalOpen}
                onOpenChange={setIsConflictModalOpen}
                conflicts={conflicts}
                onRecipeUpdate={updateRecipeInState}
                onResolveComplete={() => setStep(2)}
                clientRestrictions={clientRestrictions}
                planRestrictions={planRestrictionsForEditor}
            />
        </Dialog>
    );
};

export default AssignPlanDialog;