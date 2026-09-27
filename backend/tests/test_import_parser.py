import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.import_parser import parse_import, ImportError_

CSV_SAMPLE = """latitude,longitude,operator,band,technology,height,azimuth,tower_type
13.0900,80.2250,Jio,1800,4G,32,45,Rooftop
13.0950,80.2300,Airtel,2300,4G,30,,Ground
"""

JSON_SAMPLE = """
[
  {"latitude": 13.08, "longitude": 80.22, "operator": "Vi", "band": 2100, "technology": "4G", "height": 28},
  {"latitude": 13.07, "longitude": 80.24, "operator": "BSNL", "band": 900, "technology": "2G"}
]
"""

GEOJSON_SAMPLE = """
{
  "type": "FeatureCollection",
  "features": [
    {"type": "Feature", "geometry": {"type": "Point", "coordinates": [80.21, 13.09]},
     "properties": {"operator": "Jio", "band": 3500, "technology": "5G", "site_id": "CHN-001"}}
  ]
}
"""


def test_csv_parses_two_rows():
    rows = parse_import(CSV_SAMPLE)
    assert len(rows) == 2
    assert rows[0]["operator"] == "Jio"
    assert rows[0]["freq_mhz"] == 1800
    assert rows[0]["azimuth_deg"] == 45.0
    assert rows[1]["azimuth_deg"] is None  # blank field -> omni


def test_csv_defaults_bandwidth_from_band_info():
    rows = parse_import(CSV_SAMPLE)
    assert rows[0]["bandwidth_mhz"] == 15  # 1800MHz lookup


def test_json_array_parses():
    rows = parse_import(JSON_SAMPLE)
    assert len(rows) == 2
    assert rows[0]["operator"] == "Vi"
    assert rows[1]["freq_mhz"] == 900


def test_geojson_feature_collection_parses():
    rows = parse_import(GEOJSON_SAMPLE)
    assert len(rows) == 1
    row = rows[0]
    assert row["lat"] == 13.09
    assert row["lng"] == 80.21
    assert row["site_id"] == "CHN-001"
    assert row["freq_mhz"] == 3500


def test_rows_missing_coordinates_are_skipped_not_fatal():
    bad = '[{"operator": "Jio", "band": 900}, {"latitude": 13.0, "longitude": 80.0, "operator": "Airtel"}]'
    rows = parse_import(bad)
    assert len(rows) == 1
    assert rows[0]["operator"] == "Airtel"


def test_empty_input_raises():
    try:
        parse_import("")
        assert False, "expected ImportError_"
    except ImportError_:
        pass


def test_malformed_json_raises_not_crashes():
    try:
        parse_import("{not valid json")
        assert False, "expected ImportError_"
    except ImportError_:
        pass


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
