# Tarang Sanchar Tower Data Extractor Extension

## Context
The Nexus RF project requires real-world cellular tower data (locations, operator, technology, height, power, frequency/band) to seed the SQLite database and power the RF simulation and ISP comparison engine.
While Tarang Sanchar (tarangsanchar.gov.in) provides official cellular tower deployment and EMF compliance data across India, it does not provide a public bulk download API.
To collect clean, real data for the user's demo city/region, we are building a browser extension.

## Goals
1. Intercept / extract tower data while the user browses and inspects locations on Tarang Sanchar.
2. Normalize tower attributes to match the Nexus RF import schema (`import_parser.py`):
   - `name`, `latitude`, `longitude`, `operator`, `freq_mhz` (or `band`), `technology`, `height_m`, `power_dbm`, `tower_type`, `site_id`, `cell_id`.
3. Provide one-click export (CSV / JSON / GeoJSON) and direct push to the local Nexus RF API (`POST http://localhost:8000/api/import`).
4. Keep the extension lightweight, robust, and easy to load in Chrome / Edge (Manifest V3).

## Finalized Requirements & Decisions
- **Target Browser**: Manifest V3 (Google Chrome, Microsoft Edge, Brave, Chromium-based browsers).
- **Data Capture Mechanism**:
  1. **Network Interceptor (`injected.js`)**: Runs in the page context (`tarangsanchar.gov.in`), hooks into `window.fetch` and `XMLHttpRequest`, intercepting GeoJSON, JSON, and GIS endpoint responses containing tower coordinates, operator details, and technologies as the user pans or searches.
  2. **DOM / Popup Observer (`content.js`)**: Monitors DOM mutations (infowindows, Leaflet/OpenLayers popups, tables, or modal dialogs) to extract tower specs when markers or table rows are clicked.
- **Export Format**:
  - Direct file download for **CSV** and **JSON**.
  - Formatted strictly to match Nexus RF's [`import_parser.py`](file:///c:/Users/Jeeva/OneDrive/Desktop/tele/backend/app/services/import_parser.py) columns: `latitude`, `longitude`, `operator`, `band` / `frequency`, `technology`, `height`, `power`, `tower_type`, `site_id`, `cell_id`.
- **Deduplication & Storage**:
  - `chrome.storage.local` indexed by unique key `(site_id || cell_id || lat_lng_operator)`.
  - Ensures panning over the same area multiple times does not create duplicate entries.
- **Extension UI**:
  - Popup with live tower count badge.
  - Operator distribution breakdown (Airtel, Jio, Vi, BSNL, etc.).
  - Mini table preview with search filter.
  - "Export CSV (Nexus RF)", "Export JSON", and "Clear Storage" buttons.

