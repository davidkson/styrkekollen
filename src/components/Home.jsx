import { useEffect, useRef, useState } from "react";
import { workoutTemplates } from "../data/workouts";

const demoTemplates = workoutTemplates.filter((t) => t.demo);

export default function Home({ onStart, onResume, onEdit, onCreateTemplate, onDuplicateTemplate, onDeleteTemplate, logs, activeSession, customExercises, customTemplates }) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const openMenuRef = useRef(null);

  // Close the open card menu on outside click or Escape
  useEffect(() => {
    if (openMenuId === null) return;
    function handleClick(e) {
      if (openMenuRef.current?.contains(e.target)) return;
      setOpenMenuId(null);
      // The click that dismisses the menu must not also start a workout
      if (e.target.closest?.(".pass-card")) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
    function handleKeyDown(e) {
      if (e.key === "Escape") setOpenMenuId(null);
    }
    document.addEventListener("click", handleClick, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMenuId]);

  function toggleMenu(templateId) {
    setConfirmingDeleteId(null);
    setOpenMenuId((current) => (current === templateId ? null : templateId));
  }

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

  const builtinIds = new Set(["pass1", "pass1b", "pass2", "pass2b", "upperfull", "upperfullb"]);
  const isCustom = (t) => !t.demo && (customTemplates ?? []).some((c) => c.id === t.id);
  const isUserCreated = (t) => isCustom(t) && !builtinIds.has(t.id);

  return (
    <div className="home">
      <div className="home-header">
        <h1 className="home-title">Styrkekollen</h1>
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
                <div key={t.id}>
                  <div className="pass-card-wrapper">
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
                    </button>
                    <div className="card-menu" ref={openMenuId === t.id ? openMenuRef : null}>
                      <button
                        type="button"
                        className="card-menu-btn"
                        aria-haspopup="menu"
                        aria-expanded={openMenuId === t.id}
                        aria-label={`Alternativ för ${t.name}`}
                        title="Alternativ"
                        onClick={() => toggleMenu(t.id)}
                      >
                        <span aria-hidden="true">···</span>
                      </button>
                      {openMenuId === t.id && (
                        <div className="card-menu-pop" role="menu">
                          {!t.demo && (
                            <button type="button" role="menuitem" className="card-menu-item" onClick={() => { setOpenMenuId(null); onEdit(t); }}>Redigera</button>
                          )}
                          <button type="button" role="menuitem" className="card-menu-item" onClick={() => { setOpenMenuId(null); onDuplicateTemplate(t); }}>Duplicera</button>
                          {custom && (
                            <button type="button" role="menuitem" className="card-menu-item card-menu-item--danger" onClick={() => { setOpenMenuId(null); setConfirmingDeleteId(t.id); }}>Ta bort</button>
                          )}
                        </div>
                      )}
                      {confirmingDeleteId === t.id && (
                        <div className="card-menu-pop card-menu-pop--confirm">
                          <div className="delete-confirm">
                            <span>Ta bort?</span>
                            <button className="delete-confirm-yes" onClick={() => { onDeleteTemplate(t.id); setConfirmingDeleteId(null); }}>Ja</button>
                            <button className="delete-confirm-no" onClick={() => setConfirmingDeleteId(null)}>Nej</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  {t.id === "pass2" && (
                    <div className="pass-card-hint">💡 Välj 2B om du spelat golf nyligen</div>
                  )}
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
