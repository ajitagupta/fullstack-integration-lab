import csv
import io
import re

class ImportFileError(Exception):
    """The file can't be read as this format. The message is shown to the user."""


from datetime import datetime

STRAVA_TYPES = {
    "run": "run", "trail run": "run",
    "ride": "cycle", "virtual ride": "cycle",
    "swim": "swim",
    "weight training": "strength",
    "badminton": "badminton",
}


def csv_rows(data: bytes) -> list[dict]:
    text = data.decode("utf-8-sig")
    reader = csv.reader(io.StringIO(text))
    header = next(reader, None)                                          # the first line, or None for an empty file
    body = [row for row in reader if any(cell.strip() for cell in row)]  # skip blank lines

    if header is not None and "Activity Type" in header:
        return strava_rows(header, body)
    if header is None or "sport" not in header:
        raise ImportFileError("The file needs a header row with at least a sport column.")
    return [dict(zip(header, row)) for row in body]                     # your own format, as before


def strava_rows(header: list[str], body: list[list[str]]) -> list[dict]:
    def column(row, name):
        """The value in the FIRST column with this name (Strava repeats some names)."""
        if name not in header:
            return ""
        i = header.index(name)             # .index() returns the first match
        return row[i] if i < len(row) else ""

    rows = []
    for row in body:
        activity = column(row, "Activity Type").strip().lower()
        seconds = column(row, "Moving Time") or column(row, "Elapsed Time")
        rows.append({
            "sport": STRAVA_TYPES.get(activity, activity),
            "distance_km": column(row, "Distance"),
            "duration_min": seconds_to_minutes(seconds),
            "performed_on": strava_date(column(row, "Activity Date")),
        })
    return rows


def seconds_to_minutes(text: str) -> str:
    try:
        return str(round(float(text) / 60))
    except ValueError:
        return text            # empty or not a number: validation reports it


def strava_date(text: str) -> str:
    try:
        return datetime.strptime(text, "%b %d, %Y, %I:%M:%S %p").date().isoformat()
    except ValueError:
        return text            # unknown format: validation reports "must be a date"

import math
from datetime import datetime
from defusedxml import DefusedXmlException
from defusedxml import ElementTree as SafeET

GPX_NS = {"gpx": "http://www.topografix.com/GPX/1/1"}

# Activity names in Garmin/Strava exports → our sports. Unknown names pass through; validation reports them.
ACTIVITY_TO_SPORT = {
    "running": "run", "run": "run", "trail_running": "run",
    "cycling": "cycle", "biking": "cycle", "road_biking": "cycle",
    "swimming": "swim", "lap_swimming": "swim", "open_water_swimming": "swim",
}


def distance_km(a, b):
    """Great-circle distance between two (lat, lon) points (haversine formula)."""
    R = 6371.0
    lat1, lat2 = math.radians(a[0]), math.radians(b[0])
    dlat = lat2 - lat1
    dlon = math.radians(b[1] - a[1])
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def gpx_rows(data: bytes) -> list[dict]:
    try:
        root = SafeET.fromstring(data)
    except (SafeET.ParseError, DefusedXmlException):
        raise ImportFileError("The file is not a valid GPX file.")

    points = root.findall(".//gpx:trkpt", GPX_NS)
    if len(points) < 2:
        raise ImportFileError("The GPX file needs a track with at least two points.")

    coords = [(float(p.get("lat")), float(p.get("lon"))) for p in points]
    first_time = points[0].findtext("gpx:time", namespaces=GPX_NS)
    last_time = points[-1].findtext("gpx:time", namespaces=GPX_NS)
    if first_time is None or last_time is None:
        raise ImportFileError("The GPX track has no timestamps.")

    start = datetime.fromisoformat(first_time)          # handles the trailing "Z"
    end = datetime.fromisoformat(last_time)

    total = sum(distance_km(coords[i], coords[i + 1]) for i in range(len(coords) - 1))
    minutes = (end - start).total_seconds() / 60
    activity = root.findtext(".//gpx:trk/gpx:type", default="", namespaces=GPX_NS).strip().lower()

    # One workout per file, as text, exactly like a CSV row, so the same cleaning and validation apply
    return [{
        "sport": ACTIVITY_TO_SPORT.get(activity, activity),
        "distance_km": str(round(total, 2)),
        "duration_min": str(round(minutes)),
        "performed_on": start.date().isoformat(),                             # the date of `start`, as "2026-11-14"
    }]

import io
import fitdecode


def fit_rows(data: bytes) -> list[dict]:
    rows = []
    try:
        with fitdecode.FitReader(io.BytesIO(data)) as reader:       # FitReader wants a file, so wrap the bytes
            for frame in reader:
                if isinstance(frame, fitdecode.FitDataMessage) and frame.name == "session":    # the summary message
                    rows.append(session_to_row(frame))
    except fitdecode.FitError:
        raise ImportFileError("The file is not a valid FIT file.")
    return rows


def session_to_row(session) -> dict:
    sport = str(session.get_value("sport", fallback="")).lower()
    distance_m = session.get_value("total_distance", fallback=None)                   # in metres
    seconds = session.get_value("total_timer_time", fallback=None)                    # moving time, without pauses
    start = session.get_value("start_time", fallback=None)                            # a datetime

    return {
        "sport": ACTIVITY_TO_SPORT.get(sport, sport),
        "distance_km": "" if distance_m is None else str(round(distance_m / 1000, 2)),
        "duration_min": "" if seconds is None else str(round(seconds / 60)),
        "performed_on": "" if start is None else start.date().isoformat(),                                 # same as in gpx_rows
    }

# File extension → converter. A new format = a new entry here.
CONVERTERS = {
    ".csv": csv_rows,
    ".gpx": gpx_rows,
    ".fit": fit_rows,
}

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

def text_rows(data: bytes) -> list[dict]:
    """One workout per non-empty line, e.g. "ran 5 km in 30 min"."""
    lines = [line.strip() for line in data.decode("utf-8").splitlines() if line.strip()]
    return [parse_line(line) for line in lines]