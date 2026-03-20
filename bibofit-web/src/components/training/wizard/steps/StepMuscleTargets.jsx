import React from 'react';
import { Button } from '@/components/ui/button';
import MuscleSearchSelector from '../MuscleSearchSelector';

const StepMuscleTargets = ({ wizard, onNext }) => {
  const {
    muscleOptions,
    muscleTargetInputs,
    setMuscleTarget,
    removeMuscleTarget,
  } = wizard;

  const selectedCount = Object.keys(muscleTargetInputs).length;
  const hasValid = Object.values(muscleTargetInputs).some(
    (v) => Number.parseFloat(String(v || 0)) > 0
  );

  return (
    <div className="flex flex-col h-full">
      {/* Description — always visible, doesn't scroll */}
      <p className="shrink-0 text-sm text-muted-foreground mb-4">
        Busca un grupo muscular, selecciónalo y ponle las series semanales objetivo.
        Usa los botones +/− para ajustar el número de series.
      </p>

      {/* Search + selected list — scrollable middle area */}
      <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-1">
        <MuscleSearchSelector
          muscles={muscleOptions}
          muscleTargets={muscleTargetInputs}
          onSetTarget={setMuscleTarget}
          onRemoveTarget={removeMuscleTarget}
        />

        {selectedCount === 0 && (
          <p className="text-xs text-amber-300 text-center pt-2">
            Añade al menos un grupo muscular para continuar
          </p>
        )}
      </div>

      {/* Button always pinned at bottom */}
      <div className="pt-4 shrink-0">
        <Button
          onClick={onNext}
          disabled={!hasValid}
          className="w-full h-12 text-base bg-[#F44C40] hover:bg-[#E23C32] text-white"
        >
          {selectedCount > 0
            ? `Continuar con ${selectedCount} músculo${selectedCount > 1 ? 's' : ''}`
            : 'Continuar'}
        </Button>
      </div>
    </div>
  );
};

export default StepMuscleTargets;
