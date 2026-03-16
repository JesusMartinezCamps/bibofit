-- Advanced metabolism inputs inspired by the Asnadi spreadsheet model.
-- All fields are optional to preserve the current onboarding UX.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS knows_ffm boolean,
  ADD COLUMN IF NOT EXISTS ffm_method text,
  ADD COLUMN IF NOT EXISTS is_athlete boolean,
  ADD COLUMN IF NOT EXISTS athlete_type text,
  ADD COLUMN IF NOT EXISTS ffm_pct numeric(5,2),
  ADD COLUMN IF NOT EXISTS fm_pct numeric(5,2),
  ADD COLUMN IF NOT EXISTS ffm_kg numeric(6,2),
  ADD COLUMN IF NOT EXISTS fm_kg numeric(6,2),
  ADD COLUMN IF NOT EXISTS ger_equation_key text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_ffm_method_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_ffm_method_check
      CHECK (ffm_method IS NULL OR ffm_method IN ('Skinfold', 'DXA', 'UWW', 'BIA'));
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_athlete_type_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_athlete_type_check
      CHECK (athlete_type IS NULL OR athlete_type IN ('Physique', 'Sport'));
  END IF;
END;
$$;

COMMENT ON COLUMN public.profiles.knows_ffm IS 'Indica si el usuario conoce su masa libre de grasa (FFM/MLG).';
COMMENT ON COLUMN public.profiles.ffm_method IS 'Método de estimación de FFM: Skinfold, DXA, UWW o BIA.';
COMMENT ON COLUMN public.profiles.is_athlete IS 'Indica si el usuario se considera atleta para seleccionar ecuaciones energéticas.';
COMMENT ON COLUMN public.profiles.athlete_type IS 'Tipo de atleta: Physique o Sport.';
COMMENT ON COLUMN public.profiles.ffm_pct IS 'Porcentaje de masa libre de grasa (MLG).';
COMMENT ON COLUMN public.profiles.fm_pct IS 'Porcentaje de masa grasa (MG).';
COMMENT ON COLUMN public.profiles.ffm_kg IS 'Masa libre de grasa (kg).';
COMMENT ON COLUMN public.profiles.fm_kg IS 'Masa grasa (kg).';
COMMENT ON COLUMN public.profiles.ger_equation_key IS 'Clave de la ecuación utilizada para calcular el GER.';
