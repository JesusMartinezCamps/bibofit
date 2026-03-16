import React, { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getDashboardRedirectUrl, getUpdatePasswordRedirectUrl } from '@/lib/authRedirects';
import { Loader2, Mail, Lock, ShieldCheck, RefreshCcw } from 'lucide-react';

const MIN_PASSWORD_LENGTH = 8;

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const validatePassword = (value) => {
  if (!value || value.length < MIN_PASSWORD_LENGTH) {
    return `La nueva contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
    return 'La nueva contraseña debe incluir al menos una letra y un número.';
  }
  return '';
};

const AccountSecurityForm = ({ currentEmail = '', disabled = false, onCredentialsUpdated }) => {
  const { toast } = useToast();

  const [newEmail, setNewEmail] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isSendingResetLink, setIsSendingResetLink] = useState(false);

  const normalizedCurrentEmail = useMemo(() => currentEmail.trim().toLowerCase(), [currentEmail]);

  const handleEmailUpdate = async () => {
    const normalizedNewEmail = newEmail.trim().toLowerCase();
    if (!normalizedNewEmail) {
      toast({ title: 'Correo requerido', description: 'Introduce el nuevo correo.', variant: 'destructive' });
      return;
    }
    if (!isValidEmail(normalizedNewEmail)) {
      toast({ title: 'Correo no válido', description: 'Introduce un correo con formato válido.', variant: 'destructive' });
      return;
    }
    if (normalizedNewEmail === normalizedCurrentEmail) {
      toast({ title: 'Sin cambios', description: 'Ese correo ya es el actual.', variant: 'destructive' });
      return;
    }

    setIsUpdatingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser(
        { email: normalizedNewEmail },
        { emailRedirectTo: getDashboardRedirectUrl() }
      );
      if (error) throw error;

      setPendingEmail(normalizedNewEmail);
      setNewEmail('');
      toast({
        title: 'Cambio de correo iniciado',
        description: 'Revisa tu email actual y el nuevo para confirmar el cambio.',
        variant: 'success',
      });
      await onCredentialsUpdated?.();
    } catch (error) {
      toast({
        title: 'No se pudo actualizar el correo',
        description: error?.message || 'Inténtalo de nuevo en unos segundos.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  const handlePasswordUpdate = async () => {
    const passwordValidationError = validatePassword(newPassword);
    if (passwordValidationError) {
      toast({ title: 'Contraseña no válida', description: passwordValidationError, variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'Las contraseñas no coinciden', description: 'Verifica ambas contraseñas.', variant: 'destructive' });
      return;
    }
    if (!currentPassword) {
      toast({ title: 'Contraseña actual requerida', description: 'Introduce tu contraseña actual.', variant: 'destructive' });
      return;
    }
    if (!normalizedCurrentEmail) {
      toast({
        title: 'Correo no disponible',
        description: 'No se pudo resolver tu correo actual. Cierra sesión e inicia de nuevo.',
        variant: 'destructive',
      });
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedCurrentEmail,
        password: currentPassword,
      });
      if (signInError) {
        throw new Error('La contraseña actual no es correcta.');
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast({ title: 'Contraseña actualizada', description: 'Tu contraseña se cambió correctamente.', variant: 'success' });
      await onCredentialsUpdated?.();
    } catch (error) {
      toast({
        title: 'No se pudo cambiar la contraseña',
        description: error?.message || 'No se pudo validar tu identidad para el cambio.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleSendResetLink = async () => {
    if (!normalizedCurrentEmail) {
      toast({
        title: 'Correo no disponible',
        description: 'No se pudo resolver tu correo actual. Cierra sesión e inicia de nuevo.',
        variant: 'destructive',
      });
      return;
    }

    setIsSendingResetLink(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedCurrentEmail, {
        redirectTo: getUpdatePasswordRedirectUrl(),
      });
      if (error) throw error;

      toast({
        title: 'Enlace enviado',
        description: 'Te enviamos un enlace para restablecer la contraseña.',
        variant: 'success',
      });
    } catch (error) {
      toast({
        title: 'No se pudo enviar el enlace',
        description: error?.message || 'Inténtalo de nuevo en unos segundos.',
        variant: 'destructive',
      });
    } finally {
      setIsSendingResetLink(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border/60 bg-muted/25 p-4">
        <div className="mb-4 flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">Correo de acceso</p>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="security-current-email" className="text-muted-foreground">
                Correo actual
              </Label>
              <Input
                id="security-current-email"
                type="email"
                value={currentEmail}
                disabled
                className="input-field"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="security-new-email" className="text-muted-foreground">
                Nuevo correo
              </Label>
              <Input
                id="security-new-email"
                type="email"
                value={newEmail}
                onChange={(event) => setNewEmail(event.target.value)}
                placeholder="nuevo@email.com"
                className="input-field"
                disabled={disabled || isUpdatingEmail}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline-profile"
              onClick={handleEmailUpdate}
              disabled={disabled || isUpdatingEmail}
            >
              {isUpdatingEmail ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Cambiar correo'
              )}
            </Button>
            {pendingEmail && (
              <p className="text-xs text-muted-foreground">
                Pendiente de confirmación: {pendingEmail}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-muted/25 p-4">
        <div className="mb-4 flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">Contraseña</p>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="security-current-password" className="text-muted-foreground">
                Contraseña actual
              </Label>
              <Input
                id="security-current-password"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className="input-field"
                autoComplete="current-password"
                disabled={disabled || isUpdatingPassword}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="security-new-password" className="text-muted-foreground">
                Nueva contraseña
              </Label>
              <Input
                id="security-new-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="input-field"
                autoComplete="new-password"
                disabled={disabled || isUpdatingPassword}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="security-confirm-password" className="text-muted-foreground">
                Confirmar nueva
              </Label>
              <Input
                id="security-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="input-field"
                autoComplete="new-password"
                disabled={disabled || isUpdatingPassword}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline-profile"
              onClick={handlePasswordUpdate}
              disabled={disabled || isUpdatingPassword}
            >
              {isUpdatingPassword ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Actualizando...
                </>
              ) : (
                <>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Actualizar contraseña
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={handleSendResetLink}
              disabled={disabled || isSendingResetLink}
            >
              {isSendingResetLink ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando enlace...
                </>
              ) : (
                <>
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Prefiero enlace por correo
                </>
              )}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Recomendación: mínimo {MIN_PASSWORD_LENGTH} caracteres, con letras y números.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AccountSecurityForm;
