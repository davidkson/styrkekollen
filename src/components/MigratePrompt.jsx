import { useState } from "react";
import * as db from "../lib/db";

export default function MigratePrompt({ onDone }) {
  const [status, setStatus] = useState("idle");
  const [summary, setSummary] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  function detect() {
    const logs = JSON.parse(localStorage.getItem("workout-logs") ?? "[]");
    const customEx = JSON.parse(localStorage.getItem("custom-exercises") ?? "{}");
    const names = JSON.parse(localStorage.getItem("exercise-names") ?? "{}");
    const session = JSON.parse(localStorage.getItem("active-session") ?? "null");
    return { logs, customEx, names, session };
  }

  async function migrate() {
    setStatus("migrating");
    try {
      const { logs, customEx, names, session } = detect();

      // Insert logs — skip only true duplicates (conflict on id)
      let migratedLogs = 0;
      for (const log of logs) {
        try {
          await db.insertLog(log);
          migratedLogs++;
        } catch (e) {
          // If it's a duplicate key error, skip — otherwise re-throw
          if (!e?.message?.includes("duplicate") && !e?.code?.includes("23505")) throw e;
        }
      }

      for (const [templateId, exercises] of Object.entries(customEx)) {
        if (exercises?.length) await db.upsertCustomExercises(templateId, exercises);
      }

      for (const [exerciseId, name] of Object.entries(names)) {
        await db.upsertExerciseName(exerciseId, name);
      }

      if (session) await db.saveActiveSession(session);

      // Only clear localStorage after confirmed success
      localStorage.removeItem("workout-logs");
      localStorage.removeItem("custom-exercises");
      localStorage.removeItem("exercise-names");
      localStorage.removeItem("active-session");

      setSummary({
        logs: migratedLogs,
        names: Object.keys(names).length,
        session: !!session,
      });
      setStatus("done");
    } catch (e) {
      setErrorMsg(e?.message ?? "Okänt fel — localStorage är orörd");
      setStatus("error");
    }
  }

  return (
    <div className="migrate-overlay">
      <div className="migrate-card">
        {status === "idle" && (
          <>
            <div className="migrate-icon">📦</div>
            <h2>Gammal data hittad</h2>
            <p>Det finns träningsdata sparad lokalt i webbläsaren. Vill du flytta över den till Supabase?</p>
            <div className="migrate-actions">
              <button className="migrate-skip" onClick={onDone}>Hoppa över</button>
              <button className="migrate-btn" onClick={migrate}>Migrera</button>
            </div>
          </>
        )}
        {status === "migrating" && (
          <>
            <div className="loading-spinner" style={{ margin: "0 auto" }} />
            <p style={{ marginTop: 16 }}>Migrerar...</p>
          </>
        )}
        {status === "done" && (
          <>
            <div className="migrate-icon">✅</div>
            <h2>Klart!</h2>
            <ul className="migrate-summary">
              <li>{summary.logs} träningspass</li>
              {summary.names > 0 && <li>{summary.names} anpassade övningsnamn</li>}
              {summary.session && <li>Pågående pass</li>}
            </ul>
            <button className="migrate-btn" onClick={onDone}>Fortsätt</button>
          </>
        )}
        {status === "error" && (
          <>
            <div className="migrate-icon">❌</div>
            <h2>Något gick fel</h2>
            <p className="migrate-error">{errorMsg}</p>
            <div className="migrate-actions">
              <button className="migrate-skip" onClick={onDone}>Stäng</button>
              <button className="migrate-btn" onClick={migrate}>Försök igen</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
