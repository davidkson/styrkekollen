import { useState, useEffect, useRef } from "react";

function beep() {
  navigator.vibrate?.([100, 60, 100, 60, 200]);
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

export function fmt(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function useRestTimer() {
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
    if (running) setRemaining(next);
    else { setPreset(next); setRemaining(next); }
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

  function autoStart(seconds) {
    clearInterval(intervalRef.current);
    setPreset(seconds);
    setRemaining(seconds);
    setDone(false);
    setRunning(true);
  }

  return { preset, remaining, running, done, progress: remaining / preset, toggle, reset, selectPreset, adjust, autoStart };
}
