# 03 — Define the browser–API boundary

All communication between the React frontend and the Flask API goes through one typed layer in `frontend/src/api/`. Components never call `fetch` directly. The API's behaviour was aligned with an explicit contract first, so both sides are built to the same rules.

## API contract decisions
The target contract is documented in [api-contract.md](api-contract.md). Decisions:

| Decision | Before | After |
|---|---|---|
| Status for creates | `POST /workouts` returned `200`; upload and parse `201` | `201` for every create, including parse with `inserted: 0` |
| Error format | Two shapes: `{"error": "..."}` and `{"errors": ["Row 2: ..."]}` | One shape: `{"errors": [{"row"?, "field"?, "error"}]}` |
| Invalid query parameters | `?limit=abc` crashed with `500` | `400` with `field: "limit"` |
| Unknown URLs / ids | Flask's HTML `404` page | JSON `404` in the error format |
| Non-numeric CSV values | `run,abc,30` crashed with `500` | `400` with a row error |

The row number moved from the message text (`"Row 2: ..."`) into its own `row` key, so the frontend can highlight rows and fields without parsing text.

## Backend changes
- `error_response(errors, status=400)`: one helper builds every error response, so the format is defined in one place.
- `@app.errorhandler(404)`: every unknown URL returns JSON.
- `get_workouts()`: each query parameter is converted inside `try`/`except ValueError`, and only when present (`if ... is not None`).
- `to_number()` in `clean_row()`: keeps non-numeric text instead of crashing; `validate_data()` reports it ("must be a number") before the `< 0` checks.
- `validate_data()` returns `{"field", "error"}`; upload and parse add the row with `{"row": i, **error}`.

## Frontend API layer
| File | Responsibility |
|---|---|
| `client.ts` | `request()`: builds the URL from `VITE_API_URL`, calls `fetch`, turns failed responses into `ApiError` |
| `api-error.ts` | `ApiError` (server answered with an error: status + `errors` list) and `InvalidResponseError` (server sent data of the wrong shape) |
| `workout-types.ts` | Types (`Sport`, `Workout`, `WorkoutListResponse`, `NewWorkout`) and runtime checks (`parseWorkout`, `parseWorkoutList`) |
| `workout-api.ts` | What components call: `getWorkouts()`, `getWorkout(id)`, `createWorkout(workout)` |

```
Component ── getWorkouts() ──▶ workout-api.ts ── request() ──▶ client.ts ── fetch ──▶ Flask API
                                                                   │
                                          error status ──▶ ApiError
                                                                   │
                                     unknown JSON ◀────────────────┘
                                          │
                               parseWorkoutList() ── wrong shape ──▶ InvalidResponseError
                                          │
Component ◀── checked WorkoutListResponse ┘
```

## Key concepts
- **Types disappear at runtime.** TypeScript checks code, not data. A response is `unknown` until a runtime check (`typeof`, `Array.isArray`, the `SPORTS` array) has confirmed its shape.
- **`fetch` does not throw on `400`/`404`.** `client.ts` checks `response.ok` and throws `ApiError` itself.
- **`unknown` instead of `any`:** `response.json()` returns `any`, which switches type checking off. `request()` returns `unknown`, so nothing can use the data before it has been checked.
- **`as` only after a check:** `value.sport as Sport` is used only once the value has been verified against `SPORTS`.
- **`null` vs. optional:** the API returns `"distance_km": null` (`number | null`); when sending, the field may be left out (`distance_km?: number`).
- **Literal types vs. values:** `sport: "run"` in a type means *only* `"run"` is allowed; types describe ranges of values, examples belong in tests.

## Tests
18 backend tests pass. `test_baseline.py` was updated deliberately for the new contract (`201`, new error format); `test_contract.py` adds four tests: invalid `limit` → `400`, `/workouts/abc` → JSON `404`, unknown id → `404`, non-numeric CSV value → row error.

## Lessons learned
- `float(None)` raises `TypeError`, not `ValueError`: convert only when a value is present, and catch only the error that means "bad input".
- Changing the `except` type instead of the condition just moved the bug: every list request returned `400`.
- `npx tsc` outside `frontend/` downloaded an unrelated package called `tsc`. Run frontend tools from `frontend/`; in a Vite project, use `npx tsc -b`.

## Open
- **Session 3:** timeouts and cancellation (`AbortController`); network failures vs. HTTP errors.
- **Session 4:** connection-status check; CORS or Vite proxy; components switched to the API layer; test for a malformed response.