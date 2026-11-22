# 09 — Diagnose failures

**Why it matters:** in production, nobody sees the screen when something goes wrong. A user reports "I got an error", and the only evidence is in the logs. If the logs can't point to that one request, the problem can't be found.

**Key question:** *A user reports an error. How do you find their request in the logs?*

| | |
|---|---|
| Status | Done (4 sessions) |
| Header | `X-Request-ID` on every API response |
| Endpoints | `GET /health`, `GET /ready` |
| Log format | One JSON object per line, on stdout |

---

## Session 1: Request IDs and structured logs

### Before

```
172.18.0.1 - - [21/Nov/2026 10:59:14] "GET /workouts?limit=10&offset=0&sort=id HTTP/1.1" 200 -
```

Nothing connected what a user saw to a line in the log. An unexpected exception returned Flask's HTML error page to the user, and its stack trace landed somewhere among hundreds of identical lines.

### After

```json
{"time": "2026-11-21T10:59:14", "level": "INFO", "message": "request", "request_id": "0a5e8a03f08b", "method": "GET", "path": "/workouts?limit=10&offset=0&sort=id", "status": 200, "duration_ms": 4.2}
```

| Piece | What it does |
|---|---|
| `before_request` | Gives every request an ID: the caller's `X-Request-ID` if it looks safe, otherwise 12 random hex characters; starts a timer |
| `after_request` | Puts the ID into the response header and writes one log line with method, path, status and duration |
| `JsonFormatter` | Turns every log record into one JSON line, including a stack trace when there is one |
| `unexpected_error` handler | Any exception that isn't an HTTP error: the full stack trace goes into the log with the request ID; the user gets a `500` with "Something went wrong on our side. Reference: 0a5e8a03f08b" |
| CORS `expose_headers` | Lets the frontend read `X-Request-ID` (browsers hide custom headers from cross-origin responses by default) |

All of it lives in `observability.py`; `app.py` only calls `observability.setup(app)` and registers the error handler.

### Decisions

- **Log around every route, not in every route.** `before_request` and `after_request` cover every endpoint, including future ones, without any endpoint having to remember to log.
- **JSON lines on stdout.** Docker and Render both collect stdout; JSON can be searched by field (`request_id`, `status`) and read by log tools without custom parsing.
- **Accept the caller's ID only if it's safe.** A header is user input: an ID with a line break could forge extra log lines (log injection). Only letters, digits and `-`, up to 64 characters, are reused; anything else is replaced.
- **Internals stay in the log.** The user sees a short message with a reference, never the stack trace or the exception text, which could reveal how the system works inside.
- **HTTP errors keep their own handling.** The catch-all handler passes `HTTPException`s (404, 405, 413…) through unchanged; only real crashes become a `500`.
- **Times in UTC.** Logs from services in different places line up; the Zurich time is one hour later in winter.
- **Known duplicate:** Flask's development server writes its own access line next to the JSON line. It disappeared when the container switched to Gunicorn after milestone 11.

### Verified

- **4 new backend tests** (57 in total): every response has a request ID; a safe ID from the caller is kept; an unsafe one (100 characters) is replaced; a simulated crash deep inside (`monkeypatch` replaces `db.search_workouts` with a function that raises) returns `500` with the request ID in the message, and the exception text doesn't reach the response.
- In the browser: the `X-Request-ID` of a response in the Network tab is found in `docker compose logs api`.

---

## Session 2: Health checks

### Two questions, two endpoints

| Endpoint | Question | Checks | Answer |
|---|---|---|---|
| `GET /health` | *Is the API process running?* | Nothing | Always `200 {"status": "ok"}`, if it answers at all |
| `GET /ready` | *Can it do real work right now?* | `SELECT 1` against the database (`db.ping()`) | `200 {"status": "ready", "database": "ok"}`, or `503 {"status": "not ready", "database": "unreachable"}` |

**Why two:** when the database is down, restarting the API doesn't help. A platform that restarts services (Render) should look at `/health` only. But users should still learn that their data can't be loaded right now, and that's what `/ready` tells the frontend.

### The connection badge

The footer used to check the connection by loading one workout, and only knew "Connected" or "Not connected". It now asks `/ready` every 10 seconds and shows three states:

| `/ready` | Badge |
|---|---|
| `200` | green **Connected** |
| `503` | yellow **Database unavailable** |
| no answer or timeout | red **API unreachable (it may be waking up)** |

`checkReadiness()` turns the answer into one of three values (`"ready"`, `"database-down"`, `"offline"`), and the badge looks up text and colour in a `Record<Readiness, …>`, so TypeScript reports a state without a display.

### Decisions

- **`503`, not `500`, for an unreachable database.** `500` means "a bug"; `503 Service Unavailable` means "a dependency is temporarily missing, try again later", and both people and monitoring tools treat it that way.
- **Quiet paths.** `/health` and `/ready` are logged only when they fail. Checks every few seconds would otherwise bury the interesting lines; a failed readiness check is still logged, with its stack trace and request ID. The `X-Request-ID` header is still set on every response.
- **"It may be waking up".** On Render's free tier the first request after a pause can take about 30 seconds, longer than the client's 10-second timeout. The badge says so instead of only reporting an error.
- **The readiness check is as small as possible.** `SELECT 1` proves the connection works without touching any table, so the check itself can't slow the database down.

### Verified

- **3 new backend tests** (60 in total): `/health` answers `200`; `/ready` answers `200` with a reachable database; with `db.ping` replaced by a function that raises, `/ready` answers `503` with `database: unreachable`.
- In the browser, all three badge states: everything running → Connected; `docker compose stop db` → Database unavailable, with the failed checks in the API log; `docker compose stop api` → API unreachable; both started again → Connected.

## Session 3: Failure drills, and a real incident

**The idea:** break things on purpose, while watching both sides: what the user sees, and what the log shows. A failure that is visible but misleading is almost as bad as an invisible one.

### Drill 1: the database is down

`docker compose stop db`, then every page of the app.

| Observed | Verdict |
|---|---|
| The footer badge showed "Database unavailable" on every page; `/ready` answered `503` | Correct |
| Every failed request had its own request ID and the root cause in the log: `failed to resolve host 'db'` | Correct |
| `/workouts` and `/stats` answered **`500`** with "Something went wrong on our side" | **Misleading:** a known, temporary dependency failure was reported as a bug |
| Every failure wrote an **80-line stack trace**, `/ready` every 10 seconds; two minutes produced dozens of identical traces | **Noise:** the one line that mattered was buried |
| Every failing request took **3–4 seconds** | Slow, but caused by the failing name lookup of `db`, not by the app |

**Fixes:**
- A handler for SQLAlchemy's `OperationalError`: database failures now answer **`503`** with "The database is unavailable right now. Try again in a moment. Reference: …", and log **one** `WARNING` line with the cause (`short_error()` takes the first line of the underlying error). `/ready` logs the same way.
- Unexpected exceptions keep the full treatment: `ERROR`, stack trace, `500`. Flask picks the most specific handler, so the two cases are told apart automatically.
- A **connect timeout** of 5 seconds (`connect_args={"connect_timeout": 5}`). It doesn't shorten the drill above, where the name lookup fails; it protects against a database that doesn't answer at all, where the API would otherwise wait longer than the frontend's 10-second timeout and every request would end in an unexplained timeout.
- The import page no longer turns every `ApiError` into "The file changed"; a `503` shows the server's own message.

After the fixes, the same drill produced one short line per failure:

```json
{"level": "WARNING", "message": "database unavailable", "request_id": "af913a97df0d", "error": "failed to resolve host 'db': [Errno -2] Name or service not known"}
```

### Drill 2: from the user's reference to the cause

A planted `raise ValueError("drill: planted bug")` in the stats endpoint. The Stats page showed "Something went wrong on our side. Reference: a7dfa86c580f"; one search, `docker compose logs api | Select-String "a7dfa86c580f"`, returned the `ERROR` line with a stack trace pointing to `app.py`, the line of the `raise`. This is the key question of the milestone, answered end to end.

### Drill 3: a slow API

A planted 12-second delay in the list endpoint. After **10 seconds** (the client's timeout in `client.ts`) the page showed "Server is taking too long to respond." with Try again. About two seconds later, the server finished anyway and logged `status: 200`, `duration_ms` ≈ 12000.

**Lesson:** a client timeout doesn't stop the server, and the log alone shows a "successful" request. Only `duration_ms` reveals that nobody was waiting for the answer any more, the same situation as a save whose answer is lost (milestone 05), seen from the server.

### The real incident: deploys that silently stopped

| | |
|---|---|
| **Symptom** | The live footer badge said "API unreachable", while the same page showed this week's totals, which come from the API |
| **First finding** | The new frontend (Vercel) asked `/ready`; the API on Render answered `404`, because it was still the version from two days earlier. Every push since then had reached Vercel, none had reached Render |
| **Root cause** | The Render app on GitHub no longer had access to the repository. Render never learned about the pushes, and nothing reported the missing deploys |
| **Fix** | Repository access restored for the Render app; a manual deploy of the latest commit; then a test push to confirm automatic deploys again |
| **Badge fix** | `checkReadiness()` now reports "offline" only when there is no answer at all (`NetworkError`). Any answer, even a `404`, means the API is reachable |
| **Would have caught it earlier** | A deploy pipeline that reports failures (milestone 11), and a deploy order of backend first, frontend second. Frontend and backend deploy independently, so for a while a new frontend can talk to an old API |

### Verified

- **1 new backend test** (61 in total): a database failure deep inside a request returns `503` with the request ID in the message, and the underlying error text stays out of the response.
- All three drills repeated after the fixes, with the planted bug and delay removed afterwards.

## Session 4: One request, traced through all three services

One click on the **live** site (`/workouts`), followed from the browser through Render to Neon and back, using the request ID from session 1.

### The trace

| Hop | Where it shows | Observed |
|---|---|---|
| **Browser → Vercel** (the page itself) | DevTools, `workouts` (Doc), Timing | 48.9 ms in total, 45.6 ms waiting for Vercel's edge network |
| **Browser → Render** (the API call) | DevTools, `workouts?limit=10…` (Fetch/XHR), Timing | **122.4 ms** in total, of which 118.8 ms waiting for the server's response; a `Server-Timing` entry `cfExtPri` shows the request passed through Cloudflare, which sits in front of Render |
| **Render → Flask → Neon** | Render dashboard, Logs, search for the `X-Request-ID` (`577cb5ae8671`) | One JSON line: `status: 200`, **`duration_ms: 79.6`**, the time Flask spent including the queries to Neon |
| **The rest** | the difference | about **43 ms** for the network, TLS and Render's proxy |

### What the numbers say

- **The request ID connects the two sides.** The ID from the browser's response headers found exactly one line in Render's logs, with nothing else needed: no timestamps to match up, no guessing which request it was.
- **Most of the time is spent talking to the database.** The same endpoint takes about 4 ms locally, where API and database share one machine. In production, Flask on Render and PostgreSQL on Neon are separate services, so every query is a network round trip, and this request makes several: the list query, the count for the pagination, and the connection check of `pool_pre_ping` before using a pooled connection. `pool_pre_ping` costs one round trip per request; it's the price for never handing out a dead connection (milestone 04).
- **The frontend and the API are served from different places.** The page (Vercel's edge, about 46 ms) and the data (Render plus Neon, about 120 ms) travel separately, which is why the page appears before the list.
- **Health checks stay quiet.** The `/ready` requests every 10 seconds appear in the browser, but not in Render's logs, because they succeeded.
- **The deploy pipeline works again.** The live logs are JSON lines with request IDs, so today's code reached Render without a manual deploy.

### Possible next steps (not done)

- `Server-Timing` headers from Flask (for example `db;dur=70`) would show the database share directly in the browser's Timing tab.
- Combining the list and the count into one query would save a round trip per page.

---

## Summary

**Key question answered:** *A user reports an error. How do you find their request in the logs?* By the reference they see. Every response carries an `X-Request-ID`, every log line contains it, and every error message shows it to the user. One search in the logs returns that request, with a one-line cause for known failures (database unavailable, `503`) and a full stack trace for real bugs (`500`).

| Session | Result |
|---|---|
| 1 | Request IDs and one JSON log line per request; `500` with a reference for unexpected errors |
| 2 | `/health` and `/ready`; a connection badge with three states; quiet health checks |
| 3 | Three failure drills and their fixes (`503` for database outages, one-line warnings, a connect timeout); a real incident written up: deploys that had silently stopped |
| 4 | One live request traced from the browser through Render to Neon: 122 ms in total, 80 ms of it in Flask and the database |