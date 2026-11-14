// frontend/src/forms/validate-workout.ts
import { SPORTS, type Sport, type NewWorkout, type Workout } from "../api/workout-types";

// What the form holds: always strings, straight from the inputs
export type WorkoutFormValues = {
  sport: string;
  distance: string;
  duration: string;
};


export function toNewWorkout(values: WorkoutFormValues): NewWorkout {
  return {
    sport: values.sport as Sport,
    distance_km: values.distance.trim() !== "" ? Number(values.distance) : undefined,
    duration_min: values.duration.trim() !== "" ? Number(values.duration) : undefined
  };
}

// One message per field, or nothing. {} means "valid"
export type FieldErrors = Partial<Record<keyof WorkoutFormValues, string>>;

const DISTANCE_REQUIRED = ["run", "swim", "cycle"];
const DURATION_OPTIONAL = ["rest"];

export function validateWorkout(values: WorkoutFormValues): FieldErrors {
  const errors: FieldErrors = {};

  const distanceGiven = values.distance.trim() !== "";
  const durationGiven = values.duration.trim() !== "";
  const distance = Number(values.distance);
  const duration = Number(values.duration);

  // --- sport ---
  if (!(SPORTS as readonly string[]).includes(values.sport)) {
    errors.sport = "Please choose a sport.";
   }

  // --- distance ---
  if (distanceGiven) {
    if (Number.isNaN(distance))
    {
        errors.distance = "Distance provided is not a number."
    }
    else if (distance < 0)
    {
        errors.distance = "Distance provided is negative."
    }    

  } else {
    if (DISTANCE_REQUIRED.includes(values.sport))
    {
        errors.distance = "Distance is required for run, swim and cycle.";
    }
  }

  // --- duration ---
  if (durationGiven) {
    if (Number.isNaN(duration))
    {
        errors.duration = "Duration provided is not a number."
    }
    else if (!Number.isInteger(duration))
    {
        errors.duration = "Duration must be a whole number of minutes.";
    }
    else if (duration < 0)
    {
        errors.duration = "Duration provided is negative."
    }    

  } else {
    if (!DURATION_OPTIONAL.includes(values.sport))
    {
        errors.duration = "Duration is required (except for rest days).";
    }
  }

  return errors;
}


export function toFormValues(workout: Workout): WorkoutFormValues {
  return {
    sport: workout.sport,
    distance: workout.distance_km === null ? "" : String(workout.distance_km),
    duration: workout.duration_min === null ? "" : String(workout.duration_min),
  };
}