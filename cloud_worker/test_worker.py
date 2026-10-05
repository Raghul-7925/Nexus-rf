import pytest
import io
import csv
from fastapi.testclient import TestClient

from main import app
from db import init_db, SessionLocal, CapturedSite, WorkerSession
from districts import get_states, get_district_bounds, generate_district_slides
from scraper import web_mercator_to_wgs84, normalize_tower_type, worker_instance

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_test_db():
    init_db()
    with SessionLocal() as db:
        db.query(CapturedSite).delete()
        db.query(WorkerSession).delete()
        db.commit()
    yield
    with SessionLocal() as db:
        db.query(CapturedSite).delete()
        db.query(WorkerSession).delete()
        db.commit()


def test_web_mercator_conversion():
    # Test known coordinates (approx Pondicherry/Chennai coordinates)
    # EPSG:3857 center: x ~ 8884224, y ~ 1339184
    x, y = 8884224.0, 1339184.0
    lat, lng = web_mercator_to_wgs84(x, y)
    assert 11.0 <= lat <= 13.0
    assert 79.0 <= lng <= 81.0


def test_tower_type_normalization():
    assert normalize_tower_type("ROOFTOP POLE") == "Rooftop (Blue)"
    assert normalize_tower_type("GROUND BASED TOWER (GBT)") == "Ground Based (Green)"
    assert normalize_tower_type("COW WHEEL") == "COW (Orange)"
    assert normalize_tower_type(None) == "Rooftop (Blue)"


def test_district_slides_generation():
    bounds = (11.82, 79.70, 12.05, 79.90)  # Pondicherry bounds
    slides = generate_district_slides(bounds, step_lat=0.022, step_lng=0.026)
    assert len(slides) > 0
    first = slides[0]
    assert "swLat" in first and "neLat" in first
    assert "swLng" in first and "neLng" in first
    assert first["swLat"] >= 11.80
    assert first["neLat"] <= 12.10


def test_parse_payload_records():
    sample_payload = {
        "Table": [
            {
                "SiteId": "TS_TEST_001",
                "latitude": 11.9401,
                "longitude": 79.4861,
                "Tower_Type": "Rooftop"
            },
            {
                "SiteId": "TS_TEST_002",
                "location_latitude": "11.9500",
                "location_longitude": "79.4900",
                "site_type": "Ground Based Tower"
            }
        ]
    }
    sites = worker_instance.parse_payload(sample_payload, "Tamil Nadu", "Villupuram")
    assert len(sites) == 2
    assert sites[0]["site_id"] == "TS_TEST_001"
    assert sites[0]["latitude"] == 11.9401
    assert sites[0]["tower_type"] == "Rooftop (Blue)"
    assert sites[0]["color_code"] == "Blue"
    assert sites[1]["site_id"] == "TS_TEST_002"
    assert sites[1]["tower_type"] == "Ground Based (Green)"
    assert sites[1]["color_code"] == "Green"


def test_api_districts_list():
    res = client.get("/api/worker/districts")
    assert res.status_code == 200
    data = res.json()
    assert "Tamil Nadu" in data["states"]
    assert "Puducherry" in data["states"]
    assert "Villupuram" in data["districts"]["Tamil Nadu"]


def test_api_session_lifecycle():
    # 1. No session initially
    res = client.get("/api/worker/session")
    assert res.status_code == 200
    assert res.json()["has_session"] is False

    # 2. Set session
    res = client.post("/api/worker/session", json={"cookie": "ASP.NET_SessionId=xyz123; token=abc"})
    assert res.status_code == 200
    assert res.json()["success"] is True

    # 3. Session now active
    res = client.get("/api/worker/session")
    assert res.status_code == 200
    assert res.json()["has_session"] is True


def test_api_towers_and_csv_export():
    # Insert test site
    with SessionLocal() as db:
        s = CapturedSite(
            site_id="SITE_CLOUD_999",
            latitude=11.9300,
            longitude=79.8300,
            tower_type="Rooftop (Blue)",
            color_code="Blue",
            city="Ozhukarai",
            state="Puducherry",
            district="Pondicherry"
        )
        db.add(s)
        db.commit()

    # Query towers API
    res = client.get("/api/worker/towers")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 1
    assert data["items"][0]["site_id"] == "SITE_CLOUD_999"
    assert data["items"][0]["color_code"] == "Blue"
    assert data["items"][0]["city"] == "Ozhukarai"

    # Export CSV - verify ONLY requested columns and no extra data
    csv_res = client.get("/api/worker/export/csv")
    assert csv_res.status_code == 200
    reader = csv.reader(io.StringIO(csv_res.text))
    rows = list(reader)
    header = rows[0]
    assert header == ["site_id", "latitude", "longitude", "tower_type", "city"]
    assert len(rows) == 2
    assert rows[1][0] == "SITE_CLOUD_999"
    assert rows[1][1] == "11.930000"
    assert rows[1][2] == "79.830000"
    assert rows[1][3] == "Rooftop (Blue)"
    assert rows[1][4] == "Ozhukarai"


def test_dashboard_endpoint():
    res = client.get("/")
    assert res.status_code == 200
    assert "Nexus RF" in res.text
    assert "Autonomous Cloud Tower Fetcher" in res.text


def test_compatibility_with_nexus_rf_parser():
    import sys
    from pathlib import Path
    backend_path = Path(__file__).parent.parent / "backend"
    sys.path.insert(0, str(backend_path))

    from app.services.import_parser import parse_import

    with SessionLocal() as db:
        s = CapturedSite(
            site_id="SITE_TN_777",
            latitude=11.9401,
            longitude=79.4861,
            tower_type="Ground Based (Green)",
            color_code="Green",
            city="Villupuram",
            state="Tamil Nadu",
            district="Villupuram"
        )
        db.add(s)
        db.commit()

    csv_res = client.get("/api/worker/export/csv")
    assert csv_res.status_code == 200

    parsed_towers = parse_import(csv_res.text, "tarangsanchar_cloud.csv")
    assert len(parsed_towers) >= 1
    found = next((t for t in parsed_towers if t.get("site_id") == "SITE_TN_777"), None)
    assert found is not None
    assert found["lat"] == 11.9401
    assert found["lng"] == 79.4861
    assert "Ground Based" in found["tower_type"]


def test_all_india_districts_and_queue():
    from districts import get_states, get_districts_for_state, get_all_india_queue
    states = get_states()
    assert "All India (Entire Country)" in states
    assert "Tamil Nadu" in states
    assert "Maharashtra" in states
    assert "Delhi NCR" in states
    assert "Uttar Pradesh" in states

    all_dists = get_districts_for_state("All India (Entire Country)")
    assert "All Districts (Full Country Auto-Sweep)" in all_dists

    queue = get_all_india_queue()
    assert len(queue) >= 150  # Over 150 districts across all 28 states & UTs
    # Verify tuple structure (state, district)
    for s, d in queue[:10]:
        assert isinstance(s, str) and len(s) > 0
        assert isinstance(d, str) and len(d) > 0


def test_start_all_india_endpoint():
    # Session must be active (seeded by earlier test)
    res = client.post("/api/worker/start-all-india")
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["total_districts"] >= 150

    # Verify worker status reports all-india mode
    status_res = client.get("/api/worker/status")
    assert status_res.status_code == 200
    st = status_res.json()
    assert st["is_running"] is True
    assert st["is_all_india"] is True
    assert st["total_districts"] >= 150

    # Stop worker cleanly
    client.post("/api/worker/stop")





