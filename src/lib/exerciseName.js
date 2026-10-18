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
