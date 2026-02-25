import React from 'react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

const IntroStep = ({ onNext }) => {
  const handleClick = () => {
    onNext();
  };

  return (
    <div className="flex flex-col items-center justify-center h-full text-center space-y-8 p-4">
      <motion.div 
        initial={{ scale: 0.5, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 0.6, type: 'spring', bounce: 0.4 }}
        className="w-24 h-24 bg-gradient-to-br from-green-500 to-emerald-700 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(34,197,94,0.4)] relative"
      >
        <div className="absolute inset-0 bg-green-500/20 blur-xl rounded-full scale-150 pointer-events-none"></div>
        <Sparkles className="w-12 h-12 text-white relative z-10" />
      </motion.div>
      
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
        className="space-y-4 relative z-10"
      >
        <h2 className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-200 drop-shadow-sm">
          ¡Hola!
        </h2>
        <p className="text-slate-300 text-lg max-w-sm mx-auto leading-relaxed">
          Vamos a configurar tu perfil en unos sencillos pasos para ofrecerte el mejor plan.
        </p>
      </motion.div>

      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
        className="w-full max-w-xs pt-8 mt-auto relative z-10"
      >
        <motion.div
          whileHover={{ scale: 1.03, translateY: -2 }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: "spring", stiffness: 400, damping: 10 }}
        >
          <Button 
            onClick={handleClick}
            size="lg" 
            className="w-full text-lg h-14 bg-green-600 hover:bg-green-700 text-white shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:shadow-[0_0_30px_rgba(34,197,94,0.5)] transition-all duration-300 rounded-xl group"
          >
            Comenzar
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default IntroStep;