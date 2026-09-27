# Nexus RF — Tarang Sanchar Tower Extractor Extension

A Manifest V3 browser extension built specifically to capture, normalize, and export real Indian cellular tower data from **[Tarang Sanchar](https://tarangsanchar.gov.in)** directly into **Nexus RF**.

---

## 🚀 Features

- **Automatic Network Sniffing**: Silently intercepts ArcGIS feature layers, GeoJSON, and XHR/fetch queries as you pan, zoom, or search on the Tarang Sanchar portal.
- **On-Screen Popup Scraper**: Observes Leaflet/OpenLayers popups and modals when you click on tower markers, automatically extracting attributes.
- **Deduplication Engine**: Uses compound keys `(site_id + operator + lat + lng + tech)` to prevent duplicate tower records when panning over the same area.
- **Smart Attribute Normalization**:
  - Handles WGS-84 (EPSG:4326) and Web Mercator (EPSG:3857) coordinates.
  - Normalizes operator aliases (`BHARTI AIRTEL` → `Airtel`, `RELIANCE JIO` → `Jio`, `IDEA/VODAFONE` → `Vi`, `BSNL/MTNL` → `BSNL`).
  - Infers technology (`2G`, `3G`, `4G`, `5G`) and standard Indian frequency bands (e.g. Jio 2300 MHz, Airtel 1800 MHz, 5G 3500 MHz).
  - **Portal Color & Key Mapping**:
    | Portal Color | API Category Keys | Tower Type | Default Height | Default Power |
    |---|---|---|---|---|
    | 🔵 **Blue** | `Cinema`, `Theatre`, `Mall`, `Multiplex` | **Rooftop** | 25.0 m | 43 dBm (20W) |
    | 🟢 **Green** | `Shop`, `Ground`, `Hotel`, `School`, `Tower` | **Ground** | 35.0 m | 43 dBm (20W) |
    | 🩷 **Pink** | `Cafe`, `Restaurant`, `Wall` | **WallMount** | 12.0 m | 37 dBm (5W) |
- **Multi-Operator & Multi-Technology Aware**: Captures co-located operators (e.g. Jio 4G/5G, Airtel 2G/4G/5G, Vi, BSNL) sharing the exact same physical structure and coordinates without dropping or overwriting cells.
- **🛰 Auto-Grid Scanner (Slide by Slide)**: Automatically generates a sliding bounding-box grid across your city, fetching tower locations slide-by-slide with a polite 750ms delay.
- **🔁 Persistent Resume**: Saves scan progress in `chrome.storage.local`. If you pause, reload, or navigate away, clicking **Resume Scan** continues right where it left off, skipping already scanned slides.
- **⚡ Raw Mode**: Export pure tower locations and physical types (`Rooftop`, `Ground`, `WallMount`) with empty/null operator and frequency bands for fast large-scale topology mapping.
- **In-Page Floating HUD**: A discreet floating widget on `tarangsanchar.gov.in` displaying live captured tower counts, scanner status, and instant download buttons.
- **Extension Popup UI**:
  - Live Auto-Scan progress bar and Start/Pause/Resume buttons.
  - Raw Mode toggle.
  - Breakdown by operator (Airtel, Jio, Vi, BSNL) and technology.
  - Instant **Export Raw CSV** and **Export Full CSV**.

---

## 📦 How to Install (Chrome / Edge / Brave)

1. Open your browser and navigate to the Extensions management page:
   - **Chrome**: `chrome://extensions/`
   - **Edge**: `edge://extensions/`
   - **Brave**: `brave://extensions/`
2. Enable **Developer mode** (toggle switch in the top-right corner).
3. Click the **Load unpacked** button in the top-left corner.
4. Select the `extension` folder located at:
   ```
   c:\Users\Jeeva\OneDrive\Desktop\tele\extension
   ```
5. The extension icon **📡 Nexus RF — Tarang Sanchar Tower Extractor** will appear in your browser toolbar. Pin it for easy access!

---

## 🗺️ How to Collect Tower Data

1. Visit **[tarangsanchar.gov.in](https://tarangsanchar.gov.in)**.
2. In Tarang Sanchar:
   - Enter your target city, pincode, or address.
   - Zoom in and pan across the map in your area of interest.
   - Click on tower pins or infowindows if you want specific tower details.
3. Notice the floating **Nexus RF Extractor** pill at the bottom-right corner counting up captured towers in real time (e.g., `Captured Towers: 45`).
4. Click **Download CSV** directly from the floating pill, or click the extension icon in your browser toolbar to inspect the captured list and click **Export CSV**.

---

## 📥 Importing into Nexus RF

The exported CSV matches Nexus RF's `import_parser.py` schema:

| Column | Example | Description |
|---|---|---|
| `site_id` | `DEL-101` | Unique Site / Tower Identifier |
| `latitude` | `28.6139` | Decimal latitude in India |
| `longitude` | `77.2090` | Decimal longitude in India |
| `operator` | `Airtel` | Standardized operator name |
| `band` | `1800` | Frequency in MHz |
| `technology` | `4G` | 2G / 3G / 4G / 5G |
| `height` | `32.0` | Antenna height in meters |
| `power` | `43.0` | Transmit power in dBm |
| `tower_type` | `Rooftop` | Rooftop or Ground |
| `cell_id` | `null` | Cell identifier (if available) |

### Uploading to Nexus RF:
1. **Via Frontend UI**: Go to the Import tab in the Nexus RF dashboard and drag-and-drop the downloaded CSV file.
2. **Via Backend API**:
   ```bash
   curl -X POST http://127.0.0.1:8000/api/import \
     -F "file=@nexus_rf_towers_2026-09-27.csv"
   ```
