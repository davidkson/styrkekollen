import { useState } from "react";

export default function EditPass({ template, customExercises, onAdd, onRemove, onBack }) {
  const [form, setForm] = useState({ name: "", sets: "3", repsRange: "8–12", rest: "60 sek" });
  const [error, setError] = useState("");

  const allExercises = [
    ...template.exercises.map((e) => ({ ...e, isDefault: true })),
    ...(customExercises ?? []).map((e) => ({ ...e, isDefault: false })),
  ];

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
    });
    setForm({ name: "", sets: "3", repsRange: "8–12", rest: "60 sek" });
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
        {allExercises.map((ex, i) => (
          <div key={ex.id} className="edit-exercise-row">
            <span className="edit-exercise-num">{i + 1}</span>
            <div className="edit-exercise-info">
              <div className="edit-exercise-name">{ex.name}</div>
              <div className="edit-exercise-meta">{ex.sets} set · {ex.repsRange} · Vila: {ex.rest}</div>
            </div>
            {ex.isDefault ? (
              <span className="edit-lock" title="Grundövning">🔒</span>
            ) : (
              <button className="delete-btn" onClick={() => onRemove(ex.id)}>✕</button>
            )}
          </div>
        ))}
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
            <input
              className="edit-input edit-input-small"
              type="number"
              min="1"
              value={form.sets}
              onChange={(e) => setForm({ ...form, sets: e.target.value })}
            />
          </label>
          <label>
            <span>Reps</span>
            <input
              className="edit-input edit-input-small"
              placeholder="8–12"
              value={form.repsRange}
              onChange={(e) => setForm({ ...form, repsRange: e.target.value })}
            />
          </label>
          <label>
            <span>Vila</span>
            <input
              className="edit-input edit-input-small"
              placeholder="60 sek"
              value={form.rest}
              onChange={(e) => setForm({ ...form, rest: e.target.value })}
            />
          </label>
        </div>
        <button type="submit" className="edit-add-btn">+ Lägg till</button>
      </form>
    </div>
  );
}
