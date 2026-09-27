## What was completed (v1.4.0)

### 1. Bulk Tower Deletion & Reset:
- Added `DELETE /api/towers/all?source=all|user_test|real` endpoint.
- In the Import / Export panel, added 1-click **"Clear All Towers"** and **"Clear My Test & Planned Towers"** buttons. Users no longer need to delete bulk imported towers one by one.

### 2. Merged Site Builder into Coverage Simulation:
- Removed the standalone Site Builder tab.
- Integrated site building directly into [`frontend/src/components/SimulationPanel.tsx`](file:///c:/Users/Jeeva/OneDrive/Desktop/tele/frontend/src/components/SimulationPanel.tsx).
- Users can toggle between **"Existing Towers"** (with quick configuration for raw unconfigured towers) and **"➕ Add & Simulate New Site"** with customizable operator, bands, height, and power.

### 3. Engineering RF Planning & Dimensioning Tab:
- Created [`frontend/src/components/RFPlanningPanel.tsx`](file:///c:/Users/Jeeva/OneDrive/Desktop/tele/frontend/src/components/RFPlanningPanel.tsx) and backend engine [`backend/app/rf_engine/rf_planning_service.py`](file:///c:/Users/Jeeva/OneDrive/Desktop/tele/backend/app/rf_engine/rf_planning_service.py).
- Uses 3GPP/ITU-R link budget, MAPL, COST-231 Hata radius dimensioning, and hexagonal ISD tessellation.
- Recommends optimal cell site locations, tower heights, transmission power, multi-band configurations (Tri-band, C-Band 5G, Sub-1GHz 4G/5G), and population served.
- Added **"Deploy All Planned Sites to Map"** button (`POST /api/rf-plan/deploy`) with 1-click simulation.

### 4. Best ISP Finder by User Digital Needs:
- Enhanced [`frontend/src/components/ComparePanel.tsx`](file:///c:/Users/Jeeva/OneDrive/Desktop/tele/frontend/src/components/ComparePanel.tsx) with digital need personas:
  - 🏆 **Balanced**: Best overall balance of signal, speed, and reliability.
  - ⚡ **Fast Speed**: High bandwidth for 4K streaming and downloads.
  - 🎮 **Low Latency**: 5G NR low latency and ping for mobile gaming.
  - 🏠 **Deep Indoor**: Sub-1GHz (700/800/900 MHz) penetration for concrete buildings and rural areas.
- Automated engineering verdicts explaining exactly why an ISP was ranked #1.

### 5. Data Scoping & Scoped Export:
- Baseline real towers from Tarang Sanchar are tagged with `source: 'tarangsanchar'`.
- User test towers and RF planned sites are tagged with `source: 'user_test'` and `source: 'rf_planned'`.
- Scoped export options: **"My Test & Planned Towers Only"**, **"Real Baseline Towers"**, or **"Complete Merged Dataset"**.
- Markers on the map display source badges (🛠️ Planned, 🧪 Test, 🏛 Real) with top-level filter pills (`All`, `Real`, `Test/Plan`).

## Verification
- Backend tests: **42/42 tests passing** (`pytest`).
- Frontend build: **0 errors** (`tsc -b && vite build`).
- Local servers actively running:
  - Frontend: [http://localhost:5173/](http://localhost:5173/)
  - Backend: [http://127.0.0.1:8000](http://127.0.0.1:8000) (Docs at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs))

