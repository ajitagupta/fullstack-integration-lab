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

# File extension → converter. A new format = a new entry here.
CONVERTERS = {
    ".csv": csv_rows,
    ".gpx": gpx_rows,
}