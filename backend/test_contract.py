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

def test_weekly_stats_sums_per_sport(client):
    client.post("/workouts", json={"sport": "run", "distance_km": 5.0, "duration_min": 30})
    client.post("/workouts", json={"sport": "run", "distance_km": 10.0, "duration_min": 60})
    client.post("/workouts", json={"sport": "swim", "distance_km": 1.5, "duration_min": 40})

    response = client.get("/stats/weekly?weeks=1")

    assert response.status_code == 200
    stats = response.get_json()["stats"]
    assert [(s["sport"], s["workouts"], s["distance_km"], s["duration_min"]) for s in stats] == [
        ("run", 2, 15.0, 90),
        ("swim", 1, 1.5, 40),
    ]

@pytest.mark.parametrize("weeks", ["0", "53", "abc"])
def test_weekly_stats_rejects_invalid_weeks(client, weeks):
    response = client.get(f"/stats/weekly?weeks={weeks}")
    assert response.status_code == 400
    assert response.get_json()["errors"][0]["field"] == "weeks"

def upload(client, content: bytes, filename="workouts.csv"):
    data = {"file": (io.BytesIO(content), filename)}
    return client.post("/workouts/upload", data=data, content_type="multipart/form-data")

def test_upload_accepts_excel_bom(client):
    response = upload(client, b"\xef\xbb\xbfsport,distance_km,duration_min\nrun,5,30\n")
    assert response.status_code == 201
    assert response.get_json()["inserted"] == 1

@pytest.mark.parametrize("content, filename", [
    (b"sport,distance_km,duration_min\nrun,5,30\n", "workouts.txt"),     # wrong type
    (b"\xff\xfe\x00\x00binary", "workouts.csv"),                          # not UTF-8
    (b"distance_km,duration_min\n5,30\n", "workouts.csv"),               # no sport column
    (b"sport,distance_km,duration_min\n", "workouts.csv"),               # header only
])
def test_upload_rejects_bad_files(client, content, filename):
    response = upload(client, content, filename)
    assert response.status_code == 400
    assert response.get_json()["errors"][0]["field"] == "file"

def test_upload_rejects_too_many_rows(client):
    rows = b"sport,distance_km,duration_min\n" + b"run,5,30\n" * 1001
    response = upload(client, rows)
    assert response.status_code == 400

def test_upload_rejects_large_file(client):
    response = upload(client, b"sport\n" + b"rest\n" * 300_000)        # ~1.5 MB
    assert response.status_code == 413
    assert response.get_json()["errors"][0]["field"] == "file"

def preview(client, content: bytes, filename="workouts.csv"):
    data = {"file": (io.BytesIO(content), filename)}
    return client.post("/workouts/upload/preview", data=data, content_type="multipart/form-data")

def test_preview_reports_every_row_and_saves_nothing(client):
    response = preview(client, b"sport,distance_km,duration_min\nswim,1.5,40\nrun,,30\n")

    assert response.status_code == 200
    body = response.get_json()
    assert (body["valid"], body["invalid"]) == (1, 1)
    assert body["rows"][0]["error"] is None
    assert body["rows"][1]["error"]["field"] == "distance_km"
    assert client.get("/workouts").get_json()["total"] == 0      # nothing was saved

def test_preview_rejects_bad_files_like_upload(client):
    response = preview(client, b"distance_km\n5\n")
    assert response.status_code == 400
    assert response.get_json()["errors"][0]["field"] == "file"

def test_upload_uses_performed_on(client):
    response = upload(client, b"sport,distance_km,duration_min,performed_on\nrun,5,30,2026-11-02\n")
    assert response.status_code == 201
    stats = client.get("/stats/weekly?weeks=52").get_json()["stats"]
    assert stats[0]["week_start"] == "2026-11-02"

def test_upload_rejects_invalid_date(client):
    response = upload(client, b"sport,distance_km,duration_min,performed_on\nrun,5,30,2026-13-40\n")
    assert response.status_code == 400
    assert response.get_json()["errors"][0]["field"] == "performed_on"

def test_second_upload_skips_duplicates(client):
    csv_file = b"sport,distance_km,duration_min,performed_on\nrun,5,30,2026-11-02\nswim,1.5,40,2026-11-03\n"
    first = upload(client, csv_file)
    second = upload(client, csv_file)

    assert first.get_json() == {"inserted": 2, "skipped": 0}
    assert second.get_json() == {"inserted": 0, "skipped": 2}
    assert client.get("/workouts").get_json()["total"] == 2        # not 4

def test_preview_marks_duplicates(client):
    upload(client, b"sport,distance_km,duration_min,performed_on\nrun,5,30,2026-11-02\n")
    response = preview(client, b"sport,distance_km,duration_min,performed_on\nrun,5,30,2026-11-02\nrun,8,45,2026-11-02\n")

    body = response.get_json()
    assert [r["duplicate"] for r in body["rows"]] == [True, False]
    assert body["duplicates"] == 1

def test_one_bad_row_saves_nothing(client):
    rows = (b"sport,distance_km,duration_min\n"
            + b"run,5,30\n" * 250
            + b"run,,30\n"                  # row 251: no distance
            + b"swim,1,20\n" * 249)
    response = upload(client, rows)

    assert response.status_code == 400
    assert response.get_json()["errors"] == [{"row": 251, "field": "distance_km", "error": "The key distance_km is missing."}]
    assert client.get("/workouts").get_json()["total"] == 0      # not 499

GPX = b"""<?xml version="1.0"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1"><trk><type>running</type><trkseg>
<trkpt lat="47.000" lon="8.000"><time>2026-11-14T10:00:00Z</time></trkpt>
<trkpt lat="47.009" lon="8.000"><time>2026-11-14T10:06:00Z</time></trkpt>
</trkseg></trk></gpx>"""

def test_preview_reads_gpx(client):
    response = preview(client, GPX, "run.gpx")
    row = response.get_json()["rows"][0]
    assert (row["sport"], row["distance_km"], row["duration_min"], row["performed_on"]) == ("run", 1.0, 6.0, "2026-11-14")
    assert row["error"] is None

def test_upload_rejects_broken_gpx(client):
    response = upload(client, b"<gpx><trk>", "run.gpx")
    assert response.status_code == 400
    assert response.get_json()["errors"][0]["field"] == "file"

import os

SAMPLES = os.path.join(os.path.dirname(__file__), "..", "samples")

def test_preview_reads_fit(client):
    with open(os.path.join(SAMPLES, "evening-ride.fit"), "rb") as f:
        response = preview(client, f.read(), "ride.fit")
    row = response.get_json()["rows"][0]
    assert (row["sport"], row["distance_km"], row["duration_min"], row["performed_on"]) == ("cycle", 20.0, 45.0, "2026-11-17")
    assert row["error"] is None

def test_upload_rejects_broken_fit(client):
    response = upload(client, b"this is not a fit file", "ride.fit")
    assert response.status_code == 400
    assert response.get_json()["errors"][0]["field"] == "file"

def test_preview_reads_strava_export(client):
    with open(os.path.join(SAMPLES, "strava-activities.csv"), "rb") as f:
        response = preview(client, f.read(), "activities.csv")
    rows = response.get_json()["rows"]
    assert [(r["sport"], r["distance_km"], r["duration_min"], r["performed_on"]) for r in rows] == [
        ("run", 6.1, 32.0, "2026-11-10"),          # 6.1 km, not 6100: the FIRST "Distance" column
        ("cycle", 25.4, 60.0, "2026-11-12"),
        ("swim", 1.8, 40.0, "2026-11-13"),
        ("strength", 0.0, 55.0, "2026-11-15"),
    ]
    assert all(r["error"] is None for r in rows)