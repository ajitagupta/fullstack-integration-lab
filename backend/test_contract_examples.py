import json
import os

import pytest

import cache
from app import app

CONTRACTS = os.path.join(os.path.dirname(__file__), "..", "contracts")


@pytest.fixture
def client():
    cache.clear()
    return app.test_client()


def save(name, body):
    os.makedirs(CONTRACTS, exist_ok=True)
    with open(os.path.join(CONTRACTS, name), "w", encoding="utf-8") as f:
        json.dump(body, f, indent=2, sort_keys=True)
        f.write("\n")


def test_write_example_responses(client):
    workout = client.post("/workouts", json={"sport": "run", "distance_km": 5.0, "duration_min": 30}).get_json()
    save("workout.json", workout)
    save("workout-list.json", client.get("/workouts").get_json())
    save("weekly-stats.json", client.get("/stats/weekly?weeks=52").get_json())

    csv_file = b"sport,distance_km,duration_min\nswim,1.5,40\nrun,,30\n"
    preview = client.post("/workouts/upload/preview",
                          data={"file": (__import__("io").BytesIO(csv_file), "w.csv")},
                          content_type="multipart/form-data")
    save("upload-preview.json", preview.get_json())

    result = client.post("/workouts/parse", data="swam 1 km 25 min", content_type="text/plain")
    save("import-result.json", result.get_json())

    error = client.post("/workouts", json={"sport": "run"})
    assert error.status_code == 400
    save("error.json", error.get_json())