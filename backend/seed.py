"""
Seed script to populate initial sample telecom towers in Tamil Nadu (Villupuram / Radhapuram)
based on actual Tarang Sanchar portal site data.
"""

from app.db.session import init_db, SessionLocal
from app.db.models import Tower

def seed():
    init_db()
    db = SessionLocal()
    
    count = db.query(Tower).count()
    if count > 0:
        print(f"Database already has {count} towers. Skipping seed.")
        db.close()
        return

    sample_towers = [
        Tower(
            name="Radhapuram Rettiar St (Airtel)",
            lat=11.9401,
            lng=79.4861,
            operator="Airtel",
            technology="4G",
            freq_mhz=2100.0,
            bandwidth_mhz=20.0,
            height_m=32.0,
            power_dbm=43.0,
            tower_type="Rooftop",
            azimuth_deg=None,
            source="tarangsanchar_seed",
            site_id="TS-TN-VPM-001",
        ),
        Tower(
            name="Radhapuram Rettiar St (Vi)",
            lat=11.9401,
            lng=79.4861,
            operator="Vi",
            technology="4G",
            freq_mhz=1800.0,
            bandwidth_mhz=15.0,
            height_m=30.0,
            power_dbm=43.0,
            tower_type="Rooftop",
            azimuth_deg=None,
            source="tarangsanchar_seed",
            site_id="TS-TN-VPM-001",
        ),
        Tower(
            name="Villupuram Town Junction (Jio 5G)",
            lat=11.9442,
            lng=79.4935,
            operator="Jio",
            technology="5G",
            freq_mhz=3500.0,
            bandwidth_mhz=100.0,
            height_m=28.0,
            power_dbm=53.0,
            tower_type="Rooftop",
            azimuth_deg=0.0,
            source="manual",
            site_id="JIO-5G-VPM-042",
        ),
        Tower(
            name="NH-45 Bypass Macro (Jio 4G)",
            lat=11.9510,
            lng=79.4790,
            operator="Jio",
            technology="4G",
            freq_mhz=2300.0,
            bandwidth_mhz=40.0,
            height_m=42.0,
            power_dbm=46.0,
            tower_type="Ground",
            azimuth_deg=120.0,
            source="manual",
            site_id="JIO-4G-VPM-108",
        ),
        Tower(
            name="Old Bus Stand BSNL Tower",
            lat=11.9365,
            lng=79.4890,
            operator="BSNL",
            technology="3G/4G",
            freq_mhz=2100.0,
            bandwidth_mhz=10.0,
            height_m=45.0,
            power_dbm=43.0,
            tower_type="Ground",
            azimuth_deg=None,
            source="manual",
            site_id="BSNL-VPM-019",
        ),
        Tower(
            name="East Pondy Road (Airtel 5G)",
            lat=11.9380,
            lng=79.5020,
            operator="Airtel",
            technology="5G",
            freq_mhz=3500.0,
            bandwidth_mhz=100.0,
            height_m=30.0,
            power_dbm=53.0,
            tower_type="Rooftop",
            azimuth_deg=240.0,
            source="manual",
            site_id="AIR-5G-VPM-007",
        ),
    ]

    for t in sample_towers:
        db.add(t)
    
    db.commit()
    print(f"Successfully seeded {len(sample_towers)} sample telecom towers.")
    db.close()

if __name__ == "__main__":
    seed()
