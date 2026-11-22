# 01 - PostgreSQL

The API moved from a SQLite file to PostgreSQL 18, with SQLAlchemy 2.0 as the ORM and Alembic for migrations. The API behaved the same afterwards: all baseline tests passed.

## What was built

- `db.py` rewritten with SQLAlchemy; function names and return values kept, so `app.py` barely changed.
- An Alembic migration creates the `workouts` table. `init_db()` was removed, so the schema is defined in one place.
- Named check constraints, e.g. `ck_workouts_distance_required` (run, swim and cycle need a distance).
- Batch inserts (CSV, text) in **one transaction**: if one row fails, none are saved.
- A separate test database (`TEST_DATABASE_URL`), emptied before every test.
- `seed.py`: replaces all workouts with 40 sample workouts.

## Decisions

- `duration_min` is an `integer`. The API rejects `30.5` with a `400`; otherwise the database would silently round it to `31`.
- `distance_km` is a `double precision`, so `5.0` stays a number in JSON (`Numeric` would turn it into the string `"5.00"`).
- The API still checks every rule before the database does: database errors are technical and would reach the user as a `500`.

## Lessons

- With one commit per row, a failure on row 3 left rows 1 and 2 saved. A test that sends one bad row through `db.add_workouts()` proves the rollback now.
- Tests must never use the development database. `conftest.py` switches `DATABASE_URL` before `db.py` is imported.

## Setup (once, without Docker)

```sql
-- psql -U postgres
CREATE ROLE workouts_app WITH LOGIN PASSWORD 'your-password';
CREATE DATABASE workouts OWNER workouts_app;
CREATE DATABASE workouts_test OWNER workouts_app;
```

Copy `backend/.env.example` to `backend/.env`, fill in the password, then from `backend/`:

```powershell
$env:DATABASE_URL = "<the workouts_test URL>"
alembic upgrade head          # schema in the test database
Remove-Item Env:DATABASE_URL
alembic upgrade head          # schema in the development database
pytest
```

Rebuild from scratch: `alembic downgrade base`, `alembic upgrade head`, `python seed.py`.
