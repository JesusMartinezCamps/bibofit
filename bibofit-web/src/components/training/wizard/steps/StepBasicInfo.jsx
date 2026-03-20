import React from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const StepBasicInfo = ({ wizard, onNext }) => {
  const {
    weeklyRoutineName,
    setWeeklyRoutineName,
    selectedObjectiveId,
    setSelectedObjectiveId,
    objectiveOptions,
    isLoadingCatalogs,
  } = wizard;

  const selectedObjective = objectiveOptions.find(
    (o) => String(o.id) === String(selectedObjectiveId)
  );

  const canContinue = weeklyRoutineName.trim().length > 0 && selectedObjectiveId;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 space-y-6 overflow-y-auto pr-1">
        {/* Nombre */}
        <div className="space-y-2">
          <Label className="text-muted-foreground">Nombre de la rutina</Label>
          <Input
            value={weeklyRoutineName}
            onChange={(e) => setWeeklyRoutineName(e.target.value)}
            placeholder="Ej: Semana base"
          />
        </div>

        {/* Objetivo */}
        <div className="space-y-2">
          <Label className="text-muted-foreground">Objetivo principal</Label>
          {isLoadingCatalogs ? (
            <div className="flex h-12 items-center gap-2 rounded-xl border border-border px-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando objetivos...
            </div>
          ) : (
            <Select
              value={String(selectedObjectiveId || '')}
              onValueChange={setSelectedObjectiveId}
            >
              <SelectTrigger className="h-12">
                <SelectValue placeholder="Selecciona un objetivo" />
              </SelectTrigger>
              <SelectContent>
                {objectiveOptions.map((o) => (
                  <SelectItem key={o.id} value={String(o.id)}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {selectedObjective?.description && (
            <p className="text-xs text-muted-foreground italic">
              {selectedObjective.description}
            </p>
          )}
        </div>
      </div>

      <div className="pt-6 mt-auto shrink-0">
        <Button
          onClick={onNext}
          disabled={!canContinue}
          className="w-full h-12 text-base bg-[#F44C40] hover:bg-[#E23C32] text-white"
        >
          Siguiente
        </Button>
      </div>
    </div>
  );
};

export default StepBasicInfo;
