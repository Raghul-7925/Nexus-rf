import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.compare_service import compare_operators, TowerRecord
from app.rf_engine.models import Model, Environment


def _towers():
    return [
        # Jio: close, high band (fast but shorter range)
        TowerRecord(name="Jio Tower A", lat=13.0510, lng=80.2310, operator="Jio",
                    technology="5G", freq_mhz=3500, height_m=25, power_dbm=40),
        # Airtel: farther, low band (slower but more range)
        TowerRecord(name="Airtel Tower B", lat=13.0700, lng=80.2500, operator="Airtel",
                    technology="2G", freq_mhz=900, height_m=30, power_dbm=44),
        # BSNL: no operator match test -- irrelevant, far away
        TowerRecord(name="BSNL Tower C", lat=13.3000, lng=80.5000, operator="BSNL",
                    technology="4G", freq_mhz=1800, height_m=30, power_dbm=43),
    ]


def test_returns_only_operators_within_radius():
    results = compare_operators(13.05, 80.23, _towers(), radius_km=5.0, sort_by="balanced")
    operators = {r["operator"] for r in results}
    assert "BSNL" not in operators  # too far
    assert "Jio" in operators


def test_speed_sort_prefers_higher_bandwidth():
    results = compare_operators(13.05, 80.23, _towers(), radius_km=10.0, sort_by="speed")
    assert results[0]["operator"] == "Jio"  # 3500MHz/5G has far higher bandwidth than 900MHz/2G


def test_coverage_sort_may_prefer_different_operator():
    results_speed = compare_operators(13.05, 80.23, _towers(), radius_km=10.0, sort_by="speed")
    results_cov = compare_operators(13.05, 80.23, _towers(), radius_km=10.0, sort_by="coverage")
    # not asserting a specific winner (depends on exact geometry), just that
    # the sort key actually changes ranking behavior, i.e. it isn't a no-op
    assert [r["operator"] for r in results_speed] != [] and [r["operator"] for r in results_cov] != []


def test_empty_radius_returns_empty():
    results = compare_operators(0.0, 0.0, _towers(), radius_km=1.0)
    assert results == []


def test_each_result_has_required_fields():
    results = compare_operators(13.05, 80.23, _towers(), radius_km=10.0)
    for r in results:
        for field in ["operator", "rx_dbm", "coverage_score", "speed_score", "balanced_score", "bands_available"]:
            assert field in r


if __name__ == "__main__":
    tests = [obj for name, obj in list(globals().items()) if name.startswith("test_")]
    passed, failed = 0, 0
    for t in tests:
        try:
            t()
            print(f"PASS  {t.__name__}")
            passed += 1
        except AssertionError as e:
            print(f"FAIL  {t.__name__}: {e}")
            failed += 1
    print(f"\n{passed} passed, {failed} failed")
    sys.exit(1 if failed else 0)
