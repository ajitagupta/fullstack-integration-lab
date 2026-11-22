import { Link, useSearchParams } from 'react-router-dom';
import { getWorkouts } from './api/workout-api';
import { SPORTS, type Workout } from './api/workout-types';
import { useEffect, useState } from 'react';
import { errorMessage } from './api/error-message';
import { RequestCancelledError } from './api/api-error';
import { PAGE_SIZE } from './api/workout-api';
import { SPORT_COLORS, SPORT_ICONS } from './sports';
import { formatDate } from './format-date';

function WorkoutsPage() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [searchParams, setSearchParams] = useSearchParams();
  const [total, setTotal] = useState(0);  
  const [reloadKey, setReloadKey] = useState(0);

  const sport = searchParams.get("sport") ?? "";
  const sort = searchParams.get("sort") ?? "id";
  const page = Number(searchParams.get("page") ?? "1");

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilter = sport !== "";

  function updateParam(name: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(name, value);
    } else {
      next.delete(name);                              // "All sports" → remove it from the URL
    }
    next.delete("page");                              // a new filter → back to page 1
    setSearchParams(next);
  }

  function goToPage(n: number) {
    const next = new URLSearchParams(searchParams);
    if (n === 1) {
      next.delete("page");          // page 1 is the default, so keep the URL clean
    } else {
      next.set("page", String(n));
    }
    setSearchParams(next);
  }

  function load(signal: AbortSignal) {
    setStatus("loading");                       // a new attempt starts
    getWorkouts({ sport, sort, page }, signal)
      .then((result) => {
        setWorkouts(result.workouts);
        setTotal(result.total);
        setStatus("success");
      })
      .catch((err) => {
        if (err instanceof RequestCancelledError) return;
        setError(errorMessage(err));
        setStatus("error");
      });
  }

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [sport, sort, page, reloadKey]);

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-4">
        <h1 className="page-title mb-0">Workouts</h1>

        <div className="d-flex flex-wrap gap-2">
          <div>
            <label htmlFor="sport-filter" className="form-label small text-muted mb-1">Sport</label>
            <select id="sport-filter" className="form-select" value={sport} onChange={(e) => updateParam("sport", e.target.value)}>
              <option value="">All sports</option>
              {SPORTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="sort-order" className="form-label small text-muted mb-1">Sort by</label>
            <select id="sort-order" className="form-select" value={sort} onChange={(e) => updateParam("sort", e.target.value)}>
              <option value="id">Order added</option>
              <option value="-distance_km">Longest distance</option>
              <option value="-duration_min">Longest duration</option>
            </select>
          </div>
        </div>
      </div>

      {status === "loading" && (
        <div role="status" className="text-muted d-flex align-items-center gap-2">
          <span className="spinner-border spinner-border-sm" aria-hidden="true" /> Loading workouts…
        </div>
      )}

      {status === "error" && (
        <div role="alert" className="alert alert-danger d-flex justify-content-between align-items-center">
          <span>{error}</span>
          <button className="btn btn-outline-danger btn-sm" onClick={() => setReloadKey((k) => k + 1)}>Try again</button>
        </div>
      )}

      {status === "success" && workouts.length === 0 && total === 0 && !hasFilter && (
        <div role="status" className="text-center py-5">
          <p className="fs-5 mb-3">No workouts yet.</p>
          <Link className="btn btn-primary" to="/quick-add">Add your first one</Link>
        </div>
      )}
      {status === "success" && workouts.length === 0 && total === 0 && hasFilter && (
        <div role="status" className="alert alert-light border">
          No {sport} workouts found.{" "}
          <button className="btn btn-link p-0 align-baseline" onClick={() => updateParam("sport", "")}>Clear filter</button>
        </div>
      )}
      {status === "success" && workouts.length === 0 && total > 0 && (
        <div role="status" className="alert alert-light border">
          Page {page} doesn't exist.{" "}
          <button className="btn btn-link p-0 align-baseline" onClick={() => goToPage(1)}>Go to page 1</button>
        </div>
      )}

      {status === "success" && workouts.length > 0 && (
        <div className="list-group shadow-sm mb-4">
          {workouts.map((workout) => (
            <Link
              key={workout.id}
              to={`/workouts/${workout.id}`}
              className="list-group-item list-group-item-action d-flex align-items-center gap-3 py-3"
            >
              <span
                className="rounded-circle d-inline-flex align-items-center justify-content-center fs-5"
                style={{ width: 44, height: 44, background: `${SPORT_COLORS[workout.sport]}22` }}
                aria-hidden="true"
              >
                {SPORT_ICONS[workout.sport]}
              </span>
              <span className="flex-grow-1">
                <span className="d-block fw-semibold text-capitalize">{workout.sport}</span>
                <span className="d-block text-muted small">{formatDate(workout.performed_on)}</span>
              </span>
              <span className="text-muted text-end small">
                {workout.distance_km !== null && <span className="me-3">{workout.distance_km} km</span>}
                {workout.duration_min !== null && <span>{workout.duration_min} min</span>}
              </span>
            </Link>
          ))}
        </div>
      )}

      {status === "success" && total > 0 && (
        <nav aria-label="Pagination" className="d-flex justify-content-between align-items-center">
          <button className="btn btn-outline-primary" onClick={() => goToPage(page - 1)} disabled={page <= 1}>← Previous</button>
          <span className="text-muted small">Page {page} of {totalPages} · {total} workouts</span>
          <button className="btn btn-outline-primary" onClick={() => goToPage(page + 1)} disabled={page >= totalPages}>Next →</button>
        </nav>
      )}
    </>
  )
}

export default WorkoutsPage
