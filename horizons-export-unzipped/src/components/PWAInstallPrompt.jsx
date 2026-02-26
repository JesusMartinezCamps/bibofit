
import React from 'react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { usePWAInstallPrompt } from '@/hooks/usePWAInstallPrompt';

const PWAInstallPrompt = () => {
  const { showPrompt, handleInstall, handleDismiss } = usePWAInstallPrompt();

  return (
    <AnimatePresence>
      {showPrompt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          {/* Dark translucent overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          
          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-[90%] max-w-sm bg-gray-900 border border-gray-700 shadow-2xl rounded-2xl py-8 px-6 text-center overflow-hidden"
          >
            {/* Background glow effect */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

            <div className="relative">
              <div className="mx-auto w-20 h-20 bg-gradient-to-br from-green-500/10 to-emerald-600/10 rounded-full flex items-center justify-center mb-6 shadow-inner border border-emerald-500/20">
                {/* Custom Fire Logo */}
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  viewBox="0 0 24 24" 
                  className="w-12 h-12 drop-shadow-md"
                >
                  <defs>
                    <linearGradient id="pwaFlameGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="50%" stopColor="#059669" />
                      <stop offset="100%" stopColor="#047857" />
                    </linearGradient>
                  </defs>
                  <g transform="translate(4, 2) scale(0.666)">
                    <path fill="url(#pwaFlameGrad)" d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
                  </g>
                </svg>
              </div>
              
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 tracking-tight">
                Install Bibofit on your device
              </h2>
              
              <p className="text-gray-300 text-sm sm:text-base mb-8 leading-relaxed">
                Añade la app a tu pantalla de inicio para disfrutar de una experiencia nativa, más rápida, sin distracciones y con acceso offline.
              </p>
              
              <div className="flex flex-col gap-3 w-full">
                <Button 
                  size="lg" 
                  onClick={handleInstall} 
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold text-lg py-6 rounded-xl shadow-lg shadow-green-900/20 transition-all active:scale-[0.98]"
                >
                  Instalar ahora
                </Button>
                <Button 
                  size="lg" 
                  variant="outline" 
                  onClick={handleDismiss} 
                  className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 border-gray-700 font-medium py-6 rounded-xl transition-all active:scale-[0.98]"
                >
                  Cerrar
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default PWAInstallPrompt;
