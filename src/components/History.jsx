import { useState } from "react";
import { workoutTemplates } from "../data/workouts";

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(startedAt, finishedAt) {
  const ms = new Date(finishedAt) - new Date(startedAt);
  if (ms <= 0) return null;
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export default function History({ logs, customNames, customExercises, onBack, onDelete }) {
  const [confirmingId, setConfirmingId] = useState(null);
  const sorted = [...logs].sort((a, b) => new Date(b.date) - new Date(a.date));

  function exerciseName(templateId, exerciseId) {
    if (customNames?.[exerciseId]) return customNames[exerciseId];
    const t = workoutTemplates.find((t) => t.id === templateId);
    const fromTemplate = t?.exercises.find((e) => e.id === exerciseId)?.name;
    if (fromTemplate) return fromTemplate;
    const fromCustom = customExercises?.[templateId]?.find((e) => e.id === exerciseId)?.name;
    return fromCustom ?? exerciseId;
  }

  return (
    <div className="history">
      <div className="session-header">
        <button className="back-btn" onClick={onBack}>← Tillbaka</button>
        <h2>Historik</h2>
        <span />
      </div>

      {sorted.length === 0 && (
        <p className="empty">Inga pass loggade ännu.</p>
      )}

      {sorted.map((log) => (
        <div key={log.id} className="history-entry">
          <div className="history-entry-header">
            <div>
              <div className="history-entry-name">{log.templateName}</div>
              <div className="history-entry-date">
                {new Date(log.date).toLocaleDateString("sv-SE", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </div>
              {log.startedAt && log.finishedAt && (
                <div className="history-entry-duration">
                  {formatTime(log.startedAt)} – {formatTime(log.finishedAt)}
                  {formatDuration(log.startedAt, log.finishedAt) && (
                    <span className="duration-badge">
                      {formatDuration(log.startedAt, log.finishedAt)}
                    </span>
                  )}
                </div>
              )}
            </div>
            {confirmingId === log.id ? (
              <div className="delete-confirm">
                <span>Ta bort?</span>
                <button className="delete-confirm-yes" onClick={() => { onDelete(log.id); setConfirmingId(null); }}>Ja</button>
                <button className="delete-confirm-no" onClick={() => setConfirmingId(null)}>Nej</button>
              </div>
            ) : (
              <button className="delete-btn" onClick={() => setConfirmingId(log.id)}>✕</button>
            )}
          </div>

          <div className="history-exercises">
            {log.exercises.map((ex) => {
              const doneSets = ex.sets.filter((s) => s.done || s.weight || s.reps);
              if (!doneSets.length) return null;
              return (
                <div key={ex.exerciseId} className="history-exercise">
                  <span className="history-ex-name">{exerciseName(log.templateId, ex.exerciseId)}</span>
                  <span className="history-ex-sets">
                    {doneSets.map((s, i) => (
                      <span key={i} className="history-set-chip">
                        {s.weight ? `${s.weight}kg` : "—"} × {s.reps || "—"}
                      </span>
                    ))}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
