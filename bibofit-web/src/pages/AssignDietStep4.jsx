import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

const AssignDietStep4 = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] w-full max-w-2xl mx-auto px-4 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full space-y-8"
      >
        <div className="relative w-24 h-24 mx-auto">
             <div className="absolute inset-0 border-4 border-green-500/30 rounded-full"></div>
             <div className="absolute inset-0 border-t-4 border-green-500 rounded-full animate-spin"></div>
             <Loader2 className="absolute inset-0 m-auto w-10 h-10 text-green-500 animate-pulse" />
        </div>
        <div>
            <h1 className="text-2xl font-bold text-white mb-2">
                Navegando al Plan...
            </h1>
            <p className="text-gray-400">
                Tu dieta ha sido creada. Redirigiendo...
            </p>
        </div>
      </motion.div>
    </div>
  );
};

export default AssignDietStep4;