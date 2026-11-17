# 06 — Search, filters & pagination

**Why it matters:** a list of 40 rows works without any of this. A list of 4,000 needs filters, a page size the server controls, and an order that doesn't change between pages.

**Key question:** *Two searches are in flight, and the older one answers last. Which result does the user see?*

| | |
|---|---|
| Status | Sessions 1–3 of 4 done |
| Endpoint | `GET /workouts` |
| Page | `/workouts?sport=swim&sort=-duration_min&page=2` |

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

**The idea:** the URL *is* the state. The page reads its filters **from** the address bar and writes changes **into** it. So `/workouts?sport=swim&sort=-duration_min&page=2` can be bookmarked, shared, reloaded and navigated with back/forward, and it always shows the same list.

### How it fits together

| Piece | What it does |
|---|---|
| `getWorkouts({ sport, sort, page })` | Builds the API query with `URLSearchParams`; turns the page into `limit`/`offset` in one place: `offset = (page − 1) × PAGE_SIZE` |
| `useSearchParams()` | Reads `sport`, `sort` and `page` from the URL, with defaults via `??` |
| The effect's dependencies `[sport, sort, page]` | Any URL change, including back/forward, reloads the list |
| `updateParam(name, value)` | For filters: keeps the other parameters, sets or removes the changed one, and **resets the page** |
| `goToPage(n)` | For paging: keeps all filters, changes only `page` (page 1 = no parameter) |
| Pagination | "Page 2 of 5 · 23 workouts", Previous/Next disabled at the ends, inside `<nav aria-label="Pagination">` |

### Decisions

- **Users think in pages, the API in offsets.** The conversion happens in exactly one function, so the UI never deals with offsets.
- **A new filter resets the page to 1.** Otherwise page 4 of "all sports" could become an empty page 4 of "swim".
- **Empty values are removed from the URL,** not written as `sport=`, so "All sports" and page 1 keep the URL clean.
- **The frontend chooses its own page size** (`PAGE_SIZE = 10`) within the API's maximum of 100. The API's default of 20 is only for clients that don't send a `limit`.
- **One helper per kind of change** (`updateParam`, `goToPage`), so the "keep other filters" and "reset page" rules live in one place each.

### Verified

- Typed URLs by hand (`?sport=run`, `?sort=-distance_km`, `?page=2`): the page reads the URL correctly.
- The selects write into the URL; **back** returns to the previous filter; Next adds `&page=2`; changing the sort on page 2 goes back to page 1.

### Bugs found

- **The query object in the wrong place:** `{ sport, sort, page }` first ended up as `load`'s parameters instead of in the `getWorkouts` call. `load` doesn't need parameters: it reads the component's variables directly.
- **A name used twice:** the API response in `.then((page) => …)` would have hidden the `page` number. Renamed to `result`.
- **Controls in the wrong component:** the selects were first placed inside `Welcome`, which can't see `WorkoutsPage`'s variables. Moved into `WorkoutsPage`.
- **"Can't reach the server"** while only the frontend was running: the error state worked as designed; the API simply wasn't started.

---

## Session 3: Stale responses and empty states

**The problem:** two requests are in flight, and the older one answers last. Without protection, its result overwrites the newer one: the dropdown says "swim", but the list shows all sports.

### How the page is protected

| Piece | What it does |
|---|---|
| `AbortController` in the effect | Each run of the effect gets its own controller and passes its `signal` to `getWorkouts` |
| Cleanup `return () => controller.abort()` | Before the effect runs again (new sport, sort, page), React aborts the previous request |
| `RequestCancelledError` | An aborted request ends in this error; `load` ignores it, so a cancelled request never touches the state |
| `reloadKey` | A counter in the effect's dependencies. **Try again** only increments it, and the effect does the loading |
| `load(signal: AbortSignal)` | The signal is required, so TypeScript rejects any call that bypasses the effect |

### Decisions

- **One path for every request.** Filter, sort, page and retry all go through the effect, so cancellation has to be right in one place only. Before this session, **Try again** called `load()` directly, without a signal: a slow retry could not be cancelled and could overwrite the list of a newer filter.
- **A dependency as a trigger.** `reloadKey` carries no meaning except "load again". Changing it is how the button asks React to re-run the effect.
- **Abort is client-side only.** The browser stops waiting and discards the answer, but the request has already reached Flask, which still runs it and logs `200`. Aborting protects the UI from stale data, not the server from work.
- **Three empty states instead of one:**

  | Situation | Condition | Message |
  |---|---|---|
  | Database empty | no sport filter, `total === 0` | "No workouts yet - add your first one." |
  | Filter matches nothing | sport set, `total === 0` | "No swim workouts found." + **Clear filter** |
  | Page out of range (`?page=99`) | `total > 0`, empty page | "Page 99 doesn't exist." + **Go to page 1** |

  `sort` doesn't count as a filter: it changes the order, never the number of results. The buttons reuse `updateParam` and `goToPage`, so **Clear filter** also resets the page and keeps the sort order.
- **`role="status"` on the empty-state messages,** so screen readers announce a result that changes without a page reload.
- The list now shows duration as well as distance.

### Verified

- **Network tab (Fetch/XHR):** in development, React's StrictMode mounts the page twice. The first list request shows `(canceled)`, the second `200`: the cleanup at work. A quick sport change only cancels a request if it is still in flight; with small local responses that needs heavy throttling (3G or a custom latency).
- **Try again:** API stopped → error + Try again → clicking repeats the error → API started → Try again loads the list.
- The "filter matches nothing" message couldn't be shown with the current data, since every sport has workouts. It uses the same condition as the other cases with `hasFilter` flipped.

### Bugs found

- **The click event under a state name:** the first version of the button was `onClick={(reloadKey) => load(setReloadKey(reloadKey + 1))}`. An `onClick` parameter is the click event, so `reloadKey` there hid the real state; `setReloadKey` returns nothing, so `load` would have got `undefined`; and calling `load` was no longer needed at all. The required `signal` parameter made TypeScript reject it. Fixed to `onClick={() => setReloadKey((k) => k + 1)}`.
- **Only the page request in the Network tab:** with the "All" filter, the `:5173` page entry hides the API calls. The page is loaded once; filter changes only update the address bar. The API calls go to `:5000` and show up under **Fetch/XHR**.

---

## Session 4: Indexes and EXPLAIN

_(planned)_