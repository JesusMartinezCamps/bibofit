import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import LandingNavbar from '@/components/landing/LandingNavbar';
import AppIcon from '@/components/icons/AppIcon';

// GoogleLogo.jsx
export const GoogleLogo = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 48 48"
    {...props}
  >
    <path fill="#EA4335" d="M24 9.5c3.94 0 6.61 1.7 8.13 3.13l6.06-6.06C34.08 2.91 29.55 1 24 1 14.75 1 6.79 6.69 3.54 14.68l7.63 5.94C12.54 14.5 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.5 24c0-1.7-.15-3.36-.45-4.95H24v9.41h12.7c-.56 2.87-2.24 5.3-4.76 6.95l7.4 5.73C43.97 36.77 46.5 30.82 46.5 24z"/>
    <path fill="#FBBC05" d="M11.17 28.5a14.36 14.36 0 010-9l-7.63-5.94a23.94 23.94 0 000 20.88l7.63-5.94z"/>
    <path fill="#34A853" d="M24 46.5c6.22 0 11.45-2.05 15.26-5.55l-7.4-5.73C29.55 37.45 26.95 38.5 24 38.5c-6.26 0-11.47-5-12.83-11.12l-7.63 5.94C6.79 41.31 14.75 46.5 24 46.5z"/>
  </svg>
);

// AppleLogo.jsx
export const AppleLogo = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 384 512"
    fill="currentColor"
    {...props}
  >
    <path d="M318.7 268.7c-.3-36.1 16.1-63.4 49-83.7-18.4-26.9-46.2-41.5-82.2-43.9-34.4-2.3-72 20.1-86.2 20.1-15.1 0-50.2-19.1-77.7-19.1C63.9 142.1 0 205.7 0 300.1c0 54.5 19.9 112 44.5 148.7 21.1 31.4 48.3 66.6 83 65.4 33.4-1.3 46.3-21.4 86.8-21.4 40.3 0 51.7 21.4 86.9 20.7 35.9-.7 58.7-31.9 79.8-63.5 14.3-21.5 20.3-32.4 31.7-56.6-83.2-31.3-78.6-147.4-3.9-174.7zM251.2 97c26.3-31.4 23.9-60.1 23-70.1-23.3 1.3-50.4 15.8-66.5 34.4-17.4 19.8-27.8 44.9-25.6 71.2 25.9 2 49.6-12.9 69.1-35.5z"/>
  </svg>
);

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { user, login, signInWithProvider, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Redirect logic if user is already authenticated
  if (!authLoading && user) {
    if (!user.onboarding_completed_at) {
        navigate('/assign-diet-plan', { replace: true });
    } else {
        const targetPath = user.role === 'admin' ? '/admin-panel/advisories' : '/dashboard';
        navigate(targetPath, { replace: true });
    }
    return null;
  }

  const handleRedirect = (userData) => {
    // Redirection Logic
    // If onboarding is not completed (onboarding_completed_at is null), send to onboarding (assign-diet-plan which triggers wizard)
    if (!userData.onboarding_completed_at) {
        navigate('/assign-diet-plan', { replace: true });
    } else {
        // Otherwise send to appropriate dashboard
        const targetPath = userData.role === 'admin' ? '/admin-panel/advisories' : '/dashboard';
        navigate(targetPath, { replace: true });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await login(email, password);
      if (!result.success) {
        toast({
          title: "Error de autenticación",
          description: result.error || 'Credenciales incorrectas',
          variant: "destructive",
        });
      } else {
        toast({
          title: "¡Bienvenido!",
          description: "Has iniciado sesión correctamente.",
        });
        handleRedirect(result.user);
      }
    } catch (error) {
      toast({
        title: "Error de autenticación",
        description: 'Ha ocurrido un error inesperado',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuth = async (provider) => {
    setIsLoading(true);
    try {
      const result = await signInWithProvider(provider);
      if (!result.success) {
        toast({
          title: `Error con ${provider}`,
          description: result.error,
          variant: "destructive",
        });
        setIsLoading(false);
      } else {
         // OAuth redirect handles itself
      }
    } catch (error) {
      toast({
        title: `Error con ${provider}`,
        description: 'Ha ocurrido un error inesperado',
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Iniciar Sesión - Bibofit</title>
        <meta name="description" content="Accede a tu plataforma de entrenamiento personal con Bibofit" />
      </Helmet>

      <div className="min-h-screen bg-[#1a1e23]">
        <LandingNavbar showNavigationOptions={false} />
        
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
                  className="inline-flex items-center justify-center w-16 h-16 bg-green-500/20 rounded-full mb-4"
                >
                  <AppIcon className="w-10 h-10 text-black" />
                </motion.div>
                <h1 className="text-3xl font-bold text-white mb-2">Iniciar Sesión</h1>
                <p className="text-gray-400">Accede a tu cuenta para continuar.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
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
                  <label className="block text-sm font-medium text-gray-300 mb-2">Contraseña</label>
                  <input 
                    type="password" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    className="input-field w-full" 
                    placeholder="••••••••" 
                    required 
                  />
                </div>
                <Button 
                  type="submit" 
                  disabled={isLoading || authLoading} 
                  className="w-full btn-primary text-white bg-gray-900 border border-gray-700 hover:bg-gray-800 hover:text-white"
                >
                  {isLoading || authLoading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    'Iniciar Sesión'
                  )}
                </Button>
              </form>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-600"></span>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-[#282d34] px-2 text-gray-400">O continúa con</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Button 
                  variant="outline" 
                  onClick={() => handleOAuth('google')} 
                  disabled={isLoading || authLoading} 
                  className="text-white bg-gray-900 border border-gray-700 hover:bg-gray-800 hover:text-white w-full"
                >
                  <GoogleLogo className="mr-2" /> Google
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => handleOAuth('apple')} 
                  disabled={isLoading || authLoading} 
                  className="text-white bg-gray-900 border border-gray-700 hover:bg-gray-800 hover:text-white w-full"
                >
                  <AppleLogo className="mr-2" /> Apple
                </Button>
              </div>

              <div className="mt-8 text-center text-sm text-gray-400 space-y-2">
                <p>
                  ¿No tienes una cuenta?{' '}
                  <Link to="/signup" className="font-medium text-green-400 hover:underline">
                    Regístrate
                  </Link>
                </p>
                <p>
                  ¿Has olvidado tu contraseña?{' '}
                  <Link to="/reset-password" className="font-medium text-green-400 hover:underline">
                    Recupérala
                  </Link>
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </>
  );
};

export default LoginPage;