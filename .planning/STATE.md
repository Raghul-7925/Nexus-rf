# GSD State: Tarang Sanchar Data Extractor Extension & Nexus RF Platform

## Current Phase: 5. Ship
Status: All requested fixes for App & Extension completed, verified, and running.

## Milestones & Checklist
- [x] Phase 1: Discuss & Scope
  - [x] Initial project context research & architecture check
  - [x] Clarify extension capture strategy (Auto network interception + detail scraper)
  - [x] Clarify export preference (CSV + JSON file export matching Nexus RF parser)
  - [x] Finalize data normalization requirements matching `backend/app/services/import_parser.py`
- [x] Phase 2: Plan & Architecture
  - [x] Manifest V3 layout (`manifest.json`, background, content scripts, injected script, popup)
  - [x] Parser heuristics for Tarang Sanchar payloads and DOM structures
- [x] Phase 3: Execute
  - [x] Scaffold `extension/` directory with `manifest.json`
  - [x] Implement `injected.js` (intercepts XHR and fetch in page context and posts messages)
  - [x] Implement `content.js` (bridges injected script to background and observes DOM for modal popups)
  - [x] Implement `background.js` (service worker managing `chrome.storage.local`, deduplication, and badge update)
  - [x] Implement `parser.js` (robust heuristic extractor for lat, lng, operator, tech, band, height, etc.)
  - [x] Implement `popup.html`, `popup.css`, `popup.js` (stats, preview table, CSV/JSON export)
  - [x] Create extension icons (16, 48, 128)
- [x] Phase 4: Verify
  - [x] Test JSON and CSV output against `backend/tests/test_import_parser.py`
  - [x] Analyzed real user `tarangsanchar.gov.in.har` file (identified `GetLocations` and `GetLocationDetails` payload formats)
  - [x] Upgraded parser to support `location_latitude`, `location_longitude`, `url_point` Site IDs, and multi-operator string decomposition
  - [x] Verified extraction on HAR data: extracted 21 real sites and 26 multi-operator towers
  - [x] Implemented Raw Mode (`sitesToRawCSV`) with null operator/band and validated with backend parser
  - [x] Created `test_extension_raw_mode_compatibility` (Passing 100%)
- [x] Phase 6: Scope Refinement, RF Planning & Data Segregation (v1.4.0)
  - [x] **Bulk Deletion API & UI**: Added `DELETE /api/towers/all?source=all|user_test|real` and UI buttons in Import panel ("Clear All Towers", "Clear My Test & Planned Towers").
  - [x] **Merged Site Builder into Coverage Simulation**: Removed standalone Site Builder tab; unified tower creation and simulation in SimulationPanel with 1-click quick configuration for raw towers.
  - [x] **Engineering RF Planning & Dimensioning Tab**: Added 3GPP/ITU-R link budget, MAPL, COST-231 Hata radius calculations, hexagonal ISD tessellation, and 1-click site deployment (`POST /api/rf-plan` & `POST /api/rf-plan/deploy`).
  - [x] **Best ISP Recommendation by Needs**: Added digital needs selector (Balanced, High-Speed Streaming, Low-Latency 5G Gaming, Deep Indoor Sub-1GHz) with #1 Top Pick trophy and engineering verdict.
  - [x] **Data Scoping & Scoped Export**: Segregated real baseline towers (`tarangsanchar`) from user test/planned towers (`user_test`, `rf_planned`). Scoped exports allow downloading only test/planned data, real baseline data, or complete merged dataset.
  - [x] **Map Enhancements**: Added source badges (🛠️ Planned, 🧪 Test, 🏛 Real) to markers and popups, plus top-level source filter pills (All, Real, Test/Plan).
  - [x] All 42/42 backend tests passing.
  - [x] Frontend builds with 0 errors and dev server running on http://localhost:5173.

