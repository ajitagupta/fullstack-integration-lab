# 05 — Submit & validate workouts

**Why it matters:** user input is the one thing in the app you don't control. It has to be checked in the browser for a good experience, and again on the server, because the browser can be bypassed.

**Key question:** *"The request was saved, but the response got lost. What does the user see?"*

| | |
|---|---|
| Status | Session 1 of 4 done |
| New route | `/workouts/new` |
| New files | `src/forms/validate-workout.ts`, `src/forms/validate-workout.test.ts`, `src/forms/WorkoutForm.tsx` |

---

## Session 1: Accessible, typed form + client validation

### The rules, taken from the backend

The client mirrors the server. It's never stricter, so it can't reject something the API would accept.

| Field | Rule | Enforced by |
|---|---|---|
| sport | one of `SPORTS` (run, swim, cycle, badminton, strength, rest) | DB + API |
| distance | **required** for run, swim, cycle; if given: a number ≥ 0 | DB + API |
| duration | **required** except for rest; if given: a **whole** number ≥ 0 | DB + API (whole number: API only) |

"Not required" means optional, not forbidden: a rest day *with* a distance is valid.

### `validateWorkout`: a pure function

```ts
validateWorkout(values: WorkoutFormValues): FieldErrors
```

- **Input:** the form values, always **strings** (`"5.2"`, `""`). An empty string means "not given".
- **Output:** one message per field, e.g. `{ distance: "Distance is required for run, swim and cycle." }`. `{}` means valid.
- **Same shape as the API's errors** (`field` → message). In session 2, server errors go into the same places on the form.
- **No React inside,** so it's tested directly with Vitest (8 tests).

### The form

- `<select>` for sport, built from `SPORTS`, so the list stays in sync with the types.
- `<input type="number">` for distance (`step="any"`) and duration (`step="1"`), with the unit in the label.
- **One `handleChange`** for all fields, using the input's `name`.
- **Errors appear only after the first submit,** then update live as the user fixes them.
- **Accessibility:** every input has a `<label>`; an invalid field gets `aria-invalid`, and `aria-describedby` points to its error text, so screen readers read the message when the field gets focus. `noValidate` turns off the browser's own popups.
- Tested with the mouse and with the **keyboard only**.

### Bug found

All 8 new tests failed with `Cannot read properties of undefined (reading 'includes')`. `SPORTS` was declared in `workout-types.ts` but **not exported**.

**Why TypeScript didn't catch it:** Vitest strips types **without checking them**, for speed. A missing export doesn't stop the test run; it becomes `undefined` at runtime. (The editor does show it as an error.)

### Open for session 2

The form values are still strings (`{ sport: 'run', distance: '5.2', duration: '33' }`). Before sending, they have to become the API's format: numbers, and nothing for an empty optional field.

---

## Session 2: Server validation + field-error mapping

_(next)_

## Session 3: Submission state, duplicate clicks, success feedback

_(planned)_

## Session 4: The lost-response scenario

_(planned)_