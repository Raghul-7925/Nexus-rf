import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.import_parser import parse_import

CSV_SAMPLE = """site_id,latitude,longitude,operator,band,technology,height,power,tower_type,cell_id
"DEL-101",28.6139,77.2090,"Airtel",1800,"4G",32,43,"Rooftop",""
"DEL-102",28.6180,77.2150,"Jio",3500,"5G",40,43,"Ground",""
"""

JSON_SAMPLE = """[
  {
    "site_id": "DEL-101",
    "name": "Airtel Site DEL-101",
    "latitude": 28.6139,
    "longitude": 77.2090,
    "operator": "Airtel",
    "band": 1800,
    "technology": "4G",
    "height": 32,
    "power": 43,
    "tower_type": "Rooftop",
    "cell_id": null,
    "source": "tarangsanchar"
  },
  {
    "site_id": "DEL-102",
    "name": "Jio Site DEL-102",
    "latitude": 28.6180,
    "longitude": 77.2150,
    "operator": "Jio",
    "band": 3500,
    "technology": "5G",
    "height": 40,
    "power": 43,
    "tower_type": "Ground",
    "cell_id": null,
    "source": "tarangsanchar"
  }
]"""


def test_extension_csv_compatibility():
    towers = parse_import(CSV_SAMPLE)
    assert len(towers) == 2
    assert towers[0]["operator"] == "Airtel"
    assert towers[0]["lat"] == 28.6139
    assert towers[0]["lng"] == 77.2090
    assert towers[0]["freq_mhz"] == 1800.0
    assert towers[0]["tower_type"] == "Rooftop"
    assert towers[1]["operator"] == "Jio"
    assert towers[1]["freq_mhz"] == 3500.0


def test_extension_json_compatibility():
    towers = parse_import(JSON_SAMPLE)
    assert len(towers) == 2
    assert towers[0]["operator"] == "Airtel"
    assert towers[0]["lat"] == 28.6139
    assert towers[0]["lng"] == 77.2090
    assert towers[0]["freq_mhz"] == 1800.0
    assert towers[1]["operator"] == "Jio"
    assert towers[1]["technology"] == "5G"


RAW_CSV_SAMPLE = """site_id,latitude,longitude,operator,band,technology,height,power,tower_type,cell_id
"210832",11.90301,79.73184,"",,"",25,43,"Rooftop",""
"1033334",11.90471,79.73843,"",,"",35,43,"Ground",""
"300101",11.90800,79.74000,"",,"",12,37,"WallMount",""
"""


def test_extension_raw_mode_compatibility():
    towers = parse_import(RAW_CSV_SAMPLE)
    assert len(towers) == 3
    assert towers[0]["site_id"] == "210832"
    assert towers[0]["operator"] is None
    assert towers[0]["freq_mhz"] is None
    assert towers[0]["technology"] is None
    assert towers[0]["tower_type"] == "Rooftop"
    assert towers[0]["height_m"] == 25.0
    assert towers[1]["tower_type"] == "Ground"
    assert towers[1]["height_m"] == 35.0
    assert towers[1]["freq_mhz"] is None
    assert towers[2]["tower_type"] == "WallMount"
    assert towers[2]["height_m"] == 12.0
    assert towers[2]["power_dbm"] == 37.0


if __name__ == "__main__":
    test_extension_csv_compatibility()
    test_extension_json_compatibility()
    test_extension_raw_mode_compatibility()
    print("ALL EXTENSION COMPATIBILITY TESTS (INCLUDING RAW MODE) PASSED!")
