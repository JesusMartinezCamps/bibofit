import React from 'react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboarding } from '@/hooks/useOnboarding';

const CompletionStep = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { completeOnboarding } = useOnboarding();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleNext = async () => {
    if (!user) return;
    setIsSubmitting(true);

    try {
      await completeOnboarding();
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
        disabled={isSubmitting}
        className="w-full h-14 text-lg bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-900/20 group"
      >
        {isSubmitting ? "Finalizando..." : "Selecciona tu primera dieta"}
        {!isSubmitting && <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />}
      </Button>
    </div>
  );
};

export default CompletionStep;