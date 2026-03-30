import { useState, useEffect, useRef } from "react";
import Home from "./components/Home";
import WorkoutSession from "./components/WorkoutSession";
import History from "./components/History";
import EditPass from "./components/EditPass";
import Login from "./components/Login";
import MigratePrompt from "./components/MigratePrompt";
import PlateCalculator from "./components/PlateCalculator";
import { workoutTemplates } from "./data/workouts";
import * as db from "./lib/db";
import "./App.css";

export default function App() {
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
    };
    setActiveSession(session);
    setActiveTemplate(merged);
    setView("session");
    await db.saveActiveSession(session);
  }

  function resumeWorkout() {
    const template = workoutTemplates.find((t) => t.id === activeSession.templateId);
    setActiveTemplate(mergedTemplate(template));
    setView("session");
  }

  function saveSessionState(sets) {
    const updated = { ...activeSession, sets };
    setActiveSession(updated);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => db.saveActiveSession(updated), 2000);
  }

  async function finishWorkout(log) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setLogs((prev) => [log, ...prev]);
    setActiveSession(null);
    setView("home");
    setActiveTemplate(null);
    await Promise.all([db.insertLog(log), db.clearActiveSession()]);
  }

  async function cancelWorkout() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    await db.saveActiveSession(activeSession);
    setView("home");
    setActiveTemplate(null);
  }

  async function deleteLog(id) {
    setLogs((prev) => prev.filter((l) => l.id !== id));
    await db.deleteLog(id);
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
    <div className="app">
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
          onRename={renameExercise}
          onSave={saveSessionState}
          onAddExercise={(ex) => addExercise(activeTemplate.id, ex)}
          onFinish={finishWorkout}
          onCancel={cancelWorkout}
        />
      )}
      {view === "history" && (
        <History
          logs={logs}
          customNames={customNames}
          customExercises={customExercises}
          onBack={() => setView("home")}
          onDelete={deleteLog}
        />
      )}
      <PlateCalculator />
    </div>
  );
}
