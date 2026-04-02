import { useState, useEffect } from "react";
import { haptic } from "../lib/haptic";

const EMPTY_FORM = { name: "", sets: "3", repsRange: "8–12", rest: "60 sek" };
const ICONS = { dark: "🌙", light: "☀️", ember: "🔥", fresh: "✨", invit: "🌸" };

function parseRestSeconds(restStr) {
  if (!restStr || restStr === "—") return null;
  const minMatch = restStr.match(/(\d+)(?:[–-]\d+)?\s*min/i);
  if (minMatch) return parseInt(minMatch[1]) * 60;
  const sekMatch = restStr.match(/(\d+)(?:[–-]\d+)?\s*sek/i);
  if (sekMatch) return parseInt(sekMatch[1]);
  return null;
}

export default function WorkoutSession({ template, savedSets, previousLog, customNames, startedAt, onRename, onSave, onAddExercise, onFinish, onCancel, onToggleTheme, theme, onAutoStartTimer }) {
  const [editingName, setEditingName] = useState(null);
  const [nameInput, setNameInput] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [supersets, setSupersets] = useState(new Set());

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
          return { weight: prev?.weight ?? "", reps: prev?.reps ?? "", done: false };
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

  function toggleDone(exIdx, setIdx) {
    let becomingDone = false;
    setSets((prev) =>
      prev.map((ex, i) => {
        if (i !== exIdx) return ex;
        return {
          ...ex,
          sets: ex.sets.map((s, j) => {
            if (j !== setIdx) return s;
            becomingDone = !s.done;
            return { ...s, done: !s.done };
          }),
        };
      })
    );
    if (becomingDone) {
      haptic(40);
      const restSeconds = parseRestSeconds(exercises[exIdx]?.rest);
      if (restSeconds) onAutoStartTimer(restSeconds);
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
    });
  }

  const totalDone = sets.reduce((sum, ex) => sum + ex.sets.filter((s) => s.done).length, 0);
  const totalSets = sets.reduce((sum, ex) => sum + ex.sets.length, 0);

  return (
    <div className="session">
      <div className="session-header">
        <button className="back-btn" onClick={onCancel}>← Pausa</button>
        <h2>{template.name}</h2>
        <div className="session-header-right">
          <span className="progress-badge">{totalDone}/{totalSets} set</span>
          <button className="theme-btn" onClick={onToggleTheme} title="Byt tema">
            {ICONS[theme] ?? "🌙"}
          </button>
        </div>
      </div>

      <div className="exercises">
        {exercises.map((ex, exIdx) => {
          const isSupTop = supersets.has(exIdx);
          const isSupBottom = exIdx > 0 && supersets.has(exIdx - 1);
          const canSuperset = exIdx < exercises.length - 1;

          return (
            <div
              key={ex.id}
              className={`exercise-card${isSupTop ? " superset-top" : ""}${isSupBottom ? " superset-bottom" : ""}`}
            >
              <div className="exercise-name">
                <button className="remove-exercise-btn" onClick={() => removeExercise(exIdx)} title="Ta bort övning">✕</button>
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

              <div className="sets-grid">
                <div className="sets-header">
                  <span>Set</span>
                  <span>Vikt (kg)</span>
                  <span>Reps</span>
                  <span>✓</span>
                </div>
                {sets[exIdx]?.sets.map((s, setIdx) => {
                  const prev = setIdx > 0 ? sets[exIdx].sets[setIdx - 1] : null;
                  const canCopy = prev && (prev.weight || prev.reps);
                  return (
                    <div key={setIdx} className={`set-row ${s.done ? "set-done" : ""}`}>
                      <span className="set-number">
                        {setIdx + 1}
                        {canCopy && (
                          <button className="copy-prev-btn" title="Kopiera föregående rad" onClick={() => copyPrev(exIdx, setIdx)}>↓</button>
                        )}
                      </span>
                      <input type="number" min="0" step="0.5" placeholder="—" value={s.weight}
                        onChange={(e) => update(exIdx, setIdx, "weight", e.target.value)} />
                      <input type="number" min="0" placeholder="—" value={s.reps}
                        onChange={(e) => update(exIdx, setIdx, "reps", e.target.value)} />
                      <button className={`done-btn ${s.done ? "done-active" : ""}`}
                        onClick={() => toggleDone(exIdx, setIdx)}>✓</button>
                    </div>
                  );
                })}
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
            </div>
          );
        })}

        {showAddForm ? (
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
            <div className="inline-add-actions">
              <button type="button" className="inline-cancel-btn" onClick={() => { setShowAddForm(false); setFormError(""); }}>Avbryt</button>
              <button type="submit" className="edit-add-btn">Lägg till</button>
            </div>
          </form>
        ) : (
          <button className="add-exercise-btn" onClick={() => setShowAddForm(true)}>
            + Lägg till övning
          </button>
        )}
      </div>

      <div className="session-footer">
        <label className="confirm-label">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
          Passet är klart
        </label>
        <button className="finish-btn" disabled={!confirmed} onClick={finish}>
          Spara pass
        </button>
      </div>
    </div>
  );
}
