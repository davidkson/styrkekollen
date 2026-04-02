import { supabase } from "./supabase";

// --- Workout logs ---

export async function getLogs() {
  const { data, error } = await supabase
    .from("workout_logs")
    .select("*")
    .order("date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    templateId: row.template_id,
    templateName: row.template_name,
    date: row.date,
    startedAt: row.started_at ?? null,
    finishedAt: row.finished_at ?? null,
    exercises: row.exercises,
  }));
}

export async function insertLog(log) {
  const { error } = await supabase.from("workout_logs").insert({
    id: log.id,
    template_id: log.templateId,
    template_name: log.templateName,
    date: log.date,
    started_at: log.startedAt ?? null,
    finished_at: log.finishedAt ?? null,
    exercises: log.exercises,
  });
  if (error) throw error;
}

export async function updateLogTimestamps(id, startedAt, finishedAt) {
  const { error } = await supabase
    .from("workout_logs")
    .update({ started_at: startedAt, finished_at: finishedAt })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteLog(id) {
  const { error } = await supabase.from("workout_logs").delete().eq("id", id);
  if (error) throw error;
}

// --- Custom exercises ---

export async function getCustomExercises() {
  const { data, error } = await supabase.from("custom_exercises").select("*");
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((row) => [row.template_id, row.exercises]));
}

export async function upsertCustomExercises(templateId, exercises) {
  const { error } = await supabase
    .from("custom_exercises")
    .upsert({ template_id: templateId, exercises });
  if (error) throw error;
}

// --- Exercise names ---

export async function getExerciseNames() {
  const { data, error } = await supabase.from("exercise_names").select("*");
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((row) => [row.exercise_id, row.name]));
}

export async function upsertExerciseName(exerciseId, name) {
  const { error } = await supabase
    .from("exercise_names")
    .upsert({ exercise_id: exerciseId, name });
  if (error) throw error;
}

// --- Active session ---

export async function getActiveSession() {
  const { data, error } = await supabase
    .from("active_session")
    .select("*")
    .eq("id", 1)
    .single();
  if (error) {
    if (error.code === "PGRST116") return null; // row not found
    throw error;
  }
  return data?.data ?? null;
}

export async function saveActiveSession(sessionData) {
  const { error } = await supabase
    .from("active_session")
    .upsert({ id: 1, data: sessionData });
  if (error) throw error;
}

export async function clearActiveSession() {
  const { error } = await supabase.from("active_session").delete().eq("id", 1);
  if (error) throw error;
}
