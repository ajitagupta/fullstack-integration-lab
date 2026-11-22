# API contract

The rules every endpoint follows. The list of endpoints is in the [backend README](../backend/README.md#endpoints).

## Status codes

| Code | When |
|---|---|
| `200` | A read, an update or a preview succeeded |
| `201` | Something was created (a workout, an import) |
| `204` | A workout was deleted (no body) |
| `400` | The input is invalid |
| `404` | Unknown URL or workout id |
| `413` | The upload is larger than 1 MB |
| `500` | An unexpected error (a bug) |
| `503` | The database can't be reached |

## Error format

Every error has the same shape:

```json
{ "errors": [ { "field": "distance_km", "error": "The key distance_km is missing." } ] }
```

- `field` names the input that's wrong, if there is one.
- `row` is added for imports, so the page can point to the line in the file.
- `500` and `503` messages end with a reference, the response's `X-Request-ID`, which can be found in the logs.

## A workout

```json
{ "id": 1, "sport": "run", "distance_km": 5.0, "duration_min": 30, "performed_on": "2026-11-22" }
```

| Field | Rule |
|---|---|
| `sport` | swim, run, badminton, cycle, strength or rest |
| `distance_km` | a number ≥ 0; required for run, swim and cycle, otherwise may be `null` |
| `duration_min` | a whole number ≥ 0; required for every sport except rest |
| `performed_on` | a date; set by imports, otherwise today |

The frontend checks every response against this shape at runtime (`workout-types.ts`). Real examples of every response are in [`contracts/`](../contracts).
