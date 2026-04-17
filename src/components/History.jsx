import { useState } from "react";

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

function toInputValue(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function est1RM(sets) {
  let best = 0;
  for (const s of sets) {
    const w = parseFloat(s.weight);
    const r = parseInt(s.reps);
    if (w > 0 && r > 1) {
      const orm = w * (1 + r / 30);
      if (orm > best) best = orm;
    }
  }
  return best > 0 ? Math.round(best * 10) / 10 : null;
}

function getPRs(log, allLogs) {
  const olderLogs = allLogs.filter((l) => new Date(l.date) < new Date(log.date));
  const prs = {};
  for (const ex of log.exercises) {
    const currentMax = Math.max(...ex.sets.map((s) => parseFloat(s.weight) || 0));
    if (currentMax === 0) continue;
    let prevMax = 0;
    for (const older of olderLogs) {
      const olderEx = older.exercises.find((e) => e.exerciseId === ex.exerciseId);
      if (olderEx) {
        const w = Math.max(...olderEx.sets.map((s) => parseFloat(s.weight) || 0));
        if (w > prevMax) prevMax = w;
      }
    }
    if (currentMax > prevMax && prevMax > 0) prs[ex.exerciseId] = currentMax;
  }
  return prs;
}

export default function History({ logs, customNames, customExercises, onBack, onDelete, onUpdateTimestamps, onProgress }) {
  const [confirmingId, setConfirmingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [expandedIds, setExpandedIds] = useState(new Set());

  const sorted = [...logs].sort((a, b) => new Date(b.date) - new Date(a.date));

  function toggleExpand(id) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function startEditing(log) {
    setEditingId(log.id);
    setEditStart(log.startedAt ? toInputValue(log.startedAt) : "");
    setEditEnd(log.finishedAt ? toInputValue(log.finishedAt) : "");
  }

  function saveEditing() {
    onUpdateTimestamps(editingId, new Date(editStart).toISOString(), new Date(editEnd).toISOString());
    setEditingId(null);
  }

  function exerciseName(templateId, exerciseId) {
    if (customNames?.[exerciseId]) return customNames[exerciseId];
    return customExercises?.[templateId]?.find((e) => e.id === exerciseId)?.name ?? exerciseId;
  }

  return (
    <div className="history">
      <div className="session-header">
        <button className="back-btn" onClick={onBack}>← Tillbaka</button>
        <h2>Historik</h2>
        <span />
      </div>

      {logs.length > 0 && (
        <button className="progress-nav-btn" onClick={onProgress}>
          📈 Övningsutveckling
        </button>
      )}

      {sorted.length === 0 && <p className="empty">Inga pass loggade ännu.</p>}

      {sorted.map((log) => {
        const expanded = expandedIds.has(log.id);
        const prs = getPRs(log, logs);
        const hasPR = Object.keys(prs).length > 0;
        const doneSets = log.exercises.reduce((n, ex) => n + ex.sets.filter((s) => s.done || s.weight || s.reps).length, 0);
        const exCount = log.exercises.filter((ex) => ex.sets.some((s) => s.done || s.weight || s.reps)).length;
        const volume = log.exercises.reduce((sum, ex) =>
          sum + ex.sets.filter((s) => s.weight && s.reps)
            .reduce((s2, s) => s2 + parseFloat(s.weight) * parseInt(s.reps), 0), 0);

        return (
          <div key={log.id} className={`history-entry${expanded ? " history-entry--expanded" : ""}`}>
            {/* Header row — always visible */}
            <div className="history-entry-header" onClick={() => toggleExpand(log.id)} style={{ cursor: "pointer" }}>
              <div className="history-entry-meta">
                <div className="history-entry-top">
                  <span className="history-entry-name">{log.templateName}</span>
                  {hasPR && <span className="pr-flag">🏆 PR</span>}
                </div>
                <div className="history-entry-date">
                  {new Date(log.date).toLocaleDateString("sv-SE", {
                    weekday: "long", year: "numeric", month: "long", day: "numeric",
                  })}
                </div>
                <div className="history-entry-summary">
                  {log.startedAt && log.finishedAt && (
                    <>
                      <span>{formatTime(log.startedAt)} – {formatTime(log.finishedAt)}</span>
                      {formatDuration(log.startedAt, log.finishedAt) && (
                        <span className="duration-badge">{formatDuration(log.startedAt, log.finishedAt)}</span>
                      )}
                      <span className="summary-sep">·</span>
                    </>
                  )}
                  <span>{exCount} övn · {doneSets} set</span>
                  {volume > 0 && (
                    <>
                      <span className="summary-sep">·</span>
                      <span>{Math.round(volume).toLocaleString("sv-SE")} kg</span>
                    </>
                  )}
                </div>
              </div>
              <div className="history-entry-actions" onClick={(e) => e.stopPropagation()}>
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
            </div>

            {/* Expandable body */}
            {expanded && (
              <div className="history-entry-body">
                {/* Timestamp editor */}
                {editingId === log.id ? (
                  <div className="timestamp-edit">
                    <label><span>Start</span>
                      <input type="datetime-local" value={editStart} onChange={(e) => setEditStart(e.target.value)} />
                    </label>
                    <label><span>Slut</span>
                      <input type="datetime-local" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} />
                    </label>
                    <div className="timestamp-edit-actions">
                      <button className="delete-confirm-no" onClick={() => setEditingId(null)}>Avbryt</button>
                      <button className="delete-confirm-yes" style={{ background: "var(--green)" }} onClick={saveEditing}>Spara</button>
                    </div>
                  </div>
                ) : log.startedAt && log.finishedAt ? (
                  <div className="history-entry-duration">
                    {formatTime(log.startedAt)} – {formatTime(log.finishedAt)}
                    {formatDuration(log.startedAt, log.finishedAt) && (
                      <span className="duration-badge">{formatDuration(log.startedAt, log.finishedAt)}</span>
                    )}
                    <button className="timestamp-edit-btn" onClick={() => startEditing(log)} title="Ändra tider">✎</button>
                  </div>
                ) : null}

                {/* Session note */}
                {log.note && (
                  <div className="history-session-note">
                    <span className="history-session-note-label">Anteckning</span>
                    {log.note}
                  </div>
                )}

                {/* Exercise details */}
                <div className="history-exercises">
                  {log.exercises.map((ex) => {
                    const doneSets = ex.sets.filter((s) => s.done || s.weight || s.reps);
                    if (!doneSets.length) return null;
                    const isPR = !!prs[ex.exerciseId];
                    return (
                      <div key={ex.exerciseId} className={`history-exercise${isPR ? " history-exercise--pr" : ""}`}>
                        <span className="history-ex-name">
                          {exerciseName(log.templateId, ex.exerciseId)}
                          {isPR && <span className="pr-badge">PR {prs[ex.exerciseId]}kg</span>}
                        </span>
                        <span className="history-ex-sets">
                          {doneSets.map((s, i) => (
                            <span key={i} className="history-set-chip">
                              {s.weight ? `${s.weight}kg × ` : ""}{s.reps || "—"}{!s.weight ? " reps" : ""}
                            </span>
                          ))}
                          {(() => { const orm = est1RM(doneSets); return orm ? <span className="orm-badge">1RM ~{orm}kg</span> : null; })()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Expand toggle */}
            <button className="history-expand-btn" onClick={() => toggleExpand(log.id)}>
              {expanded ? "▲ Dölj" : "▼ Visa detaljer"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
