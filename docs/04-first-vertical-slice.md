# 04 - First deployment

The list and details pages show every state and cancel outdated requests. The app was deployed early, to meet deployment problems while the app was still small.

## Live

| Part | Service | Notes |
|---|---|---|
| Frontend | Vercel | https://workout-tracker-ajita.vercel.app · `VITE_API_URL` = the Render address |
| API | Render (Docker, free tier) | https://workouts-tracker-7b09.onrender.com · needs `DATABASE_URL`, `CORS_ORIGINS`, `PORT=5000` |
| Database | Neon (free tier) | |

Migrations and demo data are applied from the laptop:

```powershell
$env:DATABASE_URL = "<Neon connection string>"
alembic upgrade head
python seed.py      # only for demo data: it deletes all workouts
Remove-Item Env:DATABASE_URL
```

## What was built

- One `status` per page (`loading`, `success`, `error`); "empty" is a success with no workouts.
- Every page effect gets an `AbortController` and aborts in its cleanup, so an old answer can't update a page that has moved on.
- `client.ts` tells a cancelled request apart from a timeout.

## Lessons

- `VITE_` variables are built into the bundle: changing one needs a redeploy, and they are public.
- Vercel installs only what `package.json` lists. Test packages installed but never saved broke the first build.
- A direct visit to `/workouts` returned 404 until `vercel.json` sent all paths to `index.html`.
- A new frontend address must be added to `CORS_ORIGINS`.
- `PORT=500` instead of `5000` made Render wait 10 minutes and fail.
- Connection strings live only in Neon, Render and the terminal, never in a file in the repo.
- **Production bug:** after a few idle minutes, the first request failed with a `500`. Neon closes idle connections, and the pool handed out a dead one. `pool_pre_ping=True` checks a connection before using it.
- **Cold start:** Render's free tier sleeps after 15 minutes and needs about 25 seconds to wake up. The client gives up after 10, so the first visit shows an error, and "Try again" works. Accepted and noted in the README.
