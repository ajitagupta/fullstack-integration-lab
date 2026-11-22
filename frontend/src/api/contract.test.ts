// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseUploadPreview, parseWeeklyStats, parseWorkout, parseWorkoutList } from "./workout-types";
import { toImportResult } from "./workout-api";

// The files written by backend/test_contract_examples.py, in the repo root
const CONTRACTS = resolve(process.cwd(), "..", "contracts");
const example = (name: string): unknown => JSON.parse(readFileSync(resolve(CONTRACTS, name), "utf-8"));

test("a single workout", () => {
  expect(() => parseWorkout(example("workout.json"))).not.toThrow();
});

test("the workout list", () => {
  expect(parseWorkoutList(example("workout-list.json")).workouts.length).toBeGreaterThan(0);
});

test("the weekly stats", () => {
  expect(() => parseWeeklyStats(example("weekly-stats.json"))).not.toThrow();
});

test("an upload preview with one bad row", () => {
  const preview = parseUploadPreview(example("upload-preview.json"));
  expect(preview.invalid).toBe(1);
});

test("an import result", () => {
  expect(toImportResult(example("import-result.json"))).toEqual({ inserted: 1, skipped: 0 });
});

test("the error format", () => {
  const body = example("error.json") as { errors: { field?: string; error: string }[] };
  expect(body.errors[0]).toEqual({ field: expect.any(String), error: expect.any(String) });
});