// ─────────────────────────────────────────────────────────────────────────────
// Helpers compartidos para las páginas de día de entrenamiento.
// Extraído de WorkoutDayPage y RoutineDayWorkspacePage.
// ─────────────────────────────────────────────────────────────────────────────

export const BLOCK_LABELS = {
  torso:     'Torso',
  pierna:    'Piernas',
  fullbody:  'Full Body',
  push:      'Empuje',
  pull:      'Tirón',
  core:      'Core',
  cardio:    'Cardio',
  movilidad: 'Movilidad',
  custom:    'Bloque',
}

/** Normaliza la respuesta de la DB al formato interno de la página.
 *  prevSets queda a null — se hidrata después por el hook correspondiente. */
export function normalizeDayData(day, blocks) {
  return {
    id: day.id,
    name: day.name || `Día ${day.day_index}`,
    dayIndex: day.day_index,
    microcycleObjective: null,
    deloadWeek: false,
    blocks: (blocks || []).map(b => ({
      id: b.id,
      blockType: b.block_type,
      blockOrder: b.block_order,
      name: b.name,
      exercises: (b.training_block_exercises || [])
        .sort((a, z) => a.exercise_order - z.exercise_order)
        .map(be => ({
          blockExerciseId: be.id,
          blockId: b.id,
          exerciseId: be.exercises?.id,
          name: be.exercises?.name || 'Ejercicio',
          isKeyExercise: Boolean(be.is_key_exercise),
          targetSets: be.target_sets,
          targetRepsMin: be.target_reps_min,
          targetRepsMax: be.target_reps_max,
          equipment: be.equipment?.name || null,
          preferredEquipmentId: be.equipment?.id ? String(be.equipment.id) : '',
          targetRir: be.target_rir ?? null,
          restSeconds: be.rest_seconds ?? 120,
          tempo: be.tempo ?? null,
          notes: be.notes ?? null,
          prevSets: null,
        })),
    })),
  }
}

/** Convierte un ejercicio normalizado al formato que espera ExerciseConfigPanel. */
export function exerciseToConfigShape(ex) {
  return {
    target_sets: String(ex.targetSets ?? 3),
    target_reps_min: String(ex.targetRepsMin ?? 8),
    target_reps_max: String(ex.targetRepsMax ?? 10),
    target_rir: ex.targetRir ?? null,
    rest_seconds: ex.restSeconds ?? 120,
    tempo: ex.tempo ?? null,
    notes: ex.notes ?? '',
    is_key_exercise: ex.isKeyExercise ?? false,
    preferred_equipment_id: ex.preferredEquipmentId ?? '',
  }
}

/** Mapea un patch en formato DB al formato interno de ejercicio. */
export function mapConfigPatchToExercise(patch) {
  const next = {}
  if ('target_sets' in patch) next.targetSets = Number.parseInt(String(patch.target_sets), 10) || 0
  if ('target_reps_min' in patch) next.targetRepsMin = Number.parseInt(String(patch.target_reps_min), 10) || 0
  if ('target_reps_max' in patch) next.targetRepsMax = Number.parseInt(String(patch.target_reps_max), 10) || 0
  if ('target_rir' in patch) next.targetRir = patch.target_rir ?? null
  if ('rest_seconds' in patch) next.restSeconds = Number.parseInt(String(patch.rest_seconds), 10) || 120
  if ('tempo' in patch) next.tempo = patch.tempo ?? null
  if ('notes' in patch) next.notes = patch.notes ?? null
  if ('is_key_exercise' in patch) next.isKeyExercise = patch.is_key_exercise === true
  if ('preferred_equipment_id' in patch) next.preferredEquipmentId = patch.preferred_equipment_id || ''
  return next
}

/** Construye un ejercicio draft (no persistido aún) listo para añadir a un bloque.
 *  @param {boolean} isFirstInBlock  Si true, se marca como ejercicio clave. */
export function buildDraftExercise(blockId, exercise, isFirstInBlock, equipmentCatalog = []) {
  const equipmentName = equipmentCatalog.find(
    eq => String(eq.id) === String(exercise.equipment_id)
  )?.name || null

  return {
    blockExerciseId: `draft-${blockId}-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
    blockId,
    exerciseId: exercise.id,
    name: exercise.name,
    isKeyExercise: Boolean(isFirstInBlock),
    targetSets: 3,
    targetRepsMin: 8,
    targetRepsMax: 10,
    equipment: equipmentName,
    preferredEquipmentId: exercise.equipment_id ? String(exercise.equipment_id) : '',
    targetRir: 1,
    restSeconds: 120,
    tempo: 'estricta',
    notes: null,
    prevSets: null,
    _isDraftNew: true,
  }
}

/** Garantiza que haya al menos un ejercicio clave por bloque. */
export function ensureOneKeyExercise(exercises) {
  if (!exercises.length) return exercises
  if (exercises.some(ex => ex.isKeyExercise)) return exercises
  return exercises.map((ex, idx) => ({ ...ex, isKeyExercise: idx === 0 }))
}
