// RIR (reps in reserve) is stored per set as an integer 0–4, where 4 means "4+".
// Missing/null means not given — sets logged before RIR existed lack the field.

export const RIR_MAX = 4;

// Tap cycle: – → 0 → 1 → 2 → 3 → 4+ → –
export function nextRir(rir) {
  if (rir == null) return 0;
  return rir >= RIR_MAX ? null : rir + 1;
}

export function rirLabel(rir) {
  if (rir == null) return "–";
  return rir >= RIR_MAX ? `${RIR_MAX}+` : String(rir);
}

// Compact suffix for set lists: " R2", " R4+", or "" when not given
export function rirSuffix(rir) {
  return rir == null ? "" : ` R${rirLabel(rir)}`;
}
