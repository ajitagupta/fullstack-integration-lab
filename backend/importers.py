import csv
import io


class ImportFileError(Exception):
    """The file can't be read as this format. The message is shown to the user."""


def csv_rows(data: bytes) -> list[dict]:
    text = data.decode("utf-8-sig")                     # UnicodeDecodeError is handled by the caller
    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames is None or "sport" not in reader.fieldnames:
        raise ImportFileError("The file needs a header row with at least a sport column.")
    return list(reader)


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
