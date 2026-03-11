import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Pencil, Trash2 } from 'lucide-react';
import { PRICING_PRODUCT_AREAS } from '@/lib/pricingService';

const PRODUCT_AREA_OPTIONS = [
  { value: PRICING_PRODUCT_AREAS.NUTRITION, label: 'Nutrición' },
  { value: PRICING_PRODUCT_AREAS.WORKOUT, label: 'Entreno' },
  { value: PRICING_PRODUCT_AREAS.BUNDLE, label: 'Bundle' },
];

const emptyPlanForm = {
  slug: '',
  name: '',
  subtitle: '',
  description: '',
  priceAmount: '0',
  priceCurrency: 'EUR',
  billingType: 'monthly',
  ctaLabel: 'Empezar',
  ctaLink: '/signup',
  isPopular: false,
  isActive: true,
  showOnHome: true,
  showOnPricing: true,
  sortOrder: '0',
  productArea: PRICING_PRODUCT_AREAS.NUTRITION,
  features: [
    { id: 'tmp-1', featureText: '', included: true, sortOrder: 1 },
  ],
  targetRoleIds: [],
};

const PricingManagementPage = () => {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [savingPlan, setSavingPlan] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const [plans, setPlans] = useState([]);
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState(null);
  const [planForm, setPlanForm] = useState(emptyPlanForm);

  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [grantNotes, setGrantNotes] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [plansRes, rolesRes, usersRes, subsRes] = await Promise.all([
        supabase
          .from('commercial_plans')
          .select(`
            id,
            slug,
            name,
            subtitle,
            description,
            price_amount,
            price_currency,
            billing_type,
            cta_label,
            cta_link,
            is_popular,
            is_active,
            show_on_home,
            show_on_pricing,
            product_area,
            sort_order,
            commercial_plan_features(id, feature_text, included, sort_order),
            commercial_plan_role_targets(role_id)
          `)
          .order('sort_order', { ascending: true })
          .order('id', { ascending: true }),
        supabase.from('roles').select('id, role, description').order('id', { ascending: true }),
        supabase.from('profiles').select('user_id, full_name, email').order('created_at', { ascending: false }).limit(200),
        supabase
          .from('user_subscriptions')
          .select('id, user_id, plan_id, status, is_complimentary, created_at, commercial_plans(name)')
          .order('created_at', { ascending: false })
          .limit(30),
      ]);

      if (plansRes.error) {
        console.error('[PricingManagementPage] plansRes.error:', plansRes.error);
        throw plansRes.error;
      }
      if (rolesRes.error) {
        console.error('[PricingManagementPage] rolesRes.error:', rolesRes.error);
        throw rolesRes.error;
      }
      if (usersRes.error) {
        console.error('[PricingManagementPage] usersRes.error:', usersRes.error);
        throw usersRes.error;
      }
      if (subsRes.error) {
        console.error('[PricingManagementPage] subsRes.error:', subsRes.error);
        throw subsRes.error;
      }

      const usersMap = new Map((usersRes.data || []).map((user) => [user.user_id, user]));
      const normalizedSubscriptions = (subsRes.data || []).map((sub) => ({
        ...sub,
        profile: usersMap.get(sub.user_id) || null,
      }));

      setPlans(plansRes.data || []);
      setRoles(rolesRes.data || []);
      setUsers(usersRes.data || []);
      setSubscriptions(normalizedSubscriptions);
    } catch (error) {
      console.error('[PricingManagementPage] fetchData error:', error);
      toast({
        title: 'Error',
        description: `No se pudieron cargar planes/suscripciones. ${error?.message || ''}`.trim(),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const roleLabelById = useMemo(() => {
    const map = new Map();
    roles.forEach((role) => map.set(role.id, role.role));
    return map;
  }, [roles]);

  const activePlans = useMemo(
    () => plans.filter((p) => p.is_active),
    [plans]
  );

  const openCreateDialog = () => {
    setEditingPlanId(null);
    setPlanForm(emptyPlanForm);
    setIsDialogOpen(true);
  };

  const openEditDialog = (plan) => {
    setEditingPlanId(plan.id);
    setPlanForm({
      slug: plan.slug || '',
      name: plan.name || '',
      subtitle: plan.subtitle || '',
      description: plan.description || '',
      priceAmount: String(plan.price_amount ?? 0),
      priceCurrency: plan.price_currency || 'EUR',
      billingType: plan.billing_type || 'monthly',
      ctaLabel: plan.cta_label || 'Empezar',
      ctaLink: plan.cta_link || '/signup',
      isPopular: !!plan.is_popular,
      isActive: !!plan.is_active,
      showOnHome: !!plan.show_on_home,
      showOnPricing: !!plan.show_on_pricing,
      sortOrder: String(plan.sort_order ?? 0),
      productArea: plan.product_area || PRICING_PRODUCT_AREAS.NUTRITION,
      features: (plan.commercial_plan_features || []).length
        ? plan.commercial_plan_features
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
            .map((feature) => ({
              id: feature.id,
              featureText: feature.feature_text || '',
              included: !!feature.included,
              sortOrder: feature.sort_order || 0,
            }))
        : [{ id: 'tmp-1', featureText: '', included: true, sortOrder: 1 }],
      targetRoleIds: (plan.commercial_plan_role_targets || []).map((target) => target.role_id),
    });
    setIsDialogOpen(true);
  };

  const handleFeatureChange = (index, key, value) => {
    setPlanForm((prev) => {
      const next = [...prev.features];
      next[index] = { ...next[index], [key]: value };
      return { ...prev, features: next };
    });
  };

  const addFeature = () => {
    setPlanForm((prev) => ({
      ...prev,
      features: [
        ...prev.features,
        {
          id: `tmp-${Date.now()}`,
          featureText: '',
          included: true,
          sortOrder: prev.features.length + 1,
        },
      ],
    }));
  };

  const removeFeature = (index) => {
    setPlanForm((prev) => {
      const next = prev.features.filter((_, idx) => idx !== index);
      return { ...prev, features: next.length ? next : [{ id: 'tmp-1', featureText: '', included: true, sortOrder: 1 }] };
    });
  };

  const toggleTargetRole = (roleId) => {
    setPlanForm((prev) => {
      const exists = prev.targetRoleIds.includes(roleId);
      return {
        ...prev,
        targetRoleIds: exists
          ? prev.targetRoleIds.filter((id) => id !== roleId)
          : [...prev.targetRoleIds, roleId],
      };
    });
  };

  const savePlan = async () => {
    if (!planForm.slug.trim() || !planForm.name.trim()) {
      toast({ title: 'Validación', description: 'Slug y nombre son obligatorios.', variant: 'destructive' });
      return;
    }

    const cleanedFeatures = planForm.features
      .map((feature, idx) => ({
        feature_text: feature.featureText.trim(),
        included: !!feature.included,
        sort_order: Number(feature.sortOrder || idx + 1),
      }))
      .filter((feature) => feature.feature_text.length > 0);

    if (!cleanedFeatures.length) {
      toast({ title: 'Validación', description: 'Debes añadir al menos una característica.', variant: 'destructive' });
      return;
    }

    setSavingPlan(true);
    try {
      const payload = {
        slug: planForm.slug.trim().toLowerCase(),
        name: planForm.name.trim(),
        subtitle: planForm.subtitle.trim() || null,
        description: planForm.description.trim() || null,
        price_amount: Number(planForm.priceAmount || 0),
        price_currency: planForm.priceCurrency || 'EUR',
        billing_type: planForm.billingType,
        cta_label: planForm.ctaLabel.trim() || 'Empezar',
        cta_link: planForm.ctaLink.trim() || '/signup',
        is_popular: planForm.isPopular,
        is_active: planForm.isActive,
        show_on_home: planForm.showOnHome,
        show_on_pricing: planForm.showOnPricing,
        product_area: planForm.productArea || PRICING_PRODUCT_AREAS.NUTRITION,
        sort_order: Number(planForm.sortOrder || 0),
      };

      let planId = editingPlanId;

      if (editingPlanId) {
        const { error } = await supabase.from('commercial_plans').update(payload).eq('id', editingPlanId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('commercial_plans').insert(payload).select('id').single();
        if (error) throw error;
        planId = data.id;
      }

      const { error: delFeaturesError } = await supabase.from('commercial_plan_features').delete().eq('plan_id', planId);
      if (delFeaturesError) throw delFeaturesError;

      const { error: insFeaturesError } = await supabase
        .from('commercial_plan_features')
        .insert(cleanedFeatures.map((feature) => ({ ...feature, plan_id: planId })));
      if (insFeaturesError) throw insFeaturesError;

      const { error: delTargetsError } = await supabase.from('commercial_plan_role_targets').delete().eq('plan_id', planId);
      if (delTargetsError) throw delTargetsError;

      if (planForm.targetRoleIds.length > 0) {
        const { error: insTargetsError } = await supabase.from('commercial_plan_role_targets').insert(
          planForm.targetRoleIds.map((roleId) => ({
            plan_id: planId,
            role_id: roleId,
          }))
        );
        if (insTargetsError) throw insTargetsError;
      }

      toast({ title: 'Guardado', description: 'Plan guardado correctamente.', variant: 'success' });
      setIsDialogOpen(false);
      setPlanForm(emptyPlanForm);
      setEditingPlanId(null);
      fetchData();
    } catch (error) {
      console.error('[PricingManagementPage] savePlan error:', error);
      toast({ title: 'Error', description: error.message || 'No se pudo guardar el plan.', variant: 'destructive' });
    } finally {
      setSavingPlan(false);
    }
  };

  const deletePlan = async (planId) => {
    if (!window.confirm('¿Eliminar este plan?')) return;

    try {
      const { error } = await supabase.from('commercial_plans').delete().eq('id', planId);
      if (error) throw error;
      toast({ title: 'Eliminado', description: 'Plan eliminado.', variant: 'success' });
      fetchData();
    } catch (error) {
      console.error('[PricingManagementPage] deletePlan error:', error);
      toast({ title: 'Error', description: 'No se pudo eliminar el plan.', variant: 'destructive' });
    }
  };

  const assignManualSubscription = async () => {
    if (!selectedUserId || !selectedPlanId) {
      toast({ title: 'Validación', description: 'Selecciona usuario y plan.', variant: 'destructive' });
      return;
    }

    setAssigning(true);
    try {
      const { error } = await supabase.rpc('admin_upsert_user_subscription', {
        p_user_id: selectedUserId,
        p_plan_id: Number(selectedPlanId),
        p_status: 'active',
        p_source: 'manual',
        p_is_complimentary: true,
        p_amount_paid: null,
        p_currency: 'EUR',
        p_starts_at: new Date().toISOString(),
        p_ends_at: null,
        p_notes: grantNotes || 'Asignación manual por admin',
        p_sync_role: true,
      });

      if (error) throw error;

      toast({
        title: 'Acceso asignado',
        description: 'Se creó la suscripción manual y se sincronizó el rol del usuario.',
        variant: 'success',
      });

      setSelectedUserId('');
      setSelectedPlanId('');
      setGrantNotes('');
      fetchData();
    } catch (error) {
      console.error('[PricingManagementPage] assignManualSubscription error:', error);
      toast({ title: 'Error', description: error.message || 'No se pudo asignar el acceso.', variant: 'destructive' });
    } finally {
      setAssigning(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Gestión de Pricing - Bibofit</title>
      </Helmet>

      <main className="w-full px-4 py-8">
        <div className="max-w-7xl mx-auto text-white space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Planes y Ofertas</CardTitle>
                <CardDescription>Crea/edita planes dinámicos para Home y Pricing.</CardDescription>
              </div>
              <Button onClick={openCreateDialog} className="bg-green-600 hover:bg-green-700 text-white">
                <Plus className="w-4 h-4 mr-2" /> Nuevo Plan
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center items-center h-24">
                  <Loader2 className="h-7 w-7 animate-spin text-green-500" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plan</TableHead>
                      <TableHead>Precio</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Área</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Popular</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plans.map((plan) => (
                      <TableRow key={plan.id}>
                        <TableCell>
                          <div className="font-semibold">{plan.name}</div>
                          <div className="text-xs text-muted-foreground">{plan.slug}</div>
                        </TableCell>
                        <TableCell>
                          {Number(plan.price_amount || 0)} {plan.price_currency || 'EUR'}
                          <div className="text-xs text-muted-foreground">{plan.billing_type === 'one_time' ? 'Pago unico' : 'Mensual'}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {(plan.commercial_plan_role_targets || []).map((target) => (
                              <Badge key={`${plan.id}-${target.role_id}`} variant="outline">
                                {roleLabelById.get(target.role_id) || `role:${target.role_id}`}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          {PRODUCT_AREA_OPTIONS.find((opt) => opt.value === plan.product_area)?.label || plan.product_area || 'Nutrición'}
                        </TableCell>
                        <TableCell>{plan.is_active ? 'Activo' : 'Inactivo'}</TableCell>
                        <TableCell>{plan.is_popular ? 'Si' : 'No'}</TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex gap-2">
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(plan)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => deletePlan(plan.id)}>
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Asignación Manual (Premium regalado)</CardTitle>
              <CardDescription>
                Como admin puedes asignar un plan activo a cualquier usuario sin pago. Esto crea suscripción manual y sincroniza el rol.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-3 gap-3">
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar usuario" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {users.map((user) => (
                      <SelectItem key={user.user_id} value={user.user_id}>
                        {(user.full_name || user.email || user.user_id).slice(0, 80)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {activePlans.map((plan) => (
                      <SelectItem key={plan.id} value={String(plan.id)}>
                        {plan.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  value={grantNotes}
                  onChange={(event) => setGrantNotes(event.target.value)}
                  placeholder="Nota (opcional)"
                  className="bg-card border-border"
                />
              </div>

              <Button onClick={assignManualSubscription} disabled={assigning} className="bg-green-600 hover:bg-green-700 text-white">
                {assigning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Asignar acceso manual
              </Button>

              <div className="border border-border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Tipo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subscriptions.map((sub) => (
                      <TableRow key={sub.id}>
                        <TableCell>{sub?.profile?.full_name || sub?.profile?.email || sub.user_id}</TableCell>
                        <TableCell>{sub?.commercial_plans?.name || sub.plan_id}</TableCell>
                        <TableCell>{sub.status}</TableCell>
                        <TableCell>{sub.is_complimentary ? 'Complimentary' : 'Pago'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-background border-border text-white sm:max-w-[860px]">
          <DialogHeader>
            <DialogTitle>{editingPlanId ? 'Editar plan' : 'Nuevo plan'}</DialogTitle>
            <DialogDescription>Configura nombre, precio, CTA, área comercial, características y roles objetivo.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[72vh] overflow-y-auto pr-1">
            <div className="grid md:grid-cols-3 gap-3">
              <Input value={planForm.slug} onChange={(e) => setPlanForm((prev) => ({ ...prev, slug: e.target.value }))} placeholder="slug (pro)" className="bg-card border-border" />
              <Input value={planForm.name} onChange={(e) => setPlanForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Nombre" className="bg-card border-border" />
              <Input value={planForm.subtitle} onChange={(e) => setPlanForm((prev) => ({ ...prev, subtitle: e.target.value }))} placeholder="Subtitulo" className="bg-card border-border" />
            </div>

            <Textarea
              value={planForm.description}
              onChange={(e) => setPlanForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Descripción"
              className="bg-card border-border"
            />

            <div className="grid md:grid-cols-5 gap-3">
              <Input value={planForm.priceAmount} onChange={(e) => setPlanForm((prev) => ({ ...prev, priceAmount: e.target.value }))} placeholder="Precio" className="bg-card border-border" />
              <Input value={planForm.priceCurrency} onChange={(e) => setPlanForm((prev) => ({ ...prev, priceCurrency: e.target.value.toUpperCase() }))} placeholder="Moneda" className="bg-card border-border" />

              <Select value={planForm.billingType} onValueChange={(value) => setPlanForm((prev) => ({ ...prev, billingType: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo cobro" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensual</SelectItem>
                  <SelectItem value="one_time">Pago unico</SelectItem>
                </SelectContent>
              </Select>

              <Select value={planForm.productArea} onValueChange={(value) => setPlanForm((prev) => ({ ...prev, productArea: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Área" />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_AREA_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input value={planForm.sortOrder} onChange={(e) => setPlanForm((prev) => ({ ...prev, sortOrder: e.target.value }))} placeholder="Orden" className="bg-card border-border" />
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <Input value={planForm.ctaLabel} onChange={(e) => setPlanForm((prev) => ({ ...prev, ctaLabel: e.target.value }))} placeholder="Texto CTA" className="bg-card border-border" />
              <Input value={planForm.ctaLink} onChange={(e) => setPlanForm((prev) => ({ ...prev, ctaLink: e.target.value }))} placeholder="Destino CTA" className="bg-card border-border" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <label className="flex items-center justify-between bg-card border border-border rounded-md p-2">
                <span>Popular</span>
                <Switch checked={planForm.isPopular} onCheckedChange={(value) => setPlanForm((prev) => ({ ...prev, isPopular: value }))} />
              </label>
              <label className="flex items-center justify-between bg-card border border-border rounded-md p-2">
                <span>Activo</span>
                <Switch checked={planForm.isActive} onCheckedChange={(value) => setPlanForm((prev) => ({ ...prev, isActive: value }))} />
              </label>
              <label className="flex items-center justify-between bg-card border border-border rounded-md p-2">
                <span>Mostrar Home</span>
                <Switch checked={planForm.showOnHome} onCheckedChange={(value) => setPlanForm((prev) => ({ ...prev, showOnHome: value }))} />
              </label>
              <label className="flex items-center justify-between bg-card border border-border rounded-md p-2">
                <span>Mostrar Pricing</span>
                <Switch checked={planForm.showOnPricing} onCheckedChange={(value) => setPlanForm((prev) => ({ ...prev, showOnPricing: value }))} />
              </label>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Características</h4>
                <Button size="sm" variant="outline" onClick={addFeature}>
                  <Plus className="w-4 h-4 mr-1" /> Añadir
                </Button>
              </div>
              <div className="space-y-2">
                {planForm.features.map((feature, idx) => (
                  <div key={feature.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
                    <Input
                      value={feature.featureText}
                      onChange={(e) => handleFeatureChange(idx, 'featureText', e.target.value)}
                      placeholder="Texto de característica"
                      className="bg-card border-border"
                    />
                    <Input
                      value={feature.sortOrder}
                      onChange={(e) => handleFeatureChange(idx, 'sortOrder', e.target.value)}
                      placeholder="Orden"
                      className="w-20 bg-card border-border"
                    />
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Switch checked={feature.included} onCheckedChange={(value) => handleFeatureChange(idx, 'included', value)} />
                      Incluida
                    </label>
                    <Button size="icon" variant="ghost" onClick={() => removeFeature(idx)}>
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold">Roles objetivo del plan</h4>
              <div className="flex gap-2 flex-wrap">
                {roles.map((role) => {
                  const selected = planForm.targetRoleIds.includes(role.id);
                  return (
                    <Button
                      key={role.id}
                      type="button"
                      variant={selected ? 'default' : 'outline'}
                      onClick={() => toggleTargetRole(role.id)}
                      className={selected ? 'bg-green-600 hover:bg-green-700 text-white' : ''}
                    >
                      {role.role}
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={savePlan} disabled={savingPlan} className="bg-green-600 hover:bg-green-700 text-white">
              {savingPlan ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Guardar plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PricingManagementPage;
