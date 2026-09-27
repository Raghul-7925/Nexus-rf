"""
backend/app/rf_engine/rf_planning_service.py

Professional Telecom RF Planning & Dimensioning Engine.
Applies 3GPP and ITU-R standard methodology:
  1. Environment & clutter classification (Dense Urban, Urban, Suburban, Rural).
  2. Link budget & Maximum Allowable Path Loss (MAPL) calculation.
  3. Cell radius & Inter-Site Distance (ISD) computation via COST-231 / Hata propagation.
  4. Hexagonal tessellation & existing infrastructure gap detection.
  5. Optimal site coordinate, tower type, height, power, and spectrum band recommendations.
"""

import math
from typing import List, Dict, Any, Optional

from .geo import haversine_km, destination_point
from .coverage_service import auto_detect_environment
from ..schemas import RFPlanRequest, RFPlanResponse, RFRecommendedSite


# Clutter and demographic baselines per environment
CLUTTER_PARAMS = {
    "dense_urban": {
        "clutter_loss_db": 18.0,
        "fade_margin_db": 9.0,
        "pop_density_km2": 12000,
        "default_type": "Rooftop",
        "default_height": 24.0,
        "default_power": 43.0,
        "freq_carrier_mhz": 2300,
    },
    "urban": {
        "clutter_loss_db": 12.0,
        "fade_margin_db": 8.0,
        "pop_density_km2": 6500,
        "default_type": "Rooftop",
        "default_height": 28.0,
        "default_power": 43.0,
        "freq_carrier_mhz": 1800,
    },
    "suburban": {
        "clutter_loss_db": 6.0,
        "fade_margin_db": 7.0,
        "pop_density_km2": 2200,
        "default_type": "Ground",
        "default_height": 35.0,
        "default_power": 43.0,
        "freq_carrier_mhz": 1800,
    },
    "rural": {
        "clutter_loss_db": 2.0,
        "fade_margin_db": 6.0,
        "pop_density_km2": 450,
        "default_type": "Ground",
        "default_height": 45.0,
        "default_power": 46.0,
        "freq_carrier_mhz": 700,
    },
}

# Operator band packages for recommended deployments in India
OPERATOR_SPECTRUM_PROFILES = {
    "Jio": {
        "4G": [
            {"band": "B40", "freq_mhz": 2300, "tech": "4G TDD", "bandwidth_mhz": 20},
            {"band": "B5", "freq_mhz": 850, "tech": "4G FDD", "bandwidth_mhz": 10},
        ],
        "5G": [
            {"band": "n78", "freq_mhz": 3500, "tech": "5G NR", "bandwidth_mhz": 100},
            {"band": "n28", "freq_mhz": 700, "tech": "5G NR", "bandwidth_mhz": 30},
        ],
    },
    "Airtel": {
        "4G": [
            {"band": "B3", "freq_mhz": 1800, "tech": "4G FDD", "bandwidth_mhz": 15},
            {"band": "B8", "freq_mhz": 900, "tech": "4G FDD", "bandwidth_mhz": 10},
        ],
        "5G": [
            {"band": "n78", "freq_mhz": 3500, "tech": "5G NR", "bandwidth_mhz": 100},
        ],
    },
    "Vi": {
        "4G": [
            {"band": "B3", "freq_mhz": 1800, "tech": "4G FDD", "bandwidth_mhz": 15},
            {"band": "B8", "freq_mhz": 900, "tech": "2G/4G", "bandwidth_mhz": 10},
        ],
        "5G": [
            {"band": "n78", "freq_mhz": 3500, "tech": "5G NR", "bandwidth_mhz": 50},
        ],
    },
    "BSNL": {
        "4G": [
            {"band": "B28", "freq_mhz": 700, "tech": "4G FDD", "bandwidth_mhz": 10},
            {"band": "B1", "freq_mhz": 2100, "tech": "4G FDD", "bandwidth_mhz": 10},
        ],
        "5G": [
            {"band": "n78", "freq_mhz": 3500, "tech": "5G NR", "bandwidth_mhz": 50},
        ],
    },
}


def calculate_mapl(power_dbm: float, clutter_loss: float, fade_margin: float, edge_rsrp: float = -105.0) -> float:
    """
    Maximum Allowable Path Loss (MAPL):
    MAPL = EIRP + Rx_Gain - Rx_Sensitivity - ClutterLoss - FadeMargin
    """
    tx_antenna_gain = 16.0  # standard 65 deg 3-sector panel
    cable_loss = 2.0
    rx_gain = 0.0           # standard UE smartphone
    eirp = power_dbm + tx_antenna_gain - cable_loss
    return eirp + rx_gain - edge_rsrp - clutter_loss - fade_margin


def estimate_cell_radius_km(mapl_db: float, freq_mhz: float, tx_height: float, env_type: str) -> float:
    """
    Invert COST-231 / Hata model to estimate single cell coverage radius in km.
    COST-231: PL = 46.3 + 33.9*log10(f) - 13.82*log10(h_tx) + (44.9 - 6.55*log10(h_tx))*log10(d) + C_m
    """
    f = max(150.0, freq_mhz)
    htx = max(10.0, tx_height)
    cm = 3.0 if env_type == "dense_urban" else 0.0

    a_const = 46.3 + 33.9 * math.log10(f) - 13.82 * math.log10(htx) + cm
    b_const = 44.9 - 6.55 * math.log10(htx)

    if mapl_db <= a_const:
        return 0.35

    log_d = (mapl_db - a_const) / max(b_const, 10.0)
    radius_km = 10.0 ** log_d

    # Physical clamping based on clutter
    if env_type == "dense_urban":
        return max(0.25, min(radius_km, 1.4))
    elif env_type == "urban":
        return max(0.40, min(radius_km, 2.8))
    elif env_type == "suburban":
        return max(0.80, min(radius_km, 5.0))
    else:
        return max(1.50, min(radius_km, 12.0))


def resolve_recommended_bands(operator: str, target_gen: str) -> List[Dict[str, Any]]:
    profile = OPERATOR_SPECTRUM_PROFILES.get(operator) or OPERATOR_SPECTRUM_PROFILES["Jio"]
    bands = []
    if target_gen in ("4G", "4G+5G") and "4G" in profile:
        bands.extend(profile["4G"])
    if target_gen in ("5G", "4G+5G") and "5G" in profile:
        bands.extend(profile["5G"])
    return bands or profile.get("4G", [])


def plan_cellular_network(req: RFPlanRequest, existing_towers: List[Any]) -> RFPlanResponse:
    """
    Synthesize an end-to-end cellular RF dimensioning and placement plan for the selected area.
    """
    c_lat, c_lng = req.center_lat, req.center_lng
    radius = max(0.5, min(req.radius_km, 15.0))

    # 1. Environment & Clutter selection
    if req.density_type and req.density_type.lower() in CLUTTER_PARAMS:
        env_type = req.density_type.lower()
    else:
        detected = auto_detect_environment(round(c_lat, 4), round(c_lng, 4))
        env_type = detected.value if hasattr(detected, "value") else str(detected)
        if env_type not in CLUTTER_PARAMS:
            env_type = "urban"

    params = CLUTTER_PARAMS[env_type]

    # 2. Link Budget & Dimensioning
    mapl = calculate_mapl(params["default_power"], params["clutter_loss_db"], params["fade_margin_db"])
    cell_r = estimate_cell_radius_km(mapl, params["freq_carrier_mhz"], params["default_height"], env_type)

    # In coverage vs capacity priority
    if req.planning_priority == "capacity":
        cell_r = max(0.25, cell_r * 0.70)  # dense micro-cells for high traffic capacity
    elif req.planning_priority == "coverage":
        cell_r = cell_r * 1.15

    # Inter-Site Distance (ISD) for hexagonal cellular topology
    isd_km = cell_r * 1.732

    # 3. Existing infrastructure gap analysis
    op_filter = req.operator.strip().lower() if req.operator else None
    existing_in_area = [
        t for t in existing_towers
        if haversine_km(c_lat, c_lng, t.lat, t.lng) <= radius * 1.2
    ]
    # Filter against existing towers of the same operator (or all if operator unknown)
    existing_same_op = [
        t for t in existing_in_area
        if not op_filter or (t.operator and op_filter in t.operator.lower())
    ]
    check_towers = existing_same_op if existing_same_op else existing_in_area

    # 4. Synthesize optimal site positions
    # Use hexagonal packing rings from center outward
    candidate_points = []
    
    # Ring 0: Center
    candidate_points.append((c_lat, c_lng, "Primary Centroid"))

    # Rings 1..N based on radius and ISD
    ring_count = max(1, math.ceil(radius / isd_km))
    for ring in range(1, ring_count + 1):
        dist = ring * isd_km
        if dist > radius:
            dist = radius * 0.85
        num_spokes = 6 * ring
        for i in range(num_spokes):
            bearing = (360.0 / num_spokes) * i + (15.0 * (ring % 2))
            p_lat, p_lng = destination_point(c_lat, c_lng, bearing, dist)
            if haversine_km(c_lat, c_lng, p_lat, p_lng) <= radius:
                candidate_points.append((p_lat, p_lng, f"Ring {ring} Sector {i+1}"))

    # 5. Filter candidates against existing operational sites to target blind spots
    recommended_sites: List[RFRecommendedSite] = []
    site_counter = 1

    bands = resolve_recommended_bands(req.operator, req.target_generation)

    for p_lat, p_lng, spoke_label in candidate_points:
        # Check proximity to existing operator towers
        min_dist_existing = min(
            [haversine_km(p_lat, p_lng, ex.lat, ex.lng) for ex in check_towers],
            default=999.0
        )
        if min_dist_existing < (isd_km * 0.40) and check_towers:
            continue

        # Check proximity to already-recommended sites in this batch
        too_close_planned = any(
            haversine_km(p_lat, p_lng, rs.lat, rs.lng) < (isd_km * 0.65)
            for rs in recommended_sites
        )
        if too_close_planned:
            continue

        site_id = f"PLAN-{site_counter:02d}"
        coverage_km2 = round(math.pi * (cell_r ** 2), 2)
        score = round(max(70.0, 98.0 - (site_counter * 3.5)), 1)

        # Rationale formulation
        dist_info = f" ({round(min_dist_existing, 2)}km from nearest {req.operator or 'cell'})" if min_dist_existing < 900 else ""
        rationale = (
            f"Fills coverage void at {spoke_label}{dist_info}. Optimal inter-site distance {round(isd_km, 2)}km. "
            f"Configured with {params['default_type']} ({int(params['default_height'])}m) to clear local {env_type} clutter."
        )

        recommended_sites.append(
            RFRecommendedSite(
                site_id=site_id,
                name=f"{req.operator} Planned Site {site_id}",
                lat=round(p_lat, 5),
                lng=round(p_lng, 5),
                tower_type=params["default_type"],
                height_m=params["default_height"],
                power_dbm=params["default_power"],
                azimuth_deg=0.0,
                sectors_count=3,
                recommended_bands=bands,
                cell_radius_km=round(cell_r, 2),
                coverage_km2=coverage_km2,
                priority_score=score,
                rationale=rationale,
            )
        )
        site_counter += 1

        if len(recommended_sites) >= 12:
            break

    total_area_km2 = round(math.pi * (radius ** 2), 2)
    est_pop = req.target_population or int(total_area_km2 * params["pop_density_km2"])
    coverage_pct = min(98.5, round((len(recommended_sites) * (cell_r ** 2) * math.pi / max(total_area_km2, 1.0)) * 100, 1))

    return RFPlanResponse(
        center_lat=round(c_lat, 5),
        center_lng=round(c_lng, 5),
        radius_km=radius,
        density_type=env_type,
        environment_detected=env_type.replace("_", " ").title(),
        inter_site_distance_km=round(isd_km, 2),
        total_sites_recommended=len(recommended_sites),
        total_area_km2=total_area_km2,
        projected_coverage_pct=coverage_pct,
        estimated_population_served=est_pop,
        recommended_sites=recommended_sites,
    )
