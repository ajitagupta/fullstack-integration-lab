import { Link } from 'react-router-dom';
import { getWorkouts } from './api/workout-api';
import type { Workout } from './api/workout-types';
import { useEffect, useState } from 'react';
import './App.css'
import { errorMessage } from './api/error-message';

function Welcome() {
  return <h2>--- Welcome to my workout tracker ---</h2>
}


function WorkoutsPage() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [error, setError] = useState<string | null>(null);


  useEffect(() => {
    getWorkouts()
      .then((page) => setWorkouts(page.workouts))                      // page is a WorkoutListResponse
      .catch((err) => setError(errorMessage(err)));
  }, []);

  return (
    <>
      <h1>My Workout Tracker</h1>
      <Welcome />
      {error && <p role="alert">{error}</p>}
      {workouts.map((workout) => (
        <p key={workout.id}>
            <Link to={`/workouts/${workout.id}`}>{workout.sport}</Link>
        </p>
     ))}
    </>
  )
}

export default WorkoutsPage
