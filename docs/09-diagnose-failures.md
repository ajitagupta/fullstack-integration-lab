# 09 - Logs and health checks

Find a single request in the logs, and tell the user when the API or the database is down.

## What was built

- **Request IDs:** every response has an `X-Request-ID` header, and every log line contains it.
- **JSON logs:** one line per request (method, path, status, time), written to stdout, where Docker and Render collect them.
- **Errors with a reference:**
  - a bug → `500` "Something went wrong on our side. Reference: 0a5e8a03f08b", with the stack trace in the log
  - database down → `503` "The database is unavailable right now", with a one-line warning in the log
- **Health checks:**
  - `/health`: is the API running? (no database access)
  - `/ready`: can it reach the database?
- **Connection badge** in the footer, asking `/ready` every 10 seconds: Connected, Database unavailable, or API unreachable.

## Decisions

- A caller's `X-Request-ID` is reused only if it looks safe (letters, digits, `-`), so it can't inject fake log lines.
- The user never sees stack traces or error details, only the reference.
- `/health` and `/ready` are logged only when they fail, so they don't flood the log.
- A 5-second connect timeout, so the API doesn't hang on an unreachable database.

## Drills

- **Database stopped:** at first every request gave a `500` and an 80-line stack trace. Now it's a `503` and one log line.
- **A planted bug:** the reference on the page found the right log line, with the stack trace, in one search.
- **A slow API (12 s):** the page gave up after 10 s, but the server still finished and logged `200`. A client timeout doesn't stop the server.

## A real incident

The live badge said "API unreachable" although the list loaded. Render had stopped deploying two days earlier: its GitHub app had lost access to the repository, and nothing reported it. The new frontend called `/ready`, which the old API didn't have. Fixed by restoring the access and deploying by hand. Milestone 11 made deploys fail visibly.

## Tracing one live request

The request ID from the browser found the same request in Render's logs. Of about 120 ms in total, Flask spent about 80 ms, mostly on round trips to Neon.
