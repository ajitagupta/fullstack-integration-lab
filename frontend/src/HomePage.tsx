import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getWeeklyStats } from "./api/workout-api";
import type { WeeklyStat } from "./api/workout-types";

const WAYS_TO_ADD = [
  { icon: "⚡", title: "Quick add", text: "Type \"ran 5 km in 30 min\". One line per workout.", to: "/quick-add" },
  { icon: "⌚", title: "Import files", text: "GPX and FIT from Garmin, Strava's export, or your own CSV.", to: "/import" },
  { icon: "📝", title: "Use the form", text: "Sport, distance, duration, one field at a time.", to: "/workouts/new" },
];

function HomePage() {
  const [thisWeek, setThisWeek] = useState<WeeklyStat[] | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getWeeklyStats(1, controller.signal)
      .then(setThisWeek)
      .catch(() => {});                    // the home page works without stats (e.g. while the API wakes up)
    return () => controller.abort();
  }, []);

  const workouts = thisWeek?.reduce((sum, s) => sum + s.workouts, 0) ?? 0;
  const km = thisWeek?.reduce((sum, s) => sum + s.distance_km, 0) ?? 0;
  const minutes = thisWeek?.reduce((sum, s) => sum + s.duration_min, 0) ?? 0;

  return (
    <>
      <section className="p-4 p-md-5 mb-4 rounded-4 bg-white border">
        <h1 className="page-title display-5">Every workout, in one place.</h1>
        <p className="lead text-muted mb-4">
          Log runs, rides, swims and more, typed in a sentence or imported from your watch, and see your progress week by week.
        </p>
        <div className="d-flex flex-wrap gap-2">
          <Link className="btn btn-primary btn-lg" to="/quick-add">Add a workout</Link>
          <Link className="btn btn-outline-primary btn-lg" to="/stats">See your progress</Link>
        </div>
      </section>

      {thisWeek !== null && (
        <section className="mb-4" aria-label="This week">
          <h2 className="h5 text-muted mb-3">This week</h2>
          <div className="row g-3">
            <StatCard value={workouts} label={workouts === 1 ? "workout" : "workouts"} />
            <StatCard value={Math.round(km * 10) / 10} label="km" />
            <StatCard value={minutes} label="minutes" />
          </div>
        </section>
      )}

      <section aria-label="Ways to add workouts">
        <h2 className="h5 text-muted mb-3">Three ways to add workouts</h2>
        <div className="row g-3">
          {WAYS_TO_ADD.map((way) => (
            <div className="col-md-4" key={way.to}>
              <Link to={way.to} className="card h-100 text-decoration-none shadow-sm">
                <div className="card-body">
                  <div className="fs-2 mb-2" aria-hidden="true">{way.icon}</div>
                  <h3 className="h5 card-title text-body">{way.title}</h3>
                  <p className="card-text text-muted">{way.text}</p>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div className="col-4">
      <div className="card text-center shadow-sm">
        <div className="card-body py-3">
          <div className="fs-2 fw-bold text-primary">{value}</div>
          <div className="text-muted small">{label}</div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;