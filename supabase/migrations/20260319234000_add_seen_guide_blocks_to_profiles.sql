-- Migration: add seen_guide_blocks to profiles
-- Replaces the boolean has_seen_quick_guide with a text array
-- that tracks which contextual guide blocks the user has already seen.
--
-- has_seen_quick_guide is kept (not dropped) for backwards compatibility
-- with the old QuickStartGuideContext while both systems coexist.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS seen_guide_blocks text[] NOT NULL DEFAULT '{}';

-- Backfill: users who already completed the old quick guide
-- get all block IDs pre-populated so they don't see the new guides again.
UPDATE public.profiles
SET seen_guide_blocks = ARRAY[
  'dashboard',
  'diet-plan',
  'shopping-list',
  'recipe-view',
  'recipe-edit',
  'variant-tree',
  'chat',
  'weight-history',
  'my-plan',
  'snack-selector',
  'free-recipe-selector'
]
WHERE has_seen_quick_guide = true
  AND (seen_guide_blocks IS NULL OR array_length(seen_guide_blocks, 1) IS NULL);

-- Index for fast lookups by user_id (column is already indexed via primary key,
-- but an expression index on the array can help if needed in the future).
-- For now a simple comment is sufficient; add a GIN index if query patterns require it.
