import { resolveExerciseName, exerciseKey } from "./exerciseName";

// Weight in kg as a number; accepts a decimal comma ("82,5"). Empty or invalid -> 0.
export function parseWeight(weight) {
  return parseFloat(String(weight ?? "").replace(",", ".")) || 0;
}

// Heaviest weight among the given sets — the PR rule shared by History and the session.
// Callers pick which sets count (History: all logged sets, session: done sets).
export function maxWeight(sets) {
  return (sets ?? []).reduce((max, s) => Math.max(max, parseWeight(s.weight)), 0);
}

// Heaviest done set per exercise key across all logs, the baseline for live PRs.
// templateExercises maps templateId -> exercises (built-in + custom) so names resolve.
export function maxWeightByKey(logs, customNames, templateExercises) {
  const best = {};
  for (const log of logs) {
    for (const ex of log.exercises ?? []) {
      const w = maxWeight(ex.sets?.filter((s) => s.done));
      if (w === 0) continue;
      const name = resolveExerciseName(ex.exerciseId, log.templateId, customNames, templateExercises);
      const key = exerciseKey(name, ex.exerciseId);
      if (w > (best[key] ?? 0)) best[key] = w;
    }
  }
  return best;
}

// Indices of done sets that beat both the logged max and every earlier done set
// of the exercise in this session. No PRs without history (prevMax 0).
export function sessionPRs(sets, prevMax) {
  const prs = new Set();
  if (!(prevMax > 0)) return prs;
  let best = prevMax;
  sets.forEach((s, i) => {
    if (!s.done) return;
    const w = parseWeight(s.weight);
    if (w > best) {
      prs.add(i);
      best = w;
    }
  });
  return prs;
}
