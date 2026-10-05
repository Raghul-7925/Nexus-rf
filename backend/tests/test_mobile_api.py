import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.models import Base, Tower, DriveTestPoint
from app.db.session import get_db

# In-memory SQLite DB for testing with StaticPool
TEST_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        # Seed test tower
        session.add(Tower(
            name="Test Airtel Site",
            lat=13.0827,
            lng=80.2707,
            operator="Airtel",
            technology="4G",
            freq_mhz=1800,
            power_dbm=43,
            height_m=30,
            site_id="12345",
            cell_id="3160321",
            source="tarangsanchar"
        ))
        session.commit()
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()

def test_locate_tower_by_enb(client):
    res = client.get("/api/mobile/locate-tower?mcc=404&mnc=10&enb=12345")
    assert res.status_code == 200
    data = res.json()
    assert data is not None
    assert data["site_id"] == "12345"
    assert data["operator"] == "Airtel"

def test_sync_drive_test_points(client):
    payload = {
        "session_id": "session-xyz",
        "points": [
            {
                "timestamp": 1727700000,
                "lat": 13.0825,
                "lng": 80.2705,
                "gps_accuracy_m": 4.5,
                "operator": "Airtel",
                "technology": "4G",
                "band_name": "Band 3 (1800 MHz)",
                "cid": 3160321,
                "enodeb_id": 12345,
                "pci": 210,
                "rsrp": -85,
                "rsrq": -10,
                "sinr": 18,
                "timing_advance": 2
            }
        ]
    }
    res = client.post("/api/mobile/drive-test/sync", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["session_id"] == "session-xyz"
    assert data["points_saved"] == 1

def test_get_offline_pack(client):
    res = client.get("/api/mobile/offline-pack?lat=13.0827&lng=80.2707&radius_km=10")
    assert res.status_code == 200
    towers = res.json()
    assert len(towers) >= 1
    assert towers[0]["site_id"] == "12345"
