import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useContextualGuide } from '@/contexts/ContextualGuideContext';
import GuideIcon from '@/components/contextual-guide/GuideIcon';
import { useNavigate } from 'react-router-dom';

/**
 * ContextualGuideTooltip
 *
 * Floating card at the bottom of the viewport.
 * The backdrop blocks all interaction with the app while the guide is open —
 * the user must interact with the card (X to close, or navigate steps).
 *
 * If activeBlock.completeRoute is set, "Entendido" navigates there after marking seen.
 */
const ContextualGuideTooltip = () => {
  const {
    isOpen,
    activeBlock,
    currentStep,
    nextStep,
    prevStep,
    completeBlock,
    closeBlock,
  } = useContextualGuide();
  const navigate = useNavigate();

  const handleComplete = async () => {
    const route = activeBlock?.completeRoute;
    await completeBlock();
    if (route) navigate(route);
  };

  if (!isOpen || !activeBlock) return null;

  const step = activeBlock.steps[currentStep];
  const totalSteps = activeBlock.steps.length;
  const isLast = currentStep === totalSteps - 1;
  const isFirst = currentStep === 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop — pointer-events-auto blocks all interaction outside the card */}
          <motion.div
            key="guide-backdrop"
            className="fixed inset-0 z-[9000] bg-black/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />

          {/* Floating card */}
          <motion.div
            key="guide-card"
            className="fixed bottom-0 left-0 right-0 z-[9001] px-4 pb-6 pt-2 flex justify-center pointer-events-none"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            <div className="pointer-events-auto w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
              {/* Top bar: block title + close */}
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {activeBlock.title}
                </span>
                <div className="flex items-center gap-3">
                  {/* Step dots */}
                  <div className="flex gap-1.5">
                    {activeBlock.steps.map((_, i) => (
                      <div
                        key={i}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          i === currentStep
                            ? 'w-4 bg-green-500'
                            : i < currentStep
                            ? 'w-1.5 bg-green-500/40'
                            : 'w-1.5 bg-muted'
                        }`}
                      />
                    ))}
                  </div>
                  <button
                    onClick={closeBlock}
                    className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-accent"
                    aria-label="Cerrar guía"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Step content */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.18 }}
                  className="px-4 pb-4"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    {step.icon && <GuideIcon icon={step.icon} />}
                    <h3 className="text-base font-semibold text-foreground">
                      {step.title}
                    </h3>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {step.content}
                  </p>
                </motion.div>
              </AnimatePresence>

              {/* Navigation */}
              <div className="flex items-center justify-between gap-3 px-4 pb-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={prevStep}
                  disabled={isFirst}
                  className="text-muted-foreground"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Anterior
                </Button>

                <span className="text-xs text-muted-foreground tabular-nums">
                  {currentStep + 1} / {totalSteps}
                </span>

                {isLast ? (
                  <Button
                    size="sm"
                    onClick={handleComplete}
                    className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Entendido
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={nextStep}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    Siguiente
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ContextualGuideTooltip;
