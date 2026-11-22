// frontend/src/forms/validate-workout.test.ts
import { describe, it, expect } from "vitest";
import { validateWorkout } from "./validate-workout";

describe("validateWorkout", () => {
  it("accepts a valid run", () => {
    const errors = validateWorkout({
      sport: "run",
      distance: "5.2",
      duration: "33",
    });
    expect(errors).toEqual({});
  });

  it("requires a sport", () => {
    const errors = validateWorkout({
      sport: "",
      distance: "5.2",
      duration: "33",
    });
    expect(errors.sport).toBeDefined();
  });
  it("requires distance for a run", () => {
    const errors = validateWorkout({
      sport: "run",
      distance: "",
      duration: "33",
    });
    expect(errors.distance).toBeDefined();
  });
  it("accepts strength without distance", () => {
    const errors = validateWorkout({
      sport: "strength",
      distance: "",
      duration: "33",
    });
    expect(errors).toEqual({});
  });
  it("rejects a non-numeric distance", () => {
    const errors = validateWorkout({
      sport: "run",
      distance: "abc",
      duration: "33",
    });
    expect(errors.distance).toBeDefined();
  });
  it("accepts a zero distance", () => {
    const errors = validateWorkout({
      sport: "run",
      distance: "0",
      duration: "33",
    });
    expect(errors).toEqual({});
  });
  it("rejects a fractional duration", () => {
    const errors = validateWorkout({
      sport: "run",
      distance: "5.2",
      duration: "33.5",
    });
    expect(errors.duration).toBeDefined();
  });
  it("accepts rest with no distance and duration", () => {
    const errors = validateWorkout({
      sport: "rest",
      distance: "",
      duration: "",
    });
    expect(errors).toEqual({});
  });
});
