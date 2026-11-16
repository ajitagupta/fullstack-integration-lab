# 06 — Search, filters & pagination

**Why it matters:** a list of 40 rows works without any of this. A list of 4,000 needs filters, a page size the server controls, and an order that doesn't change between pages.

**Key question:** *Two searches are in flight, and the older one answers last. Which result does the user see?*

| | |
|---|---|
| Status | Session 1 of 4 done |
| Endpoint | `GET /workouts` |

---

## Session 1: A robust list API

Most of the filtering already existed from the Python lab (`sport`, `min_distance`, `min_duration`, `limit`, `offset`). This session made it robust.

### Query parameters

| Parameter | Allowed | Default | Invalid → |
|---|---|---|---|
| `sport` | `swim`, `run`, `badminton`, `cycle`, `strength`, `rest` | all sports | `400`, field `sport` |
| `min_distance`, `min_duration` | numbers | none | `400` |
| `limit` | **1–100** (`MAX_LIMIT`) | **20** | `400`, field `limit` |
| `offset` | **≥ 0** | 0 | `400`, field `offset` |
| `sort` | `id`, `distance_km`, `duration_min`; a leading `-` means descending | `id` | `400`, field `sort` |

Example: `GET /workouts?sport=run&sort=-distance_km&limit=5` returns the five longest runs.

### Decisions

- **A bounded page size.** Before, `?limit=1000000` loaded the whole table in one request. The server now decides the maximum; the client only chooses within it.
- **Unknown values are errors, not empty results.** `?sport=football` used to return an empty list, indistinguishable from "no matching workouts". Now it's a `400` that names the field.
- **Sorting always ends with `id` as a tie-breaker** (`ORDER BY <field>, id`). Without it, rows with the same value (e.g. two workouts with 19.5 km) can come back in a different order on each query, and with `offset` paging a row can appear on two pages, or on none. `id` is unique, so the order is stable.
- **`NULLS LAST`.** Rest days have no distance. Without it, PostgreSQL puts `NULL`s first when sorting descending, and "longest first" would start with rest days.
- **One list of sports** (`ALLOWED_SPORTS`), used by the list filter, the create/update validation and the CSV import.
- **The cache needed no change:** its key is built from all query parameters, so each sort order is cached separately.
- **No text search (yet):** workouts have no text fields. It becomes relevant with something like a notes field.

### Verified

- `?sort=-distance_km&limit=5`: longest first; the two workouts with 19.5 km came back as id 15 before id 40, the tie-breaker at work.
- **4 new tests:** a descending sort with a tie (`[b, c, a]`), `limit` 0 and 101, an unknown sport, an invalid sort. Each test checks the status **and** the field, so a `400` for a different reason doesn't count as a pass.

### Bugs found

- **A constant under two names:** defined as `allowed_sports`, used as `ALLOWED_SPORTS`, which would have been a `NameError` on every filtered request. Now one constant, used everywhere.
- **Validated but not used:** the `sort` parameter was checked, but not passed on to `db.search_workouts`, so every request would have been silently sorted by `id`. Caught in review, before the first test run.
- **New errors in the wrong format:** the first versions returned plain strings instead of `{"field", "error"}` objects, which the frontend couldn't map to a field.

---

## Session 2: Filter state in the URL

_(next)_

## Session 3: Stale responses

_(planned)_

## Session 4: Indexes and EXPLAIN

_(planned)_