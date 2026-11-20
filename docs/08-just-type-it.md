# 08 — Just type it

**Why it matters:** a form with four fields is slow for something as simple as "ran 5 km in 30 min". Typing a line is how people already note a workout; the app should understand it.

**Key question:** *How do you accept free text without accepting anything at all?*

| | |
|---|---|
| Status | Done (2 sessions) |
| Endpoints | `POST /workouts/parse/preview`, `POST /workouts/parse` (`text/plain`, one workout per line) |
| Page | `/quick-add` |

---

## Session 1: Text as another input format (backend)

The parser already existed from the Python lab: `parse_line` uses regular expressions to find a sport, a distance and a duration anywhere in a line ("Went for a 6km run, 35 min"). But the old endpoint saved straight away, with no preview, no dates and no duplicate check.

### The idea

Typed text is just another input format. `parse_line` moved into `importers.py`, next to the file converters, and a new converter `text_rows` turns each non-empty line into a row. From there, typed text goes through exactly the same pipeline as a CSV, GPX or FIT file: cleaning, validation, preview, duplicate check, all-or-nothing insert.

### One place for "preview" and "import"

Files and text needed the same two answers, so they became two helpers:

| Helper | Used by | Answer |
|---|---|---|
| `preview_response(rows)` | `/workouts/upload/preview`, `/workouts/parse/preview` | `200` with every row, its error and a duplicate flag; saves nothing |
| `import_response(rows)` | `/workouts/upload`, `/workouts/parse` | `201` with `inserted` and `skipped`, or `400` with the row errors; all or nothing |

Each endpoint only reads its input (`read_upload` for files, `read_text` for text) and passes the rows on. Four endpoints, one implementation.

### Decisions

- **Free text, strict result.** The parser is lenient about wording; validation is not. "went hiking" is understood as a line without a known sport and rejected with a clear row error, instead of being guessed.
- **The old parser stays as it was.** `parse_line` still returns the same three fields, so the existing parser tests passed unchanged; `app.py` re-imports it.
- **Empty text is an error** (field `text`), like an empty file; at most 1,000 lines at once.

### Verified

- **3 new backend tests** (53 in total): the preview shows each line, flags the unknown sport and saves nothing; the same line saved twice is skipped the second time; empty text is rejected with field `text`.
- **The suite caught a swap:** in the first version, the parse endpoint called `preview_response` and the upload preview called `import_response`. Seven tests failed at once (a preview that saved, an import that didn't), which pointed straight at the two lines. Without the preview tests from milestone 07, the Import page would have saved files as soon as they were chosen.

---

## Session 2: The Quick add page

A text area, a **Check** button that shows the preview, and a **Save** button that is enabled only when every line is valid and at least one is new.

### Decisions

- **Check on request, not on every keystroke.** A preview per keystroke would send a request for every character typed. Changing the text clears the old preview, so what is saved is always what was checked.
- **One preview table for both pages.** The table moved from the Import page into `import/PreviewTable.tsx`, together with `workoutCount` ("1 workout", "2 workouts"). Import and Quick add show rows the same way.
- **One check for both import answers:** `toImportResult()` in `workout-api.ts` validates `{inserted, skipped}` for file and text imports.
- **The same honest message on a lost answer:** "We couldn't confirm the save. Check your workouts before saving again."

### Verified

- Three lines, one of them "went hiking" → the preview flags the sport, and Save stays disabled. Without that line → "Save 2 workouts" → saved. The same lines again → "Already imported".
- `npm run build` passes.

---

## Summary

**Key question answered:** *How do you accept free text without accepting anything at all?* Parse leniently, validate strictly, and show the result before saving. Typed text becomes rows like any imported file, so it gets the same validation, preview and duplicate check, without a second implementation.

| Session | Result |
|---|---|
| 1 | Text as a converter; shared `preview_response` and `import_response`; preview and save endpoints for text |
| 2 | The Quick add page with Check and Save; a shared preview table |