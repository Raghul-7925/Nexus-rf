"""
app/schemas.py  –  updated with auto model/environment + terrain flag
"""

from typing import Optional, List
from pydantic import BaseModel, Field


class TowerCreate(BaseModel):
    name: str
    lat: float
    lng: float
    freq_mhz: Optional[float] = None
    height_m: float = 25.0
    power_dbm: float = 43.0
    operator: Optional[str] = None
    technology: Optional[str] = None
    bandwidth_mhz: Optional[float] = None
    tower_type: Optional[str] = "Rooftop"
    azimuth_deg: Optional[float] = None
    source: str = "manual"
    cell_id: Optional[str] = None
    site_id: Optional[str] = None


class TowerUpdate(BaseModel):
    name: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    freq_mhz: Optional[float] = None
    height_m: Optional[float] = None
    power_dbm: Optional[float] = None
    operator: Optional[str] = None
    technology: Optional[str] = None
    bandwidth_mhz: Optional[float] = None
    tower_type: Optional[str] = None
    azimuth_deg: Optional[float] = None
    site_id: Optional[str] = None
    cell_id: Optional[str] = None
    source: Optional[str] = None


class TowerOut(TowerCreate):
    id: str

    class Config:
        from_attributes = True


class ObstacleCreate(BaseModel):
    points: List[List[float]] = Field(..., description="[[lat, lng], ...] min 3 points")
    height_m: float = 12.0
    obstacle_type: str = "building"


class ObstacleOut(ObstacleCreate):
    id: str

    class Config:
        from_attributes = True


class SimulateRequest(BaseModel):
    # Auto-selected when None – frontend never needs to send these
    model: Optional[str] = None        # None → auto from freq
    environment: Optional[str] = None  # None → auto via Nominatim
    # Signal thresholds (dBm)
    green_dbm: float = -85.0
    amber_dbm: float = -100.0
    red_dbm: float = -110.0
    resolution: int = 120
    terrain_aware: bool = True          # use Open-Elevation terrain
    building_aware: bool = True         # use OSM building footprints


class SimulateResponse(BaseModel):
    png_base64: str
    bounds: List[float]           # [south, west, north, east]
    max_range_km: float
    area_km2: dict                # {'green': x, 'amber': y, 'red': z}
    model: str
    environment: str
    terrain_aware: bool = True
    building_aware: bool = True
    buildings_count: int = 0
    avg_rsrp_dbm: float = -85.0
    center_rsrp_dbm: float = -65.0
    rsrq_db: float = -11.0
    sinr_db: float = 14.0
    color: Optional[str] = "#22c55e"
    tower_id: Optional[str] = None
    tower_lat: Optional[float] = None
    tower_lng: Optional[float] = None
    operator: Optional[str] = None
    technology: Optional[str] = None
    freq_mhz: Optional[float] = None
    power_dbm: Optional[float] = None
    height_m: Optional[float] = None


class SimulateMultiRequest(BaseModel):
    tower_ids: List[str] = []
    site_id: Optional[str] = None
    color_mode: str = "operator"  # "operator" | "band" | "rsrp"
    resolution: int = 120
    terrain_aware: bool = True
    building_aware: bool = True


class SimulateMultiResponse(BaseModel):
    layers: List[SimulateResponse]
    site_id: Optional[str] = None


class CompareRequest(BaseModel):
    lat: float
    lng: float
    radius_km: float = 5.0
    sort_by: str = "balanced"
    model: str = "hata"
    environment: str = "urban"


class CompareResultItem(BaseModel):
    operator: str
    rx_dbm: float
    freq_mhz: float
    technology: Optional[str]
    bandwidth_mhz: float
    distance_km: float
    nearest_tower: str
    coverage_score: float
    speed_score: float
    balanced_score: float
    bands_available: List[str]
    verdict: Optional[str] = None


class CompareResponse(BaseModel):
    results: List[CompareResultItem]


class RFRecommendedSite(BaseModel):
    site_id: str
    name: str
    lat: float
    lng: float
    tower_type: str
    height_m: float
    power_dbm: float
    azimuth_deg: Optional[float] = None
    sectors_count: int = 3
    recommended_bands: List[dict]
    cell_radius_km: float
    coverage_km2: float
    priority_score: float
    rationale: str


class RFPlanRequest(BaseModel):
    center_lat: float
    center_lng: float
    radius_km: float = 3.0
    target_generation: str = "4G+5G"  # "4G" | "5G" | "4G+5G"
    density_type: Optional[str] = None  # "dense_urban" | "urban" | "suburban" | "rural"
    planning_priority: str = "balanced"  # "coverage" | "capacity" | "balanced"
    operator: str = "Jio"  # "Jio" | "Airtel" | "Vi" | "BSNL" | "Multi-Operator"
    target_population: Optional[int] = None


class RFPlanResponse(BaseModel):
    center_lat: float
    center_lng: float
    radius_km: float
    density_type: str
    environment_detected: str
    inter_site_distance_km: float
    total_sites_recommended: int
    total_area_km2: float
    projected_coverage_pct: float
    estimated_population_served: int
    recommended_sites: List[RFRecommendedSite]


class RFDeployRequest(BaseModel):
    sites: List[RFRecommendedSite]

