"""
app/api/import_router.py

POST /api/import -- accepts raw pasted text or an uploaded file
(CSV/JSON/GeoJSON), parses it via services/import_parser.py, and
bulk-inserts the resulting towers.
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional

from ..db.session import get_db
from ..db.models import Tower, ImportBatch
from ..services.import_parser import parse_import, ImportError_

router = APIRouter(prefix="/api/import", tags=["import"])


@router.post("")
async def import_towers(
    db: Session = Depends(get_db),
    text: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
):
    if file is not None:
        raw = (await file.read()).decode("utf-8", errors="replace")
        filename = file.filename
        fmt = (filename.rsplit(".", 1)[-1].lower() if filename and "." in filename else "unknown")
    elif text:
        raw, filename, fmt = text, None, "pasted"
    else:
        raise HTTPException(status_code=400, detail="Provide either `text` or `file`")

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

    return {"imported": len(created), "batch_id": batch.id}
