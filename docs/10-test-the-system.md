# 10 — Test the integrated system

**Why it matters:** the backend has its tests and the frontend has its tests, but each side fakes the other. pytest never runs the React code, and Vitest replaces the API with `vi.mock`. Both suites can stay green while the two halves no longer fit together, and nothing checks that a person in a browser can still do the main things.

**Key question:** *How do you know that a change didn't break the system, and not only one half of it?*

| | |
|---|---|
| Status | Done (5 sessions) |
| Backend | 62 pytest tests, 91% line coverage |
| Frontend | 33 Vitest tests in 8 files, about 31% line coverage |
| Shared | 6 example responses in `contracts/`, written by pytest, read by Vitest |
| End to end | 5 Playwright journeys against the running stack |

---

## The layers

| Layer | Tool | What runs for real | What is faked | Catches |
|---|---|---|---|---|
| Backend | pytest | Flask, SQLAlchemy, the test database | Nothing below the API | Wrong status codes, validation, SQL, imports |
| Frontend units and components | Vitest + Testing Library | Parsers, the API client, forms, pages | `fetch` or the API module | Wrong parsing, error handling, rendering, timeouts |
| Contract | pytest writes, Vitest reads | The real API's responses, the real parsers | Nothing, only the network between them | A response shape one side changed and the other didn't |
| End to end | Playwright | Browser, Vite, Flask, PostgreSQL | Nothing (one test cuts the network on purpose) | A user journey that no longer works |

The lower layers are fast and precise: a failure points at one function. The top layer is slower and points at a journey, but it's the only one that proves the parts work together.

---

## Session 1: Honest coverage

```powershell
# backend/
pytest --cov

# frontend/
npx vitest run --coverage
```

| Setting | Why |
|---|---|
| `backend/.coveragerc` omits `test_*.py`, `conftest.py`, scripts and `migrations/` | Test files run completely by definition; counting them inflates the number |
| `coverage.include: ["src/**/*.{ts,tsx}"]` in `vitest.config.ts` | Without it, Vitest only counts files that some test imports. A file no test touches would be missing from the report instead of showing 0% |

**Results:** backend 91%; frontend 24.7% before session 2. The frontend number is low because most pages are only exercised by Playwright, which this report doesn't see. The report's job is to show *where* the gaps are, not to reach a target: `client.ts`, the code every request goes through, was mostly untested.

**Also found:** the existing Playwright test failed. It relied on whatever was in the database ("the first run is #2"). The journeys in sessions 4 and 5 create their own data instead.

## Session 2: Tests for the API client

8 tests in `src/api/client.test.ts`, with `fetch` replaced by `vi.stubGlobal`. `client.ts` is now at 100%.

| Case | How it's faked |
|---|---|
| `2xx` with JSON | `fakeResponse(200, body)` |
| `4xx`/`5xx` with the API's error format | `fakeResponse(400, { errors: [...] })`, expecting an `ApiError` with the server's message |
| No connection | `fetch` rejects with a `TypeError`, expecting a `NetworkError` |
| Too slow | `hangingFetch()` never answers; `vi.useFakeTimers()` and `advanceTimersByTime(10_000)` jump to the client's timeout instantly |
| Cancelled by the caller | The caller's `AbortSignal` fires; the promise rejects as aborted, not as a timeout |

**`failure<E>()`:** in TypeScript, a caught error has the type `unknown`, so `err.status` doesn't compile. A small helper awaits the promise, expects it to reject and returns the error typed as `E`, so each test reads `const err = await failure<ApiError>(call)` and can check its fields.

## Session 3: A contract both sides check

```
backend/test_contract_examples.py        frontend/src/api/contract.test.ts
  real requests → real responses   →   contracts/*.json   →   the frontend's real parsers
```

| File | Written from | Checked with |
|---|---|---|
| `workout.json` | `POST /workouts` | `parseWorkout` |
| `workout-list.json` | `GET /workouts` | `parseWorkoutList` |
| `weekly-stats.json` | `GET /stats/weekly` | `parseWeeklyStats` |
| `upload-preview.json` | `POST /workouts/upload/preview` with one bad row | `parseUploadPreview` |
| `import-result.json` | `POST /workouts/parse` | `toImportResult` |
| `error.json` | `POST /workouts` without a distance | The error format: `{ field, error }` |

### Decisions

- **Generated, not hand-written.** The files are the API's actual answers, so they can't drift from the code. Values that depend on the day (`week_start`) are replaced by a fixed date before saving, so the files only change when the format does.
- **Committed to the repo.** The frontend tests need no running backend, and a diff in `contracts/` shows any change to a response in the pull request.
- **The real parsers, not a schema copy.** The test uses the same functions the app uses, so it checks what the app actually depends on.
- **`// @vitest-environment node`:** the contract test reads files from disk, which needs Node's `fs` rather than the browser-like `jsdom`; `"node"` is in the `types` of `tsconfig.test.json`.

**Verified:** renaming a field in the list response made the frontend's contract test fail, although the change was made only in Flask.

## Session 4: The main journey in a real browser

`frontend/tests/journeys.spec.ts`: add a workout with the form → its details page → edit the duration → delete it → its page says "not found".

- **The test creates its own data** and finds it by the ID in the success message (`/#(\d+)/`), so it works with any data in the database. Deleting the workout is the last step of the journey and the clean-up at the same time.
- **Locators like a user:** `getByLabel("Distance (km)")`, `getByRole("button", { name: "Add workout" })`. The tests find elements by their accessible names, so they also check that the labels are there.
- **`exact: true`** where one name is part of another ("Workouts" vs "Add workout").
- **No sleeps:** every `expect` retries for up to 5 seconds while the API answers.

## Session 5: More journeys

| Journey | Checks | Writes to the database |
|---|---|---|
| Quick add | "swam 1.5 km 40 min" → Check → the table shows **swim**, so the text went through Flask's parser | No, stops at the check |
| Import | A CSV built in memory (`setInputFiles` with a `Buffer`) → the preview table shows the row | No, stops at the preview |
| API down | `page.route("http://localhost:5000/**", route => route.abort())` → the badge says "API unreachable" and the list shows an alert | No |

- **No leftovers:** the saving itself is covered by pytest and by the session 4 journey, so these journeys stop before it.
- **The outage is faked for one page only.** Cutting the network inside the browser leaves Docker running and the other tests unaffected; stopping the `api` container would break them.
- **A test that can't fail proves nothing.** With the `page.route` line commented out, the API-down journey fails, as it should.
- `tests/` is part of `tsconfig.test.json`, so `npm run build` type-checks the journeys too (`Buffer` needs the Node types).

---

## Known limits

- Frontend line coverage stays around 31%, because the pages are mostly tested through Playwright, which the coverage report doesn't count.
- The journeys need the stack running (`docker compose up -d`). Since milestone 11, CI starts the stack and runs them on every push ([11-ci-cd](11-ci-cd.md)).
- Saving from Quick add and Import is not tested in the browser, only through the API.

## Summary

**Key question answered:** *How do you know that a change didn't break the system?* Each layer answers a different part. pytest and Vitest show which function broke; the contract files show when one side changed a response the other side depends on; the Playwright journeys show that a person can still add, find, change, delete and import workouts in a real browser.

| Session | Result |
|---|---|
| 1 | Honest coverage reports: backend 91%, frontend 25%, with every file counted |
| 2 | 8 tests for the API client: errors, network failures, timeout, cancellation; `client.ts` at 100% |
| 3 | `contracts/`: real API responses, checked by the frontend's real parsers |
| 4 | The main journey end to end: add, view, edit, delete |
| 5 | Journeys for Quick add, the import preview and an unreachable API |