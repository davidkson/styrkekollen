import { useState } from "react";
import { fmt } from "../hooks/useRestTimer";

const PRESETS = [30, 45, 60, 90, 120, 180];

export default function RestTimer({ preset, remaining, running, done, progress, toggle, reset, selectPreset, adjust }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {done && <div className="timer-flash-overlay" onClick={reset} />}
      <div className="timer-wrapper">
        {open && (
          <div className="timer-panel">
            <div className="timer-panel-header">
              <span>Vila</span>
              <button className="plate-close" onClick={() => setOpen(false)}>✕</button>
            </div>

            <div className={`timer-display ${done ? "timer-done" : ""} ${running ? "timer-running" : ""}`}>
              <svg className="timer-ring" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="44" className="timer-ring-bg" />
                <circle cx="50" cy="50" r="44" className="timer-ring-fill"
                  strokeDasharray={`${2 * Math.PI * 44}`}
                  strokeDashoffset={`${2 * Math.PI * 44 * (1 - progress)}`} />
              </svg>
              <div className="timer-digits">{fmt(remaining)}</div>
            </div>

            <div className="timer-adjust">
              <button className="timer-adj-btn" onClick={() => adjust(-5)}>−5s</button>
              <button className="timer-adj-btn" onClick={() => adjust(-15)}>−15s</button>
              <button className="timer-adj-btn" onClick={() => adjust(+15)}>+15s</button>
              <button className="timer-adj-btn" onClick={() => adjust(+5)}>+5s</button>
            </div>

            <div className="timer-presets">
              {PRESETS.map((s) => (
                <button
                  key={s}
                  className={`timer-preset ${preset === s && !running ? "timer-preset-active" : ""}`}
                  onClick={() => selectPreset(s)}
                >
                  {s < 60 ? `${s}s` : `${s / 60}:00`}
                </button>
              ))}
            </div>

            <div className="timer-controls">
              <button className="timer-reset-btn" onClick={reset}>↺</button>
              <button className="timer-start-btn" onClick={toggle}>
                {done ? "↺" : running ? "⏸" : "▶"}
              </button>
            </div>
          </div>
        )}
        <button
          className={`plate-fab timer-fab ${open ? "plate-fab-active" : ""} ${running ? "timer-fab-running" : ""}`}
          onClick={() => setOpen((v) => !v)}
          title="Vilotimer"
        >
          {running ? fmt(remaining) : "⏱"}
        </button>
      </div>
    </>
  );
}
