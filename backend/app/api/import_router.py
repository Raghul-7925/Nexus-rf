"""
app/api/import_router.py

POST /api/import -- accepts raw pasted text or an uploaded file
(CSV/JSON/GeoJSON/NetMonster), parses it, and bulk-inserts the resulting towers.

POST /api/import/netmonster -- dedicated endpoint for Android NetMonster JSON dumps
with 100% TarangSanchar baseline snapping.
"""

import json
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional, Any

from ..db.session import get_db
from ..db.models import Tower, ImportBatch
from ..services.import_parser import parse_import, ImportError_
from ..services.netmonster_parser import parse_netmonster_data, parse_ntm_text

router = APIRouter(prefix="/api/import", tags=["import"])


def _is_netmonster_payload(obj: Any) -> bool:
    if isinstance(obj, list) and len(obj) > 0 and isinstance(obj[0], dict):
        sample = obj[0]
        return "network" in sample and ("cid" in sample or "technology" in sample)
    return False


def _is_ntm_content(raw: str) -> bool:
    for line in raw.splitlines()[:15]:
        line = line.strip()
        if not line:
            continue
        parts = line.split(";")
        if len(parts) >= 7 and parts[0].upper() in ("2G", "3G", "4G", "5G", "GSM", "UMTS", "LTE", "NR"):
            return True
    return False


@router.post("")
async def import_towers(
    db: Session = Depends(get_db),
    text: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    snap_to_baseline: bool = Form(True),
    snap_radius_m: float = Form(1200.0),
):
    if file is not None:
        raw = (await file.read()).decode("utf-8", errors="replace")
        filename = file.filename
        fmt = (filename.rsplit(".", 1)[-1].lower() if filename and "." in filename else "unknown")
    elif text:
        raw, filename, fmt = text, None, "pasted"
    else:
        raise HTTPException(status_code=400, detail="Provide either `text` or `file`")

    # ── Check if input is native .ntm or semicolon NetMonster format ─────────
    if fmt == "ntm" or _is_ntm_content(raw):
        baseline = db.query(Tower).filter(Tower.source == "import").all()
        nm_res = parse_ntm_text(
            raw,
            baseline_towers=baseline,
            snap_to_baseline=snap_to_baseline,
            snap_radius_m=snap_radius_m,
        )
        towers_to_add = nm_res["towers"]
        if not towers_to_add:
            raise HTTPException(status_code=400, detail="NTM file contained no localized cell records")

        created = []
        for row in towers_to_add:
            tower = Tower(**row)
            db.add(tower)
            created.append(tower)

        batch = ImportBatch(filename=filename, row_count=len(created), format="ntm")
        db.add(batch)
        db.commit()

        return {
            "imported": len(created),
            "batch_id": batch.id,
            "format": "ntm",
            "total_items": nm_res["total_items"],
            "valid_cells": nm_res["valid_cells"],
            "snapped_to_baseline": nm_res["snapped_to_baseline_count"],
            "new_field_sites": nm_res["new_field_sites_count"],
            "operators": nm_res["operators"],
            "technologies": nm_res["technologies"],
            "bands": nm_res["bands"],
        }

    # ── Check if input is a NetMonster JSON dump ────────────────────────────
    is_nm = False
    try:
        trimmed = raw.strip()
        if trimmed.startswith("[") or trimmed.startswith("{"):
            parsed_json = json.loads(trimmed)
            if _is_netmonster_payload(parsed_json):
                is_nm = True
    except Exception:
        pass

    if is_nm:
        # Load TarangSanchar baseline towers for snapping
        baseline = db.query(Tower).filter(Tower.source == "import").all()
        nm_res = parse_netmonster_data(
            parsed_json,
            baseline_towers=baseline,
            snap_to_baseline=snap_to_baseline,
            snap_radius_m=snap_radius_m,
        )
        towers_to_add = nm_res["towers"]
        if not towers_to_add:
            raise HTTPException(status_code=400, detail="NetMonster JSON contained no valid localized cells")

        created = []
        for row in towers_to_add:
            tower = Tower(**row)
            db.add(tower)
            created.append(tower)

        batch = ImportBatch(filename=filename, row_count=len(created), format="netmonster_json")
        db.add(batch)
        db.commit()

        return {
            "imported": len(created),
            "batch_id": batch.id,
            "format": "netmonster",
            "total_items": nm_res["total_items"],
            "valid_cells": nm_res["valid_cells"],
            "snapped_to_baseline": nm_res["snapped_to_baseline_count"],
            "new_field_sites": nm_res["new_field_sites_count"],
            "operators": nm_res["operators"],
            "technologies": nm_res["technologies"],
            "bands": nm_res["bands"],
        }

    # Standard CSV / GeoJSON / Generic JSON import
    try:
        parsed_rows = parse_import(raw)
    except ImportError_ as e:
        raise HTTPException(status_code=400, detail=f"Could not parse import: {e}")

    if not parsed_rows:
        raise HTTPException(status_code=400, detail="No valid rows with coordinates were found")

    created = []
    for row in parsed_rows:
        tower = Tower(**row)
        db.add(tower)
        created.append(tower)

    batch = ImportBatch(filename=filename, row_count=len(created), format=fmt)
    db.add(batch)
    db.commit()

    return {"imported": len(created), "batch_id": batch.id, "format": fmt}


@router.post("/netmonster")
async def import_netmonster_endpoint(
    db: Session = Depends(get_db),
    file: UploadFile = File(...),
    snap_to_baseline: bool = Form(True),
    snap_radius_m: float = Form(1200.0),
):
    """
    Dedicated endpoint for NetMonster JSON drive-test logs.
    Maps BSNL / Jio / Vi / Airtel cells and snaps them to TarangSanchar baseline towers.
    """
    raw = (await file.read()).decode("utf-8", errors="replace")
    baseline = db.query(Tower).filter(Tower.source == "import").all()

    if file.filename.endswith(".ntm") or _is_ntm_content(raw):
        nm_res = parse_ntm_text(
            raw,
            baseline_towers=baseline,
            snap_to_baseline=snap_to_baseline,
            snap_radius_m=snap_radius_m,
        )
        file_format = "ntm"
    else:
        try:
            data = json.loads(raw)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid file format: {e}")

        if not isinstance(data, list):
            raise HTTPException(status_code=400, detail="JSON must contain an array of cell objects")

        nm_res = parse_netmonster_data(
            data,
            baseline_towers=baseline,
            snap_to_baseline=snap_to_baseline,
            snap_radius_m=snap_radius_m,
        )
        file_format = "netmonster_json"

    towers_to_add = nm_res["towers"]
    if not towers_to_add:
        raise HTTPException(status_code=400, detail="File contained no valid localized cell records")

    created = []
    for row in towers_to_add:
        tower = Tower(**row)
        db.add(tower)
        created.append(tower)

    batch = ImportBatch(filename=file.filename, row_count=len(created), format="netmonster_json")
    db.add(batch)
    db.commit()

    return {
        "imported": len(created),
        "batch_id": batch.id,
        "format": "netmonster",
        "total_items": nm_res["total_items"],
        "valid_cells": nm_res["valid_cells"],
        "snapped_to_baseline": nm_res["snapped_to_baseline_count"],
        "new_field_sites": nm_res["new_field_sites_count"],
        "operators": nm_res["operators"],
        "technologies": nm_res["technologies"],
        "bands": nm_res["bands"],
    }
