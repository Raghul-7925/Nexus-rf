export interface Tower {
  id: string;
  name: string;
  lat: number;
  lng: number;
  freq_mhz: number | null;
  height_m: number;
  power_dbm: number;
  operator: string | null;
  technology: string | null;
  bandwidth_mhz: number | null;
  tower_type: string | null;
  azimuth_deg: number | null;
  source: string;
  cell_id: string | null;
  site_id: string | null;
}

export type TowerCreate = Omit<Tower, 'id'>;

export interface Obstacle {
  id: string;
  points: [number, number][];
  height_m: number;
  obstacle_type: string;
}

export type ObstacleCreate = Omit<Obstacle, 'id'>;

export interface SimulateRequest {
  model?: string | null;
  environment?: string | null;
  green_dbm?: number;
  amber_dbm?: number;
  red_dbm?: number;
  resolution?: number;
  terrain_aware?: boolean;
  building_aware?: boolean;
}

export interface SimulateResponse {
  png_base64: string;
  bounds: [number, number, number, number]; // [south, west, north, east]
  max_range_km: number;
  area_km2: { green: number; amber: number; red: number };
  model: string;
  environment: string;
  terrain_aware: boolean;
  building_aware: boolean;
  buildings_count: number;
  avg_rsrp_dbm: number;
  center_rsrp_dbm: number;
  rsrq_db: number;
  sinr_db: number;
  color?: string;
  tower_id?: string;
  tower_lat?: number;
  tower_lng?: number;
  operator?: string;
  technology?: string;
  freq_mhz?: number;
  power_dbm?: number;
  height_m?: number;
}

export interface SimulateMultiRequest {
  tower_ids?: string[];
  site_id?: string;
  color_mode?: 'operator' | 'band' | 'rsrp';
  resolution?: number;
  terrain_aware?: boolean;
  building_aware?: boolean;
}

export interface SimulateMultiResponse {
  layers: SimulateResponse[];
  site_id?: string;
}

export interface CompareRequest {
  lat: number;
  lng: number;
  radius_km?: number;
  sort_by?: string;
  model?: string;
  environment?: string;
}

export interface CompareResultItem {
  operator: string;
  rx_dbm: number;
  freq_mhz: number;
  technology: string | null;
  bandwidth_mhz: number;
  distance_km: number;
  nearest_tower: string;
  coverage_score: number;
  speed_score: number;
  balanced_score: number;
  gaming_score?: number;
  indoor_score?: number;
  verdict?: string | null;
  bands_available: string[];
}

export interface CompareResponse {
  results: CompareResultItem[];
}

export interface RFRecommendedBand {
  band: string;
  freq_mhz: number;
  tech: string;
  bandwidth_mhz: number;
}

export interface RFRecommendedSite {
  site_id: string;
  name: string;
  lat: number;
  lng: number;
  tower_type: string;
  height_m: number;
  power_dbm: number;
  azimuth_deg: number | null;
  sectors_count: number;
  recommended_bands: RFRecommendedBand[];
  cell_radius_km: number;
  coverage_km2: number;
  priority_score: number;
  rationale: string;
}

export interface RFPlanRequest {
  center_lat: number;
  center_lng: number;
  radius_km?: number;
  target_generation?: string;
  density_type?: string | null;
  planning_priority?: string;
  operator?: string;
  target_population?: number | null;
}

export interface RFPlanResponse {
  center_lat: number;
  center_lng: number;
  radius_km: number;
  density_type: string;
  environment_detected: string;
  inter_site_distance_km: number;
  total_sites_recommended: number;
  total_area_km2: number;
  projected_coverage_pct: number;
  estimated_population_served: number;
  recommended_sites: RFRecommendedSite[];
}
