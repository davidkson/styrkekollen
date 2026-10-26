// Full backup of the app's data as JSON, and a merge import that only adds
// what is missing. The format is a plain serialization of App state, which in
// turn has the shapes db.js returns. active_session is not included.

export const BACKUP_VERSION = 1;

export function buildBackup({ logs, customTemplates, customExercises, customNames }) {
  return {
    styrkekollen_backup: BACKUP_VERSION,
    exported: new Date().toISOString(),
    logs,
    customTemplates,
    customExercises,
    exerciseNames: customNames,
  };
}

export function backupFilename(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `styrkekollen-backup-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
}

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isId = (v) => typeof v === "string" && v.length > 0;

// Validates the file as a whole. Throws an Error with a Swedish message that
// can be shown as is. Individual entries are checked later by planImport.
export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Filen är inte giltig JSON.");
  }
  if (!isObject(data) || data.styrkekollen_backup === undefined) {
    throw new Error("Filen är ingen Styrkekollen-backup.");
  }
  if (data.styrkekollen_backup !== BACKUP_VERSION) {
    throw new Error(`Okänd backupversion (${data.styrkekollen_backup}).`);
  }
  if (
    !Array.isArray(data.logs) ||
    !Array.isArray(data.customTemplates) ||
    !isObject(data.customExercises) ||
    !isObject(data.exerciseNames)
  ) {
    throw new Error("Backupfilen saknar data eller har fel format.");
  }
  return data;
}

const validLog = (l) =>
  isObject(l) && isId(l.id) && typeof l.date === "string" && Array.isArray(l.exercises);
const validTemplate = (t) => isObject(t) && isId(t.id) && typeof t.name === "string";
const validExercise = (e) => isObject(e) && isId(e.id);

// Works out what to add, given a parsed backup and the current App state.
// Nothing existing is changed: logs and templates are matched on id, exercises
// on id within their template, names on exercise id.
export function planImport(backup, { logs, customTemplates, customExercises, customNames }) {
  const counts = { logs: 0, templates: 0, exercises: 0, names: 0, existing: 0, invalid: 0 };

  const logIds = new Set(logs.map((l) => l.id));
  const newLogs = [];
  for (const log of backup.logs) {
    if (!validLog(log)) { counts.invalid++; continue; }
    if (logIds.has(log.id)) { counts.existing++; continue; }
    logIds.add(log.id);
    newLogs.push({
      id: log.id,
      templateId: log.templateId ?? null,
      templateName: log.templateName ?? null,
      date: log.date,
      startedAt: log.startedAt ?? null,
      finishedAt: log.finishedAt ?? null,
      exercises: log.exercises,
      note: log.note ?? null,
    });
  }
  counts.logs = newLogs.length;

  const templateIds = new Set(customTemplates.map((t) => t.id));
  const newTemplates = [];
  for (const t of backup.customTemplates) {
    if (!validTemplate(t)) { counts.invalid++; continue; }
    if (templateIds.has(t.id)) { counts.existing++; continue; }
    templateIds.add(t.id);
    newTemplates.push({ id: t.id, name: t.name, exercises: [] });
  }
  counts.templates = newTemplates.length;

  // Full lists per template, ready for upsertCustomExercises. New exercises go
  // last, after the ones already in the template.
  const exercises = {};
  for (const [templateId, list] of Object.entries(backup.customExercises)) {
    if (!Array.isArray(list)) { counts.invalid++; continue; }
    const current = customExercises[templateId] ?? [];
    const ids = new Set(current.map((e) => e.id));
    const added = [];
    for (const ex of list) {
      if (!validExercise(ex)) { counts.invalid++; continue; }
      if (ids.has(ex.id)) { counts.existing++; continue; }
      ids.add(ex.id);
      added.push(ex);
    }
    if (added.length) {
      exercises[templateId] = [...current, ...added];
      counts.exercises += added.length;
    }
  }

  const names = {};
  for (const [exerciseId, name] of Object.entries(backup.exerciseNames)) {
    if (typeof name !== "string" || !name.trim()) { counts.invalid++; continue; }
    if (customNames[exerciseId] !== undefined) { counts.existing++; continue; }
    names[exerciseId] = name;
    counts.names++;
  }

  return { logs: newLogs, templates: newTemplates, exercises, names, counts };
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// "12 pass, 1 mall och 3 övningar importerade. 40 fanns redan."
export function importSummary(counts) {
  const parts = [];
  if (counts.logs) parts.push(plural(counts.logs, "pass", "pass"));
  if (counts.templates) parts.push(plural(counts.templates, "mall", "mallar"));
  if (counts.exercises) parts.push(plural(counts.exercises, "övning", "övningar"));
  if (counts.names) parts.push(plural(counts.names, "namn", "namn"));

  let text = parts.length
    ? `${parts.length > 1 ? `${parts.slice(0, -1).join(", ")} och ${parts.at(-1)}` : parts[0]} importerade.`
    : "Inget nytt att importera.";
  if (counts.existing) text += ` ${counts.existing} fanns redan.`;
  if (counts.invalid) text += ` ${plural(counts.invalid, "ogiltig post", "ogiltiga poster")} hoppades över.`;
  return text;
}
