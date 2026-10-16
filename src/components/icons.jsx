/*
 * Monokroma ikoner som inline-SVG.
 *
 * Emoji renderas i fullfärg av operativsystemet och går inte att färgsätta via
 * tokens. Det gäller fler tecken än man tror: ✎ (U+270E) och ✏ (U+270F) får
 * emojipresentation i Chrome på Windows trots att de saknar variantväljare.
 * Ikonerna här ärver currentColor och följer därför --fg-3 / --text / --accent-ink.
 *
 * Rent geometriska tecken — ✕ ✓ ▲ ▼ ↺ ► ▮ ← → ↑ ↓ ☰ − — renderas som text på
 * alla plattformar och används fortfarande direkt i JSX.
 */
const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

export function IconHome({ size = 22 }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth="1.8">
      <path d="M3 9.5 12 2.5l9 7V20a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 20z" />
      <path d="M9.5 21.5v-8h5v8" />
    </svg>
  );
}

export function IconHistory({ size = 22 }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth="1.8">
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
    </svg>
  );
}

export function IconProgress({ size = 22 }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth="1.8">
      <path d="M3 17.5 9 11l4 4 8-8.5" />
      <path d="M15.5 6.5H21V12" />
    </svg>
  );
}

export function IconTools({ size = 22 }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth="1.8">
      <path d="M14.6 6.4a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z" />
    </svg>
  );
}

export function IconStart({ size = 22 }) {
  return (
    <svg {...base} width={size} height={size} fill="currentColor" stroke="none">
      <path d="M8.5 5.6a1 1 0 0 1 1.5-.9l8 6.3a1 1 0 0 1 0 1.6l-8 6.3a1 1 0 0 1-1.5-.8z" />
    </svg>
  );
}

export function IconPencil({ size = 15 }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth="2">
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z" />
    </svg>
  );
}

export function IconLock({ size = 14 }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth="2">
      <rect x="4" y="10.5" width="16" height="11" rx="2" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
    </svg>
  );
}
