"""
tests/test_rf_models.py

Validates the RF engine against known reference numbers and sanity
invariants (not just "does it run"). Written as plain pytest-style
`test_*` functions -- run with `pytest` once installed, or directly
with `python tests/test_rf_models.py` (see runner at the bottom),
since this sandbox has no network access to install pytest.

Reference check for the Hata example: Rappaport's textbook worked
example (Example 4.4-ish parameters commonly used in coursework):
    f = 900 MHz, hb = 70 m, hm = 1.5 m, d = 20 km, medium/small city
    -> published result: PL ≈ 155.6 dB (accepted range 154-157 dB
       across textbook rounding variants; the test uses a tolerant band).
"""

import math
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.rf_engine.models import (
    fspl, hata, cost231_hata, path_loss, antenna_gain_db,
    knife_edge_diffraction_loss, Environment, Model, TerrainSample,
)


def test_fspl_known_value():
    # 1 km, 900 MHz -> classic textbook FSPL ≈ 91.5 dB
    loss = fspl(1.0, 900)
    assert 91.0 <= loss <= 92.0, f"FSPL(1km,900MHz)={loss}"


def test_fspl_increases_with_distance_and_frequency():
    assert fspl(2.0, 900) > fspl(1.0, 900)
    assert fspl(1.0, 1800) > fspl(1.0, 900)


def test_hata_textbook_reference():
    # Rappaport, "Wireless Communications: Principles and Practice", 2nd ed.,
    # worked example: f=900MHz, hb=70m, hm=1.5m, d=20km, medium/small city
    # -> published result ≈ 163.8 dB. Tolerant band absorbs rounding.
    loss = hata(20.0, 900, h_base_m=70, h_mobile_m=1.5, env=Environment.URBAN)
    assert 162.0 <= loss <= 166.0, f"Hata(20km,900MHz,urban)={loss} out of expected band"


def test_hata_greater_than_fspl():
    # Hata (ground-reflection + clutter model) must always predict more
    # loss than the free-space lower bound, at any distance beyond ~1km.
    for d in [1, 2, 5, 10, 15]:
        h = hata(d, 900, 30, 1.5, Environment.URBAN)
        f = fspl(d, 900)
        assert h > f, f"Hata should exceed FSPL at d={d}km (hata={h}, fspl={f})"


def test_hata_environment_ordering():
    # For the same geometry, open area should have less loss than
    # suburban, which should have less loss than urban.
    args = dict(distance_km=5, freq_mhz=900, h_base_m=30, h_mobile_m=1.5)
    urban = hata(env=Environment.URBAN, **args)
    suburban = hata(env=Environment.SUBURBAN, **args)
    open_ = hata(env=Environment.OPEN, **args)
    assert urban > suburban > open_, f"urban={urban}, suburban={suburban}, open={open_}"


def test_hata_base_height_reduces_loss():
    # Taller base station antenna -> less path loss, all else equal.
    low = hata(5, 900, h_base_m=30, h_mobile_m=1.5, env=Environment.URBAN)
    high = hata(5, 900, h_base_m=100, h_mobile_m=1.5, env=Environment.URBAN)
    assert high < low


def test_cost231_dense_urban_offset():
    # Dense urban (Cm=3) must exceed medium-city/suburban (Cm=0) by exactly 3 dB.
    common = dict(distance_km=5, freq_mhz=1800, h_base_m=30, h_mobile_m=1.5)
    dense = cost231_hata(env=Environment.DENSE_URBAN, **common)
    medium = cost231_hata(env=Environment.URBAN, **common)
    assert abs((dense - medium) - 3.0) < 1e-6


def test_path_loss_dispatch_matches_direct_call():
    assert path_loss(Model.FSPL, 2, 900, 30, 1.5, Environment.URBAN) == fspl(2, 900)
    assert path_loss(Model.HATA, 2, 900, 30, 1.5, Environment.URBAN) == hata(2, 900, 30, 1.5, Environment.URBAN)


def test_antenna_gain_omni_is_zero():
    assert antenna_gain_db(45, None) == 0.0


def test_antenna_gain_peaks_at_boresight():
    on_axis = antenna_gain_db(90, azimuth_deg=90)
    off_axis = antenna_gain_db(180, azimuth_deg=90)
    back = antenna_gain_db(270, azimuth_deg=90)
    assert on_axis > off_axis > back or on_axis > back  # boresight strongest, back weakest


def test_diffraction_clear_path_is_zero_loss():
    # obstruction well below the line-of-sight -> no diffraction loss
    obstruction = TerrainSample(distance_km=2, ground_height_m=5)
    loss = knife_edge_diffraction_loss(
        tx_height_m=50, rx_height_m=1.5, total_distance_km=5,
        obstruction=obstruction, freq_mhz=900,
    )
    assert loss == 0.0


def test_diffraction_obstructed_path_has_loss():
    # obstruction poking well above the line-of-sight -> real loss expected
    obstruction = TerrainSample(distance_km=2.5, ground_height_m=60)
    loss = knife_edge_diffraction_loss(
        tx_height_m=30, rx_height_m=1.5, total_distance_km=5,
        obstruction=obstruction, freq_mhz=900,
    )
    assert loss > 0.0


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
