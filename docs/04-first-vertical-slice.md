# 04 — First vertical slice

The workout pages handle every state a user can meet and cancel outdated requests. The whole slice is deployed early, so production problems surface now.

## Live
| Part | Service | Address / notes |
|---|---|---|
| Frontend | Vercel (Vite) | https://workout-tracker-ajita.vercel.app · root `frontend` · `VITE_API_URL` = Render address (no trailing `/`) · `vercel.json` rewrites all paths to `index.html` |
| API | Render (Docker, free, Frankfurt) | https://workouts-tracker-7b09.onrender.com · env: `DATABASE_URL`, `CORS_ORIGINS`, `PORT=5000` |
| Database | Neon (free, Frankfurt) | Direct (non-pooled) connection; free tier doesn't expire |

`CORS_ORIGINS=https://workout-tracker-ajita.vercel.app,http://localhost:5173`

Schema and demo data on Neon, from the laptop:
```powershell
$env:DATABASE_URL = "postgresql+psycopg://...neon.tech/...?sslmode=require"
alembic upgrade head
python seed.py
Remove-Item Env:DATABASE_URL
```

## Page states
One `status` (`"loading" | "success" | "error"`) instead of separate flags; "empty" is `success` with no workouts.

| State | Shown | Role |
|---|---|---|
| Loading | "Loading workouts…" | `status` |
| Error | Message + **Try again** (`onClick={() => load()}`) | `alert` |
| Empty | "No workouts yet — add your first one." | — |
| Data | The list | — |

`ConnectionStatus` re-checks every 10 s (`setInterval`, cleared in the effect's cleanup).

## Cancelling outdated requests
Each page effect creates an `AbortController`, passes its signal to `getWorkouts` / `getWorkout`, and aborts in the cleanup — no answer can update a page that has moved on. `client.ts` tells the two abort reasons apart (caller first):

| Reason | Error | User sees |
|---|---|---|
| Page left / id changed | `RequestCancelledError` | Nothing |
| No answer within 10 s | `NetworkError` | "Server is taking too long to respond." |

Visible in development: React's StrictMode mounts twice, so the Network tab shows a cancelled `workouts` request followed by a `200`.

## Lessons learned
**React**
- `.then(setX(value))` calls the setter immediately; `.then()` needs a function: `.then((v) => setX(v))`. Ask: who calls it, and with what?

**Configuration**
- Remote database URLs live only in Neon and Render — never in a file in the repo folder. Check `echo $env:DATABASE_URL` before running anything against a remote database; no "Running upgrade" line from Alembic means it hit an already-migrated (wrong) database.
- Every address appears in configuration somewhere: renaming the Vercel domain meant updating `CORS_ORIGINS`, the README and the docs.

**Deployment**
- Vercel installs only what `package.json` declares: test libraries installed locally but never recorded broke the first build. Tests are now also excluded from the app's type check (`tsconfig.app.json`).
- `VITE_` variables are baked in at build time — changing one needs a redeploy, and they are public.
- "Not connected" after deploying: the new origin wasn't in `CORS_ORIGINS` — fixed in Render's settings, no code change.
- Direct loads of `/workouts` returned 404 until `vercel.json` rewrote all paths to `index.html` (Vite's dev server does this automatically).
- `DEPLOYMENT_NOT_FOUND` = unknown domain; `NOT_FOUND` = unknown path.
- `PORT=500` instead of `5000`: Render waited 10 minutes, then failed. The app's own log showed the real port.

**Debugging**
- A Playwright test timing out on a missing link: check `docker compose ps` first; `test-results/.../error-context.md` shows what the page displayed.
- `ERR_CONNECTION_REFUSED` in the Console is logged by the browser even when the app handles the failure.

## Open
- **Session 5:** trace one request through browser, Render logs and database; verify the error state in production; decide on Render's cold start vs. the 10 s timeout.