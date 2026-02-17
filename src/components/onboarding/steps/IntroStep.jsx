import React from 'react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

const IntroStep = ({ onNext }) => {
  const handleClick = () => {
    onNext();
  };

  return (
    <div className="flex flex-col items-center justify-center h-full text-center space-y-8">
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="w-24 h-24 bg-gradient-to-br from-green-400 to-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-green-500/20"
      >
        <Sparkles className="w-12 h-12 text-white" />
      </motion.div>
      
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="space-y-4"
      >
        <h2 className="text-3xl font-bold text-white">
          ¡Hola! 👋
        </h2>
        <p className="text-gray-400 text-lg max-w-xs mx-auto">
          Vamos a configurar tu perfil en unos sencillos pasos para ofrecerte el mejor plan.
        </p>
      </motion.div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="w-full max-w-xs pt-8 mt-auto"
      >
        <Button 
          onClick={handleClick}
          size="lg" 
          className="w-full text-lg h-14 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg shadow-green-900/20"
        >
          Comenzar
        </Button>
      </motion.div>
    </div>
  );
};

export default IntroStep;