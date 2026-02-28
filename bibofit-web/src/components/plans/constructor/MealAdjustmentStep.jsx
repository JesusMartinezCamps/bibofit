
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowRight, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePlanItems } from '@/components/shared/WeeklyDietPlanner/hooks/usePlanItems';
import { useConflictResolution } from '@/hooks/useConflictResolution';
import ConflictSummary from './ConflictSummary';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import AdminRecipeModal from '@/components/admin/recipes/AdminRecipeModal';

const MealAdjustmentStep = ({ planData, onNext, onBack }) => {
    const { user } = useAuth();
    const [isProcessing, setIsProcessing] = useState(false);
    const [activeRecipeForEdit, setActiveRecipeForEdit] = useState(null);

    // Simulated data fetch for context (in a real scenario, these come from context or props)
    const { planRecipes, allAvailableFoods, loading: planLoading } = usePlanItems(
        user?.id, 
        planData?.template, 
        [new Date()], 
        () => {}
    );

    const userRestrictions = {
        // Mocking restrictions based on structure, should come from API
        sensitivities: [],
        medical_conditions: [],
        preferred_foods: [],
        non_preferred_foods: [],
        individual_food_restrictions: []
    };

    const {
        isAnalyzing,
        analyzeRecipesForConflicts,
        autoSubstitutions,
        pendingConfirmations,
        manualReviewItems,
        conflictMap,
        confirmSubstitution
    } = useConflictResolution(planRecipes, userRestrictions, allAvailableFoods);

    useEffect(() => {
        if (planRecipes.length > 0 && allAvailableFoods.length > 0) {
            analyzeRecipesForConflicts();
        }
    }, [planRecipes, allAvailableFoods, analyzeRecipesForConflicts]);

    const handleContinue = () => {
        if (pendingConfirmations.length > 0 || manualReviewItems.length > 0) {
            // No permitir continuar si hay conflictos no resueltos
            return;
        }
        setIsProcessing(true);
        setTimeout(() => {
            setIsProcessing(false);
            onNext({ resolved: true });
        }, 800);
    };

    if (planLoading || isAnalyzing) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin mb-4 text-green-500" />
                <p>Analizando conflictos e identificando sustituciones...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto pr-2 pb-6 styled-scrollbar space-y-6">
                
                <h2 className="text-xl font-semibold text-white">Revisión de Ingredientes</h2>
                <p className="text-sm text-slate-400">El sistema ha analizado las recetas frente a las restricciones del cliente.</p>

                <ConflictSummary 
                    autoCount={autoSubstitutions.length}
                    pendingCount={pendingConfirmations.length}
                    manualCount={manualReviewItems.length}
                    totalAnalyzedRecipes={planRecipes.length}
                    onScrollToPending={() => document.getElementById('pending-section')?.scrollIntoView({ behavior: 'smooth' })}
                    onScrollToManual={() => document.getElementById('manual-section')?.scrollIntoView({ behavior: 'smooth' })}
                />

                {autoSubstitutions.length > 0 && (
                    <div className="space-y-3">
                        <h3 className="text-sm font-medium text-green-400 uppercase tracking-wider">Sustituciones Automáticas Aplicadas</h3>
                        {autoSubstitutions.map((item, idx) => (
                            <Card key={idx} className="bg-slate-800/40 border-slate-700/50">
                                <CardContent className="p-3 flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-slate-200">{item.recipeName}</p>
                                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                                            <span className="line-through text-red-400/70">{item.ingredient.food.name}</span>
                                            <ArrowRight className="w-3 h-3" />
                                            <span className="text-green-400">{allAvailableFoods?.find(f=>f.id === item.targetFoodId)?.name || 'Sustituto'}</span>
                                        </div>
                                    </div>
                                    <Badge variant="outline" className="bg-green-900/20 text-green-400 border-green-500/20">Automático</Badge>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                {pendingConfirmations.length > 0 && (
                    <div id="pending-section" className="space-y-3 pt-4 border-t border-slate-800">
                        <h3 className="text-sm font-medium text-amber-400 uppercase tracking-wider">Sugerencias por Confirmar</h3>
                        {pendingConfirmations.map((item, idx) => (
                            <Card key={idx} className="bg-amber-900/10 border-amber-500/20">
                                <CardContent className="p-4">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <p className="text-sm font-medium text-slate-200">{item.recipeName}</p>
                                            <p className="text-xs text-amber-500 mt-1">Conflicto: {item.conflict.reason}</p>
                                        </div>
                                        <Badge variant="outline" className="bg-amber-900/30 text-amber-300 border-amber-500/30">Requiere Acción</Badge>
                                    </div>
                                    
                                    <p className="text-xs text-slate-400 mb-2">Selecciona un sustituto:</p>
                                    <div className="space-y-2">
                                        {item.substitutions.map(sub => {
                                            const targetName = allAvailableFoods?.find(f=>f.id === sub.target_food_id)?.name || 'Sustituto';
                                            return (
                                                <div key={sub.id} className="flex items-center justify-between bg-slate-800/50 p-2 rounded border border-slate-700">
                                                    <span className="text-sm text-slate-300">{targetName}</span>
                                                    <Button 
                                                        size="sm" 
                                                        variant="ghost" 
                                                        className="h-7 text-xs hover:bg-amber-500/20 hover:text-amber-300"
                                                        onClick={() => confirmSubstitution(item, sub.target_food_id)}
                                                    >
                                                        Aceptar
                                                    </Button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                {manualReviewItems.length > 0 && (
                    <div id="manual-section" className="space-y-3 pt-4 border-t border-slate-800">
                        <h3 className="text-sm font-medium text-red-400 uppercase tracking-wider">Requieren Revisión Manual</h3>
                        {manualReviewItems.map((item, idx) => (
                            <Card key={idx} className="bg-red-900/10 border-red-500/20">
                                <CardContent className="p-4 flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-slate-200">{item.recipeName}</p>
                                        <p className="text-xs text-red-400 mt-1">Ingrediente sin sustituto: {item.ingredient.food.name}</p>
                                    </div>
                                    <Button 
                                        size="sm" 
                                        className="bg-red-900/40 text-red-300 hover:bg-red-900/60 border border-red-500/30"
                                        onClick={() => setActiveRecipeForEdit(conflictMap[item.recipeId])}
                                    >
                                        Editar Receta
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-between mt-auto shrink-0 bg-slate-950">
                <Button variant="ghost" onClick={onBack} disabled={isProcessing}>Atrás</Button>
                <Button 
                    onClick={handleContinue}
                    disabled={isProcessing || pendingConfirmations.length > 0 || manualReviewItems.length > 0}
                    className="bg-green-600 hover:bg-green-500"
                >
                    {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                    Confirmar y Continuar
                </Button>
            </div>

            {activeRecipeForEdit && (
                <AdminRecipeModal 
                    open={!!activeRecipeForEdit}
                    onOpenChange={(open) => !open && setActiveRecipeForEdit(null)}
                    recipeToEdit={activeRecipeForEdit}
                    isTemporaryEdit={true}
                    // onSaveSuccess={(updated) => update conflict maps...}
                />
            )}
        </div>
    );
};

export default MealAdjustmentStep;
