# 05 - Forms and validation

Add, edit and delete workouts, with validation in the browser and on the server.

## What was built

- `POST`, `PUT` and `DELETE /workouts`, sharing one validation function on the server.
- `validateWorkout()` in the browser: the same rules, so the form never rejects what the API would accept.
- One form for adding and editing (`/workouts/new`, `/workouts/:id/edit`).
- Errors next to each field, after the first submit. Server errors are mapped back to the field (`distance_km` → Distance).
- Accessible fields: a label for every input, `aria-invalid`, `aria-describedby` pointing to the error.
- While saving: the button is disabled and a second click is ignored. On failure, the input stays.
- Delete with an inline "Yes, delete / Cancel".

## Decisions

- **A lost answer:** if the server saved the workout but the answer never arrived, the form can't know. It shows "We couldn't confirm the save. Check your workouts before trying again." instead of "failed", so the user doesn't create a duplicate.
- **A `404` on delete counts as done:** the workout is gone either way.
- **`PUT` replaces the whole workout:** a missing distance means "no distance".
- **Writes are not cancelled:** cancelling only stops the browser from waiting; the server still saves.

## Lessons

- `setSaving(false)` belongs in `finally`, or a failed request leaves the button stuck on "Saving…".
- Vitest doesn't type-check, so a missing `export` showed up as `undefined` at runtime.
- Hooks like `useNavigate()` must be called at the top of the component, not inside a handler.
- A `204` has no body: `request()` must not try to parse JSON from it.
- `pytest` tests the code in the folder; the Docker container runs its last build. Rebuild after backend changes.
- The update test caught a slip: `update_workout` set `distance_km` twice and never `duration_min`.

## Tests

Backend 23, frontend 14 at the end of this milestone.
