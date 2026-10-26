// Warm-up sets are marked during the session with `warmup: true` on the set.
// They are logged and shown, but never count toward volume, set counts, PRs,
// 1RM, suggestions, progress or the prefill. Old logs have no `warmup` field,
// so every set in them is a working set.
export function isWarmup(set) {
  return set?.warmup === true;
}

export function workingSets(sets) {
  return (sets ?? []).filter((s) => !isWarmup(s));
}

// Set-number labels for a list of sets: "U" for warm-ups, working sets numbered
// 1..n without counting the warm-ups
export function setLabels(sets) {
  let n = 0;
  return (sets ?? []).map((s) => (isWarmup(s) ? "U" : String(++n)));
}
