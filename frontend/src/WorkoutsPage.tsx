import { Link } from 'react-router-dom';
import { getWorkouts } from './api/workout-api';
import type { Workout } from './api/workout-types';
import { useEffect, useState } from 'react';
import './App.css'
import { errorMessage } from './api/error-message';
import { RequestCancelledError } from './api/api-error';

function Welcome() {
  return <h2>--- Welcome to my workout tracker ---</h2>
}


function WorkoutsPage() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  function load(signal?: AbortSignal) {
    setStatus("loading");                       // a new attempt starts
    getWorkouts(signal)
      .then((page) => {
        setWorkouts(page.workouts);
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
  }, []);

  return (
    <>
      <h1>My Workout Tracker</h1>
      <Welcome />
      {status === "loading" && <p role="status">Loading workouts…</p>}
      {status === "error" && (
        <div role="alert">
          <p>{error}</p>
          <button onClick={() => load()}>Try again</button>
        </div>
      )}
      {status === "success" && workouts.length === 0 && (
        <p>No workouts yet - add your first one.</p>
      )}
      {status === "success" && workouts.map((workout) => (
        <p key={workout.id}>
          <Link to={`/workouts/${workout.id}`}>{workout.sport}</Link>
        </p>
      ))}
    </>
  )
}

export default WorkoutsPage
