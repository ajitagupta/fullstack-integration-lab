# 08 - Typed text

Add workouts by typing one per line, e.g. "ran 5 km in 30 min", on the Quick add page (`/quick-add`).

## What was built

- `text_rows()` turns each line into a row with the existing parser `parse_line()`.
- Typed text then goes through the same steps as a CSV file: validation, preview, duplicate check, all-or-nothing save.
- Two shared helpers serve all four endpoints:
  - `preview_response()` for `/workouts/upload/preview` and `/workouts/parse/preview`
  - `import_response()` for `/workouts/upload` and `/workouts/parse`
- The Quick add page: a text area, **Check** shows the preview, **Save** is enabled only when every line is valid.
- `PreviewTable` is shared by the Import and Quick add pages.

## Decisions

- The parser is lenient about wording; validation is strict. "went hiking" is shown as an error, not guessed.
- The preview runs when **Check** is clicked, not on every keystroke. Editing the text clears the old preview.
- Empty text is a `400` with field `text`.

## Lessons

- In the first version, the preview and import helpers were swapped. Seven tests failed at once and pointed straight at the two lines.
