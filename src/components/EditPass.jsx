import { useState } from "react";

const EMPTY_FORM = { name: "", sets: "3", repsRange: "8–12", rest: "60 sek", bodyweight: false };

export default function EditPass({ template, customExercises, onAdd, onRemove, onReorder, onUpdate, onBack }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [editingExId, setEditingExId] = useState(null);
  const [editForm, setEditForm] = useState(null);

  const allExercises = [
    ...template.exercises.map((e) => ({ ...e, isDefault: true })),
    ...(customExercises ?? []).map((e) => ({ ...e, isDefault: false })),
  ];

  const customList = customExercises ?? [];

  function moveCustom(customIdx, dir) {
    const next = [...customList];
    const target = customIdx + dir;
    if (target < 0 || target >= next.length) return;
    [next[customIdx], next[target]] = [next[target], next[customIdx]];
    onReorder(next);
  }

  function startEdit(ex) {
    setEditingExId(ex.id);
    setEditForm({
      name: ex.name,
      sets: String(ex.sets),
      repsRange: ex.repsRange,
      rest: ex.rest,
      bodyweight: ex.bodyweight ?? false,
    });
  }

  function saveEdit(e) {
    e.preventDefault();
    const setsNum = parseInt(editForm.sets);
    if (!setsNum || setsNum < 1) return;
    onUpdate(editingExId, {
      name: editForm.name.trim() || undefined,
      sets: setsNum,
      repsRange: editForm.repsRange.trim() || "—",
      rest: editForm.rest.trim() || "—",
      bodyweight: editForm.bodyweight,
    });
    setEditingExId(null);
    setEditForm(null);
  }

  function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Namn krävs"); return; }
    const setsNum = parseInt(form.sets);
    if (!setsNum || setsNum < 1) { setError("Ange minst 1 set"); return; }
    onAdd({
      id: crypto.randomUUID(),
      name: form.name.trim(),
      sets: setsNum,
      repsRange: form.repsRange.trim() || "—",
      rest: form.rest.trim() || "—",
      bodyweight: form.bodyweight,
    });
    setForm(EMPTY_FORM);
    setError("");
  }

  return (
    <div className="edit-pass">
      <div className="session-header">
        <button className="back-btn" onClick={onBack}>← Tillbaka</button>
        <h2>{template.name}</h2>
        <span />
      </div>

      <div className="edit-list">
        {allExercises.map((ex, i) => {
          const customIdx = ex.isDefault ? -1 : customList.findIndex((c) => c.id === ex.id);

          if (editingExId === ex.id && editForm) {
            return (
              <form key={ex.id} className="edit-exercise-edit-form" onSubmit={saveEdit}>
                <input className="edit-input" placeholder="Namn på övningen"
                  value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                <div className="edit-row-inputs">
                  <label>
                    <span>Set</span>
                    <input className="edit-input edit-input-small" type="number" min="1"
                      value={editForm.sets} onChange={(e) => setEditForm({ ...editForm, sets: e.target.value })} />
                  </label>
                  <label>
                    <span>Reps</span>
                    <input className="edit-input edit-input-small" placeholder="8–12"
                      value={editForm.repsRange} onChange={(e) => setEditForm({ ...editForm, repsRange: e.target.value })} />
                  </label>
                  <label>
                    <span>Vila</span>
                    <input className="edit-input edit-input-small" placeholder="60 sek"
                      value={editForm.rest} onChange={(e) => setEditForm({ ...editForm, rest: e.target.value })} />
                  </label>
                </div>
                <label className="bw-toggle">
                  <input type="checkbox" checked={editForm.bodyweight}
                    onChange={(e) => setEditForm({ ...editForm, bodyweight: e.target.checked })} />
                  Kroppsviktsövning (ingen vikt)
                </label>
                <div className="edit-exercise-edit-actions">
                  <button type="button" className="inline-cancel-btn" onClick={() => setEditingExId(null)}>Avbryt</button>
                  <button type="submit" className="edit-add-btn">Spara</button>
                </div>
              </form>
            );
          }

          return (
            <div key={ex.id} className="edit-exercise-row">
              <span className="edit-exercise-num">{i + 1}</span>
              <div className="edit-exercise-info">
                <div className="edit-exercise-name">
                  {ex.name}
                  {ex.bodyweight && <span className="bw-badge">BW</span>}
                </div>
                <div className="edit-exercise-meta">{ex.sets} set · {ex.repsRange} · Vila: {ex.rest}</div>
              </div>
              {ex.isDefault ? (
                <span className="edit-lock" title="Grundövning">🔒</span>
              ) : (
                <div className="edit-exercise-actions">
                  <div className="exercise-move-btns">
                    <button className="move-btn" disabled={customIdx === 0} onClick={() => moveCustom(customIdx, -1)} title="Flytta upp">▲</button>
                    <button className="move-btn" disabled={customIdx === customList.length - 1} onClick={() => moveCustom(customIdx, 1)} title="Flytta ned">▼</button>
                  </div>
                  <button className="rename-btn" onClick={() => startEdit(ex)} title="Redigera">✎</button>
                  <button className="delete-btn" onClick={() => onRemove(ex.id)}>✕</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <form className="edit-form" onSubmit={submit}>
        <div className="edit-form-title">Lägg till övning</div>
        {error && <p className="edit-error">{error}</p>}
        <input
          className="edit-input"
          placeholder="Namn på övningen"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <div className="edit-row-inputs">
          <label>
            <span>Set</span>
            <input className="edit-input edit-input-small" type="number" min="1"
              value={form.sets} onChange={(e) => setForm({ ...form, sets: e.target.value })} />
          </label>
          <label>
            <span>Reps</span>
            <input className="edit-input edit-input-small" placeholder="8–12"
              value={form.repsRange} onChange={(e) => setForm({ ...form, repsRange: e.target.value })} />
          </label>
          <label>
            <span>Vila</span>
            <input className="edit-input edit-input-small" placeholder="60 sek"
              value={form.rest} onChange={(e) => setForm({ ...form, rest: e.target.value })} />
          </label>
        </div>
        <label className="bw-toggle">
          <input type="checkbox" checked={form.bodyweight} onChange={(e) => setForm({ ...form, bodyweight: e.target.checked })} />
          Kroppsviktsövning (ingen vikt)
        </label>
        <button type="submit" className="edit-add-btn">+ Lägg till</button>
      </form>
    </div>
  );
}
