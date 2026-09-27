import sys
import os
import math

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.rf_engine.geo import haversine_km, bearing_deg, destination_point, Point, path_crosses_obstacle


def test_haversine_zero_distance():
    assert haversine_km(13.05, 80.23, 13.05, 80.23) == 0.0


def test_haversine_known_distance():
    # Chennai Central (13.0827, 80.2707) to Chennai Airport (12.9941, 80.1709)
    # actual road distance ~17km, straight-line should be a bit less, ~13-14km
    d = haversine_km(13.0827, 80.2707, 12.9941, 80.1709)
    assert 10 <= d <= 16, f"got {d}"


def test_bearing_north_is_zero():
    b = bearing_deg(13.0, 80.0, 13.1, 80.0)  # due north
    assert abs(b - 0.0) < 1.0


def test_bearing_east_is_90():
    b = bearing_deg(13.0, 80.0, 13.0, 80.1)  # due east (approx, small delta)
    assert 85 <= b <= 95


def test_destination_point_roundtrip():
    lat2, lng2 = destination_point(13.0, 80.0, 90, 5.0)  # 5km due east
    d = haversine_km(13.0, 80.0, lat2, lng2)
    assert abs(d - 5.0) < 0.05


def test_path_crosses_obstacle_true():
    tx = Point(0, 0)
    rx = Point(0, 10)
    # a square obstacle straddling the straight line between tx and rx
    square = [Point(-1, 4), Point(1, 4), Point(1, 6), Point(-1, 6)]
    assert path_crosses_obstacle(tx, rx, square) is True


def test_path_crosses_obstacle_false():
    tx = Point(0, 0)
    rx = Point(0, 10)
    # obstacle well off to the side, does not intersect the line
    square = [Point(5, 4), Point(7, 4), Point(7, 6), Point(5, 6)]
    assert path_crosses_obstacle(tx, rx, square) is False


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
