import { useState, useEffect, useRef } from "react";
import { haptic } from "../lib/haptic";
import { exerciseKey } from "../lib/exerciseName";
import { sessionPRs } from "../lib/pr";
import { isWarmup, workingSets, setLabels } from "../lib/warmup";
import { nextRir, rirLabel, rirSuffix } from "../lib/rir";
import { parseRestSec, isSupersetRest } from "../lib/rest";
import { exerciseBlocks, canShuffle, shuffleOrder, remapSupersets, restoreOrder } from "../lib/sessionOrder";
import { fmt } from "../hooks/useRestTimer";
import { useWakeLock } from "../hooks/useWakeLock";
import { IconPencil } from "./icons";

const EMPTY_FORM = { name: "", sets: "3", repsRange: "8–12", rest: "60 sek", bodyweight: false };
const REST_PRESETS = [30, 45, 60, 90, 120, 180];

function fmtElapsed(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

// Last time's working set k is the prefill for today's working set k; warm-ups get none.
// Sets beyond last time's count keep what they have. Sessions saved before
// previousSets existed are left as they are.
function withPrevious(exData) {
  const prevSets = exData.previousSets;
  if (!prevSets) return exData;
  let k = 0;
  return {
    ...exData,
    sets: exData.sets.map((s) => {
      if (isWarmup(s)) return { ...s, prevWeight: "", prevReps: "" };
      const prev = prevSets[k++];
      return prev ? { ...s, prevWeight: prev.weight, prevReps: prev.reps } : s;
    }),
  };
}

// Own component so the ticking clock re-renders the clock, not the exercise list
function SessionElapsed({ startedAt }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!startedAt) return null;
  const seconds = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  return <span className="topbar-elapsed">{fmtElapsed(seconds)}</span>;
}

const BAR_WEIGHT = 17;
const PLATES = [20, 15, 10, 5, 2.5, 1.25, 0.5];

function calcPlates(target) {
  const perSide = (target - BAR_WEIGHT) / 2;
  if (perSide < 0) return null;
  const result = [];
  let remaining = Math.round(perSide * 1000) / 1000;
  for (const plate of PLATES) {
    if (remaining <= 0) break;
    const count = Math.floor(Math.round((remaining / plate) * 1000) / 1000);
    if (count > 0) {
      result.push({ plate, count });
      remaining = Math.round((remaining - plate * count) * 1000) / 1000;
    }
  }
  if (remaining > 0.001) return null;
  return result;
}

/*
 * Stepper-steg för vikt.
 *
 * Skivstången laddas i par, och den minsta skivan är 1,25 kg — alltså är 2,5 kg
 * det minsta hopp som faktiskt går att lasta. Lätt hantel- och kabelarbete
 * (sidolyft, face pulls) lever under det rutnätet och går i 1 kg-kliv, så ett
 * enda hårdkodat steg skulle bli fel i ena änden oavsett vilket man väljer.
 * Gränsen går vid 20 kg: under den är man per definition inte på en skivstång.
 */
const LIGHT_WEIGHT_LIMIT = 20;

function weightStep(value) {
  return value < LIGHT_WEIGHT_LIMIT ? 1 : 2.5;
}

/*
 * Räknar i hundradels kg som heltal, så att stegen aldrig kan ge flyttalsrester
 * av typen 97.49999999999999. Ligger värdet mellan två steg snäpps det till
 * rutnätet i stället för att dra med sig avvikelsen (22 → 22,5 upp, 20 ned).
 */
function steppedValue(current, step, dir) {
  const ticks = Math.round(current * 100);
  const stepTicks = Math.round(step * 100);
  const next = dir > 0
    ? (Math.floor(ticks / stepTicks) + 1) * stepTicks
    : (Math.ceil(ticks / stepTicks) - 1) * stepTicks;
  return Math.max(0, next) / 100;
}

function nextFieldValue(set, field, dir) {
  const raw = set[field];
  if (raw === "" || raw == null) {
    // Tomt fält: första trycket hämtar förra passets värde om det finns,
    // så man slipper klicka sig upp från noll till arbetsvikten.
    const prev = parseFloat(field === "weight" ? set.prevWeight : set.prevReps);
    if (!isNaN(prev) && prev > 0) return String(prev);
  }
  const parsed = parseFloat(raw);
  const base = isNaN(parsed) || parsed < 0 ? 0 : parsed;
  const step = field === "weight" ? weightStep(base) : 1;
  return String(steppedValue(base, step, dir));
}

function analyzeSuggestion(exSets, repsRange) {
  const rangeMatch = repsRange?.match(/(\d+)[–-](\d+)/);
  const minReps = rangeMatch ? parseInt(rangeMatch[1]) : null;
  const maxReps = rangeMatch ? parseInt(rangeMatch[2]) : null;

  const prevSets = workingSets(exSets).filter(s => s.prevWeight && s.prevReps);
  if (prevSets.length === 0) return null;

  const prevWeight = parseFloat(prevSets[0].prevWeight);
  if (!prevWeight || prevWeight <= 0) return null;

  const prevReps = prevSets.map(s => parseInt(s.prevReps) || 0);

  const step = prevWeight >= 100 ? 5 : 2.5;

  if (maxReps && prevReps.every(r => r >= maxReps)) {
    const suggested = prevWeight + step;
    return { action: "increase", suggested, prevWeight, reason: `Alla set klarade ${maxReps}+ reps` };
  }

  if (minReps && prevReps.filter(r => r < minReps).length >= 2) {
    const suggested = prevWeight - step;
    return { action: "decrease", suggested: Math.max(BAR_WEIGHT, suggested), prevWeight, reason: `Missade ${minReps} reps på flera set` };
  }

  return { action: "maintain", suggested: prevWeight, prevWeight, reason: "Samma vikt, sikta på fler reps" };
}

const SUGGEST_ARROW = { increase: "↑", maintain: "→", decrease: "↓" };

// "7 okt", with year when it isn't the current year
function shortDate(iso) {
  const d = new Date(iso);
  const opts = { day: "numeric", month: "short" };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = "numeric";
  return d.toLocaleDateString("sv-SE", opts).replace(/\./g, "");
}

// "Förra (7 okt): 75×10 R2, 75×10" — bodyweight exercises show reps only.
// Sessions saved before previousSets existed fall back to the per-set prev values, without date.
function previousLine(exData, bodyweight) {
  const legacy = !exData?.previousSets;
  const prevSets = legacy
    ? workingSets(exData?.sets).filter((s) => s.prevWeight || s.prevReps).map((s) => ({ weight: s.prevWeight, reps: s.prevReps }))
    : exData.previousSets;
  if (prevSets.length === 0) return legacy ? null : "Första gången";
  const list = prevSets
    .map((s) => (bodyweight || !s.weight ? s.reps || "—" : `${s.weight}×${s.reps || "—"}`) + rirSuffix(s.rir))
    .join(", ");
  return exData.previousDate ? `Förra (${shortDate(exData.previousDate)}): ${list}` : `Förra: ${list}`;
}

export default function WorkoutSession({ template, savedSets, previousExercises, previousMaxWeights, customNames, startedAt, timer, onRename, onSave, onAddExercise, onFinish, onCancel, onAbandon, onToggleTheme }) {
  const [editingName, setEditingName] = useState(null);
  const [nameInput, setNameInput] = useState("");
  const [sessionNote, setSessionNote] = useState("");
  // Vad som fälls ut under toppraden: meny, avbryt-bekräftelse eller spara-bekräftelse
  const [sheet, setSheet] = useState(null);
  const [restOpen, setRestOpen] = useState(false);
  const menuRef = useRef(null);
  const [focusMode, setFocusMode] = useState(false);
  const [focusIdx, setFocusIdx] = useState(0);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [supersets, setSupersets] = useState(new Set());
  const [suggestIdx, setSuggestIdx] = useState(null);

  // Keep the screen on between sets while the session view is shown
  useWakeLock();

  const cardRefs = useRef([]);

  // Prefill from the latest log of an exercise with the same name, in any template.
  // Only last time's working sets count, so warm-ups never become the prefill.
  function initialSets(ex) {
    const prevEx = previousExercises?.[exerciseKey(customNames[ex.id] ?? ex.name, ex.id)];
    const previousSets = workingSets(prevEx?.sets)
      .filter((s) => s.weight || s.reps)
      .map((s) => ({ weight: s.weight ?? "", reps: s.reps ?? "", rir: s.rir ?? null }));
    return {
      exerciseId: ex.id,
      comment: "",
      previousComment: prevEx?.comment ?? "",
      previousDate: prevEx?.date ?? null,
      previousSets,
      sets: Array.from({ length: ex.sets }, (_, i) => {
        const prev = previousSets[i];
        return { weight: prev?.weight ?? "", reps: prev?.reps ?? "", done: false, prevWeight: prev?.weight ?? "", prevReps: prev?.reps ?? "" };
      }),
    };
  }

  // Set indices that are live PRs; bodyweight exercises have no weight to beat
  function prSets(ex, exSets) {
    if (ex.bodyweight) return new Set();
    return sessionPRs(exSets, previousMaxWeights?.[exerciseKey(customNames[ex.id] ?? ex.name, ex.id)]);
  }

  // A resumed session keeps its own order; exercises and sets start out parallel
  const [initial] = useState(() =>
    savedSets
      ? restoreOrder(template.exercises, savedSets)
      : { exercises: [...template.exercises], sets: template.exercises.map(initialSets) }
  );
  const [exercises, setExercises] = useState(initial.exercises);
  const [sets, setSets] = useState(initial.sets);

  useEffect(() => { onSave(sets); }, [sets]);

  // Close the top bar menu on outside click or Escape — same pattern as the card menu
  useEffect(() => {
    if (sheet !== "menu") return;
    function handleClick(e) {
      if (menuRef.current?.contains(e.target)) return;
      setSheet(null);
    }
    function handleKeyDown(e) {
      if (e.key === "Escape") setSheet(null);
    }
    document.addEventListener("click", handleClick, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [sheet]);

  function openSheet(next) {
    setSheet((current) => (current === next ? null : next));
  }

  function openRest() {
    setSheet(null);
    setRestOpen(true);
  }

  function skipRest() {
    timer.reset();
    setRestOpen(false);
  }

  function addExerciseInline(e) {
    e.preventDefault();
    if (!form.name.trim()) { setFormError("Namn krävs"); return; }
    const setsNum = parseInt(form.sets);
    if (!setsNum || setsNum < 1) { setFormError("Ange minst 1 set"); return; }
    const newEx = {
      id: crypto.randomUUID(),
      name: form.name.trim(),
      sets: setsNum,
      repsRange: form.repsRange.trim() || "—",
      rest: form.rest.trim() || "—",
      bodyweight: form.bodyweight,
    };
    setExercises((prev) => [...prev, newEx]);
    setSets((prev) => [...prev, initialSets(newEx)]);
    onAddExercise(newEx);
    setForm(EMPTY_FORM);
    setFormError("");
    setShowAddForm(false);
  }

  function updateComment(exIdx, value) {
    setSets((prev) => prev.map((ex, i) => (i !== exIdx ? ex : { ...ex, comment: value })));
  }

  function update(exIdx, setIdx, field, value) {
    setSets((prev) =>
      prev.map((ex, i) =>
        i !== exIdx ? ex : {
          ...ex,
          sets: ex.sets.map((s, j) => j !== setIdx ? s : {
            ...s,
            [field]: typeof value === "function" ? value(s) : value,
          }),
        }
      )
    );
  }

  // Steppers går genom update() precis som direktinmatningen, så autosparningens
  // debounce triggas på samma sätt. Värdet räknas inne i state-uppdateringen så
  // att snabba tryck i följd inte läser ett inaktuellt värde.
  function adjust(exIdx, setIdx, field, dir) {
    update(exIdx, setIdx, field, (s) => nextFieldValue(s, field, dir));
  }

  function copyPrev(exIdx, setIdx) {
    setSets((prev) =>
      prev.map((ex, i) => {
        if (i !== exIdx) return ex;
        const src = ex.sets[setIdx - 1];
        return { ...ex, sets: ex.sets.map((s, j) => j !== setIdx ? s : { ...s, weight: src.weight, reps: src.reps }) };
      })
    );
  }

  function removeExercise(exIdx) {
    setExercises((prev) => prev.filter((_, i) => i !== exIdx));
    setSets((prev) => prev.filter((_, i) => i !== exIdx));
    setSupersets((prev) => {
      const next = new Set(prev);
      next.delete(exIdx);
      next.delete(exIdx - 1);
      return next;
    });
  }

  function moveExercise(exIdx, dir) {
    const targetIdx = exIdx + dir;
    setExercises((prev) => {
      const next = [...prev];
      [next[exIdx], next[targetIdx]] = [next[targetIdx], next[exIdx]];
      return next;
    });
    setSets((prev) => {
      const next = [...prev];
      [next[exIdx], next[targetIdx]] = [next[targetIdx], next[exIdx]];
      return next;
    });
    setSupersets(new Set());
  }

  // Started exercises stay on top; untouched ones are shuffled, supersets as blocks
  function shuffleExercises() {
    const blocks = exerciseBlocks(exercises.length, linksToNext, isStarted);
    const order = shuffleOrder(blocks);
    haptic(30);
    setExercises(order.map((i) => exercises[i]));
    setSets(order.map((i) => sets[i]));
    setSupersets(remapSupersets(supersets, order));
    setSuggestIdx(null);
    if (focusMode) setFocusIdx(blocks.filter((b) => b.started).reduce((n, b) => n + b.indices.length, 0));
  }

  function addSet(exIdx) {
    setSets((prev) => prev.map((ex, i) => {
      if (i !== exIdx) return ex;
      // Beyond last time's sets the new set repeats the last working set's prefill
      const last = workingSets(ex.sets).at(-1);
      return withPrevious({ ...ex, sets: [...ex.sets, { weight: "", reps: "", done: false, prevWeight: last?.prevWeight ?? "", prevReps: last?.prevReps ?? "" }] });
    }));
  }

  // Tapping the set number switches between working set and warm-up
  function toggleWarmup(exIdx, setIdx) {
    haptic(15);
    setSets((prev) => prev.map((ex, i) => {
      if (i !== exIdx) return ex;
      const sets = ex.sets.map((s, j) => {
        if (j !== setIdx) return s;
        const { warmup, ...rest } = s;
        return warmup ? rest : { ...rest, warmup: true };
      });
      return withPrevious({ ...ex, sets });
    }));
  }

  function removeSet(exIdx) {
    setSets((prev) => prev.map((ex, i) => {
      if (i !== exIdx || ex.sets.length <= 1) return ex;
      const last = ex.sets[ex.sets.length - 1];
      if (last.weight || last.reps || last.done) return ex;
      return { ...ex, sets: ex.sets.slice(0, -1) };
    }));
  }

  // Superset via the rest text or the session toggle: go straight to the next exercise
  function linksToNext(exIdx) {
    if (exIdx >= exercises.length - 1) return false;
    return supersets.has(exIdx) || isSupersetRest(exercises[exIdx]?.rest);
  }

  function isStarted(exIdx) {
    return !!sets[exIdx]?.sets.some((s) => s.done);
  }

  function toggleDone(exIdx, setIdx) {
    // PR check from current state, outside the updater, for the extra haptic
    const setsAfter = (sets[exIdx]?.sets ?? []).map((s, j) => (j === setIdx ? { ...s, done: !s.done } : s));
    const isPR = !!setsAfter[setIdx]?.done && prSets(exercises[exIdx], setsAfter).has(setIdx);
    let becomingDone = false;
    let allDoneAfter = false;
    let sessionDoneAfter = false;
    setSets((prev) => {
      const next = prev.map((ex, i) => {
        if (i !== exIdx) return ex;
        const newSets = ex.sets.map((s, j) => {
          if (j !== setIdx) return s;
          becomingDone = !s.done;
          return { ...s, done: !s.done };
        });
        allDoneAfter = becomingDone && newSets.every((s) => s.done);
        return { ...ex, sets: newSets };
      });
      sessionDoneAfter = becomingDone && next.every((ex) => ex.sets.every((s) => s.done));
      return next;
    });
    if (becomingDone) {
      haptic(isPR ? [40, 60, 120] : 40);
      // Rest with the exercise's own time; unknown format keeps the selected preset
      if (!sessionDoneAfter && !linksToNext(exIdx)) {
        timer.autoStart(parseRestSec(exercises[exIdx]?.rest) ?? timer.preset);
      }
      if (allDoneAfter && !focusMode && exIdx < exercises.length - 1) {
        setTimeout(() => {
          cardRefs.current[exIdx + 1]?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 350);
      }
    } else {
      haptic(15);
    }
  }

  function toggleSuperset(exIdx) {
    setSupersets((prev) => {
      const next = new Set(prev);
      if (next.has(exIdx)) next.delete(exIdx);
      else next.add(exIdx);
      return next;
    });
  }

  function finish() {
    const finishedAt = new Date().toISOString();
    onFinish({
      id: crypto.randomUUID(),
      templateId: template.id,
      templateName: template.name,
      date: finishedAt,
      startedAt: startedAt ?? finishedAt,
      finishedAt,
      exercises: sets,
      note: sessionNote.trim() || null,
    });
  }

  // Warm-up sets don't count toward set totals or volume
  const totalDone = sets.reduce((sum, ex) => sum + workingSets(ex.sets).filter((s) => s.done).length, 0);
  const totalSets = sets.reduce((sum, ex) => sum + workingSets(ex.sets).length, 0);
  const exDone = sets.filter((ex) => workingSets(ex.sets).some((s) => s.done)).length;
  const totalVolume = sets.reduce((sum, ex) =>
    sum + workingSets(ex.sets).filter((s) => s.done && s.weight && s.reps)
      .reduce((s2, s) => s2 + parseFloat(s.weight) * parseInt(s.reps), 0), 0);

  const restVisible = timer.running || timer.done || restOpen;

  return (
    <div className="session">
      <div className="session-chrome">
        <div className="session-topbar">
          <button
            className="topbar-btn topbar-btn--danger"
            onClick={() => openSheet("abandon")}
            title="Avbryt pass"
            aria-label="Avbryt pass"
          >
            ✕
          </button>

          <div className="topbar-title">
            <span className="topbar-name">{template.name}</span>
            <span className="topbar-meta">
              <SessionElapsed startedAt={startedAt} />
              {startedAt && " · "}
              {totalDone}/{totalSets} set
            </span>
          </div>

          <div className="topbar-menu" ref={menuRef}>
            <button
              className="topbar-btn"
              aria-haspopup="menu"
              aria-expanded={sheet === "menu"}
              onClick={() => openSheet("menu")}
              title="Alternativ"
              aria-label="Alternativ"
            >
              ···
            </button>
            {sheet === "menu" && (
              <div className="card-menu-pop" role="menu">
                <button type="button" role="menuitem" className="card-menu-item" onClick={openRest}>
                  Vilotimer
                </button>
                <button type="button" role="menuitem" className="card-menu-item" onClick={() => { setSheet(null); setFocusMode((v) => !v); }}>
                  {focusMode ? "Listläge" : "Fokusläge"}
                </button>
                <button type="button" role="menuitem" className="card-menu-item" disabled={!canShuffle(exerciseBlocks(exercises.length, linksToNext, isStarted))} onClick={() => { setSheet(null); shuffleExercises(); }}>
                  Slumpa ordning
                </button>
                <button type="button" role="menuitem" className="card-menu-item" onClick={() => { setSheet(null); onToggleTheme(); }}>
                  Byt tema
                </button>
                <button type="button" role="menuitem" className="card-menu-item" onClick={() => { setSheet(null); onCancel(); }}>
                  Pausa passet
                </button>
              </div>
            )}
          </div>

          <button
            className="topbar-btn topbar-btn--finish"
            onClick={() => openSheet("finish")}
            title="Avsluta pass"
            aria-label="Avsluta pass"
          >
            ✓
          </button>

          <div className="session-progress-bar">
            <div className="session-progress-fill" style={{ width: `${totalSets > 0 ? (totalDone / totalSets) * 100 : 0}%` }} />
          </div>
        </div>

        {restVisible && (
          <div className={`rest-strip${timer.done ? " rest-strip--done" : ""}`}>
            <button
              className="rest-toggle"
              onClick={timer.toggle}
              title={timer.running ? "Pausa vilan" : "Starta vilan"}
              aria-label={timer.running ? "Pausa vilan" : "Starta vilan"}
            >
              {timer.done ? "↺" : timer.running ? "▮▮" : "►"}
            </button>
            <button
              className="rest-time"
              onClick={() => setRestOpen((v) => !v)}
              aria-expanded={restOpen}
              title="Visa vilotider"
            >
              {timer.done ? "Vila klar" : fmt(timer.remaining)}
            </button>
            <div className="rest-track">
              <div className="rest-fill" style={{ width: `${Math.min(100, Math.max(0, timer.progress * 100))}%` }} />
            </div>
            <button className="rest-action" onClick={() => timer.adjust(+15)}>+15s</button>
            <button className="rest-action" onClick={skipRest}>Hoppa</button>
          </div>
        )}

        {restOpen && (
          <div className="rest-tray">
            {REST_PRESETS.map((s) => (
              <button
                key={s}
                className={`rest-preset${timer.preset === s ? " rest-preset--active" : ""}`}
                onClick={() => timer.autoStart(s)}
              >
                {s < 60 ? `${s}s` : fmt(s)}
              </button>
            ))}
            <button className="rest-preset" onClick={() => timer.adjust(-15)}>−15s</button>
            <button className="rest-preset" onClick={timer.reset} title="Återställ">↺</button>
          </div>
        )}

        {sheet === "abandon" && (
          <div className="session-sheet">
            <div className="abandon-confirm">
              <span>Avbryta passet? All data går förlorad.</span>
              <div className="abandon-confirm-btns">
                <button className="delete-confirm-no" onClick={() => setSheet(null)}>Nej</button>
                <button className="delete-confirm-yes" onClick={onAbandon}>Ja, avbryt</button>
              </div>
            </div>
          </div>
        )}

        {sheet === "finish" && (
          <div className="session-sheet">
            <div className="finish-panel">
              <div className="finish-panel-summary">
                <div className="finish-panel-stat">
                  <span className="finish-panel-val">{exDone}</span>
                  <span className="finish-panel-label">övningar</span>
                </div>
                <div className="finish-panel-stat">
                  <span className="finish-panel-val">{totalDone}</span>
                  <span className="finish-panel-label">set</span>
                </div>
                {totalVolume > 0 && (
                  <div className="finish-panel-stat">
                    <span className="finish-panel-val">{Math.round(totalVolume).toLocaleString("sv-SE")}</span>
                    <span className="finish-panel-label">kg volym</span>
                  </div>
                )}
              </div>
              <div className="finish-panel-btns">
                <button className="finish-panel-back" onClick={() => setSheet(null)}>Fortsätt träna</button>
                <button className="finish-panel-save" onClick={finish}>Spara pass ✓</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {focusMode && (
        <div className="focus-nav">
          <button className="focus-nav-btn" disabled={focusIdx === 0} onClick={() => setFocusIdx((i) => i - 1)}>←</button>
          <span className="focus-nav-counter">{focusIdx + 1} / {exercises.length}</span>
          <button className="focus-nav-btn" disabled={focusIdx === exercises.length - 1} onClick={() => setFocusIdx((i) => i + 1)}>→</button>
        </div>
      )}

      <div className="exercises">
        {exercises.map((ex, exIdx) => {
          if (focusMode && exIdx !== focusIdx) return null;
          const isSupTop = supersets.has(exIdx);
          const isSupBottom = exIdx > 0 && supersets.has(exIdx - 1);
          const canSuperset = exIdx < exercises.length - 1;
          const exSets = sets[exIdx]?.sets ?? [];
          const doneCount = exSets.filter((s) => s.done).length;
          const exStatus = doneCount === 0 ? "" : doneCount === exSets.length ? " ex-done" : " ex-started";
          const prevText = previousLine(sets[exIdx], ex.bodyweight);
          const suggestion = ex.bodyweight ? null : analyzeSuggestion(exSets, ex.repsRange);
          const prs = prSets(ex, exSets);
          const labels = setLabels(exSets);

          return (
            <div
              key={ex.id}
              ref={(el) => (cardRefs.current[exIdx] = el)}
              className={`exercise-card${isSupTop ? " superset-top" : ""}${isSupBottom ? " superset-bottom" : ""}${exStatus}`}
            >
              <div className="exercise-name">
                <button className="remove-exercise-btn" onClick={() => removeExercise(exIdx)} title="Ta bort övning">✕</button>
                <div className="exercise-move-btns">
                  <button className="move-btn" disabled={exIdx === 0} onClick={() => moveExercise(exIdx, -1)} title="Flytta upp">▲</button>
                  <button className="move-btn" disabled={exIdx === exercises.length - 1} onClick={() => moveExercise(exIdx, 1)} title="Flytta ned">▼</button>
                </div>
                {editingName === ex.id ? (
                  <input
                    className="name-edit-input"
                    value={nameInput}
                    autoFocus
                    onChange={(e) => setNameInput(e.target.value)}
                    onBlur={() => { if (nameInput.trim()) onRename(ex.id, nameInput.trim()); setEditingName(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") setEditingName(null); }}
                  />
                ) : (
                  <>
                    {customNames[ex.id] ?? ex.name}
                    {(isSupTop || isSupBottom) && <span className="superset-badge">SS</span>}
                    <button className="rename-btn" onClick={() => { setNameInput(customNames[ex.id] ?? ex.name); setEditingName(ex.id); }} title="Byt namn"><IconPencil /></button>
                  </>
                )}
              </div>
              <div className="exercise-meta">
                <span>{ex.sets} set · {ex.repsRange} reps · Vila: {ex.rest}</span>
                {canSuperset && (
                  <button
                    className={`superset-btn${isSupTop ? " superset-btn--active" : ""}`}
                    onClick={() => toggleSuperset(exIdx)}
                    title={isSupTop ? "Ta bort superset" : "Koppla superset med nästa övning"}
                  >
                    {isSupTop ? "✕ Superset" : "+ Superset"}
                  </button>
                )}
              </div>

              {(prevText || suggestion) && (
                <div className="suggest-section">
                  {prevText && <div className="prev-line">{prevText}</div>}
                  {suggestion && (
                    <button
                      className={`suggest-row suggest-row--${suggestion.action}`}
                      aria-expanded={suggestIdx === exIdx}
                      onClick={() => setSuggestIdx(suggestIdx === exIdx ? null : exIdx)}
                    >
                      <span className="suggest-row-text">
                        <span className="suggest-row-arrow">{SUGGEST_ARROW[suggestion.action]}</span>{" "}
                        <strong>{suggestion.suggested}kg</strong> · {suggestion.reason}
                      </span>
                      <span className="suggest-row-chevron" aria-hidden="true">›</span>
                    </button>
                  )}

                  {suggestion && suggestIdx === exIdx && (() => {
                    const plates = calcPlates(suggestion.suggested);
                    const perSide = plates ? (suggestion.suggested - BAR_WEIGHT) / 2 : null;

                    return (
                      <div className="suggest-panel">
                        <div className="suggest-weight">
                          {suggestion.prevWeight}kg → <strong>{suggestion.suggested}kg</strong>
                        </div>
                        {plates && (
                          <div className="suggest-plates">
                            <div className="suggest-plates-label">Skivor per sida ({perSide} kg):</div>
                            <div className="suggest-plates-chips">
                              {plates.map(({ plate, count }) => (
                                <span key={plate} className="suggest-plate-chip">{plate}kg × {count}</span>
                              ))}
                            </div>
                            <div className="plate-visual">
                              {plates.flatMap(({ plate, count }) =>
                                Array.from({ length: count }, (_, i) => (
                                  <div key={`${plate}-${i}`} className="plate-disc" style={{ "--h": `${Math.max(20, Math.min(64, plate * 3))}px` }}>
                                    {plate}
                                  </div>
                                ))
                              )}
                              <div className="plate-bar-end" />
                            </div>
                          </div>
                        )}
                        {!plates && suggestion.suggested > BAR_WEIGHT && (
                          <div className="suggest-plates-label">Kan inte nås exakt med tillgängliga skivor</div>
                        )}
                        {suggestion.suggested <= BAR_WEIGHT && (
                          <div className="suggest-plates-label">Bara stången ({BAR_WEIGHT} kg)</div>
                        )}
                        <button
                          className="suggest-apply-btn"
                          onClick={() => {
                            setSets(prev => prev.map((exData, i) => {
                              if (i !== exIdx) return exData;
                              return { ...exData, sets: exData.sets.map(s => isWarmup(s) ? s : { ...s, weight: String(suggestion.suggested) }) };
                            }));
                            setSuggestIdx(null);
                          }}
                        >
                          Använd {suggestion.suggested}kg på alla arbetsset
                        </button>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className={`sets-grid${ex.bodyweight ? " sets-grid--bw" : ""}`}>
                <div className="sets-header">
                  <span>Set</span>
                  {!ex.bodyweight && <span>Vikt (kg)</span>}
                  <span>Reps</span>
                  <span>RIR</span>
                  <span>✓</span>
                </div>
                {sets[exIdx]?.sets.map((s, setIdx) => {
                  const prev = setIdx > 0 ? sets[exIdx].sets[setIdx - 1] : null;
                  const canCopy = prev && (prev.weight || prev.reps);
                  const warm = isWarmup(s);
                  const setName = warm ? "uppvärmning" : `set ${labels[setIdx]}`;
                  return (
                    <div key={setIdx} className={`set-row${ex.bodyweight ? " set-row--bw" : ""}${warm ? " set-row--warmup" : ""} ${s.done ? "set-done" : ""}`}>
                      <div className="set-number">
                        <button type="button" className="set-number-btn" title="Växla uppvärmning"
                          aria-label={`Uppvärmning, rad ${setIdx + 1}`} aria-pressed={warm}
                          onClick={() => toggleWarmup(exIdx, setIdx)}>{labels[setIdx]}</button>
                        {canCopy && (
                          <button type="button" className="copy-prev-btn" title="Kopiera föregående rad" onClick={() => copyPrev(exIdx, setIdx)}>↓</button>
                        )}
                      </div>
                      {!ex.bodyweight && (
                        <div className="set-stepper set-stepper--weight">
                          <button type="button" className="step-btn" aria-label={`Minska vikt, ${setName}`}
                            onClick={() => adjust(exIdx, setIdx, "weight", -1)}>−</button>
                          <input type="number" min="0" step="0.5" aria-label={`Vikt i kg, ${setName}`}
                            placeholder={s.prevWeight || "—"} value={s.weight}
                            onChange={(e) => update(exIdx, setIdx, "weight", e.target.value)} />
                          <button type="button" className="step-btn" aria-label={`Öka vikt, ${setName}`}
                            onClick={() => adjust(exIdx, setIdx, "weight", 1)}>+</button>
                        </div>
                      )}
                      <div className="set-stepper set-stepper--reps">
                        <button type="button" className="step-btn" aria-label={`Minska reps, ${setName}`}
                          onClick={() => adjust(exIdx, setIdx, "reps", -1)}>−</button>
                        <input type="number" min="0" aria-label={`Antal reps, ${setName}`}
                          placeholder={s.prevReps || "—"} value={s.reps}
                          onChange={(e) => update(exIdx, setIdx, "reps", e.target.value)} />
                        <button type="button" className="step-btn" aria-label={`Öka reps, ${setName}`}
                          onClick={() => adjust(exIdx, setIdx, "reps", 1)}>+</button>
                      </div>
                      <button type="button" className={`rir-btn${s.rir == null ? " rir-btn--empty" : ""}`}
                        aria-label={`RIR, ${setName}: ${s.rir == null ? "ej angivet" : rirLabel(s.rir)}`}
                        onClick={() => update(exIdx, setIdx, "rir", (cur) => nextRir(cur.rir))}>{rirLabel(s.rir)}</button>
                      <button className={`done-btn ${s.done ? "done-active" : ""}`}
                        onClick={() => toggleDone(exIdx, setIdx)}>✓</button>
                      {prs.has(setIdx) && <span className="pr-badge set-pr-badge">PR</span>}
                    </div>
                  );
                })}
                <div className="set-adjust-row">
                  <button className="set-adjust-btn" onClick={() => removeSet(exIdx)}
                    disabled={sets[exIdx]?.sets.length <= 1 || (() => { const l = sets[exIdx]?.sets.at(-1); return !!(l?.weight || l?.reps || l?.done); })()}>− Set</button>
                  <button className="set-adjust-btn" onClick={() => addSet(exIdx)}>+ Set</button>
                </div>
              </div>

              {sets[exIdx]?.previousComment && (
                <div className="prev-comment">
                  <span className="prev-comment-label">Förra gången:</span> {sets[exIdx].previousComment}
                </div>
              )}
              <textarea
                className="exercise-comment"
                placeholder="Anteckning (t.ex. känsla, teknik, justering...)"
                value={sets[exIdx]?.comment ?? ""}
                onChange={(e) => updateComment(exIdx, e.target.value)}
              />
              {focusMode && (
                <button
                  className="focus-next-btn"
                  onClick={() => focusIdx < exercises.length - 1 ? setFocusIdx((i) => i + 1) : setFocusMode(false)}
                >
                  {focusIdx < exercises.length - 1 ? "Nästa övning →" : "Visa alla övningar"}
                </button>
              )}
            </div>
          );
        })}

        {!focusMode && showAddForm ? (
          <form className="inline-add-form" onSubmit={addExerciseInline}>
            <div className="edit-form-title">Ny övning</div>
            {formError && <p className="edit-error">{formError}</p>}
            <input className="edit-input" placeholder="Namn på övningen" autoFocus
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <div className="edit-row-inputs">
              <label><span>Set</span>
                <input className="edit-input edit-input-small" type="number" min="1"
                  value={form.sets} onChange={(e) => setForm({ ...form, sets: e.target.value })} />
              </label>
              <label><span>Reps</span>
                <input className="edit-input edit-input-small" placeholder="8–12"
                  value={form.repsRange} onChange={(e) => setForm({ ...form, repsRange: e.target.value })} />
              </label>
              <label><span>Vila</span>
                <input className="edit-input edit-input-small" placeholder="60 sek"
                  value={form.rest} onChange={(e) => setForm({ ...form, rest: e.target.value })} />
              </label>
            </div>
            <label className="bw-toggle">
              <input type="checkbox" checked={form.bodyweight} onChange={(e) => setForm({ ...form, bodyweight: e.target.checked })} />
              Kroppsviktsövning (ingen vikt)
            </label>
            <div className="inline-add-actions">
              <button type="button" className="inline-cancel-btn" onClick={() => { setShowAddForm(false); setFormError(""); }}>Avbryt</button>
              <button type="submit" className="edit-add-btn">Lägg till</button>
            </div>
          </form>
        ) : (
          !focusMode && (
            <button className="add-exercise-btn" onClick={() => setShowAddForm(true)}>
              + Lägg till övning
            </button>
          )
        )}
      </div>

      <div className="session-stats-bar">
        <div className="session-stat">
          <span className="session-stat-value">{exDone}/{exercises.length}</span>
          <span className="session-stat-label">övningar</span>
        </div>
        <div className="session-stat">
          <span className="session-stat-value">{totalDone}/{totalSets}</span>
          <span className="session-stat-label">set</span>
        </div>
        {totalVolume > 0 && (
          <div className="session-stat">
            <span className="session-stat-value">{Math.round(totalVolume).toLocaleString("sv-SE")}</span>
            <span className="session-stat-label">kg volym</span>
          </div>
        )}
      </div>

      <div className="session-note-wrap">
        <textarea
          className="session-note"
          placeholder="Anteckning om passet (känsla, sömn, energi...)"
          value={sessionNote}
          onChange={(e) => setSessionNote(e.target.value)}
          rows={2}
        />
      </div>

    </div>
  );
}
