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


const SPORTS: Sport[] = ["run", "cycle", "swim", "badminton", "strength", "rest"];

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