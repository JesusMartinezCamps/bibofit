import React, { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { MailCheck, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import LandingNavbar from '@/components/landing/LandingNavbar';

const CheckEmailPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { resendSignupConfirmation } = useAuth();
  const [isResending, setIsResending] = useState(false);

  const email = useMemo(() => {
    return location.state?.email || '';
  }, [location.state]);

  const handleResend = async () => {
    if (!email) {
      toast({
        title: 'Email no disponible',
        description: 'Vuelve al registro e introduce tu email para reenviar la confirmación.',
        variant: 'destructive',
      });
      return;
    }

    setIsResending(true);
    const result = await resendSignupConfirmation(email);
    setIsResending(false);

    if (!result.success) {
      toast({
        title: 'No se pudo reenviar',
        description: result.error || 'Inténtalo de nuevo en unos segundos.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Correo reenviado',
      description: 'Te hemos enviado un nuevo enlace de confirmación.',
    });
  };

  return (
    <>
      <Helmet>
        <title>Revisa Tu Correo - Bibofit</title>
        <meta
          name="description"
          content="Confirma tu email para activar tu cuenta y empezar en Bibofit."
        />
      </Helmet>

      <div className="min-h-screen bg-background">
        <LandingNavbar showNavigationOptions={false} />

        <div className="min-h-screen hero-gradient flex items-center justify-center p-4 pt-24">
          <div className="w-full max-w-lg">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="glass-effect rounded-2xl p-8 shadow-2xl border border-border/50"
            >
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/20 rounded-full mb-4">
                  <MailCheck className="w-8 h-8 text-green-400" />
                </div>
                <h1 className="text-3xl font-bold text-white mb-2">Revisa tu correo</h1>
                <p className="text-muted-foreground">
                  Hemos enviado un enlace de confirmación
                  {email ? ` a ${email}` : ''}.
                </p>
              </div>

              <div className="rounded-xl border border-border/60 bg-[#11161d]/80 p-4 space-y-2 mb-6">
                <p className="text-sm text-gray-200">Siguientes pasos:</p>
                <p className="text-sm text-muted-foreground">1. Abre el email de Bibofit.</p>
                <p className="text-sm text-muted-foreground">2. Pulsa en "Confirmar mi cuenta".</p>
                <p className="text-sm text-muted-foreground">3. Te llevaremos a una pantalla de confirmación para empezar.</p>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={handleResend}
                  disabled={isResending}
                  className="w-full bg-green-500 text-black hover:bg-green-400 font-semibold"
                >
                  <RefreshCcw className="w-4 h-4 mr-2" />
                  {isResending ? 'Reenviando...' : 'Reenviar email de confirmación'}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => navigate('/login')}
                  className="w-full border-input text-white bg-transparent hover:bg-muted"
                >
                  Ir a iniciar sesión
                </Button>
              </div>

              <p className="text-center text-xs text-muted-foreground mt-6">
                Si no lo recibes en 1-2 minutos, revisa Spam o Promociones.
              </p>

              <p className="text-center text-sm text-muted-foreground mt-4">
                ¿Te has equivocado de correo?{' '}
                <Link to="/signup" className="text-green-400 hover:underline">
                  Crear cuenta de nuevo
                </Link>
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CheckEmailPage;
