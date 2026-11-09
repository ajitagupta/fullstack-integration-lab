# 02 — Run the system with Docker

The frontend (Vite), the Flask API and PostgreSQL run as three containers, defined in `docker-compose.yml` in the repo root. Nothing needs to be installed on the laptop except Docker.

## Setup
```
         YOUR LAPTOP                             DOCKER
┌───────────────────────────┐     ┌──────────────────────────────────┐
│ Browser                   │     │ web container                    │
│   → localhost:5173 ───────┼────▶│   Vite :5173                     │
│                           │     │                                  │
│                           │     │ api container                    │
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
| `docker-compose.yml` | Defines the `api`, `db` and `web` services, ports, the database health check and the `db-data` volume |
| `.env` (repo root, not committed) | `POSTGRES_PASSWORD` for Compose |
| `frontend/Dockerfile` | Vite dev server in Node 24-slim, listening on `0.0.0.0` |
| `frontend/.dockerignore` | Keeps the Windows `node_modules`, `dist` and test output out of the image |
| `.env.example` (repo root) | Documents `POSTGRES_PASSWORD` for a fresh clone |
| `frontend/vite.config.ts` | Enables file polling when `VITE_USE_POLLING=true` |

## Services
| Service | Image | Published port (laptop) | Internal port | Notes |
|---|---|---|---|---|
| `api` | built from `./backend` | 5000 | 5000 | `DATABASE_URL` points to `db:5432` |
| `db` | `postgres:18` | 5433 | 5432 | 5433 because the local PostgreSQL uses 5432; data in volume `db-data` |
| `web` | built from `./frontend` | 5173 | 5173 | Bind mount `./frontend:/app` for live reload; `/app/node_modules` keeps the container's own packages |

## Key concepts
- **Image vs. container:** the image is the blueprint built from the `Dockerfile`; a container is a running instance of it. Containers are replaced often; images are rebuilt when code changes.
- **Dependencies before code:** `requirements.txt` is copied and installed before the rest of the code, so Docker's cache skips the reinstall when only code changes.
- **Configuration at runtime:** `.env` is not in the image. `DATABASE_URL` is passed when the container starts, so the same image can run against any database.
- **`localhost` inside a container** is the container itself. Containers reach each other by **service name** (`db`) on the **internal** port (5432). Published ports (5000, 5173, 5433) are only for access from the laptop.
- **`0.0.0.0`:** Flask and Vite must listen on all interfaces, otherwise requests forwarded by Docker are refused.
- **Separate containers** for API and database: the API is rebuilt often, the database keeps its data; this mirrors production (Render + Neon).

## Commands
Run from the repo root.

| Command | What it does | Deletes data? |
|---|---|---|
| `docker compose up --build` | Build the images and start all three services | No |
| `docker compose logs -f api` | Follow a service's logs (`db`, `web` likewise) | No |
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
- **Health check:** `pg_isready` runs every 5 s; the API waits for `condition: service_healthy`, so it never starts before PostgreSQL accepts connections.
- **Live reload on Windows:** file-change notifications from Windows folders don't reach Linux containers. Vite uses polling inside Docker only (`VITE_USE_POLLING=true` in Compose, read in `vite.config.ts`).
- **Bind mount vs. image copy:** the bind mount overrides the code copied into the image, so edits appear without rebuilding; `node_modules` is excluded from the mount so the container keeps its Linux packages.

## Verification
- **Data survives container replacement:** 40 workouts before `docker compose down`, 40 after `up -d`. The data lives in the `db-data` volume, not in the container.
- **Fresh-clone test:** a clone into a separate folder (`fresh-clone-test`) started with only `.env.example` and the documented commands; API and frontend worked. Cloned into a different folder name so Compose created a separate volume.