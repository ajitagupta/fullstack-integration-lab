# 14 - Garmin and Strava files

Import workouts from the files that watches and apps export. Examples in [`samples/`](../samples): `morning-run.gpx`, `evening-ride.fit`, `strava-activities.csv`.

## What was built

- **One converter per format** in `importers.py`, chosen by file extension:

  ```python
  CONVERTERS = {".csv": csv_rows, ".gpx": gpx_rows, ".fit": fit_rows}
  ```

  Each converter turns a file into the same rows a CSV produces. Validation, preview and duplicate check stay the same for every format.
- **GPX** (XML track points): distance is added up from the points, duration is last time minus first time. One workout per file.
- **FIT** (Garmin's binary format): read with `fitdecode`; the `session` message already holds the totals. One workout per session.
- **Strava's `activities.csv`:** recognised by its header (`Activity Type`) and mapped to the app's fields (seconds → minutes, `Ride` → `cycle`, Strava's date format).

## Decisions

- The converter table was added first, with no new format. All tests still passed before any GPX code existed.
- XML is read with `defusedxml`, which refuses files built to use up memory.
- Moving time, not elapsed time, for FIT and Strava.

## Lessons

- Strava's export has two columns named `Distance`: km first, metres later. Python's `DictReader` keeps the last one, which turned 6 km into 6,100 km. The header is now read with `csv.reader`, and the first match wins.
- Dates come from the UTC start time, so an activity just after midnight in Zurich is dated the day before.
- A long GPX file with heart-rate data can be larger than the 1 MB upload limit.
