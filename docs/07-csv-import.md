# 07 - CSV import

Import workouts from a CSV file, with a preview and nothing saved if any row is bad. Example file: [`samples/workouts-example.csv`](../samples/workouts-example.csv).

## What was built

- **File checks** before any row is read, each a `400` with field `file`:
  - a file was sent, it ends in `.csv`, it's UTF-8
  - it has a `sport` column and at least one row
  - at most 1,000 rows
  - larger than 1 MB → `413`
- **Preview** (`POST /workouts/upload/preview`): every row with its error, nothing saved.
- **Import** (`POST /workouts/upload`): all rows in one transaction, or none.
- **Dates:** an optional `performed_on` column; rows without one get today's date.
- **Duplicates:** a row with the same sport, distance, duration and date as an existing workout is skipped and reported (`{"inserted": 2, "skipped": 1}`).
- **The page** `/import`: choose a file, see the preview, import only when every row is valid.

## Decisions

- Preview and import share the same checks (`check_rows`), so they can't disagree.
- The import checks the file again; the preview is only information.
- Existing workouts are loaded with one query per file, not one per row.
- Two identical rows in the same file are both imported.

## Lessons

- Excel adds an invisible character (BOM) before the first column name, so `sport` wasn't found. Decoding with `utf-8-sig` removes it.
- For `FormData`, don't set `Content-Type` by hand: the browser adds the required boundary itself.
- On a lost answer, the page says the import couldn't be confirmed, so the user doesn't upload twice.
- A test with 500 rows and one bad row in the middle checks that nothing is saved.
