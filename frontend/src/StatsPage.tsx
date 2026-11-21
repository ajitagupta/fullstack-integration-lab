import { useEffect, useState } from "react";
import { getWeeklyStats } from "./api/workout-api";
import type { WeeklyStat } from "./api/workout-types";
import { RequestCancelledError } from "./api/api-error";
import { errorMessage } from "./api/error-message";
import { toWeeklyChart } from "./stats/to-weekly-chart";
import { WeeklyChart } from "./stats/WeeklyChart";

const WEEKS = 8;

function StatsPage() {
  const [stats, setStats] = useState<WeeklyStat[]>([]);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");

    getWeeklyStats(WEEKS, controller.signal)
      .then((result) => {
        setStats(result);
        setStatus("success");
      })
      .catch((err) => {
        if (err instanceof RequestCancelledError) return;
        setError(errorMessage(err));
        setStatus("error");
      });

    return () => controller.abort();
  }, [reloadKey]);

    return (
    <>
      <h1 className="page-title mb-1">Stats</h1>
      <p className="text-muted mb-4">The last {WEEKS} weeks, per sport.</p>

      {status === "loading" && (
        <div role="status" className="text-muted">
          <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />Loading stats…
        </div>
      )}

      {status === "error" && (
        <div role="alert" className="alert alert-danger d-flex justify-content-between align-items-center">
          <span>{error}</span>
          <button className="btn btn-outline-danger btn-sm" onClick={() => setReloadKey((k) => k + 1)}>Try again</button>
        </div>
      )}

      {status === "success" && stats.length === 0 && (
        <p role="status" className="text-muted">No workouts in the last {WEEKS} weeks.</p>
      )}

      {status === "success" && stats.length > 0 && (
        <div className="row g-4">
          <div className="col-lg-6">
            <div className="card shadow-sm h-100">
              <div className="card-body">
                <h2 className="h5 mb-3">Distance per week</h2>
                <WeeklyChart data={toWeeklyChart(stats, "distance_km")} unit="km" />
              </div>
            </div>
          </div>
          <div className="col-lg-6">
            <div className="card shadow-sm h-100">
              <div className="card-body">
                <h2 className="h5 mb-3">Time per week</h2>
                <WeeklyChart data={toWeeklyChart(stats, "duration_min")} unit="min" />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default StatsPage;