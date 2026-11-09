# 01 — Migrate persistence to PostgreSQL

The Flask API moved from a local SQLite file to PostgreSQL 18, with SQLAlchemy as the ORM and Alembic for versioned migrations. The API's behaviour stayed the same: all baseline tests written against SQLite pass against PostgreSQL.

## Decisions

### Database library: SQLAlchemy ORM
I chose SQLAlchemy 2.0 (ORM) with psycopg 3 as the driver, to learn an ORM, accepting a larger rewrite of `db.py` than a plain driver would have needed. To keep the API's behaviour unchanged, the function names and return values of `db.py` stayed the same; only their insides changed. `app.py` was not touched apart from removing `init_db()`.

### Configuration
The connection comes from `DATABASE_URL` in `backend/.env` (not committed). `.env.example` documents the variables without real values.

### Schema
| Column | Type | Null allowed | Reason |
|---|---|---|---|
| `id` | integer, generated | no | Primary key from a sequence |
| `sport` | varchar(20) | no | Every workout has a sport |
| `distance_km` | double precision | yes | Distances have decimals (1.5 km); `Numeric` would turn `5.0` into the string `"5.00"` in JSON |
| `duration_min` | integer | yes | Durations are whole minutes |

### Whole minutes
`duration_min` is stored as whole minutes. The API rejects fractional values like `30.5` with `400`; `30.0` is accepted. Without this check, the `integer` column would silently round `30.5` to `31`. As a result, `GET` now returns `30` instead of `30.0`.

### Migrations
The schema is managed by Alembic (`backend/migrations/`). `init_db()` was removed, so only one place defines the schema. Applied migrations are recorded in the `alembic_version` table.

## Constraints
| Name | Rule |
|---|---|
| `ck_workouts_sport_allowed` | `sport` is one of swim, run, cycle, strength, badminton, rest |
| `ck_workouts_distance_non_negative` | `distance_km` is empty or ≥ 0 |
| `ck_workouts_duration_non_negative` | `duration_min` is empty or ≥ 0 |
| `ck_workouts_distance_required` | Run, swim and cycle need a distance |
| `ck_workouts_duration_required` | Every sport except rest needs a duration |

Each constraint is named, so a rejected row shows which rule failed, e.g. `violates check constraint "ck_workouts_distance_required"`.

## Server validation vs. database constraints
| Rule | API (`create_workout` / `validate_data`) | Database |
|---|---|---|
| Body is valid JSON | ✅ | — |
| `sport` present and not empty | ✅ | `NOT NULL` |
| `sport` is one of the six allowed | ✅ | `ck_workouts_sport_allowed` |
| `distance_km` / `duration_min` are numbers | ✅ (clear 400 message) | Column types: technical error only |
| `duration_min` is a whole number | ✅ | ⚠️ `integer` would silently round |
| `distance_km` ≥ 0 | ✅ | `ck_workouts_distance_non_negative` |
| `duration_min` ≥ 0 | ✅ | `ck_workouts_duration_non_negative` |
| Run, swim, cycle need a distance | ✅ | `ck_workouts_distance_required` |
| Every sport except rest needs a duration | ✅ | `ck_workouts_duration_required` |

The column types already define which input the database accepts, so "must be a number" needs no extra constraint. The API still checks it first: the database's errors are technical and would reach the user as a `500`, and for whole minutes it would not even error but silently round. The API gives a clear `400`; the database is the final guarantee if a code path ever skips validation. The frontend adds client-side checks for fast feedback in milestone 05.

## Transactions and rollback
**Problem:** CSV upload and parse saved each row with its own commit. If the database failed on row 3 of 5, rows 1 and 2 stayed saved.

**Fix:** `db.add_workouts()` saves a whole batch in one transaction (`SessionLocal.begin()`): it commits only if every row succeeds and rolls back everything otherwise. Upload and parse now use it.

**Proof:** `test_failed_batch_rolls_back_completely` passes two valid workouts and one invalid one (a swim without a distance) directly to `db.add_workouts()`, bypassing API validation. The database rejects the swim with `IntegrityError`, and the two valid workouts are not saved either: the total stays the same. With per-row commits, the same test failed with 104 vs. 102, so two rows were left behind.

## Tests
14 tests pass against PostgreSQL: 3 caching tests, 8 baseline tests, 2 whole-minute tests, 1 rollback test.

## Test database
Tests run against a separate database (`workouts_test`, from `TEST_DATABASE_URL`). `conftest.py` switches `DATABASE_URL` before `db.py` is imported, and an autouse fixture empties the table (`TRUNCATE … RESTART IDENTITY`) before every test. Proof: the development database had 104 rows before and after a full test run.

## Sample data
`python seed.py` empties the development table and inserts 40 sample workouts in one transaction. `random.seed(42)` makes the data identical on every run.

## Rebuild from scratch
```powershell
alembic downgrade base
alembic upgrade head
python seed.py
```
This drops the table, recreates it with all constraints from the migration, and refills it.