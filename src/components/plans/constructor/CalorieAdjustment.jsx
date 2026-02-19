import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Save, Loader2, RefreshCw, History, Activity, Calculator } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase as supabaseClient } from '@/lib/supabaseClient'; 

import {
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Badge } from '@/components/ui/badge';
import CalorieAdjustmentHistory from './CalorieAdjustmentHistory';
import { useAuth } from '@/contexts/AuthContext';

/**
 * CalorieAdjustment Component
 * 
 * Manages manual calorie overrides for a user/plan.
 * Cleaned up version: Direct database interaction only (no offline mode).
 */
const CalorieAdjustment = ({ 
    dietPlanId = null, 
    userId: propUserId, 
    onOverridesUpdate,
    onCaloriesChange,
    readOnly = false,
    calculatedTdee = 2000,
    supabase: propSupabase
}) => {
    // -------------------------------------------------------------------------
    // SETUP
    // -------------------------------------------------------------------------
    const supabase = propSupabase || supabaseClient;
    const { toast } = useToast();
    const { user: authUser } = useAuth();
    
    // Resolve User ID: Prioritize prop, fallback to auth context
    const userId = propUserId || authUser?.id;

    // State
    const [manualCalories, setManualCalories] = useState('');
    const [localOverrides, setLocalOverrides] = useState([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    // Refs for optimization
    const prevCaloriesRef = useRef(null);
    const prevOverridesRef = useRef(null);

    // -------------------------------------------------------------------------
    // DATA FETCHING
    // -------------------------------------------------------------------------
    const fetchOverrides = async () => {
        if (!userId) return;

        try {
            setLoading(true);
            
            // Fix: Ordering by created_at, as effective_date does not exist
            const { data, error } = await supabase
                .from('diet_plan_calorie_overrides')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            setLocalOverrides(data || []);
        } catch (error) {
            console.error("❌ Error fetching overrides:", error);
            toast({ 
                title: "Error", 
                description: "No se pudo cargar el historial.", 
                variant: "destructive" 
            });
        } finally {
            setLoading(false);
        }
    };

    // Initial load
    useEffect(() => {
        fetchOverrides();
    }, [userId]);

    // -------------------------------------------------------------------------
    // LOGIC & CALCULATIONS
    // -------------------------------------------------------------------------
    
    // Active override is always the most recent one (index 0)
    const activeOverride = localOverrides.length > 0 ? localOverrides[0] : null;

    // Calculate Effective TDEE (Manual override OR System calculated)
    const effectiveTdee = activeOverride ? activeOverride.manual_calories : calculatedTdee;
    const isSystemTarget = !activeOverride;

    // Notify parent of calorie changes (for macro calculations)
    useEffect(() => {
        if (effectiveTdee && effectiveTdee !== prevCaloriesRef.current) {
            prevCaloriesRef.current = effectiveTdee;
            if (onCaloriesChange) {
                onCaloriesChange(effectiveTdee);
            }
        }
    }, [effectiveTdee, onCaloriesChange]);

    // Notify parent of override updates (for status indicators)
    useEffect(() => {
        const overridesStr = JSON.stringify(activeOverride);
        if (overridesStr !== prevOverridesRef.current) {
            prevOverridesRef.current = overridesStr;
            if (onOverridesUpdate) {
                onOverridesUpdate();
            }
        }
    }, [activeOverride, onOverridesUpdate]);

    // -------------------------------------------------------------------------
    // ACTIONS
    // -------------------------------------------------------------------------
    const handleSave = async () => {
        if (readOnly) return;

        const calories = parseInt(manualCalories, 10);
        
        if (!manualCalories || isNaN(calories) || calories <= 0) {
            toast({ title: "Valor inválido", description: "Introduce un número válido mayor a 0.", variant: "destructive" });
            return;
        }

        if (!userId) {
            toast({ title: "Error", description: "No se encontró el usuario.", variant: "destructive" });
            return;
        }

        try {
            setActionLoading(true);
            
            // Construct Payload
            // Fix: Removed incorrect columns if any existed, kept standard schema
            const payload = {
                user_id: userId,
                manual_calories: calories,
                diet_plan_id: dietPlanId || null
            };
            
            const { error } = await supabase
                .from('diet_plan_calorie_overrides')
                .insert([payload]);

            if (error) throw error;

            setManualCalories('');
            toast({ title: "Ajuste guardado", description: "El nuevo objetivo calórico ha sido establecido." });
            
            // Refresh list
            await fetchOverrides(); 

        } catch (error) {
             console.error("❌ Error saving override:", error);
             toast({ title: "Error", description: "No se pudo guardar el ajuste.", variant: "destructive" });
        } finally {
            setActionLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (readOnly) return;
        
        try {
            setActionLoading(true);
            
            const { error } = await supabase
                .from('diet_plan_calorie_overrides')
                .delete()
                .eq('id', id)
                .eq('user_id', userId); 

            if (error) throw error;
            
            toast({ title: "Eliminado", description: "Registro eliminado correctamente." });
            await fetchOverrides();
        } catch (error) {
            console.error("❌ Error deleting override:", error);
            toast({ title: "Error", description: "No se pudo eliminar el ajuste.", variant: "destructive" });
        } finally {
            setActionLoading(false);
        }
    };

    // -------------------------------------------------------------------------
    // STYLES & RENDER
    // -------------------------------------------------------------------------
    const targetBorderColor = isSystemTarget ? 'border-l-purple-500' : 'border-l-green-500';
    const targetTextColor = isSystemTarget ? 'text-purple-500' : 'text-green-500';
    const tdeeCardBorder = isSystemTarget ? 'border-l-4 border-l-purple-500' : 'border-l-4 border-l-gray-800/50';
    const hasInputValue = manualCalories && !isNaN(parseInt(manualCalories, 10)) && parseInt(manualCalories, 10) > 0;

    return (
        <TooltipProvider>
            <div className="space-y-6 bg-slate-900/50 p-6 rounded-xl border border-gray-800">
                {/* System TDEE Display */}
                <div className={cn(
                    "flex items-center justify-between p-4 bg-gray-950/50 rounded-lg border-y border-r border-gray-800/50 transition-colors duration-300",
                    tdeeCardBorder
                )}>
                    <div>
                        <h3 className="text-gray-400 text-sm font-medium flex items-center gap-2">
                            <Calculator className="w-4 h-4" />
                            TDEE Calculado (por Bibofit)
                        </h3>
                        <div className="flex items-baseline gap-2 mt-1">
                            <span className="text-xl font-bold text-white font-numeric">
                                {calculatedTdee}
                            </span>
                            <span className="text-sm text-gray-500">kcal</span>
                        </div>
                    </div>
                    {isSystemTarget && (
                         <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20 px-2 py-1 text-xs">
                            Usado como Objetivo
                         </Badge>
                    )}
                </div>

                {/* Active Target Display */}
                <div className={cn(
                    "p-5 bg-gradient-to-r from-gray-900 to-gray-800 border-l-4 rounded-lg shadow-lg relative overflow-hidden transition-colors duration-300",
                    targetBorderColor
                )}>
                     <div className="absolute top-0 right-0 p-4 opacity-5">
                        <Activity className="w-24 h-24 text-white" />
                    </div>
                    
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className={cn("text-sm font-bold uppercase tracking-wider flex items-center gap-2", targetTextColor)}>
                                Objetivo Vigente
                                {activeOverride ? (
                                    <Badge variant="outline" className="bg-green-500/10 border-green-500/20 text-green-400 px-2 py-0 text-[10px] h-5">
                                        Manual
                                    </Badge>
                                ) : (
                                    <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/20 px-2 py-0 text-[10px] h-5">
                                        Sistema
                                    </Badge>
                                )}
                            </h3>
                        </div>
                        
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-bold text-white font-numeric tracking-tight">
                                {effectiveTdee}
                            </span>
                            <span className="text-lg text-gray-500 font-medium">kcal/día</span>
                        </div>

                        {activeOverride && activeOverride.created_at && (
                            <div className="mt-3 flex items-center gap-2 text-xs text-gray-400 bg-black/20 w-fit px-3 py-1.5 rounded-full">
                                <History className="w-3.5 h-3.5" />
                                <span>
                                    Creado: {format(new Date(activeOverride.created_at), 'd MMM yyyy', { locale: es })}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Input Section */}
                <div className="space-y-3 pt-2">
                    <Label className="text-sm font-medium text-gray-300">Nuevo Ajuste Manual</Label>
                    <div className="flex items-center gap-3">
                        <div className="relative flex-1">
                            <Input 
                                type="number" 
                                placeholder="Ej: 2400"
                                value={manualCalories} 
                                onChange={e => setManualCalories(e.target.value)} 
                                className={cn(
                                    "bg-gray-900 border-gray-700 text-white placeholder:text-gray-600 pl-10 h-11 text-lg font-numeric transition-colors focus:border-green-500 focus:ring-1 focus:ring-green-500", 
                                    readOnly && "cursor-not-allowed opacity-50"
                                )}
                                disabled={readOnly || actionLoading}
                            />
                            <div className="absolute left-3 top-3 text-gray-500">
                                <Activity className="w-5 h-5"/>
                            </div>
                            <div className="absolute right-3 top-3.5 text-xs text-gray-500 font-medium pointer-events-none">
                                KCAL
                            </div>
                        </div>
                        <Button 
                            onClick={handleSave} 
                            disabled={readOnly || actionLoading || !hasInputValue}
                            className={cn(
                                "h-11 px-6 font-medium transition-all shadow-sm min-w-[120px]",
                                hasInputValue 
                                ? "bg-green-600 hover:bg-green-700 text-white shadow-green-900/20" 
                                : "bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed opacity-50"
                            )} 
                        >
                            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Save className="w-4 h-4 mr-2"/>}
                            Guardar
                        </Button>
                    </div>
                </div>

                {/* History Section */}
                <div className="pt-6 border-t border-gray-800 space-y-4">
                    <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                        <History className="w-3.5 h-3.5" />
                        Historial de Ajustes
                    </h5>

                    <CalorieAdjustmentHistory 
                        overrides={localOverrides}
                        loading={loading}
                        onDelete={handleDelete}
                        readOnly={readOnly}
                    />
                </div>
            </div>
        </TooltipProvider>
    );
};

export default CalorieAdjustment;