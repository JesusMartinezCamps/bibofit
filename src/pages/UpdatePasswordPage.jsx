import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { KeyRound, ArrowLeft, CheckCircle2, Lock } from 'lucide-react';

const UpdatePasswordPage = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const checkSession = async () => {
      // Check if we have an active session (which happens after clicking the recovery link)
      const { data: { session } } = await supabase.auth.getSession();
      const hash = window.location.hash;
      
      // If we don't have a session AND we don't have a recovery hash, this page shouldn't be accessed directly
      // We check both because sometimes the client consumes the hash before this component mounts
      if (!session && !hash.includes('type=recovery')) {
         toast({
          title: "Enlace no válido",
          description: "El enlace de recuperación no es válido o ha expirado. Por favor solicita uno nuevo.",
          variant: "destructive",
        });
        navigate('/login');
      }
    };
    
    checkSession();
  }, [navigate, toast]);

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({ 
        title: "Las contraseñas no coinciden", 
        description: "Por favor, verifica que ambas contraseñas sean iguales.", 
        variant: "destructive" 
      });
      return;
    }
    
    if (password.length < 6) {
      toast({ 
        title: "Contraseña insegura", 
        description: "La contraseña debe tener al menos 6 caracteres.", 
        variant: "destructive" 
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Update the user's password. Supabase handles the session automatically from the recovery link.
      const { error } = await supabase.auth.updateUser({ password: password });
      
      if (error) throw error;
      
      setSuccess(true);
      toast({ 
        title: "¡Contraseña actualizada!", 
        description: "Tu contraseña ha sido cambiada exitosamente.",
        className: "bg-green-600 text-white border-none"
      });

      // Redirect to login after a short delay to let user read the success message
      setTimeout(() => {
        navigate('/login');
      }, 3000);
      
    } catch (error) {
      console.error("Password update error:", error);
      toast({ 
        title: "Error al actualizar", 
        description: error.message || "Ha ocurrido un error. Por favor solicita un nuevo enlace.", 
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Actualizar Contraseña - Gsus Martz</title>
        <meta name="description" content="Establece tu nueva contraseña." />
      </Helmet>
      
      <div className="min-h-screen hero-gradient flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="glass-effect rounded-2xl p-8 shadow-2xl relative border border-gray-700/50"
          >
            {success ? (
              <div className="text-center py-8 animate-in fade-in zoom-in duration-500">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-green-500/20 rounded-full mb-6 ring-1 ring-green-500/50">
                  <CheckCircle2 className="w-10 h-10 text-green-500" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-4">¡Contraseña Actualizada!</h2>
                <p className="text-gray-300 mb-8 text-sm leading-relaxed">
                  Tu contraseña ha sido restablecida correctamente. <br/>
                  Serás redirigido al inicio de sesión en unos segundos...
                </p>
                <Button onClick={() => navigate('/login')} className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold">
                  Ir a Iniciar Sesión ahora
                </Button>
              </div>
            ) : (
              <>
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-[#5ebe7d]/20 rounded-full mb-4 ring-1 ring-[#5ebe7d]/50">
                    <KeyRound className="w-8 h-8 text-[#5ebe7d]" />
                  </div>
                  <h1 className="text-3xl font-bold text-white mb-2">Nueva Contraseña</h1>
                  <p className="text-gray-400 text-sm">Ingresa tu nueva contraseña a continuación.</p>
                </div>
                
                <form onSubmit={handleUpdatePassword} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300 ml-1">Nueva Contraseña</label>
                    <div className="relative">
                        <input 
                            type="password" 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                            className="input-field w-full pl-10" 
                            placeholder="••••••••" 
                            required 
                            minLength={6}
                        />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300 ml-1">Confirmar Contraseña</label>
                    <div className="relative">
                        <input 
                            type="password" 
                            value={confirmPassword} 
                            onChange={(e) => setConfirmPassword(e.target.value)} 
                            className="input-field w-full pl-10" 
                            placeholder="••••••••" 
                            required 
                            minLength={6}
                        />
                    </div>
                  </div>
                  
                  <Button 
                    type="submit" 
                    disabled={isLoading} 
                    className="w-full bg-gradient-to-r from-[#5ebe7d] to-[#4da869] hover:from-[#4da869] hover:to-[#3d8c52] text-white font-bold py-6 mt-2"
                  >
                    {isLoading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : 'Restablecer Contraseña'}
                  </Button>
                </form>

                <p className="mt-8 text-center text-sm text-gray-400">
                  <Link to="/login" className="font-medium text-[#5ebe7d] hover:text-[#4da869] hover:underline inline-flex items-center transition-colors">
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Volver a Iniciar Sesión
                  </Link>
                </p>
              </>
            )}
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default UpdatePasswordPage;