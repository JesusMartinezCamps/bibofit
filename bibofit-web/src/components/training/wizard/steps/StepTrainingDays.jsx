import React from 'react';
import { Button } from '@/components/ui/button';

const StepTrainingDays = ({ wizard, onNext }) => {
  const { cycleDays, setCycleDays, MIN_CYCLE_DAYS, MAX_CYCLE_DAYS } = wizard;

  const options = Array.from(
    { length: MAX_CYCLE_DAYS - MIN_CYCLE_DAYS + 1 },
    (_, i) => i + MIN_CYCLE_DAYS
  );

  const dayDescriptions = {
    1: 'Ideal para mantenimiento o inicio',
    2: 'Buena base para empezar',
    3: 'El mínimo recomendado para hipertrofia',
    4: 'Óptimo para la mayoría de objetivos',
    5: 'Alta frecuencia, buenos resultados',
    6: 'Para deportistas muy dedicados',
    7: 'Cada día activo, sin descanso',
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto pr-1">
        {/* Day pills */}
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-7">
          {options.map((count) => {
            const isSelected = cycleDays === count;
            return (
              <button
                key={count}
                type="button"
                onClick={() => setCycleDays(count)}
                className={`flex flex-col items-center justify-center rounded-2xl border py-5 gap-1 transition-all ${
                  isSelected
                    ? 'border-[#F44C40] bg-[#F44C40]/10 text-white'
                    : 'border-border bg-card/40 text-muted-foreground hover:border-border/80 hover:text-foreground'
                }`}
              >
                <span className={`text-3xl font-bold ${isSelected ? 'text-[#F44C40]' : ''}`}>
                  {count}
                </span>
                <span className="text-xs">{count === 1 ? 'día' : 'días'}</span>
              </button>
            );
          })}
        </div>

        {/* Description for selected */}
        {dayDescriptions[cycleDays] && (
          <p className="mt-5 text-sm text-muted-foreground text-center">
            {dayDescriptions[cycleDays]}
          </p>
        )}
      </div>

      <div className="pt-6 mt-auto shrink-0">
        <Button
          onClick={onNext}
          className="w-full h-12 text-base bg-[#F44C40] hover:bg-[#E23C32] text-white"
        >
          Siguiente
        </Button>
      </div>
    </div>
  );
};

export default StepTrainingDays;
