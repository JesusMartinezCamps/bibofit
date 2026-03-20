import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DAY_TYPE_OPTIONS, getDayTypeLabel } from '@/hooks/useCreateRoutineWizard';

// Emoji icon per day type for visual preview
const DAY_TYPE_EMOJI = {
  torso: '💪',
  pierna: '🦵',
  fullbody: '🏋️',
  push: '↗️',
  pull: '↙️',
  core: '🔥',
  cardio: '🏃',
  movilidad: '🧘',
  custom: '⚙️',
};

const StepCalendar = ({ wizard, onNext }) => {
  const { dayBlueprint, updateDayPrimaryType, cycleDays } = wizard;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 space-y-4 overflow-y-auto pr-1">
        {/* Day selectors */}
        <div className="space-y-3">
          {dayBlueprint.map((day, dayIdx) => {
            const type = day.blocks?.[0]?.type || 'custom';
            return (
              <div
                key={`cal-day-${dayIdx}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-card/40 px-4 py-2.5"
              >
                <div className="flex items-center gap-2 w-16 shrink-0">
                  <span className="text-lg">{DAY_TYPE_EMOJI[type] || '⚙️'}</span>
                  <Label className="text-sm font-semibold text-white">
                    Día {dayIdx + 1}
                  </Label>
                </div>
                <div className="flex-1">
                  <Select
                    value={type}
                    onValueChange={(value) => updateDayPrimaryType(dayIdx, value)}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAY_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })}
        </div>

        {/* Visual week preview */}
        <div className="rounded-xl border border-border bg-background/40 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-3">
            Vista previa de la semana
          </p>
          <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${cycleDays}, minmax(0, 1fr))` }}>
            {dayBlueprint.map((day, dayIdx) => {
              const type = day.blocks?.[0]?.type || 'custom';
              return (
                <div
                  key={`preview-${dayIdx}`}
                  className="flex flex-col items-center gap-1 rounded-lg bg-card/60 border border-border/60 py-2"
                >
                  <span className="text-base">{DAY_TYPE_EMOJI[type] || '⚙️'}</span>
                  <span className="text-[10px] text-muted-foreground font-medium">Día {dayIdx + 1}</span>
                  <span className="text-[9px] text-muted-foreground/70 text-center leading-tight px-0.5">
                    {getDayTypeLabel(type)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="pt-6 mt-auto shrink-0">
        <Button
          onClick={onNext}
          className="w-full h-12 text-base bg-[#F44C40] hover:bg-[#E23C32] text-white"
        >
          Confirmar distribución
        </Button>
      </div>
    </div>
  );
};

export default StepCalendar;
