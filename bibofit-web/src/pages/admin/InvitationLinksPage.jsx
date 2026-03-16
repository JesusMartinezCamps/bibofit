import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Ban, Copy, Link2, Loader2, Minus, Plus, QrCode, RefreshCcw } from 'lucide-react';
import { ROLE } from '@/lib/roles';

const defaultRoles = [
  { id: ROLE.FREE, role: ROLE.FREE },
  { id: ROLE.PRO_NUTRITION, role: ROLE.PRO_NUTRITION },
  { id: ROLE.PRO_WORKOUT, role: ROLE.PRO_WORKOUT },
  { id: ROLE.COACH_NUTRITION, role: ROLE.COACH_NUTRITION },
  { id: ROLE.COACH_WORKOUT, role: ROLE.COACH_WORKOUT },
];
const invitationAssignableRoles = new Set(defaultRoles.map((role) => role.role));

const emptyForm = {
  destination: 'signup',
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

const toQueryValue = (value) => {
  if (value === null || value === undefined) return '';
  return String(value);
};

const loadImageFromSrc = (src) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });

const loadImage = async (src) => {
  try {
    return await loadImageFromSrc(src);
  } catch (error) {
    // Algunos assets .png del proyecto están guardados como texto base64.
    if (!src.endsWith('.png')) throw error;

    const response = await fetch(src);
    if (!response.ok) throw error;

    const base64Text = (await response.text()).trim();
    const isBase64 = /^[A-Za-z0-9+/=\s]+$/.test(base64Text);
    if (!isBase64) throw error;

    return loadImageFromSrc(`data:image/png;base64,${base64Text.replace(/\s+/g, '')}`);
  }
};

const formatDateLabel = (value) => {
  if (!value) return 'Sin fecha';
  try {
    return format(parseISO(value), "dd MMM yyyy, HH:mm", { locale: es });
  } catch {
    return value;
  }
};

const isInvitationExpired = (invitation) => {
  if (!invitation?.expires_at) return false;
  const expiresAt = new Date(invitation.expires_at);
  if (Number.isNaN(expiresAt.getTime())) return false;
  return expiresAt.getTime() <= Date.now();
};

const isInvitationExhausted = (invitation) => {
  if (invitation?.max_uses === null || invitation?.max_uses === undefined) return false;
  return Number(invitation.used_uses || 0) >= Number(invitation.max_uses || 0);
};

const isInvitationActive = (invitation) => {
  if (!invitation) return false;
  if (invitation.is_revoked) return false;
  if (isInvitationExpired(invitation)) return false;
  if (isInvitationExhausted(invitation)) return false;
  return true;
};

const getInvitationStatus = (invitation) => {
  if (!invitation) {
    return { label: 'Desconocido', variant: 'secondary', kind: 'unknown' };
  }
  if (invitation.is_revoked) {
    return { label: 'Revocada', variant: 'destructive', kind: 'revoked' };
  }
  if (isInvitationExpired(invitation)) {
    return { label: 'Expirada', variant: 'warning', kind: 'expired' };
  }
  if (isInvitationExhausted(invitation)) {
    return { label: 'Sin usos', variant: 'warning', kind: 'exhausted' };
  }
  return { label: 'Activa', variant: 'default', kind: 'active' };
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
  const [isSavingLink, setIsSavingLink] = useState(false);

  const [invitationLinks, setInvitationLinks] = useState([]);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [revokingLinkId, setRevokingLinkId] = useState(null);

  const [isQrViewerOpen, setIsQrViewerOpen] = useState(false);
  const [qrViewerDataUrl, setQrViewerDataUrl] = useState('');
  const [qrViewerTitle, setQrViewerTitle] = useState('QR de invitación');
  const [qrViewerZoom, setQrViewerZoom] = useState(1);
  const [isLoadingViewerQr, setIsLoadingViewerQr] = useState(false);

  const selectedRole = useMemo(
    () => roles.find((role) => toQueryValue(role.id) === form.roleId) || null,
    [roles, form.roleId]
  );

  const selectedCenter = useMemo(
    () => centers.find((center) => toQueryValue(center.id) === form.centerId) || null,
    [centers, form.centerId]
  );

  const roleNameById = useMemo(() => {
    const map = new Map();
    roles.forEach((role) => {
      map.set(toQueryValue(role.id), role.role);
    });
    return map;
  }, [roles]);

  const centerNameById = useMemo(() => {
    const map = new Map();
    centers.forEach((center) => {
      map.set(toQueryValue(center.id), center.name);
    });
    return map;
  }, [centers]);

  const activeInvitationLinks = useMemo(
    () => invitationLinks.filter((invitation) => isInvitationActive(invitation)),
    [invitationLinks]
  );

  const buildInvitationUrl = useCallback(
    ({ token, destination = 'signup' }) => {
      const params = new URLSearchParams();
      params.set('invite_token', token);

      const origin = window.location.origin;
      const path = destination === 'login' ? '/login' : '/signup';
      return `${origin}${path}?${params.toString()}`;
    },
    []
  );

  const fetchInvitationLinks = useCallback(async () => {
    setLoadingLinks(true);
    try {
      const { data, error } = await supabase
        .from('invitation_links')
        .select(
          'id, token_preview, destination, role_id, center_id, max_uses, used_uses, note, expires_at, is_revoked, revoked_at, revoked_by, created_by, created_at, updated_at'
        )
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      setInvitationLinks(data || []);
    } catch (error) {
      console.error('[InvitationLinksPage] Error loading invitation links:', error);
      setInvitationLinks([]);

      if (error?.code === '42P01' || error?.code === '42883' || error?.code === '42703') {
        toast({
          title: 'Persistencia pendiente',
          description:
            'Falta aplicar la migración de invitaciones en Supabase. Ejecuta las migraciones para habilitar listado/revocación.',
          variant: 'warning',
        });
      } else {
        toast({
          title: 'Error',
          description: 'No se pudieron cargar los links persistidos.',
          variant: 'destructive',
        });
      }
    } finally {
      setLoadingLinks(false);
    }
  }, [toast]);

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
        const safeRoles = dbRoles.filter((role) =>
          invitationAssignableRoles.has(String(role?.role || '').toLowerCase())
        );
        const normalizedRoles = safeRoles.length
          ? safeRoles.map((role) => ({ id: role.id, role: role.role }))
          : defaultRoles;

        setRoles(normalizedRoles);
        setCenters(centersRes.data || []);

        if (normalizedRoles.length > 0) {
          const preferredNutritionRole = normalizedRoles.find((role) => role.role === ROLE.PRO_NUTRITION);
          const initialRole = preferredNutritionRole || normalizedRoles[0];
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

  useEffect(() => {
    fetchInvitationLinks();
  }, [fetchInvitationLinks]);

  const generateQrDataUrl = useCallback(async (url) => {
    const qrSize = 360;
    const qrData = await QRCode.toDataURL(url, {
      width: qrSize,
      margin: 1,
      errorCorrectionLevel: 'H',
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });

    const qrImage = await loadImage(qrData);

    const canvas = document.createElement('canvas');
    canvas.width = qrSize;
    canvas.height = qrSize;

    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas context unavailable');

    context.drawImage(qrImage, 0, 0, qrSize, qrSize);

    const logoSources = [
      '/icon-192x192.svg',
      '/favicon.svg',
      '/icons/bibofit-192x192.png',
      '/icons/bibofit-512x512.png',
    ];

    let logoImage = null;
    for (const source of logoSources) {
      try {
        logoImage = await loadImage(source);
        break;
      } catch {
        // Intentar siguiente formato/ruta.
      }
    }

    if (logoImage) {
      const logoSize = Math.round(qrSize * 0.2);
      const padding = Math.round(logoSize * 0.2);
      const boxSize = logoSize + padding * 2;
      const boxX = Math.round((qrSize - boxSize) / 2);
      const boxY = Math.round((qrSize - boxSize) / 2);
      const logoX = boxX + padding;
      const logoY = boxY + padding;

      context.fillStyle = '#ffffff';
      context.fillRect(boxX, boxY, boxSize, boxSize);
      context.strokeStyle = '#000000';
      context.lineWidth = Math.max(2, Math.round(boxSize * 0.06));
      context.strokeRect(boxX, boxY, boxSize, boxSize);
      context.drawImage(logoImage, logoX, logoY, logoSize, logoSize);
    }

    return canvas.toDataURL('image/png');
  }, []);

  const renderQr = useCallback(
    async (url) => {
      setIsGeneratingQr(true);
      try {
        const dataUrl = await generateQrDataUrl(url);
        setQrDataUrl(dataUrl);
        return dataUrl;
      } catch (error) {
        console.error('[InvitationLinksPage] QR generation error:', error);
        setQrDataUrl('');
        toast({
          title: 'Error',
          description: 'No se pudo generar el QR.',
          variant: 'destructive',
        });
        return null;
      } finally {
        setIsGeneratingQr(false);
      }
    },
    [generateQrDataUrl, toast]
  );

  const openQrViewer = useCallback(
    async ({ title, dataUrl = '' }) => {
      setQrViewerTitle(title || 'QR de invitación');
      setQrViewerZoom(1);
      setIsQrViewerOpen(true);

      if (dataUrl) {
        setQrViewerDataUrl(dataUrl);
        setIsLoadingViewerQr(false);
        return;
      }
      setQrViewerDataUrl('');
      setIsLoadingViewerQr(false);
    },
    []
  );

  const handleGenerate = async () => {
    if (!form.roleId) {
      toast({
        title: 'Validación',
        description: 'Selecciona un rol.',
        variant: 'destructive',
      });
      return;
    }

    const parsedRoleId = Number(form.roleId);
    if (!Number.isInteger(parsedRoleId)) {
      toast({
        title: 'Validación',
        description: 'El rol seleccionado no es válido para persistencia.',
        variant: 'destructive',
      });
      return;
    }

    let parsedUses = null;
    if (!form.isUnlimitedUses) {
      parsedUses = Number(form.maxUses);
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

      if (parsedDate.getTime() <= Date.now()) {
        toast({
          title: 'Validación',
          description: 'La expiración debe ser en el futuro.',
          variant: 'destructive',
        });
        return;
      }

      expiresAtIso = parsedDate.toISOString();
    }

    const centerIdForInsert = form.centerId === 'none' ? null : Number(form.centerId);
    if (centerIdForInsert !== null && !Number.isInteger(centerIdForInsert)) {
      toast({
        title: 'Validación',
        description: 'El centro seleccionado no es válido.',
        variant: 'destructive',
      });
      return;
    }

    setIsSavingLink(true);
    try {
      const { data, error } = await supabase.rpc('admin_issue_invitation_link', {
        p_destination: form.destination,
        p_role_id: parsedRoleId,
        p_center_id: centerIdForInsert,
        p_max_uses: form.isUnlimitedUses ? null : parsedUses,
        p_note: form.note.trim() || null,
        p_expires_at: expiresAtIso,
      });

      if (error) throw error;

      const createdInvitation = Array.isArray(data) ? data[0] : data;
      if (!createdInvitation?.issued_token) {
        throw new Error('No se recibió el token emitido de invitación.');
      }

      const link = buildInvitationUrl({
        token: createdInvitation.issued_token,
        destination: createdInvitation.destination || form.destination || 'signup',
      });

      setGeneratedToken(createdInvitation.issued_token);
      setGeneratedLink(link);
      setGeneratedAt(createdInvitation.created_at || new Date().toISOString());

      if (form.generateQr) {
        await renderQr(link);
      } else {
        setQrDataUrl('');
      }

      toast({
        title: 'Invitación creada',
        description: 'El link se guardó en base de datos y ya está disponible para revocación.',
        variant: 'success',
      });

      await fetchInvitationLinks();
    } catch (error) {
      console.error('[InvitationLinksPage] Error creating invitation link:', error);

      const dbNotReady = error?.code === '42P01' || error?.code === '42883' || error?.code === '42703';
      toast({
        title: 'Error',
        description: dbNotReady
          ? 'Falta aplicar la migración de invitaciones en Supabase (tabla o RPC no disponible).'
          : error?.message || 'No se pudo generar y persistir el link de invitación.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingLink(false);
    }
  };

  const handleCopy = async (value = generatedLink) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: 'Copiado', description: 'Link copiado al portapapeles.', variant: 'success' });
    } catch {
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

  const handleRevokeInvitation = async (invitation) => {
    if (!invitation?.id || invitation.is_revoked) return;

    const confirmed = window.confirm(
      '¿Revocar este QR de invitación? Esta acción bloquea su uso inmediatamente.'
    );
    if (!confirmed) return;

    setRevokingLinkId(invitation.id);
    try {
      const { error } = await supabase.rpc('admin_revoke_invitation_link', {
        p_invitation_link_id: invitation.id,
      });

      if (error) throw error;

      toast({
        title: 'Revocado',
        description: 'El QR/link quedó revocado de forma inmediata.',
        variant: 'success',
      });

      await fetchInvitationLinks();
    } catch (error) {
      console.error('[InvitationLinksPage] Error revoking invitation:', error);
      toast({
        title: 'Error',
        description: error?.message || 'No se pudo revocar el QR/link.',
        variant: 'destructive',
      });
    } finally {
      setRevokingLinkId(null);
    }
  };

  const generatedAtLabel = useMemo(() => {
    if (!generatedAt) return null;
    return formatDateLabel(generatedAt);
  }, [generatedAt]);

  return (
    <>
      <Helmet>
        <title>Generar Link de Invitación - Bibofit Admin</title>
        <meta
          name="description"
          content="Genera links de invitación con centro, rol, usos, nota, expiración, persistencia y QR revocable."
        />
      </Helmet>

      <div className="max-w-7xl mx-auto p-3 md:p-8 space-y-5 md:space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl md:text-4xl font-bold text-white">Generar Link de Invitación</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Flujo persistido en base de datos: cada QR generado queda registrado, listado y revocable.
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
                  disabled={loadingOptions || isSavingLink}
                >
                  <SelectTrigger id="invite-destination">
                    <SelectValue placeholder="Selecciona destino" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="signup">Registro (/signup)</SelectItem>
                    <SelectItem value="login">Login (/login)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="invite-center">Centro</Label>
                <Select
                  value={form.centerId}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, centerId: value }))}
                  disabled={loadingOptions || isSavingLink}
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
                  disabled={loadingOptions || isSavingLink}
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
                      disabled={isSavingLink}
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
                        disabled={isSavingLink}
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
                    disabled={isSavingLink}
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
                      disabled={isSavingLink}
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
                    disabled={isSavingLink}
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
                disabled={isSavingLink}
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={handleGenerate}
                disabled={loadingOptions || isGeneratingQr || isSavingLink}
                className="sm:w-auto w-full"
              >
                {isGeneratingQr || isSavingLink ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Link2 className="w-4 h-4 mr-2" />
                )}
                {isSavingLink ? 'Guardando enlace...' : isGeneratingQr ? 'Generando QR...' : 'Generar Link de Invitación'}
              </Button>
              <Button
                variant="outline"
                onClick={handleReset}
                className="sm:w-auto w-full"
                disabled={isSavingLink || isGeneratingQr}
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
                <CardTitle className="text-lg text-white">Link generado y persistido</CardTitle>
                {generatedAtLabel && (
                  <Badge variant="secondary" className="bg-muted text-muted-foreground">
                    {generatedAtLabel}
                  </Badge>
                )}
              </div>
              <CardDescription>
                Este token solo se muestra una vez por seguridad. Guarda o comparte la URL ahora.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-cyan-600/90 text-white border-none">
                  Destino: {form.destination === 'signup' ? 'Registro' : 'Login'}
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
                  <p className="text-xs text-muted-foreground mb-1">Token emitido (visible una vez)</p>
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
                  <Button variant="outline" onClick={() => handleCopy(generatedLink)}>
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
                  <div className="rounded-xl border border-input p-4 w-fit mx-auto bg-white space-y-2">
                    {isGeneratingQr ? (
                      <div className="flex items-center justify-center w-[240px] h-[240px]">
                        <Loader2 className="w-6 h-6 animate-spin text-slate-700" />
                      </div>
                    ) : qrDataUrl ? (
                      <button
                        type="button"
                        onClick={() =>
                          openQrViewer({
                            title: 'QR recién generado',
                            dataUrl: qrDataUrl,
                          })
                        }
                        className="block cursor-zoom-in"
                        title="Haz clic para pantalla completa"
                      >
                        <img
                          src={qrDataUrl}
                          alt="QR del link de invitación"
                          className="w-[240px] h-[240px]"
                        />
                      </button>
                    ) : (
                      <div className="flex items-center justify-center w-[240px] h-[240px] text-slate-600 text-sm">
                        QR no disponible
                      </div>
                    )}
                    {qrDataUrl && (
                      <p className="text-[11px] text-slate-700 text-center">
                        Haz click en el QR para abrirlo.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="border-border/60 bg-card/90">
          <CardHeader className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-lg text-white">QRs activos</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchInvitationLinks}
                disabled={loadingLinks}
              >
                {loadingLinks ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCcw className="w-4 h-4 mr-2" />
                )}
                Actualizar
              </Button>
            </div>
            <CardDescription>
              Lista de invitaciones activas persistidas. El token completo no se almacena en claro.
            </CardDescription>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-emerald-600/90 text-white border-none">
                Activas: {activeInvitationLinks.length}
              </Badge>
              <Badge variant="outline">
                Total registradas: {invitationLinks.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {loadingLinks ? (
              <div className="h-32 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
              </div>
            ) : activeInvitationLinks.length === 0 ? (
              <div className="rounded-lg border border-dashed border-input p-6 text-center text-muted-foreground text-sm">
                No hay QRs activos por ahora.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Estado</TableHead>
                    <TableHead>Token</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Centro</TableHead>
                    <TableHead>Usos</TableHead>
                    <TableHead>Expira</TableHead>
                    <TableHead>Creado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeInvitationLinks.map((invitation) => {
                    const status = getInvitationStatus(invitation);
                    const roleName = roleNameById.get(toQueryValue(invitation.role_id)) || 'N/A';
                    const centerName = invitation.center_id
                      ? centerNameById.get(toQueryValue(invitation.center_id)) || `Centro ${invitation.center_id}`
                      : 'Sin centro';

                    return (
                      <TableRow key={invitation.id}>
                        <TableCell>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {invitation.token_preview || 'N/A'}
                        </TableCell>
                        <TableCell>{formatRoleLabel(roleName)}</TableCell>
                        <TableCell>{centerName}</TableCell>
                        <TableCell>
                          {invitation.max_uses === null
                            ? 'Ilimitado'
                            : `${invitation.used_uses || 0}/${invitation.max_uses}`}
                        </TableCell>
                        <TableCell>
                          {invitation.expires_at ? formatDateLabel(invitation.expires_at) : 'Sin expiración'}
                        </TableCell>
                        <TableCell>{formatDateLabel(invitation.created_at)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end flex-wrap gap-2">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleRevokeInvitation(invitation)}
                              disabled={revokingLinkId === invitation.id}
                              title="Revocar QR"
                            >
                              {revokingLinkId === invitation.id ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <Ban className="w-4 h-4 mr-2" />
                              )}
                              Revocar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={isQrViewerOpen}
        onOpenChange={(open) => {
          setIsQrViewerOpen(open);
          if (!open) {
            setQrViewerZoom(1);
            setIsLoadingViewerQr(false);
          }
        }}
      >
        <DialogContent className="w-[96vw] max-w-[96vw] h-[96vh] bg-black/95 border-neutral-800 text-white p-0 overflow-hidden">
          <DialogHeader className="px-5 py-4 border-b border-white/10 text-left">
            <DialogTitle className="text-white">{qrViewerTitle}</DialogTitle>
            <DialogDescription className="text-white/70">
              Vista completa para compartir. Usa los controles para agrandar el QR rápidamente.
            </DialogDescription>
            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQrViewerZoom((prev) => Math.max(1, prev - 0.25))}
                disabled={isLoadingViewerQr || !qrViewerDataUrl}
                className="border-white/30 bg-transparent text-white hover:bg-white/10"
              >
                <Minus className="w-4 h-4 mr-2" />
                Zoom -
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQrViewerZoom((prev) => Math.min(3.5, prev + 0.25))}
                disabled={isLoadingViewerQr || !qrViewerDataUrl}
                className="border-white/30 bg-transparent text-white hover:bg-white/10"
              >
                <Plus className="w-4 h-4 mr-2" />
                Zoom +
              </Button>
              <Badge variant="secondary" className="bg-white/10 text-white border-transparent">
                {Math.round(qrViewerZoom * 100)}%
              </Badge>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-auto flex items-center justify-center p-6">
            {isLoadingViewerQr ? (
              <Loader2 className="w-8 h-8 animate-spin text-cyan-300" />
            ) : qrViewerDataUrl ? (
              <img
                src={qrViewerDataUrl}
                alt="QR de invitación en pantalla completa"
                className="bg-white rounded-sm transition-transform duration-150"
                style={{ transform: `scale(${qrViewerZoom})`, transformOrigin: 'center center' }}
              />
            ) : (
              <p className="text-sm text-white/70">QR no disponible.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default InvitationLinksPage;
