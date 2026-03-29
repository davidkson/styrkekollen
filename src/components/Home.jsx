import { workoutTemplates } from "../data/workouts";

export default function Home({ onStart, onResume, onEdit, logs, activeSession, customExercises }) {
  function lastDate(templateId) {
    const entries = logs.filter((l) => l.templateId === templateId);
    if (!entries.length) return null;
    const last = entries.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    return new Date(last.date).toLocaleDateString("sv-SE");
  }

  function exerciseCount(t) {
    return t.exercises.length + (customExercises?.[t.id]?.length ?? 0);
  }

  return (
    <div className="home">
      <h1>Styrkekollen</h1>

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
            {workoutTemplates.map((t) => (
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
            {workoutTemplates.map((t) => {
              const last = lastDate(t.id);
              return (
                <div key={t.id} className="pass-card-wrapper">
                  <button className="pass-card" onClick={() => onStart(t)}>
                    <div className="pass-card-name">{t.name}</div>
                    <div className="pass-card-meta">
                      {exerciseCount(t)} övningar
                      {last && <span> · Senast: {last}</span>}
                    </div>
                    <div className="pass-card-arrow">→</div>
                  </button>
                  <button className="pass-edit-btn" onClick={() => onEdit(t)} title="Redigera pass">
                    ✎
                  </button>
                </div>
              );
            })}
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
