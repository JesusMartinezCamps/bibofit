import React from 'react';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import RirScaleSelector from '@/components/training/shared/RirScaleSelector';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ─── Execution styles (stored in `tempo` field) ───────────────────────────────
const EXECUTION_STYLES = [
  {
    value: 'estricta',
    label: 'Reps estrictas',
    description: 'Negativa 2-3s · pausa 1s · subida explosiva. La técnica base para progresar en fuerza.',
  },
  {
    value: 'explosiva',
    label: 'Reps explosivas',
    description: 'Máxima contracción en el punto de mayor aplicación de fuerza. Ideal para potencia.',
  },
  {
    value: 'pausa',
    label: 'Reps con pausa',
    description: 'Pausa de 2-3s en el punto de máxima elongación muscular. Elimina el rebote.',
  },
  {
    value: 'bombeada',
    label: 'Reps bombeadas',
    description: 'Ritmo alto y constante a lo largo de todas las repeticiones. Máxima congestión.',
  },
];

// ─── Shared stepper — vertical layout (+ above, − below) ─────────────────────
const Stepper = ({ value, onChange, min = 1, max = 99, label }) => {
  const num = Number.parseInt(String(value || 0), 10) || 0;
  return (
    <div className="flex flex-col items-center gap-1.5">
      {label && (
        <span className="text-[10px] text-muted-foreground/60 uppercase tracking-widest">
          {label}
        </span>
      )}
      <div className="flex flex-col items-center rounded-xl border border-border overflow-hidden">
        <button
          type="button"
          onClick={() => onChange(String(Math.min(max, num + 1)))}
          className="w-14 py-2 text-muted-foreground/40 hover:text-white hover:bg-white/5 transition-colors text-sm font-bold select-none text-center border-b border-border"
        >
          +
        </button>
        <input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ''))}
          className="w-14 text-center text-xl font-bold bg-transparent text-white focus:outline-none py-2.5 tabular-nums"
        />
        <button
          type="button"
          onClick={() => onChange(String(Math.max(min, num - 1)))}
          className="w-14 py-2 text-muted-foreground/40 hover:text-white hover:bg-white/5 transition-colors text-sm font-bold select-none text-center border-t border-border"
        >
          −
        </button>
      </div>
    </div>
  );
};

// ─── Section label ─────────────────────────────────────────────────────────────
const SectionLabel = ({ children }) => (
  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-3">
    {children}
  </p>
);

// ─── Main component ───────────────────────────────────────────────────────────
const ExerciseConfigPanel = ({
  exerciseName,
  exercise,
  equipmentOptions,
  isNew,
  onChange,
  onConfirm,
  onClose,
}) => {
  const selectedRir =
    exercise.target_rir === null || exercise.target_rir === undefined
      ? null
      : Number(exercise.target_rir);

  const executionStyle = exercise.tempo ?? null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-[#0f1115] border border-border rounded-t-2xl sm:rounded-2xl flex flex-col"
        style={{ maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 shrink-0">
          <div>
            <h3 className="text-base font-bold text-white leading-snug">{exerciseName}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Configura cómo se ejecuta este ejercicio</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors ml-3 mt-0.5 shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 pb-2 space-y-7">

          {/* ── Volumen ─────────────────────────────────────────────────── */}
          <section>
            <SectionLabel>Volumen</SectionLabel>
            <div className="flex items-center gap-4 justify-center">
              {/* Series */}
              <Stepper
                label="Series"
                value={exercise.target_sets}
                onChange={(v) => onChange({ target_sets: v })}
                min={1}
                max={20}
              />

              <span className="text-muted-foreground/25 text-2xl font-light select-none mt-4">×</span>

              {/* Rep range */}
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground/60 uppercase tracking-widest">
                  Rango reps
                </span>
                <div className="flex items-center gap-1.5">
                  <Stepper
                    value={exercise.target_reps_min}
                    onChange={(v) =>
                      onChange({
                        target_reps_min: String(Math.min(Number(v), Number(exercise.target_reps_max))),
                      })
                    }
                    min={1}
                    max={Number(exercise.target_reps_max) || 99}
                  />
                  <span className="text-muted-foreground/40 text-lg font-light select-none">–</span>
                  <Stepper
                    value={exercise.target_reps_max}
                    onChange={(v) =>
                      onChange({
                        target_reps_max: String(Math.max(Number(v), Number(exercise.target_reps_min))),
                      })
                    }
                    min={Number(exercise.target_reps_min) || 1}
                    max={99}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* ── Intensidad — RIR ─────────────────────────────────────────── */}
          <section>
            <SectionLabel>Intensidad</SectionLabel>
            <p className="text-xs text-muted-foreground -mt-1 mb-4">
              RIR · reps que te quedan al terminar la serie. Menos RIR = más intensidad.
            </p>
            <RirScaleSelector
              value={selectedRir}
              onChange={(nextRir) => onChange({ target_rir: nextRir })}
            />
          </section>

          {/* ── Ejecución ────────────────────────────────────────────────── */}
          <section>
            <SectionLabel>Ejecución</SectionLabel>
            <div className="space-y-2">
              {EXECUTION_STYLES.map((style) => {
                const isActive = executionStyle === style.value;
                return (
                  <button
                    key={style.value}
                    type="button"
                    onClick={() => onChange({ tempo: isActive ? null : style.value })}
                    className={`w-full text-left rounded-xl border px-4 py-3 transition-all ${
                      isActive
                        ? 'border-[#F44C40] bg-[#F44C40]/8 text-white'
                        : 'border-border bg-card/30 text-muted-foreground hover:border-border/70 hover:text-foreground'
                    }`}
                  >
                    <p className={`text-sm font-semibold ${isActive ? 'text-white' : 'text-foreground/80'}`}>
                      {style.label}
                    </p>
                    <p className="text-[11px] text-muted-foreground/70 mt-0.5 leading-snug">
                      {style.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* ── Notas técnicas ───────────────────────────────────────────── */}
          <section>
            <SectionLabel>Notas técnicas</SectionLabel>
            <textarea
              rows={2}
              value={exercise.notes ?? ''}
              onChange={(e) => onChange({ notes: e.target.value })}
              placeholder="Ej: Hombros deprimidos antes de tirar, codos hacia la cadera..."
              className="w-full resize-none bg-card/60 border border-border rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-muted-foreground/40 focus:outline-none focus:border-[#F44C40]/40 transition-colors"
            />
          </section>

          {/* ── Contexto ─────────────────────────────────────────────────── */}
          <section className="space-y-3 pb-2">
            <SectionLabel>Contexto</SectionLabel>

            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={Boolean(exercise.is_key_exercise)}
                onCheckedChange={(checked) => onChange({ is_key_exercise: checked === true })}
              />
              <div>
                <p className="text-sm text-white">Ejercicio clave del día</p>
                <p className="text-xs text-muted-foreground">El ejercicio principal que define el entrenamiento</p>
              </div>
            </label>

            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Equipamiento preferido</p>
              <Select
                value={String(exercise.preferred_equipment_id || 'none')}
                onValueChange={(v) => onChange({ preferred_equipment_id: v === 'none' ? '' : v })}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Sin preferencia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin preferencia</SelectItem>
                  {equipmentOptions.map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>
        </div>

        {/* Confirm button */}
        <div className="px-5 py-4 shrink-0 border-t border-border">
          <Button
            onClick={onConfirm}
            className="w-full h-12 text-base bg-[#F44C40] hover:bg-[#E23C32] text-white gap-2"
          >
            <Check className="h-4 w-4" />
            {isNew ? 'Añadir al día' : 'Guardar cambios'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ExerciseConfigPanel;
