// frontend/src/api/workout-api.ts
import { request } from "./client";
import { parseWorkout, parseWorkoutList, type NewWorkout, type Workout, type WorkoutListResponse } from "./workout-types";

export async function getWorkouts(): Promise<WorkoutListResponse> {
  const data = await request(`/workouts`);
  return parseWorkoutList(data);
}

export async function getWorkout(id: number): Promise<Workout> {
  const data = await request(`/workouts/${id}`);              // the URL for one workout
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