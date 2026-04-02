import { useState, useEffect, useRef } from "react";
import Home from "./components/Home";
import WorkoutSession from "./components/WorkoutSession";
import History from "./components/History";
import EditPass from "./components/EditPass";
import Login from "./components/Login";
import MigratePrompt from "./components/MigratePrompt";
import PlateCalculator from "./components/PlateCalculator";
import RestTimer from "./components/RestTimer";
import { workoutTemplates } from "./data/workouts";
import * as db from "./lib/db";
import { useTheme } from "./hooks/useTheme";
import { useRestTimer, fmt } from "./hooks/useRestTimer";
import "./App.css";

export default function App() {
  const { theme, toggle: toggleTheme } = useTheme();
  const timer = useRestTimer();
  const [adjStep, setAdjStep] = useState(15);
  const longPressRef = useRef(null);

  function handleAdjPointerDown() {
    longPressRef.current = setTimeout(() => {
      setAdjStep((s) => (s === 15 ? 5 : 15));
      longPressRef.current = null;
    }, 500);
  }

  function handleAdjPointerUp(delta) {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
      timer.adjust(delta);
    }
  }

  function handleAdjPointerLeave() {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }
  const [authenticated, setAuthenticated] = useState(() => sessionStorage.getItem("auth") === "1");
  const [showMigrate, setShowMigrate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [customNames, setCustomNames] = useState({});
  const [customExercises, setCustomExercises] = useState({});
  const [activeSession, setActiveSession] = useState(null);
  const [view, setView] = useState("home");
  const [activeTemplate, setActiveTemplate] = useState(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!authenticated) { setLoading(false); return; }
    loadAll();
  }, [authenticated]);

  async function loadAll() {
    setLoading(true);
    try {
      const [logsData, customEx, names, session] = await Promise.all([
        db.getLogs(),
        db.getCustomExercises(),
        db.getExerciseNames(),
        db.getActiveSession(),
      ]);
      setLogs(logsData);
      setCustomExercises(customEx);
      setCustomNames(names);
      setActiveSession(session);
    } finally {
      setLoading(false);
    }
  }

  function mergedTemplate(template) {
    return {
      ...template,
      exercises: [...template.exercises, ...(customExercises[template.id] ?? [])],
    };
  }

  async function renameExercise(exerciseId, name) {
    setCustomNames((prev) => ({ ...prev, [exerciseId]: name }));
    await db.upsertExerciseName(exerciseId, name);
  }

  async function addExercise(templateId, exercise) {
    const updated = [...(customExercises[templateId] ?? []), exercise];
    setCustomExercises((prev) => ({ ...prev, [templateId]: updated }));
    await db.upsertCustomExercises(templateId, updated);
  }

  async function removeExercise(templateId, exerciseId) {
    const updated = (customExercises[templateId] ?? []).filter((e) => e.id !== exerciseId);
    setCustomExercises((prev) => ({ ...prev, [templateId]: updated }));
    await db.upsertCustomExercises(templateId, updated);
  }

  async function startWorkout(template) {
    const merged = mergedTemplate(template);
    const session = {
      templateId: merged.id,
      templateName: merged.name,
      startedAt: new Date().toISOString(),
      sets: null,
      demo: merged.demo ?? false,
    };
    setActiveSession(session);
    setActiveTemplate(merged);
    setView("session");
    if (!merged.demo) await db.saveActiveSession(session);
  }

  function resumeWorkout() {
    const template = workoutTemplates.find((t) => t.id === activeSession.templateId);
    setActiveTemplate(mergedTemplate(template));
    setView("session");
  }

  function saveSessionState(sets) {
    const updated = { ...activeSession, sets };
    setActiveSession(updated);
    if (activeSession?.demo) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => db.saveActiveSession(updated), 2000);
  }

  async function finishWorkout(log) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const isDemo = activeSession?.demo;
    setActiveSession(null);
    setView("home");
    setActiveTemplate(null);
    if (!isDemo) {
      setLogs((prev) => [log, ...prev]);
      await Promise.all([db.insertLog(log), db.clearActiveSession()]);
    }
  }

  async function cancelWorkout() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!activeSession?.demo) await db.saveActiveSession(activeSession);
    setView("home");
    setActiveTemplate(null);
  }

  async function deleteLog(id) {
    setLogs((prev) => prev.filter((l) => l.id !== id));
    await db.deleteLog(id);
  }

  async function updateLogTimestamps(id, startedAt, finishedAt) {
    setLogs((prev) => prev.map((l) => l.id === id ? { ...l, startedAt, finishedAt } : l));
    await db.updateLogTimestamps(id, startedAt, finishedAt);
  }

  function previousLog(templateId) {
    return logs
      .filter((l) => l.templateId === templateId)
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0] ?? null;
  }

  function hasLocalData() {
    return (
      localStorage.getItem("workout-logs") ||
      localStorage.getItem("custom-exercises") ||
      localStorage.getItem("exercise-names") ||
      localStorage.getItem("active-session")
    );
  }

  if (!authenticated) {
    return (
      <Login onLogin={() => {
        setAuthenticated(true);
        if (hasLocalData()) setShowMigrate(true);
      }} />
    );
  }

  if (showMigrate) {
    return <MigratePrompt onDone={() => { setShowMigrate(false); loadAll(); }} />;
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Laddar...</p>
      </div>
    );
  }

  return (
    <div className={`app${view === "session" ? " app-timer-active" : ""}`}>
      {view === "session" && (
        <div className={`sticky-timer-bar${timer.running ? " sticky-timer-bar--running" : ""}`}>
          <span className="sticky-timer-digits">{fmt(timer.remaining)}</span>
          <div className="sticky-timer-track">
            <div className="sticky-timer-fill" style={{ width: `${timer.progress * 100}%` }} />
          </div>
          <div className="sticky-timer-controls">
            <button className="sticky-timer-btn" onClick={timer.toggle} title={timer.running ? "Pausa" : "Starta"}>
              {timer.done ? "↺" : timer.running ? "⏸" : "▶"}
            </button>
            <button className="sticky-timer-btn sticky-timer-btn--reset" onClick={timer.reset} title="Börja om">↺</button>
            <button
              className="sticky-timer-btn sticky-timer-btn--adj"
              onPointerDown={handleAdjPointerDown}
              onPointerUp={() => handleAdjPointerUp(-adjStep)}
              onPointerLeave={handleAdjPointerLeave}
            >−{adjStep}</button>
            <button
              className="sticky-timer-btn sticky-timer-btn--adj"
              onPointerDown={handleAdjPointerDown}
              onPointerUp={() => handleAdjPointerUp(+adjStep)}
              onPointerLeave={handleAdjPointerLeave}
            >+{adjStep}</button>
          </div>
        </div>
      )}
      {view === "home" && (
        <>
          <Home
            logs={logs}
            customExercises={customExercises}
            activeSession={activeSession}
            onStart={startWorkout}
            onResume={resumeWorkout}
            onEdit={(t) => { setActiveTemplate(t); setView("edit"); }}
            onLogout={() => { sessionStorage.removeItem("auth"); setAuthenticated(false); }}
            theme={theme}
            onToggleTheme={toggleTheme}
          />
          <button className="history-btn" onClick={() => setView("history")}>
            Historik ({logs.length})
          </button>
        </>
      )}
      {view === "edit" && activeTemplate && (
        <EditPass
          template={activeTemplate}
          customExercises={customExercises[activeTemplate.id]}
          onAdd={(ex) => addExercise(activeTemplate.id, ex)}
          onRemove={(id) => removeExercise(activeTemplate.id, id)}
          onBack={() => { setView("home"); setActiveTemplate(null); }}
        />
      )}
      {view === "session" && activeTemplate && (
        <WorkoutSession
          template={activeTemplate}
          savedSets={activeSession?.templateId === activeTemplate.id ? activeSession.sets : null}
          previousLog={previousLog(activeTemplate.id)}
          customNames={customNames}
          startedAt={activeSession?.startedAt}
          onRename={renameExercise}
          onSave={saveSessionState}
          onAddExercise={(ex) => addExercise(activeTemplate.id, ex)}
          onFinish={finishWorkout}
          onCancel={cancelWorkout}
          onToggleTheme={toggleTheme}
          theme={theme}
          onAutoStartTimer={timer.autoStart}
        />
      )}
      {view === "history" && (
        <History
          logs={logs}
          customNames={customNames}
          customExercises={customExercises}
          onBack={() => setView("home")}
          onDelete={deleteLog}
          onUpdateTimestamps={updateLogTimestamps}
        />
      )}
      <RestTimer {...timer} />
      <PlateCalculator />
    </div>
  );
}
