# Styrkekollen

Svensk PWA för styrketräningsloggning.

## Tech stack

- React 19 + Vite 8 (ES modules)
- Supabase (PostgreSQL BaaS) för persistens
- Ren CSS med variabler (6 teman: dark, light, ember, fresh, invit, glass — glass är default)
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
| progress | ExerciseProgress.jsx | Övningsutveckling över tid |

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

### Slack-integration

- Cloudflare Worker i `slack-worker/` tar emot meddelanden från Slack-kanal `#styrkekollen-issues`
- Meddelanden skapar automatiskt GitHub issues i repot
- Första raden = titel, resten = body, hashtags = labels
- Boten svarar i tråden med länk till issuet

## Arbetsflöde

- Jag (Claude) tar rollen som senior utvecklare med övergripande kunskap
- Arbete delegeras till subagenter för implementation
- Svenska i UI, engelska i kod

### Issue-hantering

1. **Diskutera** — prata igenom feature/bugg
2. **Issue** — skapa GitHub issue med tydlig beskrivning
3. **Delegera** — skicka till subagent för implementation
4. **Review** — granska resultat innan vi är klara

### Issues från Slack

Issues som skapas via Slack-kanalen kan vara kortfattade eller otydliga. Innan delegering till subagent:

1. **Läs och förstå** — tolka issuet i kontexten av appens arkitektur
2. **Verifiera med användaren** — ställ frågor om scope, beteende och avgränsningar
3. **Uppdatera issuet** — komplettera med teknisk specifikation
4. **Delegera först efter godkännande** — användaren måste bekräfta innan implementation startar
