# 14 — Garmin & Strava files

**Why it matters:** most workouts are already recorded by a watch or an app. Typing them in again is the main reason people stop logging. Reading the files those devices export makes the tracker useful without extra effort.

**Key question:** *How do you add a new import format without touching the code that already works?*

| | |
|---|---|
| Status | Done (3 sessions) |
| Endpoints | `POST /workouts/upload/preview`, `POST /workouts/upload` (unchanged; the file extension picks the format) |
| Page | `/import` |
| Example files | [`samples/morning-run.gpx`](../samples/morning-run.gpx), [`samples/evening-ride.fit`](../samples/evening-ride.fit), [`samples/strava-activities.csv`](../samples/strava-activities.csv) |

---

## Session 1: GPX

### One converter per format

Before GPX could be added, reading the file was separated from checking the rows. Each format now has a **converter** in `importers.py` that turns file bytes into rows, and a table maps file extensions to converters:

```python
CONVERTERS = {
    ".csv": csv_rows,
    ".gpx": gpx_rows,
    ".fit": fit_rows,
}
```

`read_upload()` in `app.py` picks the converter by extension, and everything after it (cleaning, validation, preview, duplicate check, all-or-nothing insert) stays the same for every format. Adding a format means writing one function and adding one line to the table.

This separation was done first, as a refactoring on its own: all 45 tests passed unchanged before any GPX code existed.

### Reading GPX

A GPX file is XML with a list of track points, each with a position and a time. It contains no totals, so the converter computes one workout per file:

| Field | From |
|---|---|
| `sport` | `<trk><type>`, mapped (`running` → `run`, `cycling` → `cycle`, …); unknown names pass through and validation reports them |
| `distance_km` | The sum of the distances between neighbouring points (haversine formula), rounded to 10 m |
| `duration_min` | Last timestamp minus first, in whole minutes |
| `performed_on` | The date of the first timestamp |

### Decisions

- **Converters return text, like a CSV row.** A GPX workout then goes through exactly the same `clean_row` and `validate_data` as a CSV row: same rules, same error messages, same duplicate check. Importing the same GPX file twice is detected without any GPX-specific code.
- **`defusedxml` instead of Python's own XML parser.** XML from outside can contain "entity bombs": a few bytes that expand into gigabytes in memory. `defusedxml` refuses such files. A broken or unsafe file becomes a `400` with field `file`.
- **Clear messages for files that aren't usable:** not valid XML, fewer than two track points, or no timestamps.
- **One list of accepted types in the page** (`ACCEPTED`), used for the file picker, the browser check and the message.
- **Open point:** a real GPX file from a long activity with heart-rate data can exceed the 1 MB upload limit.

### Verified

- **2 new backend tests** (47 in total): a GPX track of two points 0.009° apart and 6 minutes apart is read as run, 1.0 km, 6 min, 2026-11-14; a broken GPX file is rejected with field `file`.
- In the browser: `morning-run.gpx` shows run · 5 · 30 · 2026-11-14 in the preview and imports; choosing it again shows "Already imported".

---

## Session 2: FIT

### Reading FIT

FIT is Garmin's **binary** format: a stream of messages (a `record` for every GPS point, `lap`s, events) ending with a **`session`** message that already holds the summary. Nothing needs calculating; the converter reads the session with the **`fitdecode`** library.

| Field | From the `session` message |
|---|---|
| `sport` | `sport`, mapped like GPX (`cycling` → `cycle`, …) |
| `distance_km` | `total_distance` (metres) ÷ 1000 |
| `duration_min` | `total_timer_time` (seconds) ÷ 60 |
| `performed_on` | the date of `start_time` |

Adding the format meant one function and one line in `CONVERTERS`. Nothing else in the upload, preview or duplicate check changed.

### Decisions

- **A library, not hand-written decoding.** Binary formats have headers, field definitions and checksums; decoding them by hand is error-prone. `fitdecode` is small and pure Python.
- **One row per session, not per file.** A multisport activity (a triathlon, say) contains several sessions and becomes several workouts, with no extra code.
- **Missing values become `""`,** like an empty CSV cell, so cleaning and validation decide whether they're allowed, the same as for every other format.
- **Moving time (`total_timer_time`), not elapsed time.** It leaves out pauses and matches the time the watch shows.
- **A corrupt or non-FIT file** ends in `fitdecode.FitError` and becomes a `400` with field `file`.
- **Known limit:** dates come from the UTC start time. An activity started shortly after midnight in Zurich is dated the previous day. The same applies to GPX.

### Verified

- **2 new backend tests** (49 in total): the sample ride is read as cycle, 20.0 km, 45 min, 2026-11-17; a file that isn't FIT is rejected with field `file`. The FIT test reads `samples/evening-ride.fit`, since FIT files can't be written by hand.
- In the browser: `evening-ride.fit` imports, shows "Already imported" the second time, and appears in the stats in the week of 16 November.

## Session 3: Strava CSV

### The problem

Strava's bulk export (`activities.csv`) is a CSV, just like the app's own format, so the file extension can't tell them apart. It differs in almost everything else:

| | The app's CSV | Strava |
|---|---|---|
| Columns | `sport`, `distance_km`, `duration_min`, `performed_on` | `Activity Type`, `Distance`, `Moving Time`, `Activity Date`, and many more |
| Sport | `run`, `cycle` | `Run`, `Ride`, `Weight Training` |
| Duration | minutes | seconds |
| Date | `2026-11-10` | `Nov 10, 2026, 6:45:12 AM` |

### How it's read

`csv_rows` reads the header itself. If it contains `Activity Type`, the file goes to `strava_rows`, which maps each row to the app's fields; otherwise it's the app's own format, as before. Both end up as the same text rows, so validation, preview and the duplicate check stay unchanged.

### Decisions

- **Detect the format by content, not by name.** Two formats share the `.csv` extension, so the header decides.
- **The first column with a name wins.** Strava repeats column names: `Distance` appears twice, first in km (`6.10`), later in metres (`6100.0`). Python's `DictReader` keeps the **last** one, which would have turned a 6 km run into 6,100 km. The header is read with `csv.reader`, and `header.index(name)` returns the first match.
- **Moving time first,** falling back to elapsed time, consistent with the FIT import.
- **Dates parsed with a pattern** (`strptime` with `%b %d, %Y, %I:%M:%S %p`). Values that don't fit stay text, and validation reports them, like every other bad value.
- **"1 workout", not "1 workouts":** a small `workoutCount` helper on the import page.

### Verified

- **1 new backend test** (50 in total): the sample export is read as run 6.1 km/32 min, cycle 25.4 km/60 min, swim 1.8 km/40 min and strength 0 km/55 min, with the right dates and no errors. All earlier CSV tests passed unchanged with the new `csv_rows`.
- In the browser: the sample export shows 4 rows marked OK, imports with "Imported 4 workouts", and the week of 9 November in the stats grows accordingly.

---

## Summary

**Key question answered:** *How do you add a new import format without touching the code that already works?* With one converter per format, chosen from a table by file extension (or, for CSV, by header). A converter turns a file into the same text rows a CSV produces; validation, preview, duplicate check and the all-or-nothing insert are shared. GPX, FIT and the Strava export each added one function, and the existing tests passed unchanged every time.

| Session | Result |
|---|---|
| 1 | The converter table; GPX tracks read with `defusedxml`, distance and duration computed from the points |
| 2 | FIT files read with `fitdecode`, one workout per session |
| 3 | Strava's CSV export detected by its header and mapped, including its repeated column names |