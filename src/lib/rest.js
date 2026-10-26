// Parse a template's free-text rest ("90 sek", "2–3 min", "0 sek (superset)").
// Shared by the session view's rest timer and the openGym plan export.

export const DASH = "[–-]";
export const NUM = "(\\d+(?:[.,]\\d+)?)";

export function toNumber(value) {
  const n = parseFloat(String(value ?? "").trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function isSupersetRest(rest) {
  return /superset/i.test(String(rest ?? ""));
}

// "90 sek" -> 90, "2 min" -> 120, "2–3 min" / "45–60 sek" -> upper bound,
// superset or unknown -> null
export function parseRestSec(rest) {
  if (isSupersetRest(rest)) return null;
  const text = String(rest ?? "").trim().toLowerCase();
  const m = text.match(new RegExp(`^${NUM}(?:\\s*${DASH}\\s*${NUM})?\\s*(sek|s|min)$`));
  if (!m) return null;
  const value = toNumber(m[2] ?? m[1]);
  const sec = Math.round(m[3] === "min" ? value * 60 : value);
  return sec > 0 ? sec : null;
}
