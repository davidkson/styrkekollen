# Styrkekollen

Svensk PWA för styrketräningsloggning.

## Tech stack

- React 19 + Vite 8 (ES modules)
- Supabase (PostgreSQL BaaS) för persistens
- Ren CSS med variabler (5 teman: dark, light, ember, fresh, invit)
- Ingen router — vyhantering via `view`-state i App.jsx
- Ingen state management-lib — React hooks + localStorage + Supabase

## Arkitektur

### Vyer (App.jsx `view`-state)

| Vy | Komponent | Beskrivning |
|---|---|---|
| login | Login.jsx | Lösenordsskydd (VITE_APP_PASSWORD) |
| home | Home.jsx | Mallval, starta/återuppta pass |
| session | WorkoutSession.jsx | Aktiv träningsloggning |
| edit | EditPass.jsx | Redigera mallar/övningar |
| history | History.jsx | Träningshistorik, PR, 1RM |

### Nyckelkomponenter

- **App.jsx** (~355 rader) — Central orkestrerare, all state, timer-bar
- **WorkoutSession.jsx** (~451 rader) — Set-för-set-loggning, superset, fokusläge, volym
- **History.jsx** (~225 rader) — PR-detektion, 1RM (Epley), expanderbara poster
- **EditPass.jsx** (~177 rader) — Mallredigering, lägg till/ta bort/ordna övningar
- **PlateCalculator.jsx** (~176 rader) — Skivkalkylator (17 kg stång)
- **Home.jsx** (~147 rader) — Mallkort, duplicering, custom templates
- **RestTimer.jsx** (~67 rader) — FAB-timer med ring-progress
- **MigratePrompt.jsx** — Engångsmigration localStorage → Supabase

### Hooks

- `useRestTimer.js` — Timer-state, presets, auto-start
- `useTheme.js` — Tema-toggle med localStorage
- `useSwipeBack.js` — Touch swipe-back navigation
- `useStorage.js` — Finns men används ej

### Backend (Supabase)

**Tabeller:** `workout_logs`, `custom_exercises`, `exercise_names`, `custom_templates`, `active_session`

**db.js-operationer:** getLogs, insertLog, deleteLog, updateLogTimestamps, getCustomExercises, upsertCustomExercises, getExerciseNames, upsertExerciseName, getCustomTemplates, upsertCustomTemplate, deleteCustomTemplate, getActiveSession, saveActiveSession, clearActiveSession

### Övrigt

- `haptic.js` — Vibration vid set-completion
- `workouts.js` — 3 inbyggda mallar + 1 demo
- Session-state debounce 2s innan Supabase-sparning
- Mobilfokus: viewport-fit=cover, swipe, haptics, 16px inputs

## Arbetsflöde

- Jag (Claude) tar rollen som senior utvecklare med övergripande kunskap
- Arbete delegeras till subagenter för implementation
- Svenska i UI, engelska i kod
