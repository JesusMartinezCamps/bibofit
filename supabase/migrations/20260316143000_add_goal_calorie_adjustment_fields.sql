-- Goal-driven calorie adjustments for onboarding.
-- Keeps backward compatibility by defaulting to maintenance (0%).

ALTER TABLE public.diet_goals
  ADD COLUMN IF NOT EXISTS energy_adjustment_direction text,
  ADD COLUMN IF NOT EXISTS default_adjustment_pct numeric(5,2),
  ADD COLUMN IF NOT EXISTS min_adjustment_pct numeric(5,2),
  ADD COLUMN IF NOT EXISTS max_adjustment_pct numeric(5,2);

ALTER TABLE public.diet_preferences
  ADD COLUMN IF NOT EXISTS calorie_adjustment_direction text,
  ADD COLUMN IF NOT EXISTS calorie_adjustment_pct numeric(5,2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'diet_goals_energy_adjustment_direction_check'
  ) THEN
    ALTER TABLE public.diet_goals
      ADD CONSTRAINT diet_goals_energy_adjustment_direction_check
      CHECK (
        energy_adjustment_direction IS NULL
        OR energy_adjustment_direction IN ('deficit', 'maintenance', 'surplus')
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'diet_goals_adjustment_range_check'
  ) THEN
    ALTER TABLE public.diet_goals
      ADD CONSTRAINT diet_goals_adjustment_range_check
      CHECK (
        (min_adjustment_pct IS NULL OR (min_adjustment_pct >= 0 AND min_adjustment_pct <= 100))
        AND (max_adjustment_pct IS NULL OR (max_adjustment_pct >= 0 AND max_adjustment_pct <= 100))
        AND (default_adjustment_pct IS NULL OR (default_adjustment_pct >= 0 AND default_adjustment_pct <= 100))
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'diet_preferences_calorie_adjustment_direction_check'
  ) THEN
    ALTER TABLE public.diet_preferences
      ADD CONSTRAINT diet_preferences_calorie_adjustment_direction_check
      CHECK (
        calorie_adjustment_direction IS NULL
        OR calorie_adjustment_direction IN ('deficit', 'maintenance', 'surplus')
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'diet_preferences_calorie_adjustment_pct_check'
  ) THEN
    ALTER TABLE public.diet_preferences
      ADD CONSTRAINT diet_preferences_calorie_adjustment_pct_check
      CHECK (
        calorie_adjustment_pct IS NULL
        OR (calorie_adjustment_pct >= 0 AND calorie_adjustment_pct <= 100)
      );
  END IF;
END;
$$;

UPDATE public.diet_goals
SET energy_adjustment_direction = CASE
  WHEN energy_adjustment_direction IS NOT NULL THEN energy_adjustment_direction
  WHEN name ILIKE '%manten%' OR name ILIKE '%maint%' THEN 'maintenance'
  WHEN name ILIKE '%perd%' OR name ILIKE '%gras%' OR name ILIKE '%deficit%' OR name ILIKE '%cut%' THEN 'deficit'
  WHEN name ILIKE '%gan%' OR name ILIKE '%sub%' OR name ILIKE '%volum%' OR name ILIKE '%super%' OR name ILIKE '%bulk%' THEN 'surplus'
  ELSE 'maintenance'
END;

UPDATE public.diet_goals
SET
  default_adjustment_pct = CASE
    WHEN energy_adjustment_direction = 'deficit' THEN COALESCE(default_adjustment_pct, 15)
    WHEN energy_adjustment_direction = 'surplus' THEN COALESCE(default_adjustment_pct, 7)
    ELSE COALESCE(default_adjustment_pct, 0)
  END,
  min_adjustment_pct = CASE
    WHEN energy_adjustment_direction = 'deficit' THEN COALESCE(min_adjustment_pct, 5)
    WHEN energy_adjustment_direction = 'surplus' THEN COALESCE(min_adjustment_pct, 3)
    ELSE COALESCE(min_adjustment_pct, 0)
  END,
  max_adjustment_pct = CASE
    WHEN energy_adjustment_direction = 'deficit' THEN COALESCE(max_adjustment_pct, 25)
    WHEN energy_adjustment_direction = 'surplus' THEN COALESCE(max_adjustment_pct, 15)
    ELSE COALESCE(max_adjustment_pct, 0)
  END;

UPDATE public.diet_preferences
SET
  calorie_adjustment_direction = COALESCE(calorie_adjustment_direction, 'maintenance'),
  calorie_adjustment_pct = COALESCE(calorie_adjustment_pct, 0)
WHERE calorie_adjustment_direction IS NULL OR calorie_adjustment_pct IS NULL;

COMMENT ON COLUMN public.diet_goals.energy_adjustment_direction IS
  'Direccion del ajuste calorico por objetivo: deficit, maintenance o surplus.';

COMMENT ON COLUMN public.diet_goals.default_adjustment_pct IS
  'Ajuste calorico porcentual por defecto sugerido para ese objetivo.';

COMMENT ON COLUMN public.diet_goals.min_adjustment_pct IS
  'Limite inferior de ajuste porcentual permitido en onboarding.';

COMMENT ON COLUMN public.diet_goals.max_adjustment_pct IS
  'Limite superior de ajuste porcentual permitido en onboarding.';

COMMENT ON COLUMN public.diet_preferences.calorie_adjustment_direction IS
  'Direccion elegida por el usuario para ajustar su TDEE: deficit, maintenance o surplus.';

COMMENT ON COLUMN public.diet_preferences.calorie_adjustment_pct IS
  'Magnitud porcentual del ajuste calorico aplicado al TDEE segun el objetivo.';
