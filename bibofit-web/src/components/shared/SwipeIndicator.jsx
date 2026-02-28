import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, CalendarDays, Dumbbell } from 'lucide-react';

const AppleDietIcon = () => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className="w-4 h-4 text-emerald-50 drop-shadow-[0_0_10px_rgba(16,185,129,0.55)]"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M15.8 11.3c0-2.4 2-3.5 2.1-3.6-1.1-1.6-2.9-1.8-3.5-1.9-1.5-.2-2.9.8-3.6.8-.7 0-1.8-.8-3-.8-1.6 0-3 .9-3.8 2.2-1.6 2.7-.4 6.7 1.1 8.8.7 1 1.6 2.1 2.8 2.1 1.1 0 1.6-.7 3-.7s1.9.7 3 .7c1.2 0 2-1.1 2.7-2.1.8-1.1 1.2-2.2 1.2-2.3 0 0-2.1-.8-2.1-3.2Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M13.4 4.5c.6-.8.9-1.8.8-2.9-.9 0-2 .6-2.6 1.3-.5.6-.9 1.6-.8 2.6 1 0 2-.5 2.6-1Z"
      fill="currentColor"
      fillOpacity="0.95"
    />
  </svg>
);

const SwipeIndicator = ({ isSwiping, offset, label = 'Siguiente día', variant = 'bubble' }) => {
  // Calculate progress opacity based on offset (e.g. 0 to 1 over 100px)
  const progress = Math.min(offset / 100, 1);

  if (variant === 'diet-edge') {
    return (
      <AnimatePresence>
        {isSwiping && offset > 10 && (
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 0.35 + (progress * 0.65), x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.12 }}
            className="fixed right-0 top-0 h-screen z-50 w-4 sm:w-5 pointer-events-none"
          >
            <div className="relative h-full w-full overflow-hidden rounded-l-xl border-l border-emerald-200/40 bg-gradient-to-b from-emerald-300/85 via-green-500/75 to-emerald-400/85 shadow-[-10px_0_28px_rgba(16,185,129,0.35)]">
              <div className="absolute inset-y-0 left-0 w-px bg-white/55" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(167,243,208,0.32)_0%,rgba(16,185,129,0)_70%)]" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <AppleDietIcon />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  if (variant === 'calendar-edge') {
    return (
      <AnimatePresence>
        {isSwiping && offset > 10 && (
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 0.35 + (progress * 0.65), x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.12 }}
            className="fixed left-0 top-0 h-screen z-50 w-4 sm:w-5 pointer-events-none"
          >
            <div className="relative h-full w-full overflow-hidden rounded-r-xl border-r border-violet-200/35 bg-gradient-to-b from-slate-400/80 via-violet-500/70 to-slate-500/80 shadow-[10px_0_28px_rgba(139,92,246,0.28)]">
              <div className="absolute inset-y-0 right-0 w-px bg-white/45" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(196,181,253,0.30)_0%,rgba(139,92,246,0)_70%)]" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <CalendarDays className="w-4 h-4 text-violet-50 drop-shadow-[0_0_10px_rgba(139,92,246,0.5)]" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  if (variant === 'calendar-edge-right') {
    return (
      <AnimatePresence>
        {isSwiping && offset > 10 && (
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 0.35 + (progress * 0.65), x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.12 }}
            className="fixed right-0 top-0 h-screen z-50 w-4 sm:w-5 pointer-events-none"
          >
            <div className="relative h-full w-full overflow-hidden rounded-l-xl border-l border-violet-200/35 bg-gradient-to-b from-slate-400/80 via-violet-500/70 to-slate-500/80 shadow-[-10px_0_28px_rgba(139,92,246,0.28)]">
              <div className="absolute inset-y-0 left-0 w-px bg-white/45" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(196,181,253,0.30)_0%,rgba(139,92,246,0)_70%)]" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <CalendarDays className="w-4 h-4 text-violet-50 drop-shadow-[0_0_10px_rgba(139,92,246,0.5)]" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  if (variant === 'training-edge') {
    return (
      <AnimatePresence>
        {isSwiping && offset > 10 && (
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 0.35 + (progress * 0.65), x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.12 }}
            className="fixed left-0 top-0 h-screen z-50 w-4 sm:w-5 pointer-events-none"
          >
            <div className="relative h-full w-full overflow-hidden rounded-r-xl border-r border-red-200/35 bg-gradient-to-b from-rose-400/80 via-red-500/75 to-red-600/80 shadow-[10px_0_28px_rgba(239,68,68,0.35)]">
              <div className="absolute inset-y-0 right-0 w-px bg-white/45" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(254,202,202,0.30)_0%,rgba(239,68,68,0)_70%)]" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <Dumbbell className="w-4 h-4 text-rose-50 drop-shadow-[0_0_10px_rgba(239,68,68,0.45)]" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

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
              {label}
            </span>
            <div className="absolute inset-0 rounded-full border border-cyan-400/30 scale-110 animate-pulse" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SwipeIndicator;
