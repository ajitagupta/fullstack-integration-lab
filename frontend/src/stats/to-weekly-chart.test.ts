import { toWeeklyChart } from "./to-weekly-chart";
import type { WeeklyStat } from "../api/workout-types";

const stats: WeeklyStat[] = [
  { week_start: "2026-11-09", sport: "run",  workouts: 2, distance_km: 15,  duration_min: 90 },
  { week_start: "2026-11-09", sport: "swim", workouts: 1, distance_km: 1.5, duration_min: 40 },
  { week_start: "2026-11-16", sport: "run",  workouts: 1, distance_km: 8,   duration_min: 45 },
];

test("one row per week, one key per sport", () => {
  expect(toWeeklyChart(stats, "distance_km")).toEqual([
    { week: "2026-11-09", run: 15, swim: 1.5 },
    { week: "2026-11-16", run: 8 },
  ]);
});

test("uses the chosen metric", () => {
  expect(toWeeklyChart(stats, "duration_min")[0]).toEqual({ week: "2026-11-09", run: 90, swim: 40 });
});

test("no stats, no rows", () => {
  expect(toWeeklyChart([], "distance_km")).toEqual([]);
});