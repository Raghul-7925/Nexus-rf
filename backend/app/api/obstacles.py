from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db.session import get_db
from ..db.models import Obstacle
from ..schemas import ObstacleCreate, ObstacleOut

router = APIRouter(prefix="/api/obstacles", tags=["obstacles"])


@router.post("", response_model=ObstacleOut)
def create_obstacle(payload: ObstacleCreate, db: Session = Depends(get_db)):
    if len(payload.points) < 3:
        raise HTTPException(status_code=400, detail="An obstacle polygon needs at least 3 points")
    obstacle = Obstacle(points=payload.points, height_m=payload.height_m, obstacle_type=payload.obstacle_type)
    db.add(obstacle)
    db.commit()
    db.refresh(obstacle)
    return obstacle


@router.get("", response_model=list[ObstacleOut])
def list_obstacles(db: Session = Depends(get_db)):
    return db.query(Obstacle).all()


@router.delete("/{obstacle_id}")
def delete_obstacle(obstacle_id: str, db: Session = Depends(get_db)):
    obstacle = db.query(Obstacle).filter(Obstacle.id == obstacle_id).first()
    if not obstacle:
        raise HTTPException(status_code=404, detail="Obstacle not found")
    db.delete(obstacle)
    db.commit()
    return {"deleted": obstacle_id}
