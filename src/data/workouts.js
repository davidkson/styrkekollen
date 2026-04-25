export const workoutTemplates = [
  {
    id: "pass1",
    name: "Pass 1 — Bröst / Axlar / Triceps",
    exercises: [
      { id: "e1", name: "Bänkpress (skivstång)", sets: 4, repsRange: "5–8", rest: "60–90 sek" },
      { id: "e2", name: "Militärpress (stående)", sets: 4, repsRange: "5–8", rest: "60–90 sek" },
      { id: "e3", name: "Lutande hantelpress", sets: 3, repsRange: "8–12", rest: "60 sek" },
      { id: "e4", name: "Sidolyft (hantlar)", sets: 3, repsRange: "12–15", rest: "45–60 sek" },
      { id: "e5", name: "Smal bänkpress (tricepsfokus)", sets: 3, repsRange: "6–10", rest: "60 sek" },
      { id: "e6", name: "Mage: Hanging leg raises", sets: 3, repsRange: "8–15", rest: "30–45 sek" },
      { id: "e7", name: "Mage: Plankan", sets: 3, repsRange: "30–60 sek", rest: "30 sek" },
    ],
  },
  {
    id: "pass2",
    name: "Pass 2 — Rygg / Biceps",
    exercises: [
      { id: "e8", name: "Marklyft (skivstång)", sets: 4, repsRange: "3–6", rest: "2–3 min" },
      { id: "e9", name: "Pull-ups / Chin-ups", sets: 4, repsRange: "max", rest: "90 sek" },
      { id: "e10", name: "Skivstångsrodd", sets: 3, repsRange: "6–10", rest: "60–90 sek" },
      { id: "e11", name: "Omvänd rodd (rear delt row, hantlar)", sets: 3, repsRange: "10–15", rest: "45–60 sek" },
      { id: "e12", name: "Bicepscurl (skivstång eller hantlar)", sets: 3, repsRange: "8–12", rest: "45–60 sek" },
      { id: "e13", name: "Mage: Sit-ups / crunches", sets: 3, repsRange: "15–20", rest: "30–45 sek" },
      { id: "e14", name: "Mage: Russian twists (med vikt)", sets: 3, repsRange: "20 reps", rest: "30 sek" },
    ],
  },
  {
    id: "pass2b",
    name: "Pass 2B — Rygg / Biceps (utan marklyft)",
    exercises: [
      { id: "e2b1", name: "Hantelrodd (enarms)", sets: 4, repsRange: "8–12", rest: "60–90 sek" },
      { id: "e2b2", name: "Pull-ups / Chin-ups", sets: 4, repsRange: "max", rest: "90 sek" },
      { id: "e2b3", name: "Skivstångsrodd", sets: 3, repsRange: "6–10", rest: "60–90 sek" },
      { id: "e2b4", name: "Omvänd rodd (rear delt row, hantlar)", sets: 3, repsRange: "10–15", rest: "45–60 sek" },
      { id: "e2b5", name: "Reverse flyes (hantlar)", sets: 3, repsRange: "15–20", rest: "45 sek" },
      { id: "e2b6", name: "Bicepscurl (skivstång eller hantlar)", sets: 3, repsRange: "8–12", rest: "45–60 sek" },
      { id: "e2b7", name: "Mage: Sit-ups / crunches", sets: 3, repsRange: "15–20", rest: "30–45 sek" },
      { id: "e2b8", name: "Mage: Russian twists (med vikt)", sets: 3, repsRange: "20 reps", rest: "30 sek" },
    ],
  },
  {
    id: "demo",
    name: "Demo",
    demo: true,
    exercises: [
      { id: "d1", name: "Squat", sets: 3, repsRange: "8–10", rest: "90 sek" },
      { id: "d2", name: "Bänkpress", sets: 3, repsRange: "8–10", rest: "90 sek" },
      { id: "d3", name: "Marklyft", sets: 3, repsRange: "6–8", rest: "2 min" },
      { id: "d4", name: "Pull-ups", sets: 3, repsRange: "max", rest: "60 sek" },
      { id: "d5", name: "Plankan", sets: 3, repsRange: "45 sek", rest: "30 sek" },
    ],
  },
];
