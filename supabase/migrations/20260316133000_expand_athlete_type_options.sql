-- Allow mixed athlete focus in advanced metabolism onboarding.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_athlete_type_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_athlete_type_check
  CHECK (athlete_type IS NULL OR athlete_type IN ('Physique', 'Sport', 'Both'));

COMMENT ON COLUMN public.profiles.athlete_type IS 'Tipo de atleta: Physique, Sport o Both (ambos enfoques).';
