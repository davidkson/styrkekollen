import { useState } from "react";

function exerciseName(exerciseId, templateId, customNames, customExercises) {
  if (customNames && customNames[exerciseId]) return customNames[exerciseId];
  if (customExercises && customExercises[templateId]) {
    const found = customExercises[templateId].find(e => e.id === exerciseId);
    if (found) return found.name;
  }
  return exerciseId;
}

export default function ExerciseProgress({ logs, customNames, customExercises, onBack }) {
  const [selectedExercise, setSelectedExercise] = useState(null);

  // Build a map of exerciseId -> { name, sessions, maxWeight, templateId }
  const exerciseMap = {};
  (logs || []).forEach(log => {
    (log.exercises || []).forEach(ex => {
      const id = ex.exerciseId;
      if (!exerciseMap[id]) {
        exerciseMap[id] = {
          id,
          name: exerciseName(id, log.templateId, customNames, customExercises),
          sessions: 0,
          maxWeight: 0,
          templateId: log.templateId,
        };
      }
      exerciseMap[id].sessions += 1;
      (ex.sets || []).forEach(s => {
        const w = parseFloat(s.weight) || 0;
        if (w > exerciseMap[id].maxWeight) exerciseMap[id].maxWeight = w;
      });
    });
  });

  const exerciseList = Object.values(exerciseMap).sort((a, b) => b.sessions - a.sessions);

  // --- Exercise list view ---
  if (!selectedExercise) {
    return (
      <div className="progress-view">
        <div className="session-header">
          <button className="back-btn" onClick={onBack}>← Tillbaka</button>
          <h2>Övningsutveckling</h2>
          <span />
        </div>
        <div className="progress-exercise-list">
          {exerciseList.map(ex => (
            <div
              key={ex.id}
              className="progress-exercise-item"
              onClick={() => setSelectedExercise(ex.id)}
            >
              <span className="progress-exercise-item-name">{ex.name}</span>
              <span className="progress-exercise-item-meta">
                {ex.sessions} pass · Max {ex.maxWeight}kg
              </span>
            </div>
          ))}
          {exerciseList.length === 0 && <p>Inga loggade övningar ännu.</p>}
        </div>
      </div>
    );
  }

  // --- Exercise detail view ---
  const exId = selectedExercise;
  const exName = exerciseMap[exId]
    ? exerciseMap[exId].name
    : exerciseName(exId, null, customNames, customExercises);

  // Gather sessions containing this exercise, sorted by date ascending
  const sessions = (logs || [])
    .filter(log => (log.exercises || []).some(ex => ex.exerciseId === exId))
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map(log => {
      const ex = log.exercises.find(e => e.exerciseId === exId);
      const doneSets = (ex.sets || []).filter(s => s.done || s.weight || s.reps);
      let maxWeight = 0;
      let bestSet = null;
      let bestEst1RM = 0;
      let totalVolume = 0;

      doneSets.forEach(s => {
        const w = parseFloat(s.weight) || 0;
        const r = parseInt(s.reps) || 0;
        if (w > maxWeight) {
          maxWeight = w;
          bestSet = s;
        }
        const est = r > 1 ? w * (1 + r / 30) : 0;
        if (est > bestEst1RM) bestEst1RM = est;
        totalVolume += w * r;
      });

      return {
        date: log.date,
        templateName: log.templateName || log.templateId,
        maxWeight,
        bestSet,
        est1RM: bestEst1RM > 0 ? Math.round(bestEst1RM * 10) / 10 : null,
        totalVolume,
        totalSets: doneSets.length,
      };
    });

  const allTimeMax = Math.max(...sessions.map(s => s.maxWeight), 0);
  const allTimeBest1RM = Math.max(...sessions.map(s => s.est1RM || 0), 0);

  return (
    <div className="progress-view">
      <div className="session-header">
        <button className="back-btn" onClick={() => setSelectedExercise(null)}>← Alla övningar</button>
        <h2>{exName}</h2>
        <span />
      </div>

      <div className="progress-summary">
        <div className="progress-summary-stat">
          <span className="progress-summary-value">{allTimeMax}kg</span>
          <span className="progress-summary-label">Bästa vikt</span>
        </div>
        <div className="progress-summary-stat">
          <span className="progress-summary-value">
            {allTimeBest1RM > 0 ? `${Math.round(allTimeBest1RM * 10) / 10}kg` : "–"}
          </span>
          <span className="progress-summary-label">Bästa 1RM</span>
        </div>
        <div className="progress-summary-stat">
          <span className="progress-summary-value">{sessions.length}</span>
          <span className="progress-summary-label">Antal pass</span>
        </div>
      </div>

      <div className="progress-timeline">
        {sessions.map((s, i) => {
          const prevMax = i > 0 ? sessions[i - 1].maxWeight : null;
          const delta = prevMax !== null ? s.maxWeight - prevMax : null;
          const barWidth = allTimeMax > 0 ? (s.maxWeight / allTimeMax) * 100 : 0;
          const bestSetStr = s.bestSet
            ? `${parseFloat(s.bestSet.weight)}kg × ${s.bestSet.reps}`
            : "–";

          return (
            <div key={`${s.date}-${i}`} className="progress-session">
              <div className="progress-session-date">
                {new Date(s.date).toLocaleDateString("sv-SE", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </div>
              <div className="progress-session-template">{s.templateName}</div>
              <div className="progress-session-details">
                <span>Bästa set: {bestSetStr}</span>
                {s.est1RM && <span>Est 1RM: {s.est1RM}kg</span>}
                <span>Volym: {s.totalVolume}kg</span>
                <span>{s.totalSets} set</span>
              </div>
              <div className="progress-bar-track">
                <div className="progress-bar-fill" style={{ width: `${barWidth}%` }} />
              </div>
              {delta !== null && delta !== 0 && (
                <span
                  className={`progress-delta ${delta > 0 ? "progress-delta--up" : "progress-delta--down"}`}
                >
                  {delta > 0 ? `↑ +${delta}kg` : `↓ ${delta}kg`}
                </span>
              )}
            </div>
          );
        })}
        {sessions.length === 0 && <p>Inga loggade pass för denna övning.</p>}
      </div>
    </div>
  );
}
