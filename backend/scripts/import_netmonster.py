import json
import sqlite3
import sys
from app.services.netmonster_parser import parse_netmonster_data

sys.stdout.reconfigure(encoding='utf-8')

conn = sqlite3.connect('nexus_rf.db')
c = conn.cursor()

# 1. Fetch TarangSanchar baseline towers
c.execute("SELECT id, name, lat, lng, operator, technology, freq_mhz, site_id, tower_type FROM towers WHERE source = 'import'")
baseline = c.fetchall()
print(f"Loaded {len(baseline)} TarangSanchar baseline macro towers")

# 2. Load the user's NetMonster file
path = r"C:\Users\Jeeva\Downloads\JSON_29_09_10_45 netmonster.json"
with open(path, "r", encoding="utf-8") as f:
    raw_cells = json.load(f)

# 3. Parse and snap to baseline
res = parse_netmonster_data(raw_cells, baseline_towers=baseline, snap_to_baseline=True, snap_radius_m=1200.0)

print(f"Parsed {res['valid_cells']} valid localized cells ({res['total_items']} items in file)")
print(f"Site clusters: {res['clusters_count']}")
print(f"Snapped to exact TarangSanchar baseline: {res['snapped_to_baseline_count']} sites")
print(f"New field-audited sites (e.g. Villianur/Ariyur): {res['new_field_sites_count']} sites")
print(f"Generated {len(res['towers'])} tower cells to insert")

# 4. Check if any have already been inserted to avoid duplicates
c.execute("SELECT cell_id FROM towers WHERE source IN ('import_enriched', 'netmonster_verified')")
existing_cids = set(r[0] for r in c.fetchall() if r[0])

inserted = 0
for t in res["towers"]:
    if t["cell_id"] and t["cell_id"] in existing_cids:
        continue # Avoid re-inserting same cell
    c.execute("""
        INSERT INTO towers (
            id, name, lat, lng, freq_mhz, height_m, power_dbm,
            operator, technology, bandwidth_mhz, tower_type,
            azimuth_deg, source, cell_id, site_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        t["id"], t["name"], t["lat"], t["lng"], t["freq_mhz"],
        t["height_m"], t["power_dbm"], t["operator"], t["technology"],
        t["bandwidth_mhz"], t["tower_type"], t["azimuth_deg"],
        t["source"], t["cell_id"], t["site_id"]
    ))
    inserted += 1

conn.commit()
print(f"Successfully inserted {inserted} NetMonster cell records into nexus_rf.db!")

# Total towers now in DB
c.execute("SELECT COUNT(*), source FROM towers GROUP BY source")
print("Towers in DB by source:", c.fetchall())

c.execute("SELECT COUNT(*), operator FROM towers GROUP BY operator")
print("Towers in DB by operator:", c.fetchall())
