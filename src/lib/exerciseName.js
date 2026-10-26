import { workingSets } from "./warmup";

// Resolve the display name of a logged exercise.
// Priority: user rename (customNames) -> template definition (customExercises) -> raw id.
export function resolveExerciseName(exerciseId, templateId, customNames, customExercises) {
  if (customNames?.[exerciseId]) return customNames[exerciseId];
  return customExercises?.[templateId]?.find((e) => e.id === exerciseId)?.name ?? exerciseId;
}

// Normalized grouping key for an exercise. The same exercise has different ids
// in different templates, so progress/PR logic groups by name instead.
// Falls back to the id when the name is empty or just the unresolved id, so
// unidentifiable exercises are never merged with each other.
export function exerciseKey(name, exerciseId) {
  const normalized = (name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!normalized || normalized === exerciseId) return exerciseId;
  return normalized;
}

// Most recently logged entry ({ exerciseId, comment, sets, date }) per exercise key,
// across all templates — used to prefill a session with last time's numbers.
// Warm-up sets are left out of `sets`, so they never become the prefill.
// templateExercises maps templateId -> exercises (built-in + custom) so names resolve.
export function latestExerciseByKey(logs, customNames, templateExercises) {
  const latest = {};
  const sorted = [...logs].sort((a, b) => new Date(b.date) - new Date(a.date));
  for (const log of sorted) {
    for (const ex of log.exercises ?? []) {
      const sets = workingSets(ex.sets);
      // Skip entries left empty so they don't hide older real numbers
      if (!sets.some((s) => s.weight || s.reps)) continue;
      const name = resolveExerciseName(ex.exerciseId, log.templateId, customNames, templateExercises);
      const key = exerciseKey(name, ex.exerciseId);
      if (!latest[key]) latest[key] = { ...ex, sets, date: log.date };
    }
  }
  return latest;
}

// templateId -> exercises for name resolution: every template's custom exercises,
// with built-in templates' own definitions merged in so their names always resolve.
export function buildTemplateExercises(builtinTemplates, customExercises) {
  const templateExercises = { ...customExercises };
  for (const t of builtinTemplates) {
    templateExercises[t.id] = [...(t.exercises ?? []), ...(customExercises[t.id] ?? [])];
  }
  return templateExercises;
}
