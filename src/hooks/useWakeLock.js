import { useEffect } from "react";

// Keeps the screen awake while the calling component is mounted.
// The browser drops the lock whenever the page is hidden, so it is
// requested again each time the page becomes visible.
export function useWakeLock() {
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;

    let sentinel = null;
    let pending = false;
    let active = true;

    async function request() {
      if (pending || document.visibilityState !== "visible") return;
      if (sentinel && !sentinel.released) return;
      pending = true;
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (active) sentinel = lock;
        else lock.release().catch(() => {});
      } catch {
        // Denied (e.g. low battery, no user activation) or unsupported; the lock is optional.
      } finally {
        pending = false;
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") request();
    }

    request();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (sentinel && !sentinel.released) sentinel.release().catch(() => {});
      sentinel = null;
    };
  }, []);
}
