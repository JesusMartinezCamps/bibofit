import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RotateCcw, BookOpen, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useContextualGuide } from '@/contexts/ContextualGuideContext';
import { GUIDE_BLOCKS } from '@/config/guideBlocks';
import GuideIcon from '@/components/contextual-guide/GuideIcon';
import { useNavigate, useLocation } from 'react-router-dom';

// Group blocks by section
const SECTIONS = GUIDE_BLOCKS.reduce((acc, block) => {
  if (!acc[block.section]) acc[block.section] = [];
  acc[block.section].push(block);
  return acc;
}, {});

const SECTION_ORDER = ['Inicio', 'Dieta', 'Recetas', 'Compra', 'Progreso', 'Comunidad'];

const GuideHelpCenter = () => {
  const {
    isHelpCenterOpen,
    closeHelpCenter,
    seenBlocks,
    replayBlock,
    resetBlock,
  } = useContextualGuide();
  const navigate = useNavigate();
  const location = useLocation();

  const handleReplay = (block) => {
    closeHelpCenter();
    if (block.route && location.pathname !== block.route) {
      navigate(block.route);
      setTimeout(() => replayBlock(block.id), 300);
    } else {
      replayBlock(block.id);
    }
  };

  const handleResetAll = async () => {
    await resetBlock(null);
  };

  const seenCount = seenBlocks.size;
  const totalCount = GUIDE_BLOCKS.length;

  return (
    <AnimatePresence>
      {isHelpCenterOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="help-backdrop"
            className="fixed inset-0 z-[9100] bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeHelpCenter}
          />

          {/* Panel */}
          <motion.div
            key="help-panel"
            className="fixed inset-x-0 bottom-0 z-[9101] max-h-[92dvh] bg-background rounded-t-2xl flex flex-col overflow-hidden shadow-2xl"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 350, damping: 35 }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-3 shrink-0 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <BookOpen className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">Centro de Ayuda</h2>
                  <p className="text-xs text-muted-foreground">
                    {seenCount}/{totalCount} secciones completadas
                  </p>
                </div>
              </div>
              <button
                onClick={closeHelpCenter}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Progress bar */}
            <div className="px-5 py-3 shrink-0">
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-green-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${(seenCount / totalCount) * 100}%` }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                />
              </div>
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto flex-1 px-5 pb-6 space-y-6">
              {SECTION_ORDER.filter((s) => SECTIONS[s]).map((sectionName) => (
                <div key={sectionName}>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    {sectionName}
                  </h3>
                  <div className="space-y-2">
                    {SECTIONS[sectionName].map((block) => {
                      const seen = seenBlocks.has(block.id);
                      return (
                        <button
                          key={block.id}
                          onClick={() => handleReplay(block)}
                          className="w-full flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:bg-accent transition-colors cursor-pointer text-left"
                        >
                          {/* Icon + seen indicator */}
                          <div className="relative shrink-0 w-8 h-8 flex items-center justify-center">
                            <GuideIcon icon={block.icon} />
                            {seen && (
                              <span className="absolute -bottom-1 -right-1 text-green-500">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              </span>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {block.title}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {block.steps.length}{' '}
                              {block.steps.length === 1 ? 'paso' : 'pasos'} · {seen ? 'Repasar' : 'Ver guía'}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Reset all */}
              <div className="pt-2 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetAll}
                  className="w-full gap-2 text-muted-foreground border-dashed"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reiniciar todas las guías
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default GuideHelpCenter;
