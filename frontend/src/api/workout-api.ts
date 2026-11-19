// frontend/src/api/workout-api.ts
import { request } from "./client";
import { parseWorkout, parseWorkoutList, type NewWorkout, type Workout, type WorkoutListResponse } from "./workout-types";
import { NetworkError, InvalidResponseError } from "./api-error";
import { parseWeeklyStats, type WeeklyStat, parseUploadPreview, type UploadPreview } from "./workout-types";

export const PAGE_SIZE = 10;

export type WorkoutQuery = {
  sport?: string;     // "" or missing = all sports
  sort?: string;      // e.g. "-distance_km"
  page: number;       // 1-based, as users see it
};

export async function getWorkouts(query: WorkoutQuery, signal?: AbortSignal): Promise<WorkoutListResponse> {
  const params = new URLSearchParams();
  params.set("limit", String(PAGE_SIZE));
  params.set("offset", String((query.page - 1) * PAGE_SIZE));
  if (query.sport) {
    params.set("sport", query.sport)
  }
  if (query.sort) {
    params.set("sort", query.sort)
  }
  const data = await request(`/workouts?${params}`, { signal });
  return parseWorkoutList(data);
}

export async function getWorkout(id: number, signal?: AbortSignal): Promise<Workout> {
  const data = await request(`/workouts/${id}`, { signal });              // the URL for one workout
  return parseWorkout(data);                               // check it with the right parse function
}

export async function createWorkout(workout: NewWorkout): Promise<Workout> {
  const data = await request(`/workouts`, {
    method: "POST",                                // which HTTP method creates something?
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(workout),
  });
  return parseWorkout(data);
}

export async function updateWorkout(id: number, workout: NewWorkout): Promise<Workout> {
  // TODO: the same as createWorkout, but:
  //   - the URL includes the id (template string with backticks)
  //   - the method is "PUT"
  const data = await request(`/workouts/${id}`, {
    method: "PUT",                                // which HTTP method creates something?
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(workout),
  });
  return parseWorkout(data);

}

export async function deleteWorkout(id: number): Promise<void> {
  await request(`/workouts/${id}`, { method: "DELETE" });
}

export async function getWeeklyStats(weeks: number, signal?: AbortSignal): Promise<WeeklyStat[]> {
  const data = await request(`/stats/weekly?weeks=${weeks}`, { signal });
  return parseWeeklyStats(data);
}

export type ImportResult = { inserted: number; skipped: number };

export async function uploadWorkouts(file: File): Promise<ImportResult> {
  const body = new FormData();
  body.append("file", file);
  const data = await request("/workouts/upload", { method: "POST", body });

  const result = data as { inserted?: unknown; skipped?: unknown };
  if (typeof result?.inserted !== "number" || typeof result?.skipped !== "number") {
    throw new InvalidResponseError("inserted and skipped must be numbers.");
  }
  return { inserted: result.inserted, skipped: result.skipped };
}

export async function previewUpload(file: File, signal?: AbortSignal): Promise<UploadPreview> {
  const body = new FormData();
  body.append("file", file);
  const data = await request("/workouts/upload/preview", { method: "POST", body, signal });
  return parseUploadPreview(data);
}

export async function checkConnection(): Promise<boolean> {
  try {
    await request("/workouts?limit=1");
    return true;
  } catch (err) {
    if (err instanceof NetworkError) return false;
    return true;
  }
}