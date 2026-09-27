"""
rf_engine/geo.py

Small, dependency-free geospatial helpers used by coverage_service.py
and the compare engine. Kept separate from models.py so the pure RF
math stays testable in isolation from anything geometry-related.
"""

import math
from dataclasses import dataclass


EARTH_RADIUS_KM = 6371.0


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance between two lat/lng points, in km."""
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lng / 2) ** 2
    )
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def bearing_deg(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Initial bearing (degrees, 0-360, 0=North) from point 1 to point 2."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_lng = math.radians(lng2 - lng1)
    y = math.sin(d_lng) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(d_lng)
    return (math.degrees(math.atan2(y, x)) + 360) % 360


def destination_point(lat: float, lng: float, bearing: float, dist_km: float) -> tuple[float, float]:
    """Point at `dist_km` from (lat,lng) along `bearing` degrees."""
    br = math.radians(bearing)
    la1, lo1 = math.radians(lat), math.radians(lng)
    la2 = math.asin(
        math.sin(la1) * math.cos(dist_km / EARTH_RADIUS_KM)
        + math.cos(la1) * math.sin(dist_km / EARTH_RADIUS_KM) * math.cos(br)
    )
    lo2 = lo1 + math.atan2(
        math.sin(br) * math.sin(dist_km / EARTH_RADIUS_KM) * math.cos(la1),
        math.cos(dist_km / EARTH_RADIUS_KM) - math.sin(la1) * math.sin(la2),
    )
    return math.degrees(la2), (math.degrees(lo2) + 540) % 360 - 180


@dataclass(frozen=True)
class Point:
    lat: float
    lng: float


def _ccw(a: Point, b: Point, c: Point) -> float:
    return (c.lng - a.lng) * (b.lat - a.lat) - (b.lng - a.lng) * (c.lat - a.lat)


def segments_intersect(p1: Point, p2: Point, p3: Point, p4: Point) -> bool:
    """True if segment p1-p2 crosses segment p3-p4 (standard CCW test)."""
    return (_ccw(p1, p3, p4) * _ccw(p2, p3, p4) < 0) and (_ccw(p1, p2, p3) * _ccw(p1, p2, p4) < 0)


def path_crosses_obstacle(tx: Point, rx: Point, obstacle_polygon: list[Point]) -> bool:
    """True if the straight line tx->rx crosses any edge of the polygon."""
    n = len(obstacle_polygon)
    for i in range(n):
        a, b = obstacle_polygon[i], obstacle_polygon[(i + 1) % n]
        if segments_intersect(tx, rx, a, b):
            return True
    return False
