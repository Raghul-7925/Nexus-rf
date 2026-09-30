import sqlite3
import os
import sys

# Ensure backend path
sys.path.insert(0, os.path.abspath('backend'))
from app.services.netmonster_parser import parse_ntm_text

conn = sqlite3.connect('backend/nexus_rf.db')
cur = conn.cursor()

baseline = cur.execute('SELECT id, name, lat, lng, operator, technology, freq_mhz, site_id, tower_type FROM towers WHERE source = "import"').fetchall()
print(f"Loaded {len(baseline)} baseline towers.")

with open('NTM_29_09_11_34.ntm', 'r', encoding='utf-8') as f:
    raw = f.read()

res = parse_ntm_text(raw, baseline_towers=baseline, snap_to_baseline=True)
print(f"Parsed {len(res['towers'])} NTM cells.")

deleted = cur.execute('DELETE FROM towers WHERE source IN ("netmonster_verified", "import_enriched")').rowcount
print(f"Cleaned {deleted} old partial rows.")

for t in res['towers']:
    cur.execute('''
        INSERT INTO towers (id, name, lat, lng, operator, technology, freq_mhz, bandwidth_mhz, height_m, power_dbm, tower_type, azimuth_deg, source, cell_id, site_id, pci, area, channel, location_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        t['id'], t['name'], t['lat'], t['lng'], t['operator'], t['technology'], t['freq_mhz'], t['bandwidth_mhz'],
        t['height_m'], t['power_dbm'], t['tower_type'], t['azimuth_deg'], t['source'], t['cell_id'], t['site_id'],
        t['pci'], t['area'], t['channel'], t['location_name']
    ))

conn.commit()
total = cur.execute('SELECT COUNT(*) FROM towers').fetchone()[0]
print(f"New total towers in DB: {total}")

sample = cur.execute('SELECT name, operator, cell_id, pci, area, channel, location_name, source FROM towers WHERE source IN ("netmonster_verified", "import_enriched") LIMIT 3').fetchall()
for s in sample:
    print(f"Sample DB row: {s}")
