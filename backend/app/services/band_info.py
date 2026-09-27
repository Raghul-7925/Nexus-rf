"""
app/services/band_info.py

Reference lookup for Indian telecom frequency bands -> (typical
technology, typical channel bandwidth in MHz). Used to default missing
fields on import, and to score the "speed" dimension in the ISP
compare engine.

These are typical/representative values, not live spectrum-allocation
data -- documented as an approximation in architecture.md Section 5.4
and the project's stated limitations.
"""

BAND_INFO = {
    700: {"tech": "4G/5G", "bandwidth_mhz": 10},
    850: {"tech": "2G/3G", "bandwidth_mhz": 5},
    900: {"tech": "2G/4G", "bandwidth_mhz": 1},
    1800: {"tech": "2G/4G", "bandwidth_mhz": 15},
    2100: {"tech": "3G/4G", "bandwidth_mhz": 15},
    2300: {"tech": "4G TDD", "bandwidth_mhz": 20},
    2500: {"tech": "4G TDD", "bandwidth_mhz": 20},
    3300: {"tech": "5G NR", "bandwidth_mhz": 100},
    3500: {"tech": "5G NR", "bandwidth_mhz": 100},
}

OPERATORS = ["Jio", "Airtel", "Vi", "BSNL"]


def band_defaults(freq_mhz: float) -> dict:
    nearest = min(BAND_INFO.keys(), key=lambda b: abs(b - freq_mhz)) if BAND_INFO else None
    if nearest is not None and abs(nearest - freq_mhz) <= 50:
        return BAND_INFO[nearest]
    return {"tech": "4G", "bandwidth_mhz": 10}
