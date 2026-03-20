import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, CheckCircle2, Bot } from 'lucide-react';
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
  const [spotlightRect, setSpotlightRect] = useState(null);
  const [cardPlacement, setCardPlacement] = useState('bottom');
  const cardRef = useRef(null);

  const step = activeBlock?.steps?.[currentStep];
  const targetId = step?.targetId;
  const preferredCardPlacement = step?.cardPlacement;
  const actionPreview = step?.actionPreview;

  const resolveTargetElement = useMemo(
    () => () => {
      if (!targetId) return null;

      const byId = document.getElementById(targetId);
      if (byId) return byId;

      const candidates = Array.from(document.querySelectorAll(`[data-guide-target="${targetId}"]`));
      if (candidates.length === 0) return null;

      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

      let bestCandidate = null;
      let bestScore = 0;

      candidates.forEach((candidate) => {
        const rect = candidate.getBoundingClientRect();
        const isVisible = rect.width > 0 && rect.height > 0;
        if (!isVisible) return;

        const clippedWidth = Math.max(0, Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0));
        const clippedHeight = Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0));
        const intersectionArea = clippedWidth * clippedHeight;
        if (intersectionArea > bestScore) {
          bestScore = intersectionArea;
          bestCandidate = candidate;
        }
      });

      return bestCandidate;
    },
    [targetId]
  );

  useEffect(() => {
    if (!isOpen || !targetId) {
      setSpotlightRect(null);
      return undefined;
    }

    const updateSpotlightRect = () => {
      const element = resolveTargetElement();
      if (!element) {
        setSpotlightRect(null);
        return;
      }

      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        setSpotlightRect(null);
        return;
      }

      const padding = 8;
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const left = Math.max(0, rect.left - padding);
      const top = Math.max(0, rect.top - padding);
      const right = Math.min(viewportWidth, rect.right + padding);
      const bottom = Math.min(viewportHeight, rect.bottom + padding);

      setSpotlightRect({
        left,
        top,
        width: Math.max(0, right - left),
        height: Math.max(0, bottom - top),
      });
    };

    updateSpotlightRect();

    const handleWindowUpdate = () => updateSpotlightRect();
    window.addEventListener('resize', handleWindowUpdate);
    window.addEventListener('scroll', handleWindowUpdate, true);

    const observer = new MutationObserver(() => updateSpotlightRect());
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'data-guide-target', 'id'],
    });

    return () => {
      window.removeEventListener('resize', handleWindowUpdate);
      window.removeEventListener('scroll', handleWindowUpdate, true);
      observer.disconnect();
    };
  }, [currentStep, isOpen, resolveTargetElement, targetId]);

  useEffect(() => {
    if (!isOpen) return;
    if (preferredCardPlacement === 'top' || preferredCardPlacement === 'bottom') {
      setCardPlacement(preferredCardPlacement);
      return;
    }
    setCardPlacement('bottom');
  }, [currentStep, isOpen, preferredCardPlacement]);

  useEffect(() => {
    if (!isOpen) return;
    if (preferredCardPlacement === 'top' || preferredCardPlacement === 'bottom') {
      setCardPlacement(preferredCardPlacement);
      return;
    }
    if (!spotlightRect || !cardRef.current) return;

    const frame = requestAnimationFrame(() => {
      if (!cardRef.current) return;
      const cardRect = cardRef.current.getBoundingClientRect();

      const spotlightRight = spotlightRect.left + spotlightRect.width;
      const spotlightBottom = spotlightRect.top + spotlightRect.height;
      const overlapsSpotlight = !(
        cardRect.right < spotlightRect.left ||
        cardRect.left > spotlightRight ||
        cardRect.bottom < spotlightRect.top ||
        cardRect.top > spotlightBottom
      );

      if (overlapsSpotlight && cardPlacement === 'bottom') {
        setCardPlacement('top');
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [cardPlacement, isOpen, preferredCardPlacement, spotlightRect]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    if (isOpen) {
      document.body.setAttribute('data-contextual-guide-open', 'true');
    } else {
      document.body.removeAttribute('data-contextual-guide-open');
    }

    return () => {
      document.body.removeAttribute('data-contextual-guide-open');
    };
  }, [isOpen]);

  const stopGuideEvent = (event) => {
    if (!event) return;
    event.stopPropagation();
  };

  const handleComplete = async (event) => {
    stopGuideEvent(event);
    const route = activeBlock?.completeRoute;
    await completeBlock();
    if (route) navigate(route);
  };

  if (!isOpen || !activeBlock) return null;

  const totalSteps = activeBlock.steps.length;
  const isLast = currentStep === totalSteps - 1;
  const isFirst = currentStep === 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {spotlightRect ? (
            <>
              {/* Backdrop with spotlight cutout */}
              <motion.div
                key="guide-backdrop-top"
                className="fixed z-[11000] bg-black/45 pointer-events-auto"
                style={{ top: 0, left: 0, right: 0, height: spotlightRect.top }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
              <motion.div
                key="guide-backdrop-left"
                className="fixed z-[11000] bg-black/45 pointer-events-auto"
                style={{ top: spotlightRect.top, left: 0, width: spotlightRect.left, height: spotlightRect.height }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
              <motion.div
                key="guide-backdrop-right"
                className="fixed z-[11000] bg-black/45 pointer-events-auto"
                style={{
                  top: spotlightRect.top,
                  left: spotlightRect.left + spotlightRect.width,
                  right: 0,
                  height: spotlightRect.height,
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
              <motion.div
                key="guide-backdrop-bottom"
                className="fixed z-[11000] bg-black/45 pointer-events-auto"
                style={{
                  top: spotlightRect.top + spotlightRect.height,
                  left: 0,
                  right: 0,
                  bottom: 0,
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />

              {/* Transparent blocker keeps highlighted area non-clickable */}
              <div
                className="fixed z-[11000] pointer-events-auto"
                style={{
                  left: spotlightRect.left,
                  top: spotlightRect.top,
                  width: spotlightRect.width,
                  height: spotlightRect.height,
                }}
              />

              {/* Highlight ring */}
              <motion.div
                key="guide-spotlight-ring"
                className="fixed z-[11000] rounded-xl border-2 border-primary/80 shadow-[0_0_0_9999px_rgba(0,0,0,0)] pointer-events-none"
                style={{
                  left: spotlightRect.left,
                  top: spotlightRect.top,
                  width: spotlightRect.width,
                  height: spotlightRect.height,
                }}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
              />
            </>
          ) : (
            <motion.div
              key="guide-backdrop"
              className="fixed inset-0 z-[11000] bg-black/30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />
          )}

          {/* Floating card */}
          <motion.div
            key="guide-card"
            className={`fixed left-0 right-0 z-[11001] px-4 flex justify-center pointer-events-none ${
              cardPlacement === 'top' ? 'top-0 pt-6 pb-2' : 'bottom-0 pt-2 pb-6'
            }`}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            <div
              ref={cardRef}
              onClick={stopGuideEvent}
              className="pointer-events-auto w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
            >
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
                    type="button"
                    onClick={(event) => {
                      stopGuideEvent(event);
                      closeBlock();
                    }}
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
                  {actionPreview?.type === 'autobalance' && (
                    <div className="mt-3">
                      <Button
                        type="button"
                        variant="outline"
                        disabled
                        className="w-full bg-muted border-cyan-500 bg-cyan-400/10 text-cyan-100 mt-1 opacity-100 cursor-default pointer-events-none shadow-[0_0_0_1px_rgba(34,211,238,0.5),0_0_25px_rgba(34,211,238,0.35)]"
                      >
                        <Bot className="w-4 h-4 mr-2" />
                        {actionPreview.label || 'Autocuadrar Macros'}
                      </Button>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Navigation */}
              <div className="flex items-center justify-between gap-3 px-4 pb-4">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={(event) => {
                    stopGuideEvent(event);
                    prevStep();
                  }}
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
                    type="button"
                    size="sm"
                    onClick={handleComplete}
                    className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Entendido
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    onClick={(event) => {
                      stopGuideEvent(event);
                      nextStep();
                    }}
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
