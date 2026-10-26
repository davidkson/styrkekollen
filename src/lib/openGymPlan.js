// Export a template as an openGym plan file (Plan → share icon → Import a plan file).
// The file holds one routine. Format: openGym's frontend/src/lib/plan-share.js —
// parsePlan silently drops exercises whose id is neither in openGym's library nor
// in the file's customEx, so every exercise without a known library id is carried
// as a custom exercise.
import { exerciseKey } from "./exerciseName";
import { openGymExerciseId } from "./openGymExport";
import { deliverFile } from "./deliverFile";
import { workingSets } from "./warmup";
import { DASH, NUM, toNumber, isSupersetRest, parseRestSec } from "./rest";

// "8–12", "10–12 per sida", "8", "45 sek", "max" -> openGym prescription fields.
// openGym's reps on a per-side exercise are the total over both sides
// ("3 × 16 · 8/side"), so a per-side range is doubled.
export function parseRepsRange(repsRange) {
  const text = String(repsRange ?? "").trim().toLowerCase();
  const perSide = /\s+per sida$/.test(text);
  const core = text.replace(/\s+per sida$/, "");
  const factor = perSide ? 2 : 1;
  const side = perSide ? { side: true } : {};

  const range = core.match(new RegExp(`^(\\d+)\\s*${DASH}\\s*(\\d+)$`));
  if (range) {
    const min = Number(range[1]) * factor;
    const max = Number(range[2]) * factor;
    return { reps: max, repsMin: min, repsMax: max, ...side };
  }
  const single = core.match(/^(\d+)$/);
  if (single) return { reps: Number(single[1]) * factor, ...side };

  const time = core.match(new RegExp(`^${NUM}\\s*(sek|s|min)$`));
  if (time) {
    const value = toNumber(time[1]);
    const sec = Math.round(time[2] === "min" ? value * 60 : value);
    if (sec > 0) return { mode: "time", sec, ...side };
  }

  if (core === "max") return { lastToFailure: true, ...side };
  return {};
}

// Body part for a custom exercise, guessed from its (Swedish or English) name.
// Values are openGym's library body parts; checked in order, first hit wins.
const BODY_PART_GUESSES = [
  ["waist", ["mage", "plank", "crunch", "sit-up", "situp", "pallof", "leg raise", "core", "abs"]],
  ["lower legs", ["vad", "calf", "calves"]],
  ["upper legs", ["ben", "knäböj", "squat", "utfall", "lunge", "lår", "marklyft", "deadlift", "höft", "hip thrust", "glute", "rumpa", "leg"]],
  ["upper arms", ["biceps", "triceps", "curl", "dips", "skull", "pushdown"]],
  ["shoulders", ["axel", "axlar", "militär", "sidolyft", "shoulder", "lateral", "overhead", "face pull", "reverse fly", "omvänd flyes"]],
  ["back", ["rygg", "rodd", "row", "pull-up", "pullup", "chin", "latsdrag", "pulldown", "lat "]],
  ["chest", ["bröst", "bänk", "bench", "chest", "armhäv", "push-up", "pushup", "flyes", "fly"]],
  ["lower arms", ["underarm", "grepp", "grip", "wrist", "forearm", "handled"]],
  ["neck", ["nacke", "neck"]],
];

export function guessBodyPart(name) {
  const text = ` ${String(name ?? "").toLowerCase()} `;
  for (const [bp, words] of BODY_PART_GUESSES) {
    if (words.some((w) => text.includes(w))) return bp;
  }
  return "chest";
}

// Starting weight: first checked-off working set with a weight, otherwise the first one with one
function previousWeight(prevEx) {
  const sets = workingSets(prevEx?.sets);
  const weighted = (s) => toNumber(s.weight) > 0;
  const set = sets.find((s) => s.done && weighted(s)) ?? sets.find(weighted);
  return set ? toNumber(set.weight) : null;
}

// Rep target for a "max" exercise (openGym needs a number to open the sets at):
// last time's reps, otherwise openGym's default of 10
function previousReps(prevEx) {
  const sets = workingSets(prevEx?.sets);
  const withReps = (s) => parseInt(s.reps) > 0;
  const set = sets.find((s) => s.done && withReps(s)) ?? sets.find(withReps);
  return set ? parseInt(set.reps) : 10;
}

// Library ids in the exercise table whose openGym equipment is body weight or band
// (openGym's isBodyweightEq): hanging leg raise, pull-up, inverted row, pallof press,
// push-up, front plank
const BODYWEIGHT_LIBRARY_IDS = new Set(["0472", "0652", "0499", "0979", "0662", "0463"]);

function localDate(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// template: merged template (built-in + custom exercises).
// previousExercises: latestExerciseByKey result. customNames: exerciseId -> rename.
export function templateToOpenGymPlan(template, previousExercises, customNames) {
  const exercises = template.exercises ?? [];
  const customEx = [];
  const customIds = {};
  const ex = [];
  let supersetCount = 0;
  let carriedSg = null;

  exercises.forEach((exercise, i) => {
    const name = customNames?.[exercise.id] ?? exercise.name ?? "";
    const key = exerciseKey(name, exercise.id);
    let id = openGymExerciseId(name, exercise.id);
    const custom = !id;
    if (custom) {
      if (!customIds[key]) {
        customIds[key] = `styrkekollen-${exercise.id}`;
        customEx.push({ id: customIds[key], n: name || exercise.id, bp: guessBodyPart(name) });
      }
      id = customIds[key];
    }

    const sets = parseInt(exercise.sets);
    const out = { id, sets: sets > 0 ? sets : 1, ...parseRepsRange(exercise.repsRange) };
    const prevEx = previousExercises?.[key];
    if (out.lastToFailure && out.mode !== "time" && out.reps == null) {
      out.reps = previousReps(prevEx) * (out.side ? 2 : 1);
    }

    // A bodyweight exercise carries no load. The flag only travels when it disagrees
    // with openGym's catalogue, as in its cleanEx (custom exercises have no equipment
    // in the file, so openGym treats them as loaded).
    if (exercise.bodyweight === true) {
      if (custom || !BODYWEIGHT_LIBRARY_IDS.has(id)) out.bodyweight = true;
    } else {
      const weight = previousWeight(prevEx);
      if (weight) out.weight = weight;
    }

    const restSec = parseRestSec(exercise.rest);
    if (restSec) out.restSec = restSec;

    // "0 sek (superset)" links this exercise to the next one
    let sg = carriedSg;
    const linksNext = isSupersetRest(exercise.rest) && i < exercises.length - 1;
    if (linksNext && !sg) sg = `ss${++supersetCount}`;
    carriedSg = linksNext ? sg : null;
    if (sg) out.sg = sg;

    ex.push(out);
  });

  return {
    opengym_plan: 1,
    exported: localDate(),
    name: template.name ?? "",
    unit: "kg",
    week: {},
    routines: [{ id: template.id, name: template.name ?? "", ex }],
    customEx,
  };
}

function planFilename(templateName) {
  const base = String(templateName ?? "")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim() || "pass";
  return `${base}-opengym-plan.json`;
}

export function exportTemplateToOpenGym(template, previousExercises, customNames) {
  const plan = templateToOpenGymPlan(template, previousExercises, customNames);
  return deliverFile(JSON.stringify(plan, null, 2), planFilename(template.name), "application/json");
}
