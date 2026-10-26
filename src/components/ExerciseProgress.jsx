import { useState } from "react";
import { resolveExerciseName, exerciseKey } from "../lib/exerciseName";
import { workingSets } from "../lib/warmup";

export default function ExerciseProgress({ logs, customNames, templateExercises }) {
  const [selectedExercise, setSelectedExercise] = useState(null);

  function keyFor(ex, log) {
    const name = resolveExerciseName(ex.exerciseId, log.templateId, customNames, templateExercises);
    return { name, key: exerciseKey(name, ex.exerciseId) };
  }

  // Build a map of normalized name key -> { key, name, sessions, maxWeight }
  // The same exercise has different ids across templates, so group by name.
  const exerciseMap = {};
  (logs || []).forEach(log => {
    const seenInLog = new Set();
    (log.exercises || []).forEach(ex => {
      const { name, key } = keyFor(ex, log);
      if (!exerciseMap[key]) {
        exerciseMap[key] = { key, name, sessions: 0, maxWeight: 0 };
      }
      if (!seenInLog.has(key)) {
        seenInLog.add(key);
        exerciseMap[key].sessions += 1;
      }
      workingSets(ex.sets).forEach(s => {
        const w = parseFloat(s.weight) || 0;
        if (w > exerciseMap[key].maxWeight) exerciseMap[key].maxWeight = w;
      });
    });
  });

  const exerciseList = Object.values(exerciseMap).sort((a, b) => b.sessions - a.sessions);

  // --- Exercise list view ---
  if (!selectedExercise) {
    return (
      <div className="progress-view">
        <div className="session-header">
          <span />
          <h2>Övningsutveckling</h2>
          <span />
        </div>
        <div className="progress-exercise-list">
          {exerciseList.map(ex => (
            <div
              key={ex.key}
              className="progress-exercise-item"
              onClick={() => setSelectedExercise(ex.key)}
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
  const exKey = selectedExercise;
  const exName = exerciseMap[exKey] ? exerciseMap[exKey].name : exKey;

  // Gather sessions containing this exercise (by name key), sorted by date ascending.
  // If several rows in one log match the same key, their sets are merged.
  const sessions = (logs || [])
    .map(log => ({
      log,
      matches: (log.exercises || []).filter(ex => keyFor(ex, log).key === exKey),
    }))
    .filter(({ matches }) => matches.length > 0)
    .sort((a, b) => new Date(a.log.date) - new Date(b.log.date))
    .map(({ log, matches }) => {
      // Warm-up sets don't count toward max, 1RM, volume or set count
      const allSets = matches.flatMap(ex => workingSets(ex.sets));
      const doneSets = allSets.filter(s => s.done || s.weight || s.reps);
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
