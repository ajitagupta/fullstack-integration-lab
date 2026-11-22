# Frontend - Workout Tracker UI

React 19, TypeScript and Vite, with React Router, Bootstrap 5 and Recharts. For the overview, see the [main README](../README.md).

## Pages

| Route | What it does |
|---|---|
| `/` | Intro, this week's totals, and the ways to add workouts |
| `/workouts` | List with sport filter, sorting and pages; the filters are in the URL |
| `/workouts/:id` | One workout, with Edit and Delete |
| `/workouts/new` | Add a workout |
| `/workouts/:id/edit` | Edit a workout (same form) |
| `/quick-add` | Type workouts as text; **Check** shows a preview, **Save** stores them |
| `/import` | Choose a CSV, GPX or FIT file, see a preview, then import |
| `/stats` | Charts of distance and time per week |

The footer shows whether the API and the database can be reached (it asks `/ready` every 10 seconds).

## Structure

| Folder / file | Role |
|---|---|
| `src/api/client.ts` | Every API call goes through `request()`: 10-second timeout, one error type per kind of failure |
| `src/api/workout-api.ts` | One function per endpoint |
| `src/api/workout-types.ts` | Types and runtime checks for every response |
| `src/forms/` | The add/edit form and its validation |
| `src/import/` | The preview table, shared by Import and Quick add |
| `src/stats/` | The weekly chart and the function that reshapes the data for it |
| `src/sports.ts` | One colour and icon per sport |
| `src/format-date.ts` | Shows dates as "22 Nov 2026" |
| `tests/` | Playwright journeys |

## Configuration

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Address of the API, without a trailing `/` (default `http://localhost:5000`) |

`VITE_` variables end up in the JavaScript that every visitor downloads. Never put secrets there.

## Run it

With Docker, from the repo root: `docker compose up --build`, then open http://localhost:5173. Code changes reload live.

Without Docker, from `frontend/`: `npm install`, then `npm run dev`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server on port 5173 |
| `npm run build` | Type check and production build |
| `npm test` | Vitest tests (the API is faked) |
| `npx vitest run --coverage` | The same, once, with a coverage report |
| `npm run test:e2e` | Playwright journeys in a real browser; needs `docker compose up -d` |
| `npm run lint` | oxlint |

`src/api/contract.test.ts` checks the example responses in `../contracts/`, written by the backend tests.

## Deployment

Vercel, with `frontend` as the root folder and `VITE_API_URL` set to the Render address. `vercel.json` sends every path to `index.html`, and turns off Vercel's own deploys for `main`: CI deploys the frontend after the tests pass and the new API is live ([`docs/11-ci-cd.md`](../docs/11-ci-cd.md)).
