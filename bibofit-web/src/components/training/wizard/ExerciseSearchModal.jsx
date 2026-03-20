import React, { useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

const normalizeText = (text) =>
  String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const ExerciseSearchModal = ({ exercises, onSelect, onClose }) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  const filtered = query.trim()
    ? exercises.filter((ex) =>
        normalizeText(ex.name).includes(normalizeText(query.trim()))
      )
    : exercises.slice(0, 30); // show first 30 when no query

  const handleSelect = (exercise) => {
    onSelect(exercise);
    onClose();
  };

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Panel */}
      <div
        className="w-full sm:max-w-md bg-[#0f1115] border border-border rounded-t-2xl sm:rounded-2xl flex flex-col"
        style={{ maxHeight: '75vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
          <h3 className="text-base font-semibold text-white">Buscar ejercicio</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search input */}
        <div className="px-4 pb-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              ref={inputRef}
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Escribe el nombre del ejercicio..."
              className="pl-9"
            />
          </div>
        </div>

        {/* Results */}
        <div className="overflow-y-auto flex-1 px-2 pb-4">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No se encontraron ejercicios
            </p>
          ) : (
            <ul>
              {filtered.map((exercise) => (
                <li key={exercise.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(exercise)}
                    className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-foreground hover:bg-white/5 transition-colors"
                  >
                    {exercise.name}
                    {exercise.muscle_group && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {exercise.muscle_group}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExerciseSearchModal;
