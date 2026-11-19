# Frontend — Workout Tracker UI

The browser app of the workout tracker: **React 19**, **TypeScript** and **Vite**, with **React Router**. It lists, filters, adds, edits and deletes workouts through the [backend API](../backend/README.md).

For the project overview, see the [main README](../README.md). Design decisions per milestone are in [`docs/`](../docs).

## Pages

| Route | Component | What it does |
|---|---|---|
| `/` | `HomePage` | Start page |
| `/workouts` | `WorkoutsPage` | List with sport filter, sort order and pagination; the state lives in the URL (`?sport=swim&sort=-distance_km&page=2`) |
| `/workouts/:id` | `WorkoutDetailsPage` | One workout, with Edit and Delete (inline confirmation) |
| `/workouts/new` | `forms/WorkoutForm` | Add a workout |
| `/workouts/:id/edit` | `EditWorkoutPage` | Loads the workout, then shows the same form in edit mode |
| `/stats` | `StatsPage` | Stacked bar charts of distance and time per week and sport (Recharts) |
| `/import` | `ImportPage` | Upload a CSV file of workouts; shows the number imported, or the errors per row |

Every page shares a layout (`App.tsx`) with the navigation and `ConnectionStatus`, which checks the API every 10 seconds.

## Structure

| Folder / file | Role |
|---|---|
| `src/api/client.ts` | `request()`: every call to the API goes through here. Builds the URL from `VITE_API_URL`, applies a timeout, and turns each failure into a named error |
| `src/api/api-error.ts` | `ApiError` (the API answered with an error), `NetworkError` (no answer), `RequestCancelledError` (aborted on purpose) |
| `src/api/workout-api.ts` | One function per endpoint (`getWorkouts`, `createWorkout`, `uploadWorkouts`, `getWeeklyStats`, …); `PAGE_SIZE` |
| `src/api/workout-types.ts` | The `Workout` type and a runtime check of every response, since TypeScript types disappear at runtime |
| `src/api/error-message.ts` | Turns any error into a message for the user |
| `src/forms/` | The add/edit form and its validation, which mirrors the server's rules |
| `src/stats/` | The weekly chart and `toWeeklyChart`, which reshapes the API's rows for it |
| `tests/` | Playwright end-to-end tests |

## How the pages behave

- **Every state is shown:** loading, error with **Try again**, empty, and data. An empty list distinguishes "no workouts yet", "no matches for this filter" and "page out of range".
- **Outdated requests are cancelled.** Each list or detail load runs in an effect with its own `AbortController`; changing a filter aborts the previous request, so an old answer can't overwrite a newer one.
- **The server stays the authority.** The form validates in the browser for quick feedback, and maps the server's field errors back to the right input. If a save can't be confirmed (no answer), it says so instead of claiming failure.
- **Imports are all or nothing.** The import page checks file type and size before uploading, lists the server's errors per row, and says "couldn't confirm" when the answer is lost, so a second upload doesn't create duplicates.
- **Accessible forms:** labels, `aria-invalid`, `aria-describedby`, `role="alert"` for errors, `role="status"` for updates.

## Configuration

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Address of the API, without a trailing `/`. Default: `http://localhost:5000` |

Anything prefixed with `VITE_` is built into the JavaScript bundle and visible to every visitor. Never put secrets there.

## Run it

**With Docker** (recommended), from the repo root:
```powershell
docker compose up --build
```
Open http://localhost:5173. The `frontend` folder is mounted into the container, so code changes reload live without a rebuild.

**Without Docker**, from `frontend/`:
```powershell
npm install
npm run dev
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server on port 5173 |
| `npm run build` | Type check (`tsc -b`) and production build. Unused variables fail the build, as they do on Vercel |
| `npm test` | Unit and component tests (Vitest + Testing Library); the API is faked with `vi.mock` |
| `npm run test:e2e` | End-to-end tests in a real browser (Playwright); needs the app and the API running |
| `npm run lint` | Linting (oxlint) |

Test files use their own TypeScript settings (`tsconfig.test.json`) so Vitest's globals are known.

## Deployment

Deployed on **Vercel** with `frontend` as the root folder and `VITE_API_URL` set to the Render address. `vercel.json` sends every path to `index.html`, so a reload on `/workouts/5` still works. The API must list the Vercel address in its `CORS_ORIGINS`.