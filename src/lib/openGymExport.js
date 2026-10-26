// Export the workout history as a CSV that openGym can import
// (Settings → Data & backup → Import from another app). One row per completed set.
import { resolveExerciseName, exerciseKey } from "./exerciseName";

const HEADER = ["workout name", "exercise", "date", "end time", "weight kg", "reps", "rir", "notes", "workout notes"];

// Swedish exercise name (keyed by exerciseKey) -> openGym library entry:
// `name` is the English name openGym's CSV import (matchExercise) resolves to the
// right exercise, `id` is that exercise's id in openGym's catalogue
// (frontend/src/lib/exercises-data.js), used by the plan export. Names not listed
// are exported as-is and become custom exercises in openGym.
const OPENGYM_EXERCISES = {
  "bänkpress (skivstång)": { name: "Bench Press (Barbell)", id: "0025" }, // barbell bench press
  "bänkpress": { name: "Bench Press", id: "0025" }, // barbell bench press
  "militärpress (stående)": { name: "Standing Military Press (Barbell)", id: "1162" }, // barbell standing military press
  "lutande hantelpress": { name: "Incline Bench Press (Dumbbell)", id: "0314" }, // dumbbell incline bench press
  "lutande bänkpress (skivstång)": { name: "Incline Bench Press (Barbell)", id: "0047" }, // barbell incline bench press
  "sidolyft (hantlar)": { name: "Lateral Raise (Dumbbell)", id: "0334" }, // dumbbell lateral raise
  "smal bänkpress (tricepsfokus)": { name: "Close Grip Bench Press", id: "0030" }, // barbell close-grip bench press
  "mage: hanging leg raises": { name: "Hanging Leg Raise", id: "0472" }, // hanging leg raise
  "skivstångsrodd": { name: "Bent Over Row (Barbell)", id: "0027" }, // barbell bent over row
  "pull-ups / chin-ups": { name: "Pull Up", id: "0652" }, // pull-up
  "pull-ups": { name: "Pull Up", id: "0652" }, // pull-up
  "bröststödd rodd (lutande bänk, skivstång)": { name: "Incline Row (Barbell)", id: "0049" }, // barbell incline row
  "hängande rodd (stång i rack)": { name: "Inverted Row", id: "0499" }, // inverted row
  "reverse flyes (hantlar)": { name: "Reverse Fly (Dumbbell)", id: "0383" }, // dumbbell reverse fly
  "bicepscurl (skivstång eller hantlar)": { name: "Bicep Curl", id: "0294" }, // dumbbell biceps curl
  "mage: pallof press": { name: "Pallof Press", id: "0979" }, // band horizontal pallof press
  "marklyft (skivstång)": { name: "Deadlift (Barbell)", id: "0032" }, // barbell deadlift
  "marklyft": { name: "Deadlift", id: "0032" }, // barbell deadlift
  "armhävningar": { name: "Push Up", id: "0662" }, // push-up
  "squat": { name: "Squat", id: "0043" }, // barbell full squat
  "plankan": { name: "Front Plank", id: "0463" }, // front plank ("Plank" alone matches nothing)
};

export function englishExerciseName(name, exerciseId) {
  return OPENGYM_EXERCISES[exerciseKey(name, exerciseId)]?.name ?? name;
}

// openGym library id for an exercise, or null when it has none (becomes a custom exercise)
export function openGymExerciseId(name, exerciseId) {
  return OPENGYM_EXERCISES[exerciseKey(name, exerciseId)]?.id ?? null;
}

// RFC 4180: quote fields containing a comma, quote or line break; double inner quotes
function csvField(value) {
  const s = value == null ? "" : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Local time "YYYY-MM-DD HH:MM", or "" for a missing/invalid timestamp
function formatLocal(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function normalizeWeight(weight) {
  return String(weight ?? "").trim().replace(",", ".");
}

// templateExercises maps templateId -> exercises (built-in + custom), as for latestExerciseByKey
export function logsToOpenGymCsv(logs, customNames, templateExercises) {
  const rows = [HEADER];
  const sorted = [...logs].sort(
    (a, b) => new Date(a.startedAt ?? a.date) - new Date(b.startedAt ?? b.date)
  );

  for (const log of sorted) {
    const date = formatLocal(log.startedAt ?? log.date);
    if (!date) continue;
    const endTime = formatLocal(log.finishedAt);
    let firstLogRow = true;

    for (const ex of log.exercises ?? []) {
      const name = resolveExerciseName(ex.exerciseId, log.templateId, customNames, templateExercises);
      const exportName = englishExerciseName(name, ex.exerciseId);
      let firstExRow = true;

      for (const set of ex.sets ?? []) {
        if (!set.done) continue;
        const weight = normalizeWeight(set.weight);
        const reps = String(set.reps ?? "").trim();
        // openGym skips rows with neither weight nor reps; leave them out so the
        // notes ride on a row that is actually imported
        if (!weight && !reps) continue;

        rows.push([
          log.templateName ?? "",
          exportName,
          date,
          endTime,
          weight,
          reps,
          Number.isFinite(set.rir) ? String(set.rir) : "",
          firstExRow ? ex.comment ?? "" : "",
          firstLogRow ? log.note ?? "" : "",
        ]);
        firstExRow = false;
        firstLogRow = false;
      }
    }
  }

  return rows.map((row) => row.map(csvField).join(",")).join("\r\n") + "\r\n";
}
