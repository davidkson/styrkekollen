import { useState, useEffect, useRef } from "react";
import { haptic } from "../lib/haptic";

const EMPTY_FORM = { name: "", sets: "3", repsRange: "8–12", rest: "60 sek", bodyweight: false };
const ICONS = { dark: "🌙", light: "☀️", ember: "🔥", fresh: "✨", invit: "🌸" };

function parseRestSeconds(restStr) {
  if (!restStr || restStr === "—") return null;
  const minMatch = restStr.match(/(\d+)(?:[–-]\d+)?\s*min/i);
  if (minMatch) return parseInt(minMatch[1]) * 60;
  const sekMatch = restStr.match(/(\d+)(?:[–-]\d+)?\s*sek/i);
  if (sekMatch) return parseInt(sekMatch[1]);
  return null;
}

export default function WorkoutSession({ template, savedSets, previousLog, customNames, startedAt, onRename, onSave, onAddExercise, onFinish, onCancel, onAbandon, onToggleTheme, theme, onAutoStartTimer }) {
  const [editingName, setEditingName] = useState(null);
  const [nameInput, setNameInput] = useState("");
  const [sessionNote, setSessionNote] = useState("");
  const [showFinishPanel, setShowFinishPanel] = useState(false);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [focusIdx, setFocusIdx] = useState(0);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [supersets, setSupersets] = useState(new Set());

  const cardRefs = useRef([]);
  const [exercises, setExercises] = useState(() => [...template.exercises]);
  const [sets, setSets] = useState(() => {
    if (savedSets) return savedSets;
    return template.exercises.map((ex) => {
      const prevEx = previousLog?.exercises?.find((e) => e.exerciseId === ex.id);
      return {
        exerciseId: ex.id,
        comment: "",
        previousComment: prevEx?.comment ?? "",
        sets: Array.from({ length: ex.sets }, (_, i) => {
          const prev = prevEx?.sets?.[i];
          return { weight: "", reps: "", done: false, prevWeight: prev?.weight ?? "", prevReps: prev?.reps ?? "" };
        }),
      };
    });
  });

  useEffect(() => { onSave(sets); }, [sets]);

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
    setSets((prev) => [...prev, {
      exerciseId: newEx.id,
      comment: "",
      previousComment: "",
      sets: Array.from({ length: setsNum }, () => ({ weight: "", reps: "", done: false })),
    }]);
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
          sets: ex.sets.map((s, j) => j !== setIdx ? s : { ...s, [field]: value }),
        }
      )
    );
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

  function addSet(exIdx) {
    setSets((prev) => prev.map((ex, i) => {
      if (i !== exIdx) return ex;
      const last = ex.sets[ex.sets.length - 1];
      return { ...ex, sets: [...ex.sets, { weight: "", reps: "", done: false, prevWeight: last?.prevWeight ?? "", prevReps: last?.prevReps ?? "" }] };
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

  function toggleDone(exIdx, setIdx) {
    let becomingDone = false;
    let allDoneAfter = false;
    setSets((prev) =>
      prev.map((ex, i) => {
        if (i !== exIdx) return ex;
        const newSets = ex.sets.map((s, j) => {
          if (j !== setIdx) return s;
          becomingDone = !s.done;
          return { ...s, done: !s.done };
        });
        allDoneAfter = becomingDone && newSets.every((s) => s.done);
        return { ...ex, sets: newSets };
      })
    );
    if (becomingDone) {
      haptic(40);
      const restSeconds = parseRestSeconds(exercises[exIdx]?.rest);
      if (restSeconds) onAutoStartTimer(restSeconds);
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

  const totalDone = sets.reduce((sum, ex) => sum + ex.sets.filter((s) => s.done).length, 0);
  const totalSets = sets.reduce((sum, ex) => sum + ex.sets.length, 0);
  const exDone = sets.filter((ex) => ex.sets.some((s) => s.done)).length;
  const totalVolume = sets.reduce((sum, ex) =>
    sum + ex.sets.filter((s) => s.done && s.weight && s.reps)
      .reduce((s2, s) => s2 + parseFloat(s.weight) * parseInt(s.reps), 0), 0);

  return (
    <div className="session">
      <div className="session-header">
        <button className="back-btn" onClick={onCancel}>← Pausa</button>
        <h2>{template.name}</h2>
        <div className="session-header-right">
          <span className="progress-badge">{totalDone}/{totalSets} set</span>
          <button className="focus-mode-btn" onClick={() => setFocusMode((v) => !v)} title={focusMode ? "Listläge" : "Fokusläge"}>
            {focusMode ? "☰" : "⊡"}
          </button>
          <button className="theme-btn" onClick={onToggleTheme} title="Byt tema">
            {ICONS[theme] ?? "🌙"}
          </button>
        </div>
      </div>

      <div className="session-progress-bar">
        <div className="session-progress-fill" style={{ width: `${totalSets > 0 ? (totalDone / totalSets) * 100 : 0}%` }} />
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
                    <button className="rename-btn" onClick={() => { setNameInput(customNames[ex.id] ?? ex.name); setEditingName(ex.id); }} title="Byt namn">✎</button>
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

              <div className={`sets-grid${ex.bodyweight ? " sets-grid--bw" : ""}`}>
                <div className="sets-header">
                  <span>Set</span>
                  {!ex.bodyweight && <span>Vikt (kg)</span>}
                  <span>Reps</span>
                  <span>✓</span>
                </div>
                {sets[exIdx]?.sets.map((s, setIdx) => {
                  const prev = setIdx > 0 ? sets[exIdx].sets[setIdx - 1] : null;
                  const canCopy = prev && (prev.weight || prev.reps);
                  return (
                    <div key={setIdx} className={`set-row${ex.bodyweight ? " set-row--bw" : ""} ${s.done ? "set-done" : ""}`}>
                      <span className="set-number">
                        {setIdx + 1}
                        {canCopy && (
                          <button className="copy-prev-btn" title="Kopiera föregående rad" onClick={() => copyPrev(exIdx, setIdx)}>↓</button>
                        )}
                      </span>
                      {!ex.bodyweight && (
                        <input type="number" min="0" step="0.5"
                          placeholder={s.prevWeight || "—"} value={s.weight}
                          onChange={(e) => update(exIdx, setIdx, "weight", e.target.value)} />
                      )}
                      <input type="number" min="0"
                        placeholder={s.prevReps || "—"} value={s.reps}
                        onChange={(e) => update(exIdx, setIdx, "reps", e.target.value)} />
                      <button className={`done-btn ${s.done ? "done-active" : ""}`}
                        onClick={() => toggleDone(exIdx, setIdx)}>✓</button>
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

      <div className="session-footer">
        {confirmAbandon ? (
          <div className="abandon-confirm">
            <span>Avbryta passet? All data går förlorad.</span>
            <div className="abandon-confirm-btns">
              <button className="delete-confirm-no" onClick={() => setConfirmAbandon(false)}>Tillbaka</button>
              <button className="delete-confirm-yes" onClick={onAbandon}>Avbryt pass</button>
            </div>
          </div>
        ) : showFinishPanel ? (
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
              <button className="finish-panel-back" onClick={() => setShowFinishPanel(false)}>Fortsätt träna</button>
              <button className="finish-panel-save" onClick={finish}>Spara pass ✓</button>
            </div>
          </div>
        ) : (
          <>
            <button className="finish-btn" onClick={() => setShowFinishPanel(true)}>
              Avsluta pass
            </button>
            <button className="abandon-btn" onClick={() => setConfirmAbandon(true)}>
              Avbryt pass
            </button>
          </>
        )}
      </div>
    </div>
  );
}
