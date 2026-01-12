
import React, { useState, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { History, Save, Trash2, Edit, CalendarPlus as CalendarIcon, Lock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const CalorieAdjustment = ({ 
    calculatedTdee, 
    calorieOverrides, 
    dietPlanId, 
    onOverridesUpdate,
    isOffline = false,
    onOfflineChange,
    readOnly = false
}) => {
    const { toast } = useToast();
    const [manualCalories, setManualCalories] = useState('');
    const [editingOverrideId, setEditingOverrideId] = useState(null);
    const [editingCalories, setEditingCalories] = useState('');

    const effectiveTdee = useMemo(() => {
        const today = new Date().toISOString().slice(0, 10);
        const applicableOverride = calorieOverrides
            .filter(o => o.effective_date <= today)
            .sort((a, b) => new Date(b.effective_date) - new Date(a.effective_date))[0];
        
        return applicableOverride ? applicableOverride.manual_calories : calculatedTdee;
    }, [calculatedTdee, calorieOverrides]);

    const handleSaveManualCalories = async () => {
        if (readOnly) {
             toast({
                title: "Función Bloqueada",
                description: "Mejora tu plan para poder ajustar tus calorías manualmente.",
                variant: "destructive"
            });
            return;
        }
        const calories = parseInt(manualCalories, 10);
        if (isNaN(calories) || calories <= 0) {
            toast({ title: 'Error', description: 'Introduce un valor de calorías válido.', variant: 'destructive' });
            return;
        }

        const today = new Date().toISOString().slice(0, 10);

        if (isOffline) {
            if (onOfflineChange) {
                // In offline mode, we create a mock override object
                onOfflineChange({
                    type: 'add',
                    data: {
                        id: Date.now(), // Temporary ID
                        effective_date: today,
                        manual_calories: calories
                    }
                });
                setManualCalories('');
                toast({ title: 'Ajuste Aplicado', description: 'Calorías manuales aplicadas localmente.' });
            }
            return;
        }
        
        const { error } = await supabase.from('diet_plan_calorie_overrides').insert({
            diet_plan_id: dietPlanId,
            effective_date: today,
            manual_calories: calories
        });

        if (error) {
            toast({ title: 'Error', description: `No se pudo guardar el ajuste: ${error.message}`, variant: 'destructive' });
        } else {
            toast({ title: 'Éxito', description: 'Ajuste de calorías guardado.' });
            setManualCalories('');
            if (onOverridesUpdate) onOverridesUpdate();
        }
    };

    const handleUpdateOverride = async (overrideId) => {
         if (readOnly) return;
        const calories = parseInt(editingCalories, 10);
        if (isNaN(calories) || calories <= 0) {
            toast({ title: 'Error', description: 'Introduce un valor de calorías válido.', variant: 'destructive' });
            return;
        }

        if (isOffline) {
            if (onOfflineChange) {
                onOfflineChange({
                    type: 'update',
                    id: overrideId,
                    value: calories
                });
                setEditingOverrideId(null);
                setEditingCalories('');
                toast({ title: 'Actualizado', description: 'Ajuste actualizado localmente.' });
            }
            return;
        }

        const { error } = await supabase.from('diet_plan_calorie_overrides').update({ manual_calories: calories }).eq('id', overrideId);
        if (error) {
            toast({ title: 'Error', description: `No se pudo actualizar: ${error.message}`, variant: 'destructive' });
        } else {
            toast({ title: 'Éxito', description: 'Ajuste actualizado.' });
            setEditingOverrideId(null);
            setEditingCalories('');
            if (onOverridesUpdate) onOverridesUpdate();
        }
    };

    const handleDeleteOverride = async (overrideId) => {
        if (readOnly) return;
        if (isOffline) {
            if (onOfflineChange) {
                onOfflineChange({
                    type: 'delete',
                    id: overrideId
                });
                toast({ title: 'Eliminado', description: 'Ajuste eliminado localmente.' });
            }
            return;
        }

        const { error } = await supabase.from('diet_plan_calorie_overrides').delete().eq('id', overrideId);
        if (error) {
            toast({ title: 'Error', description: `No se pudo eliminar: ${error.message}`, variant: 'destructive' });
        } else {
            toast({ title: 'Éxito', description: 'Ajuste eliminado.' });
            if (onOverridesUpdate) onOverridesUpdate();
        }
    };

    return (
        <div className="p-4 rounded-lg border border-gray-700 space-y-4 bg-slate-900/50">
            <h4 className="font-semibold text-lg text-white flex items-center gap-2">
                Ajuste de Calorías Diarias
                {readOnly && <Lock className="w-4 h-4 text-gray-500"/>}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div className="p-4 rounded-lg space-y-4 bg-gray-800/30 border border-gray-700/50">
                    <div className="flex items-center justify-between">
                        <Label className="text-gray-300">TDEE Calculado</Label>
                        <p className="text-2xl font-bold text-cyan-400 font-numeric">~{calculatedTdee} kcal</p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="manual-calories" className="text-gray-300">Ajuste Manual (hoy)</Label>
                        <div className="flex items-center gap-2">
                            <Input 
                                id="manual-calories" 
                                type="number" 
                                placeholder="Ej: 2500" 
                                value={manualCalories} 
                                onChange={e => setManualCalories(e.target.value)} 
                                className={cn("bg-gray-900 border-gray-600 text-white placeholder:text-gray-500", readOnly && "cursor-not-allowed opacity-50")}
                                disabled={readOnly}
                            />
                            <Button onClick={handleSaveManualCalories} size="sm" className="bg-green-600 hover:bg-green-700 text-white shrink-0" disabled={readOnly}>
                                <Save className="w-4 h-4"/>
                            </Button>
                        </div>
                        <p className="text-xs text-gray-500">Introduce un valor para sobrescribir el TDEE. {isOffline ? "Se aplicará a este plan." : "Se guardará en el historial."}</p>
                    </div>
                    <div className="border-t border-gray-700 pt-3 flex justify-between items-center">
                        <Label className="text-white font-semibold">Calorías Efectivas</Label>
                        <p className="text-3xl font-bold text-green-400 font-numeric">~{effectiveTdee} kcal</p>
                    </div>
                </div>
                
                <div className="p-4 rounded-lg space-y-3 bg-gray-800/30 border border-gray-700/50 h-full">
                    <h5 className="font-semibold flex items-center gap-2 text-gray-300">
                        <History className="w-4 h-4 text-purple-400"/> Historial
                    </h5>
                    <div className="max-h-48 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                        {calorieOverrides.length > 0 ? calorieOverrides.map(o => (
                            <div key={o.id} className="flex items-center justify-between text-sm bg-gray-900/80 p-2 rounded border border-gray-700">
                                <div className="flex items-center gap-2 text-gray-400">
                                    <CalendarIcon className="w-3 h-3"/>
                                    <span>{format(parseISO(o.effective_date), "d MMM", { locale: es })}:</span>
                                </div>
                                {editingOverrideId === o.id ? (
                                    <Input 
                                        type="number" 
                                        value={editingCalories} 
                                        onChange={e => setEditingCalories(e.target.value)} 
                                        className="h-7 w-20 text-center bg-gray-800 border-gray-600 text-xs" 
                                        autoFocus 
                                    />
                                ) : (
                                    <div className="ml-auto font-bold text-purple-300 text-right w-20 font-numeric">
                                        {o.manual_calories}
                                    </div>
                                )}
                                {!readOnly && (
                                    <div className="flex items-center gap-1 ml-2">
                                        {editingOverrideId === o.id ? (
                                            <Button onClick={() => handleUpdateOverride(o.id)} variant="ghost" size="icon" className="h-6 w-6 text-green-400 hover:bg-green-900/20 hover:text-green-300">
                                                <Save className="w-3 h-3"/>
                                            </Button>
                                        ) : (
                                            <Button onClick={() => { setEditingOverrideId(o.id); setEditingCalories(o.manual_calories); }} variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:bg-gray-800 hover:text-white">
                                                <Edit className="w-3 h-3"/>
                                            </Button>
                                        )}
                                        <Button onClick={() => handleDeleteOverride(o.id)} variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:bg-red-900/20 hover:text-red-400">
                                            <Trash2 className="w-3 h-3"/>
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )) : (
                            <div className="flex flex-col items-center justify-center h-24 text-gray-500 italic text-xs">
                                <span>No hay ajustes activos.</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CalorieAdjustment;
