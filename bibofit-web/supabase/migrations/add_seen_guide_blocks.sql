-- Migration: add seen_guide_blocks to profiles
-- Replaces the old has_seen_quick_guide boolean with a granular array
-- tracking which contextual guide blocks each user has completed.
--
-- Run this in Supabase SQL editor before deploying the new guide system.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS seen_guide_blocks text[] DEFAULT '{}';

-- Migrate existing users: if they already saw the old guide,
-- mark all blocks as seen so they are not shown the guide again.
UPDATE profiles
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
  AND (seen_guide_blocks IS NULL OR seen_guide_blocks = '{}');
