"""
rf_engine/models.py

Core RF propagation models for Nexus RF.

Implements:
    - Free Space Path Loss (FSPL)
    - Okumura-Hata (150-1500 MHz)
    - COST-231 Hata extension (1500-2000 MHz)
    - Simple sector antenna gain pattern
    - Single knife-edge diffraction loss (terrain obstruction)

All path-loss functions return loss in dB (positive number = more loss).
All distance inputs are in kilometres, frequency in MHz, heights in metres,
unless stated otherwise. Kept dependency-free (stdlib `math` only) so it
runs anywhere without a requirements.txt fight.

References:
    Hata, M. (1980). "Empirical formula for propagation loss in land
        mobile radio services." IEEE Trans. Vehicular Technology.
    COST 231 Final Report, European Commission (1999), Ch. 4.
    Rappaport, T. S. Wireless Communications: Principles and Practice,
        2nd ed., for the knife-edge diffraction formulation.
"""

import math
from dataclasses import dataclass
from enum import Enum


class Environment(str, Enum):
    DENSE_URBAN = "dense_urban"
    URBAN = "urban"
    SUBURBAN = "suburban"
    OPEN = "open"


class Model(str, Enum):
    FSPL = "fspl"
    HATA = "hata"
    COST231 = "cost231"


# ---------------------------------------------------------------------------
# Free Space Path Loss
# ---------------------------------------------------------------------------
def fspl(distance_km: float, freq_mhz: float) -> float:
    """
    Free Space Path Loss, Friis equation (log form).

        L_fspl(dB) = 20*log10(d_km) + 20*log10(f_MHz) + 32.44

    Valid for any frequency/distance as a theoretical lower bound
    (no ground, no obstacles). Used here both standalone and as a
    sanity check against Hata/COST-231 output (Hata >= FSPL always
    for d > ~1km; if that inequality breaks, something's wrong).
    """
    d = max(distance_km, 0.001)
    return 20 * math.log10(d) + 20 * math.log10(freq_mhz) + 32.44


# ---------------------------------------------------------------------------
# Okumura-Hata
# ---------------------------------------------------------------------------
def _hata_mobile_correction(freq_mhz: float, h_mobile_m: float, env: Environment) -> float:
    """a(h_m): mobile antenna height correction factor."""
    if env == Environment.DENSE_URBAN:
        if freq_mhz <= 200:
            return 8.29 * (math.log10(1.54 * h_mobile_m) ** 2) - 1.1
        return 3.2 * (math.log10(11.75 * h_mobile_m) ** 2) - 4.97
    # medium/small city correction, used as the base term for
    # urban/suburban/open (suburban and open apply an additional
    # subtractive correction on top of the urban result below)
    return (1.1 * math.log10(freq_mhz) - 0.7) * h_mobile_m - (1.56 * math.log10(freq_mhz) - 0.8)


def hata(distance_km: float, freq_mhz: float, h_base_m: float, h_mobile_m: float,
         env: Environment = Environment.URBAN) -> float:
    """
    Okumura-Hata path loss.

    Formally valid for:
        freq_mhz   in [150, 1500]
        h_base_m   in [30, 200]   (base station height)
        h_mobile_m in [1, 10]     (mobile/receiver height)
        distance_km in [1, 20]

    Outside this range the function still computes a value (useful for
    demo/what-if purposes at e.g. 2100/2300 MHz) but callers should treat
    the result as an approximation, not a validated prediction -- this is
    stated explicitly in the accompanying report, not hidden.
    """
    d = max(distance_km, 0.02)
    hb = max(h_base_m, 1)
    a_hm = _hata_mobile_correction(freq_mhz, h_mobile_m, env)

    loss_urban = (
        69.55 + 26.16 * math.log10(freq_mhz)
        - 13.82 * math.log10(hb) - a_hm
        + (44.9 - 6.55 * math.log10(hb)) * math.log10(d)
    )

    if env == Environment.SUBURBAN:
        return loss_urban - 2 * (math.log10(freq_mhz / 28) ** 2) - 5.4
    if env == Environment.OPEN:
        return (
            loss_urban
            - 4.78 * (math.log10(freq_mhz) ** 2)
            + 18.33 * math.log10(freq_mhz)
            - 40.94
        )
    return loss_urban  # urban and dense_urban share the base formula


# ---------------------------------------------------------------------------
# COST-231 Hata
# ---------------------------------------------------------------------------
def cost231_hata(distance_km: float, freq_mhz: float, h_base_m: float, h_mobile_m: float,
                  env: Environment = Environment.URBAN) -> float:
    """
    COST-231 Hata extension for 1500-2000 MHz.

    Formally valid for:
        freq_mhz   in [1500, 2000]
        h_base_m   in [30, 200]
        h_mobile_m in [1, 10]
        distance_km in [1, 20]

    Cm = 0 dB for medium city/suburban, 3 dB for dense urban/metropolitan.
    """
    d = max(distance_km, 0.02)
    hb = max(h_base_m, 1)
    a_hm = (1.1 * math.log10(freq_mhz) - 0.7) * h_mobile_m - (1.56 * math.log10(freq_mhz) - 0.8)
    cm = 3.0 if env == Environment.DENSE_URBAN else 0.0

    return (
        46.3 + 33.9 * math.log10(freq_mhz)
        - 13.82 * math.log10(hb) - a_hm
        + (44.9 - 6.55 * math.log10(hb)) * math.log10(d)
        + cm
    )


def path_loss(model: Model, distance_km: float, freq_mhz: float,
              h_base_m: float, h_mobile_m: float, env: Environment) -> float:
    """Dispatch to the selected model. Single entry point used by the
    simulation/coverage service so callers never branch on `model` themselves."""
    if model == Model.FSPL:
        return fspl(distance_km, freq_mhz)
    if model == Model.HATA:
        return hata(distance_km, freq_mhz, h_base_m, h_mobile_m, env)
    if model == Model.COST231:
        return cost231_hata(distance_km, freq_mhz, h_base_m, h_mobile_m, env)
    raise ValueError(f"Unknown model: {model}")


# ---------------------------------------------------------------------------
# Antenna pattern
# ---------------------------------------------------------------------------
def antenna_gain_db(bearing_deg: float, azimuth_deg: float | None,
                     beamwidth_deg: float = 65.0, boresight_gain_db: float = 7.0,
                     back_lobe_suppression_db: float = -25.0) -> float:
    """
    Standard 3GPP TR 38.901 / ITU-R M.2412 horizontal sector antenna pattern.

    Returns 0.0 dBi for an omnidirectional antenna (azimuth_deg is None).
    For a sector antenna, calculates the continuous parabolic attenuation:
        A_H(phi) = -min(12 * (phi / phi_3dB)^2, A_max)
    where A_max = 25 dB (front-to-back ratio).
    Total gain = boresight_gain_db + A_H(phi).
    This creates smooth, realistic teardrop cellular lobes without artificial hard step cutoffs.
    """
    if azimuth_deg is None:
        return 0.0
    # Normalized angular difference [-180, +180]
    diff = abs(((bearing_deg - azimuth_deg + 540) % 360) - 180)
    phi_3db = max(beamwidth_deg, 15.0)
    # 3GPP horizontal attenuation formula
    att_db = min(12.0 * ((diff / phi_3db) ** 2), abs(back_lobe_suppression_db))
    return boresight_gain_db - att_db



def composite_antenna_gain_db(bearing_deg: float, azimuth_deg: float | None,
                              sectors_count: int = 3, beamwidth_deg: float = 65.0,
                              boresight_gain_db: float = 7.0,
                              back_lobe_suppression_db: float = -20.0) -> float:
    """
    Antenna gain for standard cellular deployments.
    - If azimuth_deg is None: Omnidirectional (0.0 dB gain uniformly in 360°).
    - If sectors_count >= 3: Standard 3-sector cellular macro base station (e.g. 0°, 120°, 240°).
      Mobile devices connect to the strongest sector, giving realistic composite 360°
      circular coverage with terrain and building shadowing.
    - If sectors_count == 2: Bi-directional sector site (0°, 180°).
    - If sectors_count == 1: Single directional sector pointing towards azimuth_deg.
    """
    if azimuth_deg is None:
        return 0.0
    if sectors_count <= 1:
        return antenna_gain_db(bearing_deg, azimuth_deg, beamwidth_deg, boresight_gain_db, back_lobe_suppression_db)

    # 3-sector or multi-sector composite: max gain over all sectors
    n_sec = max(2, sectors_count)
    spacing = 360.0 / n_sec
    gains = [
        antenna_gain_db(
            bearing_deg,
            (azimuth_deg + i * spacing) % 360.0,
            beamwidth_deg=beamwidth_deg,
            boresight_gain_db=boresight_gain_db,
            back_lobe_suppression_db=back_lobe_suppression_db,
        )
        for i in range(n_sec)
    ]
    # For cellular macro sites, composite gain across handoff sectors retains a minimum gain of 0 dB (omni equivalent)
    return max(max(gains), 0.0)


# ---------------------------------------------------------------------------
# Single knife-edge diffraction (terrain obstruction)
# ---------------------------------------------------------------------------
@dataclass
class TerrainSample:
    distance_km: float   # distance of the obstruction point from the transmitter
    ground_height_m: float


def knife_edge_diffraction_loss(tx_height_m: float, rx_height_m: float,
                                 total_distance_km: float,
                                 obstruction: TerrainSample,
                                 freq_mhz: float) -> float:
    """
    Single knife-edge diffraction loss (Fresnel-Kirchhoff), per
    Rappaport's formulation.

    Steps:
      1. Compute the line-of-sight height at the obstruction's distance.
      2. Compute obstruction height above/below that line (h).
      3. Compute the Fresnel-Kirchhoff diffraction parameter v.
      4. Apply the standard empirical approximation for diffraction gain G(v).

    Returns additional loss in dB (0 if the path is clear, i.e. v <= -1).
    """
    d1 = obstruction.distance_km
    d2 = total_distance_km - d1
    if d1 <= 0 or d2 <= 0:
        return 0.0

    # line-of-sight height at the obstruction point (simple linear interpolation)
    los_height = tx_height_m + (rx_height_m - tx_height_m) * (d1 / total_distance_km)
    h = obstruction.ground_height_m - los_height  # positive = obstruction above LOS

    wavelength_m = 300.0 / freq_mhz  # c / f, f in MHz -> wavelength in metres
    d1_m, d2_m = d1 * 1000, d2 * 1000

    v = h * math.sqrt((2 / wavelength_m) * (1 / d1_m + 1 / d2_m))

    if v <= -1:
        return 0.0
    if v <= 0:
        g = 20 * math.log10(0.5 - 0.62 * v)
    elif v <= 1:
        g = 20 * math.log10(0.5 * math.exp(-0.95 * v))
    elif v <= 2.4:
        g = 20 * math.log10(0.4 - math.sqrt(0.1184 - (0.38 - 0.1 * v) ** 2))
    else:
        g = 20 * math.log10(0.225 / v)

    return max(0.0, -g)  # G(v) is negative (a loss); return the positive loss magnitude
