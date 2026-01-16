import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { CheckCircle2, ArrowRight, Loader2 } from 'lucide-react';
import { useTour } from '@/hooks/useTour';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';

const CompletionStep = () => {
  const navigate = useNavigate();
  const { closeOnboarding, startTourFromOnboarding } = useTour();
  const { completeOnboarding } = useOnboarding();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isStartingTour, setIsStartingTour] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    return () => { mounted.current = false; };
  }, []);

  const handleNext = async () => {
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
        // If it failed because it was already completed, we can safely proceed.
        // Otherwise, it's a real error.
        const isAlreadyCompleted = error?.code === 'ALREADY_COMPLETED';
        
        if (!isAlreadyCompleted) {
          throw error || new Error('No se pudo finalizar el onboarding.');
        } else {
          console.log('ℹ️ [CompletionStep] Onboarding was already completed. Proceeding...');
        }
      }

      // 2. Mark local state as complete (this closes the overlay)
      await completeOnboarding();

      // 3. Initialize Tour
      await startTourFromOnboarding();

      console.log('✅ [CompletionStep] Flow finished. Navigating to templates...');

      // 4. Navigate to templates
      navigate('/profile/templates');
      
    } catch (error) {
      console.error('❌ [CompletionStep] Error in completion flow:', error);
      toast({
        title: "Error",
        description: "Hubo un problema al finalizar. Por favor intenta de nuevo.",
        variant: "destructive"
      });
    } finally {
      if (mounted.current) {
        setIsStartingTour(false);
      }
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
        onClick={handleNext}
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
