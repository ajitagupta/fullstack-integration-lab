from flask import Flask, request, jsonify
import db
import os
from apscheduler.schedulers.background import BackgroundScheduler
import cache
import re

app = Flask(__name__)

db.init_db()


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
    min_distance = request.args.get("min_distance")
    if min_distance is not None:
        min_distance = float(min_distance)
    min_duration = request.args.get("min_duration")
    if min_duration is not None:
        min_duration = float(min_duration)

    limit = request.args.get("limit")
    limit = int(limit) if limit is not None else 2

    offset = request.args.get("offset")
    offset = int(offset) if offset is not None else 0

    # --- cache check ---
    key = cache.make_key("workouts:list", request.args.to_dict())
    cached = cache.get(key)
    if cached is not None:
        resp = jsonify(cached)
        resp.headers["X-Cache"] = "HIT"
        return resp

    # --- cache miss: do the real work ---
    workouts = db.search_workouts(sport, min_distance, min_duration, limit, offset)
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

@app.route("/workouts", methods=["POST"])
def create_workout():
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Invalid request body or empty body. Must be JSON."}), 400
    if data.get("sport") is None or data.get("sport") == "":
        return jsonify({"error": "The key sport is missing or empty. Must be swim, run, badminton, cycle, strength, or rest."}), 400

    allowed_sports = ["swim", "run", "badminton", "cycle", "strength", "rest"]
    sport = data["sport"]
    if sport not in allowed_sports:
        return jsonify({"error": "The key sport is invalid. Must be swim, run, badminton, cycle, strength, or rest."}), 400

    optional_distance = data.get("distance_km")
    optional_duration = data.get("duration_min")
    if optional_duration is None and (sport in ["run", "swim", "cycle", "badminton", "strength"]):
        return jsonify({"error": "The key duration_min is missing."}), 400
    if optional_distance is None and (sport in ["run", "swim", "cycle"]):
        return jsonify({"error": "The key distance_km is missing."}), 400

    if optional_duration is not None and not isinstance(optional_duration, (int, float)):
        return jsonify({"error": "The key duration_min must be a number."}), 400
    if optional_distance is not None and not isinstance(optional_distance, (int, float)):
        return jsonify({"error": "The key distance_km must be a number."}), 400

    if optional_duration is not None and optional_duration < 0:
        return jsonify({"error": "The key duration_min must be a positive number or 0."}), 400
    if optional_distance is not None and optional_distance < 0:
        return jsonify({"error": "The key distance_km must be a positive number or 0."}), 400

    cache.clear()          # data changed — stale reads must go

    return jsonify(db.add_workout(data))

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
            errors.append(f"Line {i}: {error}")
        else:
            cleaned.append(workout)

    if errors:
        return jsonify({"errors": errors}), 400   # all-or-nothing

    for workout in cleaned:
        db.add_workout(workout)

    cache.clear()                          # it's a write — invalidate

    return jsonify({"inserted": len(cleaned)}), 201


@app.get('/workouts/<int:workout_id>')
def get_workout_by_id(workout_id):

    workout = db.get_workout_by_id(workout_id)
    if workout is None:
        return jsonify({"error": "Workout not found."}), 404

    return jsonify(workout)

import csv
import io


def clean_row(row):
    distance_km = row.get("distance_km")
    duration_min = row.get("duration_min")
    return {
        "sport": row.get("sport"),
        "distance_km": float(distance_km) if distance_km else None,
        "duration_min": float(duration_min) if duration_min else None,
    }

def validate_data(data):
    sport = data.get("sport")
    distance_km = data.get("distance_km")
    duration_min = data.get("duration_min")

    allowed_sports = ["swim", "run", "badminton", "cycle", "strength", "rest"]
    if sport not in allowed_sports:
        return "The key sport is invalid. Must be swim, run, badminton, cycle, strength, or rest."
    if distance_km is not None and distance_km < 0:
        return "The key distance_km is invalid. Must not be negative."
    if duration_min is not None and duration_min < 0:
        return "The key duration_min is invalid. Must not be negative."
    if duration_min is None and sport in ["run", "swim", "cycle", "badminton", "strength"]:
        return "The key duration_min is missing."
    if distance_km is None and sport in ["run", "swim", "cycle"]:
        return "The key distance_km is missing."

    return None

@app.route('/workouts/upload', methods=['POST'])
def upload_workout():

    file = request.files.get('file')

    if file is None:
        return jsonify({"error": "No file provided."}), 400

    text = file.read().decode("utf-8")
    reader = csv.DictReader(io.StringIO(text))
    workouts = list(reader)

    cleaned = []
    errors = []

    for i, raw_row in enumerate(workouts, start=1):
        clean = clean_row(raw_row)    # clean this one row
        error = validate_data(clean)  # validate the cleaned row
        if error is not None:
            errors.append(f"Row {i}: {error}")
        else:
            cleaned.append(clean)

    # all-or-nothing decision, AFTER the loop:
    if errors:
        return jsonify({"errors": errors}), 400  # something failed -> insert nothing

    for workout in cleaned:
        db.add_workout(workout)

    cache.clear()          # data changed — stale reads must go

    return jsonify({"inserted": len(cleaned)}), 201

if __name__ == "__main__":
    app.run(debug=True)