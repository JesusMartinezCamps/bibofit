import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PlanTemplateForm from '@/components/admin/diet-plans/PlanTemplateForm';
import AssignPlanDialog from '@/components/admin/diet-plans/AssignPlanDialog';
import AssignToCenterDialog from '@/components/admin/diet-plans/AssignToCenterDialog';
import TemplateCard from '@/components/admin/diet-plans/TemplateCard';
import Breadcrumbs from '@/components/Breadcrumbs';
import { useAuth } from '@/contexts/AuthContext';

const AllDietPlansPage = () => {
    const { toast } = useToast();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
    const [isAssignToCenterDialogOpen, setIsAssignToCenterDialogOpen] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const { data: templatesData, error: templatesError } = await supabase
                .from('diet_plans')
                .select(`
                    *,
                    sensitivities:diet_plan_sensitivities(sensitivities(id, name)),
                    medical_conditions:diet_plan_medical_conditions(medical_conditions(id, name)),
                    assigned_centers:diet_plan_centers(center:centers(id, name))
                `)
                .eq('is_template', true)
                .order('name', { ascending: true });

            if (templatesError) throw templatesError;
            setTemplates(templatesData.map(t => ({
                ...t, 
                sensitivities: t.sensitivities.map(dpa => dpa.sensitivities).filter(Boolean),
                medical_conditions: t.medical_conditions.map(dpmc => dpmc.medical_conditions).filter(Boolean)
            })));

        } catch (error) {
            toast({ title: "Error", description: `No se pudieron cargar los datos: ${error.message}`, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleCreateNew = () => {
        setSelectedTemplate(null);
        setIsFormOpen(true);
    };

    const handleEdit = (template) => {
        setSelectedTemplate(template);
        setIsFormOpen(true);
    };

    const handleDelete = async (templateId) => {
        try {
            const { data: generatedPlans, error: findError } = await supabase
                .from('diet_plans')
                .select('id')
                .eq('source_template_id', templateId);

            if (findError) throw findError;

            for (const plan of generatedPlans) {
                await supabase.rpc('delete_diet_plan_with_dependencies', { p_plan_id: plan.id });
            }
            
            await supabase.rpc('delete_diet_plan_with_dependencies', { p_plan_id: templateId });

            toast({ title: "Plantilla eliminada", description: "La plantilla y todos sus planes asociados han sido eliminados." });
            fetchData();
        } catch (error) {
            toast({ title: "Error al eliminar", description: error.message, variant: "destructive" });
        }
    };
    
    const handleAssign = (template) => {
        setSelectedTemplate(template);
        setIsAssignDialogOpen(true);
    };
    
    const handleAssignToCenter = (template) => {
        setSelectedTemplate(template);
        setIsAssignToCenterDialogOpen(true);
    };

    const handleAssignSuccess = () => {
        setIsAssignDialogOpen(false);
        toast({ title: 'Plan asignado', description: `La plantilla "${selectedTemplate.name}" se ha asignado correctamente.`});
    };

    const handleAssignToCenterSuccess = () => {
        fetchData();
    };

    const handleFormSuccess = () => {
        setIsFormOpen(false);
        setSelectedTemplate(null);
        fetchData();
    };

    const filteredTemplates = templates.filter(template =>
        template.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const breadcrumbItems = [
      { label: 'Gestión de Contenidos', href: '/admin-panel/content/nutrition' },
      { label: 'Nutrición', href: '/admin-panel/content/nutrition' },
      { label: 'Gestión Global de Dietas' },
    ];

    return (
        <>
            <Helmet>
                <title>Gestión Global de Dietas - Gsus Martz</title>
                <meta name="description" content="Gestiona todas las plantillas de planes de dieta." />
            </Helmet>
            <main className="w-full px-4 py-8">
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                    <Breadcrumbs items={breadcrumbItems} />
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-3xl font-bold text-white">Plantillas de Dietas</h1>
                        <Button onClick={handleCreateNew} className="calendar-dialog-button"><Plus className="w-4 h-4 mr-2" />Crear Plantilla</Button>
                    </div>

                    <div className="mb-6">
                        <Input
                            type="text"
                            placeholder="Buscar plantillas por nombre..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="input-field max-w-sm"
                        />
                    </div>

                    {loading ? (
                        <div className="flex justify-center items-center py-20"><Loader2 className="w-12 h-12 animate-spin text-green-500" /></div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredTemplates.map(template => (
                                <TemplateCard 
                                    key={template.id}
                                    template={template}
                                    onEdit={handleEdit}
                                    onDelete={handleDelete}
                                    onAssign={handleAssign}
                                    onAssignToCenter={() => handleAssignToCenter(template)}
                                    isAdmin={user?.role === 'admin'}
                                />
                            ))}
                        </div>
                    )}
                     {(!loading && filteredTemplates.length === 0) && (
                        <div className="text-center py-16 bg-gray-800/30 rounded-xl">
                            <p className="text-gray-400">No se encontraron plantillas. ¿Quieres crear una?</p>
                            <Button onClick={handleCreateNew} className="mt-4 calendar-dialog-button">Crear la Primera Plantilla</Button>
                        </div>
                    )}
                </motion.div>
            </main>
            
            <PlanTemplateForm 
                open={isFormOpen}
                onOpenChange={setIsFormOpen}
                template={selectedTemplate}
                onSuccess={handleFormSuccess}
            />

            <AssignPlanDialog
                open={isAssignDialogOpen}
                onOpenChange={setIsAssignDialogOpen}
                template={selectedTemplate}
                onSuccess={handleAssignSuccess}
            />

             <AssignToCenterDialog
                open={isAssignToCenterDialogOpen}
                onOpenChange={setIsAssignToCenterDialogOpen}
                template={selectedTemplate}
                onSuccess={handleAssignToCenterSuccess}
            />
        </>
    );
};

export default AllDietPlansPage;