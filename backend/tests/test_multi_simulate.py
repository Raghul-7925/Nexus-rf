import pytest
from app.rf_engine.coverage_service import TowerConfig, generate_multi_site_coverage


def test_generate_multi_site_coverage_overlap_and_deadzone():
    t1 = TowerConfig(
        lat=11.9030,
        lng=79.7319,
        freq_mhz=1800.0,
        height_m=30.0,
        power_dbm=43.0,
        bandwidth_mhz=15.0,
    )
    t2 = TowerConfig(
        lat=11.9011,
        lng=79.7227,
        freq_mhz=900.0,
        height_m=30.0,
        power_dbm=43.0,
        bandwidth_mhz=10.0,
    )
    res = generate_multi_site_coverage([t1, t2], resolution=80)
    assert res.total_coverage_km2 > 0
    assert res.composite_png_bytes is not None
    assert len(res.composite_png_bytes) > 100
    assert res.overlap_png_bytes is not None
    assert len(res.overlap_png_bytes) > 100
    assert res.deadzone_png_bytes is not None
    assert res.bounds[0] < res.bounds[2]  # south < north
    assert res.bounds[1] < res.bounds[3]  # west < east
    assert res.overlap_area_km2 >= 0
    assert res.deadzone_area_km2 >= 0
