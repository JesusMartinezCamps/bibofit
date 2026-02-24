import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, X } from 'lucide-react';
import { Combobox } from '@/components/ui/combobox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const SensitivityBadge = ({ sensitivity, onRemove, isSaving }) => {
    return (
        <Badge variant="destructive" className="bg-orange-900/50 border border-orange-700/60 text-orange-300 px-2 py-1 h-auto">
            {sensitivity.name}
            <button type="button" onClick={() => onRemove(sensitivity.id)} disabled={isSaving} className="ml-2 hover:text-white disabled:opacity-50">
                <X size={14}/>
            </button>
        </Badge>
    );
};

const ConditionBadge = ({ condition, onRemove, isSaving }) => {
    return (
        <Badge variant="destructive" className="bg-red-900/50 border border-red-500/30 text-red-300 px-2 py-1 h-auto">
            {condition.name}
            <button type="button" onClick={() => onRemove(condition.id)} disabled={isSaving} className="ml-2 hover:text-white disabled:opacity-50">
                <X size={14}/>
            </button>
        </Badge>
    );
};

const RestrictionsManager = ({ entityId, entityType, onUpdate, className, hideHeader = false }) => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [allSensitivities, setAllSensitivities] = useState([]);
    const [allMedicalConditions, setAllMedicalConditions] = useState([]);
    
    const [selectedSensitivities, setSelectedSensitivities] = useState([]);
    const [selectedMedicalConditions, setSelectedMedicalConditions] = useState([]);

    const linkTables = useMemo(() => ({
        profiles: {
            sensitivities: 'user_sensitivities',
            medical_conditions: 'user_medical_conditions',
            entityIdColumn: 'user_id',
            sensitivityLevelColumn: 'sensitivitie_level',
        },
        diet_plans: {
            sensitivities: 'diet_plan_sensitivities',
            medical_conditions: 'diet_plan_medical_conditions',
            entityIdColumn: 'diet_plan_id',
            sensitivityLevelColumn: 'level',
        }
    }), []);

    const tables = useMemo(() => linkTables[entityType], [entityType, linkTables]);

    const fetchData = useCallback(async () => {
        if (!entityId || !entityType) return;
        setLoading(true);
        try {
            const [
                sensitivitiesRes, userSensitivitiesRes,
                medicalConditionsRes, userMedicalConditionsRes
            ] = await Promise.all([
                supabase.from('sensitivities').select('id, name, description').order('name'),
                supabase.from(tables.sensitivities).select(`sensitivity_id, level: ${tables.sensitivityLevelColumn}`).eq(tables.entityIdColumn, entityId),
                supabase.from('medical_conditions').select('id, name, description').order('name'),
                supabase.from(tables.medical_conditions).select('condition_id').eq(tables.entityIdColumn, entityId),
            ]);

            if (sensitivitiesRes.error) throw sensitivitiesRes.error;
            if (userSensitivitiesRes.error) throw userSensitivitiesRes.error;
            if (medicalConditionsRes.error) throw medicalConditionsRes.error;
            if (userMedicalConditionsRes.error) throw userMedicalConditionsRes.error;

            setAllSensitivities(sensitivitiesRes.data || []);
            setSelectedSensitivities((userSensitivitiesRes.data || []).map(s => ({ id: s.sensitivity_id, level: s.level || 'Leve' })));
            setAllMedicalConditions(medicalConditionsRes.data || []);
            setSelectedMedicalConditions((userMedicalConditionsRes.data || []).map(c => c.condition_id));

        } catch (error) {
            console.error('Error loading restrictions', error);
        } finally {
            setLoading(false);
        }
    }, [entityId, entityType, tables]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleAddRestriction = async (type, id) => {
        if (!id) return;
        
        setIsSaving(true);
        const linkTable = type === 'sensitivity' ? tables.sensitivities : tables.medical_conditions;
        const idColumn = type === 'sensitivity' ? 'sensitivity_id' : 'condition_id';
        
        const insertData = { [tables.entityIdColumn]: entityId, [idColumn]: id };
        if (type === 'sensitivity') {
            insertData[tables.sensitivityLevelColumn] = 'Leve'; 
        }

        const { error } = await supabase.from(linkTable).insert(insertData);
        
        if (error) {
            toast({ title: "Error", description: `No se pudo añadir la restricción: ${error.message}`, variant: "destructive" });
        } else {
            await fetchData();
            if (onUpdate) onUpdate(true);
        }
        setIsSaving(false);
    };

    const handleRemoveRestriction = async (type, id) => {
        setIsSaving(true);
        const linkTable = type === 'sensitivity' ? tables.sensitivities : tables.medical_conditions;
        const idColumn = type === 'sensitivity' ? 'sensitivity_id' : 'condition_id';

        const { error } = await supabase.from(linkTable)
            .delete()
            .eq(tables.entityIdColumn, entityId)
            .eq(idColumn, id);
        
        if (error) {
            toast({ title: "Error", description: `No se pudo quitar la restricción: ${error.message}`, variant: "destructive" });
        } else {
            await fetchData();
            if (onUpdate) onUpdate(true);
        }
        setIsSaving(false);
    };

    const availableSensitivities = useMemo(() => allSensitivities
        .filter(s => !selectedSensitivities.some(ss => ss.id === s.id))
        .map(s => ({ value: s.id, label: s.name })), [allSensitivities, selectedSensitivities]);

    const availableMedicalConditions = useMemo(() => allMedicalConditions
        .filter(c => !selectedMedicalConditions.includes(c.id))
        .map(c => ({ value: c.id, label: c.name })), [allMedicalConditions, selectedMedicalConditions]);

    if (loading) {
        return <div className="flex justify-center items-center h-20"><Loader2 className="w-6 h-6 animate-spin text-green-500" /></div>;
    }
    
    return (
        <div className={cn("space-y-4", className)}>
            {!hideHeader && (
                <div className="border-b border-gray-700/50 pb-4 mb-4">
                    <Label className="text-xl font-bold text-white mb-1 block">Gestor de Restricciones</Label>
                    <p className="text-sm text-gray-400">Añade o elimina sensibilidades y condiciones médicas.</p>
                </div>
            )}
            
            <div className={cn("grid gap-6", hideHeader ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1")}>
                <div className="space-y-2">
                    <Label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">Sensibilidades (Evitar)</Label>
                    <div className="flex flex-col gap-2">
                        <Combobox
                            options={availableSensitivities}
                            onSelect={(val) => handleAddRestriction('sensitivity', val)}
                            placeholder="Seleccionar..."
                            searchPlaceholder="Buscar..."
                            noResultsText="No encontradas."
                            disabled={isSaving}
                            triggerClassName="bg-[#0F1627] border-gray-700"
                        />
                        <div className="flex flex-wrap gap-2 min-h-[2rem]">
                            {selectedSensitivities.map(s => {
                                const details = allSensitivities.find(as => as.id === s.id);
                                return details ? (
                                    <SensitivityBadge
                                        key={s.id}
                                        sensitivity={{ ...details, level: s.level }}
                                        onRemove={() => handleRemoveRestriction('sensitivity', s.id)}
                                        isSaving={isSaving}
                                    />
                                ) : null;
                            })}
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">Condiciones (Apto para)</Label>
                    <div className="flex flex-col gap-2">
                        <Combobox
                            options={availableMedicalConditions}
                            onSelect={(val) => handleAddRestriction('medical_condition', val)}
                            placeholder="Seleccionar..."
                            searchPlaceholder="Buscar..."
                            noResultsText="No encontradas."
                            disabled={isSaving}
                            triggerClassName="bg-[#0F1627] border-gray-700"
                        />
                        <div className="flex flex-wrap gap-2 min-h-[2rem]">
                            {selectedMedicalConditions.map(cId => {
                                const details = allMedicalConditions.find(amc => amc.id === cId);
                                return details ? (
                                    <ConditionBadge
                                        key={cId}
                                        condition={details}
                                        onRemove={() => handleRemoveRestriction('medical_condition', cId)}
                                        isSaving={isSaving}
                                    />
                                ) : null;
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RestrictionsManager;