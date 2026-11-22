# Backend — Workout API

The REST API of the workout tracker: **Flask**, **SQLAlchemy 2.0**, **Alembic** and **PostgreSQL**. It stores workouts, validates every write, serves a filtered, sorted and paginated list, imports CSV files, and computes weekly stats.

For the project overview, see the [main README](../README.md). Design decisions per milestone are in [`docs/`](../docs).

## Endpoints

| Method | Path | What it does | Success |
|---|---|---|---|
| `GET` | `/health` | Liveness: answers if the process runs; no database access | `200` |
| `GET` | `/ready` | Readiness: checks the database with `SELECT 1`; `503` if it's unreachable | `200` |
| `GET` | `/workouts` | List workouts: filters, sorting, pagination (see below) | `200` |
| `GET` | `/workouts/<id>` | One workout | `200` |
| `POST` | `/workouts` | Create a workout (JSON) | `201` |
| `PUT` | `/workouts/<id>` | Replace a workout (JSON, all fields) | `200` |
| `DELETE` | `/workouts/<id>` | Delete a workout | `204` |
| `POST` | `/workouts/upload` | Import a CSV, GPX or FIT file (`multipart/form-data`, field `file`). CSV columns `sport`, `distance_km`, `duration_min`, optional `performed_on`; a GPX file becomes one workout, a FIT file one workout per session; Strava's `activities.csv` export is recognised by its header. At most 1 MB and 1,000 rows. All or nothing; rows that already exist are skipped. Answers `{"inserted", "skipped"}` | `201` |
| `POST` | `/workouts/upload/preview` | The same file checks as the upload; returns every row with its error and a duplicate flag, saves nothing | `200` |
| `POST` | `/workouts/parse/preview` | Plain text, one workout per line ("ran 5 km in 30 min"); returns every line as a row with its error and a duplicate flag, saves nothing | `200` |
| `POST` | `/workouts/parse` | The same text, saved all or nothing; lines that already exist are skipped. Answers `{"inserted", "skipped"}` | `201` |
| `GET` | `/stats/weekly?weeks=8` | Totals per week and sport (workouts, km, minutes), computed in SQL; `weeks` 1–52 | `200` |

Example import files are in [`samples/`](../samples): a CSV file, a GPX run, a FIT ride and a Strava export.

**List parameters** for `GET /workouts`:

| Parameter | Allowed | Default |
|---|---|---|
| `sport` | `swim`, `run`, `badminton`, `cycle`, `strength`, `rest` | all sports |
| `min_distance`, `min_duration` | numbers | none |
| `sort` | `id`, `distance_km`, `duration_min`; a leading `-` means descending | `id` |
| `limit` | 1–100 | 20 |
| `offset` | ≥ 0 | 0 |

**Errors** always have the same shape, so the frontend can show each message next to the right field:
```json
{ "errors": [ { "field": "distance_km", "error": "The key distance_km is missing." } ] }
```
Invalid input is `400`, an unknown id is `404`, an upload over 1 MB is `413`. An unreachable database is `503` ("unavailable right now"), an unexpected error `500`, both with a reference: the response's `X-Request-ID`, which every response carries and every log line contains. The full contract is in [`docs/api-contract.md`](../docs/api-contract.md).

## Files

| File | Role |
|---|---|
| `app.py` | Routes, request validation (`validate_workout_payload`), file checks for imports, the shared preview and import answers, error format, CORS |
| `db.py` | Database access: engine (`pool_pre_ping`, 5-second connect timeout), queries, inserts in one transaction, `ping()` for `/ready` |
| `models.py` | The `Workout` model with its check constraints and indexes |
| `migrations/` | Alembic migrations: the schema history |
| `observability.py` | Request IDs and one JSON log line per request (`before_request` / `after_request`); `/health` and `/ready` are logged only when they fail |
| `importers.py` | One converter per input format (CSV, Strava CSV, GPX, FIT, typed text), chosen by file extension and, for CSV, by header; the text parser `parse_line` lives here too; GPX is read with `defusedxml`, FIT with `fitdecode` |
| `cache.py` | Small in-memory cache for list queries; cleared on every write |
| `seed.py` | Replaces **all** workouts with 40 sample workouts |
| `check_db.py` | Connection check against `DATABASE_URL` |
| `try_parse.py` | Scratch script for the text parser |
| `conftest.py` | Test setup: switches to the test database and empties it before each test |
| `test_*.py` | API tests (`test_baseline`, `test_contract`, `test_app`): behaviour, status codes, error format |

## Configuration

Copy `.env.example` to `.env` for local runs without Docker. Never commit `.env`.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | The database the API uses, e.g. `postgresql+psycopg://…/workouts` |
| `TEST_DATABASE_URL` | A **separate** database for the tests, which empty it before every test |
| `CORS_ORIGINS` | Comma-separated list of frontend origins allowed to call the API (default `http://localhost:5173`) |

## Run it

**With Docker** (recommended), from the repo root:
```powershell
docker compose up --build
```
The API runs on http://localhost:5000, next to PostgreSQL and the frontend. The backend code is **copied into the image**, not mounted, so rebuild after code changes: `docker compose up -d --build api`.

**Without Docker**, from `backend/`, against a local PostgreSQL:
```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
flask --app app run
```

## Tests

From `backend/` with the venv active and `TEST_DATABASE_URL` set in `.env`:
```powershell
pytest            # all tests
pytest --cov      # with a coverage report (settings in .coveragerc)
```
The tests run against the test database only; the development data is never touched.

`test_contract_examples.py` writes real responses of the API to `contracts/` in the repo root, where the frontend's contract test reads them. When a response changes, commit the changed files with the code. Setting up both databases is described in [`docs/01-postgresql.md`](../docs/01-postgresql.md).

## Migrations

Schema changes go through Alembic, never by hand:

1. Change `models.py`.
2. Rebuild, so the container sees the new model: `docker compose up -d --build api`
3. Generate: `docker compose exec api alembic revision --autogenerate -m "<what changed>"`. It should report a `Detected …` line for each change.
4. Copy the new file out of the container, so it ends up in Git:
   `docker compose cp api:/app/migrations/versions/<file>.py backend/migrations/versions/`
5. Review it, then apply: `docker compose exec api alembic upgrade head`. Test `alembic downgrade -1` once as well.

## Deployment

The API runs on **Render** as a Docker service; the database is on **Neon**. Render needs `DATABASE_URL`, `CORS_ORIGINS` and `PORT=5000`.

Render's automatic deploy is **off**. The `deploy` job in `.github/workflows/ci.yml` starts a deploy through Render's deploy hook once all tests have passed, then waits until `/health` reports the new commit (`"version"`, from `RENDER_GIT_COMMIT`; `"local"` outside Render). Details are in [`docs/11-ci-cd.md`](../docs/11-ci-cd.md).

Migrations are **not** applied by the deploy. Run them from the laptop against Neon, then remove the variable again:
```powershell
$env:DATABASE_URL = "<Neon connection string>"
alembic upgrade head
Remove-Item Env:DATABASE_URL
```
Details are in [`docs/04-first-vertical-slice.md`](../docs/04-first-vertical-slice.md).

## Careful

- **`seed.py` empties the table.** Only run it against a database without data you want to keep, and check `DATABASE_URL` first.
- **Connection strings stay out of the repo:** in `.env` locally, in the Render and Neon settings in production.
- `docker compose down -v` deletes the local database volume, and with it all local data.