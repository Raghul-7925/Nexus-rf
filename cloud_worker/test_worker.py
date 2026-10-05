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
    assert normalize_tower_type("ROOFTOP POLE") == "Rooftop"
    assert normalize_tower_type("GROUND BASED TOWER (GBT)") == "Ground Based"
    assert normalize_tower_type("COW WHEEL") == "COW"
    assert normalize_tower_type(None) == "Rooftop"


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
    assert sites[0]["tower_type"] == "Rooftop"
    assert sites[1]["site_id"] == "TS_TEST_002"
    assert sites[1]["tower_type"] == "Ground Based"


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
            tower_type="Rooftop",
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

    # Export CSV
    csv_res = client.get("/api/worker/export/csv")
    assert csv_res.status_code == 200
    reader = csv.reader(io.StringIO(csv_res.text))
    rows = list(reader)
    header = rows[0]
    assert "site_id" in header
    assert "latitude" in header
    assert "longitude" in header
    assert "tower_type" in header
    assert len(rows) == 2
    assert rows[1][0] == "SITE_CLOUD_999"


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
            tower_type="Ground Based",
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
    assert found["tower_type"] == "Ground Based"



