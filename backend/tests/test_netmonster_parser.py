import pytest
from app.services.netmonster_parser import (
    map_channel_to_rf,
    map_mcc_mnc_to_operator,
    haversine_m,
    parse_netmonster_data,
    clean_location_string,
)


def test_map_mcc_mnc_to_operator():
    assert map_mcc_mnc_to_operator(404, 80) == "BSNL"
    assert map_mcc_mnc_to_operator(404, 94) == "BSNL"
    assert map_mcc_mnc_to_operator(405, 869) == "Jio"
    assert map_mcc_mnc_to_operator(404, 43) == "Vi"
    assert map_mcc_mnc_to_operator(404, 45) == "Airtel"
    assert map_mcc_mnc_to_operator(310, 410) == "Other"


def test_map_channel_to_rf_gsm():
    freq, band, bw, tech = map_channel_to_rf("GSM", 98)
    assert freq == 900.0
    assert "900 MHz" in band
    assert tech == "2G"

    freq18, band18, _, _ = map_channel_to_rf("GSM", 600)
    assert freq18 == 1800.0


def test_map_channel_to_rf_umts():
    freq, band, bw, tech = map_channel_to_rf("UMTS", 10782)
    assert freq == 2100.0
    assert "2100 MHz" in band
    assert tech == "3G"


def test_map_channel_to_rf_lte():
    # BSNL 700 MHz (Band 28)
    freq_700, band_700, bw_700, tech = map_channel_to_rf("LTE", 9560)
    assert freq_700 == 700.0
    assert "700 MHz" in band_700
    assert tech == "4G"

    # Jio 2300 MHz (Band 40 TDD)
    freq_2300, band_2300, bw_2300, _ = map_channel_to_rf("LTE", 38750)
    assert freq_2300 == 2300.0
    assert "2300 MHz" in band_2300

    # BSNL 2500 MHz (Band 41 TDD)
    freq_2500, band_2500, _, _ = map_channel_to_rf("LTE", 40140)
    assert freq_2500 == 2500.0
    assert "2500 MHz" in band_2500

    # 1800 MHz (Band 3)
    freq_1800, _, _, _ = map_channel_to_rf("LTE", 1465)
    assert freq_1800 == 1800.0

    # 850 MHz (Band 5)
    freq_850, _, _, _ = map_channel_to_rf("LTE", 2520)
    assert freq_850 == 850.0


def test_clean_location_string():
    assert clean_location_string("WJVF+X4X, Main Road (± 9925 m)") == "Main Road"
    assert clean_location_string("Vadamangalam (Home)") == "Vadamangalam (Home)"
    assert clean_location_string("-") == ""


def test_parse_netmonster_baseline_snapping():
    # Fake baseline tower at exact location (11.9200, 79.6080)
    class FakeTower:
        id = "tower-1"
        name = "409994"
        lat = 11.9200
        lng = 79.6080
        site_id = "409994"
        tower_type = "Ground"

    baseline = [FakeTower()]

    # NetMonster records with slight GPS error (~15m away)
    raw_cells = [
        {
            "network": {"mcc": 404, "mnc": 80},
            "technology": "GSM",
            "cid": 23251,
            "frequency": 103,
            "latitude": 11.9201,
            "longitude": 79.6081,
            "location": "Gangarampalayam",
        },
        {
            "network": {"mcc": 404, "mnc": 80},
            "technology": "GSM",
            "cid": 23252,
            "frequency": 99,
            "latitude": 11.9201,
            "longitude": 79.6081,
            "location": "Gangarampalayam",
        },
        {
            "network": {"mcc": 404, "mnc": 80},
            "technology": "GSM",
            "cid": 23253,
            "frequency": 101,
            "latitude": 11.9201,
            "longitude": 79.6081,
            "location": "Gangarampalayam",
        },
        # Dummy unlocated cell should be ignored
        {
            "network": {"mcc": 404, "mnc": 80},
            "technology": "GSM",
            "cid": 99999,
            "latitude": 2.147483647e9,
            "longitude": 2.147483647e9,
            "location": "-",
        },
    ]

    res = parse_netmonster_data(raw_cells, baseline_towers=baseline, snap_to_baseline=True, snap_radius_m=1000.0)

    assert res["valid_cells"] == 3
    assert res["snapped_to_baseline_count"] == 1
    assert len(res["towers"]) == 3

    # Verify that cells snapped to the exact baseline coordinates (11.9200, 79.6080)
    for t in res["towers"]:
        assert t["lat"] == 11.9200
        assert t["lng"] == 79.6080
        assert t["site_id"] == "409994"
        assert t["operator"] == "BSNL"
        assert t["freq_mhz"] == 900.0

    # Verify 3 sectors allocated azimuths
    azimuths = [t["azimuth_deg"] for t in res["towers"]]
    assert sorted(azimuths) == [0.0, 120.0, 240.0]


def test_parse_ntm_text():
    from app.services.netmonster_parser import parse_ntm_text

    ntm_sample = """
2G;404;43;16576;42109;0;33;11.901197953160292;79.72278255969286;Pallithennel ;64
4G;405;869;18;132;4127;350;11.882387488763797;79.69460802186967;Unnamed Road, Tamil Nadu (± 3036 m);38750
4G;405;869;21;132;4127;96;11.882387488763797;79.69460802186967;Unnamed Road, Tamil Nadu (± 3036 m);38948
2G;404;43;4351;42109;0;37;;;-;64
"""
    res = parse_ntm_text(ntm_sample, snap_to_baseline=False)
    assert res["valid_cells"] == 3
    assert res["towers_generated"] == 3
    assert res["operators"]["Vi"] == 1
    assert res["operators"]["Jio"] == 2

    # Check telemetry fields preservation
    t0 = res["towers"][0]
    assert t0["cell_id"] == "16576"
    assert t0["pci"] == "33"
    assert t0["area"] == "42109"
    assert t0["channel"] == 64.0
    assert t0["location_name"] == "Pallithennel"
    assert t0["operator"] == "Vi"
    assert t0["freq_mhz"] == 900.0

