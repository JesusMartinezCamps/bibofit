import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, ArrowLeft, Search } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import TemplateCard from '@/components/admin/diet-plans/TemplateCard';
import AssignPlanDialog from '@/components/admin/diet-plans/AssignPlanDialog';
import { useRole } from '@/hooks/useRole';

const ClientPlanTemplatesPage = () => {
    const { user } = useAuth();
    const { isFree, maxDietPlans } = useRole();
    const { toast } = useToast();
    const navigate = useNavigate();
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [assignDialogOpen, setAssignDialogOpen] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [activePlanCount, setActivePlanCount] = useState(0);

    useEffect(() => {
        const fetchTemplates = async () => {
            setLoading(true);
            try {
                // Fetch public global templates and center templates
                // Assuming client can see global templates. 
                // Adjust policy logic if needed, but for now assuming global templates are visible.
                const { data, error } = await supabase
                    .from('diet_plans')
                    .select('*')
                    .eq('is_template', true)
                    .eq('template_scope', 'global') 
                    .order('created_at', { ascending: false });

                if (error) throw error;
                setTemplates(data || []);

                // Check active plans count for restriction
                const { count, error: countError } = await supabase
                    .from('diet_plans')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', user.id)
                    .eq('is_template', false)
                    .eq('is_active', true);
                
                if (!countError) {
                    setActivePlanCount(count || 0);
                }

            } catch (error) {
                console.error("Error fetching templates:", error);
                toast({ title: 'Error', description: 'No se pudieron cargar las plantillas.', variant: 'destructive' });
            } finally {
                setLoading(false);
            }
        };

        if (user) fetchTemplates();
    }, [user, toast]);

    const handleAssignClick = (template) => {
        if (isFree && activePlanCount >= maxDietPlans) {
            toast({
                title: "Límite Alcanzado",
                description: `Los usuarios gratuitos solo pueden tener ${maxDietPlans} plan de dieta activo.`,
                variant: "destructive"
            });
            return;
        }

        setSelectedTemplate(template);
        setAssignDialogOpen(true);
    };

    const handleAssignSuccess = () => {
        setAssignDialogOpen(false);
        toast({ title: 'Plan Asignado', description: 'Has creado tu plan de dieta exitosamente.' });
        navigate('/my-plan');
    };

    const filteredTemplates = templates.filter(t => 
        t.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="flex items-center gap-4 mb-6">
                <Link to="/profile" className="p-2 rounded-full hover:bg-gray-800 transition-colors">
                    <ArrowLeft className="w-6 h-6 text-gray-400" />
                </Link>
                <div>
                    <h1 className="text-3xl font-bold text-white">Catálogo de Plantillas</h1>
                    <p className="text-gray-400">Elige una plantilla para comenzar tu plan.</p>
                </div>
            </div>

            <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input 
                    type="text" 
                    placeholder="Buscar plantillas..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-gray-900 border-gray-700 text-white placeholder:text-gray-500 w-full md:w-96"
                />
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredTemplates.length > 0 ? (
                        filteredTemplates.map(template => (
                            <TemplateCard 
                                key={template.id} 
                                template={template} 
                                onAssign={() => handleAssignClick(template)}
                                isClientView={true}
                            />
                        ))
                    ) : (
                        <div className="col-span-full text-center py-20 text-gray-500">
                            No se encontraron plantillas disponibles.
                        </div>
                    )}
                </div>
            )}

            {selectedTemplate && (
                <AssignPlanDialog
                    open={assignDialogOpen}
                    onOpenChange={setAssignDialogOpen}
                    template={selectedTemplate}
                    onSuccess={handleAssignSuccess}
                    preselectedClient={user} // Auto-select current user
                    isClientSelfAssign={true}
                />
            )}
        </div>
    );
};

export default ClientPlanTemplatesPage;