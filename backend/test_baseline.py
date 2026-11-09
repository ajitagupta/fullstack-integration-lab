import pytest
from app import app
import cache
import io
from app import parse_line

@pytest.fixture
def client():
    return app.test_client()

@pytest.fixture(autouse=True)
def clear_cache():
    cache.clear()

def test_valid_workout_returns_200(client):
    response = client.post("/workouts", json={"sport": "run", "distance_km": 5, "duration_min": 30})
    assert response.status_code == 200 # should be 201 — fix deliberately when defining the API contract
    body = response.get_json()
    assert "id" in body
    assert body["sport"] == "run"
    assert body["distance_km"] == 5
    assert body["duration_min"] == 30

def test_invalid_workout_returns_400(client):
    response = client.post("/workouts", json={"sport": "run", "duration_min": 30})
    assert response.status_code == 400
    assert response.get_json()["error"] == "The key distance_km is missing."

def test_filter_by_sport_returns_sport(client):
    client.post("/workouts", json={"sport": "run", "distance_km": 5, "duration_min": 30})
    client.post("/workouts", json={"sport": "swim", "distance_km": 1.5, "duration_min": 48})
    response = client.get("/workouts?sport=run")
    workouts = response.get_json()["workouts"]
    assert len(workouts) > 0  # otherwise the loop below proves nothing
    for workout in workouts:
        assert workout["sport"] == "run"

def test_pagination_returns_page_and_total(client):
    before = client.get("/workouts").get_json()["total"]          # total from a first GET
    for i in range(1, 4):                                         # create 3 valid workouts
        client.post("/workouts", json={"sport": "run", "distance_km": i, "duration_min": 30*i})
    response = client.get("/workouts?limit=2&offset=0")           # limit=2, offset=0
    body = response.get_json()
    assert len(body["workouts"]) == 2                             # page size
    assert body["limit"] == 2                                     # limit and offset echoed back
    assert body["offset"] == 0 
    assert before + 3 == body["total"]                            # total grew by exactly 3

def test_valid_CSV_imports_every_row(client):
    before = client.get("/workouts").get_json()["total"]          # total from a first GET
    data = {"file": (io.BytesIO(b"sport,distance_km,duration_min\nrun,5,30\nswim,1.5,48\nrest,,"), "workouts.csv")}
    response = client.post("/workouts/upload", data=data, content_type="multipart/form-data")
    assert response.status_code == 201
    assert response.get_json()["inserted"] == 3
    response = client.get("/workouts")
    body = response.get_json()
    assert before+3 == body["total"]

def test_invalid_row_doesnt_import(client):
    before = client.get("/workouts").get_json()["total"]          # total from a first GET
    data = {"file": (io.BytesIO(b"sport,distance_km,duration_min\nrun,5,30\nswim,,48\nrest,,"), "workouts.csv")}
    response = client.post("/workouts/upload", data=data, content_type="multipart/form-data")
    assert response.status_code == 400
    assert response.get_json()["errors"] == ["Row 2: The key distance_km is missing."]
    response = client.get("/workouts")
    body = response.get_json()
    assert before == body["total"]

def test_workout_parser(client):
    before = client.get("/workouts").get_json()["total"]          # total from a first GET
    response = client.post("/workouts/parse", data="ran 5 km in 30 min", content_type="text/plain")
    assert response.status_code == 201
    assert response.get_json()["inserted"] == 1
    response = client.get("/workouts")
    assert before + 1 == response.get_json()["total"]

def test_parse_line_extracts_fields():
    result = parse_line("ran 5 km in 30 min")
    assert result == {"sport": "run", "distance_km": 5.0, "duration_min": 30}

def test_fractional_duration_returns_400(client):
    response = client.post("/workouts", json={"sport": "run", "distance_km": 5, "duration_min": 30.5})
    assert response.status_code == 400
    assert "duration_min" in response.get_json()["error"]

def test_whole_float_duration_is_accepted(client):
    response = client.post("/workouts", json={"sport": "run", "distance_km": 5, "duration_min": 30.0})
    assert response.status_code == 200
    assert response.get_json()["duration_min"] == 30