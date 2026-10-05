"""
districts.py - Comprehensive Indian States & Districts Bounding Boxes Database
Optimized for Tarang Sanchar slide sweep queries across all of India.
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
        "Nashik": {"bounds": (19.5000, 73.2500, 20.9000, 74.9500), "center": (19.9975, 73.7898)},
        "Aurangabad (Chhatrapati Sambhajinagar)": {"bounds": (19.3000, 74.9000, 20.6000, 76.1500), "center": (19.8762, 75.3433)},
        "Solapur": {"bounds": (17.1500, 74.9000, 18.5500, 76.2500), "center": (17.6599, 75.9064)},
        "Kolhapur": {"bounds": (15.7500, 73.6500, 17.1500, 74.7000), "center": (16.7050, 74.2433)}
    },
    "Delhi NCR": {
        "New Delhi": {"bounds": (28.5300, 77.1500, 28.6700, 77.2800), "center": (28.6139, 77.2090)},
        "South Delhi": {"bounds": (28.4500, 77.1200, 28.5800, 77.2700), "center": (28.5244, 77.2066)},
        "North Delhi": {"bounds": (28.6800, 77.1000, 28.8500, 77.2500), "center": (28.7383, 77.1685)},
        "West Delhi": {"bounds": (28.5900, 77.0200, 28.7000, 77.1500), "center": (28.6500, 77.0800)},
        "East Delhi": {"bounds": (28.6000, 77.2500, 28.6800, 77.3400), "center": (28.6400, 77.3000)},
        "Noida": {"bounds": (28.1500, 77.3000, 28.6500, 77.6500), "center": (28.5355, 77.3910)},
        "Gurugram": {"bounds": (28.2500, 76.7500, 28.5500, 77.1500), "center": (28.4595, 77.0266)},
        "Faridabad": {"bounds": (28.1500, 77.1500, 28.5000, 77.4500), "center": (28.4089, 77.3178)},
        "Ghaziabad": {"bounds": (28.5500, 77.3500, 28.8500, 77.7000), "center": (28.6692, 77.4538)}
    },
    "Kerala": {
        "Thiruvananthapuram": {"bounds": (8.2500, 76.7500, 8.8500, 77.3000), "center": (8.5241, 76.9366)},
        "Ernakulam (Kochi)": {"bounds": (9.7500, 76.1500, 10.3500, 76.8500), "center": (9.9816, 76.2999)},
        "Kozhikode": {"bounds": (11.1000, 75.6500, 11.7500, 76.1000), "center": (11.2588, 75.7804)},
        "Thrissur": {"bounds": (10.2000, 75.9500, 10.8000, 76.5500), "center": (10.5276, 76.2144)},
        "Kollam": {"bounds": (8.7500, 76.4500, 9.2000, 77.2000), "center": (8.8932, 76.6141)},
        "Kannur": {"bounds": (11.6000, 75.2500, 12.2500, 75.9000), "center": (11.8745, 75.3704)},
        "Palakkad": {"bounds": (10.4000, 76.2000, 11.1500, 76.9000), "center": (10.7867, 76.6548)},
        "Alappuzha": {"bounds": (9.0500, 76.2500, 9.8500, 76.6000), "center": (9.4981, 76.3388)},
        "Kottayam": {"bounds": (9.3500, 76.4000, 9.9500, 77.0000), "center": (9.5916, 76.5222)},
        "Malappuram": {"bounds": (10.7000, 75.8000, 11.4500, 76.4500), "center": (11.0510, 76.0711)}
    },
    "Telangana": {
        "Hyderabad": {"bounds": (17.2000, 78.3000, 17.6000, 78.6500), "center": (17.3850, 78.4867)},
        "Rangareddy": {"bounds": (16.9000, 77.8000, 17.6000, 78.9000), "center": (17.3000, 78.4000)},
        "Medchal-Malkajgiri": {"bounds": (17.4000, 78.4000, 17.7500, 78.7500), "center": (17.5500, 78.5500)},
        "Warangal": {"bounds": (17.7000, 79.3000, 18.2500, 80.0500), "center": (17.9689, 79.5941)},
        "Karimnagar": {"bounds": (18.1500, 78.9000, 18.7500, 79.4000), "center": (18.4386, 79.1288)},
        "Nizamabad": {"bounds": (18.4000, 77.7500, 19.1000, 78.6500), "center": (18.6725, 78.0941)},
        "Khammam": {"bounds": (16.9000, 79.8000, 17.6500, 80.6000), "center": (17.2473, 80.1514)}
    },
    "Andhra Pradesh": {
        "Visakhapatnam": {"bounds": (17.5000, 83.1000, 18.0500, 83.4500), "center": (17.6868, 83.2185)},
        "Vijayawada (NTR)": {"bounds": (16.3500, 80.4500, 16.7500, 80.8500), "center": (16.5062, 80.6480)},
        "Guntur": {"bounds": (15.8000, 79.8000, 16.6000, 80.7000), "center": (16.3067, 80.4365)},
        "Tirupati": {"bounds": (13.4000, 79.2000, 13.9000, 80.0500), "center": (13.6288, 79.4192)},
        "Nellore": {"bounds": (13.7000, 79.5000, 15.1000, 80.2500), "center": (14.4426, 79.9865)},
        "Kurnool": {"bounds": (15.2000, 76.9500, 16.1500, 78.5000), "center": (15.8281, 78.0373)},
        "Kadapa": {"bounds": (13.8000, 78.2000, 15.1000, 79.4000), "center": (14.4673, 78.8242)},
        "Anantapur": {"bounds": (13.8500, 76.8000, 15.2500, 78.1000), "center": (14.6819, 77.6006)},
        "Kakinada": {"bounds": (16.7000, 82.0000, 17.3000, 82.5000), "center": (16.9891, 82.2475)},
        "Rajahmundry (East Godavari)": {"bounds": (16.8000, 81.6000, 17.3000, 82.1000), "center": (17.0005, 81.8040)}
    },
    "Gujarat": {
        "Ahmedabad": {"bounds": (22.8500, 72.3500, 23.2500, 72.7500), "center": (23.0225, 72.5714)},
        "Surat": {"bounds": (21.0500, 72.6500, 21.3500, 73.0000), "center": (21.1702, 72.8311)},
        "Vadodara": {"bounds": (22.1500, 73.0500, 22.4500, 73.3500), "center": (22.3072, 73.1812)},
        "Rajkot": {"bounds": (22.1500, 70.6500, 22.4500, 70.9500), "center": (22.3039, 70.8022)},
        "Bhavnagar": {"bounds": (21.5000, 71.9000, 21.9000, 72.3000), "center": (21.7645, 72.1519)},
        "Gandhinagar": {"bounds": (23.1000, 72.5000, 23.3500, 72.7500), "center": (23.2156, 72.6369)}
    },
    "Rajasthan": {
        "Jaipur": {"bounds": (26.7500, 75.6500, 27.0500, 76.0000), "center": (26.9124, 75.7873)},
        "Jodhpur": {"bounds": (26.1500, 72.9000, 26.4500, 73.2000), "center": (26.2389, 73.0243)},
        "Udaipur": {"bounds": (24.4500, 73.5500, 24.7500, 73.8500), "center": (24.5854, 73.7125)},
        "Kota": {"bounds": (25.0500, 75.7000, 25.3000, 76.0000), "center": (25.2138, 75.8648)},
        "Bikaner": {"bounds": (27.9000, 73.2000, 28.1500, 73.4500), "center": (28.0229, 73.3119)},
        "Ajmer": {"bounds": (26.3500, 74.5000, 26.6000, 74.8000), "center": (26.4499, 74.6399)}
    },
    "Uttar Pradesh": {
        "Lucknow": {"bounds": (26.7000, 80.8000, 27.0000, 81.1000), "center": (26.8467, 80.9462)},
        "Kanpur": {"bounds": (26.3500, 80.2000, 26.6000, 80.5000), "center": (26.4499, 80.3319)},
        "Varanasi": {"bounds": (25.2000, 82.8500, 25.4500, 83.1500), "center": (25.3176, 82.9739)},
        "Prayagraj (Allahabad)": {"bounds": (25.3000, 81.7000, 25.6000, 82.0000), "center": (25.4358, 81.8463)},
        "Agra": {"bounds": (27.1000, 77.9000, 27.3000, 78.1500), "center": (27.1767, 78.0081)},
        "Meerut": {"bounds": (28.8500, 77.6000, 29.1000, 77.8500), "center": (28.9845, 77.7064)},
        "Bareilly": {"bounds": (28.2500, 79.3000, 28.5000, 79.5500), "center": (28.3670, 79.4304)},
        "Aligarh": {"bounds": (27.8000, 78.0000, 28.0000, 78.2000), "center": (27.8974, 78.0880)},
        "Moradabad": {"bounds": (28.7500, 78.6500, 28.9500, 78.8500), "center": (28.8351, 78.7747)},
        "Gorakhpur": {"bounds": (26.6500, 83.2500, 26.8500, 83.4500), "center": (26.7606, 83.3732)}
    },
    "West Bengal": {
        "Kolkata": {"bounds": (22.4500, 88.2500, 22.6500, 88.4500), "center": (22.5726, 88.3639)},
        "Howrah": {"bounds": (22.5000, 88.1500, 22.7000, 88.3500), "center": (22.5958, 88.2636)},
        "North 24 Parganas": {"bounds": (22.5500, 88.3500, 23.0000, 89.0000), "center": (22.7200, 88.4800)},
        "South 24 Parganas": {"bounds": (21.5000, 88.0000, 22.5500, 89.0000), "center": (22.1500, 88.5000)},
        "Siliguri (Darjeeling)": {"bounds": (26.6000, 88.3000, 26.8500, 88.5500), "center": (26.7271, 88.3953)},
        "Asansol (Paschim Bardhaman)": {"bounds": (23.6000, 86.8500, 23.8000, 87.1000), "center": (23.6889, 86.9661)},
        "Durgapur": {"bounds": (23.4500, 87.2000, 23.6000, 87.4000), "center": (23.5204, 87.3119)}
    },
    "Madhya Pradesh": {
        "Bhopal": {"bounds": (23.1500, 77.3000, 23.3500, 77.5500), "center": (23.2599, 77.4126)},
        "Indore": {"bounds": (22.6000, 75.7500, 22.8000, 76.0000), "center": (22.7196, 75.8577)},
        "Jabalpur": {"bounds": (23.1000, 79.8500, 23.2500, 80.0500), "center": (23.1815, 79.9864)},
        "Gwalior": {"bounds": (26.1500, 78.1000, 26.3000, 78.2500), "center": (26.2183, 78.1828)},
        "Ujjain": {"bounds": (23.1000, 75.7000, 23.2500, 75.8500), "center": (23.1765, 75.7885)}
    },
    "Bihar": {
        "Patna": {"bounds": (25.5500, 85.0500, 25.7000, 85.2500), "center": (25.5941, 85.1376)},
        "Gaya": {"bounds": (24.7000, 84.9000, 24.8500, 85.0500), "center": (24.7914, 85.0002)},
        "Muzaffarpur": {"bounds": (26.0500, 85.3000, 26.2000, 85.4500), "center": (26.1209, 85.3647)},
        "Bhagalpur": {"bounds": (25.2000, 86.9000, 25.3000, 87.0500), "center": (25.2425, 86.9842)}
    },
    "Punjab": {
        "Ludhiana": {"bounds": (30.8000, 75.7500, 31.0000, 76.0000), "center": (30.9010, 75.8573)},
        "Amritsar": {"bounds": (31.5500, 74.8000, 31.7500, 75.0000), "center": (31.6340, 74.8723)},
        "Jalandhar": {"bounds": (31.2500, 75.5000, 31.4000, 75.6500), "center": (31.3260, 75.5762)},
        "Patiala": {"bounds": (30.2500, 76.3000, 30.4000, 76.4500), "center": (30.3398, 76.3869)}
    },
    "Haryana": {
        "Faridabad": {"bounds": (28.3000, 77.2000, 28.5000, 77.4000), "center": (28.4089, 77.3178)},
        "Gurugram": {"bounds": (28.4000, 76.9500, 28.5500, 77.1000), "center": (28.4595, 77.0266)},
        "Panipat": {"bounds": (29.3500, 76.9000, 29.4500, 77.0500), "center": (29.3909, 76.9635)},
        "Ambala": {"bounds": (30.3000, 76.7000, 30.4500, 76.8500), "center": (30.3782, 76.7767)},
        "Karnal": {"bounds": (29.6500, 76.9000, 29.7500, 77.0500), "center": (29.6857, 76.9905)}
    },
    "Odisha": {
        "Bhubaneswar (Khordha)": {"bounds": (20.2000, 85.7500, 20.3500, 85.9000), "center": (20.2961, 85.8245)},
        "Cuttack": {"bounds": (20.4000, 85.8000, 20.5500, 85.9500), "center": (20.4625, 85.8828)},
        "Rourkela (Sundargarh)": {"bounds": (22.2000, 84.8000, 22.3000, 84.9500), "center": (22.2604, 84.8536)},
        "Puri": {"bounds": (19.7500, 85.7500, 19.8500, 85.9000), "center": (19.8135, 85.8312)}
    },
    "Assam": {
        "Guwahati (Kamrup Metro)": {"bounds": (26.1000, 91.6500, 26.2500, 91.8500), "center": (26.1445, 91.7362)},
        "Dibrugarh": {"bounds": (27.4500, 94.8500, 27.5500, 95.0000), "center": (27.4728, 94.9120)},
        "Silchar (Cachar)": {"bounds": (24.7800, 92.7500, 24.8800, 92.8500), "center": (24.8333, 92.7789)}
    },
    "Jharkhand": {
        "Ranchi": {"bounds": (23.3000, 85.2500, 23.4500, 85.4000), "center": (23.3441, 85.3096)},
        "Jamshedpur (East Singhbhum)": {"bounds": (22.7500, 86.1500, 22.8500, 86.2500), "center": (22.8046, 86.2029)},
        "Dhanbad": {"bounds": (23.7500, 86.4000, 23.8500, 86.5000), "center": (23.7957, 86.4304)}
    },
    "Chhattisgarh": {
        "Raipur": {"bounds": (21.2000, 81.6000, 21.3000, 81.7000), "center": (21.2514, 81.6296)},
        "Bhilai-Durg": {"bounds": (21.1500, 81.2500, 21.2500, 81.3500), "center": (21.1938, 81.3509)},
        "Bilaspur": {"bounds": (22.0500, 82.1000, 22.1500, 82.2000), "center": (22.0797, 82.1409)}
    },
    "Uttarakhand": {
        "Dehradun": {"bounds": (30.2500, 77.9500, 30.4000, 78.1000), "center": (30.3165, 78.0322)},
        "Haridwar": {"bounds": (29.9000, 78.1000, 30.0000, 78.2000), "center": (29.9457, 78.1642)},
        "Nainital-Haldwani": {"bounds": (29.2000, 79.4500, 29.4000, 79.6000), "center": (29.3803, 79.4636)}
    },
    "Himachal Pradesh": {
        "Shimla": {"bounds": (31.0500, 77.1000, 31.1500, 77.2000), "center": (31.1048, 77.1734)},
        "Dharamshala (Kangra)": {"bounds": (32.2000, 76.3000, 32.2500, 76.3500), "center": (32.2190, 76.3234)}
    },
    "Goa": {
        "North Goa (Panaji)": {"bounds": (15.4000, 73.7500, 15.6000, 73.9500), "center": (15.4909, 73.8278)},
        "South Goa (Margao)": {"bounds": (15.2000, 73.9000, 15.3500, 74.0500), "center": (15.2832, 73.9862)}
    },
    "Jammu & Kashmir": {
        "Srinagar": {"bounds": (34.0500, 74.7500, 34.1500, 74.8500), "center": (34.0837, 74.7973)},
        "Jammu": {"bounds": (32.7000, 74.8000, 32.7500, 74.9000), "center": (32.7266, 74.8570)}
    },
    "Chandigarh": {
        "Chandigarh": {"bounds": (30.7000, 76.7500, 30.7800, 76.8500), "center": (30.7333, 76.7794)}
    },
    "Tripura": {
        "Agartala (West Tripura)": {"bounds": (23.8000, 91.2500, 23.9000, 91.3500), "center": (23.8315, 91.2868)}
    },
    "Meghalaya": {
        "Shillong (East Khasi Hills)": {"bounds": (25.5500, 91.8500, 25.6200, 91.9500), "center": (25.5788, 91.8933)}
    },
    "Manipur": {
        "Imphal": {"bounds": (24.7800, 93.9000, 24.8500, 93.9800), "center": (24.8170, 93.9368)}
    },
    "Nagaland": {
        "Kohima / Dimapur": {"bounds": (25.6500, 93.7000, 25.9500, 94.1500), "center": (25.6751, 94.1086)}
    },
    "Mizoram": {
        "Aizawl": {"bounds": (23.7000, 92.7000, 23.7600, 92.7500), "center": (23.7271, 92.7176)}
    },
    "Arunachal Pradesh": {
        "Itanagar": {"bounds": (27.0800, 93.6000, 27.1200, 93.6500), "center": (27.0844, 93.6053)}
    },
    "Sikkim": {
        "Gangtok": {"bounds": (27.3200, 88.6000, 27.3500, 88.6300), "center": (27.3389, 88.6065)}
    },
    "Ladakh": {
        "Leh": {"bounds": (34.1400, 77.5500, 34.1800, 77.6000), "center": (34.1526, 77.5771)}
    }
}


def get_states() -> List[str]:
    """List of all states with 'All India (Entire Country)' at the top."""
    return ["All India (Entire Country)"] + list(DISTRICTS_DATA.keys())


def get_districts_for_state(state: str) -> List[str]:
    """
    Returns districts for a state.
    Includes an 'All Districts in <state>' option at the top of each state's list.
    """
    if state in ["All India", "All India (Entire Country)"]:
        return ["All Districts (Full Country Auto-Sweep)"]

    dists = list(DISTRICTS_DATA.get(state, {}).keys())
    if dists:
        return [f"All Districts in {state}"] + dists
    return []


def get_all_india_queue() -> List[Tuple[str, str]]:
    """
    Returns an ordered flat queue of (state, district) tuples covering
    every single district across all Indian states.
    """
    queue = []
    for state, dists in DISTRICTS_DATA.items():
        for dist in dists.keys():
            queue.append((state, dist))
    return queue


def get_state_districts_queue(state: str) -> List[Tuple[str, str]]:
    """Returns queue of (state, district) for all districts in a given state."""
    dists = DISTRICTS_DATA.get(state, {})
    return [(state, dist) for dist in dists.keys()]


def get_district_bounds(state: str, district: str) -> Optional[Tuple[float, float, float, float]]:
    state_dict = DISTRICTS_DATA.get(state)
    if state_dict and district in state_dict:
        return state_dict[district]["bounds"]
    # Fallback search across all states by district name
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
