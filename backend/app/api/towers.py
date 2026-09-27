"""
app/api/towers.py

CRUD routes for towers. Thin layer over app/db/models.py -- no business
logic here on purpose; RF math lives entirely in rf_engine/, so it stays
testable without spinning up the API.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db.session import get_db
from ..db.models import Tower
from ..schemas import TowerCreate, TowerUpdate, TowerOut

router = APIRouter(prefix="/api/towers", tags=["towers"])


@router.post("", response_model=TowerOut)
def create_tower(payload: TowerCreate, db: Session = Depends(get_db)):
    tower = Tower(**payload.model_dump())
    db.add(tower)
    db.commit()
    db.refresh(tower)
    return tower


@router.get("", response_model=list[TowerOut])
def list_towers(source: str | None = None, db: Session = Depends(get_db)):
    q = db.query(Tower)
    if source == "user_test":
        q = q.filter(Tower.source.in_(["user_test", "manual", "rf_planned", "import"]))
    elif source == "real":
        q = q.filter(Tower.source.in_(["tarangsanchar", "tarangsanchar_seed"]))
    return q.all()


@router.delete("/all")
def delete_all_towers(source: str | None = None, db: Session = Depends(get_db)):
    """Delete towers in bulk. Can delete all or only user_test/planned towers."""
    q = db.query(Tower)
    if source == "user_test":
        q = q.filter(Tower.source.in_(["user_test", "manual", "rf_planned", "import"]))
    elif source == "real":
        q = q.filter(Tower.source.in_(["tarangsanchar", "tarangsanchar_seed"]))
    count = q.delete(synchronize_session=False)
    db.commit()
    return {"deleted_count": count, "source_filter": source or "all"}


@router.get("/{tower_id}", response_model=TowerOut)
def get_tower(tower_id: str, db: Session = Depends(get_db)):
    tower = db.query(Tower).filter(Tower.id == tower_id).first()
    if not tower:
        raise HTTPException(status_code=404, detail="Tower not found")
    return tower


@router.put("/{tower_id}", response_model=TowerOut)
def update_tower(tower_id: str, payload: TowerUpdate, db: Session = Depends(get_db)):
    tower = db.query(Tower).filter(Tower.id == tower_id).first()
    if not tower:
        raise HTTPException(status_code=404, detail="Tower not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(tower, field, value)
    db.commit()
    db.refresh(tower)
    return tower


@router.delete("/{tower_id}")
def delete_tower(tower_id: str, db: Session = Depends(get_db)):
    tower = db.query(Tower).filter(Tower.id == tower_id).first()
    if not tower:
        raise HTTPException(status_code=404, detail="Tower not found")
    db.delete(tower)
    db.commit()
    return {"deleted": tower_id}


@router.delete("/site/{site_id}")
def delete_site(site_id: str, db: Session = Depends(get_db)):
    """Delete all tower rows that share a site_id (co-located cells)."""
    towers = db.query(Tower).filter(Tower.site_id == site_id).all()
    if not towers:
        # Fallback: treat site_id as a single tower UUID
        tower = db.query(Tower).filter(Tower.id == site_id).first()
        if tower:
            db.delete(tower)
            db.commit()
            return {"deleted_site": site_id, "count": 1}
        raise HTTPException(status_code=404, detail="Site not found")
    count = len(towers)
    for t in towers:
        db.delete(t)
    db.commit()
    return {"deleted_site": site_id, "count": count}
