import { useState } from "react";
import { workoutTemplates } from "../data/workouts";

const ICONS = { dark: "🌙", light: "☀️", ember: "🔥", fresh: "✨", invit: "🌸" };
const demoTemplates = workoutTemplates.filter((t) => t.demo);

export default function Home({ onStart, onResume, onEdit, onCreateTemplate, onDuplicateTemplate, onDeleteTemplate, onLogout, onToggleTheme, theme, logs, activeSession, customExercises, customTemplates }) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);

  function lastDate(templateId) {
    const entries = logs.filter((l) => l.templateId === templateId);
    if (!entries.length) return null;
    const last = entries.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    return new Date(last.date).toLocaleDateString("sv-SE");
  }

  function exerciseCount(t) {
    return t.exercises.length + (customExercises?.[t.id]?.length ?? 0);
  }

  async function submitCreate(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    await onCreateTemplate(newName.trim());
    setNewName("");
    setShowCreateForm(false);
  }

  const allTemplates = [
    ...(customTemplates ?? []),
    ...demoTemplates,
  ];

  const builtinIds = new Set(["pass1", "pass2", "pass3"]);
  const isCustom = (t) => !t.demo && (customTemplates ?? []).some((c) => c.id === t.id);
  const isUserCreated = (t) => isCustom(t) && !builtinIds.has(t.id);

  return (
    <div className="home">
      <div className="home-header">
        <h1 className="home-title">Styrkekollen</h1>
        <div className="home-header-actions">
          <button className="theme-btn" onClick={onToggleTheme} title="Byt tema">
            {ICONS[theme] ?? "🌙"}
          </button>
          <button className="logout-btn" onClick={onLogout} title="Logga ut">↩</button>
        </div>
      </div>

      {activeSession ? (
        <>
          <div className="active-session-banner">
            <div className="active-session-info">
              <span className="active-dot" />
              <div>
                <div className="active-session-name">{activeSession.templateName}</div>
                <div className="active-session-sub">
                  Startat {new Date(activeSession.startedAt).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })} — passet är inte klart än
                </div>
              </div>
            </div>
            <button className="resume-btn" onClick={onResume}>Fortsätt →</button>
          </div>
          <p className="subtitle blocked-subtitle">Avsluta pågående pass innan du startar ett nytt</p>
          <div className="pass-list">
            {allTemplates.map((t) => (
              <div key={t.id} className="pass-card pass-card-blocked">
                <div className="pass-card-name">{t.name}</div>
                <div className="pass-card-meta">{exerciseCount(t)} övningar</div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="subtitle">Välj ett pass för att börja logga</p>
          <div className="pass-list">
            {allTemplates.map((t) => {
              const last = lastDate(t.id);
              const custom = isCustom(t);
              return (
                <div key={t.id} className="pass-card-wrapper">
                  <button className={`pass-card${t.demo ? " pass-card-demo" : ""}${custom ? " pass-card-custom" : ""}`} onClick={() => onStart(t)}>
                    <div className="pass-card-name">
                      {t.name}
                      {t.demo && <span className="demo-badge">DEMO</span>}
                      {isUserCreated(t) && <span className="custom-badge">Egen</span>}
                    </div>
                    <div className="pass-card-meta">
                      {exerciseCount(t)} övningar
                      {t.demo ? <span> · Sparas inte</span> : last && <span> · Senast: {last}</span>}
                    </div>
                    <div className="pass-card-arrow">→</div>
                  </button>
                  <div className="pass-card-side-btns">
                    {!t.demo && (
                      <button className="pass-edit-btn" onClick={() => onEdit(t)} title="Redigera pass">✎</button>
                    )}
                    <button className="pass-dup-btn" onClick={() => onDuplicateTemplate(t)} title="Duplicera pass">⧉</button>
                    {custom && (
                      confirmingDeleteId === t.id ? (
                        <div className="delete-confirm">
                          <span>Ta bort?</span>
                          <button className="delete-confirm-yes" onClick={() => { onDeleteTemplate(t.id); setConfirmingDeleteId(null); }}>Ja</button>
                          <button className="delete-confirm-no" onClick={() => setConfirmingDeleteId(null)}>Nej</button>
                        </div>
                      ) : (
                        <button className="pass-delete-btn" onClick={() => setConfirmingDeleteId(t.id)} title="Ta bort pass">✕</button>
                      )
                    )}
                  </div>
                </div>
              );
            })}

            {showCreateForm ? (
              <form className="create-template-form" onSubmit={submitCreate}>
                <input
                  className="edit-input"
                  placeholder="Namn på passet"
                  value={newName}
                  autoFocus
                  onChange={(e) => setNewName(e.target.value)}
                />
                <div className="create-template-actions">
                  <button type="button" className="inline-cancel-btn" onClick={() => { setShowCreateForm(false); setNewName(""); }}>Avbryt</button>
                  <button type="submit" className="edit-add-btn" disabled={!newName.trim()}>Skapa & lägg till övningar</button>
                </div>
              </form>
            ) : (
              <button className="create-template-btn" onClick={() => setShowCreateForm(true)}>
                + Nytt pass
              </button>
            )}
          </div>
          {logs.length > 0 && (
            <div className="history-summary">
              <p>{logs.length} pass loggade totalt</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
