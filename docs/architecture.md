# Nexus RF — Smart Telecom Digital Twin for Coverage Prediction & RF Network Planning
### System Architecture & Build Specification (Final Year Project, 10 Credits)

---

## 1. Project Framing (for your report's Chapter 1)

**Problem statement:** Telecom RF planning in India today is manual, spreadsheet-driven, and disconnected from real GIS context. Engineers lack an accessible tool that combines real tower data, standard propagation models, terrain/clutter awareness, and operator comparison in one interface.

**Objectives** (write these near-verbatim in your report, Chapter 1.3):
1. Design and implement a web-based GIS platform for RF coverage prediction using standard propagation models (FSPL, Hata, COST-231 Hata).
2. Integrate real tower infrastructure data (sourced from DoT's Tarangsanchar portal) with a bulk-import pipeline for engineer-supplied datasets.
3. Model terrain and building-induced signal attenuation using elevation and clutter data to improve prediction accuracy over free-space models alone.
4. Build a multi-operator signal comparison engine that recommends the best ISP at a user-selected location, ranked by user-defined priorities (speed, coverage).
5. Provide a "what-if" simulation workspace so RF engineers can configure a virtual tower and evaluate coverage before physical deployment.

**Why this justifies 10 credits:** it spans signal processing / RF theory (core EC subject matter), full-stack software engineering, geospatial data engineering, and applied numerical methods (line-of-sight/diffraction geometry) — four evaluable technical layers, not just a CRUD app.

---

## 2. High-Level System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                              │
│  React + TypeScript SPA                                               │
│  ┌───────────┐ ┌───────────────┐ ┌──────────────┐ ┌────────────────┐  │
│  │ Map Layer │ │ Tower Config  │ │ Import Wizard│ │ ISP Compare UI │  │
│  │ (Leaflet/ │ │ Panel         │ │ (CSV/JSON/   │ │ + sort engine  │  │
│  │ MapLibre) │ │               │ │  GeoJSON)    │ │                │  │
│  └───────────┘ └───────────────┘ └──────────────┘ └────────────────┘  │
└───────────────────────────────┬────────────────────────────────────--┘
                                 │ REST / JSON (HTTPS)
┌───────────────────────────────▼──────────────────────────────────────┐
│                      APPLICATION LAYER (API)                          │
│  FastAPI (Python)                                                     │
│  ┌────────────┐ ┌───────────────┐ ┌───────────────┐ ┌──────────────┐  │
│  │ Auth &     │ │ Tower Service │ │ Import Service│ │ Compare      │  │
│  │ Project mgmt│ │ (CRUD)        │ │ (CSV/JSON/    │ │ Service      │  │
│  │            │ │               │ │  GeoJSON parse)│ │              │  │
│  └────────────┘ └───────────────┘ └───────────────┘ └──────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │                    RF ENGINE (core domain logic)              │    │
│  │  • Propagation models: FSPL / Hata / COST-231                 │    │
│  │  • Terrain profiler: DEM sampling + knife-edge diffraction     │    │
│  │  • Clutter classifier: building/land-use lookup                │    │
│  │  • Antenna pattern model (omni / sector)                       │    │
│  │  • Grid-based coverage raster generator                        │    │
│  └──────────────────────────────────────────────────────────────┘    │
└───────────────────────────────┬────────────────────────────────────--┘
                                 │
┌───────────────────────────────▼──────────────────────────────────────┐
│                          DATA LAYER                                   │
│  PostgreSQL + PostGIS      │  Redis (cache)   │  Object storage       │
│  • towers                  │  • coverage      │  • DEM tiles          │
│  • projects / users        │    raster cache  │  • uploaded imports   │
│  • obstacles (polygons)    │  • session data  │  • generated reports  │
│  • import_batches          │                  │                       │
└──────────────────────────────────────────────────────────────────────┘
                                 │
┌───────────────────────────────▼──────────────────────────────────────┐
│                    EXTERNAL DATA SOURCES                              │
│  • Tarangsanchar seed dataset (manually collected, rate-limited)      │
│  • SRTM 30m DEM (elevation, free)                                     │
│  • OpenStreetMap (building footprints, land use)                      │
│  • Engineer-supplied CSV/JSON/GeoJSON imports                         │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. Recommended Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + TypeScript + Vite | Standard, well-documented, AI-tools generate it reliably |
| Map | Leaflet.js (or MapLibre GL for vector tiles) | Free, no API key, GeoJSON-native |
| State mgmt | Zustand or React Context | Lightweight, no over-engineering for a student project |
| Backend | FastAPI (Python) | RF math lives naturally in Python (numpy/scipy); auto-generates OpenAPI docs — good for your report's API documentation chapter |
| RF/numeric | NumPy, SciPy, rasterio (DEM), Shapely (geometry) | Industry-standard geospatial/numeric stack |
| Database | PostgreSQL + PostGIS extension | Real GIS querying (spatial indexes, "towers within radius") — a strong technical talking point in viva |
| Cache | Redis | Cache expensive coverage-raster computations |
| Auth | JWT (FastAPI users / simple custom) | Only needed if you support multiple engineer accounts/projects |
| Deployment | Docker Compose (frontend + backend + db + redis) | One-command setup, professional deliverable, easy to demo |
| Testing | Pytest (backend), Vitest (frontend) | Required for your report's testing chapter |

**If you want to keep it simpler (still credit-worthy):** drop Redis and auth, use SQLite instead of PostGIS, and keep DEM/clutter as static pre-downloaded tiles for 1–2 demo cities. This is a legitimate scope reduction — document it as a stated project boundary, not a limitation you hide.

---

## 4. Core Database Schema

```sql
-- towers: real + virtual, imported + manually placed
CREATE TABLE towers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  name TEXT NOT NULL,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  operator TEXT,                 -- Jio / Airtel / Vi / BSNL / null for virtual
  technology TEXT,                -- 2G/3G/4G/5G
  frequency_mhz INT NOT NULL,
  bandwidth_mhz NUMERIC,
  height_m NUMERIC NOT NULL,
  power_dbm NUMERIC NOT NULL,
  tower_type TEXT,                -- Rooftop / Ground / Wall mount
  azimuth_deg NUMERIC,            -- null = omni
  source TEXT NOT NULL,           -- 'manual' | 'tarangsanchar_seed' | 'import'
  cell_id TEXT, site_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX towers_geo_idx ON towers USING GIST (location);

CREATE TABLE obstacles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  geom GEOGRAPHY(POLYGON, 4326) NOT NULL,
  height_m NUMERIC DEFAULT 12,
  obstacle_type TEXT DEFAULT 'building'
);

CREATE TABLE coverage_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tower_id UUID REFERENCES towers(id),
  model TEXT NOT NULL,            -- fspl / hata / cost231
  environment TEXT,               -- dense_urban / urban / suburban / open
  raster_url TEXT,                -- cached PNG/GeoTIFF in object storage
  params JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  filename TEXT, row_count INT, format TEXT, created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 5. RF Engine — Algorithm Design (your Chapter 3/4 methodology)

**5.1 Propagation loss models**
- FSPL — baseline, always computed for comparison.
- Okumura–Hata (150–1500 MHz) with urban/suburban/open correction terms.
- COST-231 Hata (1500–2000 MHz extension) for 1800/2100/2300 bands.
- Explicitly state in your report: above ~2000 MHz (2300/2500/3500 MHz bands) these models are used as *engineering approximations*, since standard Hata/COST-231 are not formally valid there — this is honest scoping, not a flaw.

**5.2 Terrain-aware correction (this is your differentiator — emphasize it)**
1. For each grid point, sample elevation profile between tower and point from SRTM DEM.
2. Apply single knife-edge diffraction loss (Fresnel-Kirchhoff) when the line-of-sight is obstructed by terrain.
3. Add a clutter penalty when the path crosses OSM building polygons (fixed empirical loss per building crossed, or per meter of building "depth" for more rigor).
4. Final path loss = model_loss(d, f) + diffraction_loss + clutter_loss.

**5.3 Coverage raster generation**
- Generate a lat/lng grid around each tower up to the computed cell-edge radius.
- For each cell: compute RxPower = TxPower + AntennaGain(bearing) − PathLoss.
- Classify into tiers (green/amber/red/none) against configurable thresholds.
- Cache the raster (tower config hash → PNG) in Redis/object storage so repeated views don't recompute.

**5.4 ISP comparison / recommendation engine**
- For a clicked point, query all towers within radius R (PostGIS `ST_DWithin`).
- Compute estimated RxPower per tower using the same engine.
- Group by operator, take best serving tower per operator.
- Score: `coverage_score = f(RxPower)`, `speed_score = f(channel_bandwidth)`, `balanced = w1*coverage + w2*speed`.
- Return ranked list with the deciding tower, band, and technology shown for transparency (important for viva — panels will ask "why did it recommend this one").

---

## 6. API Design (FastAPI routers)

```
POST   /api/projects
GET    /api/projects/{id}

POST   /api/towers                      # create (manual or virtual)
GET    /api/towers?project_id=
PUT    /api/towers/{id}
DELETE /api/towers/{id}

POST   /api/import                      # multipart file: csv/json/geojson
GET    /api/import/{batch_id}

POST   /api/obstacles

POST   /api/simulate/{tower_id}         # body: {model, environment, thresholds}
        → returns raster URL + stats (max range, area covered, avg RxPower)

POST   /api/compare                     # body: {lat, lng, radius_km, sort_by}
        → returns ranked operator list with scoring breakdown
```

---

## 7. Folder Structure

```
nexus-rf/
├── frontend/
│   ├── src/
│   │   ├── components/ (MapView, TowerForm, ImportWizard, CompareResults)
│   │   ├── stores/ (towerStore, projectStore)
│   │   ├── api/ (axios client)
│   │   └── pages/ (Simulate, Import, Compare)
│   └── package.json
├── backend/
│   ├── app/
│   │   ├── api/ (routers: towers, import, simulate, compare)
│   │   ├── rf_engine/ (models.py, terrain.py, clutter.py, raster.py)
│   │   ├── services/ (import_parser.py, compare_service.py)
│   │   ├── db/ (models.py — SQLAlchemy, session.py)
│   │   └── main.py
│   ├── tests/ (test_rf_models.py, test_import.py, test_compare.py)
│   └── requirements.txt
├── data/
│   ├── seed_towers.csv (your manually collected Tarangsanchar data)
│   └── dem_tiles/ (SRTM tiles for your demo city)
├── docker-compose.yml
└── docs/
    ├── architecture.md (this file)
    ├── report/ (your LaTeX/Word report chapters)
    └── api-spec.yaml (OpenAPI, auto-generated by FastAPI)
```

---

## 8. Phased Build Plan (mapped to typical academic milestones)

| Phase | Milestone | Deliverable |
|---|---|---|
| 1 | Proposal / Review-1 | This architecture doc, literature survey, RF model equations documented, low-fi UI wireframes |
| 2 | Core engine | Backend RF engine (FSPL/Hata/COST-231) + unit tests, standalone (no UI yet) verified against known textbook values |
| 3 | GIS + manual simulation | Map UI, manual tower placement, coverage raster rendering — this is your Review-2 demo |
| 4 | Terrain/clutter | DEM integration, diffraction loss, obstacle drawing — the "accuracy" differentiator |
| 5 | Import + real data | Seed dataset from Tarangsanchar, CSV/JSON/GeoJSON import pipeline |
| 6 | ISP comparison | Compare engine + ranked UI |
| 7 | Polish + testing | Responsive UI, test coverage, Dockerize, deployment |
| 8 | Final report + viva prep | Full report, results/validation chapter, demo script |

---

## 9. How to Feed This to an AI Coding Assistant

Don't paste this whole document as one giant prompt — build it the way a real engineering team would: phase by phase, verifying each layer before the next. Suggested prompt sequence (works well in Claude Code):

1. *"Set up the project skeleton per this architecture: FastAPI backend + React/TS frontend + docker-compose, no business logic yet — just health-check endpoints and a blank map page."*
2. *"Implement the RF engine module (rf_engine/models.py) with FSPL, Okumura-Hata, and COST-231 Hata per these equations: [paste section 5.1]. Add pytest unit tests validating against known textbook path-loss values."*
3. *"Add the terrain/diffraction module using SRTM DEM sampling and single knife-edge diffraction, per section 5.2."*
4. *"Build the towers CRUD API and PostGIS schema from section 4."*
5. *"Build the frontend map view with tower placement and a coverage-raster overlay calling /api/simulate."*
6. *"Build the import pipeline (CSV/JSON/GeoJSON) per the service design in section 5, with the field mapping in section 6."*
7. *"Build the compare/best-ISP engine and results UI."*

Keep each phase's AI output in version control and re-verify RF numbers against manual calculations before moving on — this traceability is exactly what a viva panel will probe.

---

## 10. Report Chapters This Architecture Feeds Directly

- Ch.1 Introduction/Objectives → Section 1
- Ch.2 Literature Survey → cite Hata (1980), COST-231 report, ITU-R terrain diffraction models
- Ch.3 System Design → Section 2–4 (architecture diagram, schema)
- Ch.4 Methodology → Section 5 (equations, algorithm)
- Ch.5 Implementation → Section 6–7
- Ch.6 Results & Validation → compare your Hata output against known coverage plots or field data for validation credibility
- Ch.7 Conclusion & Future Scope → real DEM at scale, ray-tracing model, live Tarangsanchar sync, mobile app
