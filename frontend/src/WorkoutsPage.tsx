import { Link, useSearchParams } from 'react-router-dom';
import { getWorkouts } from './api/workout-api';
import { SPORTS, type Workout } from './api/workout-types';
import { useEffect, useState } from 'react';
import './App.css'
import { errorMessage } from './api/error-message';
import { RequestCancelledError } from './api/api-error';
import { PAGE_SIZE } from './api/workout-api';

function Welcome() {
  return <h2>--- Welcome to my workout tracker ---</h2>
}



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
      <h1>My Workout Tracker</h1>
      <Welcome />
      <div>
        <label htmlFor="sport-filter">Sport</label>
        <select id="sport-filter" value={sport} onChange={(e) => updateParam("sport", e.target.value)}>
          <option value="">All sports</option>
          {SPORTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <label htmlFor="sort-order">Sort by</label>
        <select id="sort-order" value={sort} onChange={(e) => updateParam("sort", e.target.value)}>
          <option value="id">Order added</option>
          <option value="-distance_km">Longest distance</option>
          <option value="-duration_min">Longest duration</option>
        </select>
      </div>

      {status === "loading" && <p role="status">Loading workouts…</p>}
      {status === "error" && (
        <div role="alert">
          <p>{error}</p>
          <button onClick={() => setReloadKey((k) => k + 1)}>Try again</button>
        </div>
      )}
      {status === "success" && workouts.length === 0 && total === 0 && !hasFilter && (
        <p role="status">No workouts yet - add your first one.</p>
      )}
      {status === "success" && workouts.length === 0 && total === 0 && hasFilter && (
        <p role="status">
          No {sport} workouts found.{" "}
          <button onClick={() => updateParam("sport", "")}>Clear filter</button>
        </p>
      )}
      {status === "success" && workouts.length === 0 && total > 0 && (
        <p role="status">
          Page {page} doesn't exist.{" "}
          <button onClick={() => goToPage(1)}>Go to page 1</button>
        </p>
      )}
      {status === "success" && workouts.map((workout) => (
        <p key={workout.id}>
          <Link to={`/workouts/${workout.id}`}>{workout.sport}</Link>
          {" "}· {workout.distance_km ?? "—"} km · {workout.duration_min ?? "—"} min
        </p>
      ))}
      {status === "success" && workouts.map((workout) => (
        <p key={workout.id}>
          <Link to={`/workouts/${workout.id}`}>{workout.sport}</Link> · {workout.distance_km ?? "—"} km
        </p>
      ))}
      {status === "success" && total > 0 && (
        <nav aria-label="Pagination">
          <button onClick={() => goToPage(page - 1)} disabled={page <= 1}>Previous</button>
          {" "}Page {page} of {totalPages} · {total} workouts{" "}
          <button onClick={() => goToPage(page + 1)} disabled={page >= totalPages}>Next</button>
        </nav>
      )}
    </>
  )
}

export default WorkoutsPage
