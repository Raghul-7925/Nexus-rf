"""
app/main.py

FastAPI entrypoint. Run locally with:

    cd backend
    pip install -r requirements.txt
    uvicorn app.main:app --reload

Then open http://127.0.0.1:8000/docs for the auto-generated Swagger UI
-- useful both for manual testing and as a ready-made appendix
screenshot for your report's "API design" chapter.
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from .db.session import init_db
from .api import towers, obstacles, simulate, import_router, compare, export_router, rf_planning

app = FastAPI(
    title="Nexus RF API",
    description="Smart Telecom Digital Twin — Coverage Prediction & RF Network Planning",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(towers.router)
app.include_router(obstacles.router)
app.include_router(simulate.router)
app.include_router(import_router.router)
app.include_router(compare.router)
app.include_router(export_router.router)
app.include_router(rf_planning.router)


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/api/health")
def health():
    return {"status": "ok"}


# ── Production static frontend serving ──────────────────────────────────────────
# Check if frontend dist exists (either bundled inside container or adjacent)
dist_paths = [
    os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"),
    os.path.join(os.path.dirname(__file__), "..", "static"),
    "/app/frontend/dist",
]
static_dir = next((p for p in dist_paths if os.path.exists(p) and os.path.isdir(p)), None)

if static_dir:
    assets_dir = os.path.join(static_dir, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        target = os.path.join(static_dir, full_path)
        if full_path and os.path.exists(target) and os.path.isfile(target):
            return FileResponse(target)
        return FileResponse(os.path.join(static_dir, "index.html"))

