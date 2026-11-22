# 11 — CI/CD and rollback

**Why it matters:** until now, the tests ran only when someone remembered to start them, and Render and Vercel deployed every push on their own: red or green, in any order. Milestone 09 showed where that leads: deploys that had silently stopped, and a new frontend talking to an old API.

**Key question:** *How does a change get from the laptop to users, and what stops a broken one on the way?*

| | |
|---|---|
| Status | Done (5 sessions) |
| Workflow | `.github/workflows/ci.yml`, on every push to `main` and every pull request |
| Jobs | `backend` and `frontend` in parallel → `e2e` → `deploy` |
| Duration | About 1.5 minutes for the tests; the deploy adds Render's build time |

---

## The pipeline

```
push to main
   │
   ├── backend ── pytest against a throwaway PostgreSQL, built by the real migrations
   │              contracts/ unchanged?
   │
   ├── frontend ─ npm ci · audit of shipped packages · lint · Vitest · type check and build
   │
   └──► e2e ───── db and api from docker-compose.yml · 5 Playwright journeys in Chromium
           │
           └──► deploy ── Render deploy hook → wait until /health reports this commit
                           → Vercel deploy hook
```

Every job starts on a fresh Ubuntu machine. Nothing carries over from the laptop: no installed packages, no `.env`, no database. Whatever the code needs has to be in the repo or in the workflow.

---

## Session 1: The backend job

| Piece | What it does |
|---|---|
| `services: db` with `postgres:18` | A PostgreSQL container next to the job, the same version as in `docker-compose.yml`; its health check makes the steps wait until the database accepts connections |
| `DATABASE_URL` and `TEST_DATABASE_URL` | Both point to that database at `localhost`: the first for `alembic upgrade head`, the second for `conftest.py` |
| `defaults.run.working-directory: backend` | Every step starts in `backend/`, where Alembic finds its `script_location` |
| `alembic upgrade head` | The tests run against the schema the migrations build, so a broken migration fails here |
| `pytest --cov` | 62 tests with the coverage report in the log |
| `cache: pip` | Packages are reused between runs |

**`ci:ci` in the URL is not a secret.** The database exists for one run on GitHub's machine and is deleted with it. Production connection strings never appear in the workflow.

### What the first runs taught

| Failure | Cause | Fix |
|---|---|---|
| `KeyError: 'TEST_DATABASE_URL'`, exit code 4 | `conftest.py` refuses to run without a test database, on purpose, so the tests can never touch development or production data | Set `TEST_DATABASE_URL` in the job; the guard stays |
| (would have been next) `-cov` | One dash means `-c ov`, "read the config file `ov`" | `--cov` |
| The host `db` | `db` is a name inside the Compose network; the job's steps run on the machine itself and reach the service through its published port | `localhost` |
| Warning: Node.js 20 is deprecated | Older major versions of the GitHub actions | `actions/checkout@v5`, `actions/setup-python@v6`, `actions/setup-node@v6` |

## Session 2: The frontend job

| Step | Why |
|---|---|
| `npm ci` | Installs exactly what `package-lock.json` says, and fails if it disagrees with `package.json`; no silent upgrades on the build machine |
| `npm run lint` | oxlint; only errors fail the job |
| `npx vitest run --coverage` | 33 tests, including the contract test, which reads the committed `contracts/` files and needs no backend |
| `npm run build` | `tsc -b` type-checks the app, the unit tests and the Playwright journeys, then Vite builds |

**The contracts guard** (in the backend job): pytest rewrites `contracts/` from the real API, then `git diff --exit-code ../contracts` fails if the files differ from the committed ones. A response changed in Flask without the new contract files committed would otherwise leave the frontend's contract test checking an outdated copy. This only works because the files are stable: values that depend on the date are fixed before saving (milestone 10).

**Known lint warnings (7, not errors):**
- `set-state-in-effect` (5×): the loading pattern used on purpose: an effect resets the loading and error state, starts a fetch and aborts it on cleanup. Removing it properly means a data-fetching library, a change of its own.
- `exhaustive-deps` on `load` in `WorkoutsPage`: `load` is created on every render; adding it to the dependencies as suggested would refetch on every render, a request loop.
- `only-export-components`: `PreviewTable.tsx` exports a helper next to the component, which only affects hot reload.

**A detail that worked by accident:** `npx vitest run test` reads `test` as a filter ("only files whose path contains `test`"). It matched every file, so nothing was skipped, but a differently named test file would have been. The command is now `npx vitest run --coverage`.

## Session 3: The journeys in CI

| Step | Why |
|---|---|
| `POSTGRES_PASSWORD: ci` at job level | Compose reads it from the environment in CI instead of the uncommitted `.env` |
| `docker compose up -d --build --wait db api` | The same `docker-compose.yml` as locally, no second setup to keep in sync; `--wait` returns once `db` is healthy and `api` is running |
| `docker compose exec -T api alembic upgrade head` | Migrations inside the API container, as locally; `-T` because CI has no terminal |
| `curl --fail --retry 10 --retry-connrefused --retry-delay 2 …/ready` | Waits until Flask answers **and** reaches the database, using `/ready` from milestone 09 |
| `npx playwright install --with-deps chromium` | Only the browser the config uses, plus its Linux libraries |
| `npm run test:e2e` | The 5 journeys |
| `upload-artifact` with `if: failure()` | The HTML report is attached to a failed run, with the step where each journey stopped |

- **The `web` container isn't started.** With `CI` set, `playwright.config.ts` starts `npm run dev` itself (`reuseExistingServer: !process.env.CI`); a `web` container on port 5173 would block it.
- **`needs: [backend, frontend]`:** the slow job only starts once the fast ones are green.
- **Settings from the Playwright template take effect in CI:** `retries: 2`, `workers: 1`, `forbidOnly`.

## Session 4: Deploy from CI, backend first

### Before

Render and Vercel each deployed every push to `main` by themselves, without waiting for any test and without any order between them.

### After

| Change | Where |
|---|---|
| Render's automatic deploy turned off; a **deploy hook** (a secret URL that starts a deploy) saved as the GitHub secret `RENDER_DEPLOY_HOOK` | Render settings, GitHub secrets |
| Vercel's automatic deploys turned off for `main` only; preview deploys for other branches stay | `frontend/vercel.json`: `"git": { "deploymentEnabled": { "main": false } }` |
| A Vercel deploy hook for `main`, saved as `VERCEL_DEPLOY_HOOK` | Vercel settings, GitHub secrets |
| `/health` reports the running commit: `{"status": "ok", "version": "<commit>"}` from `RENDER_GIT_COMMIT`, `"local"` elsewhere | `backend/app.py` |
| A `deploy` job | `ci.yml` |

```yaml
  deploy:
    needs: [e2e]
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    concurrency: production
```

1. Calls the Render hook.
2. Asks `/health` every 10 seconds, for up to 10 minutes, until `version` equals the commit being deployed (`$GITHUB_SHA`). Render keeps serving the old version while it builds, and the old version also answers "ok", so only the commit tells old from new.
3. Calls the Vercel hook.

### Decisions

- **Backend before frontend.** An older frontend works with a newer API (new fields are ignored, the API keeps its contract), but a new frontend may call an endpoint the old API doesn't have, exactly what happened in milestone 09 with `/ready`.
- **Pull requests run every test but never deploy** (`if:` on the event and the branch).
- **One deploy at a time.** `concurrency: production` makes a second push wait instead of racing the first.
- **Hook URLs are secrets.** They live only in GitHub's secrets and reach `curl` through an environment variable; the logs show `***`.
- **A deploy that doesn't arrive fails loudly.** If Render never reports the new commit, the job fails after 10 minutes, instead of a silent gap like the two days in milestone 09.

## Session 5: Rollback and dependencies

### Drill: a broken commit doesn't reach users

A label changed from "Distance (km)" to "Distance" and pushed. The frontend job failed (`Unable to find a label with the text of: Distance (km)`), `e2e` and `deploy` were skipped, and `/health` on Render kept reporting the previous commit. The change was undone with `git revert HEAD`, a new commit that went through the whole pipeline like any other.

### When something bad is already live

| Step | How | Why |
|---|---|---|
| 1. Restore the last good version right away | Vercel: Deployments → an earlier production deploy → **Instant Rollback**. Render: the service's deploys → an earlier one → **Rollback** | No fix needs to be written first. **Frontend first, then backend**, the reverse of deploying, so a new frontend never talks to an old API |
| 2. Undo the cause in Git | `git revert <bad commit>`, push | A dashboard rollback is temporary: the next deploy ships the latest `main` again, bug included |

`git revert` instead of `git reset`: the history keeps the bad commit and its undoing, nothing is rewritten on a shared branch, and the fix is tested before it's deployed.

### Known vulnerabilities

```
npm audit --omit=dev --audit-level=high
```

A step in the frontend job. `npm audit` compares the installed versions with published security advisories. Nothing new has to be installed for a finding to appear: an advisory for a version already in `package-lock.json` can be published at any time.

- **`--omit=dev`** checks only the packages that ship to the browser (React, React Router, Recharts, Bootstrap). Currently: **0 vulnerabilities**.
- **`--audit-level=high`** fails only on high and critical findings.
- The full `npm audit` reports findings in development tools (build, tests, linting), which never reach users and need major upgrades to fix; they're left for the next dependency update.

---

## Known limits

- **Migrations are still applied by hand** from the laptop against Neon (milestone 04). A change that needs a new column must be migrated before its backend is deployed; the pipeline doesn't do it.
- **The backend's Python packages aren't audited.** GitHub's Dependabot alerts would cover `requirements.txt` as well.
- A deploy takes as long as Render's build on the free tier, a few minutes.

## Summary

**Key question answered:** *How does a change get from the laptop to users, and what stops a broken one?* Through one pipeline: every push runs the backend and frontend tests, the contract check and the browser journeys; only if all are green does it deploy, backend first, and the frontend only once the API reports the new commit. A broken commit stops at the first red job, as the drill showed; something that slips through is rolled back in the dashboards and reverted in Git.

| Session | Result |
|---|---|
| 1 | Backend job: migrations and 62 tests against a throwaway PostgreSQL |
| 2 | Frontend job: lint, 33 tests, type check and build; the contracts guard |
| 3 | The 5 Playwright journeys in CI, with the stack from Docker Compose |
| 4 | Deploys only after green tests, backend first, confirmed through `/health` |
| 5 | A blocked broken commit; the rollback recipe; an audit of shipped packages |