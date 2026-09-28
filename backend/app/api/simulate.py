"""
app/api/simulate.py  –  terrain-aware, auto model/environment
"""

import base64

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db.session import get_db
from ..db.models import Tower, Obstacle
from ..schemas import SimulateRequest, SimulateResponse
from ..rf_engine.coverage_service import (
    generate_coverage, TowerConfig, Thresholds,
    auto_select_model, auto_detect_environment,
)
from ..rf_engine.models import Model, Environment
from ..rf_engine.geo import Point

router = APIRouter(prefix="/api/simulate", tags=["simulate"])


@router.post("/{tower_id}", response_model=SimulateResponse)
def simulate(tower_id: str, payload: SimulateRequest, db: Session = Depends(get_db)):
    tower = db.query(Tower).filter(Tower.id == tower_id).first()
    if not tower:
        raise HTTPException(status_code=404, detail="Tower not found")

    if tower.freq_mhz is None:
        raise HTTPException(
            status_code=400,
            detail="Cannot simulate an unconfigured raw tower. Please edit the tower in Site Builder to assign a spectrum band."
        )

    # ── auto or explicit model ────────────────────────────────────────────────
    if payload.model:
        try:
            model = Model(payload.model)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=f"Invalid model: {e}")
    else:
        model = auto_select_model(tower.freq_mhz)

    # ── auto or explicit environment ──────────────────────────────────────────
    if payload.environment:
        try:
            env = Environment(payload.environment)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=f"Invalid environment: {e}")
    else:
        env = auto_detect_environment(round(tower.lat, 4), round(tower.lng, 4))

    obstacles_db = db.query(Obstacle).all()
    obstacle_polys = [[Point(p[0], p[1]) for p in o.points] for o in obstacles_db]

    config = TowerConfig(
        lat=tower.lat,
        lng=tower.lng,
        freq_mhz=tower.freq_mhz,
        height_m=tower.height_m,
        power_dbm=tower.power_dbm,
        bandwidth_mhz=tower.bandwidth_mhz or 10.0,
        azimuth_deg=tower.azimuth_deg,
    )
    thresholds = Thresholds(
        green_dbm=payload.green_dbm,
        amber_dbm=payload.amber_dbm,
        red_dbm=payload.red_dbm,
    )

    result = generate_coverage(
        config,
        obstacle_polys,
        model=model,
        env=env,
        thresholds=thresholds,
        resolution=payload.resolution,
        terrain_aware=payload.terrain_aware,
        building_aware=payload.building_aware,
    )

    color = resolve_cell_color(tower.operator, tower.freq_mhz, "operator")

    return SimulateResponse(
        png_base64=base64.b64encode(result.png_bytes).decode("ascii"),
        bounds=list(result.bounds),
        max_range_km=result.max_range_km,
        area_km2=result.area_km2,
        model=result.model,
        environment=result.environment,
        terrain_aware=result.terrain_aware,
        building_aware=result.building_aware,
        buildings_count=result.buildings_count,
        avg_rsrp_dbm=result.avg_rsrp_dbm,
        center_rsrp_dbm=result.center_rsrp_dbm,
        rsrq_db=result.rsrq_db,
        sinr_db=result.sinr_db,
        color=color,
        tower_id=tower.id,
        tower_lat=tower.lat,
        tower_lng=tower.lng,
        operator=tower.operator,
        technology=tower.technology,
        freq_mhz=tower.freq_mhz,
        power_dbm=tower.power_dbm,
        height_m=tower.height_m,
    )


OP_COLOR_MAP = {
    "airtel": "#ef4444",
    "jio": "#f97316",
    "vi": "#eab308",
    "bsnl": "#22c55e",
}

def resolve_cell_color(op: str | None, freq: float | None, mode: str = "operator") -> str:
    if mode == "band" and freq:
        if freq < 1000:
            return "#06b6d4"  # Cyan Sub-1GHz
        elif freq < 2500:
            return "#8b5cf6"  # Purple Mid-band
        else:
            return "#ec4899"  # Pink C-band / High-band
    if op:
        opl = op.lower()
        for k, v in OP_COLOR_MAP.items():
            if k in opl:
                return v
    return "#3b82f6"


@router.post("/multi", response_model=SimulateMultiResponse)
def simulate_multi(payload: SimulateMultiRequest, db: Session = Depends(get_db)):
    """
    Simulate multiple carrier bands and operators simultaneously.
    Renders distinct color-coded layers for BSNL, Jio, Airtel, Vi, etc.
    """
    if payload.site_id:
        towers = db.query(Tower).filter(Tower.site_id == payload.site_id).all()
        if not towers:
            t = db.query(Tower).filter(Tower.id == payload.site_id).first()
            towers = [t] if t else []
    elif payload.tower_ids:
        towers = db.query(Tower).filter(Tower.id.in_(payload.tower_ids)).all()
    else:
        raise HTTPException(status_code=400, detail="Must provide site_id or tower_ids")

    valid_towers = [t for t in towers if t.freq_mhz is not None]
    if not valid_towers:
        raise HTTPException(status_code=400, detail="No configured radio cells found for simulation.")

    obstacles_db = db.query(Obstacle).all()
    obstacle_polys = [[Point(p[0], p[1]) for p in o.points] for o in obstacles_db]

    layers: list[SimulateResponse] = []
    thresholds = Thresholds()

    for tower in valid_towers:
        color = resolve_cell_color(tower.operator, tower.freq_mhz, payload.color_mode)
        model = auto_select_model(tower.freq_mhz)
        env = auto_detect_environment(round(tower.lat, 4), round(tower.lng, 4))

        config = TowerConfig(
            lat=tower.lat,
            lng=tower.lng,
            freq_mhz=tower.freq_mhz,
            height_m=tower.height_m,
            power_dbm=tower.power_dbm,
            bandwidth_mhz=tower.bandwidth_mhz or 10.0,
            azimuth_deg=tower.azimuth_deg,
            sectors_count=3,
        )

        res = generate_coverage(
            config,
            obstacle_polys,
            model=model,
            env=env,
            thresholds=thresholds,
            resolution=payload.resolution,
            terrain_aware=payload.terrain_aware,
            building_aware=payload.building_aware,
            color_tint=color,
        )

        layers.append(
            SimulateResponse(
                png_base64=base64.b64encode(res.png_bytes).decode("ascii"),
                bounds=list(res.bounds),
                max_range_km=res.max_range_km,
                area_km2=res.area_km2,
                model=res.model,
                environment=res.environment,
                terrain_aware=res.terrain_aware,
                building_aware=res.building_aware,
                buildings_count=res.buildings_count,
                avg_rsrp_dbm=res.avg_rsrp_dbm,
                center_rsrp_dbm=res.center_rsrp_dbm,
                rsrq_db=res.rsrq_db,
                sinr_db=res.sinr_db,
                color=color,
                tower_id=tower.id,
                tower_lat=tower.lat,
                tower_lng=tower.lng,
                operator=tower.operator,
                technology=tower.technology,
                freq_mhz=tower.freq_mhz,
                power_dbm=tower.power_dbm,
                height_m=tower.height_m,
            )
        )

    return SimulateMultiResponse(layers=layers, site_id=payload.site_id)

