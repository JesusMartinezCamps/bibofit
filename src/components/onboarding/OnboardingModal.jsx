import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Lightbulb, Video, CheckCircle } from 'lucide-react';

const OnboardingModal = ({ 
  title = '', 
  description = '', 
  videoUrl = null, 
  tips = [], 
  onNext = () => {} 
}) => {
  // Ensure tips is always an array to prevent mapping errors
  const safeTips = Array.isArray(tips) ? tips : [];

  // Lock scroll specifically for this modal, adding an extra layer of safety
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
        // We don't necessarily want to unlock here if the wizard itself is still open,
        // but the wizard's effect handles the overall state.
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-lg bg-[#1a1e23] border border-green-800/30 rounded-2xl shadow-2xl overflow-hidden ring-1 ring-white/10 z-[10000] relative"
      >
        <div className="relative p-6 sm:p-8">
          {/* Decorative background element */}
          <div className="absolute top-0 right-0 -mt-16 -mr-16 w-32 h-32 bg-green-500/20 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 space-y-6">
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-white tracking-tight">
                {title}
              </h3>
              <p className="text-gray-400 text-base leading-relaxed">
                {description}
              </p>
            </div>

            {videoUrl && (
              <div className="relative aspect-video rounded-xl overflow-hidden bg-black/50 border border-white/10 group cursor-pointer hover:border-green-500/50 transition-colors">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-green-600/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <Video className="w-5 h-5 text-white ml-1" />
                  </div>
                </div>
                {/* Placeholder for actual video implementation */}
                <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 opacity-50" />
                <p className="absolute bottom-3 left-3 text-xs font-medium text-white/80 bg-black/60 px-2 py-1 rounded">
                  Ver tutorial
                </p>
              </div>
            )}

            {safeTips.length > 0 && (
              <div className="bg-green-500/5 border border-green-500/10 rounded-xl p-4 space-y-3">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-green-400">
                  <Lightbulb className="w-4 h-4" />
                  Consejos Útiles
                </h4>
                <div className="grid gap-2">
                  {safeTips.map((tip, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm text-gray-300">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500/50 mt-1.5 shrink-0" />
                      <span>{tip}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-4 flex justify-end">
              <Button 
                onClick={onNext}
                size="lg"
                className="w-full sm:w-auto bg-green-600 hover:bg-green-500 text-white font-semibold shadow-lg shadow-green-900/20"
              >
                Entendido
                <CheckCircle className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default OnboardingModal;