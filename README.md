# Full-Stack Integration Lab

A workout tracker built to practise full-stack integration: React + TypeScript, Flask, PostgreSQL and Docker.

## Getting started (Docker)

Requirements: Docker Desktop.

```powershell
git clone https://github.com/ajitagupta/fullstack-integration-lab.git
cd fullstack-integration-lab
Copy-Item .env.example .env          # then choose your own POSTGRES_PASSWORD
docker compose up -d --build
docker compose exec api alembic upgrade head
docker compose exec api python seed.py
```

| URL | Service |
|---|---|
| http://localhost:5173 | Frontend (Vite, live reload) |
| http://localhost:5000/workouts | API (Flask) |
| `localhost:5433` | PostgreSQL (user `workouts_app`) |

### Everyday commands
| Command | What it does | Deletes data? |
|---|---|---|
| `docker compose up -d` | Start all services | No |
| `docker compose logs -f api` | Follow the API logs (`db`, `web` likewise) | No |
| `docker compose exec api alembic upgrade head` | Apply new migrations | No |
| `docker compose down` | Remove containers, keep data | No |
| `docker compose exec api python seed.py` | Replace all workouts with 40 sample workouts | **Yes** |
| `docker compose down -v` | Remove containers **and the database volume** | **Yes, everything** |

### Running the backend tests
Tests run on the host against a separate local PostgreSQL database (`workouts_test`), never against the Docker data. Setup: see [docs/01-postgresql.md](docs/01-postgresql.md).