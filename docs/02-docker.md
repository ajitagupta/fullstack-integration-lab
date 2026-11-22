# 02 - Docker

The frontend, the API and PostgreSQL run as three containers, defined in `docker-compose.yml`. Only Docker needs to be installed.

## Services

| Service | Port on the laptop | Notes |
|---|---|---|
| `web` | 5173 | Vite dev server; `./frontend` is mounted, so changes reload live |
| `api` | 5000 | Gunicorn (one worker, four threads); code is copied into the image, so rebuild after changes |
| `db` | 5433 | `postgres:18`; data in the volume `db-data`. 5433 because a local PostgreSQL uses 5432 |

## Commands

Run from the repo root.

| Command | What it does |
|---|---|
| `docker compose up --build` | Build and start everything |
| `docker compose up -d --build api` | Rebuild only the API after code changes |
| `docker compose logs -f api` | Follow the API's logs |
| `docker compose exec api alembic upgrade head` | Run migrations |
| `docker compose exec api python seed.py` | Replace all workouts with sample data (**deletes data**) |
| `docker compose down` | Stop and remove the containers, keep the data |
| `docker compose down -v` | Also delete the database volume (**deletes everything**) |

## Lessons

- Inside a container, `localhost` is the container itself. Containers reach each other by service name (`db:5432`).
- Flask and Vite must listen on `0.0.0.0`, or Docker can't forward requests to them.
- PostgreSQL sets its password only when the volume is created. Changing `POSTGRES_PASSWORD` later has no effect until `down -v`.
- `depends_on` alone waits for the container to start, not for PostgreSQL to be ready. A health check (`pg_isready`) fixes that.
- File changes in Windows folders don't reach Linux containers, so Vite uses polling inside Docker.
- One Gunicorn worker, because the list cache lives in memory: with two workers, a write would clear the cache in only one of them.
- The APScheduler job from the Python lab never ran in the container and was removed.

## Checked

- The data survives `docker compose down` and `up`.
- A fresh clone in another folder starts with only `.env.example` and the commands above.
