# Backend - Workout API

A REST API with Flask, SQLAlchemy 2.0, Alembic and PostgreSQL. For the overview, see the [main README](../README.md).

## Endpoints

| Method | Path | What it does |
|---|---|---|
| `GET` | `/health` | Is the API running? Also returns the deployed commit (`version`) |
| `GET` | `/ready` | Can the API reach the database? `503` if not |
| `GET` | `/workouts` | List with filters, sorting and pages (see below) |
| `GET` | `/workouts/<id>` | One workout |
| `POST` | `/workouts` | Create a workout (JSON) |
| `PUT` | `/workouts/<id>` | Replace a workout (JSON, all fields) |
| `DELETE` | `/workouts/<id>` | Delete a workout |
| `POST` | `/workouts/upload/preview` | Check a CSV, GPX or FIT file (field `file`); saves nothing |
| `POST` | `/workouts/upload` | Import the file: all rows or none; existing workouts are skipped |
| `POST` | `/workouts/parse/preview` | Check typed text, one workout per line; saves nothing |
| `POST` | `/workouts/parse` | Save the typed workouts: all or none |
| `GET` | `/stats/weekly?weeks=8` | Totals per week and sport; `weeks` 1-52 |

`GET /workouts` accepts `sport`, `min_distance`, `min_duration`, `sort` (`id`, `distance_km`, `duration_min`, with `-` for descending), `limit` (1-100, default 20) and `offset`.

Status codes and the error format are in [`docs/api-contract.md`](../docs/api-contract.md). Example import files are in [`samples/`](../samples).

## Files

| File | Role |
|---|---|
| `app.py` | Routes, validation, error handlers |
| `db.py` | Database queries and inserts |
| `models.py` | The `Workout` model with its constraints and indexes |
| `importers.py` | One converter per input format (CSV, Strava CSV, GPX, FIT, typed text) |
| `observability.py` | Request IDs and JSON logs |
| `cache.py` | In-memory cache for the list; cleared on every write |
| `migrations/` | Alembic migrations |
| `seed.py` | Replaces **all** workouts with 40 sample workouts |
| `check_db.py` | Checks the connection to `DATABASE_URL` |
| `conftest.py`, `test_*.py` | Tests; they use a separate test database |

## Configuration

Copy `.env.example` to `.env` for running without Docker. Never commit `.env`.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | The database the API uses |
| `TEST_DATABASE_URL` | A separate database for the tests, emptied before each test |
| `CORS_ORIGINS` | Frontend addresses allowed to call the API (default `http://localhost:5173`) |

## Run it

With Docker, from the repo root: `docker compose up --build`. The API runs on http://localhost:5000. Rebuild after code changes: `docker compose up -d --build api`.

Without Docker, from `backend/`:

```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
flask --app app run
```

## Tests

```powershell
pytest            # all tests
pytest --cov      # with a coverage report
```

`test_contract_examples.py` writes example responses to `contracts/`, which the frontend tests read. Commit them when a response changes. Setting up the test database: [`docs/01-postgresql.md`](../docs/01-postgresql.md).

## Migrations

1. Change `models.py`.
2. Rebuild: `docker compose up -d --build api`
3. Generate: `docker compose exec api alembic revision --autogenerate -m "<what changed>"`
4. Copy the file out of the container: `docker compose cp api:/app/migrations/versions/<file>.py backend/migrations/versions/`
5. Review it, then apply: `docker compose exec api alembic upgrade head`

## Deployment

Render runs the Docker image with Gunicorn and needs `DATABASE_URL`, `CORS_ORIGINS` and `PORT=5000`. Deploys are started by CI after all tests pass ([`docs/11-ci-cd.md`](../docs/11-ci-cd.md)).

Migrations are run by hand against Neon, before the deploy:

```powershell
$env:DATABASE_URL = "<Neon connection string>"
alembic upgrade head
Remove-Item Env:DATABASE_URL
```

## Careful

- `seed.py` deletes all workouts. Check `DATABASE_URL` before running it.
- Connection strings never go into the repo.
- `docker compose down -v` deletes the local database.
