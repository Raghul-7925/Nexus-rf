import json
import urllib.parse
import re

with open('tarangsanchar.gov.in.har', 'r', encoding='utf-8') as f:
    har = json.load(f)

# 1. Parse details
details_map = {}
for e in har['log']['entries']:
    url = e['request']['url']
    if 'GetLocationDetails' in url:
        parsed_url = urllib.parse.urlparse(url)
        qs = urllib.parse.parse_qs(parsed_url.query)
        site_id = qs.get('SiteId', [None])[0]
        txt = e['response']['content'].get('text', '')
        if site_id and txt:
            try:
                details_map[site_id] = json.loads(txt)
            except Exception:
                pass

# 2. Parse locations
sites_map = {}
for e in har['log']['entries']:
    url = e['request']['url']
    if 'GetLocations' in url:
        txt = e['response']['content'].get('text', '')
        try:
            data = json.loads(txt)
            for group in data:
                for cat, items in group.items():
                    for item in items:
                        site_id = item.get('url_point')
                        lat = float(item.get('location_latitude'))
                        lng = float(item.get('location_longitude'))
                        if site_id and site_id not in sites_map:
                            sites_map[site_id] = {
                                'site_id': site_id,
                                'latitude': lat,
                                'longitude': lng,
                                'category': cat
                            }
        except Exception:
            pass

def parse_operators(op_str):
    if not op_str:
        return []
    parts = re.split(r'(?:,\s*)(?=[A-Za-z\s]+-\s*)', op_str)
    res = []
    for p in parts:
        if '-' in p:
            op, techs = p.split('-', 1)
            op = op.strip()
            if 'VI' in op.upper(): op = 'Vi'
            elif 'AIRTEL' in op.upper(): op = 'Airtel'
            elif 'JIO' in op.upper(): op = 'Jio'
            elif 'BSNL' in op.upper(): op = 'BSNL'
            for t in techs.split(','):
                t = t.strip()
                if t:
                    res.append((op, t))
    return res

def resolve_tower_type(category):
    cat = (category or '').strip().lower()
    # 🔵 Blue: Cinema, Theatre, Mall, Multiplex -> Rooftop
    if any(k in cat for k in ['cinema', 'theatre', 'theater', 'mall', 'multiplex']):
        return 'Rooftop', 25.0, 43.0
    # 🟢 Green: Shop, Ground, Hotel, School, Tower -> Ground
    if any(k in cat for k in ['shop', 'ground', 'hotel', 'school', 'tower']):
        return 'Ground', 35.0, 43.0
    # 🩷 Pink: Cafe, Restaurant, Wall -> WallMount
    if any(k in cat for k in ['cafe', 'restaurant', 'wall']):
        return 'WallMount', 12.0, 37.0
    return 'Ground', 35.0, 43.0

towers = []
for sid, s in sites_map.items():
    lat = s['latitude']
    lng = s['longitude']
    cat = s['category']
    tower_type, height, power = resolve_tower_type(cat)
    det = details_map.get(sid)
    
    if det and det.get('operators'):
        ops = parse_operators(det.get('operators'))
        for op, tech in ops:
            freq = 3500 if tech == '5G' else (2300 if op == 'Jio' else (700 if (op == 'BSNL' and tech == '4G') else (1800 if tech == '4G' else (2100 if tech == '3G' else 900))))
            towers.append({
                'site_id': sid,
                'name': f"{op} Site {sid}",
                'latitude': lat,
                'longitude': lng,
                'operator': op,
                'band': freq,
                'technology': tech,
                'height': height,
                'power': power,
                'tower_type': tower_type,
                'cell_id': '',
                'address': det.get('address', '')
            })
    else:
        towers.append({
            'site_id': sid,
            'name': f"Telecom Site {sid}",
            'latitude': lat,
            'longitude': lng,
            'operator': 'Airtel',
            'band': 1800,
            'technology': '4G',
            'height': height,
            'power': power,
            'tower_type': tower_type,
            'cell_id': '',
            'address': ''
        })

print(f"Total sites: {len(sites_map)}")
print(f"Total towers generated: {len(towers)}")

# Write CSV
csv_lines = ['site_id,latitude,longitude,operator,band,technology,height,power,tower_type,cell_id']
for t in towers:
    csv_lines.append(f'"{t["site_id"]}",{t["latitude"]},{t["longitude"]},"{t["operator"]}",{t["band"]},"{t["technology"]}",{t["height"]},{t["power"]},"{t["tower_type"]}","{t["cell_id"]}"')

with open('data/tarangsanchar_seed_from_har.csv', 'w', encoding='utf-8') as f:
    f.write('\n'.join(csv_lines))

with open('data/tarangsanchar_seed_from_har.json', 'w', encoding='utf-8') as f:
    json.dump(towers, f, indent=2)

print("Saved data/tarangsanchar_seed_from_har.csv and .json successfully!")
