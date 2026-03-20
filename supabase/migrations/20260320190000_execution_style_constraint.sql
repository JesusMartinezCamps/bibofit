-- Update tempo column: now stores named execution styles instead of raw segments.
-- Values: 'estricta' | 'explosiva' | 'pausa' | 'bombeada' | NULL (no preference)
--
-- 'estricta'  → 2-3s negative · 1s pause · explosive concentric
-- 'explosiva' → maximum contraction at peak force point
-- 'pausa'     → 2-3s pause at maximum muscle elongation
-- 'bombeada'  → high constant pace throughout all reps

comment on column public.training_block_exercises.tempo
  is 'Execution style: estricta | explosiva | pausa | bombeada | NULL';

-- Optional soft constraint (warning: drops any old "3-1-2-0" style values)
-- Only add if no legacy numeric tempo data exists.
-- Leaving as a comment so you can apply manually if desired:
--
-- alter table public.training_block_exercises
--   add constraint training_block_exercises_tempo_style_check
--   check (tempo is null or tempo in (''estricta'', ''explosiva'', ''pausa'', ''bombeada''));
