import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useLocation, useNavigate } from 'react-router-dom';
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
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  Ban,
  Copy,
  Link2,
  Loader2,
  Minus,
  Plus,
  QrCode,
  RefreshCcw,
} from 'lucide-react';
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

const normalizeText = (value = '') =>
  String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const statusRankByKind = {
  active: 0,
  exhausted: 1,
  expired: 2,
  revoked: 3,
  unknown: 4,
};
const invitationAssetStoragePrefix = 'bibofit_inv_';

const InvitationLinksPage = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

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
  const [listingScope, setListingScope] = useState('active');
  const [searchText, setSearchText] = useState('');
  const [sortKey, setSortKey] = useState('created_at');
  const [sortDirection, setSortDirection] = useState('desc');

  const [isQrViewerOpen, setIsQrViewerOpen] = useState(false);
  const [qrViewerDataUrl, setQrViewerDataUrl] = useState('');
  const [qrViewerTitle, setQrViewerTitle] = useState('QR de invitación');
  const [qrViewerNote, setQrViewerNote] = useState('');
  const [qrViewerLink, setQrViewerLink] = useState('');
  const [qrViewerZoom, setQrViewerZoom] = useState(1);
  const [isLoadingViewerQr, setIsLoadingViewerQr] = useState(false);

  const [selectedInvitation, setSelectedInvitation] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailQrDataUrl, setDetailQrDataUrl] = useState('');
  const [isLoadingDetailQr, setIsLoadingDetailQr] = useState(false);

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

  const displayedInvitationLinks = useMemo(() => {
    const normalizedQuery = normalizeText(searchText.trim());

    let searchScopeOverride = null;
    if (
      normalizedQuery.includes('inactivo') ||
      normalizedQuery.includes('inactiva') ||
      normalizedQuery.includes('no activo') ||
      normalizedQuery.includes('no activa')
    ) {
      searchScopeOverride = 'inactive';
    } else if (
      normalizedQuery.includes('activo') ||
      normalizedQuery.includes('activa') ||
      normalizedQuery.includes('activos') ||
      normalizedQuery.includes('activas')
    ) {
      searchScopeOverride = 'active';
    }

    const scopeToApply = searchScopeOverride || listingScope;

    const filtered = invitationLinks.filter((invitation) => {
      const isActive = isInvitationActive(invitation);

      if (scopeToApply === 'active' && !isActive) return false;
      if (scopeToApply === 'inactive' && isActive) return false;

      if (!normalizedQuery) return true;

      const status = getInvitationStatus(invitation);
      const roleName = roleNameById.get(toQueryValue(invitation.role_id)) || 'N/A';
      const centerName = invitation.center_id
        ? centerNameById.get(toQueryValue(invitation.center_id)) || `Centro ${invitation.center_id}`
        : 'Sin centro';

      const searchable = normalizeText(
        [
          invitation.token_preview,
          roleName,
          centerName,
          invitation.destination === 'login' ? 'login' : 'registro signup',
          invitation.note,
          status.label,
          formatDateLabel(invitation.expires_at),
          formatDateLabel(invitation.created_at),
          invitation.max_uses === null ? 'ilimitado' : `${invitation.used_uses || 0}/${invitation.max_uses}`,
        ]
          .filter(Boolean)
          .join(' ')
      );

      return searchable.includes(normalizedQuery);
    });

    const toTimestamp = (value, fallback) => {
      if (!value) return fallback;
      const parsed = new Date(value).getTime();
      return Number.isNaN(parsed) ? fallback : parsed;
    };

    return [...filtered].sort((a, b) => {
      const direction = sortDirection === 'asc' ? 1 : -1;
      const statusA = getInvitationStatus(a);
      const statusB = getInvitationStatus(b);
      const roleA = roleNameById.get(toQueryValue(a.role_id)) || 'N/A';
      const roleB = roleNameById.get(toQueryValue(b.role_id)) || 'N/A';
      const centerA = a.center_id
        ? centerNameById.get(toQueryValue(a.center_id)) || `Centro ${a.center_id}`
        : 'Sin centro';
      const centerB = b.center_id
        ? centerNameById.get(toQueryValue(b.center_id)) || `Centro ${b.center_id}`
        : 'Sin centro';

      let result = 0;
      switch (sortKey) {
        case 'status':
          result = (statusRankByKind[statusA.kind] ?? 9) - (statusRankByKind[statusB.kind] ?? 9);
          break;
        case 'token':
          result = String(a.token_preview || '').localeCompare(String(b.token_preview || ''), 'es');
          break;
        case 'role':
          result = roleA.localeCompare(roleB, 'es');
          break;
        case 'center':
          result = centerA.localeCompare(centerB, 'es');
          break;
        case 'uses': {
          const usedA = Number(a.used_uses || 0);
          const usedB = Number(b.used_uses || 0);
          result = usedA - usedB;
          break;
        }
        case 'expires_at':
          result = toTimestamp(a.expires_at, Number.MAX_SAFE_INTEGER) - toTimestamp(b.expires_at, Number.MAX_SAFE_INTEGER);
          break;
        case 'created_at':
        default:
          result = toTimestamp(a.created_at, 0) - toTimestamp(b.created_at, 0);
          break;
      }

      if (result === 0) {
        result = toTimestamp(a.created_at, 0) - toTimestamp(b.created_at, 0);
      }

      return result * direction;
    });
  }, [
    invitationLinks,
    listingScope,
    searchText,
    sortKey,
    sortDirection,
    roleNameById,
    centerNameById,
  ]);

  const getInvitationAssetStorageKey = useCallback(
    (id) => `${invitationAssetStoragePrefix}${id}`,
    []
  );

  const readInvitationAsset = useCallback(
    (id) => {
      if (!id) return null;
      try {
        const raw = localStorage.getItem(getInvitationAssetStorageKey(id));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'string') return { link: parsed };
        if (!parsed || typeof parsed !== 'object') return null;
        return {
          link: parsed.link || null,
          qrDataUrl: parsed.qrDataUrl || '',
          note: parsed.note || '',
        };
      } catch {
        return null;
      }
    },
    [getInvitationAssetStorageKey]
  );

  const upsertInvitationAsset = useCallback(
    (id, payload) => {
      if (!id) return;
      try {
        const current = readInvitationAsset(id) || {};
        const next = { ...current, ...payload };
        localStorage.setItem(getInvitationAssetStorageKey(id), JSON.stringify(next));
      } catch {
        // localStorage unavailable
      }
    },
    [getInvitationAssetStorageKey, readInvitationAsset]
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

  useEffect(() => {
    const channel = supabase
      .channel('admin-invitation-links-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'invitation_links' },
        () => {
          void fetchInvitationLinks();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchInvitationLinks]);

  useEffect(() => {
    try {
      const activeIds = new Set(
        invitationLinks.filter((invitation) => isInvitationActive(invitation)).map((invitation) => invitation.id)
      );
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(invitationAssetStoragePrefix)) continue;
        const invitationId = key.slice(invitationAssetStoragePrefix.length);
        if (!activeIds.has(invitationId)) keysToRemove.push(key);
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    } catch {
      // localStorage unavailable
    }
  }, [invitationLinks]);

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
    ({ title, dataUrl = '', note = '', link = '' }) => {
      setQrViewerTitle(title || 'QR de invitación');
      setQrViewerNote(note || '');
      setQrViewerLink(link || '');
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

      let generatedQrDataUrl = '';
      if (form.generateQr) {
        generatedQrDataUrl = (await renderQr(link)) || '';
      } else {
        setQrDataUrl('');
      }

      if (createdInvitation.id) {
        upsertInvitationAsset(createdInvitation.id, {
          link,
          qrDataUrl: generatedQrDataUrl,
          note: createdInvitation.note || form.note.trim() || '',
        });
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

  const getStoredInvitationLink = (id) => readInvitationAsset(id)?.link || null;

  const handleOpenDetail = useCallback(
    async (invitation) => {
      setSelectedInvitation(invitation);
      setDetailQrDataUrl('');
      setIsDetailOpen(true);

      const storedAsset = readInvitationAsset(invitation.id);
      const storedLink = storedAsset?.link || null;
      if (storedLink) {
        if (storedAsset?.qrDataUrl) {
          setDetailQrDataUrl(storedAsset.qrDataUrl);
          return;
        }
        setIsLoadingDetailQr(true);
        try {
          const dataUrl = await generateQrDataUrl(storedLink);
          setDetailQrDataUrl(dataUrl);
          upsertInvitationAsset(invitation.id, {
            qrDataUrl: dataUrl,
            note: invitation.note || storedAsset?.note || '',
          });
        } catch {
          setDetailQrDataUrl('');
        } finally {
          setIsLoadingDetailQr(false);
        }
      }
    },
    [generateQrDataUrl, readInvitationAsset, upsertInvitationAsset]
  );

  const generatedAtLabel = useMemo(() => {
    if (!generatedAt) return null;
    return formatDateLabel(generatedAt);
  }, [generatedAt]);

  const isCreateView = location.pathname.includes('/admin-panel/content/invitation-links/new');

  const handleSortByColumn = (key) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection(key === 'created_at' ? 'desc' : 'asc');
  };

  const SortIndicator = ({ columnKey }) => {
    if (sortKey !== columnKey) return <ArrowUpDown className="w-3.5 h-3.5 opacity-60" />;
    return sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />;
  };

  return (
    <>
      <Helmet>
        <title>
          {isCreateView ? 'Crear Link de Invitación - Bibofit Admin' : 'Links de Invitación - Bibofit Admin'}
        </title>
        <meta
          name="description"
          content={
            isCreateView
              ? 'Configura y genera nuevos links de invitación con QR revocable.'
              : 'Consulta y gestiona los QRs activos de invitación.'
          }
        />
      </Helmet>

      <div className="max-w-7xl mx-auto p-3 md:p-8 space-y-5 md:space-y-8">
        <div className="space-y-2">
          {isCreateView ? (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/admin-panel/content/invitation-links')}
                aria-label="Volver a QRs activos"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-2xl md:text-4xl font-bold text-white">Configuración del link</h1>
            </div>
          ) : (
            <h1 className="text-2xl md:text-4xl font-bold text-white">Links de Invitación</h1>
          )}
          <p className="text-sm md:text-base text-muted-foreground">
            {isCreateView
              ? 'Define la configuración para generar una nueva invitación.'
              : 'Listado de QRs activos persistidos. Puedes crear nuevas invitaciones desde aquí.'}
          </p>
        </div>

        {!isCreateView && (
          <Card className="border-border/60 bg-card/90">
            <CardHeader className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-lg text-white">QRs activos</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => navigate('/admin-panel/content/invitation-links/new')}
                  >
                    Crear nueva invitación
                  </Button>
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
              </div>
              <CardDescription>
                Lista de invitaciones activas persistidas. El token completo no se almacena en claro.
              </CardDescription>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  className={`cursor-pointer border-none ${
                    listingScope === 'active' ? 'bg-emerald-600/90 text-white' : 'bg-muted text-muted-foreground'
                  }`}
                  onClick={() => setListingScope('active')}
                >
                  Activas: {activeInvitationLinks.length}
                </Badge>
                <Badge
                  variant={listingScope === 'all' ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setListingScope('all')}
                >
                  Total registradas: {invitationLinks.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Input
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Buscar por centro, rol, estado, token, nota... (ej: centro norte, pro_nutrition, activo)"
                />
              </div>
              {loadingLinks ? (
                <div className="h-32 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                </div>
              ) : displayedInvitationLinks.length === 0 ? (
                <div className="rounded-lg border border-dashed border-input p-6 text-center text-muted-foreground text-sm">
                  No hay resultados con los filtros actuales.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 hover:text-white"
                          onClick={() => handleSortByColumn('status')}
                        >
                          Estado
                          <SortIndicator columnKey="status" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 hover:text-white"
                          onClick={() => handleSortByColumn('token')}
                        >
                          Token
                          <SortIndicator columnKey="token" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 hover:text-white"
                          onClick={() => handleSortByColumn('role')}
                        >
                          Rol
                          <SortIndicator columnKey="role" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 hover:text-white"
                          onClick={() => handleSortByColumn('center')}
                        >
                          Centro
                          <SortIndicator columnKey="center" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 hover:text-white"
                          onClick={() => handleSortByColumn('uses')}
                        >
                          Usos
                          <SortIndicator columnKey="uses" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 hover:text-white"
                          onClick={() => handleSortByColumn('expires_at')}
                        >
                          Expira
                          <SortIndicator columnKey="expires_at" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 hover:text-white"
                          onClick={() => handleSortByColumn('created_at')}
                        >
                          Creado
                          <SortIndicator columnKey="created_at" />
                        </button>
                      </TableHead>
                      <TableHead>Nota interna</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedInvitationLinks.map((invitation) => {
                      const status = getInvitationStatus(invitation);
                      const roleName = roleNameById.get(toQueryValue(invitation.role_id)) || 'N/A';
                      const centerName = invitation.center_id
                        ? centerNameById.get(toQueryValue(invitation.center_id)) || `Centro ${invitation.center_id}`
                        : 'Sin centro';

                      return (
                        <TableRow
                          key={invitation.id}
                          className="cursor-pointer hover:bg-white/5 transition-colors"
                          onClick={() => handleOpenDetail(invitation)}
                        >
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
                          <TableCell className="max-w-[260px]">
                            <p className="truncate text-xs text-muted-foreground" title={invitation.note || ''}>
                              {invitation.note || 'Sin nota'}
                            </p>
                          </TableCell>
                          <TableCell className="text-right">
                            <div
                              className="flex justify-end flex-wrap gap-2"
                              onClick={(e) => e.stopPropagation()}
                            >
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
        )}

        {isCreateView && (
          <>
            <Card className="border-border/60 bg-card/85 backdrop-blur-sm">
              <CardContent className="space-y-6">
                <div className="grid mt-2 grid-cols-1 md:grid-cols-2 gap-4">
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
                                note: form.note.trim(),
                                link: generatedLink,
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
          </>
        )}
      </div>

      {/* ── Detail dialog ── */}
      <Dialog
        open={isDetailOpen}
        onOpenChange={(open) => {
          setIsDetailOpen(open);
          if (!open) {
            setSelectedInvitation(null);
            setDetailQrDataUrl('');
          }
        }}
      >
        <DialogContent className="w-[96vw] max-w-lg bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle>Detalle de invitación</DialogTitle>
            <DialogDescription>
              Información completa del QR/link de invitación seleccionado.
            </DialogDescription>
          </DialogHeader>

          {selectedInvitation && (() => {
            const inv = selectedInvitation;
            const status = getInvitationStatus(inv);
            const roleName = roleNameById.get(toQueryValue(inv.role_id)) || 'N/A';
            const centerName = inv.center_id
              ? centerNameById.get(toQueryValue(inv.center_id)) || `Centro ${inv.center_id}`
              : 'Sin centro';
            const storedLink = getStoredInvitationLink(inv.id);

            return (
              <div className="space-y-4 pt-2">
                {/* Status + token */}
                <div className="flex items-center gap-3">
                  <Badge variant={status.variant}>{status.label}</Badge>
                  <span className="font-mono text-xs text-muted-foreground">
                    {inv.token_preview || 'N/A'}
                  </span>
                </div>

                {/* Características */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wide mb-0.5">Destino</p>
                    <p className="text-foreground">
                      {inv.destination === 'login' ? 'Login (/login)' : 'Registro (/signup)'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wide mb-0.5">Rol</p>
                    <p className="text-foreground">{formatRoleLabel(roleName)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wide mb-0.5">Centro</p>
                    <p className="text-foreground">{centerName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wide mb-0.5">Usos</p>
                    <p className="text-foreground">
                      {inv.max_uses === null
                        ? `${inv.used_uses || 0} / Ilimitado`
                        : `${inv.used_uses || 0} / ${inv.max_uses}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wide mb-0.5">Expira</p>
                    <p className="text-foreground">
                      {inv.expires_at ? formatDateLabel(inv.expires_at) : 'Sin expiración'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wide mb-0.5">Creado</p>
                    <p className="text-foreground">{formatDateLabel(inv.created_at)}</p>
                  </div>
                  {inv.note && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground text-xs uppercase tracking-wide mb-0.5">Nota</p>
                      <p className="text-foreground">{inv.note}</p>
                    </div>
                  )}
                </div>

                {/* QR preview + acciones */}
                {storedLink ? (
                  <div className="space-y-3">
                    {isLoadingDetailQr ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                      </div>
                    ) : detailQrDataUrl ? (
                      <div className="flex justify-center">
                        <img
                          src={detailQrDataUrl}
                          alt="QR de invitación"
                          className="w-40 h-40 rounded-sm bg-white"
                        />
                      </div>
                    ) : null}
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleCopy(storedLink)}
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Copiar link
                      </Button>
                      {detailQrDataUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            setIsDetailOpen(false);
                            openQrViewer({
                              title: `QR · ${inv.token_preview}`,
                              dataUrl: detailQrDataUrl,
                              note: inv.note || '',
                              link: storedLink,
                            });
                          }}
                        >
                          <QrCode className="w-4 h-4 mr-2" />
                          Ver QR completo
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground border border-dashed border-input rounded-md p-3">
                    Este navegador no tiene el link/QR guardado para esta invitación activa. Los nuevos links se conservan localmente mientras sigan activos.
                  </p>
                )}

                {/* Revocar */}
                {!inv.is_revoked && isInvitationActive(inv) && (
                  <div className="pt-1 border-t border-border">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setIsDetailOpen(false);
                        handleRevokeInvitation(inv);
                      }}
                      disabled={revokingLinkId === inv.id}
                    >
                      {revokingLinkId === inv.id ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Ban className="w-4 h-4 mr-2" />
                      )}
                      Revocar este QR
                    </Button>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog
        open={isQrViewerOpen}
        onOpenChange={(open) => {
          setIsQrViewerOpen(open);
          if (!open) {
            setQrViewerZoom(1);
            setIsLoadingViewerQr(false);
            setQrViewerNote('');
            setQrViewerLink('');
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
              {qrViewerLink && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(qrViewerLink)}
                  className="border-white/30 bg-transparent text-white hover:bg-white/10"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copiar link
                </Button>
              )}
            </div>
            {qrViewerNote && (
              <p className="text-xs text-white/80 pt-2 whitespace-pre-wrap">
                Nota: {qrViewerNote}
              </p>
            )}
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
