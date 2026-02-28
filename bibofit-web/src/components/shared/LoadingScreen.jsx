import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DietAssignmentLoadingAnimation from './DietAssignmentLoadingAnimation';

const LoadingScreen = ({ 
  isVisible = true, 
  message = "¡Calculando tu dieta personalizada! 🔥",
  submessage = "Preparando tus macros..."
}) => {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-br from-[#1a0b2e] via-[#0f172a] to-[#0a192f] overflow-hidden"
        >
          {/* Subtle background glow */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-green-900/20 via-transparent to-transparent opacity-60"></div>
          
          <div className="relative z-10 flex flex-col items-center justify-center w-full max-w-md p-8">
            <DietAssignmentLoadingAnimation />
            
            <motion.div 
              className="mt-12 text-center"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              <motion.h2 
                className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-200 drop-shadow-sm mb-3"
                animate={{ opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                {message}
              </motion.h2>
              <p className="text-slate-400 text-sm md:text-base animate-pulse">
                {submessage}
              </p>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LoadingScreen;