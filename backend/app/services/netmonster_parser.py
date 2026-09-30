"""
app/services/netmonster_parser.py

Specialized Telecom Engineering Parser for NetMonster Drive-Test / Cell-Audit Dumps.

Features:
1. Translates Android NetMonster cellular logs (CID, Area/LAC/TAC, PCI/PSC, ARFCN/EARFCN/UARFCN)
   into standard 3GPP parameters (Carrier Frequency in MHz, Bandwidth, 3GPP Band designation).
2. MCC/MNC Resolution:
   - 404-80, 404-94, etc. -> BSNL
   - 405-869, 405-8xx -> Reliance Jio
   - 404-43, 404-46 -> Vodafone Idea (Vi)
   - 404-45, 404-49 -> Bharti Airtel
3. Baseline Snapping:
   - Snaps cell clusters to exact 100% TarangSanchar baseline towers (within snap_radius_m).
   - Inherits verified baseline coordinates and site IDs.
   - For newly discovered field towers beyond baseline bounds (e.g. Villianur / Puducherry),
     creates verified field-audit sites.
4. Multi-Sector Azimuth Dimensioning:
   - Automatically distributes 3-sector cells at 0°, 120°, 240° and 2-sector at 60°, 240°.
"""

import math
import re
import uuid
from typing import List, Dict, Any, Optional, Tuple


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371000.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2.0) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2.0) ** 2)
    return 2.0 * R * math.asin(math.sqrt(max(0.0, min(1.0, a))))


def map_channel_to_rf(tech: str, channel: int) -> Tuple[float, str, float, str]:
    """
    Translates radio technology and ARFCN / UARFCN / EARFCN channel into:
    (freq_mhz, band_label, bandwidth_mhz, standard_tech)
    """
    tech_upper = (tech or "").strip().upper()

    if tech_upper == "GSM":
        # Standard GSM 900: ARFCN 1 - 124, 0, 975 - 1023
        if channel <= 124 or channel >= 975:
            return 900.0, "B8 (900 MHz)", 10.0, "2G"
        # GSM 1800 (DCS): ARFCN 512 - 885
        elif 512 <= channel <= 885:
            return 1800.0, "B3 (1800 MHz)", 10.0, "2G"
        else:
            return 900.0, "B8 (900 MHz)", 10.0, "2G"

    elif tech_upper == "UMTS":
        # 3GPP TS 25.101 Band 1 (2100 MHz): UARFCN 10562 - 10838
        if channel and channel > 5000:
            return 2100.0, "B1 (2100 MHz 3G)", 5.0, "3G"
        # Band 8 (900 MHz): UARFCN 2937 - 3088
        else:
            return 900.0, "B8 (900 MHz 3G)", 5.0, "3G"

    elif tech_upper == "LTE":
        # 3GPP TS 36.101 EARFCN Mapping for Indian Spectrum:
        # Band 1: EARFCN 0 - 599 (2100 MHz FDD)
        if 0 <= channel <= 599:
            return 2100.0, "B1 (2100 MHz)", 10.0, "4G"
        # Band 3: EARFCN 1200 - 1949 (1800 MHz FDD)
        elif 1200 <= channel <= 1949:
            return 1800.0, "B3 (1800 MHz)", 15.0, "4G"
        # Band 5: EARFCN 2400 - 2649 (850 MHz FDD - Jio Low Band)
        elif 2400 <= channel <= 2649:
            return 850.0, "B5 (850 MHz)", 10.0, "4G"
        # Band 8: EARFCN 3450 - 3799 (900 MHz FDD - Vi / Airtel 900 LTE)
        elif 3450 <= channel <= 3799:
            return 900.0, "B8 (900 MHz)", 10.0, "4G"
        # Band 28: EARFCN 9210 - 9659 (700 MHz FDD - BSNL 4G TCS Rollout)
        elif 9210 <= channel <= 9659:
            return 700.0, "B28 (700 MHz)", 10.0, "4G"
        # Band 40: EARFCN 38650 - 39649 (2300 MHz TDD - Jio 2300)
        elif 38650 <= channel <= 39649:
            return 2300.0, "B40 (2300 MHz)", 20.0, "4G TDD"
        # Band 41: EARFCN 39650 - 41589 (2500 MHz TDD - BSNL / Vi 2500)
        elif 39650 <= channel <= 41589:
            return 2500.0, "B41 (2500 MHz)", 20.0, "4G TDD"
        else:
            return 1800.0, "B3 (1800 MHz)", 15.0, "4G"

    return 1800.0, "B3 (1800 MHz)", 10.0, "4G"


def map_mcc_mnc_to_operator(mcc: Optional[int], mnc: Optional[int]) -> str:
    """
    Maps Indian Mobile Country Code (404/405) and Mobile Network Code to Operator.
    """
    if mcc not in (404, 405):
        return "Other"

    # BSNL Mobile (Tamil Nadu / Chennai circles & national)
    if mcc == 404 and mnc in {80, 94, 64, 71, 72, 73, 74, 75, 76, 77, 81}:
        return "BSNL"
    if mcc == 405 and mnc in range(25, 48):
        return "BSNL"

    # Reliance Jio Infocomm (MCC 405, MNC 850-875)
    if mcc == 405 and (850 <= (mnc or 0) <= 875):
        return "Jio"

    # Vodafone Idea (Vi)
    vi_mncs = {4, 7, 12, 14, 15, 20, 27, 43, 46, 84, 86, 88}
    if mcc == 404 and mnc in vi_mncs:
        return "Vi"

    # Bharti Airtel
    airtel_mncs = {2, 3, 5, 9, 10, 16, 31, 45, 49, 70, 90, 92, 93, 95, 96, 97, 98}
    if mcc == 404 and mnc in airtel_mncs:
        return "Airtel"

    return "BSNL" if mnc in (80, 94) else "Other"


def clean_location_string(raw_loc: Optional[str]) -> str:
    if not raw_loc or raw_loc.strip() in ("", "-"):
        return ""
    # Strip plus codes like "WJVF+X4X," or distance errors "(± 9925 m)"
    cleaned = re.sub(r'\(±.*?\)', '', raw_loc)
    cleaned = re.sub(r'^[A-Z0-9]{4}\+[A-Z0-9]{3,5},?\s*', '', cleaned)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip(' ,-')
    return cleaned


def parse_netmonster_data(
    raw_items: List[Dict[str, Any]],
    baseline_towers: Optional[List[Any]] = None,
    snap_to_baseline: bool = True,
    snap_radius_m: float = 1200.0,
) -> Dict[str, Any]:
    """
    Parses NetMonster JSON array of cells, clusters them by physical site,
    snaps them to TarangSanchar baseline towers if within snap_radius_m,
    and returns created/enriched tower dictionaries.
    """
    # 1. Filter out unlocated dummy cells (2.147483647E9 is Android integer-max placeholder)
    valid_cells = []
    for item in raw_items:
        lat = item.get("latitude")
        lng = item.get("longitude")
        if lat is not None and lng is not None and -90.0 < float(lat) < 90.0 and -180.0 < float(lng) < 180.0:
            valid_cells.append(item)

    if not valid_cells:
        return {
            "total_items": len(raw_items),
            "valid_cells": 0,
            "towers": [],
            "stats": {},
        }

    # 2. Cluster cells into physical sites (within ~65 meters of each other)
    clusters: List[Dict[str, Any]] = []
    for cell in valid_cells:
        clat = float(cell["latitude"])
        clng = float(cell["longitude"])

        matched_cluster = None
        for cluster in clusters:
            d = haversine_m(clat, clng, cluster["lat"], cluster["lng"])
            if d < 65.0:
                matched_cluster = cluster
                break

        if matched_cluster:
            matched_cluster["cells"].append(cell)
        else:
            clusters.append({
                "lat": clat,
                "lng": clng,
                "location": cell.get("location") or "",
                "cells": [cell],
            })

    # 3. Process clusters and perform baseline snapping
    snapped_count = 0
    new_field_count = 0
    generated_towers: List[Dict[str, Any]] = []

    for cluster in clusters:
        site_lat = cluster["lat"]
        site_lng = cluster["lng"]
        raw_loc = cluster.get("location") or ""
        clean_loc = clean_location_string(raw_loc)

        snapped = False
        snapped_tower_id = None
        site_id = None
        tower_type = "Rooftop" if "rooftop" in raw_loc.lower() else "Ground"
        source_tag = "netmonster_verified"

        # Check if cluster is close to any TarangSanchar baseline tower
        if snap_to_baseline and baseline_towers:
            best_dist = float("inf")
            best_baseline = None
            for bt in baseline_towers:
                # Support both ORM object and tuple
                bt_lat = bt.lat if hasattr(bt, "lat") else bt[2]
                bt_lng = bt.lng if hasattr(bt, "lng") else bt[3]
                d = haversine_m(site_lat, site_lng, bt_lat, bt_lng)
                if d < best_dist:
                    best_dist = d
                    best_baseline = bt

            if best_baseline and best_dist <= snap_radius_m:
                snapped = True
                snapped_count += 1
                bt_id = best_baseline.id if hasattr(best_baseline, "id") else best_baseline[0]
                bt_name = best_baseline.name if hasattr(best_baseline, "name") else best_baseline[1]
                bt_lat = best_baseline.lat if hasattr(best_baseline, "lat") else best_baseline[2]
                bt_lng = best_baseline.lng if hasattr(best_baseline, "lng") else best_baseline[3]
                bt_site_id = best_baseline.site_id if hasattr(best_baseline, "site_id") else best_baseline[7]
                bt_type = best_baseline.tower_type if hasattr(best_baseline, "tower_type") else best_baseline[8]

                # Snap to 100% exact TarangSanchar baseline coordinates!
                site_lat = float(bt_lat)
                site_lng = float(bt_lng)
                site_id = bt_site_id or f"SITE-{bt_name}"
                tower_type = bt_type or tower_type
                snapped_tower_id = bt_id
                source_tag = "import_enriched"

        if not snapped:
            new_field_count += 1
            if not clean_loc:
                clean_loc = f"Field Site ({site_lat:.4f}, {site_lng:.4f})"
            slug = re.sub(r'[^a-zA-Z0-9]', '_', clean_loc)[:25].strip('_')
            site_id = f"SITE-NM-{slug}-{abs(hash(f'{site_lat:.4f}{site_lng:.4f}')) % 10000}"

        # 4. Dimension cells within the cluster (assign azimuths & frequencies)
        # Group by (operator, band) to allocate sector azimuths (0, 120, 240)
        op_band_cells: Dict[Tuple[str, float], List[Dict[str, Any]]] = {}

        for cell in cluster["cells"]:
            net = cell.get("network") or {}
            mcc = net.get("mcc")
            mnc = net.get("mnc")
            op = map_mcc_mnc_to_operator(mcc, mnc)
            tech = cell.get("technology") or "LTE"
            channel = cell.get("frequency") or 0

            freq_mhz, band_label, bw_mhz, tech_display = map_channel_to_rf(tech, channel)
            key = (op, freq_mhz)
            if key not in op_band_cells:
                op_band_cells[key] = []
            op_band_cells[key].append({
                "cell": cell,
                "op": op,
                "tech": tech_display,
                "freq_mhz": freq_mhz,
                "band_label": band_label,
                "bandwidth_mhz": bw_mhz,
            })

        for (op, freq_mhz), cell_entries in op_band_cells.items():
            num_sectors = len(cell_entries)
            # Sector azimuth presets
            if num_sectors == 1:
                azimuths = [None] # Omni
            elif num_sectors == 2:
                azimuths = [60.0, 240.0]
            elif num_sectors == 3:
                azimuths = [0.0, 120.0, 240.0]
            elif num_sectors == 4:
                azimuths = [0.0, 90.0, 180.0, 270.0]
            else:
                step = 360.0 / num_sectors
                azimuths = [round(i * step, 1) for i in range(num_sectors)]

            for idx, entry in enumerate(cell_entries):
                c = entry["cell"]
                cid = str(c.get("cid")) if c.get("cid") is not None else None
                pci = c.get("code")

                # Realistic power based on tech & frequency
                if entry["tech"] == "5G":
                    power_dbm = 46.0
                elif entry["tech"] in ("4G", "4G TDD"):
                    power_dbm = 43.0
                elif entry["tech"] == "3G":
                    power_dbm = 43.0
                else: # 2G
                    power_dbm = 43.0

                height_m = 32.0 if tower_type == "Ground" else 22.0
                azimuth = azimuths[idx] if idx < len(azimuths) else None

                name_label = clean_loc or "Site"
                cell_name = f"{name_label} - {entry['op']} {entry['band_label']}"
                if cid:
                    cell_name += f" (CID {cid})"

                pci_val = str(c.get("code")) if c.get("code") is not None else None
                area_val = str(c.get("area")) if c.get("area") is not None else None
                chan_val = float(c.get("frequency")) if c.get("frequency") is not None else None

                tower_dict = {
                    "id": str(uuid.uuid4()),
                    "name": cell_name,
                    "lat": site_lat,
                    "lng": site_lng,
                    "freq_mhz": entry["freq_mhz"],
                    "technology": entry["tech"],
                    "bandwidth_mhz": entry["bandwidth_mhz"],
                    "operator": entry["op"],
                    "height_m": height_m,
                    "power_dbm": power_dbm,
                    "tower_type": tower_type,
                    "azimuth_deg": azimuth,
                    "source": source_tag,
                    "cell_id": cid,
                    "site_id": site_id,
                    "pci": pci_val,
                    "area": area_val,
                    "channel": chan_val,
                    "location_name": clean_loc,
                }
                generated_towers.append(tower_dict)

    # Compile summary statistics
    operators_count: Dict[str, int] = {}
    technologies_count: Dict[str, int] = {}
    bands_set = set()

    for t in generated_towers:
        op = t["operator"] or "Unknown"
        tech = t["technology"] or "Unknown"
        operators_count[op] = operators_count.get(op, 0) + 1
        technologies_count[tech] = technologies_count.get(tech, 0) + 1
        bands_set.add(f"{t['freq_mhz']} MHz ({tech})")

    return {
        "total_items": len(raw_items),
        "valid_cells": len(valid_cells),
        "clusters_count": len(clusters),
        "snapped_to_baseline_count": snapped_count,
        "new_field_sites_count": new_field_count,
        "towers_generated": len(generated_towers),
        "operators": operators_count,
        "technologies": technologies_count,
        "bands": sorted(list(bands_set)),
        "towers": generated_towers,
    }


def parse_ntm_text(
    raw_text: str,
    baseline_towers: Optional[List[Any]] = None,
    snap_to_baseline: bool = True,
    snap_radius_m: float = 1200.0,
) -> Dict[str, Any]:
    """
    Parses NetMonster native semicolon-delimited `.ntm` file:
    tech;mcc;mnc;cid;area;rnc_enb;code;lat;lng;location;frequency
    """
    raw_items = []
    lines = raw_text.splitlines()
    for line in lines:
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = [p.strip() for p in line.split(";")]
        if len(parts) < 7:
            continue
        tech_raw = parts[0]
        mcc_raw = parts[1] if len(parts) > 1 else ""
        mnc_raw = parts[2] if len(parts) > 2 else ""
        cid_raw = parts[3] if len(parts) > 3 else ""
        area_raw = parts[4] if len(parts) > 4 else ""
        rnc_raw = parts[5] if len(parts) > 5 else ""
        code_raw = parts[6] if len(parts) > 6 else ""
        lat_raw = parts[7] if len(parts) > 7 else ""
        lng_raw = parts[8] if len(parts) > 8 else ""
        loc_raw = parts[9] if len(parts) > 9 else ""
        freq_raw = parts[10] if len(parts) > 10 else ""

        if not lat_raw or not lng_raw:
            continue
        try:
            lat = float(lat_raw)
            lng = float(lng_raw)
            if not (-90.0 < lat < 90.0 and -180.0 < lng < 180.0):
                continue
        except ValueError:
            continue

        try:
            mcc = int(mcc_raw) if mcc_raw else None
            mnc = int(mnc_raw) if mnc_raw else None
        except ValueError:
            mcc, mnc = None, None

        try:
            cid = int(cid_raw) if cid_raw else None
        except ValueError:
            cid = None

        try:
            area = int(area_raw) if area_raw else None
        except ValueError:
            area = None

        try:
            code = int(code_raw) if code_raw else None
        except ValueError:
            code = None

        try:
            freq = int(freq_raw) if freq_raw else 0
        except ValueError:
            freq = 0

        # Standardize technology identifier
        tech_norm = tech_raw.upper()
        if tech_norm == "2G":
            tech_norm = "GSM"
        elif tech_norm == "3G":
            tech_norm = "UMTS"
        elif tech_norm == "4G":
            tech_norm = "LTE"
        elif tech_norm == "5G":
            tech_norm = "NR"

        raw_items.append({
            "technology": tech_norm,
            "network": {"mcc": mcc, "mnc": mnc},
            "cid": cid,
            "area": area,
            "code": code,
            "latitude": lat,
            "longitude": lng,
            "location": loc_raw,
            "frequency": freq,
        })

    return parse_netmonster_data(
        raw_items,
        baseline_towers=baseline_towers,
        snap_to_baseline=snap_to_baseline,
        snap_radius_m=snap_radius_m,
    )
