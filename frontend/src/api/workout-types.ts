// frontend/src/api/workout-types.ts
import { InvalidResponseError } from "./api-error";

// The six allowed sports, as a union of string literals
export type Sport = "run" | "cycle" | "swim" | "badminton" | "strength" | "rest";

// One workout, as the API returns it
export type Workout = {
  id: number;
  sport: Sport;
  distance_km: number | null;                     // a number, or null for rest/badminton/strength
  duration_min: number | null;                    // a number, or null for rest
};

// The response of GET /workouts
export type WorkoutListResponse = {
  workouts: Workout[];                        // a list of Workout
  total: number;
  limit: number;
  offset: number;
};

// What you send to POST /workouts
export type NewWorkout = {
  sport: Sport;
  distance_km?: number;
  duration_min?: number;
};


export const SPORTS: Sport[] = ["run", "cycle", "swim", "badminton", "strength", "rest"];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseWorkout(value: unknown): Workout {
  if (!isObject(value)) throw new InvalidResponseError("Workout is not an object.");
  if (typeof value.id !== "number") throw new InvalidResponseError("Workout id must be a number.");
  if (typeof value.sport !== "string" || !SPORTS.includes(value.sport as Sport)) throw new InvalidResponseError("Workout sport is not an allowed sport.");
  if (value.distance_km !== null && typeof value.distance_km !== "number") throw new InvalidResponseError("Workout distance_km must be a number or null.");
  if (value.duration_min !== null && typeof value.duration_min !== "number") throw new InvalidResponseError("Workout duration_min must be a number or null.");

  return {
    id: value.id,
    sport: value.sport as Sport,
    distance_km: value.distance_km as number | null,
    duration_min: value.duration_min as number | null,
  };
}

export function parseWorkoutList(value: unknown): WorkoutListResponse {
  if (!isObject(value)) throw new InvalidResponseError("Response is not an object.");
  if (!Array.isArray(value.workouts)) throw new InvalidResponseError("workouts must be a list.");
  if (typeof value.total !== "number" || typeof value.limit !== "number" || typeof value.offset !== "number") throw new InvalidResponseError("total, limit and offset must be numbers.");

  return {
    workouts: value.workouts.map((w) => parseWorkout(w)),
    total: value.total as number,
    limit: value.limit as number,
    offset: value.offset as number,
  };
}

// One row of GET /stats/weekly
export type WeeklyStat = {
  week_start: string;          // "2026-11-16", the Monday
  sport: Sport;
  workouts: number;
  distance_km: number;
  duration_min: number;
};

export function parseWeeklyStats(value: unknown): WeeklyStat[] {
  if (!isObject(value) || !Array.isArray(value.stats)) throw new InvalidResponseError("stats must be a list.");

  return value.stats.map((row) => {
    if (!isObject(row)) throw new InvalidResponseError("Stat row is not an object.");
    if (typeof row.week_start !== "string") throw new InvalidResponseError("week_start must be a string.");
    if (typeof row.sport !== "string" || !SPORTS.includes(row.sport as Sport)) throw new InvalidResponseError("Stat sport is not an allowed sport.");
    if (typeof row.workouts !== "number" || typeof row.distance_km !== "number" || typeof row.duration_min !== "number")
      throw new InvalidResponseError("workouts, distance_km and duration_min must be numbers.");

    return {
      week_start: row.week_start,
      sport: row.sport as Sport,
      workouts: row.workouts,
      distance_km: row.distance_km,
      duration_min: row.duration_min,
    };
  });
}

// GET-like answer of POST /workouts/upload/preview
export type PreviewRow = {
  row: number;
  sport: string | null;
  distance_km: number | string | null;      // a string when the file had text instead of a number
  duration_min: number | string | null;
  error: { field: string; error: string } | null;
};

export type UploadPreview = { rows: PreviewRow[]; valid: number; invalid: number };

export function parseUploadPreview(value: unknown): UploadPreview {
  if (!isObject(value) || !Array.isArray(value.rows) || typeof value.valid !== "number" || typeof value.invalid !== "number")
    throw new InvalidResponseError("The preview has an unexpected shape.");
  return { rows: value.rows as PreviewRow[], valid: value.valid, invalid: value.invalid };
}