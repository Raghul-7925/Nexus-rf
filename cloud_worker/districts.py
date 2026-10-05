"""
districts.py - Comprehensive Indian States & Districts Bounding Boxes Database
Optimized for Tarang Sanchar slide sweep queries.
"""

from typing import Dict, List, Tuple, Optional

DISTRICTS_DATA: Dict[str, Dict[str, dict]] = {
    "Tamil Nadu": {
        "Chennai": {"bounds": (12.9100, 80.1200, 13.2300, 80.3300), "center": (13.0827, 80.2707)},
        "Villupuram": {"bounds": (11.8000, 79.2000, 12.3500, 80.0500), "center": (11.9401, 79.4861)},
        "Coimbatore": {"bounds": (10.5500, 76.6500, 11.4500, 77.3000), "center": (11.0168, 76.9558)},
        "Madurai": {"bounds": (9.6000, 77.8000, 10.2000, 78.4500), "center": (9.9252, 78.1198)},
        "Salem": {"bounds": (11.3500, 77.7000, 12.0500, 78.7500), "center": (11.6643, 78.1460)},
        "Tiruchirappalli": {"bounds": (10.3500, 78.3000, 11.1500, 79.0500), "center": (10.7905, 78.7047)},
        "Tirunelveli": {"bounds": (8.3000, 77.2000, 9.1000, 77.9000), "center": (8.7139, 77.7567)},
        "Erode": {"bounds": (11.1000, 76.8500, 11.9500, 77.9500), "center": (11.3410, 77.7172)},
        "Vellore": {"bounds": (12.6500, 78.8000, 13.0500, 79.4000), "center": (12.9165, 79.1325)},
        "Ranipet": {"bounds": (12.7500, 79.2000, 13.1500, 79.8000), "center": (12.9224, 79.3328)},
        "Tirupathur": {"bounds": (12.2500, 78.4000, 12.7500, 78.9500), "center": (12.4925, 78.5678)},
        "Kanchipuram": {"bounds": (12.6000, 79.5000, 13.0500, 80.0500), "center": (12.8342, 79.7036)},
        "Chengalpattu": {"bounds": (12.4500, 79.8000, 12.9500, 80.3000), "center": (12.6819, 79.9888)},
        "Tiruvallur": {"bounds": (13.0500, 79.6000, 13.5500, 80.3500), "center": (13.1437, 79.9083)},
        "Cuddalore": {"bounds": (11.2000, 79.2000, 11.8500, 79.8500), "center": (11.7480, 79.7714)},
        "Kallakurichi": {"bounds": (11.5000, 78.6000, 12.1500, 79.3500), "center": (11.7383, 78.9639)},
        "Thanjavur": {"bounds": (10.1500, 78.8000, 11.1500, 79.4500), "center": (10.7870, 79.1378)},
        "Dindigul": {"bounds": (10.0500, 77.3000, 10.7500, 78.2500), "center": (10.3673, 77.9803)},
        "Tiruppur": {"bounds": (10.5000, 77.1000, 11.3500, 77.7500), "center": (11.1085, 77.3411)},
        "Dharmapuri": {"bounds": (11.7500, 77.7000, 12.4500, 78.6000), "center": (12.1211, 78.1582)},
        "Krishnagiri": {"bounds": (12.1500, 77.4500, 12.8500, 78.5500), "center": (12.5186, 78.2137)},
        "Namakkal": {"bounds": (11.0000, 77.6500, 11.6000, 78.4500), "center": (11.2189, 78.1674)},
        "Karur": {"bounds": (10.6000, 77.7500, 11.1000, 78.3500), "center": (10.9601, 78.0766)},
        "Perambalur": {"bounds": (11.1000, 78.6500, 11.4500, 79.2000), "center": (11.2342, 78.8820)},
        "Ariyalur": {"bounds": (10.9000, 79.0000, 11.4500, 79.5500), "center": (11.1401, 79.0786)},
        "Nagapattinam": {"bounds": (10.2500, 79.6000, 10.9500, 79.9500), "center": (10.7672, 79.8449)},
        "Mayiladuthurai": {"bounds": (11.0000, 79.5000, 11.4000, 79.9000), "center": (11.1075, 79.6524)},
        "Tiruvarur": {"bounds": (10.3000, 79.3500, 11.0000, 79.8500), "center": (10.7725, 79.6366)},
        "Pudukkottai": {"bounds": (9.8500, 78.5000, 10.6000, 79.3000), "center": (10.3797, 78.8208)},
        "Sivaganga": {"bounds": (9.7000, 78.2000, 10.3000, 79.0500), "center": (9.8433, 78.4809)},
        "Ramanathapuram": {"bounds": (9.1000, 78.3000, 9.9000, 79.4000), "center": (9.3639, 78.8395)},
        "Virudhunagar": {"bounds": (9.2000, 77.3500, 9.7500, 78.3500), "center": (9.5872, 77.9514)},
        "Theni": {"bounds": (9.6000, 77.1500, 10.2500, 77.7500), "center": (10.0104, 77.4768)},
        "Thoothukudi": {"bounds": (8.3000, 77.8000, 9.2500, 78.3500), "center": (8.7642, 78.1348)},
        "Tenkasi": {"bounds": (8.8000, 77.1000, 9.4000, 77.7000), "center": (8.9594, 77.3150)},
        "Kanniyakumari": {"bounds": (8.0500, 77.1000, 8.5500, 77.6000), "center": (8.0883, 77.5385)},
        "Nilgiris": {"bounds": (11.1500, 76.3500, 11.7500, 77.0500), "center": (11.4102, 76.6950)}
    },
    "Puducherry": {
        "Pondicherry": {"bounds": (11.8200, 79.7000, 12.0500, 79.9000), "center": (11.9416, 79.8083)},
        "Karaikal": {"bounds": (10.8500, 79.7500, 11.0200, 79.8800), "center": (10.9254, 79.8380)},
        "Mahe": {"bounds": (11.6800, 75.5200, 11.7200, 75.5600), "center": (11.7004, 75.5343)},
        "Yanam": {"bounds": (16.7100, 82.1900, 16.7500, 82.2300), "center": (16.7320, 82.2144)}
    },
    "Karnataka": {
        "Bengaluru Urban": {"bounds": (12.7500, 77.4000, 13.2000, 77.8000), "center": (12.9716, 77.5946)},
        "Bengaluru Rural": {"bounds": (12.9500, 77.1500, 13.4500, 77.8500), "center": (13.2847, 77.5540)},
        "Mysuru": {"bounds": (11.7500, 76.0500, 12.6000, 77.1000), "center": (12.2958, 76.6394)},
        "Mangaluru": {"bounds": (12.5000, 74.8000, 13.1500, 75.6000), "center": (12.9141, 74.8560)},
        "Hubballi-Dharwad": {"bounds": (15.1000, 74.8500, 15.6500, 75.4500), "center": (15.3647, 75.1240)},
        "Belagavi": {"bounds": (15.3500, 74.1000, 16.8500, 75.2500), "center": (15.8497, 74.4977)},
        "Tumakuru": {"bounds": (12.7500, 76.5000, 14.3500, 77.5500), "center": (13.3392, 77.1017)},
        "Udupi": {"bounds": (13.0000, 74.6500, 13.9500, 75.1500), "center": (13.3409, 74.7421)},
        "Ballari": {"bounds": (14.7000, 76.4500, 15.8000, 77.2500), "center": (15.1394, 76.9214)},
        "Davanagere": {"bounds": (13.9000, 75.6500, 14.7500, 76.4000), "center": (14.4644, 75.9218)},
        "Shivamogga": {"bounds": (13.4500, 74.8500, 14.5000, 76.1500), "center": (13.9299, 75.5681)}
    },
    "Maharashtra": {
        "Mumbai City": {"bounds": (18.8900, 72.8000, 19.0500, 72.9000), "center": (18.9388, 72.8354)},
        "Mumbai Suburban": {"bounds": (19.0000, 72.7500, 19.3200, 72.9900), "center": (19.1136, 72.8697)},
        "Pune": {"bounds": (18.1500, 73.3500, 19.2500, 75.1500), "center": (18.5204, 73.8567)},
        "Thane": {"bounds": (19.1000, 72.9000, 19.7500, 73.5500), "center": (19.2183, 72.9781)},
        "Nagpur": {"bounds": (20.5500, 78.5500, 21.7500, 79.6000), "center": (21.1458, 79.0882)},
        "Nashik": {"bounds": (19.5000, 73.2500, 20.9000, 74.9500), "center": (19.9975, 73.7898)}
    },
    "Delhi NCR": {
        "New Delhi": {"bounds": (28.5300, 77.1500, 28.6700, 77.2800), "center": (28.6139, 77.2090)},
        "South Delhi": {"bounds": (28.4500, 77.1200, 28.5800, 77.2700), "center": (28.5244, 77.2066)},
        "North Delhi": {"bounds": (28.6800, 77.1000, 28.8500, 77.2500), "center": (28.7383, 77.1685)},
        "West Delhi": {"bounds": (28.5900, 77.0200, 28.7000, 77.1500), "center": (28.6500, 77.0800)},
        "East Delhi": {"bounds": (28.6000, 77.2500, 28.6800, 77.3400), "center": (28.6400, 77.3000)},
        "Noida": {"bounds": (28.1500, 77.3000, 28.6500, 77.6500), "center": (28.5355, 77.3910)},
        "Gurugram": {"bounds": (28.2500, 76.7500, 28.5500, 77.1500), "center": (28.4595, 77.0266)}
    },
    "Kerala": {
        "Thiruvananthapuram": {"bounds": (8.2500, 76.7500, 8.8500, 77.3000), "center": (8.5241, 76.9366)},
        "Ernakulam (Kochi)": {"bounds": (9.7500, 76.1500, 10.3500, 76.8500), "center": (9.9816, 76.2999)},
        "Kozhikode": {"bounds": (11.1000, 75.6500, 11.7500, 76.1000), "center": (11.2588, 75.7804)},
        "Thrissur": {"bounds": (10.2000, 75.9500, 10.8000, 76.5500), "center": (10.5276, 76.2144)}
    },
    "Telangana": {
        "Hyderabad": {"bounds": (17.2000, 78.3000, 17.6000, 78.6500), "center": (17.3850, 78.4867)},
        "Rangareddy": {"bounds": (16.9000, 77.8000, 17.6000, 78.9000), "center": (17.3000, 78.4000)},
        "Warangal": {"bounds": (17.7000, 79.3000, 18.2500, 80.0500), "center": (17.9689, 79.5941)}
    },
    "Andhra Pradesh": {
        "Visakhapatnam": {"bounds": (17.5000, 83.1000, 18.0500, 83.4500), "center": (17.6868, 83.2185)},
        "Vijayawada (NTR)": {"bounds": (16.3500, 80.4500, 16.7500, 80.8500), "center": (16.5062, 80.6480)},
        "Guntur": {"bounds": (15.8000, 79.8000, 16.6000, 80.7000), "center": (16.3067, 80.4365)},
        "Tirupati": {"bounds": (13.4000, 79.2000, 13.9000, 80.0500), "center": (13.6288, 79.4192)}
    }
}


def get_states() -> List[str]:
    return list(DISTRICTS_DATA.keys())


def get_districts_for_state(state: str) -> List[str]:
    return list(DISTRICTS_DATA.get(state, {}).keys())


def get_district_bounds(state: str, district: str) -> Optional[Tuple[float, float, float, float]]:
    state_dict = DISTRICTS_DATA.get(state)
    if state_dict and district in state_dict:
        return state_dict[district]["bounds"]
    # Fallback search by district name
    for s, dists in DISTRICTS_DATA.items():
        if district in dists:
            return dists[district]["bounds"]
    return None


def get_district_center(state: str, district: str) -> Optional[Tuple[float, float]]:
    state_dict = DISTRICTS_DATA.get(state)
    if state_dict and district in state_dict:
        return state_dict[district]["center"]
    for s, dists in DISTRICTS_DATA.items():
        if district in dists:
            return dists[district]["center"]
    return None


def generate_district_slides(bounds: Tuple[float, float, float, float], step_lat: float = 0.022, step_lng: float = 0.026) -> List[dict]:
    """
    Generate an optimized grid of slides for the district.
    Step: ~0.022° lat (~2.4 km) × ~0.026° lng (~2.8 km), optimal for Tarang Sanchar bounding-box queries.
    Uses alternating snake-sweep order to minimize geographical jumps.
    """
    min_lat, min_lng, max_lat, max_lng = bounds
    tiles = []
    row_idx = 0

    lat = min_lat
    while lat < max_lat:
        row_tiles = []
        col_idx = 0
        lng = min_lng
        while lng < max_lng:
            sw_lat = round(lat, 5)
            ne_lat = round(min(max_lat, lat + step_lat), 5)
            sw_lng = round(lng, 5)
            ne_lng = round(min(max_lng, lng + step_lng), 5)

            row_tiles.append({
                "id": f"dist_slide_{row_idx}_{col_idx}",
                "row": row_idx,
                "col": col_idx,
                "swLat": sw_lat,
                "neLat": ne_lat,
                "swLng": sw_lng,
                "neLng": ne_lng
            })
            col_idx += 1
            lng += step_lng

        if row_idx % 2 == 1:
            row_tiles.reverse()

        tiles.extend(row_tiles)
        row_idx += 1
        lat += step_lat

    return tiles
