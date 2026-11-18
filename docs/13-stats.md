# 13 — Stats & charts

**Why it matters:** a list answers "what did I do?". Stats answer "am I doing more or less than last month?", and that question needs totals, not rows.

**Key question:** *Who should add up 500 workouts: the browser, the API, or the database?*

| | |
|---|---|
| Status | Session 1 of 2 done |
| Endpoint | `GET /stats/weekly?weeks=8` |

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

_(planned)_