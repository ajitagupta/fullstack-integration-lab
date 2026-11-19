from flask import Flask, request, jsonify
import db
import os
from apscheduler.schedulers.background import BackgroundScheduler
import cache
import re
from flask_cors import CORS
from datetime import date

app = Flask(__name__)

CORS(app, origins=os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(","))
MAX_LIMIT = 100
app.config["MAX_CONTENT_LENGTH"] = 1 * 1024 * 1024    # 1 MB: Flask rejects larger requests with 413
MAX_IMPORT_ROWS = 1000
ALLOWED_SPORTS = ["swim", "run", "badminton", "cycle", "strength", "rest"]
SORT_FIELDS = ["id", "distance_km", "duration_min"]

def error_response(errors, status=400):
    return jsonify({"errors": errors}), status

@app.errorhandler(404)
def not_found(e):
    return error_response([{"error": "Not found."}], 404)

@app.errorhandler(413)
def too_large(e):
    return error_response([{"field": "file", "error": "The file is larger than 1 MB."}], 413)

def scheduled_job():
    count = db.count_workouts(None, None, None)
    workouts = db.search_workouts(None, None, None, 1000000, 0)
    distance = sum(w["distance_km"] for w in workouts if w["distance_km"] is not None)

    print(f"[Scheduler] {count} workouts logged, {distance} km total")

if os.environ.get("WERKZEUG_RUN_MAIN") == "true":

    scheduler = BackgroundScheduler()
    scheduler.add_job(scheduled_job, "interval", seconds=10)
    scheduler.start()

@app.get('/workouts')
def get_workouts():
    sport = request.args.get("sport")

    # after reading sport:
    if sport is not None and sport not in ALLOWED_SPORTS:
        return error_response([{"field": "sport", "error": "The query parameter sport must be one of: swim, run, badminton, cycle, strength, rest."}])

    min_distance = request.args.get("min_distance")
    try:
        min_distance = float(min_distance) if min_distance is not None else None
    except ValueError:
        return error_response([{"field": "min_distance", "error": "The query parameter min_distance must be a number."}])

    min_duration = request.args.get("min_duration")
    try:
        min_duration = float(min_duration) if min_duration is not None else None
    except ValueError:
        return error_response([{"field": "min_duration", "error": "The query parameter min_duration must be a number."}])


    limit = request.args.get("limit")
    try:
        limit = int(limit) if limit is not None else 20
    except ValueError:
        return error_response([{"field": "limit", "error": "The query parameter limit must be a whole number."}])

    offset = request.args.get("offset")
    try:
        offset = int(offset) if offset is not None else 0
    except ValueError:
        return error_response([{"field": "offset", "error": "The query parameter offset must be a whole number."}])

    # after parsing limit and offset:
    if not (1 <= limit <= MAX_LIMIT):
        return error_response([{"field": "limit", "error": f"The query parameter limit must be between 1 and {MAX_LIMIT}."}])
    if offset < 0:
        return error_response([{"field": "offset", "error": "The query parameter offset must be 0 or greater."}])

    sort = request.args.get("sort", "id")
    field = sort[1:] if sort.startswith("-") else sort      # "-distance_km" → "distance_km"
    if field not in SORT_FIELDS:
        return error_response([{"field": "sort", "error": "The query parameter sort must be id, distance_km or duration_min, with a leading '-' for descending order."}])

    # --- cache check ---
    key = cache.make_key("workouts:list", request.args.to_dict())
    cached = cache.get(key)
    if cached is not None:
        resp = jsonify(cached)
        resp.headers["X-Cache"] = "HIT"
        return resp

    # --- cache miss: do the real work ---
    workouts = db.search_workouts(sport, min_distance, min_duration, limit, offset, sort)
    total = db.count_workouts(sport, min_distance, min_duration)

    result = {
        "workouts": workouts,
        "total": total,
        "limit": limit,
        "offset": offset
    }

    cache.set(key, result)
    resp = jsonify(result)
    resp.headers["X-Cache"] = "MISS"
    return resp

def validate_workout_payload(data):

    if data is None:
        return {"error": "Invalid request body or empty body. Must be JSON."}
    if data.get("sport") is None or data.get("sport") == "":
        return {"field": "sport", "error": "The key sport is missing or empty. Must be swim, run, badminton, cycle, strength, or rest."}

    sport = data["sport"]
    if sport not in ALLOWED_SPORTS:
        return {"field": "sport", "error": "The key sport is invalid. Must be swim, run, badminton, cycle, strength, or rest."}

    optional_distance = data.get("distance_km")
    optional_duration = data.get("duration_min")
    if optional_duration is None and (sport in ["run", "swim", "cycle", "badminton", "strength"]):
        return {"field": "duration_min", "error": "The key duration_min is missing."}
    if optional_distance is None and (sport in ["run", "swim", "cycle"]):
        return {"field": "distance_km", "error": "The key distance_km is missing."}

    if optional_duration is not None and not isinstance(optional_duration, (int, float)):
        return {"field": "duration_min", "error": "The key duration_min must be a number."}
    if optional_distance is not None and not isinstance(optional_distance, (int, float)):
        return {"field": "distance_km", "error": "The key distance_km must be a number."}

    if isinstance(optional_duration, float) and not optional_duration.is_integer():
        return {"field": "duration_min", "error": "The key duration_min must be a whole number."}

    if optional_duration is not None and optional_duration < 0:
        return {"field": "duration_min", "error": "The key duration_min must be a positive number or 0."}
    if optional_distance is not None and optional_distance < 0:
        return {"field": "distance_km", "error": "The key distance_km must be a positive number or 0."}

    return None

@app.route("/workouts", methods=["POST"])
def create_workout():

    data = request.get_json(silent=True)
    if data is None:
        return error_response([{"error": "Invalid request body or empty body. Must be JSON."}])
    error = validate_workout_payload(data)
    if error:
        return error_response([error])

    cache.clear()          # data changed — stale reads must go

    return jsonify(db.add_workout(data)), 201

def parse_line(text):
    distance_match = re.search(r"(\d+\.?\d*)\s*km", text, re.IGNORECASE)
    distance = float(distance_match.group(1)) if distance_match else None

    duration_match = re.search(r"(\d+)\s*min", text, re.IGNORECASE)
    duration = int(duration_match.group(1)) if duration_match else None

    sport_match = re.search(r"(run|ran|running|jog|jogging|swim|swam|swimming|cycle|cycled|cycling|badminton|strength|rest)", text, re.IGNORECASE)
    sport = sport_match.group(1).lower() if sport_match else None

    # normalize variants to canonical forms
    sport_map = {"ran": "run", "running": "run", "jog": "run", "jogging": "run", "swam": "swim", "swimming": "swim", "cycled": "cycle", "cycling": "cycle"}
    if sport in sport_map:
        sport = sport_map[sport]

    return {"sport": sport, "distance_km": distance, "duration_min": duration}


@app.route('/workouts/parse', methods=['POST'])
def parse_workout_line():
    text = request.get_data(as_text=True)
    lines = text.splitlines()
    lines = [line.strip() for line in lines if line.strip()]

    cleaned = []
    errors = []
    for i, line in enumerate(lines, start=1):
        workout = parse_line(line)        # NEW: parse the text line
        error = validate_data(workout)    # REUSE: validate it
        if error is not None:
            errors.append({"row": i, **error})
        else:
            cleaned.append(workout)

    if errors:
        return error_response(errors)   # all-or-nothing

    count = db.add_workouts(cleaned)


    cache.clear()                          # it's a write — invalidate

    return jsonify({"inserted": count}), 201


@app.get('/workouts/<int:workout_id>')
def get_workout_by_id(workout_id):

    workout = db.get_workout_by_id(workout_id)
    if workout is None:
        return error_response([{"error": "Workout not found."}], 404)

    return jsonify(workout)

@app.put("/workouts/<int:workout_id>")
def update_workout(workout_id):
    data = request.get_json(silent=True)
    if data is None:
        return error_response([{"error": "Invalid request body or empty body. Must be JSON."}])
    err = validate_workout_payload(data)
    if err is not None:
        return error_response([err])
    updated = db.update_workout(workout_id, data)
    if updated is None:
        return error_response([{"error": "Workout not found."}], 404)

    cache.clear()
    
    return jsonify(updated)          # 200 is Flask's default

@app.delete("/workouts/<int:workout_id>")
def delete_workout(workout_id):
    if not db.delete_workout(workout_id):
        return error_response([{"error": "Workout not found."}], 404)
    cache.clear()
    return "", 204          # 204 = success, no body

import csv
import io

def to_date(value):
    if not value:
        return None                       # empty → no date
    try:
        return date.fromisoformat(value)                       # turn "2026-11-02" into a date object (hint: date.fromisoformat)
    except ValueError:
        return value                     # keep the text; validate_data() reports it

def to_number(value):
    if not value:
        return None
    try:
        return float(value)
    except ValueError:
        return value        # keep the text; validate_data() reports it
    
def clean_row(row):
    distance_km = row.get("distance_km")
    duration_min = row.get("duration_min")
    return {
        "sport": row.get("sport"),
        "distance_km": to_number(distance_km),
        "duration_min": to_number(duration_min),
        "performed_on": to_date(row.get("performed_on")),
    }

def validate_data(data):
    sport = data.get("sport")
    distance_km = data.get("distance_km")
    duration_min = data.get("duration_min")
    performed_on = data.get("performed_on")

    if sport not in ALLOWED_SPORTS:
        return {"field": "sport", "error": "The key sport is invalid. Must be swim, run, badminton, cycle, strength, or rest."}
    if distance_km is not None and not isinstance(distance_km, (int, float)):
        return {"field": "distance_km", "error": "The key distance_km must be a number."}
    if duration_min is not None and not isinstance(duration_min, (int, float)):
        return {"field": "duration_min", "error": "The key duration_min must be a number."}
    if distance_km is not None and distance_km < 0:
        return {"field": "distance_km", "error": "The key distance_km is invalid. Must not be negative."}
    if duration_min is not None and duration_min < 0:
        return {"field": "duration_min", "error": "The key duration_min is invalid. Must not be negative."}
    if isinstance(duration_min, float) and not duration_min.is_integer():
        return {"field": "duration_min", "error": "The key duration_min must be a whole number."}
    if duration_min is None and sport in ["run", "swim", "cycle", "badminton", "strength"]:
        return {"field": "duration_min", "error": "The key duration_min is missing."}
    if distance_km is None and sport in ["run", "swim", "cycle"]:
        return {"field": "distance_km", "error": "The key distance_km is missing."}

    if performed_on is not None and not isinstance(performed_on, date):
        return {"field": "performed_on", "error": "The key performed_on must be a date like 2026-11-19."}

    return None

def read_csv_upload():
    """Checks the uploaded file. Returns (rows, None), or (None, error response)."""
    file = request.files.get("file")
    if file is None or file.filename == "":
        return None, error_response([{"field": "file", "error": "No file provided."}])
    if not file.filename.lower().endswith(".csv"):
        return None, error_response([{"field": "file", "error": "Only .csv files are accepted."}])
    try:
        text = file.read().decode("utf-8-sig")
    except UnicodeDecodeError:
        return None, error_response([{"field": "file", "error": "The file must be UTF-8 text."}])

    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames is None or "sport" not in reader.fieldnames:
        return None, error_response([{"field": "file", "error": "The file needs a header row with at least a sport column."}])

    rows = list(reader)
    if not rows:
        return None, error_response([{"field": "file", "error": "The file has no workout rows."}])
    if len(rows) > MAX_IMPORT_ROWS:
        return None, error_response([{"field": "file", "error": f"At most {MAX_IMPORT_ROWS} rows per file."}])
    return rows, None


def check_rows(raw_rows):
    """Cleans and validates every row; marks rows that already exist."""
    cleaned = [clean_row(raw) for raw in raw_rows]
    errors = [validate_data(c) for c in cleaned]

    def key(c):
        return (c["sport"], c["distance_km"], c["duration_min"], c["performed_on"] or date.today())

    dates = {key(c)[3] for c, e in zip(cleaned, errors) if e is None}     # dates of the valid rows
    existing = db.existing_workout_keys(dates) if dates else set()

    checked = []
    for i, (clean, error) in enumerate(zip(cleaned, errors), start=1):
        shown = {**clean}
        if isinstance(shown["performed_on"], date):
            shown["performed_on"] = shown["performed_on"].isoformat()
        duplicate = error is None and key(clean) in existing               # is this row's key already in the database?
        checked.append({"row": i, **shown, "error": error, "duplicate": duplicate})
    return checked


@app.route("/workouts/upload", methods=["POST"])
def upload_workout():
    rows, problem = read_csv_upload()
    if problem:
        return problem

    checked = check_rows(rows)
    errors = [{"row": c["row"], **c["error"]} for c in checked if c["error"]]
    if errors:
        return error_response(errors)            # all or nothing

    new_rows = [raw for raw, c in zip(rows, checked) if not c["duplicate"]]
    workouts = [clean_row(r) for r in new_rows]
    count = db.add_workouts(workouts) if workouts else 0
    cache.clear()
    return jsonify({"inserted": count, "skipped": len(rows) - count}), 201

@app.post("/workouts/upload/preview")
def preview_upload():
    rows, problem = read_csv_upload()
    if problem:
        return problem

    checked = check_rows(rows)
    invalid = sum(1 for c in checked if c["error"])
    duplicates = sum(1 for c in checked if c["duplicate"])
    return jsonify({"rows": checked, "valid": len(checked) - invalid, "invalid": invalid, "duplicates": duplicates}), 200

@app.get("/stats/weekly")
def get_weekly_stats():
    try:
        weeks = int(request.args.get("weeks", "8"))
    except ValueError:
        return error_response([{"field": "weeks", "error": "weeks must be a whole number."}])
    if not 1 <= weeks <= 52:
        return error_response([{"field": "weeks", "error": "weeks must be between 1 and 52."}])
    return jsonify({"weeks": weeks, "stats": db.weekly_stats(weeks)})


if __name__ == "__main__":
    app.run(debug=True)