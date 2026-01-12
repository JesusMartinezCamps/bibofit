import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Plus, Search, Filter, Loader2, Globe, Building2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import TemplateCard from '@/components/admin/diet-plans/TemplateCard';
import PlanTemplateForm from '@/components/admin/diet-plans/PlanTemplateForm';
import AssignPlanDialog from '@/components/admin/diet-plans/AssignPlanDialog';
import AssignToCenterDialog from '@/components/admin/diet-plans/AssignToCenterDialog';
import { AXIS_OPTIONS_STATIC } from '@/components/admin/diet-plans/ClassificationManager';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const PlanTemplatesPage = () => {
    const { toast } = useToast();
    const { user } = useAuth();
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [userCenterId, setUserCenterId] = useState(null);
    
    // Dialog states
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
    const [isAssignToCenterDialogOpen, setIsAssignToCenterDialogOpen] = useState(false);
    
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [templateToAssign, setTemplateToAssign] = useState(null);
    const [templateToAssignCenter, setTemplateToAssignCenter] = useState(null);
    
    // Scope Filter
    const [scopeFilter, setScopeFilter] = useState('all'); // 'all', 'global', 'center'

    // Filters
    const [filters, setFilters] = useState({
        objective: 'all',
        lifestyle: 'all',
        nutrition_style: 'all',
        sensitivities: 'all',
        pathology: 'all'
    });

    // Dynamic Filter Options
    const [sensitivitiesOptions, setSensitivitiesOptions] = useState([]);
    const [pathologyOptions, setPathologyOptions] = useState([]);
    const [dietTypeOptions, setDietTypeOptions] = useState([]);

    useEffect(() => {
        const getUserCenter = async () => {
            if (user && user.role !== 'admin') {
                const { data } = await supabase.from('user_centers').select('center_id').eq('user_id', user.id).maybeSingle();
                if (data) setUserCenterId(data.center_id);
            }
        };
        getUserCenter();
    }, [user]);

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const { data: templatesData, error } = await supabase
                .from('diet_plans')
                .select(`
                    *,
                    assigned_plans:diet_plans!source_template_id(
                        id, 
                        user_id,
                        profile:user_id(full_name, user_id)
                    ),
                    sensitivities:diet_plan_sensitivities(sensitivities(id, name)),
                    medical_conditions:diet_plan_medical_conditions(medical_conditions(id, name)),
                    assigned_centers:diet_plan_centers(center:centers(id, name))
                `)
                .eq('is_template', true)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Fetch creator information in bulk to avoid N+1 and .single() errors
            const creatorIds = [...new Set(templatesData.map(t => t.created_by).filter(Boolean))];
            let creatorsMap = {};

            if (creatorIds.length > 0) {
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('user_id, full_name')
                    .in('user_id', creatorIds);
                
                const { data: roles } = await supabase
                    .from('user_roles')
                    .select('user_id, roles(role)')
                    .in('user_id', creatorIds);
                
                if (profiles) {
                    profiles.forEach(p => {
                        const roleObj = roles?.find(r => r.user_id === p.user_id);
                        creatorsMap[p.user_id] = {
                            name: p.full_name,
                            role: roleObj?.roles?.role
                        };
                    });
                }
            }

            const templatesWithCreator = templatesData.map(t => ({
                ...t,
                creator_data: t.created_by ? creatorsMap[t.created_by] : null
            }));

            setTemplates(templatesWithCreator || []);
        } catch (error) {
            console.error("Error fetching templates:", error);
            toast({ title: 'Error', description: 'No se pudieron cargar las plantillas.', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const fetchFilterOptions = async () => {
        try {
            const [sensRes, pathRes, dietRes] = await Promise.all([
                supabase.from('sensitivities').select('id, name').order('name'),
                supabase.from('medical_conditions').select('id, name').order('name'),
                supabase.from('diet_types').select('id, name').order('name')
            ]);

            if (sensRes.data) setSensitivitiesOptions(sensRes.data);
            if (pathRes.data) setPathologyOptions(pathRes.data);
            if (dietRes.data) setDietTypeOptions(dietRes.data);
        } catch (error) {
            console.error("Error loading filter options", error);
        }
    };

    useEffect(() => {
        fetchTemplates();
        fetchFilterOptions();
    }, []);

    const handleDeleteTemplate = async (id) => {
        try {
            const { error: dependenciesError } = await supabase.rpc('delete_diet_plan_with_dependencies', { p_plan_id: id });
            if (dependenciesError) throw dependenciesError;
            
            toast({ title: 'Plantilla eliminada', description: 'La plantilla ha sido eliminada correctamente.' });
            fetchTemplates();
        } catch (error) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    };
    
    const handlePromoteTemplate = async (id) => {
        try {
            const { error } = await supabase
                .from('diet_plans')
                .update({ template_scope: 'global', center_id: null })
                .eq('id', id);
            
            if (error) throw error;
            
            toast({ title: 'Plantilla promovida', description: 'La plantilla ahora es global y visible para todos los centros.' });
            fetchTemplates();
        } catch (error) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    };

    const handleAssignClick = (template) => {
        setTemplateToAssign(template);
        setIsAssignDialogOpen(true);
    };

    const handleAssignToCenterClick = (template) => {
        setTemplateToAssignCenter(template);
        setIsAssignToCenterDialogOpen(true);
    };

    const filteredTemplates = useMemo(() => {
        return templates.filter(template => {
            const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase());
            
            const matchesObjective = filters.objective === 'all' || (template.classification_objective && template.classification_objective.includes(filters.objective));
            const matchesLifestyle = filters.lifestyle === 'all' || (template.classification_lifestyle && template.classification_lifestyle.includes(filters.lifestyle));
            const matchesNutrition = filters.nutrition_style === 'all' || (template.classification_nutrition_style && template.classification_nutrition_style.includes(filters.nutrition_style));
            
            const matchesSensitivities = filters.sensitivities === 'all' || 
                (template.sensitivities && template.sensitivities.some(s => s.sensitivities.id.toString() === filters.sensitivities));

            const matchesPathology = filters.pathology === 'all' || 
                (template.medical_conditions && template.medical_conditions.some(c => c.medical_conditions.id.toString() === filters.pathology));

            // Scope Filter
            let matchesScope = true;
            if (scopeFilter === 'global') matchesScope = template.template_scope === 'global';
            if (scopeFilter === 'center') matchesScope = template.template_scope === 'center';

            return matchesSearch && matchesObjective && matchesLifestyle && matchesNutrition && matchesSensitivities && matchesPathology && matchesScope;
        });
    }, [templates, searchTerm, filters, scopeFilter]);

    const clearFilters = () => {
        setFilters({
            objective: 'all',
            lifestyle: 'all',
            nutrition_style: 'all',
            sensitivities: 'all',
            pathology: 'all'
        });
        setSearchTerm('');
        setScopeFilter('all');
    };

    const activeFiltersCount = Object.values(filters).filter(v => v !== 'all').length + (scopeFilter !== 'all' ? 1 : 0);

    return (
        <div className="p-6 max-w-[1600px] mx-auto space-y-8 min-h-screen">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">Plantillas de Dieta</h1>
                    <p className="text-gray-400 mt-1">Gestiona y asigna plantillas base para tus clientes</p>
                </div>
                <Button onClick={() => { setSelectedTemplate(null); setIsCreateDialogOpen(true); }} className="bg-green-600 hover:bg-green-700 text-white">
                    <Plus className="mr-2 h-4 w-4" /> Nueva Plantilla
                </Button>
            </div>
            
            {/* Scope Tabs */}
            <div className="w-full">
                <Tabs value={scopeFilter} onValueChange={setScopeFilter} className="w-full md:w-auto">
                    <TabsList className="bg-gray-800/50 border border-gray-700">
                        <TabsTrigger value="all" className="data-[state=active]:bg-gray-700 data-[state=active]:text-gray-200 text-gray-300">
                            Todas
                        </TabsTrigger>
                        <TabsTrigger value="global" className="data-[state=active]:bg-blue-900/50 data-[state=active]:text-blue-200 text-gray-300">
                            <Globe className="w-3 h-3 mr-2" /> Globales
                        </TabsTrigger>
                        <TabsTrigger value="center" className="data-[state=active]:bg-amber-900/50 data-[state=active]:text-amber-200 text-gray-300">
                            <Building2 className="w-3 h-3 mr-2" /> De Centro
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Filters Sidebar */}
                <div className="lg:col-span-1 space-y-6 bg-[#1a1e23] p-6 rounded-xl border border-gray-800 h-fit bg-gradient-to-b from-gray-900/20 via-gray-800/10 to-gray-900/20">
                    <div className="flex items-center justify-between">
                        <h2 className="font-semibold text-white flex items-center gap-2">
                            <Filter className="h-4 w-4  text-green-400" /> Filtros
                        </h2>
                        {activeFiltersCount > 0 && (
                            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs text-red-400 hover:text-red-300 hover:bg-red-600/30 h-auto py-1 px-2">
                                Limpiar ({activeFiltersCount})
                            </Button>
                        )}
                    </div>
                    
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-xs text-gray-400 uppercase">Búsqueda</Label>
                            <div className="relative">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                                <Input
                                    placeholder="Buscar por nombre..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-8 bg-gray-900 border-gray-700 text-sm"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs text-gray-400 uppercase">Objetivo</Label>
                            <Select value={filters.objective} onValueChange={(v) => setFilters(prev => ({ ...prev, objective: v }))}>
                                <SelectTrigger className="bg-gray-900 border-gray-700 text-sm">
                                    <SelectValue placeholder="Cualquiera" />
                                </SelectTrigger>
                                <SelectContent className="bg-[#1a1e23] border-gray-700 text-white">
                                    <SelectItem value="all">Cualquiera</SelectItem>
                                    {AXIS_OPTIONS_STATIC.objective.map(opt => (
                                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs text-gray-400 uppercase">Estilo de Vida</Label>
                            <Select value={filters.lifestyle} onValueChange={(v) => setFilters(prev => ({ ...prev, lifestyle: v }))}>
                                <SelectTrigger className="bg-gray-900 border-gray-700 text-sm">
                                    <SelectValue placeholder="Cualquiera" />
                                </SelectTrigger>
                                <SelectContent className="bg-[#1a1e23] border-gray-700 text-white">
                                    <SelectItem value="all">Cualquiera</SelectItem>
                                    {AXIS_OPTIONS_STATIC.lifestyle.map(opt => (
                                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs text-gray-400 uppercase">Estilo Nutricional</Label>
                            <Select value={filters.nutrition_style} onValueChange={(v) => setFilters(prev => ({ ...prev, nutrition_style: v }))}>
                                <SelectTrigger className="bg-gray-900 border-gray-700 text-sm">
                                    <SelectValue placeholder="Cualquiera" />
                                </SelectTrigger>
                                <SelectContent className="bg-[#1a1e23] border-gray-700 text-white">
                                    <SelectItem value="all">Cualquiera</SelectItem>
                                    {dietTypeOptions.map(opt => (
                                        <SelectItem key={opt.id} value={opt.name}>{opt.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="pt-4 border-t border-gray-800 space-y-4">
                            <div className="space-y-2">
                                <Label className="text-xs text-gray-400 uppercase">Sensibilidades a Evitar</Label>
                                <Select value={filters.sensitivities} onValueChange={(v) => setFilters(prev => ({ ...prev, sensitivities: v }))}>
                                    <SelectTrigger className="bg-gray-900 border-gray-700 text-sm">
                                        <SelectValue placeholder="Ninguna específica" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#1a1e23] border-gray-700 text-white">
                                        <SelectItem value="all">Todas</SelectItem>
                                        {sensitivitiesOptions.map(opt => (
                                            <SelectItem key={opt.id} value={opt.id.toString()}>{opt.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs text-gray-400 uppercase">Patología (Apta para)</Label>
                                <Select value={filters.pathology} onValueChange={(v) => setFilters(prev => ({ ...prev, pathology: v }))}>
                                    <SelectTrigger className="bg-gray-900 border-gray-700 text-sm">
                                        <SelectValue placeholder="Ninguna específica" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#1a1e23] border-gray-700 text-white">
                                        <SelectItem value="all">Todas</SelectItem>
                                        {pathologyOptions.map(opt => (
                                            <SelectItem key={opt.id} value={opt.id.toString()}>{opt.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Templates Grid */}
                <div className="lg:col-span-3">
                    {loading ? (
                        <div className="flex justify-center items-center h-64">
                            <Loader2 className="h-8 w-8 animate-spin text-green-500" />
                        </div>
                    ) : filteredTemplates.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {filteredTemplates.map(template => (
                                <TemplateCard 
                                    key={template.id} 
                                    template={template}
                                    onDelete={() => handleDeleteTemplate(template.id)}
                                    onAssign={() => handleAssignClick(template)}
                                    onPromote={() => handlePromoteTemplate(template.id)}
                                    onAssignToCenter={() => handleAssignToCenterClick(template)}
                                    onUpdate={fetchTemplates}
                                    isAdmin={user?.role === 'admin'}
                                    currentUserCenterId={userCenterId}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 bg-gray-800/20 rounded-xl border border-dashed border-gray-800">
                            <p className="text-gray-500">No se encontraron plantillas con los filtros actuales.</p>
                            <Button variant="link" onClick={clearFilters} className="text-green-400">
                                Limpiar filtros
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            <PlanTemplateForm 
                open={isCreateDialogOpen} 
                onOpenChange={setIsCreateDialogOpen}
                template={selectedTemplate}
                centerId={userCenterId}
                onSuccess={() => {
                    setIsCreateDialogOpen(false);
                    fetchTemplates();
                }}
            />

            {templateToAssign && (
                <AssignPlanDialog 
                    open={isAssignDialogOpen}
                    onOpenChange={setIsAssignDialogOpen}
                    template={templateToAssign}
                    onSuccess={() => {
                        setIsAssignDialogOpen(false);
                        fetchTemplates();
                        toast({ title: 'Plan asignado', description: 'La plantilla se ha asignado correctamente.'});
                    }}
                />
            )}

            {templateToAssignCenter && (
                <AssignToCenterDialog
                    open={isAssignToCenterDialogOpen}
                    onOpenChange={setIsAssignToCenterDialogOpen}
                    template={templateToAssignCenter}
                    onSuccess={() => {
                        fetchTemplates(); // Refresh to show new badges
                    }}
                />
            )}
        </div>
    );
};

export default PlanTemplatesPage;