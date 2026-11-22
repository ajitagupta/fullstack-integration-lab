# 03 - Browser and API

The frontend talks to the API through one small layer in `frontend/src/api/`. Components never call `fetch` directly. First, the API was made consistent.

## API changes

| Before | After |
|---|---|
| `POST /workouts` returned `200` | `201` for every create |
| Two error formats | One: `{"errors": [{"row"?, "field"?, "error"}]}` |
| `?limit=abc` caused a `500` | `400` with `field: "limit"` |
| Unknown URLs returned Flask's HTML page | JSON `404` |
| `run,abc,30` in a CSV caused a `500` | `400` with a row error |

## The API layer

| File | Role |
|---|---|
| `client.ts` | `request()`: calls `fetch` with a 10-second timeout and turns every failure into a named error |
| `api-error.ts` | `ApiError` (the API answered with an error), `NetworkError` (no answer), `InvalidResponseError` (unexpected data) |
| `workout-types.ts` | Types and runtime checks such as `parseWorkout` |
| `workout-api.ts` | One function per endpoint, e.g. `getWorkouts()` |

## Lessons

- TypeScript types don't exist at runtime. A response is `unknown` until a check like `parseWorkout` has confirmed its shape.
- `fetch` doesn't throw on `400` or `500`; `client.ts` checks `response.ok` itself.
- The browser blocks answers from another origin unless the API allows it (CORS). `flask-cors` reads the allowed origins from `CORS_ORIGINS`.
- `float(None)` raises `TypeError`, not `ValueError`: convert a parameter only when it's present.
- Always run `docker compose` from the repo root. Running it from `backend/` used a different `.env` and broke the database password.
- Vitest only ran `*.test.tsx` at first, so a new `.test.ts` file was silently skipped. Check the number of tests, not only "passed".
