import re

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

# test it directly:
tests = [
    "Went for a 6km run, 35 min",
    "Rest day",
    "Badminton for 90 minutes",
    "Swam 0.4km in 27 minutes",
    "ran 10k this morning",           # "10k" not "10km" — does distance match?
    "quick 5 km jog",                 # "jog" — is that a sport your pattern knows?
    "cycling 20km 45min",             # "cycling" — does it match "cycle"?
    "swim",                           # just a sport, nothing else
    "did nothing today",              # no sport at all — what's returned?
    ]
for line in tests:
    print(line, "->", parse_line(line))