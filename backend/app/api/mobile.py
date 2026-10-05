"""
app/api/mobile.py

Three endpoints that serve the Nexus RF Android companion app:

  GET  /api/mobile/locate-tower   → instant tower lookup from Tarang Sanchar DB
  POST /api/mobile/drive-test/sync → store drive-test GPS+cell log from Android
  GET  /api/mobile/offline-pack   → download all towers in a radius for offline use
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional
import math

from ..db.session import get_db
from ..db.models import Tower, DriveTestPoint
from ..schemas import TowerOut

router = APIRouter(prefix="/api/mobile", tags=["mobile"])


# ──────────────────────────────────────────────────────────────────
#  1. Instant tower lookup by Cell Identity
# ──────────────────────────────────────────────────────────────────
@router.get("/locate-tower", response_model=Optional[TowerOut])
def locate_tower(
    mcc: int = Query(..., description="Mobile Country Code (India=404/405)"),
    mnc: int = Query(..., description="Mobile Network Code (Airtel=10, Jio=50...)"),
    cid: Optional[int] = Query(None, description="Full Cell ID (28-bit for LTE)"),
    enb: Optional[int] = Query(None, description="eNodeB ID = CID >> 8"),
    db: Session = Depends(get_db)
):
    """
    Resolve a cell tower from the Tarang Sanchar baseline.

    Priority:
    1. Match by (site_id = eNodeB) + operator derived from MCC+MNC
    2. Match by cell_id = cid
    3. Match by closest site_id numerically (best-effort)
    """
    op = _mnc_to_operator(mnc)

    if enb:
        # Primary: match eNodeB ID stored in site_id field
        tower = db.query(Tower).filter(
            Tower.site_id == str(enb),
            Tower.operator.ilike(f"%{op}%") if op else True,
            Tower.source.in_(["tarangsanchar", "tarangsanchar_seed", "import_enriched"])
        ).first()
        if tower:
            return tower

    if cid:
        tower = db.query(Tower).filter(
            Tower.cell_id == str(cid),
            Tower.source.in_(["tarangsanchar", "tarangsanchar_seed", "import_enriched"])
        ).first()
        if tower:
            return tower

    return None


# ──────────────────────────────────────────────────────────────────
#  2. Drive-test sync endpoint
# ──────────────────────────────────────────────────────────────────
from pydantic import BaseModel
from typing import List

class DrivePointIn(BaseModel):
    timestamp: int
    lat: float
    lng: float
    gps_accuracy_m: float
    operator: Optional[str] = None
    technology: Optional[str] = None
    band_name: Optional[str] = None
    cid: Optional[int] = None
    enodeb_id: Optional[int] = None
    pci: Optional[int] = None
    rsrp: Optional[int] = None
    rsrq: Optional[int] = None
    sinr: Optional[int] = None
    timing_advance: Optional[int] = None

class DriveTestSyncIn(BaseModel):
    session_id: str
    points: List[DrivePointIn]

class SyncResult(BaseModel):
    session_id: str
    points_saved: int


@router.post("/drive-test/sync", response_model=SyncResult)
def sync_drive_test(payload: DriveTestSyncIn, db: Session = Depends(get_db)):
    """
    Receives a drive-test session from the Android app and stores each GPS+cell
    point in the drive_test_points table, making it available for replay and
    model calibration on the web dashboard.
    """
    count = 0
    for pt in payload.points:
        db_point = DriveTestPoint(
            session_id=payload.session_id,
            timestamp=pt.timestamp,
            lat=pt.lat,
            lng=pt.lng,
            gps_accuracy_m=pt.gps_accuracy_m,
            operator=pt.operator,
            technology=pt.technology,
            band_name=pt.band_name,
            cid=str(pt.cid) if pt.cid else None,
            enodeb_id=pt.enodeb_id,
            pci=pt.pci,
            rsrp=pt.rsrp,
            rsrq=pt.rsrq,
            sinr=pt.sinr,
            timing_advance=pt.timing_advance
        )
        db.add(db_point)
        count += 1
    db.commit()
    return SyncResult(session_id=payload.session_id, points_saved=count)


# ──────────────────────────────────────────────────────────────────
#  3. Offline pack — all towers within radius for field use
# ──────────────────────────────────────────────────────────────────
@router.get("/offline-pack", response_model=List[TowerOut])
def get_offline_pack(
    lat: float = Query(...),
    lng: float = Query(...),
    radius_km: float = Query(25.0, le=100.0),
    db: Session = Depends(get_db)
):
    """
    Downloads all cell towers within radius_km of the given lat/lng.
    The Android app calls this on Wi-Fi to cache towers for offline field diagnostics.
    """
    # Fast bounding-box filter first (SQLite has no spatial index)
    deg_per_km = 1 / 111.0
    lat_delta = radius_km * deg_per_km
    lng_delta = radius_km * deg_per_km / max(math.cos(math.radians(lat)), 0.01)

    candidates = db.query(Tower).filter(
        Tower.lat.between(lat - lat_delta, lat + lat_delta),
        Tower.lng.between(lng - lng_delta, lng + lng_delta),
        Tower.source.in_(["tarangsanchar", "tarangsanchar_seed", "import_enriched"])
    ).all()

    # Haversine filter for accurate circle
    results = []
    for t in candidates:
        if _haversine_km(lat, lng, t.lat, t.lng) <= radius_km:
            results.append(t)

    return results


# ── Helpers ──────────────────────────────────────────────────────

def _mnc_to_operator(mnc: int) -> Optional[str]:
    mapping = {
        10: "Airtel", 45: "Airtel", 49: "Airtel",
        20: "Vi", 70: "Vi", 86: "Vodafone", 60: "Idea",
        50: "Jio", 88: "Jio", 89: "Jio", 90: "Jio",
        1: "BSNL", 7: "BSNL"
    }
    return mapping.get(mnc)


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
