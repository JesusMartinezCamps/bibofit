import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2, Building2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const AssignToCenterDialog = ({ open, onOpenChange, template, onSuccess }) => {
    const { toast } = useToast();
    const { user } = useAuth();
    const [centers, setCenters] = useState([]);
    const [selectedCenterIds, setSelectedCenterIds] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open && template) {
            fetchData();
        } else {
            setSelectedCenterIds([]);
        }
    }, [open, template]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch all centers
            const { data: centersData, error: centersError } = await supabase
                .from('centers')
                .select('id, name')
                .order('name');
            
            if (centersError) throw centersError;
            setCenters(centersData || []);

            // 2. Fetch existing assignments for this template
            const { data: assignments, error: assignmentsError } = await supabase
                .from('diet_plan_centers')
                .select('center_id')
                .eq('diet_plan_id', template.id);

            if (assignmentsError) throw assignmentsError;

            const existingIds = assignments.map(a => a.center_id.toString());
            setSelectedCenterIds(existingIds);

        } catch (error) {
            console.error("Error fetching data:", error);
            toast({ 
                title: "Error", 
                description: "No se pudieron cargar los centros o asignaciones.", 
                variant: "destructive" 
            });
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = (centerId) => {
        const idStr = centerId.toString();
        setSelectedCenterIds(prev => {
            if (prev.includes(idStr)) {
                return prev.filter(id => id !== idStr);
            } else {
                return [...prev, idStr];
            }
        });
    };

    const handleSave = async () => {
        if (!template) return;
        setSaving(true);
        try {
            // 1. Delete all existing assignments for this template
            const { error: deleteError } = await supabase
                .from('diet_plan_centers')
                .delete()
                .eq('diet_plan_id', template.id);
            
            if (deleteError) throw deleteError;

            // 2. Insert new assignments
            if (selectedCenterIds.length > 0) {
                const rowsToInsert = selectedCenterIds.map(centerId => ({
                    diet_plan_id: template.id,
                    center_id: parseInt(centerId),
                    assigned_by: user.id
                }));

                const { error: insertError } = await supabase
                    .from('diet_plan_centers')
                    .insert(rowsToInsert);
                
                if (insertError) throw insertError;
            }

            toast({ title: "Asignaciones actualizadas", description: "La plantilla se ha vinculado correctamente a los centros seleccionados." });
            if (onSuccess) onSuccess();
            onOpenChange(false);

        } catch (error) {
            console.error("Error saving assignments:", error);
            toast({ 
                title: "Error al guardar", 
                description: "Hubo un problema actualizando las asignaciones.", 
                variant: "destructive" 
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-[#1a1e23] border-gray-700 text-white max-w-md">
                <DialogHeader>
                    <DialogTitle>Asignar a Organizaciones</DialogTitle>
                    <DialogDescription>
                        Selecciona los centros donde esta plantilla global debe estar disponible explícitamente.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-green-500" />
                        </div>
                    ) : centers.length === 0 ? (
                        <p className="text-gray-400 text-center italic">No hay centros registrados en el sistema.</p>
                    ) : (
                        <div className="space-y-2">
                            {centers.map(center => (
                                <div 
                                    key={center.id} 
                                    className="flex items-center space-x-3 p-3 rounded-lg border border-gray-800 bg-gray-900/50 hover:bg-gray-800 transition-colors cursor-pointer"
                                    onClick={() => handleToggle(center.id)}
                                >
                                    <Checkbox 
                                        id={`center-${center.id}`} 
                                        checked={selectedCenterIds.includes(center.id.toString())}
                                        onCheckedChange={() => handleToggle(center.id)}
                                        className="border-gray-500 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                                    />
                                    <Label 
                                        htmlFor={`center-${center.id}`} 
                                        className="cursor-pointer flex-grow flex items-center gap-2 text-sm font-medium"
                                    >
                                        <Building2 className="w-4 h-4 text-gray-400" />
                                        {center.name}
                                    </Label>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSave} disabled={saving || loading} className="bg-green-600 hover:bg-green-500 text-white">
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Guardar Asignaciones
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default AssignToCenterDialog;