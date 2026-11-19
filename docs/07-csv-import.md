# 07 — CSV import

**Why it matters:** imported files are the least trustworthy input an app gets. They come from other programs, other encodings and other people's spreadsheets, and they arrive as a whole batch.

**Key question:** *One row in a 500-row CSV is invalid. What happens to the other 499?*

| | |
|---|---|
| Status | Done (4 sessions) |
| Endpoints | `POST /workouts/upload/preview`, `POST /workouts/upload` (`multipart/form-data`, field `file`) |
| Page | `/import` |
| Example file | [`samples/workouts-example.csv`](../samples/workouts-example.csv) |

---

## Session 1: Upload

The endpoint already existed from the Python lab: it read the CSV, validated every row, and saved **all or nothing** in one transaction. This session protected it against bad **files** (as opposed to bad rows) and added the page.

### File checks (backend)

Run in this order, each answering `400` with field `file` (or `413` for the size):

| Check | Why |
|---|---|
| A file was sent | `request.files.get("file")` is `None`, or the filename is empty |
| Size ≤ 1 MB (`MAX_CONTENT_LENGTH`) | Flask stops reading and answers `413`; a JSON handler replaces Flask's HTML page |
| Name ends in `.csv` | An image or PDF never reaches the CSV reader |
| Valid UTF-8 | Otherwise `decode()` crashed with a `500` |
| Decoded with `utf-8-sig` | Excel puts an invisible byte-order mark (BOM) in front of the header. The first column was then called `﻿sport`, not `sport`, and **every** row failed with "sport is invalid" |
| A header row with a `sport` column | Without it, every row fails with confusing messages |
| At least one row | A header-only file is almost certainly a mistake, so it's rejected instead of answering `201` with `inserted: 0` (the API contract was updated) |
| At most 1,000 rows (`MAX_IMPORT_ROWS`) | Bounds the work one request can cause |

Only then are the rows validated, with the same rules as before. Any row error means **nothing is saved**, and every error names its `row` and `field`.

### The page (frontend)

- **`uploadWorkouts(file)`** sends the file as `FormData`. No `Content-Type` header is set by hand: the browser sets `multipart/form-data` itself, including the `boundary` that separates the parts. Set by hand, the boundary is missing and Flask finds no file.
- **The browser checks type and size first** for instant feedback, so a 50 MB file isn't uploaded just to be rejected. The server stays the authority.
- **Row errors as a list:** "Nothing was imported. Fix these rows and upload again:", then "Row 2 · distance_km: The key distance_km is missing."
- **A lost answer is not a failure:** on a `NetworkError` the page says "We couldn't confirm the import. Check your workouts before uploading again." The import may have happened; claiming it failed would invite a second upload, and with it duplicates.
- **Accessible:** a label for the file input, `role="alert"` for errors, `role="status"` for the result.

### Verified

- **8 new backend tests** (39 in total): an Excel file with BOM is accepted; a `.txt` file, non-UTF-8 bytes, a missing `sport` column and a header-only file are rejected with field `file`; 1,001 rows are rejected; a 1.5 MB file gets `413`.
- In the browser: the example file (`samples/workouts-example.csv`) → "Imported 2 workouts"; a file with a run without distance in row 2 → the row error, and the valid row 1 was **not** saved (still 49 workouts); a `.txt` file → rejected before upload, the button stays disabled.

### Bugs found

- **CSV files without line breaks:** the first test files had all rows on one line, wrapped in quotes, so a CSV reader sees one single cell. The new header check rejects such a file with a clear message.
- **The list rendered twice:** after adding the duration to each list line, the old `workouts.map(...)` block was still there, so page 5 showed its workouts twice, once without minutes.

---

## Session 2: Preview

**The idea:** the user sees what will be imported (every row, with its problems) **before** anything is saved. Importing only becomes possible when every row is valid.

### The endpoint

`POST /workouts/upload/preview` takes the same file as the upload, runs the same checks, and saves nothing:

```json
{
  "rows": [
    { "row": 1, "sport": "swim", "distance_km": 1.5, "duration_min": 40.0, "error": null },
    { "row": 2, "sport": "run", "distance_km": null, "duration_min": 30.0,
      "error": { "field": "distance_km", "error": "The key distance_km is missing." } }
  ],
  "valid": 1,
  "invalid": 1
}
```

A bad **file** still gets `400` (or `413`); a file with bad **rows** gets `200` with the errors per row, because the preview itself succeeded.

### Decisions

- **One place for the rules.** The file checks moved into `read_csv_upload()`, the row checks into `check_rows()`. Upload and preview both use them, so the preview can never disagree with the import.
- **Refactoring under test:** all upload tests from session 1 still pass after the move, which is the proof that the existing endpoint behaves the same.
- **The preview is information, not permission.** The import re-reads and re-validates the file on the server. If it fails anyway, the page asks for a fresh preview instead of showing stale row errors.
- **The preview runs in an effect with an `AbortController`:** choosing a second file quickly cancels the first preview, so an old answer can't replace a newer one (the same pattern as the list page).
- **No import button until there's a preview,** and it's disabled while any row has an error. The button names the number: "Import 2 workouts".
- **Invalid rows are highlighted** in the table, and their last cell names the field and the problem.

### Verified

- **2 new backend tests** (41 in total): a preview reports every row with `valid`/`invalid` counts and saves nothing (`total` stays 0); a bad file gets the same `400` as the upload.
- In the browser: the example file shows 2 rows marked OK and imports both; a file with a missing distance in row 2 shows that row in red and the button stays disabled; a `.txt` file shows no table.

## Session 3: Dates and duplicates

**The problem:** importing the same file twice saved every workout again: double runs, double stats.

### Dates in the CSV

An optional `performed_on` column (`2026-11-19`) puts imported workouts into the right week of the stats. Rows without it get today's date, as before.

- `to_date()` works like `to_number()`: an empty value becomes `None`, a value that isn't a date stays text, and validation reports it (field `performed_on`).
- **`None` is not "no value":** passing `performed_on=None` to the model makes SQLAlchemy send `NULL`, which the `NOT NULL` column rejects. The key is left out instead, so the database default (today) applies.
- **Two forms of the date:** the database needs a `date` object, JSON needs text. The preview sends a copy of each row with the date as `"2026-11-02"`; validation and the insert keep the real `date`.

### The duplicate policy

A row is a **duplicate** if a workout with the same **sport, distance, duration and date** already exists. Rows without a date are compared as "today", since that's the date they would get.

| | Preview | Import |
|---|---|---|
| New row | "OK" | saved |
| Duplicate | "Already imported" | skipped |
| Invalid row | the error | nothing is saved (all or nothing) |

The import answers `{"inserted": 2, "skipped": 1}`; the preview adds a `duplicates` count and a `duplicate` flag per row.

### Decisions

- **Skip, don't reject.** A file with some already-imported rows is usually an export that overlaps with the last one. Importing the new rows and naming the skipped ones is more useful than refusing the whole file.
- **One query per file:** `existing_workout_keys(dates)` loads every existing workout on the file's dates at once, as a set of tuples, so each row's check is a lookup. 1,000 rows means 1 query, not 1,000.
- **Identical rows within one file are both imported.** Two identical 5 km runs on one day are possible; only the database decides what already exists.
- **The import button counts only new rows** ("Import 2 workouts") and is disabled when there are none.

### Verified

- **5 new backend tests** (44 at that point): a date from the file lands in the right week; an invalid date (`2026-13-40`) is rejected with field `performed_on`; the second upload of the same file inserts 0 and skips 2, and the total stays at 2; the preview flags the duplicate row and counts it.
- In the browser: a file imported a second time shows "Already imported" on every row, "0 new rows", and a disabled button.

### Bugs found

- **`Date` instead of `date`:** SQLAlchemy's column type `Date` has no `fromisoformat`; the Python type `date` from `datetime` does.
- **A copy, not the original:** converting the date to text directly in the cleaned row would have made validation report "must be a date" for every valid date. The preview converts a copy (`{**clean}`).
- **Two status cells:** the old status `<td>` stayed next to the new one, so each table row had six cells under five headings.

## Session 4: The key question as a test

Most of what was planned for this session (an import summary, a link to the list, tests that an invalid file writes nothing) was already built in sessions 1–3. What remained:

- **One test for the key question:** a file with 499 valid rows and one invalid row in the middle (row 251) is rejected with exactly that row's error, and the total stays at **0**, not 499.
- **The date in the preview:** the table got a Date column; rows without a date show "today", since that's the date they get.
- **The example file** has a `performed_on` column, and the page's intro text names it as optional.

---

## Summary

**Key question answered:** *One row in a 500-row CSV is invalid. What happens to the other 499?* Nothing: none of them are saved. The preview shows the bad row before anything is written, and the import checks again and saves all rows in one transaction or none.

| Session | Result |
|---|---|
| 1 | File checks (size, type, encoding with Excel's BOM, header, row limit); the import page |
| 2 | Preview endpoint with errors per row; import only when every row is valid |
| 3 | Optional dates; duplicates skipped and reported (`inserted`, `skipped`) |
| 4 | The key question as a test; dates in the preview |