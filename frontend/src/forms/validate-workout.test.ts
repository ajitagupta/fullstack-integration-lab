// frontend/src/forms/validate-workout.test.ts
import { describe, it, expect } from "vitest";
import { validateWorkout } from "./validate-workout";

describe("validateWorkout", () => {
  it("accepts a valid run", () => {
    const errors = validateWorkout({ sport: "run", distance: "5.2", duration: "33" });
    expect(errors).toEqual({});
  });

  // TODO: no sport chosen          → errors.sport is set
  it("requires a sport", () => {
    const errors = validateWorkout({ sport: "", distance: "5.2", duration: "33" });
    expect(errors.sport).toBeDefined();
  });  
  // TODO: run without distance      → errors.distance is set
  it("requires distance for a run", () => {
    const errors = validateWorkout({ sport: "run", distance: "", duration: "33" });
      expect(errors.distance).toBeDefined();
  });  
  // TODO: strength without distance → no distance error
  it("accepts strength without distance", () => {
    const errors = validateWorkout({ sport: "strength", distance: "", duration: "33" });
    expect(errors).toEqual({});
  });  
  // TODO: "abc" as distance          → errors.distance is set
  it("rejects a non-numeric distance", () => {
    const errors = validateWorkout({ sport: "run", distance: "abc", duration: "33" });
      expect(errors.distance).toBeDefined();
  });  
  // TODO: distance "0"               → no distance error (0 is allowed!)
  it("accepts a zero distance", () => {
    const errors = validateWorkout({ sport: "run", distance: "0", duration: "33" });
    expect(errors).toEqual({});
  });  
  // TODO: duration "33.5"            → errors.duration is set
  it("rejects a fractional duration", () => {
    const errors = validateWorkout({ sport: "run", distance: "5.2", duration: "33.5" });
    expect(errors.duration).toBeDefined();
  });  
  // TODO: rest with everything empty → valid ({})
  it("accepts rest with no distance and duration", () => {
    const errors = validateWorkout({ sport: "rest", distance: "", duration: "" });
    expect(errors).toEqual({});
  });

});