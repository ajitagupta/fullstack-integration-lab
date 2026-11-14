// frontend/src/api/workout-api.ts
import { request } from "./client";
import { parseWorkout, parseWorkoutList, type NewWorkout, type Workout, type WorkoutListResponse } from "./workout-types";
import { NetworkError } from "./api-error";


export async function getWorkouts(signal?: AbortSignal): Promise<WorkoutListResponse> {
  const data = await request(`/workouts`, { signal });
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

export async function checkConnection(): Promise<boolean> {
  try {
    await request("/workouts?limit=1");
    return true;
  } catch (err) {
    if (err instanceof NetworkError) return false;
    return true;
  }
}