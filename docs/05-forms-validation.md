# 05 — Submit & validate workouts

**Why it matters:** user input is the one thing in the app you don't control. It has to be checked in the browser for a good experience, and again on the server, because the browser can be bypassed.

**Key question:** *"The request was saved, but the response got lost. What does the user see?"*

| | |
|---|---|
| Status | Sessions 1–5 done · delete next |
| New routes | `/workouts/new`, `/workouts/:id/edit` |
| New files | `src/forms/validate-workout.ts`, `src/forms/validate-workout.test.ts`, `src/forms/WorkoutForm.tsx`, `src/forms/WorkoutForm.test.tsx`, `src/EditWorkoutPage.tsx`, `tsconfig.test.json` |

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

---

## Session 2: Sending the form + server errors in the form

**Key idea:** the server is the authority. Client checks are a convenience for the user; anyone can bypass them, so every rule must also hold on the server.

### Form values → API request: `toNewWorkout`

| Form (strings) | API (`NewWorkout`) |
|---|---|
| `sport: "run"` | `sport: "run"` (as `Sport`, already validated) |
| `distance: "5.2"` | `distance_km: 5.2` |
| `distance: ""` | key left out (`undefined`) |
| `duration: "33"` | `duration_min: 33` |

`NewWorkout` uses optional fields, so "not given" is `undefined`, not `null`. `JSON.stringify` drops `undefined` keys: a run without distance is sent as `{"sport":"run","duration_min":30}` (`Content-Length: 33` in the Network tab).

### Three outcomes, three places

| Outcome | Shown where |
|---|---|
| Success → the API returns the new workout | (session 3) |
| `ApiError` with a known `field` (400) | under that field |
| Anything else: network error, timeout, 500, error without a field | one message above the button (`role="alert"`) |

The API and the form use **different field names**, so server errors are mapped back:

```ts
const API_TO_FORM = { sport: "sport", distance_km: "distance", duration_min: "duration" };
```

Under each field, a client error wins over a server error (`errors[field] ?? serverErrors[field]`); the server's message shows when the client had nothing to say.

### Verified

- **Valid run** submitted from the form → stored as id 41; the total went from 40 to 41.
- **Server error path:** client validation bypassed on purpose → `POST /workouts` returned **400** with `{"field":"distance_km","error":"The key distance_km is missing."}`, and the message appeared under **Distance**.
- **Network error:** API container stopped → "Can't reach the server." above the button.
- **CORS preflight:** the Network tab shows an `OPTIONS /workouts` before the `POST`. A JSON `POST` from another origin makes the browser ask the API for permission first.

## Session 3: Saving state, double submits, success feedback

### What the user sees while saving

| Moment | UI |
|---|---|
| Saving | Button disabled and reads "Saving…" |
| A second click while saving | Ignored (`if (saving) return`), so a double click can't create two workouts |
| Success | Fields reset, "Workout #42 saved." (`role="status"`) |
| Failure | Values **kept**, so nothing has to be retyped |

`setSaving(false)` sits in **`finally`**, which runs after success *and* after an error. Placed after the `await`, it would only run on success, and a failed request would leave the button stuck on "Saving…".

**`role="status"` vs. `role="alert"`:** a success message is announced politely, when the screen reader is ready; an error interrupts. Success can wait a second; errors shouldn't.

### Verified

- **Double click** with the network throttled (DevTools → Slow 4G): "Saving…" appears and only **one** `POST` is sent.
- **API stopped:** an error appears and the values stay in the form.
- **List sync:** `GET /workouts` returned `X-Cache: HIT`; after a `POST`, the next `GET` returned `X-Cache: MISS` with the new total. The API clears its cache on every write, so the list never shows stale data.

---

## Session 4: The lost response

**The scenario:** the server saves the workout, but its answer never reaches the browser (a dropped connection, or the 10-second timeout firing during a slow start). If the form says "failed", the user clicks again → **two identical workouts**.

### The decision

| Option | | |
|---|---|---|
| A: Idempotency key | The form sends a unique key per submission; the server returns the first result for a repeated key | The robust fix; **documented for later** (milestone 09) |
| **B: Honest UI** | No answer → *"We couldn't confirm the save. It may have gone through. Check your workouts before trying again."* | **Chosen** |
| C: Accept duplicates | The user deletes them | Not chosen |

**The rule:** *if the server answered, we know what happened; if it didn't, we don't.*

| Error | Did the server answer? | UI |
|---|---|---|
| `ApiError` (400, 500…) | yes, definitely **not** saved | field errors or a form message |
| `NetworkError` (timeout, connection lost) | no, **maybe** saved | "couldn't confirm" + link to the list |

### Verified by faking a lost response

A temporary `time.sleep(12)` in `create_workout`, **after** saving and **before** answering: the form's 10-second timeout fired and showed "couldn't confirm", and the workout (cycle, 16.6 km, 62 min) **was** in the database. (The sleep was removed afterwards.)

**Test:** `WorkoutForm.test.tsx` renders the real form with a fake `createWorkout` (`vi.mock`): a `NetworkError` must show the "couldn't confirm" message and keep the input; a success must show "Workout #… saved." and reset the form. Inputs are found by their **labels**, so the test also checks that the labels work.

### Bug found

After adding the `NetworkError` branch, the form still showed the old message. `docker compose up --build api` starts **only the named service** (plus its dependencies), so the browser was still running an **old frontend**. `docker compose up --build` (all services) and a fresh tab fixed it.

---

## Session 5: Editing a workout

### Backend: `PUT /workouts/<id>`

| Case | Response |
|---|---|
| Valid data, workout exists | `200` + the updated workout |
| Invalid data | `400` + `{"errors": [...]}`, the same messages as create |
| Unknown ID | `404` + `"Workout not found."` |

- **`PUT` replaces the whole workout.** The client sends all fields; a missing `distance_km` means "no distance". Turning a run into strength therefore clears the old distance. (Changing only some fields would be `PATCH`.)
- **One validation for create and update:** the checks moved out of `create_workout` into `validate_workout_payload(data)`, which returns a plain error dict or `None`. Each route turns that into an HTTP response. The 18 existing tests passed unchanged after the move, proving the refactoring changed no behaviour.
- **`db.update_workout`** loads the object, changes its attributes and commits. No `session.add()`: the object came from the session, so it's already tracked.
- **Validation runs before the lookup**, so invalid data for an unknown ID returns `400`, not `404`.
- **`cache.clear()` only after a real change.**
- **3 new tests:** update + re-read, unknown ID, invalid duration.

### Frontend: one form for adding and editing

| | Add mode | Edit mode |
|---|---|---|
| Route | `/workouts/new` | `/workouts/:id/edit` |
| Props | none | `workoutId`, `initialValues` |
| Request | `createWorkout` (`POST`) | `updateWorkout` (`PUT`) |
| After success | form reset + "Workout #… saved." | navigate to the details page |

- **`toFormValues`** is the reverse of `toNewWorkout`: numbers → strings, `null` → `""`.
- **`EditWorkoutPage`** loads the workout first and only then renders the form. `useState(initialValues)` reads its starting value only on the first render, so values arriving later would be ignored.
- **Writes get no `signal`.** Cancelling a `fetch` only stops the browser from waiting; the server still saves. A cancelled write would create a lost response on purpose.
- **The Edit link** appears only once the workout has loaded.
- **Component test:** in edit mode, the fields start filled in, "Save changes" calls `updateWorkout(7, …)` with converted values, and `createWorkout` is never called.

### Bugs found

- **A swapped field:** `update_workout` set `distance_km` twice and never wrote `duration_min`. The kind of slip the update test and the edit-mode test now catch.
- **Validation order, made visible:** a `404` test accidentally sent an invalid duration and got `400`, because the route validates before it looks up the ID.
- **Hooks only at the top:** `useNavigate()` was first called inside the submit handler. Hooks must run at the top level of the component on every render; inside the handler, only `navigate(...)` is used.
- **Default vs. named exports:** `import { EditWorkoutPage }` failed against `export default`. The page is now a named export.
- **Editor type errors in tests:** `toHaveValue` was underlined although the tests passed. `tsconfig.app.json` excludes test files (needed for the Vercel build), so they belonged to no TypeScript project. A separate `tsconfig.test.json` that includes the tests and `setup.ts` fixed it.

---

## Next: Delete

_(planned)_