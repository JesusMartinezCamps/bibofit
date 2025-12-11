import React, { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Dumbbell } from 'lucide-react';
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
const GoogleIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M21.35,11.1H12.18V13.83H18.69C18.36,17.64 15.19,19.27 12.19,19.27C8.36,19.27 5,16.25 5,12C5,7.9 8.2,4.73 12.19,4.73C15.29,4.73 17.1,6.7 17.1,6.7L19,4.72C19,4.72 16.56,2 12.19,2C6.42,2 2.03,6.8 2.03,12C2.03,17.05 6.16,22 12.19,22C17.6,22 21.54,18.33 21.54,12.81C21.54,11.76 21.35,11.1 21.35,11.1V11.1Z"></path></svg>;
const AppleIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M19.2,12.74a4.1,4.1,0,0,1-2.35,3.66,4.23,4.23,0,0,1-4.37,0,5,5,0,0,1-2.1-2.28,10.2,10.2,0,0,1-1.22-4.88a10,10,0,0,1,1.22-5,5,5,0,0,1,2.1-2.28,4.23,4.23,0,0,1,4.37,0,4.1,4.1,0,0,1,2.35,3.66,10.43,10.43,0,0,1-1.73,6.12ZM15.4,5.7a4.23,4.23,0,0,0-3.38,1.8,10.5,10.5,0,0,0-1.21,5.19,10.05,10.05,0,0,0,1.21,5,4.23,4.23,0,0,0,3.38,1.8,4.38,4.38,0,0,0,3.39-1.8,10.4,10.4,0,0,0,0-10.19A4.38,4.38,0,0,0,15.4,5.7Zm-3.33-3.24a2.68,2.68,0,0,1,2.11.88,2.53,2.53,0,0,1-1,4.12,2.73,2.73,0,0,1-2.11-.88,2.53,2.53,0,0,1,1-4.12Z"></path></svg>;

const SignUpPage = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // Fixed: destructure loading from useAuth and alias it to authLoading
  const { user, signUp, signInWithProvider, loading: authLoading } = useAuth();
  const { toast } = useToast();

  if (user) {
    return <Navigate to={user.role === 'admin' ? '/admin-panel/advisories' : '/dashboard'} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const result = await signUp(email, password, fullName);
      if (!result.success) {
        toast({
          title: "Error en el registro",
          description: result.error || 'No se pudo crear la cuenta.',
          variant: "destructive",
        });
      } else {
        toast({
          title: "¡Cuenta creada!",
          description: "Revisa tu email para confirmar tu cuenta.",
        });
      }
    } catch (error) {
      toast({
        title: "Error en el registro",
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
        <title>Crear Cuenta - Gsus Martz</title>
        <meta name="description" content="Regístrate en la plataforma de entrenamiento personal de Gsus Martz." />
      </Helmet>
      
      <div className="min-h-screen hero-gradient flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="glass-effect rounded-2xl p-8 shadow-2xl"
          >
            <div className="text-center mb-8">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: "spring", stiffness: 200 }} className="inline-flex items-center justify-center w-16 h-16 bg-[#5ebe7d] rounded-full mb-4">
                <Dumbbell className="w-8 h-8 text-white" />
              </motion.div>
              <h1 className="text-3xl font-bold text-white mb-2">Crear una Cuenta</h1>
              <p className="text-gray-400">Únete para empezar a superarte.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Nombre Completo</label>
                <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="input-field w-full" placeholder="Tu nombre" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field w-full" placeholder="tu@email.com" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Contraseña</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input-field w-full" placeholder="Mínimo 6 caracteres" required />
              </div>
              <Button type="submit" disabled={isLoading || authLoading} className="w-full border border-gray-700 hover:bg-slate-900/25 btn-primary">
                {isLoading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2"></div> : 'Crear Cuenta'}
              </Button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-600"></span></div>
              <div className="relative flex justify-center text-sm"><span className="bg-[#282d34] px-2 text-gray-400">O regístrate con</span></div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Button variant="outline" onClick={() => handleOAuth('google')} disabled={isLoading || authLoading} className="text-white bg-gray-900 border border-gray-700 hover:bg-gray-800 hover:text-white w-full"><GoogleLogo className="mr-2" /> Google</Button>
              <Button variant="outline" onClick={() => handleOAuth('apple')} disabled={isLoading || authLoading} className="text-white bg-gray-900 border border-gray-700 hover:bg-gray-800 hover:text-white w-full"><AppleLogo className="mr-2" /> Apple</Button>
            </div>

            <p className="mt-8 text-center text-sm text-gray-400">
              ¿Ya tienes una cuenta?{' '}
              <Link to="/login" className="font-medium text-[#5ebe7d] hover:underline">
                Inicia sesión
              </Link>
            </p>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default SignUpPage;