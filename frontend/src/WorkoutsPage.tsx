import { Link } from 'react-router-dom';
import './App.css'

interface Workout {
  id: number;
  sport: string;
  distance?: number;
  duration?: number;
}


function Welcome() {
  return <h2>--- Welcome to my workout tracker ---</h2>
}


function WorkoutsPage() {

  const workouts: Workout[] = [
    {id: 1,sport: "swim", distance: 0.6, duration: 23},
    {id: 2, sport: "cycle", distance: 10, duration: 20},
    {id: 3, sport: "run", distance: 5, duration: 31}
  ]
  return (
    <>
      <h1>My Workout Tracker</h1>
      <Welcome />
      {workouts.map((workout) => (
        <p key={workout.id}>
            <Link to={`/workouts/${workout.id}`}>{workout.sport}</Link>
        </p>
     ))}
    </>
  )
}

export default WorkoutsPage
