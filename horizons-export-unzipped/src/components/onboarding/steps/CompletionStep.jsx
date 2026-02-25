import React from 'react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useNavigate } from 'react-router-dom';

const CompletionStep = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { completeOnboarding } = useOnboarding();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const particles = Array.from({ length: 15 }).map((_, i) => ({
    id: i,
    size: Math.random() * 8 + 4,
    x: Math.random() * 100 - 50,
    y: Math.random() * 100 - 50,
    duration: Math.random() * 2 + 2,
    delay: Math.random() * 2
  }));

  const handleNext = async () => {
    if (!user) {
      toast({
        title: "Error de autenticación",
        description: "Necesitas iniciar sesión para continuar.",
        variant: "destructive"
      });
      return;
    }
    
    setIsSubmitting(true);

    try {
      await completeOnboarding();
      toast({
        title: "¡Configuración Exitosa!",
        description: "Tus datos han sido guardados correctamente.",
      });
      navigate('/dashboard');
    } catch (error) {
      console.error('❌ [CompletionStep] Error:', error);
      toast({
        title: "Error",
        description: "Hubo un problema al finalizar el proceso. Intenta de nuevo.",
        variant: "destructive"
      });
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-br from-[#1a0b2e] via-[#0f172a] to-[#0a192f] overflow-hidden"
        >
          {/* Subtle background glow */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-green-900/20 via-transparent to-transparent opacity-60"></div>
          
          {/* Floating Particles from LoadingScreen */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center">
            <div className="relative w-64 h-64">
              {particles.map((p) => (
                <motion.div
                  key={p.id}
                  className="absolute rounded-full bg-gradient-to-tr from-green-400 to-emerald-300 opacity-60"
                  style={{ width: p.size, height: p.size }}
                  animate={{
                    x: [0, p.x * 3, 0],
                    y: [0, p.y * 3, 0],
                    scale: [0, 1.5, 0],
                    opacity: [0, 0.6, 0],
                  }}
                  transition={{
                    duration: p.duration,
                    repeat: Infinity,
                    delay: p.delay,
                    ease: "easeInOut"
                  }}
                />
              ))}
            </div>
          </div>

          <div className="relative z-10 flex flex-col items-center justify-center w-full max-w-md p-8">
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, type: 'spring', bounce: 0.5 }}
              className="mb-8 relative"
            >
              <div className="absolute inset-0 bg-green-500/30 blur-2xl rounded-full scale-150"></div>
              <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center shadow-[0_0_30px_rgba(34,197,94,0.6)]">
                <CheckCircle2 className="w-12 h-12 text-white" />
              </div>
            </motion.div>

            <motion.div 
              className="text-center"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              <h2 className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-200 drop-shadow-sm mb-4">
                ¡Todo listo!
              </h2>
              
              <p className="text-slate-300 text-lg mb-10 max-w-sm leading-relaxed">
                Has completado tu perfil exitosamente. Ahora es momento de disfrutar de la comida y conseguir tus objetivos.
              </p>

              <Button
                onClick={handleNext}
                disabled={isSubmitting}
                className="w-full h-14 text-lg bg-green-600 hover:bg-green-700 text-white shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:shadow-[0_0_30px_rgba(34,197,94,0.5)] transition-all duration-300 group rounded-xl"
              >
                {isSubmitting ? "Finalizando..." : "Empezar a usar Bibofit"}
                {!isSubmitting && <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />}
              </Button>
            </motion.div>
          </div>
        </motion.div>
    </AnimatePresence>
  );
};

export default CompletionStep;