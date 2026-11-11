import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getWorkout } from './api/workout-api';
import type { Workout } from './api/workout-types';
import { errorMessage } from './api/error-message';
import { RequestCancelledError } from './api/api-error';

function WorkoutDetailPage() {
  const { id } = useParams();
  const [workout, setWorkout] = useState<Workout | null>(null);   // null until it's loaded
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

  return (
    <>
      <h1>Workout #{id}</h1>
      {error && <p role="alert">{error}</p>}
      {workout && (
        <ul>
          <li>Sport: {workout.sport}</li>
          <li>Distance: {workout.distance_km ?? "—"}</li>
          <li>Duration: {workout.duration_min ?? "—"}</li>
        </ul>
      )}
      {!workout && !error && <p role="status">Loading workout…</p>}
    </>
  );
}

export default WorkoutDetailPage;