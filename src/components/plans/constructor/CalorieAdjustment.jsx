import React, { useState, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { History, Save, Trash2, Edit, CalendarPlus as CalendarIcon } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const CalorieAdjustment = ({ calculatedTdee, calorieOverrides, dietPlanId, onOverridesUpdate }) => {
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
        const calories = parseInt(manualCalories, 10);
        if (isNaN(calories) || calories <= 0) {
            toast({ title: 'Error', description: 'Introduce un valor de calorías válido.', variant: 'destructive' });
            return;
        }
        
        const { error } = await supabase.from('diet_plan_calorie_overrides').insert({
            diet_plan_id: dietPlanId,
            effective_date: new Date().toISOString().slice(0, 10),
            manual_calories: calories
        });

        if (error) {
            toast({ title: 'Error', description: `No se pudo guardar el ajuste: ${error.message}`, variant: 'destructive' });
        } else {
            toast({ title: 'Éxito', description: 'Ajuste de calorías guardado.' });
            setManualCalories('');
            onOverridesUpdate();
        }
    };

    const handleUpdateOverride = async (overrideId) => {
        const calories = parseInt(editingCalories, 10);
        if (isNaN(calories) || calories <= 0) {
            toast({ title: 'Error', description: 'Introduce un valor de calorías válido.', variant: 'destructive' });
            return;
        }
        const { error } = await supabase.from('diet_plan_calorie_overrides').update({ manual_calories: calories }).eq('id', overrideId);
        if (error) {
            toast({ title: 'Error', description: `No se pudo actualizar: ${error.message}`, variant: 'destructive' });
        } else {
            toast({ title: 'Éxito', description: 'Ajuste actualizado.' });
            setEditingOverrideId(null);
            setEditingCalories('');
            onOverridesUpdate();
        }
    };

    const handleDeleteOverride = async (overrideId) => {
        const { error } = await supabase.from('diet_plan_calorie_overrides').delete().eq('id', overrideId);
        if (error) {
            toast({ title: 'Error', description: `No se pudo eliminar: ${error.message}`, variant: 'destructive' });
        } else {
            toast({ title: 'Éxito', description: 'Ajuste eliminado.' });
            onOverridesUpdate();
        }
    };

    return (
        <div className="p-4 rounded-lg border border-gray-700 space-y-4">
            <h4 className="font-semibold text-lg">Calorías Diarias</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div className="p-4 rounded-lg space-y-4">
                    <div className="flex items-center justify-between">
                        <Label>TDEE Calculado</Label>
                        <p className="text-2xl font-bold text-cyan-400">~{calculatedTdee} kcal</p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="manual-calories">Ajuste Manual de Calorías (hoy)</Label>
                        <div className="flex items-center gap-2">
                            <Input id="manual-calories" type="number" placeholder="Ej: 2500" value={manualCalories} onChange={e => setManualCalories(e.target.value)} className="input-field" />
                            <Button onClick={handleSaveManualCalories} size="sm" className="bg-green-600 hover:bg-green-700"><Save className="w-4 h-4"/></Button>
                        </div>
                        <p className="text-xs text-gray-400">Introduce un valor para usarlo hoy. Se guardará en el historial.</p>
                    </div>
                    <div className="border-t border-gray-700 pt-3">
                        <Label>Calorías Efectivas para Hoy</Label>
                        <p className="text-3xl font-bold text-green-400">~{effectiveTdee} kcal</p>
                    </div>
                </div>
                <div className="p-4 rounded-lg space-y-3">
                    <h5 className="font-semibold flex items-center gap-2"><History className="w-5 h-5 text-purple-400"/> Historial de Ajustes</h5>
                    <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
                        {calorieOverrides.length > 0 ? calorieOverrides.map(o => (
                            <div key={o.id} className="flex items-center justify-between text-sm bg-gray-800/70 p-2 rounded">
                                <div className="flex items-center gap-2">
                                    <CalendarIcon className="w-4 h-4 text-gray-400"/>
                                    <span>{format(parseISO(o.effective_date), "d 'de' LLLL, yyyy", { locale: es })}:</span>
                                </div>
                                {editingOverrideId === o.id ? (
                                    <Input type="number" value={editingCalories} onChange={e => setEditingCalories(e.target.value)} className="input-field w-24 h-8 text-center" autoFocus />
                                ) : (//aqui
                                        <div className="ml-auto font-bold text-purple-300 text-right w-24">
                                            {o.manual_calories} kcal
                                        </div>
                                )}
                                <div className="flex items-center">
                                    {editingOverrideId === o.id ? (
                                        <Button onClick={() => handleUpdateOverride(o.id)} variant="ghost" size="icon" className="h-7 w-7 text-green-400"><Save className="w-4 h-4"/></Button>
                                    ) : (
                                        <Button onClick={() => { setEditingOverrideId(o.id); setEditingCalories(o.manual_calories); }} variant="ghost" size="icon" className="h-7 w-7 text-gray-400"><Edit className="w-4 h-4"/></Button>
                                    )}
                                    <Button onClick={() => handleDeleteOverride(o.id)} variant="ghost" size="icon" className="h-7 w-7 text-red-500"><Trash2 className="w-4 h-4"/></Button>
                                </div>
                            </div>
                        )) : <p className="text-gray-500 italic text-xs text-center py-4">No hay ajustes manuales.</p>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CalorieAdjustment;