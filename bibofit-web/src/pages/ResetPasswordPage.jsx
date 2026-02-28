import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { KeyRound, ArrowLeft } from 'lucide-react';
import LandingNavbar from '@/components/landing/LandingNavbar';

const ResetPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const { toast } = useToast();

  const handleRequestReset = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      } else {
        setMessage('Si existe una cuenta con este correo, recibirás un enlace para restablecer tu contraseña.');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: 'Ha ocurrido un error inesperado',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Restablecer Contraseña - Bibofit</title>
        <meta name="description" content="Recupera el acceso a tu cuenta de Bibofit." />
      </Helmet>
      
      <div className="min-h-screen bg-[#1a1e23]">
        <LandingNavbar showNavigationOptions={false} />
        
        <div className="min-h-screen hero-gradient flex items-center justify-center p-4 pt-24">
          <div className="w-full max-w-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="glass-effect rounded-2xl p-8 shadow-2xl relative"
            >
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/20 rounded-full mb-4">
                  <KeyRound className="w-8 h-8 text-black" />
                </div>
                <h1 className="text-3xl font-bold text-white mb-2">Restablecer Contraseña</h1>
                <p className="text-gray-400">Introduce tu correo para recibir un enlace de recuperación.</p>
              </div>
              
              <form onSubmit={handleRequestReset} className="space-y-6">
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
                <Button type="submit" disabled={isLoading} className="w-full btn-primary bg-green-500 hover:bg-green-600 text-black font-semibold">
                  {isLoading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></div>
                  ) : (
                    'Enviar Enlace'
                  )}
                </Button>
              </form>
              
              {message && (
                <p className="mt-4 text-center text-sm text-green-400">{message}</p>
              )}

              <p className="mt-8 text-center text-sm text-gray-400">
                <Link to="/login" className="font-medium text-green-400 hover:underline inline-flex items-center">
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Volver a Iniciar Sesión
                </Link>
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ResetPasswordPage;