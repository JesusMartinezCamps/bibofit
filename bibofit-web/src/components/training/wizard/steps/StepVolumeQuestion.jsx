import React from 'react';
import { BarChart2, SkipForward } from 'lucide-react';

const StepVolumeQuestion = ({ wizard }) => {
  const { confirmVolumeGoal } = wizard;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex flex-col justify-center gap-4 pr-1">
        <p className="text-sm text-muted-foreground">
          Puedes definir cuántas series semanales quieres acumular por grupo muscular. Esto
          alimenta el visualizador de volumen y te ayuda a saber si estás trabajando suficiente
          cada músculo.
        </p>

        {/* Yes */}
        <button
          type="button"
          onClick={() => confirmVolumeGoal(true)}
          className="flex items-center gap-4 rounded-2xl border border-border bg-card/40 hover:bg-card/70 transition-colors px-5 py-5 text-left"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted shrink-0">
            <BarChart2 className="h-6 w-6 text-foreground" />
          </div>
          <div>
            <p className="font-semibold text-white">Sí, quiero definirlos</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Elijo qué músculos trabajar y cuántas series
            </p>
          </div>
        </button>

        {/* No */}
        <button
          type="button"
          onClick={() => confirmVolumeGoal(false)}
          className="flex items-center gap-4 rounded-2xl border border-border bg-card/40 hover:bg-card/70 transition-colors px-5 py-5 text-left"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted shrink-0">
            <SkipForward className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-white">No, saltar por ahora</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Puedo configurarlo más adelante desde el perfil
            </p>
          </div>
        </button>
      </div>
    </div>
  );
};

export default StepVolumeQuestion;
