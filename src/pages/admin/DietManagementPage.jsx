import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import DietManagementLayout from '@/components/admin/diet-plans/DietManagementLayout';
import ClientDietSummary from '@/components/admin/diet-plans/ClientDietSummary';
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2 } from 'lucide-react';
import PlanCard from '@/components/admin/diet-plans/PlanCard';
import AssignPlanDialog from '@/components/admin/diet-plans/AssignPlanDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import TemplateCard from '@/components/admin/diet-plans/TemplateCard';
import PlanRecipesView from '@/components/admin/diet-plans/PlanRecipesView';

const TemplatePreviewDialog = ({ open, onOpenChange, template, onAssign, clientRestrictions }) => {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-full sm:w-[90vw] sm:max-w-[90vw] max-w-none h-[90vh] bg-[#1a1e23] border-gray-700 text-white flex flex-col p-0 overflow-hidden">
                <DialogHeader className="px-6 py-4 bg-gray-900 border-b border-gray-800">
                    <DialogTitle className="text-xl">Vista Previa: {template?.name}</DialogTitle>
                    <DialogDescription>Revisa el contenido de la plantilla antes de asignarla. Verás alertas si hay conflictos con las restricciones del cliente.</DialogDescription>
                </DialogHeader>
                <div className="flex-grow overflow-y-auto p-6 styled-scrollbar-green">
                    {template && (
                        <PlanRecipesView 
                            plan={template} 
                            readOnly={true}
                            clientRestrictions={clientRestrictions}
                        />
                    )}
                </div>
                <DialogFooter className="px-6 py-4 bg-gray-900 border-t border-gray-800 flex justify-between sm:justify-between">
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cerrar</Button>
                    <Button onClick={onAssign} className="bg-green-600 hover:bg-green-500 text-white">
                        Asignar esta Plantilla
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const SelectTemplateDialog = ({ open, onOpenChange, templates, onSelect, loading, onPreview }) => {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-full sm:w-[90vw] sm:max-w-[90vw] max-w-none h-[80vh] bg-[#1a1e23] border-gray-700 text-white flex flex-col">
                <DialogHeader>
                    <DialogTitle>Seleccionar Plantilla de Dieta</DialogTitle>
                    <DialogDescription>Elige una plantilla para asignar al cliente. Haz clic en una tarjeta para ver el detalle.</DialogDescription>
                </DialogHeader>
                <div className="flex-grow overflow-y-auto mt-2 pr-2 styled-scrollbar-green">
                    {loading ? (
                        <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-green-500" /></div>
                    ) : templates.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {templates.map(template => (
                                <div key={template.id} className="h-full">
                                    <TemplateCard 
                                        template={template} 
                                        onAssign={() => onSelect(template)} 
                                        onCardClick={() => onPreview(template)}
                                    />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center text-gray-400 p-8"><p>No se encontraron plantillas.</p></div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

const DietManagementPage = () => {
    const { userId } = useParams();
    const { toast } = useToast();
    const [client, setClient] = useState(null);
    const [dietPlans, setDietPlans] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingTemplates, setLoadingTemplates] = useState(false);
    
    // Dialog states
    const [isSelectTemplateOpen, setIsSelectTemplateOpen] = useState(false);
    const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
    const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
    
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [previewTemplate, setPreviewTemplate] = useState(null);
    
    const fetchClientData = useCallback(async (showLoading = true) => {
        if (showLoading) setLoading(true);
        try {
            const { data: clientData, error: clientError } = await supabase
                .from('profiles')
                .select(`
                    *,
                    activity_levels (*),
                    user_sensitivities(sensitivities(id, name)),
                    user_medical_conditions(medical_conditions(id, name))
                `)
                .eq('user_id', userId)
                .single();

            if (clientError) throw clientError;
            
            const { data: plansData, error: plansError } = await supabase
                .from('diet_plans')
                .select(`
                    *,
                    source_template:source_template_id (name)
                `)
                .eq('user_id', userId)
                .eq('is_template', false)
                .order('is_active', { ascending: false })
                .order('created_at', { ascending: false });

            if (plansError) throw plansError;
            
            setClient(clientData);
            setDietPlans(plansData);
        } catch (err) {
            toast({
                title: 'Error al cargar datos',
                description: 'No se pudieron cargar los datos del cliente o sus planes de dieta.',
                variant: 'destructive',
            });
        } finally {
            if (showLoading) setLoading(false);
        }
    }, [userId, toast]);

    useEffect(() => {
        fetchClientData();
    }, [fetchClientData]);

    const handleToggleActive = async (planId, isActive) => {
        try {
            if (isActive) {
                await supabase
                    .from('diet_plans')
                    .update({ is_active: false })
                    .eq('user_id', userId)
                    .eq('is_active', true);
            }
            
            const { data, error } = await supabase
                .from('diet_plans')
                .update({ is_active: isActive })
                .eq('id', planId)
                .select()
                .single();

            if (error) throw error;

            setDietPlans(prevPlans => {
                const updatedPlans = prevPlans.map(p => 
                    p.id === planId ? { ...p, is_active: isActive } : { ...p, is_active: false }
                );
                return updatedPlans.sort((a, b) => b.is_active - a.is_active);
            });

            toast({
                title: 'Éxito',
                description: `El plan ha sido ${isActive ? 'activado' : 'desactivado'} correctamente.`,
            });
        } catch (err) {
            toast({
                title: 'Error',
                description: 'No se pudo actualizar el estado del plan.',
                variant: 'destructive',
            });
        }
    };

    const handleDeletePlan = async (planId) => {
        try {
            const { error } = await supabase.rpc('delete_diet_plan_with_dependencies', { p_plan_id: planId });
            if (error) throw error;
            toast({
                title: 'Plan Eliminado',
                description: 'El plan de dieta y todos sus datos asociados han sido eliminados.',
            });
            setDietPlans(prev => prev.filter(p => p.id !== planId));
        } catch (err) {
            toast({
                title: 'Error al eliminar',
                description: 'No se pudo eliminar el plan de dieta.',
                variant: 'destructive',
            });
        }
    };

    const handleOpenAssignDialog = async () => {
        setLoadingTemplates(true);
        setIsSelectTemplateOpen(true);
        try {
            const { data, error } = await supabase
                .from('diet_plans')
                .select(`*, sensitivities:diet_plan_sensitivities(sensitivities(id, name)), medical_conditions:diet_plan_medical_conditions(medical_conditions(id, name))`)
                .eq('is_template', true)
                .order('name');
            if (error) throw error;
            setTemplates(data);
        } catch (error) {
            toast({ title: "Error", description: "No se pudieron cargar las plantillas.", variant: "destructive" });
        } finally {
            setLoadingTemplates(false);
        }
    };

    const handleTemplateSelected = (template) => {
        setSelectedTemplate(template);
        setIsSelectTemplateOpen(false);
        setIsPreviewDialogOpen(false); // Close preview if open
        setIsAssignDialogOpen(true);
    };

    const handlePreviewTemplate = (template) => {
        setPreviewTemplate(template);
        setIsPreviewDialogOpen(true);
    };

    const handleAssignSuccess = () => {
        setIsAssignDialogOpen(false);
        fetchClientData(false);
    };

    const getClientRestrictions = () => {
        if (!client) return null;
        return {
            sensitivities: client.user_sensitivities?.map(us => us.sensitivities.id) || [],
            conditions: client.user_medical_conditions?.map(umc => umc.medical_conditions.id) || []
        };
    };

    const renderPlansList = () => {
        if (loading) {
            return <div className="flex justify-center items-center py-20"><Loader2 className="w-12 h-12 animate-spin text-green-500" /></div>;
        }

        return (
            <div>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl ml-4 font-bold text-green-400">Planes de Dieta Asignados</h2>
                    <Button onClick={handleOpenAssignDialog} className="bg-green-600 hover:bg-green-500 text-white">
                        Asignar Plantilla
                    </Button>
                </div>
                {dietPlans.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {dietPlans.map(plan => (
                            <PlanCard 
                                key={plan.id}
                                plan={plan}
                                client={client}
                                onToggleActive={handleToggleActive}
                                onDelete={handleDeletePlan}
                                onPlanUpdate={() => fetchClientData(false)}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center text-white py-16 bg-gray-800/50 rounded-xl">
                        <p className="text-gray-400">Este cliente aún no tiene planes de dieta asignados.</p>
                        <Button onClick={handleOpenAssignDialog} className="mt-4 bg-green-600 hover:bg-green-500 text-white">
                            Asignar su primer plan
                        </Button>
                    </div>
                )}
            </div>
        );
    };

    return (
        <>
            <DietManagementLayout
                title={
                    client ? (
                        <h1
                            className={`
                text-4xl md:text-5xl font-extrabold mb-8 mt-6 text-center
                bg-gradient-to-r from-[#6c51ffbf] to-violet-300 bg-clip-text text-transparent
            `}
                        >
                            Gestor de Planes de dietas de <Link to={`/client-profile/${userId}`} className="hover:underline decoration-violet-400 cursor-pointer">{client.full_name}</Link>
                        </h1>
                    ) : (
                        'Cargando...'
                    )
                }
                headerContent={
                    <ClientDietSummary
                        client={client}
                        dietPlans={dietPlans}
                        onPlanUpdate={() => fetchClientData(false)}
                        loading={loading}
                    />
                }
                gridContent={renderPlansList()}
            />

            <SelectTemplateDialog
                open={isSelectTemplateOpen}
                onOpenChange={setIsSelectTemplateOpen}
                templates={templates}
                onSelect={handleTemplateSelected}
                onPreview={handlePreviewTemplate}
                loading={loadingTemplates}
            />

            <TemplatePreviewDialog 
                open={isPreviewDialogOpen}
                onOpenChange={setIsPreviewDialogOpen}
                template={previewTemplate}
                onAssign={() => handleTemplateSelected(previewTemplate)}
                clientRestrictions={getClientRestrictions()}
            />

            {selectedTemplate && client && (
                <AssignPlanDialog
                    open={isAssignDialogOpen}
                    onOpenChange={setIsAssignDialogOpen}
                    template={selectedTemplate}
                    preselectedClient={client}
                    onSuccess={handleAssignSuccess}
                />
            )}
        </>
    );
};

export default DietManagementPage;