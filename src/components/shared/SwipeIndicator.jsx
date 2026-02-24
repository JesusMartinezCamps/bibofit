
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';

const SwipeIndicator = ({ isSwiping, offset }) => {
  // Calculate progress opacity based on offset (e.g. 0 to 1 over 100px)
  const progress = Math.min(offset / 100, 1);

  return (
    <AnimatePresence>
      {isSwiping && offset > 10 && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: progress, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.1 }}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-50 flex items-center justify-center p-4 pointer-events-none"
        >
          <div className="bg-slate-800/80 rounded-full p-3 backdrop-blur-md border border-slate-700 shadow-xl flex items-center gap-2">
            <ChevronLeft className="text-cyan-400 w-6 h-6" />
            <span className="text-cyan-400 font-medium text-sm pr-2 opacity-80">
              Siguiente día
            </span>
            <div className="absolute inset-0 rounded-full border border-cyan-400/30 scale-110 animate-pulse" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SwipeIndicator;
