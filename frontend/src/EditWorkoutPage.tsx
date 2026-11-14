import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getWorkout } from "./api/workout-api";
import type { Workout } from "./api/workout-types";
import { RequestCancelledError } from "./api/api-error";
import { errorMessage } from "./api/error-message";
import { WorkoutForm } from "./forms/WorkoutForm";
import { toFormValues } from "./forms/validate-workout";

export function EditWorkoutPage() {
  const { id } = useParams();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    setWorkout(null);
    setError(null);

    getWorkout(Number(id), controller.signal)
      .then((workout) => setWorkout(workout))
      .catch((err) => {
        if (err instanceof RequestCancelledError) return;
        setError(errorMessage(err));
      });

    return () => controller.abort();
  }, [id]);

  if (error) return <p role="alert">{error}</p>;
  if (!workout) return <p role="status">Loading workout…</p>;

  return <WorkoutForm workoutId={workout.id} initialValues={toFormValues(workout)} />;
}