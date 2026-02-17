import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

const LoadingScreen = ({ message = "Cargando..." }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
    >
      <div className="flex flex-col items-center justify-center space-y-4 p-6 text-center">
        <div className="relative">
          <div className="absolute inset-0 border-4 border-green-500/30 rounded-full h-16 w-16"></div>
          <div className="absolute inset-0 border-t-4 border-green-500 rounded-full animate-spin h-16 w-16"></div>
          <Loader2 className="h-16 w-16 text-green-500 animate-pulse opacity-0" /> {/* Hidden icon for spacing/fallback */}
        </div>
        <h2 className="text-xl font-semibold text-white animate-pulse">
          {message}
        </h2>
      </div>
    </motion.div>
  );
};

export default LoadingScreen;