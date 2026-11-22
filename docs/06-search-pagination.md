# 06 - Search and pagination

Filter, sort and page through the list, with the state in the URL, e.g. `/workouts?sport=swim&sort=-duration_min&page=2`.

## What was built

- `GET /workouts` checks its parameters:

  | Parameter | Allowed | Default |
  |---|---|---|
  | `sport` | swim, run, badminton, cycle, strength, rest | all |
  | `sort` | `id`, `distance_km`, `duration_min`; `-` for descending | `id` |
  | `limit` | 1-100 | 20 |
  | `offset` | 0 or more | 0 |

  Anything else is a `400` that names the field.
- The page reads its filters from the URL and writes changes back, so reload, bookmarks and back/forward work.
- Changing a filter goes back to page 1.
- Three empty states: no workouts yet, no matches for the filter, page doesn't exist.
- Only the newest request can update the list: the effect's cleanup aborts the previous one, and "Try again" goes through the same effect.
- Two indexes for the sorted, filtered list.

## Decisions

- **`id` as tie-breaker** (`ORDER BY distance_km, id`): without it, two rows with the same value can swap places between queries and appear on two pages.
- **`NULLS LAST`**, so "longest first" doesn't start with rest days.
- **Measure before adding an index.** With 100,000 generated rows, `EXPLAIN ANALYZE` showed:
  - the default list was already fast (primary key index)
  - "swim, longest first" went from 6.3 ms to 0.08 ms with an index on `(sport, distance_km DESC NULLS LAST, id)`
- At 47 rows PostgreSQL still reads the whole table, which is correct: one page is cheaper than an index lookup.

## Lessons

- An aborted request still reaches Flask and is logged as `200`. Aborting protects the page, not the server.
- In development, React mounts each page twice, so the Network tab shows one cancelled request and one `200`.
- `alembic revision --autogenerate` found nothing at first: the container still had the old `models.py`. Rebuild first, then copy the new migration out with `docker compose cp`.
- A validated `sort` parameter wasn't passed on to the database at first. Review caught it before the first test run.
