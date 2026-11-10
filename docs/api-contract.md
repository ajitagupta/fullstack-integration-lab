# API contract

## Target contract (from milestone 03)
Decisions taken in milestone 03. Where the current state below differs, the code is changed to match this section.

### Status codes
| Situation | Status |
|---|---|
| Read succeeded | `200` |
| Something was created (`POST /workouts`, `/workouts/upload`, `/workouts/parse`, including `inserted: 0`) | `201` |
| Invalid input (body, file, text or query parameter) | `400` |
| Resource not found (including non-numeric ids like `/workouts/abc`) | `404` |

### Error format
Every error response is JSON with a list of errors, even when there is only one:
```json
{ "errors": [ { "field": "distance_km", "error": "The key distance_km is missing." } ] }
```
| Key | Present when | Example |
|---|---|---|
| `error` | always | `"The key distance_km is missing."` |
| `field` | the error belongs to one field or query parameter | `"distance_km"`, `"limit"` |
| `row` | the error belongs to a CSV row or a parse line | `2` |

CSV upload example (nothing is imported):
```json
{ "errors": [ { "row": 2, "field": "distance_km", "error": "The key distance_km is missing." } ] }
```
The row number moves out of the message into `row`, so the frontend can highlight the row without parsing text.