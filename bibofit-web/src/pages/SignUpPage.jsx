import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { UserPlus } from 'lucide-react';
import { GoogleLogo } from '@/pages/LoginPage';

const SignUpPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signup, signInWithProvider, ensureDefaultTemplate } = useAuth(); // Using new function
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await signup(email, password, firstName, lastName, phone);
      if (!result.success) {
        toast({
          title: "Error de registro",
          description: result.error || 'No se pudo crear la cuenta',
          variant: "destructive",
        });
      } else {
        // Ensure template exists (Task 7 requirement implementation)
        if(ensureDefaultTemplate) await ensureDefaultTemplate();

        if (result.needsEmailConfirmation) {
          toast({
            title: "¡Cuenta creada!",
            description: "Te hemos enviado un correo para confirmar tu cuenta.",
          });
          navigate('/auth/check-email', { state: { email } });
        } else {
          toast({
            title: "¡Cuenta creada!",
            description: "Tu sesión se ha iniciado correctamente.",
          });
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
      const result = await signInWithProvider('google');
      if (!result.success) {
        toast({
          title: 'Error con Google',
          description: result.error,
          variant: "destructive",
        });
        setIsLoading(false);
      } else {
         if(ensureDefaultTemplate) await ensureDefaultTemplate();
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

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Nombre</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="input-field w-full"
                    placeholder="Juan"
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
                    placeholder="Pérez García"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Teléfono <span className="text-muted-foreground/60">(Opcional)</span></label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="input-field w-full"
                    placeholder="+34 600 000 000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Email</label>
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
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Contraseña</label>
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
                <Button 
                  type="submit" 
                  disabled={isLoading} 
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isLoading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-foreground"></div>
                  ) : (
                    'Crear Cuenta'
                  )}
                </Button>
              </form>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-input"></span>
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
                <Link to="/login" className="font-medium text-primary hover:underline">
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
