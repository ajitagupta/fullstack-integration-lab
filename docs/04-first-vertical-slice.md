# 04 — First vertical slice

The workout list and detail pages handle every situation a user can meet — loading, error, empty, data — and cancel requests that are no longer needed. Next, the whole slice (frontend, API, database) is deployed early, so production problems surface now rather than at the end of the lab.

## List states
The workouts page has one `status` instead of separate flags, so impossible combinations (loading *and* error) cannot occur:
```ts
const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
```
"Empty" is not a separate status — it is `success` with zero workouts.

| Situation | Condition | Shown | Role |
|---|---|---|---|
| Loading | `status === "loading"` | "Loading workouts…" | `status` |
| Error | `status === "error"` | Error message + **Try again** button | `alert` |
| Empty | `status === "success" && workouts.length === 0` | "No workouts yet — add your first one." | — |
| Data | `status === "success"` | The list (`.map` of an empty list renders nothing) | — |

`load()` contains the request logic once; the initial effect and the **Try again** button both call it. The button uses `onClick={() => load()}` — passing `load` directly would hand React's click event to `load` as its `signal` parameter.

## Connection status
`ConnectionStatus` re-checks every 10 seconds with `setInterval` and stops the timer in the effect's cleanup (`clearInterval`), so it reflects an API that goes down or comes back without a page reload.

## Cancelling outdated requests
**Problem:** leaving a page (or switching from workout 3 to workout 4) while a request is running lets its answer arrive later and update a page that has moved on — on the detail page this can show the wrong workout (a race condition).

**Solution:**
- Each page effect creates an `AbortController`, passes `controller.signal` down (`getWorkouts(signal)`, `getWorkout(id, signal)`) and returns `() => controller.abort()` as cleanup.
- `client.ts` forwards the caller's signal to its own controller and distinguishes the two reasons for an abort — the caller's check comes first, because forwarding also aborts the internal controller:

| Reason | Error | Shown to the user |
|---|---|---|
| Caller cancelled (page left, id changed) | `RequestCancelledError` | Nothing — ignored in `.catch` |
| No answer within 10 s | `NetworkError("Server is taking too long to respond.")` | The message |

- The detail page resets `workout` and `error` at the start of each effect, so old content disappears immediately when the id changes, and shows "Loading workout…" until the answer arrives.

**Observed:** in development, React's `StrictMode` mounts each component twice. The Network tab shows two `workouts` requests — the first **cancelled** (no status, 0 B) by the cleanup, the second `200`. No error is shown to the user.

## Accessibility
Status messages use ARIA roles so screen readers announce them: `role="status"` (polite) for loading and the connection status, `role="alert"` (immediate) for errors.

## Tests
- Vitest: 3 tests (unchanged).
- Playwright: 2 tests pass against the running stack.

## Lessons learned
- `.then(setConnected(connected))` calls the setter immediately; `.then()` needs a function to call later: `.then((ok) => setConnected(ok))`. When passing a function, ask: who calls it, and with what?
- The Network tab only records while open; clicking a link to the page you are already on does not remount it.
- `ERR_CONNECTION_REFUSED` lines in the Console come from the browser itself for every failed request, even when the app handles the error.
- A Playwright test that times out waiting for a link: check `docker compose ps` first — the API had stopped. The page snapshot in `test-results/.../error-context.md` showed "Can't reach the server."
- A remote database URL belongs only in Neon itself and in Render's settings, never in a file in the repo folder, not even an ignored `.env`. With it in `backend/.env`, every local command (including `seed.py`, which empties the table) would have hit production.
- Alembic printing no "Running upgrade" line means "already up to date" — a sign it ran against the wrong (already migrated) database. Check with `echo $env:DATABASE_URL` before running against a remote database.
- `PORT=500` instead of `5000`: Render waited 10 minutes for the wrong port, then failed the deploy. The app's own log ("Running on ...:5000") showed the real port.
- The root URL returns the JSON `404` from the contract — not an error, the API has no route at `/`.


## Deployment: database and API
| Part | Service | Region | Notes |
|---|---|---|---|
| PostgreSQL | Neon (free) | AWS Frankfurt | Direct (non-pooled) connection string; free tier does not expire, unlike Render's free PostgreSQL (30 days) |
| Flask API | Render web service (free, Docker) | Frankfurt | Built from `backend/Dockerfile`; same image as locally |

**Render environment:** `DATABASE_URL` (Neon, scheme changed to `postgresql+psycopg://`), `CORS_ORIGINS` (`http://localhost:5173` for now), `PORT=5000` (the port Flask listens on).

**Schema and data on Neon:** created from the laptop with the same migration and seed:
```powershell
$env:DATABASE_URL = "postgresql+psycopg://...neon.tech/...?sslmode=require"
alembic upgrade head
python seed.py
Remove-Item Env:DATABASE_URL
```

## Open
- **Session 4:** frontend on Vercel with HTTPS and `VITE_API_URL` pointing to Render.
- **Session 5:** trace one request through browser, Render logs and database; verify "API unavailable" in production; decide how to handle Render's cold start vs. the 10 s timeout.