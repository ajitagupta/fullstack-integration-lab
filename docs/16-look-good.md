# 16 - Look and feel

The app was restyled with Bootstrap 5 and a teal theme (`#0f766e`). Only the markup changed; state, requests and validation stayed the same.

## What changed

- A navbar with the active page highlighted, collapsing into a menu on phones.
- A home page with this week's totals and the three ways to add workouts.
- The list as rows with a sport icon and colour; the details page as a card.
- Forms, Quick add and Import in cards, with red borders for errors and badges in the preview table.
- Alerts for errors, warnings and success; spinners while loading.
- The two charts side by side on wide screens.

## Decisions

- Bootstrap's CSS classes only, no component library.
- The theme colour is set once with CSS variables in `index.css`.
- One colour and icon per sport in `sports.ts`, used by the list, the details page and the charts.
- The mobile menu uses one `useState` instead of Bootstrap's JavaScript.
- A field gets the red border (`is-invalid`) exactly when it gets `aria-invalid`.

## Lessons

- Moving "km" and "min" out of the labels hid them from screen readers. The component tests, which find fields by label, caught it.
- An unused import broke `npm run build`, which treats unused variables as errors, like Vercel.
- A blank page: the new markup used `SPORT_ICONS` without importing it. The browser console named it.

All pages were checked at full width and at phone width.
