import React, { useRef, useState } from 'react';
import { Minus, Plus, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

const normalizeText = (text) =>
  String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/**
 * MuscleSearchSelector
 *
 * Props:
 *   muscles          — array of { id, name }
 *   muscleTargets    — { [muscleId]: seriesValue }
 *   onSetTarget      — (muscleId, value) => void
 *   onRemoveTarget   — (muscleId) => void
 */
const MuscleSearchSelector = ({ muscles, muscleTargets, onSetTarget, onRemoveTarget }) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef(null);

  const selectedIds = Object.keys(muscleTargets).map(Number);
  const selectedMuscles = muscles.filter((m) => selectedIds.includes(m.id));

  const suggestions = query.trim()
    ? muscles.filter(
        (m) =>
          !selectedIds.includes(m.id) &&
          normalizeText(m.name).includes(normalizeText(query.trim()))
      )
    : [];

  const handleSelect = (muscle) => {
    onSetTarget(muscle.id, '10'); // default 10 series
    setQuery('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const increment = (muscleId) => {
    const current = Number.parseInt(String(muscleTargets[muscleId] || 0), 10);
    onSetTarget(muscleId, String(Math.min(30, current + 1)));
  };

  const decrement = (muscleId) => {
    const current = Number.parseInt(String(muscleTargets[muscleId] || 0), 10);
    onSetTarget(muscleId, String(Math.max(1, current - 1)));
  };

  return (
    <div className="space-y-3">
      {/* Selected muscles — chips with series input */}
      {selectedMuscles.length > 0 && (
        <div className="flex flex-col gap-2">
          {selectedMuscles.map((muscle) => (
            <div
              key={muscle.id}
              className="flex items-center gap-3 bg-card/60 border border-border rounded-xl px-3 py-3"
            >
              {/* Muscle name */}
              <span className="flex-1 text-sm font-medium text-white capitalize min-w-0 truncate">
                {muscle.name}
              </span>

              {/* − value + controls */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => decrement(muscle.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-white hover:border-border/80 transition-colors"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="30"
                  value={muscleTargets[muscle.id] ?? ''}
                  onChange={(e) => onSetTarget(muscle.id, e.target.value)}
                  className="w-12 h-8 text-center text-sm font-semibold bg-transparent border border-border rounded-lg text-white focus:outline-none focus:border-[#F44C40]"
                  placeholder="0"
                />
                <button
                  type="button"
                  onClick={() => increment(muscle.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-white hover:border-border/80 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
                <span className="text-xs text-muted-foreground w-10">series</span>
              </div>

              {/* Remove */}
              <button
                type="button"
                onClick={() => onRemoveTarget(muscle.id)}
                className="text-muted-foreground hover:text-red-400 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(e.target.value.trim().length > 0);
          }}
          onFocus={() => query.trim() && setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 150)}
          placeholder="Buscar grupo muscular (ej: bíceps, cuádriceps...)"
          className="pl-9"
        />

        {/* Dropdown suggestions */}
        {isOpen && suggestions.length > 0 && (
          <ul className="absolute z-20 w-full mt-1 bg-card border border-border rounded-xl shadow-xl overflow-hidden">
            {suggestions.slice(0, 8).map((muscle) => (
              <li key={muscle.id}>
                <button
                  type="button"
                  onMouseDown={() => handleSelect(muscle)}
                  className="w-full text-left px-4 py-2.5 text-sm text-foreground hover:bg-white/5 capitalize transition-colors"
                >
                  {muscle.name}
                </button>
              </li>
            ))}
          </ul>
        )}

        {isOpen && query.trim() && suggestions.length === 0 && (
          <div className="absolute z-20 w-full mt-1 bg-card border border-border rounded-xl shadow-xl px-4 py-3 text-sm text-muted-foreground">
            No se encontró ningún músculo
          </div>
        )}
      </div>
    </div>
  );
};

export default MuscleSearchSelector;
