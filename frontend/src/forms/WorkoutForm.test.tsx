import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { WorkoutForm } from "./WorkoutForm";
import { createWorkout, updateWorkout } from "../api/workout-api";
import { NetworkError } from "../api/api-error";

// Replace the real API call with a fake we control
vi.mock("../api/workout-api", () => ({ createWorkout: vi.fn(), updateWorkout: vi.fn() }));

afterEach(() => {
  cleanup();             // remove the rendered form after each test
  vi.clearAllMocks();    // forget what the fake did
});

function renderForm() {
  // MemoryRouter: the form contains a <Link>, which needs a router
  render(<MemoryRouter><WorkoutForm /></MemoryRouter>);
}

async function fillValidRun(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText("Sport"), "run");
  await user.type(screen.getByLabelText("Distance (km)"), "5");
  await user.type(screen.getByLabelText("Duration (min)"), "30");
}

describe("WorkoutForm", () => {
  it("says the save is unconfirmed when no answer arrives", async () => {
    vi.mocked(createWorkout).mockRejectedValue(new NetworkError("Server is taking too long to respond."));
    const user = userEvent.setup();
    renderForm();

    await fillValidRun(user);
    await user.click(screen.getByRole("button", { name: "Add workout" }));

    expect(await screen.findByText(/couldn't confirm the save/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Distance (km)")).toHaveValue(5);   // input kept
  });

  it("resets the form after a successful save", async () => {
    vi.mocked(createWorkout).mockResolvedValue({ id: 99, sport: "run", distance_km: 5, duration_min: 30 });
    const user = userEvent.setup();
    renderForm();

    await fillValidRun(user);
    await user.click(screen.getByRole("button", { name: "Add workout" }));

    expect(await screen.findByText("Workout #99 saved.")).toBeInTheDocument();
    expect(screen.getByLabelText("Distance (km)")).toHaveValue(null);   // input reset
  });

});

it("edits an existing workout with PUT", async () => {
  vi.mocked(updateWorkout).mockResolvedValue({ id: 7, sport: "run", distance_km: 5, duration_min: 45 });
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <WorkoutForm workoutId={7} initialValues={{ sport: "run", distance: "5", duration: "30" }} />
    </MemoryRouter>
  );

  // the form starts filled in, in edit mode
  expect(screen.getByLabelText("Duration (min)")).toHaveValue(30);

  const duration = screen.getByLabelText("Duration (min)");
  await user.clear(duration);
  await user.type(duration, "45");
  await user.click(screen.getByRole("button", { name: "Save changes" }));

  expect(updateWorkout).toHaveBeenCalledWith(7, { sport: "run", distance_km: 5, duration_min: 45 });
  expect(createWorkout).not.toHaveBeenCalled();
});