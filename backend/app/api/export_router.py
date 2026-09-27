"""
app/api/export_router.py

GET /api/export?format=csv|json  -- exports all towers for download.
"""

import csv
import io
import json

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..db.session import get_db
from ..db.models import Tower

router = APIRouter(prefix="/api/export", tags=["export"])

FIELDS = [
    "name", "lat", "lng", "operator", "technology",
    "freq_mhz", "bandwidth_mhz", "height_m", "power_dbm",
    "tower_type", "azimuth_deg", "source", "site_id", "cell_id",
]


@router.get("")
def export_towers(
    fmt: str = Query("csv", alias="format", pattern="^(csv|json|geojson)$"),
    scope: str = Query("all", pattern="^(all|user_test|real)$"),
    db: Session = Depends(get_db),
):
    q = db.query(Tower)
    if scope == "user_test":
        q = q.filter(Tower.source.in_(["user_test", "manual", "rf_planned", "import"]))
    elif scope == "real":
        q = q.filter(Tower.source.in_(["tarangsanchar", "tarangsanchar_seed"]))
    towers = q.all()

    filename_suffix = f"_{scope}" if scope != "all" else ""

    if fmt == "csv":
        buf = io.StringIO()
        writer = csv.DictWriter(buf, fieldnames=FIELDS, extrasaction="ignore")
        writer.writeheader()
        for t in towers:
            writer.writerow({f: getattr(t, f, "") for f in FIELDS})
        buf.seek(0)
        return StreamingResponse(
            iter([buf.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=nexusrf_towers{filename_suffix}.csv"},
        )

    elif fmt == "json":
        data = [{f: getattr(t, f, None) for f in FIELDS} for t in towers]
        payload = json.dumps(data, indent=2, default=str)
        return StreamingResponse(
            iter([payload]),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=nexusrf_towers{filename_suffix}.json"},
        )

    else:  # geojson
        features = []
        for t in towers:
            props = {f: getattr(t, f, None) for f in FIELDS if f not in ("lat", "lng")}
            features.append({
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [t.lng, t.lat]},
                "properties": props,
            })
        payload = json.dumps({"type": "FeatureCollection", "features": features}, indent=2, default=str)
        return StreamingResponse(
            iter([payload]),
            media_type="application/geo+json",
            headers={"Content-Disposition": f"attachment; filename=nexusrf_towers{filename_suffix}.geojson"},
        )
