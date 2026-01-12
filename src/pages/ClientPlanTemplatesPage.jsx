
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, ArrowLeft, Search, Filter } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TemplateCard from '@/components/admin/diet-plans/TemplateCard';
import AssignPlanDialog from '@/components/admin/diet-plans/AssignPlanDialog';
import { useRole } from '@/hooks/useRole';
import { AXIS_OPTIONS_STATIC } from '@/components/admin/diet-plans/ClassificationManager';

const ClientPlanTemplatesPage = () => {
    const { user } = useAuth();
    const { isFree, maxDietPlans } = useRole();
    const { toast } = useToast();
    const navigate = useNavigate();
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [assignDialogOpen, setAssignDialogOpen] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [activePlan, setActivePlan] = useState(null);
    const [activePlanCount, setActivePlanCount] = useState(0);
    const [userDayMeals, setUserDayMeals] = useState([]);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
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
        const fetchTemplatesAndData = async () => {
            setLoading(true);
            try {
                // 1. Fetch User Active Plan
                const { data: activePlanData } = await supabase
                    .from('diet_plans')
                    .select('id, source_template_id')
                    .eq('user_id', user.id)
                    .eq('is_template', false)
                    .eq('is_active', true)
                    .maybeSingle();
                
                setActivePlan(activePlanData);

                // 2. Fetch Active Plan Count (for role restrictions)
                const { count, error: countError } = await supabase
                    .from('diet_plans')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', user.id)
                    .eq('is_template', false)
                    .eq('is_active', true);
                
                if (!countError) {
                    setActivePlanCount(count || 0);
                }
                
                // Fetch User Day Meals for preview filtering
                const { data: userMealsData } = await supabase
                    .from('user_day_meals')
                    .select('*, day_meal:day_meals(*)')
                    .eq('user_id', user.id)
                    .order('day_meal(display_order)');
                
                if (userMealsData) {
                    setUserDayMeals(userMealsData);
                }

                // 3. Fetch Templates (Global + Center logic could be expanded here if needed)
                const { data: templatesData, error } = await supabase
                    .from('diet_plans')
                    .select(`
                        *,
                        sensitivities:diet_plan_sensitivities(sensitivities(id, name)),
                        medical_conditions:diet_plan_medical_conditions(medical_conditions(id, name))
                    `)
                    .eq('is_template', true)
                    .eq('template_scope', 'global') 
                    .order('created_at', { ascending: false });

                if (error) throw error;
                setTemplates(templatesData || []);

                // 4. Fetch Filter Options
                const [sensRes, pathRes, dietRes] = await Promise.all([
                    supabase.from('sensitivities').select('id, name').order('name'),
                    supabase.from('medical_conditions').select('id, name').order('name'),
                    supabase.from('diet_types').select('id, name').order('name')
                ]);

                if (sensRes.data) setSensitivitiesOptions(sensRes.data);
                if (pathRes.data) setPathologyOptions(pathRes.data);
                if (dietRes.data) setDietTypeOptions(dietRes.data);

            } catch (error) {
                console.error("Error fetching templates:", error);
                toast({ title: 'Error', description: 'No se pudieron cargar las plantillas.', variant: 'destructive' });
            } finally {
                setLoading(false);
            }
        };

        if (user) fetchTemplatesAndData();
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

            return matchesSearch && matchesObjective && matchesLifestyle && matchesNutrition && matchesSensitivities && matchesPathology;
        });
    }, [templates, searchTerm, filters]);

    const clearFilters = () => {
        setFilters({
            objective: 'all',
            lifestyle: 'all',
            nutrition_style: 'all',
            sensitivities: 'all',
            pathology: 'all'
        });
        setSearchTerm('');
    };

    const activeFiltersCount = Object.values(filters).filter(v => v !== 'all').length;

    return (
        <div className="container mx-auto px-4 py-8 max-w-[1600px]">
            <div className="flex items-center gap-4 mb-8">
                <Link to="/profile" className="p-2 rounded-full hover:bg-gray-800 transition-colors">
                    <ArrowLeft className="w-6 h-6 text-gray-400" />
                </Link>
                <div>
                    <h1 className="text-3xl font-bold text-white">Catálogo de Plantillas</h1>
                    <p className="text-gray-400">Elige una plantilla para comenzar tu plan.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Fixed Left Sidebar for Filters */}
                <div className="lg:col-span-1 space-y-6 bg-[#1a1e23] p-6 rounded-xl border border-gray-800 h-fit bg-gradient-to-b from-gray-900/20 via-gray-800/10 to-gray-900/20 lg:sticky lg:top-6">
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

                {/* Right Content: Templates Grid */}
                <div className="lg:col-span-3">
                    {loading ? (
                        <div className="flex justify-center items-center h-64">
                            <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
                        </div>
                    ) : filteredTemplates.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {filteredTemplates.map(template => (
                                <TemplateCard 
                                    key={template.id} 
                                    template={template} 
                                    onAssign={() => handleAssignClick(template)}
                                    allowManagement={false}
                                    isActive={activePlan && activePlan.source_template_id === template.id}
                                    isUserHasActiveDiet={!!activePlan}
                                    userDayMeals={userDayMeals} // Pass user meals for filtering
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 bg-gray-800/20 rounded-xl border border-dashed border-gray-800">
                            <p className="text-gray-500">No se encontraron plantillas disponibles con los filtros actuales.</p>
                            <Button variant="link" onClick={clearFilters} className="text-green-400">
                                Limpiar filtros
                            </Button>
                        </div>
                    )}
                </div>
            </div>

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
