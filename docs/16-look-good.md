# 16 — Look good

**Why it matters:** the interface is the first thing anyone sees. A tracker that works well but looks like a raw HTML page doesn't get used, and doesn't show the care that went into the rest.

**Key question:** *How do you restyle a whole app without touching how it works?*

| | |
|---|---|
| Status | Done (1 session) |
| Library | Bootstrap 5 (CSS only) |
| Theme colour | Teal `#0f766e`, the same as the milestone map |

---

## What changed

| Area | Before | After |
|---|---|---|
| Layout | Links in a row, separated by `\|` | A teal navbar with the active page highlighted, a centred container, a footer with the connection status |
| Home | "Welcome to the Home Page" | A short pitch, two main actions, this week's totals, and cards for the three ways to add workouts |
| Workouts | One line of text per workout | A list of full-width rows with a sport icon in the sport's colour, filters in a toolbar, Previous/Next buttons |
| Details | Plain text and outlined buttons | A card with the sport icon, distance and time as large numbers, Edit/Delete, and the delete confirmation as an alert |
| Forms | Unstyled inputs, red text below | Bootstrap fields, red borders and messages for errors, a full-width save button |
| Quick add, Import | Unstyled text area and file picker | Inputs and previews in cards; status badges (OK, Already imported) in the preview table; on Quick add, clickable examples ("+ ran 5 km in 30 min") that add a line |
| Stats | Two charts one below the other | Two charts side by side in cards on wide screens |
| Messages | Plain paragraphs | Alerts: red for errors, yellow for "couldn't confirm", green for success; spinners while loading |

## Decisions

- **Bootstrap's CSS classes, no component library.** The pages keep their own JSX and logic; only class names change. One dependency instead of two, and the markup stays readable.
- **Only the markup changed.** State, effects, request cancellation, validation and error handling are untouched, and the existing component tests stayed as they were.
- **The theme through CSS variables.** `--bs-primary` and the button variables are set once in `index.css`. Bootstrap's buttons have their colours fixed per class, so `.btn-primary` and `.btn-outline-primary` are set explicitly.
- **Vite's template styles removed.** `index.css` contained the Vite starter theme (purple accent, centred text, 56 px headings), which fought with Bootstrap. It now holds only the teal theme. `App.css` was removed; its one remaining rule (`.row-invalid`) moved to `index.css`.
- **One colour and icon per sport, shared** (`sports.ts`): the chart, the list and the details page use the same colours, so a run is teal everywhere.
- **The mobile menu without Bootstrap's JavaScript.** One `useState` toggles the collapsed navbar on narrow screens; `aria-expanded` tells screen readers whether it's open.
- **`NavLink` instead of `Link`** in the navbar: it marks the current page as `active`. `end` stops "Workouts" from also lighting up on `/workouts/new`.
- **Errors visible to eyes and screen readers alike:** a field gets `is-invalid` (red border) exactly when it gets `aria-invalid`, and the message keeps its `id` for `aria-describedby`.
- **The home page never waits for the API.** This week's totals appear when the stats arrive; while Render wakes up, the rest of the page works without them.

## Bugs found

- **A link outside the navigation:** "Quick add" sat after the closing `</nav>` tag, so it was outside the navigation landmark. The new navbar builds all links from one list.
- **Units hidden from screen readers:** the first version moved "km" and "min" out of the labels into boxes next to the fields. Those boxes are only visual, so a screen reader would have announced just "Duration". The component tests find fields by their label (`getByLabelText("Duration (min)")`) and failed. The units went back into the labels; the tests were right and stayed unchanged.
- **An unused import broke the build:** after the colours moved to `sports.ts`, `WeeklyChart.tsx` still imported the type `Sport`. `npm run build` (with `noUnusedLocals`, like Vercel) rejected it.
- **A blank details page:** the new markup used `SPORT_COLORS` and `SPORT_ICONS` without importing them. React stopped rendering, and the browser console named the missing variable.

## Verified

- Every page checked in the browser, at full width and at phone width (menu collapsed into ☰, cards and charts stacked).
- `npm test` and `npm run build` pass.