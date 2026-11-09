# 02 — Run the system with Docker

The Flask API and PostgreSQL run as two containers, defined in `docker-compose.yml` in the repo root. Nothing needs to be installed on the laptop except Docker.

## Setup
```
         YOUR LAPTOP                             DOCKER
┌───────────────────────────┐     ┌──────────────────────────────────┐
│ Browser                   │     │ api container                    │
│   → localhost:5000 ───────┼────▶│   Flask :5000                    │
│                           │     │     │                            │
│                           │     │     │ db:5432 (internal)         │
│                           │     │     ▼                            │
│ psql                      │     │ db container                     │
│   → localhost:5433 ───────┼────▶│   PostgreSQL :5432               │
│                           │     │     │                            │
│ (local PostgreSQL         │     │     ▼                            │
│  still on :5432)          │     │ volume: db-data                  │
└───────────────────────────┘     └──────────────────────────────────┘
```

## Files
| File | Purpose |
|---|---|
| `backend/Dockerfile` | Builds the API image: Python 3.14-slim, dependencies, code, Flask on `0.0.0.0:5000` |
| `backend/.dockerignore` | Keeps `.venv`, `.env`, `__pycache__`, `.pytest_cache` out of the image |
| `docker-compose.yml` | Defines the `api` and `db` services, ports and the `db-data` volume |
| `.env` (repo root, not committed) | `POSTGRES_PASSWORD` for Compose |

## Services
| Service | Image | Published port (laptop) | Internal port | Notes |
|---|---|---|---|---|
| `api` | built from `./backend` | 5000 | 5000 | `DATABASE_URL` points to `db:5432` |
| `db` | `postgres:18` | 5433 | 5432 | 5433 because the local PostgreSQL uses 5432; data in volume `db-data` |

## Key concepts
- **Image vs. container:** the image is the blueprint built from the `Dockerfile`; a container is a running instance of it. Containers are replaced often; images are rebuilt when code changes.
- **Dependencies before code:** `requirements.txt` is copied and installed before the rest of the code, so Docker's cache skips the reinstall when only code changes.
- **Configuration at runtime:** `.env` is not in the image. `DATABASE_URL` is passed when the container starts, so the same image can run against any database.
- **`localhost` inside a container** is the container itself. Containers reach each other by **service name** (`db`) on the **internal** port (5432). Published ports (5000, 5433) are only for access from the laptop.
- **`0.0.0.0`:** Flask must listen on all interfaces, otherwise requests forwarded by Docker are refused.
- **Separate containers** for API and database: the API is rebuilt often, the database keeps its data; this mirrors production (Render + Neon).

## Commands
Run from the repo root.

| Command | What it does | Deletes data? |
|---|---|---|
| `docker compose up --build` | Build the API image and start both services | No |
| `docker compose exec api alembic upgrade head` | Run migrations inside the API container | No |
| `docker compose exec api python seed.py` | Replace all workouts with the 40 sample workouts | **Yes** (truncates the table) |
| `docker compose stop` / `start` | Stop / start containers, keep them | No |
| `docker compose down` | Remove containers and network, keep the volume | No |
| `docker compose down -v` | Remove containers **and the volume** | **Yes, everything** |

## Lessons learned
- PostgreSQL sets the user's password **only on first initialisation** of an empty volume. Changing `POSTGRES_PASSWORD` later has no effect until the volume is removed (`down -v`).
- Compose reads `.env` from the folder of `docker-compose.yml`; a missing variable becomes an empty string with only a warning.
- `depends_on` waits for the database **container** to start, not for PostgreSQL to be **ready** (the API started ~40 log lines before the database was ready).
- The APScheduler job does not run in the container: it starts only with Flask's debug reloader (`WERKZEUG_RUN_MAIN`). To be revisited in milestone 11.

## Open
- **Session 3:** frontend container; health check so the API waits until the database is ready.
- **Session 4:** `.env.example` for the root; fresh-clone test; prove data survives container replacement.