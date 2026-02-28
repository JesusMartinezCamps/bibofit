import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Combobox } from '@/components/ui/combobox';
import { Label } from '@/components/ui/label';

const PlanConfiguration = ({ plan, onUpdate }) => {
    const { toast } = useToast();
    const [allSensitivities, setAllSensitivities] = useState([]);
    const [allConditions, setAllConditions] = useState([]);
    const [selectedRestrictionIds, setSelectedRestrictionIds] = useState([]);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const fetchRestrictions = async () => {
            const { data: sensitivities, error: sensError } = await supabase.from('sensitivities').select('id, name').order('name');
            if (sensError) console.error(sensError);
            else setAllSensitivities(sensitivities || []);

            const { data: conditions, error: condError } = await supabase.from('medical_conditions').select('id, name').order('name');
            if (condError) console.error(condError);
            else setAllConditions(conditions || []);
        };
        fetchRestrictions();
    }, []);

    useEffect(() => {
        const sensitivityIds = plan.sensitivities?.map(s => `sens-${s.id}`) || [];
        const conditionIds = plan.medical_conditions?.map(c => `cond-${c.id}`) || [];
        setSelectedRestrictionIds([...sensitivityIds, ...conditionIds]);
    }, [plan.sensitivities, plan.medical_conditions]);

    const handleRestrictionChange = useCallback(async (newSelectedIds) => {
        setIsSaving(true);
        const currentIds = selectedRestrictionIds;
        setSelectedRestrictionIds(newSelectedIds);

        const added = newSelectedIds.filter(id => !currentIds.includes(id));
        const removed = currentIds.filter(id => !newSelectedIds.includes(id));

        try {
            for (const id of removed) {
                const [type, numericId] = id.split('-');
                const table = type === 'sens' ? 'diet_plan_sensitivities' : 'diet_plan_medical_conditions';
                const column = type === 'sens' ? 'sensitivity_id' : 'condition_id';
                const { error } = await supabase.from(table).delete().eq('diet_plan_id', plan.id).eq(column, numericId);
                if (error) throw error;
            }

            for (const id of added) {
                const [type, numericId] = id.split('-');
                const table = type === 'sens' ? 'diet_plan_sensitivities' : 'diet_plan_medical_conditions';
                const column = type === 'sens' ? 'sensitivity_id' : 'condition_id';
                const { error } = await supabase.from(table).insert({ diet_plan_id: plan.id, [column]: numericId });
                if (error) throw error;
            }
            
            if (onUpdate) onUpdate(false); // false to prevent full reload

        } catch (error) {
            toast({ title: 'Error', description: `No se pudieron actualizar las restricciones: ${error.message}`, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    }, [plan.id, toast, onUpdate, selectedRestrictionIds]);
    
    const restrictionOptions = useMemo(() => ({
        "Sensibilidades": allSensitivities.map(s => ({ value: `sens-${s.id}`, label: s.name })),
        "Condiciones Médicas": allConditions.map(c => ({ value: `cond-${c.id}`, label: c.name })),
    }), [allSensitivities, allConditions]);

    return (
        <div className="space-y-4">
            <div>
                <Label className="text-gray-300 mb-1 block">Restricciones de la Plantilla</Label>
                <Combobox
                    optionsGrouped={restrictionOptions}
                    selectedValues={selectedRestrictionIds}
                    onSelectedValuesChange={handleRestrictionChange}
                    placeholder="Seleccionar restricciones..."
                    searchPlaceholder="Buscar..."
                    noResultsText="No se encontraron."
                    isMultiSelect
                />
            </div>
            <p className="text-xs text-gray-400 mt-2">Las recetas que contengan estas restricciones se marcarán para su revisión al añadirlas a este plan.</p>
        </div>
    );
};

export default PlanConfiguration;