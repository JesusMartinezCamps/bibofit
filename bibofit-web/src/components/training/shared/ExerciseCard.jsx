import React from 'react';
import { Star, Trash2, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

const T = '#F44C40';

/**
 * ExerciseCard — shared card for both wizard (template config) and workout day view.
 *
 * Props:
 *   name           string            — exercise name
 *   index          number            — position in list (shown when not key exercise)
 *   isKeyExercise  bool              — shows star icon + red badge
 *   targetSets     number|string     — number of sets
 *   targetRepsMin  number|string     — min reps
 *   targetRepsMax  number|string     — max reps
 *   equipment      string|null       — optional equipment name
 *   rir            number|null       — optional RIR (Reps In Reserve), shown as "· RIR N"
 *   restSeconds    number|null       — optional rest between sets in seconds, shown as "· 2:00"
 *   tempo          string            — optional tempo string, shown as "· 3-1-2-0"
 *   prevSets       object|null       — optional prev session data: { 1: { weight, reps, rir }, ... }
 *   onClick        fn                — called when card is clicked/tapped
 *   onDelete       fn|null           — optional: shows trash icon on hover
 *   animate        bool              — whether to use framer-motion entry animation (default true)
 *   animateDelay   number            — delay for staggered animation (default 0)
 *   showChevron    bool              — shows ChevronRight on right (default false)
 */
const ExerciseCard = ({
  name,
  index = 0,
  isKeyExercise = false,
  targetSets,
  targetRepsMin,
  targetRepsMax,
  equipment = null,
  rir = null,
  restSeconds = null,
  tempo = null,
  prevSets = null,
  onClick,
  onDelete = null,
  animate = true,
  animateDelay = 0,
  showChevron = false,
}) => {
  const formatRest = (seconds) => {
    const parsed = Number.parseInt(String(seconds), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    const mins = Math.floor(parsed / 60);
    const secs = parsed % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const prevS1 = prevSets?.[1];
  const hasHistory = !!prevS1;
  const restLabel = formatRest(restSeconds);

  const cardContent = (
    <div
      className="group relative w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl bg-card border border-border hover:border-border/60 hover:bg-muted/20 active:scale-[0.99] transition-all cursor-pointer"
      onClick={onClick}
    >
      {/* Index badge / star */}
      <div
        className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
        style={isKeyExercise
          ? { background: `${T}15`, color: T }
          : { background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}
      >
        {isKeyExercise ? <Star className="w-4 h-4" /> : index + 1}
      </div>

      {/* Info block */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{name}</p>

        {/* Config summary row */}
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {(targetSets || targetRepsMin || targetRepsMax) && (
            <span className="text-xs text-muted-foreground">
              {targetSets ?? 3} × {targetRepsMin ?? 8}–{targetRepsMax ?? 12} reps
            </span>
          )}
          {rir !== null && rir !== undefined && (
            <span className="text-[10px] text-muted-foreground/70">· RIR {rir}</span>
          )}
          {restLabel && (
            <span className="text-[10px] text-muted-foreground/70">· Desc {restLabel}</span>
          )}
          {tempo && tempo.trim() && (
            <span className="text-[10px] text-muted-foreground/70">· {tempo}</span>
          )}
          {equipment && (
            <span className="text-[10px] text-muted-foreground/50">· {equipment}</span>
          )}
        </div>

        {/* Previous session row (workout context) */}
        {hasHistory && (
          <p className="text-[11px] text-muted-foreground mt-1">
            Ant:{' '}
            <span className="text-foreground/70">
              {prevS1.weight} kg × {prevS1.reps} reps
            </span>
            {prevS1.rir !== null && prevS1.rir !== undefined && (
              <span
                className={`ml-1.5 font-medium ${
                  prevS1.rir === 0
                    ? 'text-amber-400'
                    : prevS1.rir <= 3
                    ? 'text-[#F44C40]'
                    : 'text-blue-400'
                }`}
              >
                · RIR {prevS1.rir === 0 ? 'Fallo' : prevS1.rir}
              </span>
            )}
          </p>
        )}
        {prevSets !== null && !hasHistory && (
          <p className="text-[11px] text-muted-foreground/50 mt-1">Sin historial</p>
        )}
      </div>

      {/* Delete button — on hover */}
      {onDelete && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all p-1 shrink-0"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Chevron (workout context) */}
      {showChevron && (
        <ChevronRight className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
      )}
    </div>
  );

  if (!animate) return cardContent;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: animateDelay }}
    >
      {cardContent}
    </motion.div>
  );
};

export default ExerciseCard;
