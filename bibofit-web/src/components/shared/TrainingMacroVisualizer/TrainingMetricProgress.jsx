import React from 'react';
import { motion } from 'framer-motion';

const TrainingMetricProgress = ({ icon, name, actual, target, color, unit = '' }) => {
  const safeActual = Number.isFinite(Number(actual)) ? Number(actual) : 0;
  const safeTarget = Number.isFinite(Number(target)) && Number(target) > 0 ? Number(target) : 1;
  const rawPercentage = (safeActual / safeTarget) * 100;
  const barPercentage = Math.max(0, Math.min(rawPercentage, 100));

  const colorMap = {
    red: {
      text: 'text-red-400',
      gradientFrom: 'from-red-500',
      gradientTo: 'to-orange-400',
    },
    amber: {
      text: 'text-amber-400',
      gradientFrom: 'from-amber-500',
      gradientTo: 'to-yellow-400',
    },
    cyan: {
      text: 'text-cyan-400',
      gradientFrom: 'from-cyan-500',
      gradientTo: 'to-sky-400',
    },
  };

  const c = colorMap[color] || colorMap.red;

  return (
    <motion.div
      className="flex flex-col items-center justify-between gap-1 px-2 sm:px-4"
      initial={false}
      animate={{ paddingTop: 4, paddingBottom: 4 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
    >
      <div className="overflow-hidden flex items-center space-x-2 w-full justify-center">
        {icon}
        <span className={`font-semibold ${c.text}`}>{name}</span>
      </div>

      <div className="w-full text-center">
        <span className="text-xl font-bold text-foreground dark:text-white tabular-nums">{Math.round(safeActual)}</span>
        <span className="text-sm text-muted-foreground">
          {unit ? `${unit} / ${Math.round(safeTarget)}${unit}` : ` / ${Math.round(safeTarget)}`}
        </span>
      </div>

      <div className="w-full">
        <div className="relative h-5 w-full bg-muted/70 border border-border/60 rounded-full overflow-hidden flex items-center justify-center">
          <motion.div
            className={`absolute top-0 left-0 h-full bg-gradient-to-r ${c.gradientFrom} ${c.gradientTo} rounded-full`}
            initial={{ width: 0 }}
            animate={{ width: `${barPercentage}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
          <span className="relative text-xs font-bold text-slate-900 dark:text-white z-10 drop-shadow-sm">
            {Math.round(barPercentage)}%
          </span>
        </div>
      </div>
    </motion.div>
  );
};

export default TrainingMetricProgress;
