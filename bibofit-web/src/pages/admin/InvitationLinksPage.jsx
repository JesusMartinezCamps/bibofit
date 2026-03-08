import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import QRCode from 'qrcode';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Copy, Link2, Loader2, QrCode, RefreshCcw } from 'lucide-react';

const defaultRoles = [
  { id: 'free', role: 'free' },
  { id: 'client', role: 'client' },
  { id: 'coach', role: 'coach' },
];

const emptyForm = {
  destination: 'login',
  centerId: 'none',
  roleId: '',
  isUnlimitedUses: false,
  maxUses: '1',
  note: '',
  hasExpiration: false,
  expiresAt: '',
  generateQr: true,
};

const formatRoleLabel = (value = '') => {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const toDraftToken = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 24);
  }
  return `draft${Math.random().toString(36).slice(2, 16)}`;
};

const toQueryValue = (value) => {
  if (value === null || value === undefined) return '';
  return String(value);
};

const InvitationLinksPage = () => {
  const { toast } = useToast();

  const [loadingOptions, setLoadingOptions] = useState(true);
  const [roles, setRoles] = useState([]);
  const [centers, setCenters] = useState([]);

  const [form, setForm] = useState(emptyForm);

  const [generatedToken, setGeneratedToken] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [generatedAt, setGeneratedAt] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);

  const selectedRole = useMemo(
    () => roles.find((role) => toQueryValue(role.id) === form.roleId) || null,
    [roles, form.roleId]
  );

  const selectedCenter = useMemo(
    () => centers.find((center) => toQueryValue(center.id) === form.centerId) || null,
    [centers, form.centerId]
  );

  useEffect(() => {
    const fetchOptions = async () => {
      setLoadingOptions(true);
      try {
        const [rolesRes, centersRes] = await Promise.all([
          supabase.from('roles').select('id, role').order('id', { ascending: true }),
          supabase.from('centers').select('id, name').order('name', { ascending: true }),
        ]);

        if (rolesRes.error) throw rolesRes.error;
        if (centersRes.error) throw centersRes.error;

        const dbRoles = rolesRes.data || [];
        const normalizedRoles = dbRoles.length
          ? dbRoles.map((role) => ({ id: role.id, role: role.role }))
          : defaultRoles;

        setRoles(normalizedRoles);
        setCenters(centersRes.data || []);

        if (normalizedRoles.length > 0) {
          const clientRole = normalizedRoles.find((role) => role.role === 'client');
          const initialRole = clientRole || normalizedRoles[0];
          setForm((prev) => ({ ...prev, roleId: toQueryValue(initialRole.id) }));
        }
      } catch (error) {
        console.error('[InvitationLinksPage] Error loading options:', error);
        setRoles(defaultRoles);
        setForm((prev) => ({ ...prev, roleId: defaultRoles[1].id }));
        toast({
          title: 'Aviso',
          description: 'No se pudieron cargar roles/centros reales. Se usan opciones de ejemplo.',
          variant: 'warning',
        });
      } finally {
        setLoadingOptions(false);
      }
    };

    fetchOptions();
  }, [toast]);

  const buildInvitationUrl = (token, expiresAtIso) => {
    const params = new URLSearchParams();
    params.set('invite_token', token);
    params.set('target', 'login');
    params.set('draft', '1');

    if (selectedRole?.role) params.set('role', selectedRole.role);
    if (selectedCenter?.id) params.set('center_id', toQueryValue(selectedCenter.id));
    if (!form.isUnlimitedUses) params.set('max_uses', form.maxUses);
    if (form.hasExpiration && expiresAtIso) params.set('expires_at', expiresAtIso);

    const origin = window.location.origin;
    return `${origin}/login?${params.toString()}`;
  };

  const renderQr = async (url) => {
    setIsGeneratingQr(true);
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 360,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });
      setQrDataUrl(dataUrl);
    } catch (error) {
      console.error('[InvitationLinksPage] QR generation error:', error);
      setQrDataUrl('');
      toast({
        title: 'Error',
        description: 'No se pudo generar el QR.',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingQr(false);
    }
  };

  const handleGenerate = async () => {
    if (!form.roleId) {
      toast({
        title: 'Validación',
        description: 'Selecciona un rol.',
        variant: 'destructive',
      });
      return;
    }

    if (!form.isUnlimitedUses) {
      const parsedUses = Number(form.maxUses);
      if (!Number.isInteger(parsedUses) || parsedUses <= 0) {
        toast({
          title: 'Validación',
          description: 'El número de usos debe ser un entero mayor que 0.',
          variant: 'destructive',
        });
        return;
      }
    }

    let expiresAtIso = null;
    if (form.hasExpiration) {
      if (!form.expiresAt) {
        toast({
          title: 'Validación',
          description: 'Define una fecha/hora de expiración o desactiva la expiración.',
          variant: 'destructive',
        });
        return;
      }

      const parsedDate = new Date(form.expiresAt);
      if (Number.isNaN(parsedDate.getTime())) {
        toast({
          title: 'Validación',
          description: 'La fecha de expiración no es válida.',
          variant: 'destructive',
        });
        return;
      }

      expiresAtIso = parsedDate.toISOString();
    }

    const token = toDraftToken();
    const link = buildInvitationUrl(token, expiresAtIso);

    setGeneratedToken(token);
    setGeneratedLink(link);
    setGeneratedAt(new Date().toISOString());

    if (form.generateQr) {
      await renderQr(link);
    } else {
      setQrDataUrl('');
    }
  };

  const handleCopy = async () => {
    if (!generatedLink) return;
    try {
      await navigator.clipboard.writeText(generatedLink);
      toast({ title: 'Copiado', description: 'Link copiado al portapapeles.' });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo copiar el link.',
        variant: 'destructive',
      });
    }
  };

  const handleReset = () => {
    const fallbackRoleId = roles[0] ? toQueryValue(roles[0].id) : '';
    setForm({ ...emptyForm, roleId: fallbackRoleId });
    setGeneratedToken('');
    setGeneratedLink('');
    setGeneratedAt(null);
    setQrDataUrl('');
  };

  const generatedAtLabel = useMemo(() => {
    if (!generatedAt) return null;
    try {
      return format(parseISO(generatedAt), "dd MMM yyyy, HH:mm", { locale: es });
    } catch {
      return generatedAt;
    }
  }, [generatedAt]);

  return (
    <>
      <Helmet>
        <title>Generar Link de Invitación - Bibofit Admin</title>
        <meta
          name="description"
          content="Genera links de invitación con centro, rol, usos, nota, expiración y QR."
        />
      </Helmet>

      <div className="max-w-7xl mx-auto p-3 md:p-8 space-y-5 md:space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl md:text-4xl font-bold text-white">Generar Link de Invitación</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Primera fase visual. Este flujo crea links en modo borrador para validar campos y UX antes
            de implementar persistencia y seguridad en base de datos.
          </p>
        </div>

        <Card className="border-border/60 bg-card/85 backdrop-blur-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl text-white">Configuración del link</CardTitle>
            <CardDescription>
              Define destino, centro, rol, usos, nota y expiración.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="invite-destination">Destino</Label>
                <Select
                  value={form.destination}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, destination: value }))}
                  disabled
                >
                  <SelectTrigger id="invite-destination">
                    <SelectValue placeholder="Selecciona destino" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="login">Login</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="invite-center">Centro</Label>
                <Select
                  value={form.centerId}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, centerId: value }))}
                  disabled={loadingOptions}
                >
                  <SelectTrigger id="invite-center">
                    <SelectValue placeholder="Selecciona un centro" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin centro</SelectItem>
                    {centers.map((center) => (
                      <SelectItem key={center.id} value={toQueryValue(center.id)}>
                        {center.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="invite-role">Rol a asignar automáticamente</Label>
                <Select
                  value={form.roleId}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, roleId: value }))}
                  disabled={loadingOptions}
                >
                  <SelectTrigger id="invite-role">
                    <SelectValue placeholder="Selecciona un rol" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={toQueryValue(role.id)}>
                        {formatRoleLabel(role.role)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3 md:col-span-2 rounded-lg border border-input p-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Usos</p>
                  <p className="text-xs text-muted-foreground">
                    Configura si el link es ilimitado o con número máximo de usos.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-center justify-between rounded-lg border border-input px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">Usos ilimitados</p>
                      <p className="text-xs text-muted-foreground">
                        Si lo activas, el link no tendrá límite de usos.
                      </p>
                    </div>
                    <Switch
                      checked={form.isUnlimitedUses}
                      onCheckedChange={(checked) =>
                        setForm((prev) => ({ ...prev, isUnlimitedUses: checked }))
                      }
                    />
                  </div>
                  {!form.isUnlimitedUses && (
                    <div className="space-y-2">
                      <Label htmlFor="invite-max-uses">Número de usos</Label>
                      <Input
                        id="invite-max-uses"
                        type="number"
                        min={1}
                        step={1}
                        value={form.maxUses}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, maxUses: event.target.value }))
                        }
                        placeholder="1"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-lg border border-input px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">Fecha de expiración</p>
                    <p className="text-xs text-muted-foreground">
                      Activa para limitar validez por fecha/hora.
                    </p>
                  </div>
                  <Switch
                    checked={form.hasExpiration}
                    onCheckedChange={(checked) =>
                      setForm((prev) => ({ ...prev, hasExpiration: checked }))
                    }
                  />
                </div>

                {form.hasExpiration && (
                  <div className="space-y-2">
                    <Label htmlFor="invite-expiration">Expira el</Label>
                    <Input
                      id="invite-expiration"
                      type="datetime-local"
                      value={form.expiresAt}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, expiresAt: event.target.value }))
                      }
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-lg border border-input px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">Generar QR</p>
                    <p className="text-xs text-muted-foreground">
                      Crea un QR del enlace para compartir.
                    </p>
                  </div>
                  <Switch
                    checked={form.generateQr}
                    onCheckedChange={(checked) =>
                      setForm((prev) => ({ ...prev, generateQr: checked }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-note">Nota interna</Label>
              <Textarea
                id="invite-note"
                value={form.note}
                onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
                placeholder="Ejemplo: Invitación para nuevos clientes del Centro Norte."
                className="min-h-[110px]"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={handleGenerate}
                disabled={loadingOptions || isGeneratingQr}
                className="sm:w-auto w-full"
              >
                {isGeneratingQr ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Link2 className="w-4 h-4 mr-2" />
                )}
                Generar Link de Invitación
              </Button>
              <Button
                variant="outline"
                onClick={handleReset}
                className="sm:w-auto w-full"
              >
                <RefreshCcw className="w-4 h-4 mr-2" />
                Limpiar formulario
              </Button>
            </div>
          </CardContent>
        </Card>

        {generatedLink && (
          <Card className="border-cyan-500/30 bg-card/90">
            <CardHeader className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-lg text-white">Link generado (borrador)</CardTitle>
                {generatedAtLabel && (
                  <Badge variant="secondary" className="bg-muted text-muted-foreground">
                    {generatedAtLabel}
                  </Badge>
                )}
              </div>
              <CardDescription>
                Este resultado es visual para validar frontend. La persistencia y validación segura se
                implementarán en la siguiente fase.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-cyan-600/90 text-white border-none">
                  Destino: Login
                </Badge>
                <Badge variant="outline">
                  Rol: {formatRoleLabel(selectedRole?.role || form.roleId || 'N/A')}
                </Badge>
                <Badge variant="outline">
                  Centro: {selectedCenter?.name || 'Sin centro'}
                </Badge>
                <Badge variant="outline">
                  Usos: {form.isUnlimitedUses ? 'Ilimitado' : form.maxUses}
                </Badge>
                <Badge variant="outline">
                  Expiración:{' '}
                  {form.hasExpiration
                    ? form.expiresAt || 'Pendiente de definir'
                    : 'Sin expiración'}
                </Badge>
              </div>

              {generatedToken && (
                <div className="rounded-lg border border-input px-3 py-2">
                  <p className="text-xs text-muted-foreground mb-1">Token borrador</p>
                  <p className="font-mono text-sm break-all">{generatedToken}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="generated-invitation-link">URL generada</Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    id="generated-invitation-link"
                    value={generatedLink}
                    readOnly
                    className="font-mono text-xs md:text-sm"
                  />
                  <Button variant="outline" onClick={handleCopy}>
                    <Copy className="w-4 h-4 mr-2" />
                    Copiar
                  </Button>
                </div>
              </div>

              {form.note?.trim() && (
                <div className="rounded-lg border border-input p-3">
                  <p className="text-xs text-muted-foreground mb-1">Nota interna</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{form.note.trim()}</p>
                </div>
              )}

              {form.generateQr && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-sm font-semibold text-foreground">QR del enlace</h3>
                  </div>
                  <div className="rounded-xl border border-input p-4 w-full md:w-fit bg-white">
                    {isGeneratingQr ? (
                      <div className="flex items-center justify-center w-[240px] h-[240px]">
                        <Loader2 className="w-6 h-6 animate-spin text-slate-700" />
                      </div>
                    ) : qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt="QR del link de invitación"
                        className="w-[240px] h-[240px]"
                      />
                    ) : (
                      <div className="flex items-center justify-center w-[240px] h-[240px] text-slate-600 text-sm">
                        QR no disponible
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
};

export default InvitationLinksPage;
