import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Footprints, ArrowLeft } from 'lucide-react';
import { format, parseISO, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { getDailyStepsInRange, upsertDailySteps } from '@/lib/training/trainingAnalyticsService';
import { getDateKey } from '@/lib/training/dateUtils';
import { cn } from '@/lib/utils';

const StepsLogDialog = ({ onClose, initialDate }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [stepsInput, setStepsInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [history, setHistory] = useState([]);

  const targetDate = initialDate ?? new Date();
  const targetDateKey = getDateKey(targetDate);
  const startKey = getDateKey(subDays(targetDate, 13)); // last 14 days from target

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const rows = await getDailyStepsInRange({
        userId: user.id,
        startDate: startKey,
        endDate: targetDateKey,
      });
      const targetRow = rows.find((r) => r.step_date === targetDateKey);
      setStepsInput(targetRow ? String(targetRow.steps) : '');
      setHistory([...rows].sort((a, b) => b.step_date.localeCompare(a.step_date)));
    } catch (e) {
      console.error('Error loading steps:', e);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, startKey, targetDateKey]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async () => {
    if (!user?.id) return;
    setIsSaving(true);
    try {
      const safeSteps = Math.max(0, parseInt(String(stepsInput || 0), 10) || 0);
      await upsertDailySteps({ userId: user.id, stepDate: targetDateKey, steps: safeSteps, source: 'manual' });
      toast({ title: 'Pasos guardados', description: 'El registro se actualizó correctamente.', variant: 'success' });
      onClose();
    } catch (e) {
      toast({ title: 'Error al guardar', description: e?.message || 'Inténtalo de nuevo.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const dayLabel = format(targetDate, "d 'de' MMMM", { locale: es });

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col min-h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 pb-2">
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors p-1 -ml-1"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <Footprints className="h-5 w-5 text-cyan-500" />
          <h1 className="text-lg font-bold text-foreground">Pasos · {dayLabel}</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Input del día */}
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4 space-y-3">
          <p className="text-sm font-semibold text-cyan-700 dark:text-cyan-300 capitalize">{dayLabel}</p>
          <div className="relative">
            <Footprints className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-500" />
            <Input
              autoFocus
              inputMode="numeric"
              className="pl-10"
              value={stepsInput}
              onChange={(e) => setStepsInput(e.target.value.replace(/[^\d]/g, ''))}
              placeholder="Ej: 8500"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
              }}
            />
          </div>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="w-full h-11 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
          </Button>
        </div>

        {/* Historial */}
        <div className="space-y-2">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Últimos registros</h2>
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Sin registros en los últimos 14 días
            </p>
          ) : (
            history.map((row) => {
              const isTarget = row.step_date === targetDateKey;
              return (
                <div
                  key={row.id}
                  className={cn(
                    'flex items-center justify-between rounded-lg border px-3 py-2.5',
                    isTarget
                      ? 'border-cyan-500/40 bg-cyan-500/10'
                      : 'border-border bg-muted/30'
                  )}
                >
                  <p className="text-xs text-muted-foreground capitalize">
                    {format(parseISO(row.step_date), "EEEE, d 'de' MMMM", { locale: es })}
                    {isTarget && (
                      <span className="ml-1.5 text-cyan-500 font-semibold">· Este día</span>
                    )}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <Footprints className="h-3.5 w-3.5 text-cyan-500/70" />
                    <span className="text-sm font-bold text-foreground tabular-nums">
                      {Number(row.steps).toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default StepsLogDialog;
