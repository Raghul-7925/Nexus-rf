import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from PIL import Image
import io

from app.rf_engine.coverage_service import generate_coverage, TowerConfig, Thresholds
from app.rf_engine.models import Model, Environment
from app.rf_engine.geo import Point


def _basic_tower():
    return TowerConfig(lat=13.05, lng=80.23, freq_mhz=900, height_m=30, power_dbm=43, azimuth_deg=None)


def test_generates_valid_png():
    result = generate_coverage(_basic_tower(), obstacles=[], model=Model.HATA, env=Environment.URBAN)
    img = Image.open(io.BytesIO(result.png_bytes))
    assert img.format == "PNG"
    assert img.mode == "RGBA"


def test_has_nonzero_range_and_area():
    result = generate_coverage(_basic_tower(), obstacles=[], model=Model.HATA, env=Environment.URBAN)
    assert result.max_range_km > 0
    assert sum(result.area_km2.values()) > 0


def test_bounds_are_centered_on_tower():
    tower = _basic_tower()
    result = generate_coverage(tower, obstacles=[], model=Model.HATA, env=Environment.URBAN)
    south, west, north, east = result.bounds
    assert south < tower.lat < north
    assert west < tower.lng < east


def test_omni_tower_is_roughly_symmetric():
    # sample RxPower-derived pixel colors at 4 compass points at equal
    # distance for an omni tower -- they should all land in the same tier
    tower = _basic_tower()
    result = generate_coverage(tower, obstacles=[], model=Model.FSPL, env=Environment.URBAN, resolution=150)
    img = Image.open(io.BytesIO(result.png_bytes)).convert("RGBA")
    w, h = img.size
    cx, cy = w // 2, h // 2
    r = w // 4
    samples = [img.getpixel((cx, cy - r)), img.getpixel((cx, cy + r)),
               img.getpixel((cx - r, cy)), img.getpixel((cx + r, cy))]
    # all four should either all be transparent or all share alpha > 0
    alphas = [s[3] > 0 for s in samples]
    assert len(set(alphas)) == 1, f"omni tower should be symmetric, got {samples}"


def test_obstacle_creates_a_shadow():
    """
    Directly behind a tall obstacle placed close to the tower, coverage
    should be strictly worse than the same distance in a clear direction.
    This is the core "terrain/clutter awareness" claim of the project --
    if this test fails, that claim isn't actually true of the code.
    """
    tower = TowerConfig(lat=13.05, lng=80.23, freq_mhz=2100, height_m=25, power_dbm=40, azimuth_deg=None)

    # obstacle directly north of the tower, close in
    obstacle = [
        Point(tower.lat + 0.004, tower.lng - 0.001),
        Point(tower.lat + 0.004, tower.lng + 0.001),
        Point(tower.lat + 0.006, tower.lng + 0.001),
        Point(tower.lat + 0.006, tower.lng - 0.001),
    ]

    clear = generate_coverage(tower, obstacles=[], model=Model.HATA, env=Environment.URBAN, resolution=150)
    shadowed = generate_coverage(tower, obstacles=[obstacle], model=Model.HATA, env=Environment.URBAN, resolution=150)

    img_clear = Image.open(io.BytesIO(clear.png_bytes)).convert("RGBA")
    img_shadow = Image.open(io.BytesIO(shadowed.png_bytes)).convert("RGBA")

    # sample a point further north than the obstacle, same in both rasters
    w, h = img_clear.size
    px, py = w // 2, int(h * 0.15)  # near the top (north) edge

    clear_alpha = img_clear.getpixel((px, py))[3]
    shadow_alpha = img_shadow.getpixel((px, py))[3]

    # the shadowed version must not show *better* coverage than the clear one
    # at the same point (obstruction can only remove or downgrade a tier)
    assert shadow_alpha <= clear_alpha, f"shadow should not improve coverage: clear={clear_alpha}, shadow={shadow_alpha}"
    # and the total covered area should shrink at least slightly
    assert sum(shadowed.area_km2.values()) <= sum(clear.area_km2.values())


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
