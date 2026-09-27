# Nexus RF — Solo Build Notes

This is the **solo-scoped** version of the architecture in `docs/architecture.md`.
Changes from the full team-scale design, and why:

| Dropped / simplified | Reason |
|---|---|
| Auth + multi-user projects | No collaboration to support solo — one implicit project, no login screen to build/test/document |
| Redis cache | Coverage rasters are cheap enough to recompute on a single-user demo; add back only if the viva demo feels slow |
| PostGIS → SQLite (or plain PostgreSQL, no spatial extension) | Spatial queries ("towers within radius") are simple enough to do in Python over a small dataset; SQLite needs zero setup, which matters when you're the only one running this |
| Live DEM fetch → pre-downloaded SRTM tile for 1 demo city | No outbound network access needed at demo time; also keeps Phase 4 (terrain) scoped to something a single person finishes in the time available |

**What did NOT get cut:** the RF engine (this is the technical core the panel will
grade), the terrain/diffraction model, the import pipeline, and the ISP compare
engine. Those are exactly what make this a 10-credit project instead of a CRUD app.

## What's built so far

**Phase 2 — RF engine (pure Python, no dependencies):**
- `backend/app/rf_engine/models.py` — FSPL, Okumura-Hata, COST-231 Hata,
  sector antenna gain, single knife-edge diffraction.
- `backend/app/rf_engine/geo.py` — haversine distance, bearing, destination
  point, line-polygon intersection (for obstruction detection).
- `backend/app/rf_engine/coverage_service.py` — turns a tower + obstacles
  into a PNG coverage raster (green/amber/red) plus range/area stats.

**Phase 3 — API layer (needs `pip install -r requirements.txt` to run):**
- `backend/app/db/` — SQLite models (Tower, Obstacle, ImportBatch) + session.
- `backend/app/schemas.py` — Pydantic request/response contracts.
- `backend/app/services/` — import parser (CSV/JSON/GeoJSON) and the
  ISP compare/recommendation engine, both DB-free and independently tested.
- `backend/app/api/` — FastAPI routers: towers CRUD, obstacles, simulate,
  import, compare.
- `backend/app/main.py` — app entrypoint, wires everything together.

**Test status:** 36/36 passing across 5 suites (`test_rf_models.py`,
`test_geo.py`, `test_coverage_service.py`, `test_import_parser.py`,
`test_compare_service.py`). These run with plain `python3`, no install
needed. The FastAPI route layer itself isn't executable in the sandbox
this was built in (no network access to install fastapi/sqlalchemy) —
run it locally to confirm, see below.

## Running it locally

```bash
cd backend
pip install -r requirements.txt

# run the dependency-free RF/geo/service tests first (should all pass):
python3 tests/test_rf_models.py
python3 tests/test_geo.py
python3 tests/test_coverage_service.py
python3 tests/test_import_parser.py
python3 tests/test_compare_service.py

# then start the API:
uvicorn app.main:app --reload
# Swagger UI at http://127.0.0.1:8000/docs
```

Quick manual check once it's running:
```bash
curl -X POST http://127.0.0.1:8000/api/towers -H "Content-Type: application/json" -d '{
  "name": "Test Rooftop", "lat": 13.05, "lng": 80.23,
  "freq_mhz": 2100, "height_m": 30, "power_dbm": 43, "operator": "Airtel"
}'
# copy the returned "id", then:
curl -X POST http://127.0.0.1:8000/api/simulate/<id> -H "Content-Type: application/json" -d '{
  "model": "hata", "environment": "urban"
}'
```

## Next steps (Phase 4+)

1. Point the existing frontend prototype (`rf-planner.html`, shared earlier)
   at this real API instead of doing the math client-side — swap its
   in-browser JS coverage loop for a `fetch('/api/simulate/...')` call.
2. Real DEM/terrain: wire `knife_edge_diffraction_loss()` (already built
   in `models.py`, not yet called from `coverage_service.py`) into the
   raster loop using a downloaded SRTM tile for your demo city.
3. Seed the DB from your manually-collected Tarangsanchar data via
   `POST /api/import`.
4. Write `tests/test_api.py` with FastAPI's `TestClient` once you can
   `pip install` locally — the route layer is the one part not yet
   test-verified end-to-end.

Keep `docs/architecture.md` as the source of truth for scope; update it if
you cut or add anything else so your report and your code never disagree.

