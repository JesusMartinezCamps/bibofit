
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { CheckCircle2, ArrowRight, Loader2 } from 'lucide-react';
import { useTour } from '@/hooks/useTour';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';

const CompletionStep = () => {
  const navigate = useNavigate();
  const { closeOnboarding } = useTour();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isStartingTour, setIsStartingTour] = useState(false);

  const handleStartTour = async () => {
    if (!user) {
      toast({
        title: "Error",
        description: "No se encontró sesión de usuario.",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log('🚀 [CompletionStep] Starting completion flow...');
      setIsStartingTour(true);

      // 1. Call closeOnboarding to mark onboarding as complete in DB
      const { success, error } = await closeOnboarding();

      if (!success) {
        throw error || new Error('No se pudo finalizar el onboarding.');
      }

      console.log('✅ [CompletionStep] Onboarding completed. Navigating to templates...');

      // 2. Only navigate if successful
      navigate('/profile/templates');
      
    } catch (error) {
      console.error('❌ [CompletionStep] Error in completion flow:', error);
      toast({
        title: "Error",
        description: "Hubo un problema al finalizar. Por favor intenta de nuevo.",
        variant: "destructive"
      });
    } finally {
      setIsStartingTour(false);
    }
  };

  return (
    <div className="flex flex-col h-full items-center justify-center text-center p-4">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, type: 'spring' }}
        className="mb-8"
      >
        <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-12 h-12 text-green-500" />
        </div>
      </motion.div>

      <h2 className="text-3xl font-bold text-white mb-4">
        ¡Todo listo!
      </h2>
      
      <p className="text-gray-400 text-lg mb-12 max-w-sm">
        Has completado tu perfil exitosamente. Ahora es momento de elegir el plan de alimentación perfecto para ti.
      </p>

      <Button
        onClick={handleStartTour}
        disabled={isStartingTour}
        className="w-full h-14 text-lg bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-900/20 group"
      >
        {isStartingTour ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Preparando...
          </>
        ) : (
          <>
            Selecciona tu primera dieta
            <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </>
        )}
      </Button>
    </div>
  );
};

export default CompletionStep;
