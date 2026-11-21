import { Route, NavLink, Outlet, BrowserRouter, Routes } from 'react-router-dom';
import HomePage from './HomePage';
import WorkoutsPage from './WorkoutsPage';
import WorkoutDetailPage from './WorkoutDetailsPage';
import { WorkoutForm } from "./forms/WorkoutForm";
import { EditWorkoutPage } from "./EditWorkoutPage";
import ConnectionStatus from './ConnectionStatus';
import StatsPage from "./StatsPage";
import ImportPage from './ImportPage';
import QuickAddPage from './QuickAddPage';
import { useState } from 'react';

function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const links = [
    { to: "/workouts", label: "Workouts" },
    { to: "/quick-add", label: "Quick add" },
    { to: "/workouts/new", label: "Add workout" },
    { to: "/import", label: "Import" },
    { to: "/stats", label: "Stats" },
  ];

  return (
    <>
      <nav className="navbar navbar-expand-md navbar-dark bg-primary mb-4">
        <div className="container">
          <NavLink className="navbar-brand d-flex align-items-center gap-2" to="/">
            <img src="/favicon.svg" alt="" width="28" height="28" className="rounded-2 border border-white" />
            Workout Tracker
          </NavLink>
          <button
            className="navbar-toggler"
            type="button"
            aria-controls="main-nav"
            aria-expanded={menuOpen}
            aria-label="Toggle navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="navbar-toggler-icon" />
          </button>
          <div id="main-nav" className={`collapse navbar-collapse ${menuOpen ? "show" : ""}`}>
            <ul className="navbar-nav ms-auto">
              {links.map((link) => (
                <li className="nav-item" key={link.to}>
                  <NavLink className="nav-link" to={link.to} end onClick={() => setMenuOpen(false)}>
                    {link.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </nav>

      <main className="container pb-5">
        <Outlet />
      </main>

      <footer className="container py-3 border-top small text-muted d-flex justify-content-between">
        <span>Workout Tracker · React + Flask</span>
        <ConnectionStatus />
      </footer>
    </>
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
          <Route path="workouts/new" element={<WorkoutForm />} />
          <Route path="workouts/:id/edit" element={<EditWorkoutPage />} />
          <Route path="stats" element={<StatsPage />} />
          <Route path="import" element={<ImportPage />} />
          <Route path="quick-add" element={<QuickAddPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App
