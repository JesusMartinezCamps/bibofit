import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import ProteinIcon from '@/components/icons/ProteinIcon';
import CarbsIcon from '@/components/icons/CarbsIcon';
import FatsIcon from '@/components/icons/FatsIcon';
import CaloriesIcon from '@/components/icons/CaloriesIcon';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import CalorieAdjustment from './CalorieAdjustment';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

const MacroInput = ({ value, onChange, icon, label, colorClass, grams,  readOnly = false }) => (
    <div className={cn("flex items-center justify-between gap-2 bg-gray-800/60 p-2 rounded-md border border-gray-700", readOnly && "opacity-70")}>
        <Label className="flex items-center gap-2 w-36 whitespace-nowrap">
            {icon} {label}
        </Label>
        <div className="relative w-24">
            <Input
                type="text"
                value={value}
                onChange={onChange}
                className={cn("input-field pr-6 text-center", readOnly && "cursor-not-allowed bg-gray-900 text-gray-500")}
                pattern="\d*"
                disabled={readOnly}
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
        </div>
        <div className="flex items-center gap-2 w-20 justify-end">
            <span className={`text-xl font-bold font-numeric ${colorClass}`}>{grams}g</span>
        </div>
    </div>
);

const MacroDistribution = ({ 
    effectiveTdee, 
    macrosPct: initialMacrosPct, 
    onMacrosPctChange, 
    calorieOverrides, 
    dietPlanId, 
    onOverridesUpdate, 
    isTemplate, 
    readOnly = false,
    onCaloriesChange,
    onOfflineChange,
    isOffline = false,
    calculatedTdee,
    userId: propUserId,
    supabase
}) => {
    const location = useLocation();
    const { toast } = useToast();
    const { user: authUser } = useAuth();
    
    // Fallback logic for userId in parent as well to ensure it passes down correctly
    const userId = propUserId || authUser?.id;

    const shouldStartClosed = (
        location.pathname.startsWith('/my-plan') ||
        location.pathname.startsWith('/admin-panel/plan-detail')
    );
    const [macrosPct, setMacrosPct] = useState(initialMacrosPct);
    const debounceTimeout = useRef(null);
    const [open, setOpen] = useState(true); 

    useEffect(() => {
        setMacrosPct(initialMacrosPct);
    }, [initialMacrosPct]);

    // Override open state if prop suggests closed initially (for dashboards), but allow manual toggle
    useEffect(() => {
        if (shouldStartClosed) setOpen(false);
    }, [shouldStartClosed]);

    const handleMacroChange = (macro, value) => {
        if (readOnly) {
            toast({
                title: "Función Bloqueada",
                description: "Mejora tu plan para poder usar esta función y ajustar tus macros.",
                variant: "destructive"
            });
            return;
        }
        if (/^\d*$/.test(value)) {
            const newMacros = { ...macrosPct, [macro]: value };
            setMacrosPct(newMacros);

            if (debounceTimeout.current) {
                clearTimeout(debounceTimeout.current);
            }
            
            debounceTimeout.current = setTimeout(() => {
                const parsedMacros = {
                    protein: parseInt(newMacros.protein, 10) || 0,
                    carbs: parseInt(newMacros.carbs, 10) || 0,
                    fat: parseInt(newMacros.fat, 10) || 0,
                };
                onMacrosPctChange(parsedMacros);
            }, 1000);
        }
    };
    
    const parsedMacros = useMemo(() => ({
        protein: parseInt(macrosPct.protein, 10) || 0,
        carbs: parseInt(macrosPct.carbs, 10) || 0,
        fat: parseInt(macrosPct.fat, 10) || 0,
    }), [macrosPct]);

    const totalPct = useMemo(() => Object.values(parsedMacros).reduce((sum, val) => sum + val, 0), [parsedMacros]);

    const totalGrams = useMemo(() => ({
        protein: Math.round(effectiveTdee * (parsedMacros.protein / 100) / 4),
        carbs: Math.round(effectiveTdee * (parsedMacros.carbs / 100) / 4),
        fat: Math.round(effectiveTdee * (parsedMacros.fat / 100) / 9)
    }), [effectiveTdee, parsedMacros]);

    const totalCaloriesFromMacros = totalGrams.protein * 4 + totalGrams.carbs * 4 + totalGrams.fat * 9;

    return (
        <Card className="bg-slate-900/50 border-gray-700 text-white overflow-hidden shadow-xl">
        <Collapsible open={open} onOpenChange={setOpen}>

            <CardHeader className="px-4">
            <CollapsibleTrigger asChild>
                <button
                type="button"
                className="w-full flex items-center justify-between text-left p-2 rounded-md hover:bg-gray-800/40 transition"
                >
                <div>
                    <CardTitle className="flex items-center gap-2">
                        1. Ajuste de Calorías y Macros
                        {readOnly && <Lock className="w-4 h-4 text-gray-500" />}
                    </CardTitle>
                    <CardDescription>
                    Define tu objetivo calórico y ajusta la distribución porcentual.
                    </CardDescription>
                </div>

                <div className="p-2">
                    {open ? (
                    <ChevronDown className="w-5 h-5" />
                    ) : (
                    <ChevronRight className="w-5 h-5" />
                    )}
                </div>
                </button>
            </CollapsibleTrigger>
            </CardHeader>

            <AnimatePresence initial={false}>
            {open && (
                <CollapsibleContent asChild forceMount>
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                >
                <CardContent className="px-4 pb-4">
                    {!isTemplate && (                        
                        <CalorieAdjustment 
                            calculatedTdee={calculatedTdee}
                            effectiveTdeeProp={effectiveTdee}
                            calorieOverrides={calorieOverrides}
                            dietPlanId={dietPlanId || null}
                            onOverridesUpdate={onOverridesUpdate}
                            onCaloriesChange={onCaloriesChange}
                            onOfflineChange={onOfflineChange}
                            readOnly={readOnly}
                            isOffline={isOffline}
                            userId={userId}
                            supabase={supabase}
                        />
                    )}
                    <div className="rounded-lg p-4 border border-gray-700 space-y-4 mt-4 bg-gray-900/30">
                        <div className="flex justify-between items-center pb-4 border-b border-gray-700">
                            <div className="flex items-center gap-3">
                                <CaloriesIcon className="w-6 h-6 text-orange-400" />
                                <div>
                                    <Label>Reparto Macros por Kcal Diarias</Label>
                                    <p className="text-2xl font-bold font-numeric text-white">~{effectiveTdee}</p>
                                </div>
                            </div>
                            <div className="text-right">
                            <div className="flex items-center justify-end gap-3">
                                    <div>
                                        <Label>Resultado Kcal</Label>
                                        <p className="text-2xl font-bold font-numeric text-white">~{totalCaloriesFromMacros}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="space-y-3">
                            <MacroInput
                                value={macrosPct.protein}
                                onChange={e => handleMacroChange('protein', e.target.value)}
                                icon={<ProteinIcon className="w-4 h-4 text-red-400" />}
                                label="Proteínas"
                                colorClass="text-red-400"
                                grams={totalGrams.protein}
                                readOnly={readOnly}
                            />
                            <MacroInput
                                value={macrosPct.carbs}
                                onChange={e => handleMacroChange('carbs', e.target.value)}
                                icon={<CarbsIcon className="w-4 h-4 text-yellow-400" />}
                                label="Carbohidratos"
                                colorClass="text-yellow-400"
                                grams={totalGrams.carbs}
                                readOnly={readOnly}
                            />
                            <MacroInput
                                value={macrosPct.fat}
                                onChange={e => handleMacroChange('fat', e.target.value)}
                                icon={<FatsIcon className="w-4 h-4 text-green-400" />}
                                label="Grasas"
                                colorClass="text-green-400"
                                grams={totalGrams.fat}
                                readOnly={readOnly}
                            />
                        </div>
                        
                        <div className="border-t border-gray-700 pt-3 flex justify-between items-center text-lg">
                            <Label>Total Porcentajes</Label>
                            <p className={`font-bold ${totalPct !== 100 ? 'text-yellow-400' : 'text-green-400'}`}>
                                {totalPct}%
                            </p>
                        </div>
                    </div>
                </CardContent>
            </motion.div>
        </CollapsibleContent>
        )}
        </AnimatePresence>
    </Collapsible>
</Card>
    );
};

export default MacroDistribution;