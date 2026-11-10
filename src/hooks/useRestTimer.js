import { useState, useEffect } from "react";

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
  } catch {
    // AudioContext unavailable or blocked by autoplay policy; the beep is optional.
  }
}

export function fmt(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

const TICK_MS = 250;
const MIN_SECONDS = 5;

function secondsLeft(endAt) {
  return Math.ceil((endAt - Date.now()) / 1000);
}

export function useRestTimer() {
  const [preset, setPreset] = useState(90);
  const [remaining, setRemaining] = useState(90);
  // Wall-clock deadline (ms) while running; null when paused/idle/done.
  const [endAt, setEndAt] = useState(null);
  const [done, setDone] = useState(false);
  const running = endAt !== null;

  useEffect(() => {
    if (endAt === null) return;
    // Guards against finishing twice (interval + visibility event firing
    // before the state update that clears endAt has been committed).
    let finished = false;

    function sync() {
      if (finished) return;
      const left = secondsLeft(endAt);
      if (left <= 0) {
        finished = true;
        setEndAt(null);
        setRemaining(0);
        setDone(true);
        beep();
      } else {
        setRemaining(left);
      }
    }

    function onVisibility() {
      if (document.visibilityState === "visible") sync();
    }

    sync();
    const id = setInterval(sync, TICK_MS);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", sync);
    window.addEventListener("pageshow", sync);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", sync);
      window.removeEventListener("pageshow", sync);
    };
  }, [endAt]);

  function start(seconds) {
    setRemaining(seconds);
    setDone(false);
    setEndAt(Date.now() + seconds * 1000);
  }

  function selectPreset(s) {
    setPreset(s);
    setRemaining(s);
    setEndAt(null);
    setDone(false);
  }

  function adjust(delta) {
    if (running) {
      const now = Date.now();
      const nextEnd = Math.max(now + MIN_SECONDS * 1000, endAt + delta * 1000);
      setEndAt(nextEnd);
      setRemaining(secondsLeft(nextEnd));
    } else if (!done && remaining !== preset) {
      // Paused mid-rest: change only the time left so resume continues from it.
      setRemaining(Math.max(MIN_SECONDS, remaining + delta));
    } else {
      const next = Math.max(MIN_SECONDS, preset + delta);
      setPreset(next);
      setRemaining(next);
    }
    setDone(false);
  }

  function toggle() {
    if (done) {
      start(preset);
    } else if (running) {
      setRemaining(Math.max(1, secondsLeft(endAt)));
      setEndAt(null);
    } else {
      start(remaining);
    }
  }

  function reset() {
    setEndAt(null);
    setDone(false);
    setRemaining(preset);
  }

  function autoStart(seconds) {
    setPreset(seconds);
    start(seconds);
  }

  return { preset, remaining, running, done, progress: remaining / preset, toggle, reset, selectPreset, adjust, autoStart };
}
