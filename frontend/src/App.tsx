import { Route, Link, Outlet, BrowserRouter, Routes } from 'react-router-dom';
import HomePage from './HomePage';
import WorkoutsPage from './WorkoutsPage';
import WorkoutDetailPage from './WorkoutDetailsPage';
import './App.css'

function Layout() {
  return (
    <div>
      <nav><Link to="/">Home</Link> | <Link to="/workouts">Workouts</Link></nav>
      <hr />
      <Outlet />
    </div>
  );
}

function App() {

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="workouts" element={<WorkoutsPage />} />
          <Route path="workouts/:id" element={<WorkoutDetailPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App
