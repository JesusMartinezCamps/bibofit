import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { AlertTriangle, CheckCircle2, Loader2, UserPlus } from 'lucide-react';
import { GoogleLogo } from '@/pages/LoginPage';
import { PHONE_PREFIXES, validatePhone, buildE164 } from '@/lib/phonePrefixes';
import {
  appendInviteTokenToPath,
  getInviteTokenFromSearch,
  getStoredInviteToken,
  setStoredInviteToken,
} from '@/lib/invitationTokenStore';
import { supabase } from '@/lib/supabaseClient';

// ─── helpers ─────────────────────────────────────────────────────────────────

const formatRoleLabel = (value = '') => {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const formatDate = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
};

// ─── InviteBanner ─────────────────────────────────────────────────────────────

const INVALID_STATUSES = new Set(['revoked', 'expired', 'exhausted', 'invalid_token', 'missing_token']);

const INVALID_LABELS = {
  expired:       'Este link de invitación ha expirado.',
  revoked:       'Este link de invitación ha sido revocado.',
  exhausted:     'Este link de invitación ya no tiene usos disponibles.',
  invalid_token: 'El link de invitación no es válido.',
  missing_token: 'El link de invitación no es válido.',
};

const InviteBanner = ({ loading, peek }) => {
  if (loading) {
    return (
      <div className="rounded-xl border border-input bg-card/50 p-3 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
        Verificando invitación…
      </div>
    );
  }

  if (!peek) return null;

  if (peek.status === 'valid') {
    return (
      <div className="rounded-xl border border-green-500/40 bg-green-500/10 p-3 space-y-1 text-sm">
        <div className="flex items-center gap-2 text-green-400 font-medium">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Invitación válida
        </div>
        <p className="text-foreground/80">
          Al registrarte se te asignará el rol{' '}
          <strong className="text-foreground">{formatRoleLabel(peek.role_name)}</strong>
          {peek.center_name && (
            <>
              {' '}en el centro{' '}
              <strong className="text-foreground">{peek.center_name}</strong>
            </>
          )}.
        </p>
        {peek.max_uses !== null && (
          <p className="text-muted-foreground text-xs">
            Usos disponibles: {Math.max(0, peek.max_uses - peek.used_uses)} de {peek.max_uses}
          </p>
        )}
        {peek.expires_at && (
          <p className="text-muted-foreground text-xs">
            Expira el {formatDate(peek.expires_at)}
          </p>
        )}
      </div>
    );
  }

  if (INVALID_STATUSES.has(peek.status)) {
    return (
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 flex items-start gap-2 text-sm text-amber-300">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
        <span>{INVALID_LABELS[peek.status] ?? 'El link de invitación no es válido.'}</span>
      </div>
    );
  }

  return null;
};

// ─── SignUpPage ───────────────────────────────────────────────────────────────

const SignUpPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phonePrefix, setPhonePrefix] = useState('+34');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [invitePeek, setInvitePeek] = useState(null);
  const [invitePeekLoading, setInvitePeekLoading] = useState(false);

  const { signup, signInWithProvider, ensureDefaultTemplate } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const inviteTokenFromUrl = useMemo(
    () => getInviteTokenFromSearch(location.search),
    [location.search]
  );
  const inviteToken = useMemo(
    () => inviteTokenFromUrl || getStoredInviteToken(),
    [inviteTokenFromUrl]
  );
  const loginPath = useMemo(() => appendInviteTokenToPath('/login', inviteToken), [inviteToken]);

  // Persistir token si viene en la URL
  useEffect(() => {
    if (!inviteTokenFromUrl) return;
    setStoredInviteToken(inviteTokenFromUrl);
  }, [inviteTokenFromUrl]);

  // Pre-validar el token al montar — llama a peek_invitation_link sin auth
  useEffect(() => {
    if (!inviteToken) {
      setInvitePeek(null);
      return;
    }

    let cancelled = false;
    setInvitePeekLoading(true);
    setInvitePeek(null);

    supabase
      .rpc('peek_invitation_link', { p_token: inviteToken })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.warn('[SignUpPage] peek_invitation_link error:', error.message);
          setInvitePeek(null);
          return;
        }
        const payload = Array.isArray(data) ? data[0] : data;
        setInvitePeek(payload ?? null);
      })
      .finally(() => {
        if (!cancelled) setInvitePeekLoading(false);
      });

    return () => { cancelled = true; };
  }, [inviteToken]);

  const handlePhoneNumberChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '');
    setPhoneNumber(digits);
    if (phoneError) setPhoneError(validatePhone(phonePrefix, digits) || '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();
    const normalizedEmail = email.trim();

    if (!normalizedFirstName || !normalizedEmail || !password.trim()) {
      toast({
        title: "Campos obligatorios",
        description: "Nombre, correo y contraseña son obligatorios.",
        variant: "destructive",
      });
      return;
    }

    const phoneValidationError = validatePhone(phonePrefix, phoneNumber);
    if (phoneValidationError) {
      setPhoneError(phoneValidationError);
      return;
    }

    const phone = buildE164(phonePrefix, phoneNumber);

    setIsLoading(true);
    try {
      const result = await signup(normalizedEmail, password, normalizedFirstName, normalizedLastName, phone, { inviteToken });
      if (!result.success) {
        toast({
          title: "Error de registro",
          description: result.error || 'No se pudo crear la cuenta',
          variant: "destructive",
        });
      } else {
        if (ensureDefaultTemplate) await ensureDefaultTemplate();

        if (result.needsEmailConfirmation) {
          toast({
            title: "¡Cuenta creada!",
            description: "Te hemos enviado un correo para confirmar tu cuenta.",
            variant: "success",
          });
          navigate('/auth/check-email', { state: { email: normalizedEmail } });
        } else {
          toast({
            title: "¡Cuenta creada!",
            description: "Tu sesión se ha iniciado correctamente.",
            variant: "success",
          });
          if (result.invitationRedemption?.status === 'applied') {
            toast({
              title: 'Invitación aplicada',
              description: 'Se aplicaron automáticamente tu rol y centro de invitación.',
              variant: 'success',
            });
          }
          if (['revoked', 'expired', 'exhausted', 'invalid_token'].includes(result.invitationRedemption?.status)) {
            toast({
              title: 'Invitación no aplicable',
              description: 'El token de invitación no está activo o no es válido.',
              variant: 'warning',
            });
          }
          navigate('/dashboard');
        }
      }
    } catch (error) {
      console.error("Registration error:", error);
      toast({
        title: "Error de registro",
        description: 'Ha ocurrido un error inesperado',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuth = async () => {
    setIsLoading(true);
    try {
      const result = await signInWithProvider('google', { inviteToken });
      if (!result.success) {
        toast({
          title: 'Error con Google',
          description: result.error,
          variant: "destructive",
        });
        setIsLoading(false);
      } else {
        if (ensureDefaultTemplate) await ensureDefaultTemplate();
      }
    } catch (error) {
      toast({
        title: 'Error con Google',
        description: 'Ha ocurrido un error inesperado',
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Registrarse - Bibofit</title>
        <meta name="description" content="Crea tu cuenta en Bibofit y empieza tu transformación fitness" />
      </Helmet>

      <div className="min-h-screen hero-gradient flex items-center justify-center p-4 pt-24">
        <div className="w-full max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="glass-effect rounded-2xl p-8 shadow-2xl"
          >
            <div className="text-center mb-8">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="inline-flex items-center justify-center w-16 h-16 bg-green-500/80 rounded-full mb-4"
              >
                <UserPlus className="w-8 h-8 text-black" />
              </motion.div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Crear Cuenta</h1>
              <p className="text-muted-foreground">Únete a Bibofit y empieza tu transformación</p>
            </div>

            {/* Banner de estado del token de invitación */}
            {inviteToken && (
              <div className="mb-6">
                <InviteBanner loading={invitePeekLoading} peek={invitePeek} />
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Nombre <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="input-field w-full"
                  placeholder="Nombre"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">Apellidos</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="input-field w-full"
                  placeholder="Apellidos"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Teléfono
                </label>
                <div className="flex gap-2">
                  <select
                    value={phonePrefix}
                    onChange={(e) => {
                      setPhonePrefix(e.target.value);
                      if (phoneError) setPhoneError(validatePhone(e.target.value, phoneNumber) || '');
                    }}
                    className="input-field !w-[7.5rem] shrink-0"
                    title={PHONE_PREFIXES.find(p => p.code === phonePrefix)?.name}
                  >
                    {PHONE_PREFIXES.map(({ code, flag, name }) => (
                      <option key={`${code}-${name}`} value={code}>
                        {flag} {code} — {name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={handlePhoneNumberChange}
                    className="input-field flex-1 min-w-0"
                    placeholder="600000000"
                    inputMode="numeric"
                  />
                </div>
                {phoneError && <p className="text-red-400 text-xs mt-1">{phoneError}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Email <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field w-full"
                  placeholder="tu@email.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Contraseña <span className="text-red-400">*</span>
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field w-full"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
                <p className="text-xs text-muted-foreground mt-1">Mínimo 6 caracteres</p>
              </div>
              <p className="text-xs text-muted-foreground -mt-2">
                Los campos con <span className="text-red-400">*</span> son obligatorios.
              </p>
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-foreground" />
                ) : (
                  'Crear Cuenta'
                )}
              </Button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-input" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-card px-2 text-muted-foreground">O regístrate con</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <Button
                variant="outline"
                onClick={handleOAuth}
                disabled={isLoading}
                className="w-full border-input bg-background text-foreground hover:bg-muted"
              >
                <GoogleLogo className="mr-2" /> Google
              </Button>
            </div>

            <p className="mt-8 text-center text-sm text-muted-foreground">
              ¿Ya tienes una cuenta?{' '}
              <Link to={loginPath} className="font-medium text-primary hover:underline">
                Inicia Sesión
              </Link>
            </p>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default SignUpPage;
