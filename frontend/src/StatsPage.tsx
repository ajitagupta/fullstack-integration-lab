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
      <h1>Stats</h1>
      <p>The last {WEEKS} weeks, per sport.</p>

      {status === "loading" && <p role="status">Loading stats…</p>}

      {status === "error" && (
        <div role="alert">
          <p>{error}</p>
          <button onClick={() => setReloadKey((k) => k + 1)}>Try again</button>
        </div>
      )}

      {status === "success" && stats.length === 0 && (
        <p role="status">No workouts in the last {WEEKS} weeks.</p>
      )}

      {status === "success" && stats.length > 0 && (
        <>
          <h2>Distance per week</h2>
          <WeeklyChart data={toWeeklyChart(stats, "distance_km")} unit="km" />
          <h2>Time per week</h2>
          <WeeklyChart data={toWeeklyChart(stats, "duration_min")} unit="min" />
        </>
      )}
    </>
  );
}

export default StatsPage;