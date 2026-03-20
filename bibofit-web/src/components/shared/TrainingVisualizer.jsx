import React from 'react';
import { motion } from 'framer-motion';
import { Activity, Footprints, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

const TRAINING_ACCENT = '#F44C40';

const ProgressBar = ({ label, value, target, icon, colorClass }) => {
  const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0;
  const safeTarget = Number.isFinite(Number(target)) && Number(target) > 0 ? Number(target) : 1;
  const pct = Math.max(0, Math.min((safeValue / safeTarget) * 100, 100));

  return (
    <div className="rounded-lg border border-border/70 bg-card/70 p-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <span className="text-[11px] text-muted-foreground">
          {Math.round(safeValue)} / {Math.round(safeTarget)}
        </span>
      </div>
      <div className="relative h-4 w-full overflow-hidden rounded-full border border-border/60 bg-muted/70">
        <motion.div
          className={cn('absolute left-0 top-0 h-full rounded-full', colorClass)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
        <span className="relative z-10 flex h-full items-center justify-center text-[10px] font-bold text-slate-900 dark:text-white">
          {Math.round(pct)}%
        </span>
      </div>
    </div>
  );
};

const TrainingVisualizer = ({
  isSticky = false,
  volumeValue = 0,
  volumeTarget = 0,
  prValue = 0,
  prTarget = 0,
  stepValue = 0,
  stepTarget = 70000,
}) => (
  <div
    className={cn(
      'space-y-3 rounded-xl transition-all duration-300',
      isSticky
        ? 'sticky !top-0 z-40 rounded-b-2xl border-b border-x border-border bg-card/95 p-3 shadow-xl backdrop-blur-md'
        : 'border border-border bg-card/85 p-3 shadow-sm'
    )}
  >
    <div className="flex items-center justify-between">
      <p className="text-sm font-semibold text-foreground">Visualizador de progreso</p>
      <span className="text-[11px] text-muted-foreground">Semanal</span>
    </div>

    <div className="space-y-2">
      <ProgressBar
        label="Volumen por músculo"
        value={volumeValue}
        target={volumeTarget}
        icon={<Activity className="h-3.5 w-3.5" style={{ color: TRAINING_ACCENT }} />}
        colorClass="bg-gradient-to-r from-[#F44C40] to-[#FF7A61]"
      />
      <ProgressBar
        label="Marcas de fuerza (PR)"
        value={prValue}
        target={prTarget}
        icon={<Trophy className="h-3.5 w-3.5 text-amber-500" />}
        colorClass="bg-gradient-to-r from-amber-500 to-yellow-400"
      />
      <ProgressBar
        label="Pasos"
        value={stepValue}
        target={stepTarget}
        icon={<Footprints className="h-3.5 w-3.5 text-cyan-500" />}
        colorClass="bg-gradient-to-r from-cyan-500 to-sky-400"
      />
    </div>
  </div>
);

export default TrainingVisualizer;
