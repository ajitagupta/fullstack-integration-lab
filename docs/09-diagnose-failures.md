# 09 — Diagnose failures

**Why it matters:** in production, nobody sees the screen when something goes wrong. A user reports "I got an error", and the only evidence is in the logs. If the logs can't point to that one request, the problem can't be found.

**Key question:** *A user reports an error. How do you find their request in the logs?*

| | |
|---|---|
| Status | Sessions 1–2 of 4 done |
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
- **Known duplicate:** Flask's development server writes its own access line next to the JSON line. It disappears with the production server in milestone 11.

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

## Session 3: Failure drills

_(planned)_

## Session 4: A full trace

_(planned)_