import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getWorkout, deleteWorkout } from './api/workout-api';
import type { Workout } from './api/workout-types';
import { errorMessage } from './api/error-message';
import { ApiError, RequestCancelledError } from './api/api-error';
import { SPORT_COLORS, SPORT_ICONS } from './sports';
import { formatDate } from './format-date';

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
    <div className="row justify-content-center">
      <div className="col-lg-6">
        <Link to="/workouts" className="text-decoration-none small">← All workouts</Link>

        {error && <div role="alert" className="alert alert-danger mt-3">{error}</div>}
        {!workout && !error && (
          <div role="status" className="text-muted mt-3">
            <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />Loading workout…
          </div>
        )}

        {workout && (
          <div className="card shadow-sm mt-3">
            <div className="card-body p-4">
              <div className="d-flex align-items-center gap-3 mb-4">
                <span
                  className="rounded-circle d-inline-flex align-items-center justify-content-center fs-3"
                  style={{ width: 56, height: 56, background: `${SPORT_COLORS[workout.sport]}22` }}
                  aria-hidden="true"
                >
                  {SPORT_ICONS[workout.sport]}
                </span>
                <div>
                  <h1 className="page-title h3 mb-0 text-capitalize">{workout.sport}</h1>
                  <span className="text-muted small">Workout #{id} · {formatDate(workout.performed_on)}</span>
                </div>
              </div>

              <div className="row text-center mb-4">
                <div className="col">
                  <div className="fs-3 fw-bold">{workout.distance_km ?? "—"}</div>
                  <div className="text-muted small">km</div>
                </div>
                <div className="col">
                  <div className="fs-3 fw-bold">{workout.duration_min ?? "—"}</div>
                  <div className="text-muted small">minutes</div>
                </div>
              </div>

              {!confirming ? (
                <div className="d-flex gap-2">
                  <Link className="btn btn-outline-primary" to={`/workouts/${id}/edit`}>Edit</Link>
                  <button className="btn btn-outline-danger" onClick={() => setConfirming(true)}>Delete</button>
                </div>
              ) : (
                <div className="alert alert-danger d-flex flex-wrap align-items-center gap-2 mb-0">
                  <span className="me-auto">Delete this workout?</span>
                  <button className="btn btn-danger btn-sm" onClick={handleDelete}>Yes, delete</button>
                  <button className="btn btn-outline-secondary btn-sm" onClick={() => setConfirming(false)}>Cancel</button>
                </div>
              )}

              {deleteError && <div role="alert" className="alert alert-danger mt-3 mb-0">{deleteError}</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default WorkoutDetailPage;