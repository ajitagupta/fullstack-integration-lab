import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StatsPage from "./StatsPage";
import { getWeeklyStats } from "./api/workout-api";

vi.mock("./api/workout-api", () => ({ getWeeklyStats: vi.fn() }));

// jsdom has no ResizeObserver, but Recharts' ResponsiveContainer needs one
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

test("shows an error, then the charts after Try again", async () => {
  vi.mocked(getWeeklyStats)
    .mockRejectedValueOnce(new Error("boom"))
    .mockResolvedValueOnce([
      { week_start: "2026-11-16", sport: "run", workouts: 1, distance_km: 5, duration_min: 30 },
    ]);

  render(<StatsPage />);

  expect(await screen.findByRole("alert")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText("Distance per week")).toBeInTheDocument();
});

test("says so when there are no workouts", async () => {
  vi.mocked(getWeeklyStats).mockResolvedValueOnce([]);

  render(<StatsPage />);

  expect(await screen.findByText("No workouts in the last 8 weeks.")).toBeInTheDocument();
});