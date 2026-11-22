# 10 - Testing the whole system

Backend and frontend each had tests, but each side faked the other. This milestone added tests that check the parts together.

| Layer | Tool | Count |
|---|---|---|
| Backend | pytest, against a test database | 62 tests, 91% line coverage |
| Frontend | Vitest | 32 tests in 7 files, about 31% line coverage |
| Contract | pytest writes, Vitest reads | 6 example responses in `contracts/` |
| End to end | Playwright, in a real browser | 5 journeys |

## What was built

- **Coverage reports:**
  - backend: `pytest --cov`
  - frontend: `npx vitest run --coverage`

  They show where tests are missing, not a target to reach.
- **Tests for `client.ts`:** success, API errors, no connection, timeout (with fake timers), cancellation.
- **Contract files:** `test_contract_examples.py` saves real API responses to `contracts/`, and `contract.test.ts` checks them with the frontend's own parsers. If one side changes a response and the other doesn't, a test fails.
- **Playwright journeys:**
  - add, view, edit and delete a workout
  - Quick add: typed text is checked by the API
  - import: a CSV preview
  - API down: the page says so

## Decisions

- Each journey creates its own data and cleans up, so it works with any data in the database.
- The Quick add and import journeys stop at the preview, so they don't leave workouts behind.
- The "API down" journey blocks requests inside the browser (`page.route`), so Docker keeps running.
- Values that change daily (dates) are replaced by a fixed date before a contract file is saved.

## Lessons

- The old Playwright test relied on the data in the database ("the first run is #2") and broke.
- A caught error has the type `unknown` in TypeScript; a small helper `failure<E>()` returns it with the right type.
- The contract test reads files from disk, so it runs in the `node` environment instead of `jsdom`.
- A test that can't fail proves nothing: with the `page.route` line removed, the "API down" journey must fail.

## Limits

- Frontend coverage is low because the pages are mostly tested by Playwright, which the report doesn't count.
- Saving through Quick add and Import is tested through the API only, not in the browser.
