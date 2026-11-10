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