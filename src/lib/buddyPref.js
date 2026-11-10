// Whether the pixel buddy is shown in the workout session (on by default)
const KEY = "styrkekollen-buddy";

export function readBuddyPref() {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function writeBuddyPref(visible) {
  try {
    localStorage.setItem(KEY, visible ? "on" : "off");
  } catch {
    // Storage unavailable (private mode etc.) — the choice just isn't remembered
  }
}
