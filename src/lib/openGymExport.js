// Export the workout history as a CSV that openGym can import
// (Settings → Data & backup → Import from another app). One row per completed set.
import { resolveExerciseName, exerciseKey } from "./exerciseName";

const HEADER = ["workout name", "exercise", "date", "end time", "weight kg", "reps", "rir", "notes", "workout notes"];

// Swedish exercise name (keyed by exerciseKey) -> English name that openGym's
// matchExercise() resolves to the right library entry. Names not listed are
// exported as-is and become custom exercises in openGym.
const ENGLISH_NAMES = {
  "bänkpress (skivstång)": "Bench Press (Barbell)", // barbell bench press
  "bänkpress": "Bench Press", // barbell bench press
  "militärpress (stående)": "Standing Military Press (Barbell)", // barbell standing military press
  "lutande hantelpress": "Incline Bench Press (Dumbbell)", // dumbbell incline bench press
  "lutande bänkpress (skivstång)": "Incline Bench Press (Barbell)", // barbell incline bench press
  "sidolyft (hantlar)": "Lateral Raise (Dumbbell)", // dumbbell lateral raise
  "smal bänkpress (tricepsfokus)": "Close Grip Bench Press", // barbell close-grip bench press
  "mage: hanging leg raises": "Hanging Leg Raise", // hanging leg raise
  "skivstångsrodd": "Bent Over Row (Barbell)", // barbell bent over row
  "pull-ups / chin-ups": "Pull Up", // pull-up
  "pull-ups": "Pull Up", // pull-up
  "bröststödd rodd (lutande bänk, skivstång)": "Incline Row (Barbell)", // barbell incline row
  "hängande rodd (stång i rack)": "Inverted Row", // inverted row
  "reverse flyes (hantlar)": "Reverse Fly (Dumbbell)", // dumbbell reverse fly
  "bicepscurl (skivstång eller hantlar)": "Bicep Curl", // dumbbell biceps curl
  "mage: pallof press": "Pallof Press", // band horizontal pallof press
  "marklyft (skivstång)": "Deadlift (Barbell)", // barbell deadlift
  "marklyft": "Deadlift", // barbell deadlift
  "armhävningar": "Push Up", // push-up
  "squat": "Squat", // barbell full squat
  "plankan": "Front Plank", // front plank ("Plank" alone matches nothing)
};

export function englishExerciseName(name, exerciseId) {
  return ENGLISH_NAMES[exerciseKey(name, exerciseId)] ?? name;
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
