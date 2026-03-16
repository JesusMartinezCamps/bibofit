-- Align deficit upper bound with onboarding guardrail (22.5%).

UPDATE public.diet_goals
SET max_adjustment_pct = 22.5
WHERE energy_adjustment_direction = 'deficit'
  AND (max_adjustment_pct IS NULL OR max_adjustment_pct > 22.5);

UPDATE public.diet_goals
SET default_adjustment_pct = 22.5
WHERE energy_adjustment_direction = 'deficit'
  AND default_adjustment_pct > 22.5;

UPDATE public.diet_goals
SET min_adjustment_pct = 5
WHERE energy_adjustment_direction = 'deficit'
  AND min_adjustment_pct IS NULL;
