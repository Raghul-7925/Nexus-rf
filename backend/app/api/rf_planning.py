"""
backend/app/api/rf_planning.py

Endpoints for automated professional RF Network Planning:
- POST /api/rf-plan: Calculates optimal cell placements, link budget, and spectrum bands for an area.
- POST /api/rf-plan/deploy: Saves recommended planned sites to the user's test/planned dataset in DB.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db.session import get_db
from ..db.models import Tower
from ..schemas import RFPlanRequest, RFPlanResponse, RFDeployRequest, TowerOut
from ..rf_engine.rf_planning_service import plan_cellular_network

router = APIRouter(prefix="/api/rf-plan", tags=["rf-plan"])


@router.post("", response_model=RFPlanResponse)
def generate_rf_plan(payload: RFPlanRequest, db: Session = Depends(get_db)):
    """
    Synthesize an engineering-grade RF cellular coverage & capacity plan
    based on demographic density, propagation clutter, and existing gap analysis.
    """
    try:
        existing_towers = db.query(Tower).all()
        return plan_cellular_network(payload, existing_towers)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"RF Planning failed: {str(e)}")


@router.post("/deploy")
def deploy_planned_sites(payload: RFDeployRequest, db: Session = Depends(get_db)):
    """
    Deploy recommended planned sites directly into the active user dataset
    with source='rf_planned'. Creates individual cell records for all recommended bands.
    """
    created_count = 0
    for site in payload.sites:
        bands = site.recommended_bands or [
            {"band": "B3", "freq_mhz": 1800, "tech": "4G", "bandwidth_mhz": 15}
        ]
        
        # Deploy cell for each recommended band
        for b in bands:
            freq = b.get("freq_mhz", 1800)
            tech = b.get("tech", "4G")
            bw = b.get("bandwidth_mhz", 15)
            band_name = b.get("band", f"{freq}MHz")

            tower = Tower(
                name=f"{site.name} ({band_name})",
                lat=site.lat,
                lng=site.lng,
                operator=site.name.split()[0] if site.name else "Jio",
                technology=tech,
                freq_mhz=freq,
                bandwidth_mhz=bw,
                height_m=site.height_m,
                power_dbm=site.power_dbm,
                tower_type=site.tower_type,
                azimuth_deg=site.azimuth_deg or 0.0,
                source="rf_planned",
                site_id=site.site_id,
                cell_id=f"{site.site_id}-{band_name}",
            )
            db.add(tower)
            created_count += 1

    db.commit()
    return {"status": "success", "deployed_cells": created_count, "sites_count": len(payload.sites)}
