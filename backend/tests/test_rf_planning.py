import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.schemas import RFPlanRequest, RFRecommendedSite
from app.rf_engine.rf_planning_service import plan_cellular_network, calculate_mapl, estimate_cell_radius_km


def test_mapl_calculation():
    mapl = calculate_mapl(power_dbm=43.0, clutter_loss=12.0, fade_margin=8.0)
    assert mapl > 120.0
    assert mapl < 160.0


def test_cell_radius_estimation():
    r_urban = estimate_cell_radius_km(140.0, 1800.0, 25.0, "urban")
    r_rural = estimate_cell_radius_km(145.0, 700.0, 45.0, "rural")
    assert r_urban > 0.3
    assert r_rural > r_urban


def test_rf_planning_service():
    req = RFPlanRequest(
        center_lat=11.9401,
        center_lng=79.4861,
        radius_km=3.0,
        target_generation="4G+5G",
        density_type="urban",
        planning_priority="balanced",
        operator="Jio"
    )
    plan = plan_cellular_network(req, existing_towers=[])
    assert plan.total_sites_recommended > 0
    assert len(plan.recommended_sites) == plan.total_sites_recommended
    first = plan.recommended_sites[0]
    assert first.site_id.startswith("PLAN-")
    assert first.tower_type in ("Rooftop", "Ground", "WallMount")
    assert len(first.recommended_bands) >= 1
    assert first.cell_radius_km > 0.2


if __name__ == "__main__":
    test_mapl_calculation()
    test_cell_radius_estimation()
    test_rf_planning_service()
    print("ALL RF PLANNING TESTS PASSED!")
