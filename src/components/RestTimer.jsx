import { useState, useEffect, useRef } from "react";

const PRESETS = [30, 45, 60, 90, 120, 180];

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25, 0.5].forEach((t) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.2);
    });
  } catch {}
}

function fmt(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function RestTimer() {
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState(90);
  const [remaining, setRemaining] = useState(90);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setRemaining((r) => {
          if (r <= 1) {
            clearInterval(intervalRef.current);
            setRunning(false);
            setDone(true);
            beep();
            return 0;
          }
          return r - 1;
        });
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [running]);

  function selectPreset(s) {
    setPreset(s);
    setRemaining(s);
    setRunning(false);
    setDone(false);
  }

  function adjust(delta) {
    const next = Math.max(5, (running ? remaining : preset) + delta);
    if (running) {
      setRemaining(next);
    } else {
      setPreset(next);
      setRemaining(next);
    }
    setDone(false);
  }

  function toggle() {
    if (done) { reset(); return; }
    setRunning((r) => !r);
    setDone(false);
  }

  function reset() {
    clearInterval(intervalRef.current);
    setRunning(false);
    setDone(false);
    setRemaining(preset);
  }

  const progress = remaining / preset;

  return (
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
  );
}
