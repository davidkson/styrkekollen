import { useState } from "react";
import Home from "./components/Home";
import WorkoutSession from "./components/WorkoutSession";
import History from "./components/History";
import EditPass from "./components/EditPass";
import PlateCalculator from "./components/PlateCalculator";
import { useStorage } from "./hooks/useStorage";
import { workoutTemplates } from "./data/workouts";
import "./App.css";

export default function App() {
  const [logs, setLogs] = useStorage("workout-logs", []);
  const [customNames, setCustomNames] = useStorage("exercise-names", {});
  const [customExercises, setCustomExercises] = useStorage("custom-exercises", {});
  const [activeSession, setActiveSession] = useStorage("active-session", null);
  const [view, setView] = useState("home");
  const [activeTemplate, setActiveTemplate] = useState(null);

  function mergedTemplate(template) {
    return {
      ...template,
      exercises: [...template.exercises, ...(customExercises[template.id] ?? [])],
    };
  }

  function renameExercise(exerciseId, name) {
    setCustomNames({ ...customNames, [exerciseId]: name });
  }

  function addExercise(templateId, exercise) {
    setCustomExercises({
      ...customExercises,
      [templateId]: [...(customExercises[templateId] ?? []), exercise],
    });
  }

  function removeExercise(templateId, exerciseId) {
    setCustomExercises({
      ...customExercises,
      [templateId]: (customExercises[templateId] ?? []).filter((e) => e.id !== exerciseId),
    });
  }

  function startWorkout(template) {
    const merged = mergedTemplate(template);
    setActiveSession({ templateId: merged.id, templateName: merged.name, startedAt: new Date().toISOString(), sets: null });
    setActiveTemplate(merged);
    setView("session");
  }

  function resumeWorkout() {
    const template = workoutTemplates.find((t) => t.id === activeSession.templateId);
    setActiveTemplate(mergedTemplate(template));
    setView("session");
  }

  function saveSessionState(sets) {
    setActiveSession((prev) => ({ ...prev, sets }));
  }

  function finishWorkout(log) {
    setLogs([...logs, log]);
    setActiveSession(null);
    setView("home");
    setActiveTemplate(null);
  }

  function cancelWorkout() {
    setView("home");
    setActiveTemplate(null);
  }

  function deleteLog(id) {
    setLogs(logs.filter((l) => l.id !== id));
  }

  function previousLog(templateId) {
    return logs
      .filter((l) => l.templateId === templateId)
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0] ?? null;
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
