# 13 - Stats

Weekly totals per sport, shown as two bar charts on `/stats`.

## What was built

- A `performed_on` date column. The database fills in today if no date is sent.
- `GET /stats/weekly?weeks=8`: one row per week and sport (workouts, km, minutes), computed in SQL with `GROUP BY`. `weeks` must be 1-52.
- `toWeeklyChart()`: reshapes the API's rows (one per week **and** sport) into one object per week, which the chart needs.
- Two stacked bar charts (Recharts): distance per week and time per week, one colour per sport.

## Decisions

- The database adds up the numbers, so the API returns a few dozen totals instead of every workout.
- `coalesce(sum(...), 0)`: a week with only badminton has no distances, and `sum` would return `NULL`.
- Weeks start on Monday.
- Rest days are left out of the charts: they have no distance or time.
- The existing demo workouts were spread over the last 8 weeks by the migration.

## Lessons

- The new column must exist on Neon **before** the new code is deployed, since the code reads it in every query.
- A container that stops right away: `docker compose logs api` showed the cause, a missing `from datetime import date`.
- Recharts needs `ResizeObserver`, which jsdom doesn't have; the test adds a small stub.
- `${unit}` only works inside backticks.
- After `npm install` on the laptop, the `web` container still had its old packages: `docker compose up -d --build -V web`.
