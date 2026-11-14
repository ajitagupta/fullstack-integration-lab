# 05 — Submit & validate workouts

**Why it matters:** user input is the one thing in the app you don't control. It has to be checked in the browser for a good experience, and again on the server, because the browser can be bypassed.

**Key question:** *"The request was saved, but the response got lost. What does the user see?"*

| | |
|---|---|
| Status | Sessions 1–4 done · edit & delete next |
| New route | `/workouts/new` |
| New files | `src/forms/validate-workout.ts`, `src/forms/validate-workout.test.ts`, `src/forms/WorkoutForm.tsx`, `src/forms/WorkoutForm.test.tsx` |

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

## Next: Edit & delete

_(planned)_