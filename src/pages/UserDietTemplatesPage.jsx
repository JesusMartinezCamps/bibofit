import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Loader2, Search, Filter, Globe, Building2, ArrowLeft } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Helmet } from 'react-helmet';
import TemplateCard from '@/components/admin/diet-plans/TemplateCard';
import { AXIS_OPTIONS_STATIC } from '@/components/admin/diet-plans/ClassificationManager';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PlanHeader from '@/components/admin/diet-plans/PlanHeader';
import MacroDistribution from '@/components/plans/constructor/MacroDistribution';
import MealMacroConfiguration from '@/components/plans/constructor/MealMacroConfiguration';
import PlanView from '@/components/admin/diet-plans/PlanView';

const ClientTemplateManager = ({ user }) => {
    const { toast } = useToast();
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [assigningTemplateId, setAssigningTemplateId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [scopeFilter, setScopeFilter] = useState('all');
  const [filters, setFilters] = useState({
    objective: 'all',
    lifestyle: 'all',
    nutrition_style: 'all',
    sensitivities: 'all',
    pathology: 'all'
  });
  const [sensitivitiesOptions, setSensitivitiesOptions] = useState([]);
  const [pathologyOptions, setPathologyOptions] = useState([]);
  const [dietTypeOptions, setDietTypeOptions] = useState([]);
  const [userCenterId, setUserCenterId] = useState(null);

  useEffect(() => {
    const getUserCenter = async () => {
      if (user) {
        const { data } = await supabase.from('user_centers').select('center_id').eq('user_id', user.id).maybeSingle();
        if (data) setUserCenterId(data.center_id);
      }
    };
    getUserCenter();
  }, [user]);

  const fetchTemplates = useCallback(async () => {
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
                    medical_conditions:diet_plan_medical_conditions(medical_conditions(id, name))
                `)
        .eq('is_template', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const creatorIds = [...new Set((templatesData || []).map(t => t.created_by).filter(Boolean))];
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

      const templatesWithCreator = (templatesData || []).map(t => ({
        ...t,
        creator_data: t.created_by ? creatorsMap[t.created_by] : null
      }));

      const accessibleTemplates = templatesWithCreator.filter(t =>
        t.template_scope === 'global' || (t.template_scope === 'center' && t.center_id === userCenterId)
      );

      setTemplates(accessibleTemplates || []);
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudieron cargar las plantillas.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast, userCenterId]);

    useEffect(() => {
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
              console.error("Error loading filter options", error);            } finally {
                setLoading(false);
            }
        };
      fetchFilterOptions();
    }, []);

  useEffect(() => {
        fetchTemplates();
  }, [fetchTemplates]);

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
          endDate.setDate(startDate.getDate() + 30);
          const { error } = await supabase.rpc('clone_diet_plan_template', {                p_template_id: template.id,
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
        <>
            <Helmet>
                <title>Gestor de Plantillas de Dieta</title>
                <meta name="description" content="Explora y asigna plantillas de dieta a tu propio perfil." />
            </Helmet>
            <div className="p-6 max-w-[1600px] mx-auto space-y-8 min-h-screen">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white">Gestor de Plantillas de Dieta</h1>
              <p className="text-gray-400 mt-1">Selecciona la plantilla que quieres usar en tu plan personal.</p>
            </div>
            <Card className="bg-slate-900/40 border-gray-800">
              <CardHeader className="py-3">
                <CardTitle className="text-sm text-gray-300">Modo Cliente</CardTitle>
                <CardDescription className="text-xs text-gray-500">Solo puedes asignar plantillas a ti mismo.</CardDescription>
              </CardHeader>
            </Card>
                </div>

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
                      onDelete={() => { }}
                      onAssign={() => handleAssignTemplate(template)}
                      onPromote={() => { }}
                      onUpdate={fetchTemplates}
                      isAdmin={false}
                      allowManagement={false}
                      assignLabel={assigningTemplateId === template.id ? 'Asignando...' : 'Asignar a mi plan'}
                      assignDisabled={assigningTemplateId === template.id}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-800/20 rounded-xl border border-dashed border-gray-800">
                  <p className="text-gray-500">No hay plantillas disponibles con los filtros actuales.</p>
                  <Button variant="link" onClick={clearFilters} className="text-green-400">
                    Limpiar filtros
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
        </>
    );
};
const ClientAssignedPlanView = ({ planId }) => {
  const { toast } = useToast();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [calculatedTdee, setCalculatedTdee] = useState(0);
  const [calorieOverrides, setCalorieOverrides] = useState([]);
  const [macrosPct, setMacrosPct] = useState({ protein: 30, carbs: 40, fat: 30 });
  const [meals, setMeals] = useState([]);

  const fetchPlan = useCallback(async () => {
    if (!planId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: planData, error: planError } = await supabase
        .from('diet_plans')
        .select(`
                    *,
                    profile:user_id(full_name, user_id, tdee_kcal),
                    sensitivities:diet_plan_sensitivities(sensitivities(id, name, description)),
                    medical_conditions:diet_plan_medical_conditions(medical_conditions(id, name, description)),
                    source_template:source_template_id(name)
                `)
        .eq('id', planId)
        .single();

      if (planError) throw planError;

      const [sensitivitiesRes, conditionsRes, overridesRes] = await Promise.all([
        supabase.from('user_sensitivities').select('sensitivities(id, name, description)').eq('user_id', planData.user_id),
        supabase.from('user_medical_conditions').select('medical_conditions(id, name, description)').eq('user_id', planData.user_id),
        supabase.from('diet_plan_calorie_overrides').select('*').eq('diet_plan_id', planId).order('effective_date', { ascending: false })
      ]);

      planData.sensitivities = sensitivitiesRes.data || [];
      planData.medical_conditions = conditionsRes.data || [];
      setCalorieOverrides(overridesRes.data || []);
      setCalculatedTdee(planData.profile?.tdee_kcal || 2500);

      const { data: mealsData, error: mealsError } = await supabase.from('user_day_meals')
        .select('*, day_meal:day_meal_id(*)')
        .eq('user_id', planData.user_id)
        .eq('diet_plan_id', planId)
        .order('display_order', { foreignTable: 'day_meal', ascending: true });

      if (mealsError) throw mealsError;
      setMeals(mealsData || []);
      setPlan(planData);
      setMacrosPct({ protein: planData.protein_pct, carbs: planData.carbs_pct, fat: planData.fat_pct });
    } catch (error) {
      toast({ title: "Error", description: `No se pudo cargar tu plan: ${error.message}`, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [planId, toast]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  const effectiveTdee = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const applicableOverride = calorieOverrides
      .filter(o => o.effective_date <= today)
      .sort((a, b) => new Date(b.effective_date) - new Date(a.effective_date))[0];

    return applicableOverride ? applicableOverride.manual_calories : calculatedTdee;
  }, [calculatedTdee, calorieOverrides]);

  if (loading) {
    return (
      <>
        <Helmet>
          <title>Mi Plan Asignado - Gsus Martz</title>
        </Helmet>
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-10 h-10 animate-spin text-green-500" />
        </div>
      </>
    );
  }

  if (!planId || !plan) {
    return (
      <>
        <Helmet>
          <title>Mi Plan Asignado - Gsus Martz</title>
        </Helmet>
        <div className="p-6 max-w-4xl mx-auto">
          <Card className="bg-slate-900/50 border-gray-800 text-white">
            <CardHeader>
              <CardTitle>No tienes un plan activo asignado</CardTitle>
              <CardDescription className="text-gray-400">Contacta con tu entrenador para que te asigne una dieta.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </>
    );
  }

  const clientName = plan?.profile?.full_name || 'Tu plan';

  return (
    <>
      <Helmet>
        <title>{`Mi Plan Asignado - ${clientName}`}</title>
      </Helmet>
      <main className="w-full p-4 lg:p-8 space-y-8 max-w-[1600px] mx-auto">
        <div className="flex items-center gap-2 text-gray-400">
          <ArrowLeft className="w-4 h-4" />
          <span>Tu dieta asignada por tu entrenador</span>
        </div>
        <PlanHeader plan={plan} onUpdate={fetchPlan} onToggleActive={() => { }} readOnly />

        <div className="my-4 grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2">
            <MacroDistribution
              effectiveTdee={effectiveTdee}
              macrosPct={macrosPct}
              onMacrosPctChange={() => { }}
              calorieOverrides={calorieOverrides}
              dietPlanId={plan.id}
              onOverridesUpdate={fetchPlan}
              isTemplate={plan.is_template}
              readOnly
            />
          </div>
          {meals.length > 0 && (
            <div className="lg:col-span-3">
              <MealMacroConfiguration
                meals={meals}
                onSaveConfiguration={() => { }}
                effectiveTdee={effectiveTdee}
                macrosPct={macrosPct}
                shouldAutoExpand
                hideSaveButton
                readOnly
              />
            </div>
          )}
        </div>

        <PlanView
          plan={plan}
          onUpdate={fetchPlan}
          userDayMeals={meals}
          isAssignedPlan={true}
          readOnly
        />
      </main>
    </>
  );
};

const UserDietTemplatesPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [checkingCoach, setCheckingCoach] = useState(true);
  const [hasCoach, setHasCoach] = useState(false);
  const [activePlanId, setActivePlanId] = useState(null);

  useEffect(() => {
    const determineMode = async () => {
      if (!user) return;
      setCheckingCoach(true);
      try {
        const { data: assignments, error } = await supabase
          .from('coach_clients')
          .select('coach_id')
          .eq('client_id', user.id);

        if (error) throw error;

        const assigned = (assignments?.length || 0) > 0;
        setHasCoach(assigned);

        if (assigned) {
          const { data: planData, error: planError } = await supabase
            .from('diet_plans')
            .select('id')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .maybeSingle();

          if (planError && planError.code !== 'PGRST116') throw planError;
          setActivePlanId(planData?.id || null);
        }
      } catch (error) {
        toast({ title: 'Error', description: 'No se pudo determinar tu rol en la dieta.', variant: 'destructive' });
      } finally {
        setCheckingCoach(false);
      }
    };

    determineMode();
  }, [toast, user]);

  if (checkingCoach) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-10 h-10 animate-spin text-green-500" />
      </div>
    );
  }

  if (hasCoach) {
    return <ClientAssignedPlanView planId={activePlanId} />;
  }

  return <ClientTemplateManager user={user} />;
};

export default UserDietTemplatesPage;
