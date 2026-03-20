
-- ② Cuántos alimentos tiene cada sensibilidad (para saber dónde hay masa crítica)
SELECT
  s.id,
  s.name                              AS sensibilidad,
  s.is_ue_regulated,
  COUNT(DISTINCT fs.food_id)          AS alimentos_afectados,
  STRING_AGG(f.name, ', ' ORDER BY f.name)
    FILTER (WHERE f.name IS NOT NULL)  AS muestra_alimentos
FROM public.sensitivities s
LEFT JOIN public.food_sensitivities fs ON fs.sensitivity_id = s.id
LEFT JOIN public.food f ON f.id = fs.food_id
GROUP BY s.id, s.name, s.is_ue_regulated
ORDER BY alimentos_afectados DESC NULLS LAST;
