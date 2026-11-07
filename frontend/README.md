# 12 — End-to-End Testing

The capstone: testing the **whole running app** through a **real browser**,
the way a user actually experiences it — with **Playwright**. Where component
tests (concept 11) verify pieces in isolation, E2E verifies the pieces working
*together* across a complete user journey.

## Run it

```powershell
cd 12-e2e-testing
npm install
npm install react-router-dom      # the app-under-test (reused from concept 08)
npm init playwright@latest         # scaffolds config, example test, browsers
npx playwright test                # headless
npx playwright test --headed       # watch it drive a real browser
npx playwright test --ui           # interactive debugging UI
```

## Component test vs E2E test — the core distinction

- **Component test (11):** renders **one component** in a **fake DOM**
  (jsdom), in **isolation**. No routing, no real browser, no server. Answers
  "does this piece work by itself?"
- **E2E test (12):** drives a **real browser** through the **whole running
  app** — routing, navigation, URL changes, rendering, interaction all at
  once. Answers "do the pieces work *together*, as a user experiences them?"

E2E verifies **integration** — that the parts connect into a working flow —
which component tests can't, because they test parts in isolation by design.

## Setup that makes it "end-to-end"

Two config pieces in `playwright.config.ts`:

```ts
use: {
  baseURL: 'http://localhost:5173',   // navigate with relative paths
},

webServer: {
  command: 'npm run dev',             // START the real app before testing
  url: 'http://localhost:5173',       // wait until it responds
  reuseExistingServer: !process.env.CI,
},
```

**`webServer` is the essence of E2E:** it *starts your actual app running*,
because an E2E test drives a real browser against a real, running app — the
app has to actually be served somewhere for the browser to load it. A
component test needs no server (it renders the component itself); E2E needs
the whole app **running**. That requirement *is* what makes it end-to-end.

## A user journey

The real payoff — a multi-step path through the whole app:

```ts
import { test, expect } from '@playwright/test';

test('user can navigate to a workout detail page', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('link', { name: 'Workouts' }).click();
  await expect(page).toHaveURL('/workouts');

  await page.getByRole('link', { name: 'swim' }).click();

  await expect(page).toHaveURL('/workouts/1');
  await expect(page.getByText('Workout #1')).toBeVisible();
});
```

This one test exercises the entire routing system (concept 08) — nav links,
route matching, URL params, detail rendering — **working together** in a real
browser. No component test could verify this; it needs the whole routed app
running.

- `page.goto('/')` — loads the real app at `baseURL`.
- `page.getByRole('link', { name })` — finds elements by role, the way a user
  (and assistive tech) perceives them. Same user-centric query philosophy as
  React Testing Library in concept 11 — that instinct transfers directly.
- `expect(page).toHaveURL(...)` — asserts the URL changed (tests routing
  end-to-end).
- `toBeVisible()` — asserts the element is actually shown.

## Setup gotchas hit

- **`Cannot find name 'process'`** — Playwright's config runs in Node, but a
  Vite project has no Node types by default. Fix: `npm i -D @types/node` and
  add `"node"` to `types` in the Node-side tsconfig. (Same category as concept
  11's jest-dom type error — tell TypeScript about the environment.)
- **`Missing script: "start"`** — the scaffolder defaults `webServer.command`
  to Create-React-App's `npm run start`. Vite uses **`npm run dev`** on port
  **5173** (not 3000). Match both to Vite.
- **The example test** (`tests/example.spec.ts`) tests Playwright's own site —
  delete it so only your tests run. Playwright also runs across 3 browsers by
  default (chromium/firefox/webkit); trim the `projects` array while learning.

## What I learned

> - How is an E2E test fundamentally different from a component test?
> - Why does E2E need the app actually running (the `webServer` config)?
> - What does an E2E journey verify that isolated component tests can't?
> - How did your work Playwright experience transfer here?

## Concepts touched

Playwright, end-to-end testing, real browser vs jsdom, testing the running
app vs isolated components, `webServer` and `baseURL` config, user journeys,
`page.goto` / `getByRole` / `toHaveURL` / `toBeVisible`, headed vs headless,
integration testing, the Node-types and Vite-command setup gotchas.
