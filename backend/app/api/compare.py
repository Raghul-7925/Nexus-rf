"""
app/api/compare.py

POST /api/compare -- given a point, ranks nearby operators by the
requested priority (balanced / speed / coverage). Thin wrapper over
services/compare_service.py, which is the tested, DB-free logic.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db.session import get_db
from ..db.models import Tower, Obstacle
from ..schemas import CompareRequest, CompareResponse, CompareResultItem
from ..services.compare_service import compare_operators, TowerRecord
from ..rf_engine.models import Model, Environment
from ..rf_engine.geo import Point

router = APIRouter(prefix="/api/compare", tags=["compare"])


@router.post("", response_model=CompareResponse)
def compare(payload: CompareRequest, db: Session = Depends(get_db)):
    try:
        model = Model(payload.model)
        env = Environment(payload.environment)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid model/environment: {e}")

    q = db.query(Tower).filter(Tower.operator.isnot(None), Tower.freq_mhz.isnot(None))
    
    # ── Source Isolation (Requirement 3: Isolate verified vs test data) ─────
    if payload.data_source == "verified":
        q = q.filter(Tower.source.in_(["tarangsanchar", "tarangsanchar_seed", "import", "import_enriched", "netmonster_verified", "verified", "dot_verified"]))
        data_source_mode = "Verified TarangSanchar / DoT Portal Data (100% Real-World Registry)"
        item_source_label = "Verified TarangSanchar"
    elif payload.data_source == "test":
        q = q.filter(Tower.source.in_(["manual", "user_test", "rf_planned"]))
        data_source_mode = "User Test & Academic Planning Sites"
        item_source_label = "User Test / Planned"
    else:
        data_source_mode = "All Available Sites (Verified + User Planning)"
        item_source_label = "Combined Registry"

    towers = q.all()
    records = [
        TowerRecord(name=t.name, lat=t.lat, lng=t.lng, operator=t.operator,
                    technology=t.technology, freq_mhz=t.freq_mhz,
                    height_m=t.height_m, power_dbm=t.power_dbm)
        for t in towers
    ]
    obstacles_db = db.query(Obstacle).all()
    obstacle_polys = [[Point(p[0], p[1]) for p in o.points] for o in obstacles_db]

    results = compare_operators(
        payload.lat, payload.lng, records, obstacles=obstacle_polys,
        radius_km=payload.radius_km, sort_by=payload.sort_by, model=model, env=env,
    )

    return CompareResponse(
        data_source_mode=data_source_mode,
        results=[
            CompareResultItem(
                operator=r["operator"], rx_dbm=round(r["rx_dbm"], 1), freq_mhz=r["freq_mhz"],
                technology=r["technology"], bandwidth_mhz=r["bandwidth_mhz"], distance_km=round(r["distance_km"], 2),
                nearest_tower=r["nearest_tower"], coverage_score=r["coverage_score"],
                speed_score=r["speed_score"], balanced_score=r["balanced_score"],
                bands_available=r["bands_available"],
                verdict=r.get("verdict"),
                data_source=item_source_label,
            ) for r in results
        ]
    )

