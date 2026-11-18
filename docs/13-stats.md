# 13 — Stats & charts

**Why it matters:** a list answers "what did I do?". Stats answer "am I doing more or less than last month?", and that question needs totals, not rows.

**Key question:** *Who should add up 500 workouts: the browser, the API, or the database?*

| | |
|---|---|
| Status | Done (2 sessions) |
| Endpoint | `GET /stats/weekly?weeks=8` |
| Page | `/stats` |

---

## Session 1: Weekly totals in SQL

### A date for every workout

Weekly totals need a date, and workouts didn't have one. New column `performed_on` (`DATE`, not null):

- **`server_default=func.current_date()`:** when a request doesn't send a date, the database fills in today. POST, PUT, CSV upload and text parsing keep working unchanged.
- **Named `performed_on`, not `date`:** with Python 3.14's deferred annotations, a field called `date` would clash with the `date` type in its own `Mapped[date]` annotation.
- **Existing rows:** the migration spreads the demo workouts over the last 8 weeks (`CURRENT_DATE - (id % 56)`), so the stats show more than one week.
- **Deploy order:** the model reads `performed_on` in every query, so the column must exist on Neon **before** the new code is deployed. Adding a column with a default is harmless for the old code, so migrating first is safe.

### The endpoint

`GET /stats/weekly?weeks=8` returns one row per week and sport:

```json
{
  "weeks": 8,
  "stats": [
    { "week_start": "2026-11-16", "sport": "run", "workouts": 2, "distance_km": 15.0, "duration_min": 90 }
  ]
}
```

| Parameter | Allowed | Default | Invalid → |
|---|---|---|---|
| `weeks` | 1–52 | 8 | `400`, field `weeks` |

The window starts on the Monday `weeks − 1` weeks before the current week, so `weeks=1` means "this week so far".

### Decisions

- **The database adds up.** `GROUP BY date_trunc('week', performed_on), sport` with `count`, `sum` and `coalesce`: PostgreSQL returns a few dozen totals instead of the API loading every row into Python. The work stays where the data is, and the response stays small however many workouts there are.
- **`coalesce(sum(...), 0)`:** a week of only badminton has no distances, and `sum` over nothing is `NULL`, not 0. The API always returns numbers.
- **Weeks start on Monday,** as `date_trunc('week', …)` does in PostgreSQL (ISO weeks).
- **Empty weeks are not returned.** A week without workouts has no rows; filling the gaps is left to the chart.
- **The same error format** as every other endpoint.

### Verified

- `/stats/weekly` returns totals per week and sport; `?weeks=0` and `?weeks=abc` return `400` with field `weeks`.
- **4 new tests** (31 in total, all passing): totals for two runs and a swim in the same week (`run: 2 workouts, 15.0 km, 90 min`; `swim: 1, 1.5 km, 40 min`), and `weeks` = 0, 53 and `abc` rejected.

### Bugs found

- **A crashing container:** the API container started and stopped immediately, so `docker compose exec` reported "service is not running". The cause was a `NameError`: `models.py` used `Mapped[date]` without `from datetime import date`. `docker compose logs api` shows the traceback.
- **Alembic run from the wrong folder:** "No 'script_location' key found" means `alembic.ini` wasn't found. It lives in `backend/`.

---

## Session 2: Charts

**The page:** `/stats` (nav link "Stats") shows two stacked bar charts for the last 8 weeks: **distance per week** and **time per week**, one colour per sport. Drawn with **Recharts**.

### How it fits together

| Piece | What it does |
|---|---|
| `getWeeklyStats(weeks, signal)` + `parseWeeklyStats` | Fetches `/stats/weekly` and checks every row at runtime, like the other API functions |
| `stats/to-weekly-chart.ts` | **Pivots** the data: the API returns one row per week *and* sport ("long"); a chart needs one object per week with one key per sport ("wide") |
| `stats/WeeklyChart.tsx` | The chart: `XAxis` reads `week`, one `<Bar>` per sport, all with the same `stackId`, so each column's height is the week's total |
| `StatsPage.tsx` | Loading, error with **Try again**, empty, charts; the same effect, `AbortController` and `reloadKey` pattern as the list page |

```
API:   { week_start: "2026-11-09", sport: "run",  distance_km: 15 }
       { week_start: "2026-11-09", sport: "swim", distance_km: 1.5 }
chart: { week: "2026-11-09", run: 15, swim: 1.5 }
```

### Decisions

- **A chart library, not hand-drawn SVG.** Axes, scales, stacking, tooltips and the legend come with Recharts; the app's own work is getting the data into the right shape.
- **The pivot is a pure function** in its own file: data in, data out, no React. That makes it the easiest part to test, and it serves both charts through a `metric` parameter (`distance_km` or `duration_min`).
- **A `Map` keyed by week** keeps one row per week and the API's chronological order.
- **Rest days are left out of the charts:** they have no distance and no duration, so their bars would always be empty while still taking a place in the legend.
- **Only sports that appear get a bar,** so the legend matches the data.
- **One colour per sport**, with the app's teal for running.
- **The number of weeks is one constant** (`WEEKS = 8`), used for the request and both messages.

### Verified

- The charts show the demo data spread over 8 weeks; hovering a bar shows the values.
- API stopped → error + **Try again**; API started → **Try again** → charts.
- **5 new frontend tests:** 3 for the pivot (one row per week, chosen metric, no stats → no rows) and 2 for the page (error → retry → charts; no data → empty message). The bars themselves aren't tested: jsdom has no real layout, so Recharts draws nothing measurable there.
- `npm run build` passes, the same check Vercel runs.

### Bugs found

- **`node_modules` in the container:** after `npm install recharts` on the laptop, the `web` container still had its own, older `node_modules` (the anonymous volume in `docker-compose.yml`). `docker compose up -d --build -V web` rebuilds it; `-V` renews that volume.
- **`${unit}` on the axis:** the unit was written in plain or single quotes, so `${unit}` was printed literally. Only backtick template strings fill it in; `" " + unit` does the same without backticks.
- **No `ResizeObserver` in tests:** Recharts' `ResponsiveContainer` needs it, and jsdom doesn't have it. The page test adds a small stub.

---

## Summary

**Key question answered:** *Who should add up 500 workouts: the browser, the API, or the database?* The database. It returns a few dozen totals per week and sport; the API passes them on unchanged; the browser only reshapes them for the chart.

| Session | Result |
|---|---|
| 1 | `performed_on` date column; `GET /stats/weekly` with totals computed in SQL; 4 tests |
| 2 | `/stats` page with two stacked bar charts; pivot function; 5 tests |