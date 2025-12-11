import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Loader2, Plus } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Helmet } from 'react-helmet';

const UserDietTemplatesPage = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [assigningTemplateId, setAssigningTemplateId] = useState(null);

    useEffect(() => {
        const fetchTemplates = async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('diet_plans')
                    .select('*')
                    .eq('is_template', true)
                    .order('created_at', { ascending: false });

                if (error) throw error;
                setTemplates(data || []);
            } catch (error) {
                toast({ title: 'Error', description: error.message, variant: 'destructive' });
            } finally {
                setLoading(false);
            }
        };

        fetchTemplates();
    }, [toast]);

    const handleAssignTemplate = async (template) => {
        if (!user || !template) return;

        setAssigningTemplateId(template.id);
        try {
            // Check if user already has an active plan
            const { data: activePlans, error: activePlanError } = await supabase
                .from('diet_plans')
                .select('id')
                .eq('user_id', user.id)
                .eq('is_active', true);
            
            if (activePlanError) throw activePlanError;

            if (activePlans && activePlans.length > 0) {
                toast({ 
                    title: 'Plan activo existente', 
                    description: 'Ya tienes un plan de dieta activo. Por favor, desactívalo antes de asignar uno nuevo.', 
                    variant: 'destructive' 
                });
                return;
            }

            // Call the clone_diet_plan_template function
            const newPlanName = `${template.name} (${user.full_name || user.email})`;
            const startDate = new Date();
            const endDate = new Date();
            endDate.setDate(startDate.getDate() + 30); // Default to 30 days

            const { data, error } = await supabase.rpc('clone_diet_plan_template', {
                p_template_id: template.id,
                p_client_id: user.id,
                p_new_plan_name: newPlanName,
                p_new_start_date: startDate.toISOString().split('T')[0],
                p_new_end_date: endDate.toISOString().split('T')[0],
            });

            if (error) throw error;

            toast({ title: 'Plan asignado', description: `La plantilla "${template.name}" ha sido asignada como tu nuevo plan.`, className: 'bg-green-600 text-white' });
        } catch (error) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setAssigningTemplateId(null);
        }
    };

    return (
        <>
            <Helmet>
                <title>Mis Plantillas de Dieta - Gsus Martz</title>
                <meta name="description" content="Explora y asigna plantillas de dieta a tu perfil." />
            </Helmet>
            <div className="p-6 max-w-[1600px] mx-auto space-y-8 min-h-screen">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-white">Explorar Plantillas de Dieta</h1>
                    <p className="text-gray-400 mt-1">Selecciona una plantilla base para tu plan de alimentación.</p>
                </div>

                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <Loader2 className="h-8 w-8 animate-spin text-green-500" />
                    </div>
                ) : templates.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {templates.map(template => (
                            <Card key={template.id} className="bg-slate-900/50 border-gray-700 text-white flex flex-col h-full">
                                <CardHeader>
                                    <CardTitle className="text-xl font-bold text-green-400">{template.name}</CardTitle>
                                    <CardDescription className="text-gray-400">
                                        {/* You can add a short description field to templates if needed */}
                                        Una plantilla versátil para diversos objetivos.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="flex-grow space-y-2 text-sm">
                                    {template.classification_objective?.length > 0 && (
                                        <div>
                                            <span className="font-semibold text-gray-300">Objetivo: </span>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {template.classification_objective.map(obj => <Badge key={obj} variant="silver">{obj}</Badge>)}
                                            </div>
                                        </div>
                                    )}
                                    {template.classification_lifestyle?.length > 0 && (
                                        <div>
                                            <span className="font-semibold text-gray-300">Estilo de vida: </span>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {template.classification_lifestyle.map(ls => <Badge key={ls} variant="silver">{ls}</Badge>)}
                                            </div>
                                        </div>
                                    )}
                                    {template.classification_nutrition_style?.length > 0 && (
                                        <div>
                                            <span className="font-semibold text-gray-300">Estilo nutricional: </span>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {template.classification_nutrition_style.map(ns => <Badge key={ns} variant="silver">{ns}</Badge>)}
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                                <CardFooter className="pt-4">
                                    <Button
                                        onClick={() => handleAssignTemplate(template)}
                                        disabled={assigningTemplateId === template.id}
                                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                                    >
                                        {assigningTemplateId === template.id ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <Plus className="mr-2 h-4 w-4" />
                                        )}
                                        {assigningTemplateId === template.id ? 'Asignando...' : 'Seleccionar Plantilla'}
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 bg-gray-800/20 rounded-xl border border-dashed border-gray-800">
                        <p className="text-gray-500">No hay plantillas de dieta disponibles en este momento.</p>
                    </div>
                )}
            </div>
        </>
    );
};

export default UserDietTemplatesPage;