import pytest
from app import app
import cache
import io


@pytest.fixture
def client():
    return app.test_client()

@pytest.fixture(autouse=True)
def clear_cache():
    cache.clear()


def test_invalid_limit_returns_400(client):
    response = client.get("/workouts?limit=abc")
    assert response.status_code == 400
    assert response.get_json()["errors"][0]["field"] == "limit"

def test_non_numeric_id_returns_json_404(client):
    response = client.get("/workouts/abc")
    assert response.status_code == 404
    assert response.get_json() is not None
    assert "errors" in response.get_json()

def test_unknown_id_returns_404(client):
    response = client.get("/workouts/99999")
    assert response.status_code == 404
    assert response.get_json()["errors"] == [{"error": "Workout not found."}]

def test_non_numeric_csv_value_returns_row_error(client):
    data = {"file": (io.BytesIO(b"sport,distance_km,duration_min\nrun,abc,30\nrest,,"), "workouts.csv")}
    response = client.post("/workouts/upload", data=data, content_type="multipart/form-data")
    assert response.status_code == 400
    assert response.get_json()["errors"] == [{"row": 1, "field": "distance_km", "error": "The key distance_km must be a number."}]

def test_put_updates_workout(client):
    created = client.post("/workouts", json={"sport": "run", "distance_km": 5.0, "duration_min": 30})
    workout_id = created.get_json()["id"]

    response = client.put(f"/workouts/{workout_id}", json={"sport": "run", "distance_km": 5.0, "duration_min": 45})
    assert response.status_code == 200
    assert response.get_json()["duration_min"] == 45

    saved = client.get(f"/workouts/{workout_id}")
    assert saved.get_json()["duration_min"] == 45

def test_put_unknown_id_returns_404(client):
    # TODO: PUT /workouts/99999 with valid data → assert 404
    response = client.put("/workouts/99999", json={"sport": "run", "distance_km": 5.0, "duration_min": 33})
    assert response.status_code == 404

def test_put_invalid_data_returns_400(client):
    created = client.post("/workouts", json={"sport": "run", "distance_km": 5.0, "duration_min": 30})
    workout_id = created.get_json()["id"]
    response = client.put(f"/workouts/{workout_id}", json={"sport": "run", "distance_km": 5.0, "duration_min": 33.5})    
    assert response.status_code == 400
    assert response.get_json()["errors"][0]["field"] == "duration_min"

def test_delete_removes_workout(client):
    created = client.post("/workouts", json={"sport": "cycle", "distance_km": 20.0, "duration_min": 75})
    workout_id = created.get_json()["id"]
    response = client.delete(f"/workouts/{workout_id}")
    assert response.status_code == 204

    saved = client.get(f"/workouts/{workout_id}")
    assert saved.status_code == 404

def test_delete_unknown_id_returns_404(client):
    response = client.delete("/workouts/99999")
    assert response.status_code == 404

def test_sort_descending_with_tiebreaker(client):
    a = client.post("/workouts", json={"sport": "run", "distance_km": 5.0, "duration_min": 30}).get_json()["id"]
    b = client.post("/workouts", json={"sport": "run", "distance_km": 10.0, "duration_min": 60}).get_json()["id"]
    c = client.post("/workouts", json={"sport": "cycle", "distance_km": 10.0, "duration_min": 25}).get_json()["id"]

    response = client.get("/workouts?sort=-distance_km")
    ids = [w["id"] for w in response.get_json()["workouts"]]

    assert ids == [b, c, a]      # 10 km before 5 km; the two 10 km ones ordered by id

def test_limit_out_of_range_returns_400(client):
    response = client.get("/workouts?limit=0")
    assert response.status_code == 400
    assert response.get_json()["errors"][0]["field"] == "limit"

    response = client.get("/workouts?limit=101")
    assert response.status_code == 400
    assert response.get_json()["errors"][0]["field"] == "limit"

def test_unknown_sport_returns_400(client):
    response = client.get("/workouts?sport=football")
    assert response.status_code == 400
    assert response.get_json()["errors"][0]["field"] == "sport"

def test_invalid_sort_returns_400(client):
    response = client.get("/workouts?sort=colour")
    assert response.status_code == 400
    assert response.get_json()["errors"][0]["field"] == "sort"