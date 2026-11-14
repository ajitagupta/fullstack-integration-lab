import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getWorkout, deleteWorkout } from './api/workout-api';
import type { Workout } from './api/workout-types';
import { errorMessage } from './api/error-message';
import { ApiError, RequestCancelledError } from './api/api-error';

function WorkoutDetailPage() {
  const { id } = useParams();
  const [workout, setWorkout] = useState<Workout | null>(null);   // null until it's loaded
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const navigate = useNavigate();

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


  async function handleDelete() {
    try {
      await deleteWorkout(Number(id));
      navigate("/workouts");
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        navigate("/workouts");            // already gone → the goal is reached
      } else {
        setDeleteError(errorMessage(err));
      }
    }
  }

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
      {workout && <Link className="action" to={`/workouts/${id}/edit`}>Edit</Link>}
      {workout && !confirming && <button className="action" onClick={() => setConfirming(true)}>Delete</button>}
      {confirming && (
        <p>
          Delete this workout?{" "}
          <button className="action danger" onClick={handleDelete}>Yes, delete</button>{" "}
          <button className="action" onClick={() => setConfirming(false)}>Cancel</button>
        </p>
      )}
      {deleteError && <p role="alert">{deleteError}</p>}
    </>
  );
}

export default WorkoutDetailPage;