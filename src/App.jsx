import { useState, useEffect, useRef, useMemo } from "react";
import Home from "./components/Home";
import WorkoutSession from "./components/WorkoutSession";
import History from "./components/History";
import EditPass from "./components/EditPass";
import ExerciseProgress from "./components/ExerciseProgress";
import Login from "./components/Login";
import MigratePrompt from "./components/MigratePrompt";
import Tools from "./components/Tools";
import TabBar from "./components/TabBar";
import { workoutTemplates } from "./data/workouts";
import * as db from "./lib/db";
import { latestExerciseByKey, buildTemplateExercises } from "./lib/exerciseName";
import { exportTemplateToOpenGym } from "./lib/openGymPlan";
import { useTheme } from "./hooks/useTheme";
import { useRestTimer } from "./hooks/useRestTimer";
import { useSwipeBack } from "./hooks/useSwipeBack";
import "./App.css";

export default function App() {
  const { theme, toggle: toggleTheme, select: selectTheme } = useTheme();
  const timer = useRestTimer();
  const [authenticated, setAuthenticated] = useState(() => localStorage.getItem("auth") === "1");
  const [showMigrate, setShowMigrate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [customNames, setCustomNames] = useState({});
  const [customExercises, setCustomExercises] = useState({});
  const [customTemplates, setCustomTemplates] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [view, setView] = useState("home");
  const [activeTemplate, setActiveTemplate] = useState(null);
  const debounceRef = useRef(null);
  const templateExercises = useMemo(
    () => buildTemplateExercises(workoutTemplates, customExercises),
    [customExercises]
  );

  // Swipe back only inside a tab — never between tabs. "edit" is the only
  // sub-view of a tab (it hangs off the home tab), so that is the only place
  // the gesture applies. The tab bar handles everything else.
  useSwipeBack(() => {
    setView("home");
    setActiveTemplate(null);
  }, view === "edit");

  useEffect(() => {
    if (!authenticated) { setLoading(false); return; }
    loadAll();
  }, [authenticated]);

  async function loadAll() {
    setLoading(true);
    try {
      let [logsData, customEx, names, session, customTpls] = await Promise.all([
        db.getLogs(),
        db.getCustomExercises(),
        db.getExerciseNames(),
        db.getActiveSession(),
        db.getCustomTemplates(),
      ]);

      // Seed/sync built-in templates to DB
      const builtins = workoutTemplates.filter((t) => !t.demo);
      const BUILTIN_VERSION = 7;
      const storedVersion = parseInt(localStorage.getItem("builtin-tpl-version") ?? "0", 10);
      const needsSync = storedVersion < BUILTIN_VERSION;
      const seedOps = builtins.flatMap((t) => {
        const ops = [];
        const existing = customTpls.find((c) => c.id === t.id);
        if (!existing) ops.push(db.upsertCustomTemplate({ id: t.id, name: t.name }));
        if (!customEx[t.id] || needsSync) ops.push(db.upsertCustomExercises(t.id, t.exercises));
        return ops;
      });
      if (seedOps.length) {
        await Promise.all(seedOps);
        [customTpls, customEx] = await Promise.all([db.getCustomTemplates(), db.getCustomExercises()]);
      }
      if (needsSync) localStorage.setItem("builtin-tpl-version", String(BUILTIN_VERSION));

      setLogs(logsData);
      setCustomExercises(customEx);
      setCustomNames(names);
      setActiveSession(session);
      setCustomTemplates(customTpls);
    } finally {
      setLoading(false);
    }
  }

  function mergedTemplate(template) {
    return {
      ...template,
      exercises: [...(template.exercises ?? []), ...(customExercises[template.id] ?? [])],
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

  async function updateExercise(templateId, exerciseId, changes) {
    const updated = (customExercises[templateId] ?? []).map((e) =>
      e.id === exerciseId ? { ...e, ...changes } : e
    );
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
    const template =
      workoutTemplates.find((t) => t.demo && t.id === activeSession.templateId) ??
      customTemplates.find((t) => t.id === activeSession.templateId);
    setActiveTemplate(mergedTemplate(template));
    setView("session");
  }

  async function createTemplate(name) {
    const t = { id: crypto.randomUUID(), name, exercises: [] };
    setCustomTemplates((prev) => [...prev, t]);
    await db.upsertCustomTemplate(t);
    return t;
  }

  async function duplicateTemplate(template) {
    const newId = crypto.randomUUID();
    const newTemplate = { id: newId, name: `${template.name} (kopia)`, exercises: [] };
    const exercises = [...template.exercises, ...(customExercises[template.id] ?? [])];
    setCustomTemplates((prev) => [...prev, newTemplate]);
    if (exercises.length > 0) {
      setCustomExercises((prev) => ({ ...prev, [newId]: exercises }));
      await db.upsertCustomExercises(newId, exercises);
    }
    await db.upsertCustomTemplate(newTemplate);
  }

  async function removeCustomTemplate(id) {
    setCustomTemplates((prev) => prev.filter((t) => t.id !== id));
    setCustomExercises((prev) => { const next = { ...prev }; delete next[id]; return next; });
    await Promise.all([db.deleteCustomTemplate(id), db.deleteCustomExercisesForTemplate(id)]);
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

  async function abandonWorkout() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setActiveSession(null);
    setView("home");
    setActiveTemplate(null);
    if (!activeSession?.demo) await db.clearActiveSession();
  }

  // Leaving an ongoing session through the tab bar keeps it active, same as "Pausa"
  function pauseSession() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!activeSession?.demo) db.saveActiveSession(activeSession);
  }

  function navigate(next) {
    if (next === view) return;
    if (view === "session") pauseSession();
    setActiveTemplate(null);
    setView(next);
  }

  function handleStartTab() {
    if (activeSession) {
      if (view !== "session") resumeWorkout();
      return;
    }
    // No session to resume — the home view is where a pass is picked
    navigate("home");
  }

  async function deleteLog(id) {
    setLogs((prev) => prev.filter((l) => l.id !== id));
    await db.deleteLog(id);
  }

  async function updateLogTimestamps(id, startedAt, finishedAt) {
    setLogs((prev) => prev.map((l) => l.id === id ? { ...l, startedAt, finishedAt } : l));
    await db.updateLogTimestamps(id, startedAt, finishedAt);
  }

  // Last logged entry per exercise name, from any template, for prefilling a session
  function previousExercises() {
    return latestExerciseByKey(logs, customNames, templateExercises);
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
        <Home
          logs={logs}
          customExercises={customExercises}
          customTemplates={customTemplates}
          activeSession={activeSession}
          onStart={startWorkout}
          onResume={resumeWorkout}
          onEdit={(t) => { setActiveTemplate(t); setView("edit"); }}
          onCreateTemplate={async (name) => { const t = await createTemplate(name); setActiveTemplate(t); setView("edit"); }}
          onDuplicateTemplate={duplicateTemplate}
          onExportTemplate={(t) => exportTemplateToOpenGym(mergedTemplate(t), previousExercises(), customNames)}
          onDeleteTemplate={removeCustomTemplate}
        />
      )}
      {view === "edit" && activeTemplate && (
        <EditPass
          template={activeTemplate}
          customExercises={customExercises[activeTemplate.id]}
          onAdd={(ex) => addExercise(activeTemplate.id, ex)}
          onRemove={(id) => removeExercise(activeTemplate.id, id)}
          onReorder={(ordered) => { setCustomExercises((prev) => ({ ...prev, [activeTemplate.id]: ordered })); db.upsertCustomExercises(activeTemplate.id, ordered); }}
          onUpdate={(id, changes) => updateExercise(activeTemplate.id, id, changes)}
          onBack={() => { setView("home"); setActiveTemplate(null); }}
        />
      )}
      {view === "session" && activeTemplate && (
        <WorkoutSession
          template={activeTemplate}
          savedSets={activeSession?.templateId === activeTemplate.id ? activeSession.sets : null}
          previousExercises={previousExercises()}
          customNames={customNames}
          startedAt={activeSession?.startedAt}
          timer={timer}
          onRename={renameExercise}
          onSave={saveSessionState}
          onAddExercise={(ex) => addExercise(activeTemplate.id, ex)}
          onFinish={finishWorkout}
          onCancel={cancelWorkout}
          onAbandon={abandonWorkout}
          onToggleTheme={toggleTheme}
        />
      )}
      {view === "history" && (
        <History
          logs={logs}
          customNames={customNames}
          customExercises={customExercises}
          templateExercises={templateExercises}
          onDelete={deleteLog}
          onUpdateTimestamps={updateLogTimestamps}
          onProgress={() => setView("progress")}
        />
      )}
      {view === "progress" && (
        <ExerciseProgress
          logs={logs}
          customNames={customNames}
          customExercises={customExercises}
        />
      )}
      {view === "tools" && (
        <Tools
          theme={theme}
          onSelectTheme={selectTheme}
          onLogout={() => { localStorage.removeItem("auth"); setAuthenticated(false); }}
        />
      )}
      <TabBar
        view={view}
        hasActiveSession={!!activeSession}
        onNavigate={navigate}
        onStart={handleStartTab}
      />
    </div>
  );
}
