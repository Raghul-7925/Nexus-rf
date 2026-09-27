"""
app/services/compare_service.py

Given a point and a set of towers, estimates received signal per
operator and ranks operators by the user's chosen priority. Pure
function of (point, towers, obstacles) -> ranked list, so it's testable
without a DB or HTTP layer in front of it.
"""

from dataclasses import dataclass
from typing import List, Optional

from ..rf_engine.models import Model, Environment, path_loss
from ..rf_engine.geo import haversine_km, Point, path_crosses_obstacle
from .band_info import BAND_INFO


@dataclass
class TowerRecord:
    name: str
    lat: float
    lng: float
    operator: Optional[str]
    technology: Optional[str]
    freq_mhz: float
    height_m: float
    power_dbm: float


def compare_operators(
    lat: float,
    lng: float,
    towers: List[TowerRecord],
    obstacles: List[List[Point]] = None,
    radius_km: float = 5.0,
    sort_by: str = "balanced",
    model: Model = Model.HATA,
    env: Environment = Environment.URBAN,
) -> List[dict]:
    obstacles = obstacles or []
    rx_point = Point(lat, lng)

    candidates = [t for t in towers if t.operator and haversine_km(lat, lng, t.lat, t.lng) <= radius_km]

    by_operator: dict = {}
    for t in candidates:
        d = max(haversine_km(lat, lng, t.lat, t.lng), 0.02)
        pl = path_loss(model, d, t.freq_mhz, max(t.height_m, 5), 1.5, env)
        rx = t.power_dbm - pl

        tx_point = Point(t.lat, t.lng)
        for poly in obstacles:
            if path_crosses_obstacle(tx_point, rx_point, poly):
                rx -= 14.0
                break

        bw = BAND_INFO.get(int(round(t.freq_mhz / 100) * 100), {}).get("bandwidth_mhz")
        if bw is None:
            nearest = min(BAND_INFO.keys(), key=lambda b: abs(b - t.freq_mhz)) if BAND_INFO else None
            bw = BAND_INFO[nearest]["bandwidth_mhz"] if nearest is not None else 10

        entry = by_operator.setdefault(t.operator, {"bands": set(), "best": None})
        entry["bands"].add(f"{int(t.freq_mhz)}MHz/{t.technology or '?'}")
        if entry["best"] is None or rx > entry["best"]["rx_dbm"]:
            entry["best"] = {
                "operator": t.operator, "rx_dbm": rx, "freq_mhz": t.freq_mhz,
                "technology": t.technology, "bandwidth_mhz": bw,
                "distance_km": d, "nearest_tower": t.name,
            }

    results = []
    for op, entry in by_operator.items():
        best = entry["best"]
        coverage_score = max(0.0, min(100.0, (best["rx_dbm"] + 110) * 3.3))
        speed_score = min(100.0, (best["bandwidth_mhz"] / 100) * 100)
        balanced = coverage_score * 0.55 + speed_score * 0.45

        # Gaming / Low-Latency score (favors 5G, proximity, low interference)
        has_5g = any("5G" in b or "3500" in b for b in entry["bands"]) or (best.get("technology") == "5G")
        gaming_score = min(100.0, (coverage_score * 0.40) + (speed_score * 0.30) + (30.0 if has_5g else 10.0))

        # Deep Indoor / Penetration score (favors Sub-1GHz low bands: 700, 850, 900 MHz)
        has_low_band = any(any(lb in b for lb in ["700", "850", "900"]) for b in entry["bands"]) or (best["freq_mhz"] <= 1000)
        indoor_score = min(100.0, (coverage_score * 0.60) + (40.0 if has_low_band else 10.0))

        # Formulate intelligent verdict
        if has_5g and best["rx_dbm"] >= -90:
            verdict = "⚡ Top Pick: 5G Ultra-Low Latency & High Speed"
        elif has_low_band and best["rx_dbm"] >= -95:
            verdict = "🏠 Top Pick: Deep Indoor & Ground Penetration (Sub-1GHz)"
        elif speed_score >= 60:
            verdict = "🚀 Top Pick: High Bandwidth Streaming & Heavy Downloads"
        elif coverage_score >= 70:
            verdict = "📡 Top Pick: Solid Wide-Area Coverage"
        else:
            verdict = "📶 Fair Coverage"

        results.append({
            **best,
            "coverage_score": round(coverage_score, 1),
            "speed_score": round(speed_score, 1),
            "balanced_score": round(balanced, 1),
            "gaming_score": round(gaming_score, 1),
            "indoor_score": round(indoor_score, 1),
            "verdict": verdict,
            "bands_available": sorted(entry["bands"]),
        })

    key = {
        "speed": lambda r: (r["speed_score"], r["coverage_score"]),
        "coverage": lambda r: (r["coverage_score"],),
        "gaming": lambda r: (r["gaming_score"], r["speed_score"]),
        "indoor": lambda r: (r["indoor_score"], r["coverage_score"]),
        "balanced": lambda r: (r["balanced_score"],),
    }.get(sort_by, lambda r: (r["balanced_score"],))

    results.sort(key=key, reverse=True)
    return results
