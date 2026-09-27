"""
app/services/import_parser.py

Parses CSV, JSON, or GeoJSON tower data into TowerCreate-shaped dicts.
This is the primary "real data" path for the project -- see
architecture.md Section 5 and README.md for why: the Tarangsanchar
portal's ~10-lookups/day anonymous cap makes live scraping unworkable,
so bulk import from a one-time-collected dataset is the actual scale
mechanism, not a fallback.

Expected fields (case-insensitive, all optional except lat/lng):
    latitude, longitude, operator, band (or frequency), technology,
    height, power, azimuth, tower_type, cell_id, site_id
"""

import csv
import io
import json
from typing import List, Dict, Any

from .band_info import band_defaults


class ImportError_(Exception):
    """Raised on unparseable input; kept distinct from builtin ImportError."""


def parse_import(raw_text: str, filename_hint: str = "") -> List[Dict[str, Any]]:
    stripped = raw_text.strip()
    if not stripped:
        raise ImportError_("empty input")

    if stripped.startswith("{") or stripped.startswith("["):
        rows = _parse_json_or_geojson(stripped)
    else:
        rows = _parse_csv(stripped)

    towers = []
    for r in rows:
        lat, lng = r.get("latitude"), r.get("longitude")
        if lat in (None, "") or lng in (None, ""):
            continue  # skip rows without coordinates rather than failing the whole batch
        freq_raw = r.get("band") or r.get("frequency")
        freq = _to_float(freq_raw) if freq_raw not in (None, "") else None
        tech = r.get("technology") if r.get("technology") not in (None, "") else None
        op = r.get("operator") if r.get("operator") not in (None, "") else None

        if freq is not None:
            defaults = band_defaults(freq)
            bw = defaults["bandwidth_mhz"]
            if not tech:
                tech = defaults["tech"]
        else:
            bw = None

        name = (
            r.get("site_id")
            or r.get("cell_id")
            or (f"{op} Site" if op else "Tower Site")
        )

        towers.append({
            "name": name,
            "lat": _to_float(lat),
            "lng": _to_float(lng),
            "freq_mhz": freq,
            "technology": tech,
            "bandwidth_mhz": bw,
            "operator": op,
            "height_m": _to_float(r.get("height"), default=25.0),
            "power_dbm": _to_float(r.get("power"), default=43.0),
            "tower_type": r.get("tower_type") or "Rooftop",
            "azimuth_deg": _to_float(r.get("azimuth")) if r.get("azimuth") not in (None, "") else None,
            "source": "import",
            "cell_id": r.get("cell_id") or None,
            "site_id": r.get("site_id") or None,
        })
    return towers


def _parse_csv(text: str) -> List[Dict[str, Any]]:
    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames is None:
        raise ImportError_("could not find a header row")
    normalized = []
    for row in reader:
        normalized.append({(k or "").strip().lower(): (v or "").strip() for k, v in row.items()})
    return normalized


def _parse_json_or_geojson(text: str) -> List[Dict[str, Any]]:
    try:
        obj = json.loads(text)
    except json.JSONDecodeError as e:
        raise ImportError_(f"invalid JSON: {e}")

    if isinstance(obj, dict) and obj.get("type") == "FeatureCollection":
        rows = []
        for feature in obj.get("features", []):
            props = {k.lower(): v for k, v in (feature.get("properties") or {}).items()}
            coords = (feature.get("geometry") or {}).get("coordinates", [None, None])
            props["longitude"] = coords[0]
            props["latitude"] = coords[1]
            rows.append(props)
        return rows
    if isinstance(obj, list):
        return [{k.lower(): v for k, v in row.items()} for row in obj]
    if isinstance(obj, dict):
        return [{k.lower(): v for k, v in obj.items()}]
    raise ImportError_("unrecognized JSON shape")


def _to_float(value, default=None):
    if value in (None, ""):
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default
