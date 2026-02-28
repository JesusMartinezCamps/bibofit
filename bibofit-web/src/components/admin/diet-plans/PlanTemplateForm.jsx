import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Globe, Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from '@/contexts/AuthContext';


const PlanTemplateForm = ({ open, onOpenChange, template, onSuccess, centerId }) => {
    const { toast } = useToast();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [name, setName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [scope, setScope] = useState('global'); // 'global' or 'center'
    const [selectedCenterId, setSelectedCenterId] = useState(null);
    const [centersList, setCentersList] = useState([]);
    const [coachCenterName, setCoachCenterName] = useState('');
    const userRole = user?.role;


    useEffect(() => {
        const fetchCenters = async () => {
            if (userRole === 'admin') {
                const { data } = await supabase.from('centers').select('id, name').order('name');
                setCentersList(data || []);
            } else if (centerId) {
                 const { data } = await supabase.from('centers').select('name').eq('id', centerId).single();
                 if (data) setCoachCenterName(data.name);
            }
        };

        if (open) {
            fetchCenters();
            if (template) {
                setName(template.name || '');
                setScope(template.template_scope || 'global');
                setSelectedCenterId(template.center_id?.toString());
            } else {
                setName('');
                // Defaults: Admin -> Global, Coach -> Center
                if (userRole === 'admin') {
                    setScope('global');
                    setSelectedCenterId(null);
                } else {
                    setScope('center');
                    setSelectedCenterId(centerId);
                }
            }
        }
    }, [open, template, userRole, centerId]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) {
            toast({ title: "Nombre requerido", description: "Por favor, introduce un nombre para la plantilla." });
            return;
        }
        
        if (userRole === 'admin' && scope === 'center' && !selectedCenterId) {
             toast({ title: "Centro requerido", description: "Por favor, selecciona un centro para la plantilla." });
             return;
        }

        setIsSubmitting(true);

        try {
            const { data: { user: currentUser } } = await supabase.auth.getUser();

            const templateData = {
                name: name.trim(),
                is_template: true,
                template_scope: scope,
                center_id: scope === 'center' ? (userRole === 'admin' ? selectedCenterId : centerId) : null,
                created_by: currentUser.id, // Set created_by for new templates or updates
            };

            let newTemplateId;

            if (template?.id) {
                newTemplateId = template.id;
                const { error } = await supabase.from('diet_plans').update(templateData).eq('id', template.id);
                if (error) throw error;
                toast({ title: 'Éxito', description: `Plantilla actualizada correctamente.` });
            } else {
                // If coach tries to create global, block it or force center
                if (userRole !== 'admin' && scope === 'global') {
                   throw new Error("No tienes permisos para crear plantillas globales.");
                }
                 // If scope is center but no centerId for coach
                if (scope === 'center' && !centerId && userRole !== 'admin') {
                    throw new Error("No se ha encontrado un centro asociado a tu cuenta.");
                }

                const { data, error } = await supabase.from('diet_plans').insert(templateData).select('id').single();
                if (error) throw error;
                newTemplateId = data.id;
                toast({ title: 'Éxito', description: `Plantilla creada correctamente.` });
            }

            if (onSuccess) onSuccess();
            navigate(`/admin-panel/plan-detail/${newTemplateId}`);

        } catch (error) {
            toast({ title: "Error", description: error.message, variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleClose = () => {
      if (!isSubmitting) {
        onOpenChange(false);
      }
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="bg-[#1a1e23] border-gray-700 text-white max-w-md">
                <DialogHeader>
                    <DialogTitle>{template ? 'Renombrar Plantilla' : 'Nueva Plantilla de Dieta'}</DialogTitle>
                    <DialogDescription>
                        {template ? 'Introduce el nuevo nombre para la plantilla.' : 'Configura los detalles básicos de la nueva plantilla.'}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="planName" className="text-gray-300">Nombre</Label>
                        <Input 
                            id="planName" 
                            value={name} 
                            onChange={e => setName(e.target.value)} 
                            placeholder="Ej: Dieta Hipertrofia" 
                            className="input-field mt-1" 
                            autoFocus
                        />
                    </div>
                    
                    <div className="space-y-3">
                        <Label className="text-gray-300">Ámbito de la Plantilla</Label>
                        
                        {userRole === 'admin' ? (
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <div 
                                        className={`cursor-pointer border rounded-lg p-4 flex flex-col items-center justify-center gap-2 transition-all ${scope === 'global' ? 'bg-blue-900/20 border-blue-500 text-blue-400 ring-1 ring-blue-500' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}
                                        onClick={() => setScope('global')}
                                    >
                                        <Globe className="w-6 h-6" />
                                        <span className="text-sm font-medium">Global</span>
                                    </div>
                                    
                                    <div 
                                        className={`cursor-pointer border rounded-lg p-4 flex flex-col items-center justify-center gap-2 transition-all ${scope === 'center' ? 'bg-amber-900/20 border-amber-500 text-amber-400 ring-1 ring-amber-500' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}
                                        onClick={() => setScope('center')}
                                    >
                                        <Building2 className="w-6 h-6" />
                                        <span className="text-sm font-medium">Centro</span>
                                    </div>
                                </div>
                                
                                {scope === 'center' && (
                                    <div className="space-y-1 animate-in fade-in slide-in-from-top-2 duration-200">
                                        <Label className="text-xs text-gray-400">Seleccionar Centro</Label>
                                        <Select value={selectedCenterId || ''} onValueChange={setSelectedCenterId}>
                                            <SelectTrigger className="bg-gray-900 border-gray-700">
                                                <SelectValue placeholder="Selecciona un centro..." />
                                            </SelectTrigger>
                                            <SelectContent className="bg-[#1a1e23] border-gray-700 text-white">
                                                {centersList.map(center => (
                                                    <SelectItem key={center.id} value={center.id.toString()}>
                                                        {center.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>
                        ) : (
                            // View for Coaches
                            <div className="w-full p-4 bg-gray-800/50 border border-gray-700 rounded-lg flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-amber-900/30 flex items-center justify-center text-amber-400 shrink-0">
                                    <Building2 className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-white">Plantilla de Centro</p>
                                    <p className="text-xs text-gray-400">
                                        Esta plantilla será visible solo para los miembros de <span className="text-amber-300 font-semibold">{coachCenterName || 'tu centro'}</span>.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={handleClose} disabled={isSubmitting}>Cancelar</Button>
                        <Button type="submit" disabled={isSubmitting} className="bg-green-600 hover:bg-green-700 text-white">
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {template ? 'Guardar' : 'Crear y Editar'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default PlanTemplateForm;