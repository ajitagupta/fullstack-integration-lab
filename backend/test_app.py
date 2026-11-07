import pytest
from app import app
import cache

@pytest.fixture
def client():
    return app.test_client()

@pytest.fixture(autouse=True)
def clear_cache():
    cache.clear()

def test_second_read_is_cache_hit(client):
    client.get("/workouts")                    # first call -> populates cache (MISS)
    response = client.get("/workouts")         # second call -> should be HIT
    assert response.headers["X-Cache"] == "HIT"

def test_post_invalidates_cache(client):
    client.get("/workouts")                    # populate the cache
    client.post("/workouts", json={"sport": "run", "distance_km": 5, "duration_min": 30})
    response = client.get("/workouts")          # cache was cleared, so this recomputes
    assert response.headers["X-Cache"] == "MISS"

def test_post_shows_new_data_after_invalidation(client):
    first = client.get("/workouts").get_json()
    before = first["total"]
    client.post("/workouts", json={"sport": "run", "distance_km": 5, "duration_min": 30})
    after = client.get("/workouts").get_json()["total"]
    assert after == before + 1