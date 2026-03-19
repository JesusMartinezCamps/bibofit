import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { isAdminRole } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Megaphone, Plus, Loader2, Send, Pencil, Trash2, Copy,
  X, Users, ChevronLeft, AlertTriangle, CheckCircle2, Clock,
  FileText, RefreshCw, Eye,
} from 'lucide-react';

// ─── Constantes ───────────────────────────────────────────────────────────────

const BROADCAST_TYPES = [
  { value: 'broadcast',    label: 'General',  description: 'Mensaje informativo estándar' },
  { value: 'announcement', label: 'Anuncio',  description: 'Novedad importante de la plataforma' },
  { value: 'alert',        label: 'Alerta',   description: 'Aviso urgente o crítico' },
];

const STATUS_CONFIG = {
  draft:     { label: 'Borrador',    color: 'bg-muted text-muted-foreground',       icon: FileText },
  scheduled: { label: 'Programada', color: 'bg-amber-500/15 text-amber-600',        icon: Clock },
  sent:      { label: 'Enviada',    color: 'bg-green-500/15 text-green-600',        icon: CheckCircle2 },
  cancelled: { label: 'Cancelada',  color: 'bg-destructive/10 text-destructive',    icon: X },
};

const TYPE_CONFIG = {
  broadcast:    { label: 'General', color: 'bg-primary/10 text-primary' },
  announcement: { label: 'Anuncio', color: 'bg-violet-500/10 text-violet-600' },
  alert:        { label: 'Alerta',  color: 'bg-amber-500/10 text-amber-600' },
};

const TABS = [
  { value: 'all',       label: 'Todas' },
  { value: 'draft',     label: 'Borradores' },
  { value: 'scheduled', label: 'Programadas' },
  { value: 'sent',      label: 'Enviadas' },
];

const EMPTY_FORM = {
  title: '',
  message: '',
  type: 'broadcast',
  filter_roles:               [],
  filter_subscription_status: [],
  filter_sex:                 [],
  filter_age_min:             null,
  filter_age_max:             null,
  filter_cities:              [],
  filter_profile_type:        null,
  filter_center_ids:          [],
  filter_onboarding_done:     null,
  filter_has_coach:           null,
  filter_no_diet_plan:        null,
  filter_registered_after:    null,
  filter_registered_before:   null,
};

// ─── Definición de filtros disponibles ────────────────────────────────────────
// Cada entrada define cómo se muestra, qué campos maneja y cómo se resetea.

const FILTER_DEFS = [
  {
    key:    'roles',
    label:  'Rol',
    fields: ['filter_roles'],
    reset:  { filter_roles: [] },
    isEmpty: (f) => !f.filter_roles?.length,
    options: [
      { value: 'free',   label: 'Free' },
      { value: 'client', label: 'Clientes (Pro)' },
      { value: 'coach',  label: 'Coaches' },
      { value: 'admin',  label: 'Admins' },
    ],
    render: (form, onChange) => (
      <CheckboxRow
        options={FILTER_DEFS.find(d => d.key === 'roles').options}
        value={form.filter_roles}
        onChange={v => onChange({ ...form, filter_roles: v })}
      />
    ),
  },
  {
    key:    'subscription_status',
    label:  'Estado de suscripción',
    fields: ['filter_subscription_status'],
    reset:  { filter_subscription_status: [] },
    isEmpty: (f) => !f.filter_subscription_status?.length,
    options: [
      { value: 'active',   label: 'Activa' },
      { value: 'expired',  label: 'Expirada' },
      { value: 'canceled', label: 'Cancelada' },
      { value: 'pending',  label: 'Pendiente' },
    ],
    render: (form, onChange) => (
      <CheckboxRow
        options={FILTER_DEFS.find(d => d.key === 'subscription_status').options}
        value={form.filter_subscription_status}
        onChange={v => onChange({ ...form, filter_subscription_status: v })}
      />
    ),
  },
  {
    key:    'sex',
    label:  'Sexo',
    fields: ['filter_sex'],
    reset:  { filter_sex: [] },
    isEmpty: (f) => !f.filter_sex?.length,
    options: [
      { value: 'Hombre', label: 'Hombre' },
      { value: 'Mujer',  label: 'Mujer' },
    ],
    render: (form, onChange) => (
      <CheckboxRow
        options={FILTER_DEFS.find(d => d.key === 'sex').options}
        value={form.filter_sex}
        onChange={v => onChange({ ...form, filter_sex: v })}
      />
    ),
  },
  {
    key:    'age',
    label:  'Rango de edad',
    fields: ['filter_age_min', 'filter_age_max'],
    reset:  { filter_age_min: null, filter_age_max: null },
    isEmpty: (f) => f.filter_age_min == null && f.filter_age_max == null,
    render: (form, onChange) => (
      <div className="flex items-center gap-2">
        <Input
          type="number" placeholder="Mín" min={0} max={120}
          className="h-7 w-20 text-sm"
          value={form.filter_age_min ?? ''}
          onChange={e => onChange({ ...form, filter_age_min: e.target.value ? Number(e.target.value) : null })}
        />
        <span className="text-muted-foreground text-sm">—</span>
        <Input
          type="number" placeholder="Máx" min={0} max={120}
          className="h-7 w-20 text-sm"
          value={form.filter_age_max ?? ''}
          onChange={e => onChange({ ...form, filter_age_max: e.target.value ? Number(e.target.value) : null })}
        />
        <span className="text-sm text-muted-foreground">años</span>
      </div>
    ),
  },
  {
    key:    'cities',
    label:  'Ciudad',
    fields: ['filter_cities'],
    reset:  { filter_cities: [] },
    isEmpty: (f) => !f.filter_cities?.length,
    render: (form, onChange) => (
      <div className="flex flex-col gap-1 flex-1">
        <Input
          className="h-7 text-sm"
          placeholder="Madrid, Barcelona, Valencia..."
          value={(form.filter_cities ?? []).join(', ')}
          onChange={e => {
            const val = e.target.value;
            const arr = val
              ? val.split(',').map(s => s.trim()).filter(Boolean)
              : [];
            onChange({ ...form, filter_cities: arr });
          }}
        />
        <span className="text-[11px] text-muted-foreground">Separadas por comas, sin distinción de mayúsculas</span>
      </div>
    ),
  },
  {
    key:    'profile_type',
    label:  'Tipo de perfil',
    fields: ['filter_profile_type'],
    reset:  { filter_profile_type: null },
    isEmpty: (f) => f.filter_profile_type == null,
    render: (form, onChange) => (
      <Select
        value={form.filter_profile_type ?? ''}
        onValueChange={v => onChange({ ...form, filter_profile_type: v || null })}
      >
        <SelectTrigger className="h-7 w-44 text-sm"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="free">Plan Free</SelectItem>
          <SelectItem value="paid">Plan de pago</SelectItem>
        </SelectContent>
      </Select>
    ),
  },
  {
    key:    'center_ids',
    label:  'Centro',
    fields: ['filter_center_ids'],
    reset:  { filter_center_ids: [] },
    isEmpty: (f) => !f.filter_center_ids?.length,
    // render se inyecta dinámicamente con la lista de centros
    render: null,
  },
  {
    key:    'onboarding_done',
    label:  'Onboarding',
    fields: ['filter_onboarding_done'],
    reset:  { filter_onboarding_done: null },
    isEmpty: (f) => f.filter_onboarding_done == null,
    render: (form, onChange) => (
      <Select
        value={form.filter_onboarding_done == null ? '' : form.filter_onboarding_done ? 'yes' : 'no'}
        onValueChange={v => onChange({ ...form, filter_onboarding_done: v === '' ? null : v === 'yes' })}
      >
        <SelectTrigger className="h-7 w-52 text-sm"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="yes">Solo completaron onboarding</SelectItem>
          <SelectItem value="no">Solo sin completar</SelectItem>
        </SelectContent>
      </Select>
    ),
  },
  {
    key:    'has_coach',
    label:  'Tiene coach',
    fields: ['filter_has_coach'],
    reset:  { filter_has_coach: null },
    isEmpty: (f) => f.filter_has_coach == null,
    render: (form, onChange) => (
      <Select
        value={form.filter_has_coach == null ? '' : form.filter_has_coach ? 'yes' : 'no'}
        onValueChange={v => onChange({ ...form, filter_has_coach: v === '' ? null : v === 'yes' })}
      >
        <SelectTrigger className="h-7 w-44 text-sm"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="yes">Con coach asignado</SelectItem>
          <SelectItem value="no">Sin coach asignado</SelectItem>
        </SelectContent>
      </Select>
    ),
  },
  {
    key:    'no_diet_plan',
    label:  'Plan de dieta',
    fields: ['filter_no_diet_plan'],
    reset:  { filter_no_diet_plan: null },
    isEmpty: (f) => f.filter_no_diet_plan == null,
    render: (form, onChange) => (
      <Select
        value={form.filter_no_diet_plan == null ? '' : form.filter_no_diet_plan ? 'none' : 'has'}
        onValueChange={v => onChange({ ...form, filter_no_diet_plan: v === '' ? null : v === 'none' })}
      >
        <SelectTrigger className="h-7 w-52 text-sm"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="has">Con plan de dieta activo</SelectItem>
          <SelectItem value="none">Sin plan de dieta</SelectItem>
        </SelectContent>
      </Select>
    ),
  },
  {
    key:    'registered_after',
    label:  'Registrado desde',
    fields: ['filter_registered_after'],
    reset:  { filter_registered_after: null },
    isEmpty: (f) => f.filter_registered_after == null,
    render: (form, onChange) => (
      <Input
        type="date"
        className="h-7 w-44 text-sm"
        value={form.filter_registered_after ? form.filter_registered_after.slice(0, 10) : ''}
        onChange={e => onChange({ ...form, filter_registered_after: e.target.value ? `${e.target.value}T00:00:00Z` : null })}
      />
    ),
  },
  {
    key:    'registered_before',
    label:  'Registrado hasta',
    fields: ['filter_registered_before'],
    reset:  { filter_registered_before: null },
    isEmpty: (f) => f.filter_registered_before == null,
    render: (form, onChange) => (
      <Input
        type="date"
        className="h-7 w-44 text-sm"
        value={form.filter_registered_before ? form.filter_registered_before.slice(0, 10) : ''}
        onChange={e => onChange({ ...form, filter_registered_before: e.target.value ? `${e.target.value}T23:59:59Z` : null })}
      />
    ),
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (ts) => {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const buildFilterSummary = (b) => {
  const parts = [];
  if (b.filter_roles?.length)               parts.push(b.filter_roles.join(', '));
  if (b.filter_sex?.length)                 parts.push(b.filter_sex.join('/'));
  if (b.filter_profile_type)                parts.push(b.filter_profile_type === 'free' ? 'Plan Free' : 'De pago');
  if (b.filter_subscription_status?.length) parts.push(`Sus: ${b.filter_subscription_status.join('/')}`);
  if (b.filter_cities?.length)              parts.push(b.filter_cities.join(', '));
  if (b.filter_age_min || b.filter_age_max) parts.push(`${b.filter_age_min ?? '?'}–${b.filter_age_max ?? '?'} años`);
  if (b.filter_onboarding_done === true)    parts.push('Onboarding ✓');
  if (b.filter_onboarding_done === false)   parts.push('Onboarding ✗');
  if (b.filter_has_coach === true)          parts.push('Con coach');
  if (b.filter_has_coach === false)         parts.push('Sin coach');
  if (b.filter_no_diet_plan === true)       parts.push('Sin plan dieta');
  if (b.filter_registered_after)           parts.push(`Desde ${b.filter_registered_after.slice(0,10)}`);
  if (b.filter_registered_before)          parts.push(`Hasta ${b.filter_registered_before.slice(0,10)}`);
  return parts.length ? parts.join(' · ') : 'Todos los usuarios';
};

// Detecta qué filter keys tienen valores activos en un broadcast guardado
const inferActiveKeys = (b) => {
  if (!b) return [];
  return FILTER_DEFS
    .filter(d => !d.isEmpty(b))
    .map(d => d.key);
};

// ─── CheckboxRow ──────────────────────────────────────────────────────────────

const CheckboxRow = ({ options, value = [], onChange }) => (
  <div className="flex flex-wrap gap-3">
    {options.map(opt => (
      <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer select-none">
        <Checkbox
          checked={value.includes(opt.value)}
          onCheckedChange={(checked) =>
            onChange(checked ? [...value, opt.value] : value.filter(v => v !== opt.value))
          }
        />
        <span className="text-sm">{opt.label}</span>
      </label>
    ))}
  </div>
);

// ─── FilterBuilder ────────────────────────────────────────────────────────────

const FilterBuilder = ({ form, onChange, centers, isReadOnly }) => {
  const [activeKeys, setActiveKeys] = useState(() => inferActiveKeys(form));

  // Render de centros (necesita la lista dinámica)
  const renderCenterFilter = (f, onCh) => {
    if (!centers.length) return <span className="text-sm text-muted-foreground">No hay centros disponibles</span>;
    return (
      <CheckboxRow
        options={centers.map(c => ({ value: String(c.id), label: c.name }))}
        value={(f.filter_center_ids ?? []).map(String)}
        onChange={v => onCh({ ...f, filter_center_ids: v.map(Number) })}
      />
    );
  };

  const addFilter = (key) => setActiveKeys(prev => [...prev, key]);

  const removeFilter = (key) => {
    const def = FILTER_DEFS.find(d => d.key === key);
    setActiveKeys(prev => prev.filter(k => k !== key));
    onChange({ ...form, ...def.reset });
  };

  const unusedDefs = FILTER_DEFS.filter(d => !activeKeys.includes(d.key));

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          Segmentación
        </p>
        {activeKeys.length === 0 && (
          <span className="text-[11px] text-muted-foreground">Sin filtros = todos los usuarios</span>
        )}
      </div>

      {/* Filtros activos */}
      {activeKeys.length > 0 && (
        <div className="space-y-2">
          {activeKeys.map(key => {
            const def = FILTER_DEFS.find(d => d.key === key);
            const renderFn = key === 'center_ids' ? renderCenterFilter : def.render;
            return (
              <div
                key={key}
                className="flex items-start gap-3 rounded-md border border-border bg-background px-3 py-2"
              >
                <span className="text-sm font-medium text-muted-foreground w-36 shrink-0 pt-1">
                  {def.label}
                </span>
                <div className="flex-1 min-w-0">
                  {isReadOnly
                    ? <span className="text-sm text-foreground">{buildFilterSummary(form)}</span>
                    : renderFn(form, onChange)
                  }
                </div>
                {!isReadOnly && (
                  <button
                    onClick={() => removeFilter(key)}
                    className="shrink-0 mt-1 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Añadir filtro */}
      {!isReadOnly && unusedDefs.length > 0 && (
        <Select value="" onValueChange={addFilter}>
          <SelectTrigger className="h-8 w-44 text-sm border-dashed text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              <span>Añadir filtro</span>
            </div>
          </SelectTrigger>
          <SelectContent>
            {unusedDefs.map(d => (
              <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
};

// ─── BroadcastEditor ─────────────────────────────────────────────────────────

const BroadcastEditor = ({ broadcast, onClose, onSaved, onSent }) => {
  const { toast } = useToast();
  const [form, setForm] = useState(() =>
    broadcast ? {
      title:                      broadcast.title ?? '',
      message:                    broadcast.message ?? '',
      type:                       broadcast.type ?? 'broadcast',
      filter_roles:               broadcast.filter_roles ?? [],
      filter_subscription_status: broadcast.filter_subscription_status ?? [],
      filter_sex:                 broadcast.filter_sex ?? [],
      filter_age_min:             broadcast.filter_age_min ?? null,
      filter_age_max:             broadcast.filter_age_max ?? null,
      filter_cities:              broadcast.filter_cities ?? [],
      filter_profile_type:        broadcast.filter_profile_type ?? null,
      filter_center_ids:          broadcast.filter_center_ids ?? [],
      filter_onboarding_done:     broadcast.filter_onboarding_done ?? null,
      filter_has_coach:           broadcast.filter_has_coach ?? null,
      filter_no_diet_plan:        broadcast.filter_no_diet_plan ?? null,
      filter_registered_after:    broadcast.filter_registered_after ?? null,
      filter_registered_before:   broadcast.filter_registered_before ?? null,
    } : { ...EMPTY_FORM }
  );

  const [saving, setSaving]               = useState(false);
  const [sending, setSending]             = useState(false);
  const [previewCount, setPreviewCount]   = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [savedId, setSavedId]             = useState(broadcast?.id ?? null);
  const [confirmSend, setConfirmSend]     = useState(false);
  const [centers, setCenters]             = useState([]);
  const debounceRef                       = useRef(null);

  const isReadOnly = broadcast?.status === 'sent' || broadcast?.status === 'cancelled';

  // Cargar centros
  useEffect(() => {
    supabase.from('centers').select('id, name').order('name').then(({ data }) => {
      if (data) setCenters(data);
    });
  }, []);

  // Preview inline: llama directo a la RPC con los filtros actuales
  const fetchPreview = useCallback(async (f) => {
    setPreviewLoading(true);
    try {
      const { data, error } = await supabase.rpc('admin_preview_broadcast_inline', {
        p_filter_roles:               f.filter_roles?.length               ? f.filter_roles               : null,
        p_filter_subscription_status: f.filter_subscription_status?.length ? f.filter_subscription_status : null,
        p_filter_center_ids:          f.filter_center_ids?.length          ? f.filter_center_ids          : null,
        p_filter_onboarding_done:     f.filter_onboarding_done,
        p_filter_sex:                 f.filter_sex?.length                 ? f.filter_sex                 : null,
        p_filter_age_min:             f.filter_age_min,
        p_filter_age_max:             f.filter_age_max,
        p_filter_cities:              f.filter_cities?.length              ? f.filter_cities              : null,
        p_filter_profile_type:        f.filter_profile_type,
        p_filter_has_coach:           f.filter_has_coach,
        p_filter_no_diet_plan:        f.filter_no_diet_plan,
        p_filter_registered_after:    f.filter_registered_after,
        p_filter_registered_before:   f.filter_registered_before,
      });
      if (!error) setPreviewCount(data ?? 0);
    } catch { /* silent */ } finally {
      setPreviewLoading(false);
    }
  }, []);

  // Debounce preview al cambiar filtros (800 ms)
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPreview(form), 800);
    return () => clearTimeout(debounceRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    form.filter_roles, form.filter_subscription_status, form.filter_sex,
    form.filter_age_min, form.filter_age_max, form.filter_cities,
    form.filter_profile_type, form.filter_center_ids, form.filter_onboarding_done,
    form.filter_has_coach, form.filter_no_diet_plan,
    form.filter_registered_after, form.filter_registered_before,
  ]);

  const buildPayload = (f) => ({
    ...f,
    filter_roles:               f.filter_roles?.length               ? f.filter_roles               : null,
    filter_subscription_status: f.filter_subscription_status?.length ? f.filter_subscription_status : null,
    filter_center_ids:          f.filter_center_ids?.length          ? f.filter_center_ids          : null,
    filter_sex:                 f.filter_sex?.length                 ? f.filter_sex                 : null,
    filter_cities:              f.filter_cities?.length              ? f.filter_cities              : null,
    status: 'draft',
  });

  const saveDraft = useCallback(async (f) => {
    const payload = buildPayload(f);
    if (savedId) {
      const { error } = await supabase.from('broadcasts').update(payload).eq('id', savedId);
      if (error) throw error;
      return savedId;
    }
    const { data, error } = await supabase.from('broadcasts').insert(payload).select('id').single();
    if (error) throw error;
    setSavedId(data.id);
    return data.id;
  }, [savedId]);

  const handleSaveDraft = async () => {
    if (!form.title.trim()) {
      toast({ title: 'Escribe un título', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await saveDraft(form);
      toast({ title: 'Borrador guardado' });
      onSaved?.();
      onClose();
    } catch (e) {
      toast({ title: 'Error al guardar', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async () => {
    setSending(true);
    try {
      const id = await saveDraft(form);
      const { data, error } = await supabase.rpc('admin_send_broadcast', { p_broadcast_id: id });
      if (error) throw error;
      toast({ title: `Difusión enviada a ${data} usuarios` });
      onSent?.();
      onClose();
    } catch (e) {
      toast({ title: 'Error al enviar', description: e.message, variant: 'destructive' });
    } finally {
      setSending(false);
      setConfirmSend(false);
    }
  };

  return (
    <>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            {isReadOnly ? 'Detalle de difusión' : broadcast?.id ? 'Editar difusión' : 'Nueva difusión'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-1">

          {/* Título */}
          <div className="space-y-1.5">
            <Label htmlFor="bc-title">Título <span className="text-destructive">*</span></Label>
            <Input
              id="bc-title"
              placeholder="Ej: Nueva función disponible"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              disabled={isReadOnly}
            />
          </div>

          {/* Mensaje */}
          <div className="space-y-1.5">
            <Label htmlFor="bc-message">Mensaje</Label>
            <Textarea
              id="bc-message"
              placeholder="Escribe el cuerpo de la notificación..."
              value={form.message}
              onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              rows={4}
              disabled={isReadOnly}
            />
          </div>

          {/* Tipo */}
          <div className="space-y-1.5">
            <Label>Tipo de notificación</Label>
            <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))} disabled={isReadOnly}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BROADCAST_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                    <span className="text-muted-foreground text-xs ml-2">{t.description}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filter builder */}
          <FilterBuilder
            form={form}
            onChange={setForm}
            centers={centers}
            isReadOnly={isReadOnly}
          />

          {/* Preview de alcance */}
          {!isReadOnly && (
            <div className={cn(
              'flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors',
              previewLoading
                ? 'border-border bg-muted/20'
                : previewCount === null
                  ? 'border-border bg-muted/10'
                  : previewCount === 0
                    ? 'border-amber-500/30 bg-amber-500/5'
                    : 'border-green-500/30 bg-green-500/5',
            )}>
              {previewLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
              ) : previewCount === null ? (
                <Eye className="h-4 w-4 text-muted-foreground shrink-0" />
              ) : previewCount === 0 ? (
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
              ) : (
                <Users className="h-4 w-4 text-green-600 shrink-0" />
              )}
              <span className="text-sm">
                {previewLoading
                  ? 'Calculando alcance...'
                  : previewCount === null
                    ? 'Configura los filtros para ver el alcance estimado'
                    : previewCount === 0
                      ? 'Ningún usuario coincide con los filtros actuales'
                      : <><span className="font-semibold">{previewCount} usuarios</span> recibirán esta difusión</>}
              </span>
            </div>
          )}

          {/* Info envío ya realizado */}
          {broadcast?.status === 'sent' && (
            <div className="rounded-lg border border-green-500/20 bg-green-500/5 px-4 py-3 text-sm space-y-1">
              <p className="font-medium text-green-700">Difusión enviada</p>
              <p className="text-muted-foreground">
                {formatDate(broadcast.sent_at)} · {broadcast.sent_count ?? 0} notificaciones
                {broadcast.target_count ? ` de ${broadcast.target_count} usuarios objetivo` : ''}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>
            {isReadOnly ? 'Cerrar' : 'Cancelar'}
          </Button>
          {!isReadOnly && (
            <>
              <Button
                variant="outline"
                onClick={handleSaveDraft}
                disabled={saving || sending || !form.title.trim()}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Guardar borrador
              </Button>
              <Button
                onClick={() => setConfirmSend(true)}
                disabled={saving || sending || !form.title.trim() || previewCount === 0}
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Enviar ahora
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={confirmSend} onOpenChange={setConfirmSend}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Enviar difusión?</AlertDialogTitle>
            <AlertDialogDescription>
              Se enviará una notificación a <strong>{previewCount ?? '?'} usuarios</strong>.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSend} disabled={sending}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar envío
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

// ─── BroadcastRow ─────────────────────────────────────────────────────────────

const BroadcastRow = ({ broadcast: b, onEdit, onDuplicate, onDelete, onCancel }) => {
  const StatusIcon = STATUS_CONFIG[b.status]?.icon ?? FileText;
  const typeConf   = TYPE_CONFIG[b.type]   ?? TYPE_CONFIG.broadcast;
  const statusConf = STATUS_CONFIG[b.status] ?? STATUS_CONFIG.draft;

  return (
    <tr className="border-b border-border hover:bg-muted/30 transition-colors group">
      <td className="px-4 py-3 max-w-[260px]">
        <p className="font-medium text-sm truncate">{b.title}</p>
        <p className="text-[11px] text-muted-foreground truncate mt-0.5">{buildFilterSummary(b)}</p>
      </td>
      <td className="px-4 py-3">
        <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium', typeConf.color)}>
          {typeConf.label}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', statusConf.color)}>
          <StatusIcon className="h-3 w-3" />
          {statusConf.label}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground tabular-nums">
        {b.status === 'sent' ? `${b.sent_count ?? 0} / ${b.target_count ?? '?'}` : '—'}
      </td>
      <td className="px-4 py-3 text-[12px] text-muted-foreground whitespace-nowrap">
        {b.status === 'sent' ? formatDate(b.sent_at) : formatDate(b.created_at)}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button size="icon" variant="ghost" className="h-7 w-7" title={b.status === 'sent' || b.status === 'cancelled' ? 'Ver detalle' : 'Editar'} onClick={() => onEdit(b)}>
            {b.status === 'sent' || b.status === 'cancelled' ? <Eye className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" title="Duplicar como borrador" onClick={() => onDuplicate(b)}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
          {b.status === 'scheduled' && (
            <Button size="icon" variant="ghost" className="h-7 w-7 text-amber-600 hover:text-amber-700" title="Cancelar envío programado" onClick={() => onCancel(b.id)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
          {b.status === 'draft' && (
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive/70 hover:text-destructive" title="Eliminar borrador" onClick={() => onDelete(b.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
};

// ─── BroadcastsPage ───────────────────────────────────────────────────────────

const BroadcastsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isAdmin = isAdminRole(user?.role);

  const [broadcasts, setBroadcasts] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [activeTab, setActiveTab]   = useState('all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteId, setDeleteId]     = useState(null);
  const [cancelId, setCancelId]     = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!isAdmin) navigate('/communication', { replace: true });
  }, [isAdmin, navigate]);

  const loadBroadcasts = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('broadcasts').select('*').order('created_at', { ascending: false });
    if (data) setBroadcasts(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadBroadcasts(); }, [loadBroadcasts]);

  const filtered = activeTab === 'all' ? broadcasts : broadcasts.filter(b => b.status === activeTab);
  const counts = {
    all:       broadcasts.length,
    draft:     broadcasts.filter(b => b.status === 'draft').length,
    scheduled: broadcasts.filter(b => b.status === 'scheduled').length,
    sent:      broadcasts.filter(b => b.status === 'sent').length,
  };

  const openNew  = () => { setEditTarget(null); setEditorOpen(true); };
  const openEdit = (b) => { setEditTarget(b); setEditorOpen(true); };

  const handleDuplicate = async (b) => {
    const { error } = await supabase.from('broadcasts').insert({
      title: `${b.title} (copia)`, message: b.message, type: b.type, status: 'draft',
      filter_roles: b.filter_roles, filter_subscription_status: b.filter_subscription_status,
      filter_sex: b.filter_sex, filter_age_min: b.filter_age_min, filter_age_max: b.filter_age_max,
      filter_cities: b.filter_cities, filter_profile_type: b.filter_profile_type,
      filter_center_ids: b.filter_center_ids, filter_onboarding_done: b.filter_onboarding_done,
      filter_has_coach: b.filter_has_coach, filter_no_diet_plan: b.filter_no_diet_plan,
      filter_registered_after: b.filter_registered_after, filter_registered_before: b.filter_registered_before,
    });
    if (error) toast({ title: 'Error al duplicar', variant: 'destructive' });
    else { toast({ title: 'Borrador creado' }); loadBroadcasts(); }
  };

  const handleDelete = async () => {
    setActionLoading(true);
    const { error } = await supabase.from('broadcasts').delete().eq('id', deleteId);
    setActionLoading(false);
    setDeleteId(null);
    if (error) toast({ title: 'Error al eliminar', variant: 'destructive' });
    else { toast({ title: 'Borrador eliminado' }); loadBroadcasts(); }
  };

  const handleCancel = async () => {
    setActionLoading(true);
    const { error } = await supabase.rpc('admin_cancel_broadcast', { p_broadcast_id: cancelId });
    setActionLoading(false);
    setCancelId(null);
    if (error) toast({ title: 'Error al cancelar', variant: 'destructive' });
    else { toast({ title: 'Difusión cancelada' }); loadBroadcasts(); }
  };

  return (
    <>
      <Helmet><title>Difusiones - Bibofit</title></Helmet>
      <div className="flex flex-col h-full min-h-0">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-background shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8 mr-1" onClick={() => navigate('/communication')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-primary shrink-0" />
              <h1 className="font-semibold text-lg text-foreground">Difusiones</h1>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Mensajes enviados a segmentos de usuarios como notificaciones in-app
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={loadBroadcasts} title="Recargar">
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </Button>
            <Button size="sm" className="gap-2" onClick={openNew}>
              <Plus className="h-4 w-4" />
              Nueva difusión
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-6 py-2 border-b border-border bg-background shrink-0">
          {TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                activeTab === tab.value
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
              )}
            >
              {tab.label}
              {counts[tab.value] > 0 && (
                <span className={cn(
                  'inline-flex items-center justify-center rounded-full text-[10px] font-semibold px-1.5 min-w-[1.25rem] h-4',
                  activeTab === tab.value ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground',
                )}>
                  {counts[tab.value]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
              <Megaphone className="h-12 w-12 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                {activeTab === 'all' ? 'Aún no hay difusiones. Crea la primera.' : `No hay difusiones en este estado.`}
              </p>
              {activeTab === 'all' && (
                <Button size="sm" className="gap-2 mt-1" onClick={openNew}>
                  <Plus className="h-4 w-4" />Nueva difusión
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    {['Título / Filtros', 'Tipo', 'Estado', 'Enviados', 'Fecha', 'Acciones'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(b => (
                    <BroadcastRow key={b.id} broadcast={b} onEdit={openEdit} onDuplicate={handleDuplicate} onDelete={id => setDeleteId(id)} onCancel={id => setCancelId(id)} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Editor */}
      <Dialog open={editorOpen} onOpenChange={open => { if (!open) { setEditorOpen(false); setEditTarget(null); } }}>
        {editorOpen && (
          <BroadcastEditor
            broadcast={editTarget}
            onClose={() => { setEditorOpen(false); setEditTarget(null); }}
            onSaved={loadBroadcasts}
            onSent={loadBroadcasts}
          />
        )}
      </Dialog>

      {/* Confirm delete */}
      <AlertDialog open={!!deleteId} onOpenChange={open => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar borrador?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción es permanente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={actionLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm cancel scheduled */}
      <AlertDialog open={!!cancelId} onOpenChange={open => { if (!open) setCancelId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar difusión programada?</AlertDialogTitle>
            <AlertDialogDescription>No se enviará. Puedes duplicarla para reutilizarla.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Volver</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} disabled={actionLoading}>
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Cancelar difusión
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default BroadcastsPage;
