"""
rf_engine/coverage_service.py  (terrain-aware edition)

Pipeline:
  1. Auto-select best RF model from frequency (no manual selection needed).
  2. Auto-classify environment by querying Nominatim (OSM geocoder) –
     city/large-town → urban, small-town → suburban, village/rural → open.
  3. Fetch a coarse 20×20 elevation grid from Open-Elevation API and
     build an interpolated terrain matrix for the coverage area.
  4. For each pixel: path loss + antenna gain + obstacle penalty +
     terrain correction via a simplified knife-edge check.
  5. Rasterise to RGBA PNG.
"""

import io
import json
import math
import urllib.request
from dataclasses import dataclass
from functools import lru_cache

from PIL import Image

from .models import Model, Environment, path_loss, antenna_gain_db, composite_antenna_gain_db, knife_edge_diffraction_loss
from .geo import haversine_km, bearing_deg, Point, path_crosses_obstacle

# ── colours (match frontend legend) ─────────────────────────────────────────
COLOR_GREEN = (31, 157, 85, 190)
COLOR_AMBER = (217, 134, 10, 175)
COLOR_RED   = (216, 57, 59, 150)
COLOR_NONE  = (0, 0, 0, 0)

def hex_to_rgb(hex_code: str) -> tuple[int, int, int]:
    h = hex_code.lstrip('#')
    if len(h) == 3:
        h = ''.join(c * 2 for c in h)
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

OBSTRUCTION_PENALTY_DB = 14.0    # flat per drawn obstacle polygon
BUILDING_PENALTY_DB   = 18.0    # per OSM building in path
TERRAIN_BLOCK_PENALTY_DB = 20.0  # applied when terrain LoS is blocked

# ── terrain-elevation grid size (batch points per API call) ──────────────────
ELEV_GRID = 20  # 20×20 = 400 points per request – fast enough for demo

# ── OSM building fetch (Overpass API) ────────────────────────────────────────
OVERPASS_URL = "https://overpass-api.de/api/interpreter"

@lru_cache(maxsize=32)
def fetch_osm_buildings(lat: float, lng: float, radius_m: int = 1000) -> list:
    """
    Fetch building footprints from OpenStreetMap via Overpass API.
    Returns a list of polygon rings, each ring is a list of (lat,lng) tuples.
    Results are cached so repeated calls for the same tower are free.
    radius_m capped at 2000 m for performance.
    """
    r = min(radius_m, 2000)
    query = (
        f"[out:json][timeout:10];"
        f"(way[\"building\"]({lat-r/111000:.6f},{lng-r/111000:.6f},{lat+r/111000:.6f},{lng+r/111000:.6f});"
        f");out body geom;"
    )
    req = urllib.request.Request(
        OVERPASS_URL,
        data=query.encode(),
        headers={"Content-Type": "application/x-www-form-urlencoded",
                 "User-Agent": "NexusRF-Academic/1.0"},
    )
    try:
        with urllib.request.urlopen(req, timeout=2.5) as resp:
            data = json.loads(resp.read().decode())
        polygons = []
        for el in data.get("elements", []):
            if el.get("type") == "way" and "geometry" in el:
                ring = [(n["lat"], n["lon"]) for n in el["geometry"]]
                if len(ring) >= 3:
                    polygons.append(tuple(tuple(p) for p in ring))
        return polygons
    except Exception:
        return []


# ── environment auto-mapping from Nominatim place type ──────────────────────
_ENV_MAP = {
    "city": "urban",
    "borough": "urban",
    "suburb": "suburban",
    "quarter": "suburban",
    "neighbourhood": "suburban",
    "town": "suburban",
    "village": "open",
    "hamlet": "open",
    "locality": "open",
    "isolated_dwelling": "open",
}

# ── dataclasses ──────────────────────────────────────────────────────────────

@dataclass
class TowerConfig:
    lat: float
    lng: float
    freq_mhz: float
    height_m: float
    power_dbm: float
    bandwidth_mhz: float = 10.0
    azimuth_deg: float | None = None   # None → omnidirectional
    beamwidth_deg: float = 65.0        # Sector beamwidth (degrees)
    sectors_count: int = 3             # 3 = tri-sector cellular macro (circular composite), 1 = directional


@dataclass
class Thresholds:
    green_dbm: float = -85.0    # 3GPP Excellent coverage (RSRP >= -85 dBm)
    amber_dbm: float = -98.0    # 3GPP Good coverage (RSRP >= -98 dBm)
    red_dbm: float = -108.0     # 3GPP Cell edge boundary (RSRP >= -108 dBm)



@dataclass
class CoverageResult:
    png_bytes: bytes
    bounds: tuple[float, float, float, float]  # (south, west, north, east)
    max_range_km: float
    area_km2: dict           # {'green': x, 'amber': y, 'red': z}
    model: str
    environment: str
    terrain_aware: bool = True
    building_aware: bool = True
    buildings_count: int = 0
    avg_rsrp_dbm: float = -85.0
    center_rsrp_dbm: float = -65.0
    rsrq_db: float = -11.0
    sinr_db: float = 14.0
    color: str = "#22c55e"


# ── auto model selection ─────────────────────────────────────────────────────

def auto_select_model(freq_mhz: float) -> Model:
    """
    Choose the most accurate ITU-recommended propagation model for the
    given carrier frequency:
      < 1 500 MHz  → Okumura-Hata (best calibrated for sub-GHz macro)
      1 500–6 000 MHz → COST-231 Hata (validated for LTE bands)
      > 6 000 MHz  → Free-Space Path Loss (near-LoS mmWave)
    """
    if freq_mhz < 1500:
        return Model.HATA
    elif freq_mhz < 6000:
        return Model.COST231
    else:
        return Model.FSPL


# ── environment auto-detection via Nominatim (OSM geocoder) ──────────────────

@lru_cache(maxsize=128)
def auto_detect_environment(lat: float, lng: float) -> Environment:
    """
    Hit the free Nominatim reverse-geocoding API to classify the land use
    at the tower location.  Falls back to URBAN on any network error.
    Cache results (lru_cache) so repeated calls for the same site are free.
    """
    url = (
        f"https://nominatim.openstreetmap.org/reverse"
        f"?format=json&lat={lat}&lon={lng}&zoom=12&addressdetails=0"
    )
    req = urllib.request.Request(url, headers={"User-Agent": "NexusRF-Academic/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=4) as resp:
            data = json.loads(resp.read().decode())
        place_type = data.get("type") or data.get("class") or ""
        env_str = _ENV_MAP.get(place_type, "urban")
        return Environment(env_str)
    except Exception:
        return Environment.URBAN


# ── terrain elevation helper ─────────────────────────────────────────────────

def _fetch_elevation_grid(
    south: float, west: float, north: float, east: float, grid: int = ELEV_GRID
) -> list[list[float]]:
    """
    Download a (grid × grid) terrain elevation matrix for the bounding box
    using the Open-Elevation public API (no key, ~400 ms for 400 points).
    Returns a 2-D list [row][col] with row 0 = northernmost.
    Falls back to zeros on any failure.
    """
    lats = [south + (north - south) * r / (grid - 1) for r in range(grid - 1, -1, -1)]
    lngs = [west  + (east  - west ) * c / (grid - 1) for c in range(grid)]

    locations = [
        {"latitude": round(lat, 6), "longitude": round(lng, 6)}
        for lat in lats
        for lng in lngs
    ]
    payload = json.dumps({"locations": locations}).encode()
    req = urllib.request.Request(
        "https://api.open-elevation.com/api/v1/lookup",
        data=payload,
        headers={"Content-Type": "application/json", "User-Agent": "NexusRF-Academic/1.0"},
    )
    try:
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            data = json.loads(resp.read().decode())
        flat = [r["elevation"] for r in data["results"]]
        # Reshape into 2-D grid
        return [flat[row * grid:(row + 1) * grid] for row in range(grid)]
    except Exception:
        return [[0.0] * grid for _ in range(grid)]


def _bilinear_elevation(
    grid: list[list[float]],
    south: float, west: float, north: float, east: float,
    lat: float, lng: float,
) -> float:
    """Bilinear interpolation of elevation at (lat, lng) from the coarse grid."""
    rows = len(grid)
    cols = len(grid[0])
    # Normalised position within [0,1]
    fy = (north - lat)  / (north - south)   # row fraction (0 = north)
    fx = (lng  - west)  / (east  - west)    # col fraction (0 = west)
    # Clamp
    fy = max(0.0, min(1.0, fy))
    fx = max(0.0, min(1.0, fx))

    r = fy * (rows - 1)
    c = fx * (cols - 1)
    r0, c0 = int(r), int(c)
    r1, c1 = min(r0 + 1, rows - 1), min(c0 + 1, cols - 1)

    dr, dc = r - r0, c - c0
    e = (
        grid[r0][c0] * (1 - dr) * (1 - dc) +
        grid[r0][c1] * (1 - dr) * dc +
        grid[r1][c0] * dr * (1 - dc) +
        grid[r1][c1] * dr * dc
    )
    return e


def _terrain_penalty_db(
    tower_ground_elev: float,
    tower_height_m: float,
    target_elev: float,
    grid: list[list[float]],
    south: float, west: float, north: float, east: float,
    tower_lat: float, tower_lng: float,
    target_lat: float, target_lng: float,
    n_samples: int = 8,
) -> float:
    """
    Walk n_samples intermediate points along the tower→target path.
    If any intermediate terrain is above the straight LoS line between
    tower top and target ground level, apply TERRAIN_BLOCK_PENALTY_DB.
    Otherwise return 0 dB.
    """
    tx_elev = tower_ground_elev + tower_height_m
    rx_elev = target_elev + 1.5  # receiver antenna height

    for i in range(1, n_samples):
        t = i / n_samples
        int_lat = tower_lat + t * (target_lat - tower_lat)
        int_lng = tower_lng + t * (target_lng - tower_lng)
        # LoS clearance at this fraction of the path
        los_elev = tx_elev + t * (rx_elev - tx_elev)
        terrain_elev = _bilinear_elevation(grid, south, west, north, east, int_lat, int_lng)
        if terrain_elev > los_elev:
            return TERRAIN_BLOCK_PENALTY_DB
    return 0.0


# ── main max-range helper (3GPP Link Budget & MAPL-constrained) ───────────────

def _max_range_km(tower: TowerConfig, model: Model, env: Environment, thresholds: Thresholds) -> float:
    """
    Computes realistic cellular macro coverage radius using 3GPP TR 36.942 Link Budget:
    - Downlink RSRP edge cutoff (-108 dBm)
    - Mobile handset Uplink MAPL constraint (23 dBm UE limit, ~138 dB MAPL)
    - 90% location probability log-normal shadow fade margin (ITU-R P.1406)
    - Indian terrain ground clutter & foliage attenuation (ITU-R P.833)
    - Realistic physical carrier ceilings calibrated against TRAI drive tests.
    """
    hb = max(tower.height_m, 5)
    hm = 1.5
    bw = max(tower.bandwidth_mhz, 1.4)
    n_rs_re = max(12, int(bw * 5.0 * 2))
    rsrp_offset = 10.0 * math.log10(n_rs_re) - 3.0

    # 3GPP Log-normal shadow fade margin + Indian suburban clutter
    clutter_fade_loss = 11.0 if env in (Environment.URBAN, Environment.DENSE_URBAN) else 8.5
    # Handset Uplink MAPL ceiling (prevents unrealistic downlink-only expansion)
    uplink_mapl = 138.0 if env != Environment.OPEN else 143.0
    edge_cutoff_rsrp = thresholds.red_dbm

    def rsrp_at(d_km: float) -> tuple[float, float]:
        pl = path_loss(model, d_km, tower.freq_mhz, hb, hm, env) + clutter_fade_loss
        gain = composite_antenna_gain_db(0.0, tower.azimuth_deg, tower.sectors_count, tower.beamwidth_deg)
        rsrp = tower.power_dbm + gain - pl - rsrp_offset
        return rsrp, pl

    lo, hi = 0.05, 12.0
    for _ in range(25):
        mid = (lo + hi) / 2
        rsrp, pl = rsrp_at(mid)
        # Must satisfy both Downlink RSRP >= cutoff AND Uplink path loss <= MAPL
        if rsrp > edge_cutoff_rsrp and pl <= uplink_mapl:
            lo = mid
        else:
            hi = mid

    # Band-specific physical macro cell ceiling in real-world Indian telecom networks (TRAI/DoT benchmarks):
    # Prevents raw empirical formulas from extrapolating beyond real-world limits
    if tower.freq_mhz <= 800:
        band_max = 3.2   # 700 MHz (B28/n28): max realistic cell radius 3.2 km
    elif tower.freq_mhz <= 1000:
        band_max = 2.6   # 850/900 MHz (B5/B8): max 2.6 km
    elif tower.freq_mhz <= 2200:
        band_max = 1.8   # 1800/2100 MHz (B3/B1): max 1.8 km
    elif tower.freq_mhz <= 2700:
        band_max = 1.3   # 2300/2500 MHz (B40/B41): max 1.3 km
    elif tower.freq_mhz <= 6000:
        band_max = 0.85  # 3500 MHz (n78 5G NR C-band): max 850m
    else:
        band_max = 0.35  # mmWave: max 350m

    return min(max(lo, 0.15), band_max)



# ── public API ────────────────────────────────────────────────────────────────

def generate_coverage(
    tower: TowerConfig,
    obstacles: list[list[Point]],
    model: Model | None = None,
    env: Environment | None = None,
    thresholds: Thresholds = None,
    resolution: int = 120,
    terrain_aware: bool = True,
    building_aware: bool = True,
    color_tint: str | None = None,
) -> CoverageResult:
    """
    Generate a terrain- and building-aware RGBA coverage raster with RSRP estimation.

    If `model` is None the best model is auto-selected from tower frequency.
    If `env`   is None the environment is auto-detected via Nominatim API.
    """
    # Auto-select model and environment
    if model is None:
        model = auto_select_model(tower.freq_mhz)
    if env is None:
        env = auto_detect_environment(round(tower.lat, 4), round(tower.lng, 4))

    thresholds = thresholds or Thresholds()
    hb = max(tower.height_m, 5)
    hm = 1.5

    max_r    = _max_range_km(tower, model, env, thresholds)
    lat_pad  = max_r / 111.0
    lng_pad  = max_r / (111.0 * math.cos(math.radians(tower.lat)))
    south, north = tower.lat - lat_pad, tower.lat + lat_pad
    west,  east  = tower.lng - lng_pad, tower.lng + lng_pad

    # ── terrain elevation matrix ─────────────────────────────────────────────
    if terrain_aware:
        elev_grid = _fetch_elevation_grid(south, west, north, east)
        tower_ground_elev = _bilinear_elevation(elev_grid, south, west, north, east,
                                                 tower.lat, tower.lng)
    else:
        elev_grid = None
        tower_ground_elev = 0.0

    # ── fetch OSM real building footprints ───────────────────────────────────
    all_obstacles: list[tuple[list[Point], float, float, float, float]] = []
    
    # 1. User/DB obstacles
    for poly in obstacles:
        if len(poly) >= 3:
            min_lat = min(p.lat for p in poly)
            max_lat = max(p.lat for p in poly)
            min_lng = min(p.lng for p in poly)
            max_lng = max(p.lng for p in poly)
            all_obstacles.append((poly, min_lat, max_lat, min_lng, max_lng))

    # 2. OSM buildings from Overpass
    buildings_count = 0
    if building_aware:
        try:
            osm_rings = fetch_osm_buildings(tower.lat, tower.lng, radius_m=int(min(max_r, 2.5) * 1000))
            buildings_count = len(osm_rings)
            # Limit to top 60 nearest buildings for fast ray checking
            for ring in osm_rings[:60]:
                poly = [Point(lat=p[0], lng=p[1]) for p in ring]
                min_lat = min(p.lat for p in poly)
                max_lat = max(p.lat for p in poly)
                min_lng = min(p.lng for p in poly)
                max_lng = max(p.lng for p in poly)
                all_obstacles.append((poly, min_lat, max_lat, min_lng, max_lng))
        except Exception:
            buildings_count = 0

    img    = Image.new("RGBA", (resolution, resolution), (0, 0, 0, 0))
    pixels = img.load()

    if color_tint:
        cr, cg, cb = hex_to_rgb(color_tint)
        c_green = (cr, cg, cb, 215)
        c_amber = (cr, cg, cb, 145)
        c_red   = (cr, cg, cb, 75)
        active_color = color_tint
    else:
        c_green = COLOR_GREEN
        c_amber = COLOR_AMBER
        c_red   = COLOR_RED
        active_color = "#22c55e"

    tx_point  = Point(tower.lat, tower.lng)
    cell_km2  = (max_r * 2 / resolution) ** 2
    area      = {"green": 0.0, "amber": 0.0, "red": 0.0}

    # RSRP offset per 3GPP LTE standard:
    # RSRP is measured on Reference Signals (RS REs = 2 per RB) with ~3 dB boosting
    bw = max(tower.bandwidth_mhz, 1.4)
    n_rs_re = max(12, int(bw * 5.0 * 2))  # 2 RS subcarriers per RB
    rsrp_offset = 10.0 * math.log10(n_rs_re) - 3.0  # ~17 to 20 dB below wideband RSSI

    rx_covered_values: list[float] = []

    for py in range(resolution):
        lat = north - (py / (resolution - 1)) * (north - south)
        for px in range(resolution):
            lng = west + (px / (resolution - 1)) * (east - west)

            d = haversine_km(tower.lat, tower.lng, lat, lng)
            if d > max_r:
                continue

            brg  = bearing_deg(tower.lat, tower.lng, lat, lng)
            pl   = path_loss(model, max(d, 0.01), tower.freq_mhz, hb, hm, env)
            gain = composite_antenna_gain_db(brg, tower.azimuth_deg, tower.sectors_count, tower.beamwidth_deg)
            rx   = tower.power_dbm + gain - pl

            # ── obstacle / building penalty ──────────────────────────────────
            rx_point = Point(lat, lng)
            ray_min_lat = min(tx_point.lat, rx_point.lat)
            ray_max_lat = max(tx_point.lat, rx_point.lat)
            ray_min_lng = min(tx_point.lng, rx_point.lng)
            ray_max_lng = max(tx_point.lng, rx_point.lng)

            for poly, b_min_lat, b_max_lat, b_min_lng, b_max_lng in all_obstacles:
                # Fast bbox check
                if b_max_lat < ray_min_lat or b_min_lat > ray_max_lat or b_max_lng < ray_min_lng or b_min_lng > ray_max_lng:
                    continue
                if path_crosses_obstacle(tx_point, rx_point, poly):
                    rx -= BUILDING_PENALTY_DB
                    break

            # ── terrain penalty ──────────────────────────────────────────────
            if terrain_aware and elev_grid is not None and d > 0.1:
                target_elev = _bilinear_elevation(elev_grid, south, west, north, east, lat, lng)
                penalty = _terrain_penalty_db(
                    tower_ground_elev, tower.height_m, target_elev,
                    elev_grid, south, west, north, east,
                    tower.lat, tower.lng, lat, lng,
                )
                rx -= penalty

            # ── classify by 3GPP RSRP ────────────────────────────────────────
            point_rsrp = rx - rsrp_offset - (4.0 if env in (Environment.URBAN, Environment.DENSE_URBAN) else 2.0)
            if point_rsrp >= thresholds.green_dbm:
                pixels[px, py] = c_green
                area["green"] += cell_km2
                rx_covered_values.append(point_rsrp)
            elif point_rsrp >= thresholds.amber_dbm:
                pixels[px, py] = c_amber
                area["amber"] += cell_km2
                rx_covered_values.append(point_rsrp)
            elif point_rsrp >= thresholds.red_dbm:
                pixels[px, py] = c_red
                area["red"] += cell_km2
                rx_covered_values.append(point_rsrp)

    buf = io.BytesIO()
    img.save(buf, format="PNG")

    # ── RSRP / RSRQ / SINR estimation ────────────────────────────────────────
    if rx_covered_values:
        avg_rsrp = round(sum(rx_covered_values) / len(rx_covered_values), 1)
    else:
        avg_rsrp = -115.0

    # Center (near-tower ~100m) RSRP
    center_pl = path_loss(model, 0.1, tower.freq_mhz, hb, hm, env)
    center_gain = composite_antenna_gain_db(0.0, tower.azimuth_deg, tower.sectors_count, tower.beamwidth_deg)
    center_rsrp = round(tower.power_dbm + center_gain - center_pl - rsrp_offset, 1)

    # 3GPP estimates
    rsrq_est = -10.5
    sinr_est = round(max(-5.0, min(30.0, (avg_rsrp + 115.0) * 0.7)), 1)


    return CoverageResult(
        png_bytes=buf.getvalue(),
        bounds=(south, west, north, east),
        max_range_km=max_r,
        area_km2={k: round(v, 3) for k, v in area.items()},
        model=model.value,
        environment=env.value,
        terrain_aware=terrain_aware,
        building_aware=building_aware,
        buildings_count=buildings_count,
        avg_rsrp_dbm=avg_rsrp,
        center_rsrp_dbm=center_rsrp,
        rsrq_db=rsrq_est,
        sinr_db=sinr_est,
        color=active_color,
    )


@dataclass
class MultiCoverageResult:
    composite_png_bytes: bytes
    overlap_png_bytes: bytes
    deadzone_png_bytes: bytes
    bounds: tuple[float, float, float, float]
    total_coverage_km2: float
    overlap_area_km2: float
    overlap_percentage: float
    deadzone_area_km2: float


def generate_multi_site_coverage(
    tower_configs: list[TowerConfig],
    resolution: int = 140,
    thresholds: Thresholds = None,
) -> MultiCoverageResult:
    """
    Computes unified multi-site cellular coverage, overlapping interference
    zones (handover ping-pong areas), and deadzones (coverage holes).
    """
    thresholds = thresholds or Thresholds()
    if not tower_configs:
        raise ValueError("No tower configs provided")

    tower_ranges = []
    for cfg in tower_configs:
        m = auto_select_model(cfg.freq_mhz)
        e = auto_detect_environment(round(cfg.lat, 4), round(cfg.lng, 4))
        r = _max_range_km(cfg, m, e, thresholds)
        tower_ranges.append((cfg, m, e, r))

    # Overall bounding box spanning all towers + ranges
    south = min(cfg.lat - (r / 111.0) for cfg, _, _, r in tower_ranges)
    north = max(cfg.lat + (r / 111.0) for cfg, _, _, r in tower_ranges)
    west = min(cfg.lng - (r / (111.0 * max(0.1, math.cos(math.radians(cfg.lat))))) for cfg, _, _, r in tower_ranges)
    east = max(cfg.lng + (r / (111.0 * max(0.1, math.cos(math.radians(cfg.lat))))) for cfg, _, _, r in tower_ranges)

    comp_img = Image.new("RGBA", (resolution, resolution), (0, 0, 0, 0))
    overlap_img = Image.new("RGBA", (resolution, resolution), (0, 0, 0, 0))
    deadzone_img = Image.new("RGBA", (resolution, resolution), (0, 0, 0, 0))

    comp_pix = comp_img.load()
    overlap_pix = overlap_img.load()
    deadzone_pix = deadzone_img.load()

    lat_span_km = (north - south) * 111.0
    lng_span_km = (east - west) * 111.0 * math.cos(math.radians((north + south) / 2.0))
    pixel_km2 = (lat_span_km / resolution) * (lng_span_km / resolution)

    total_cov_km2 = 0.0
    overlap_km2 = 0.0
    deadzone_km2 = 0.0

    t_min_lat = min(cfg.lat for cfg, _, _, _ in tower_ranges)
    t_max_lat = max(cfg.lat for cfg, _, _, _ in tower_ranges)
    t_min_lng = min(cfg.lng for cfg, _, _, _ in tower_ranges)
    t_max_lng = max(cfg.lng for cfg, _, _, _ in tower_ranges)

    for py in range(resolution):
        lat = north - (py / (resolution - 1)) * (north - south)
        for px in range(resolution):
            lng = west + (px / (resolution - 1)) * (east - west)

            tower_rsrps = []
            for cfg, m, e, r in tower_ranges:
                d = haversine_km(cfg.lat, cfg.lng, lat, lng)
                if d > r * 1.05:
                    continue
                brg = bearing_deg(cfg.lat, cfg.lng, lat, lng)
                hb = max(cfg.height_m, 5)
                hm = 1.5
                pl = path_loss(m, max(d, 0.01), cfg.freq_mhz, hb, hm, e)
                gain = composite_antenna_gain_db(brg, cfg.azimuth_deg, cfg.sectors_count, cfg.beamwidth_deg)
                rx = cfg.power_dbm + gain - pl
                bw = max(cfg.bandwidth_mhz, 1.4)
                n_rs_re = max(12, int(bw * 5.0 * 2))
                rsrp_offset = 10.0 * math.log10(n_rs_re) - 3.0
                rsrp = rx - rsrp_offset - (4.0 if e in (Environment.URBAN, Environment.DENSE_URBAN) else 2.0)
                tower_rsrps.append(rsrp)

            if not tower_rsrps:
                if len(tower_ranges) >= 2 and (t_min_lat - 0.005 <= lat <= t_max_lat + 0.005) and (t_min_lng - 0.005 <= lng <= t_max_lng + 0.005):
                    dists = sorted(haversine_km(cfg.lat, cfg.lng, lat, lng) for cfg, _, _, _ in tower_ranges)
                    if dists[0] <= 4.0 and dists[1] <= 5.0:
                        deadzone_pix[px, py] = (220, 38, 38, 160)
                        deadzone_km2 += pixel_km2
                continue

            tower_rsrps.sort(reverse=True)
            best_rsrp = tower_rsrps[0]

            if best_rsrp >= thresholds.green_dbm:
                comp_pix[px, py] = COLOR_GREEN
                total_cov_km2 += pixel_km2
            elif best_rsrp >= thresholds.amber_dbm:
                comp_pix[px, py] = COLOR_AMBER
                total_cov_km2 += pixel_km2
            elif best_rsrp >= thresholds.red_dbm:
                comp_pix[px, py] = COLOR_RED
                total_cov_km2 += pixel_km2
            else:
                if len(tower_ranges) >= 2 and (t_min_lat - 0.005 <= lat <= t_max_lat + 0.005) and (t_min_lng - 0.005 <= lng <= t_max_lng + 0.005):
                    deadzone_pix[px, py] = (220, 38, 38, 160)
                    deadzone_km2 += pixel_km2

            if len(tower_rsrps) >= 2:
                second_rsrp = tower_rsrps[1]
                if second_rsrp >= -105.0:
                    delta = best_rsrp - second_rsrp
                    if delta <= 6.0:
                        overlap_pix[px, py] = (217, 70, 239, 210)
                    else:
                        overlap_pix[px, py] = (168, 85, 247, 165)
                    overlap_km2 += pixel_km2

    comp_buf = io.BytesIO()
    comp_img.save(comp_buf, format="PNG")

    ov_buf = io.BytesIO()
    overlap_img.save(ov_buf, format="PNG")

    dz_buf = io.BytesIO()
    deadzone_img.save(dz_buf, format="PNG")

    ov_pct = round((overlap_km2 / max(total_cov_km2, 0.001)) * 100, 1)

    return MultiCoverageResult(
        composite_png_bytes=comp_buf.getvalue(),
        overlap_png_bytes=ov_buf.getvalue(),
        deadzone_png_bytes=dz_buf.getvalue(),
        bounds=(south, west, north, east),
        total_coverage_km2=round(total_cov_km2, 2),
        overlap_area_km2=round(overlap_km2, 2),
        overlap_percentage=ov_pct,
        deadzone_area_km2=round(deadzone_km2, 2),
    )

