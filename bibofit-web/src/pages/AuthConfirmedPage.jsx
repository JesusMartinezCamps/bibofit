import React, { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import LandingNavbar from '@/components/landing/LandingNavbar';

const AuthConfirmedPage = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const targetPath = useMemo(() => {
    if (!user) return '/login';
    if (!user.onboarding_completed_at) return '/assign-diet-plan';
    if (user.role === 'admin') return '/admin-panel/advisories';
    if (user.role === 'coach') return '/coach-dashboard';
    return '/dashboard';
  }, [user]);

  useEffect(() => {
    if (loading || !user) return;
    const timeout = setTimeout(() => {
      navigate(targetPath, { replace: true });
    }, 1800);
    return () => clearTimeout(timeout);
  }, [loading, user, navigate, targetPath]);

  return (
    <>
      <Helmet>
        <title>Cuenta Confirmada - Bibofit</title>
        <meta
          name="description"
          content="Tu cuenta está confirmada. Continúa para empezar con Bibofit."
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
              className="glass-effect rounded-2xl p-8 shadow-2xl border border-border/50 text-center"
            >
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/20 rounded-full mb-4">
                {loading ? (
                  <Loader2 className="w-8 h-8 text-green-400 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-8 h-8 text-green-400" />
                )}
              </div>

              <h1 className="text-3xl font-bold text-foreground mb-2">Cuenta confirmada</h1>

              {loading && (
                <p className="text-muted-foreground mb-6">Validando sesión y preparando tu acceso...</p>
              )}

              {!loading && user && (
                <p className="text-muted-foreground mb-6">
                  Todo listo. Te redirigimos para empezar en Bibofit.
                </p>
              )}

              {!loading && !user && (
                <p className="text-muted-foreground mb-6">
                  Tu email se confirmó, pero no hay sesión activa. Inicia sesión para continuar.
                </p>
              )}

              <Button
                onClick={() => navigate(targetPath, { replace: true })}
                className="w-full bg-green-500 text-black hover:bg-green-400 font-semibold"
              >
                {loading ? 'Cargando...' : user ? 'Continuar' : 'Ir a iniciar sesión'}
              </Button>
            </motion.div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AuthConfirmedPage;
