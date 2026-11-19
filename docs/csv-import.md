# 07 — CSV import

**Why it matters:** imported files are the least trustworthy input an app gets. They come from other programs, other encodings and other people's spreadsheets, and they arrive as a whole batch.

**Key question:** *One row in a 500-row CSV is invalid. What happens to the other 499?*

| | |
|---|---|
| Status | Session 1 of 4 done |
| Endpoint | `POST /workouts/upload` (`multipart/form-data`, field `file`) |
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

_(planned)_

## Session 3: Confirm

_(planned)_

## Session 4: Summary and tests

_(planned)_