import React from 'react';
import { Activity, Footprints, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import TrainingMetricProgress from './TrainingMetricProgress';

const TrainingMacroVisualizer = ({
  volumeValue = 0,
  volumeTarget = 0,
  prValue = 0,
  prTarget = 1,
  stepValue = 0,
  stepTarget = 70000,
  muscleProgressRows = [],
  isSticky = false,
}) => (
  <div
    className={cn(
      'space-y-4 sm:space-y-6 transition-all duration-300',
      isSticky
        ? 'sticky !top-0 z-40 p-3 sm:p-4 bg-card/95 backdrop-blur-md rounded-b-2xl border-b border-x border-border shadow-xl [filter:drop-shadow(0_4px_6px_rgb(0_0_0/28%))]'
        : 'bg-card/85 border border-border shadow-sm p-3 sm:p-6 rounded-xl'
    )}
  >
    <div className="grid grid-cols-3 gap-2 sm:gap-4">
      <TrainingMetricProgress
        icon={<Activity className="w-5 h-5 text-red-400" />}
        name="Volumen"
        actual={volumeValue}
        target={volumeTarget}
        color="red"
        unit="s"
      />
      <TrainingMetricProgress
        icon={<Trophy className="w-5 h-5 text-amber-400" />}
        name="PRs"
        actual={prValue}
        target={prTarget}
        color="amber"
      />
      <TrainingMetricProgress
        icon={<Footprints className="w-5 h-5 text-cyan-400" />}
        name="Pasos"
        actual={stepValue}
        target={stepTarget}
        color="cyan"
      />
    </div>

    {muscleProgressRows.length ? (
      <div className="rounded-xl border border-border/70 bg-muted/35 p-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Progreso por grupo muscular
        </p>
        <div className="space-y-1.5">
          {muscleProgressRows.slice(0, 4).map((row) => (
            <div key={row.id} className="flex items-center justify-between text-xs">
              <span className="truncate text-foreground">{row.label}</span>
              <span className="text-muted-foreground">
                {Math.round(row.actual * 10) / 10} / {Math.round(row.target * 10) / 10} s
              </span>
            </div>
          ))}
        </div>
      </div>
    ) : null}
  </div>
);

export default TrainingMacroVisualizer;
