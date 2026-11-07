# 10 — Data Parsing & Extraction

The final concept. Building on everything before it, this adds a route that
parses **loosely-natural text** into workouts — turning lines like
"Went for a 6km run, 35 min" into structured, validated, stored records.

Where concept 07 parsed rigid CSV (fields already separated), this parses
free-form sentences where the pieces (sport, distance, duration) can appear
anywhere, in any order, in different words. The tool for that is **regular
expressions**.

## Run it

```powershell
cd 10-data-parsing
pip install -r requirements.txt
python app.py
```

## Parsing text into workouts

`POST /workouts/parse` takes plain text, one workout per line:

```powershell
$body = @"
Went for a 6km run, 35 min
Swam 0.4km in 27 minutes
Badminton for 90 minutes
Rest day
"@
Invoke-RestMethod -Uri http://127.0.0.1:5000/workouts/parse -Method Post -Body $body -ContentType "text/plain"
```

Returns `{"inserted": 4}`. Each sentence was parsed into a workout and
stored. If any line can't be parsed into a valid workout, the whole batch is
rejected (all-or-nothing) and nothing is inserted.

## How the parsing works

Each line goes through `parse_line`, which uses three `re.search` calls — one
per field. The key idea is **search-then-capture**: `re.search` finds a
pattern *anywhere* in the line (because free-form text has no fixed order),
and a capturing group `( )` extracts the specific value out of the match.

```python
# distance: a number next to "km", capture just the number
m = re.search(r"(\d+\.?\d*)\s*km", text, re.IGNORECASE)
distance = float(m.group(1)) if m else None

# duration: a number next to "min" (matches min/mins/minutes)
m = re.search(r"(\d+)\s*min", text, re.IGNORECASE)
duration = int(m.group(1)) if m else None

# sport: one of a known set of words, including natural variants
m = re.search(r"(run|ran|running|jog|jogging|swim|swam|swimming|"
              r"cycle|cycled|cycling|badminton|strength|rest)", text, re.IGNORECASE)
sport = m.group(1).lower() if m else None
```

Two touches that matter for natural text:

- **`re.IGNORECASE`** so "Rest" and "RUN" match; then `.lower()` on the
  captured sport to normalise case.
- **A variant map** (`ran`->`run`, `swam`->`swim`, `cycling`->`cycle`, ...)
  so natural phrasings normalise to the canonical sports the rest of the app
  expects. Detecting "swam" is only useful if it becomes "swim".

A missing piece (a rest day has no distance/duration) becomes `None` — the
same optional-field handling used throughout the lab.

## The whole lab, composed

This endpoint reuses almost every earlier concept: `parse_line` (new) feeds
`validate_data` (02/07), which feeds `add_workout` (04), inside an
all-or-nothing batch (07), finishing with `cache.clear()` (09) because it's a
write. The capstone is mostly orchestration of parts already built.

## Known gaps (deliberately deferred)

Truly free-form natural language is unbounded — no parser handles every
phrasing. This one handles common cases and degrades gracefully (unrecognised
pieces become `None`) rather than crashing. Known limits:

- **`10k` (no "m")** isn't matched — the distance pattern requires "km". Left
  strict on purpose: a wrong distance is worse than a missing one.
- **Unknown sport words** ("hiked", "paddled") aren't recognised; they'd
  produce `sport: None` and be rejected by validation.
- **One workout per line** is assumed; multiple activities in one sentence
  aren't split.

Handling arbitrary natural language is a much larger problem (NLP territory);
this concept deliberately scopes to common, predictable phrasings.

## What I learned

> - Why does regex extraction use `search` (find anywhere) rather than
>   matching the whole line?
> - What do capturing groups `( )` do, and why are they the heart of
>   extraction?
> - Why normalise variants ("swam" -> "swim") instead of just detecting them?
> - How did this final endpoint reuse the earlier concepts?

## Concepts touched

Regular expressions (`re.search`, capturing groups, `re.IGNORECASE`),
extracting structured data from unstructured text, normalising variants to
canonical forms, graceful degradation on unrecognised input, composing the
full pipeline (parse -> validate -> insert -> invalidate) from earlier
concepts.