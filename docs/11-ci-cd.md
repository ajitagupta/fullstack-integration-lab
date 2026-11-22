# 11 - CI/CD

GitHub Actions runs all tests on every push, and deploys only when they pass. Workflow: `.github/workflows/ci.yml`.

## The jobs

| Job | What it does |
|---|---|
| `backend` | Starts a throwaway PostgreSQL, runs the migrations and 62 pytest tests, checks that `contracts/` is committed |
| `frontend` | `npm ci`, `npm audit` for shipped packages, lint, 32 Vitest tests, build |
| `e2e` | Starts `db` and `api` with Docker Compose, runs the 5 Playwright journeys |
| `deploy` | Only on `main`, after `e2e`: deploys the API on Render, waits until `/health` reports the new commit, then deploys the frontend on Vercel |

`backend` and `frontend` run in parallel. Pull requests run the tests but never deploy.

## Decisions

- **Backend before frontend.** A new frontend may need an endpoint the old API doesn't have (that happened in milestone 09).
- **`/health` reports the running commit** (`RENDER_GIT_COMMIT`), so the deploy job knows when the new API is live.
- **Render and Vercel no longer deploy on their own.** CI calls their deploy hooks. The hook URLs are GitHub secrets.
- **`npm audit --omit=dev`:** checks only packages that reach the browser. Currently 0 findings.

## Lessons from the first runs

- `conftest.py` refused to run without `TEST_DATABASE_URL`. That guard is intended; CI now sets the variable.
- In CI, the database is reached at `localhost`, not `db`: the steps run on the machine, not in the Compose network.
- `pytest -cov` (one dash) means something else; it's `--cov`.
- The audit step first ran in the repo root, where there is no `package-lock.json`.

## Rollback

- **A broken commit doesn't reach users:** in a drill, a renamed form label failed the frontend tests, and `e2e` and `deploy` were skipped. `git revert` undid it through the normal pipeline.
- **If something bad is already live:**
  1. roll back in the dashboards, Vercel first, then Render
  2. `git revert` the commit, so the next deploy doesn't bring it back

## Known lint warnings

Seven warnings, no errors. Five are about setting state inside effects (the loading pattern used on purpose), one suggests a dependency that would cause a request loop, one is about hot reload. They are left as they are.

## Not done

- Migrations are still run by hand against Neon.
- Python packages are not audited.
