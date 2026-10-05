import asyncio
import math
import random
import re
import time
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
import httpx
from sqlalchemy.orm import Session

from db import SessionLocal, CapturedSite, WorkerJob, WorkerLog, WorkerSession
from districts import (
    get_district_bounds,
    generate_district_slides,
    get_all_india_queue,
    get_state_districts_queue
)


def web_mercator_to_wgs84(x: float, y: float) -> Tuple[float, float]:
    """Convert EPSG:3857 (Web Mercator) to WGS84 lat, lng."""
    lng = (x / 20037508.34) * 180.0
    lat = (y / 20037508.34) * 180.0
    lat = (180.0 / math.pi) * (2 * math.atan(math.exp((lat * math.pi) / 180.0)) - math.pi / 2)
    return round(lat, 6), round(lng, 6)


def normalize_tower_type_and_color(raw: Optional[str] = None, category: Optional[str] = None) -> Tuple[str, str]:
    """
    Returns (tower_type, color_code).
    Mapped directly from Tarang Sanchar map color codes:
    🔵 Blue: Rooftop Tower (RTT) / Building Mount (Cinema, Theatre, Mall, Multiplex, Club)
    🟢 Green: Ground Based Tower (GBT) / Mast (Shop, Ground, Tower, Hotel, School)
    🩷 Pink: Wall Mount / Pole (Cafe, Restaurant, Wall, Pole)
    🟠 Orange: COW (Cell on Wheels) / Temporary
    """
    if category:
        cat = str(category).strip().lower()
        if any(k in cat for k in ["cinema", "theatre", "theater", "mall", "multiplex", "club", "roof", "rtt"]):
            return "Rooftop (Blue)", "Blue"
        if any(k in cat for k in ["shop", "ground", "hotel", "school", "tower", "mast", "gbt", "gbm"]):
            return "Ground Based (Green)", "Green"
        if any(k in cat for k in ["cafe", "restaurant", "wall", "pole", "wmt", "micro"]):
            return "Wall Mount (Pink)", "Pink"
        if any(k in cat for k in ["cow", "wheel", "temp"]):
            return "COW (Orange)", "Orange"

    if raw and isinstance(raw, str):
        val = raw.strip().upper()
        if any(k in val for k in ["GBT", "GROUND", "MAST", "GREEN"]):
            return "Ground Based (Green)", "Green"
        if any(k in val for k in ["RTT", "ROOF", "BUILDING", "BLUE"]):
            return "Rooftop (Blue)", "Blue"
        if any(k in val for k in ["WALL", "POLE", "WMT", "PINK"]):
            return "Wall Mount (Pink)", "Pink"
        if any(k in val for k in ["COW", "WHEEL", "ORANGE"]):
            return "COW (Orange)", "Orange"

    return "Rooftop (Blue)", "Blue"


def normalize_tower_type(raw: Optional[str], category: Optional[str] = None) -> str:
    ttype, _ = normalize_tower_type_and_color(raw, category)
    return ttype


class TarangScraperWorker:
    """
    Autonomous Cloud Scraper for Tarang Sanchar.
    Sweeps slides across India asynchronously, captures cellular tower coordinates & types,
    persists directly to database, automatically advances district-by-district across the country,
    and handles session expiration and retries safely.
    """

    def __init__(self):
        self.is_running: bool = False
        self.is_paused: bool = False
        self.is_all_india: bool = False
        self.current_state: Optional[str] = None
        self.current_district: Optional[str] = None
        self.current_slide_idx: int = 0
        self.total_slides: int = 0
        self.queue_index: int = 0
        self.total_districts_in_queue: int = 0
        self.sites_captured_this_session: int = 0
        self.active_cookie_header: Optional[str] = None
        self._task: Optional[asyncio.Task] = None
        self.recent_logs: List[Dict[str, Any]] = []

    def log(self, message: str, level: str = "INFO"):
        entry = {
            "time": datetime.utcnow().strftime("%H:%M:%S"),
            "level": level,
            "message": message
        }
        self.recent_logs.append(entry)
        if len(self.recent_logs) > 200:
            self.recent_logs.pop(0)

        # Write to db
        try:
            with SessionLocal() as db:
                db_log = WorkerLog(level=level, message=message)
                db.add(db_log)
                db.commit()
        except Exception:
            pass

    def set_session_cookie(self, cookie_header: str):
        self.active_cookie_header = cookie_header.strip()
        self.log(f"Active session cookie set ({len(cookie_header)} chars).", "INFO")
        with SessionLocal() as db:
            s = db.query(WorkerSession).first()
            if not s:
                s = WorkerSession(cookie_header=self.active_cookie_header, is_valid=True)
                db.add(s)
            else:
                s.cookie_header = self.active_cookie_header
                s.is_valid = True
                s.updated_at = datetime.utcnow()
            db.commit()

        # If worker was paused waiting for a valid session, auto-resume!
        if self.is_paused and self.is_running:
            self.log("🔄 Valid session received! Automatically resuming sweep...", "INFO")
            self.is_paused = False

    def get_stored_session_cookie(self) -> Optional[str]:
        if self.active_cookie_header:
            return self.active_cookie_header
        with SessionLocal() as db:
            s = db.query(WorkerSession).filter(WorkerSession.is_valid == True).first()
            if s:
                self.active_cookie_header = s.cookie_header
                return self.active_cookie_header
        return None

    def _parse_single_item(self, item: Dict[str, Any], state: str, district: str, category: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Parse raw record from Tarang Sanchar and extract strictly required fields."""
        if not isinstance(item, dict):
            return None

        # Extract coordinates
        lat = None
        lng = None

        # Direct WGS84
        for lat_k in ["Latitude", "latitude", "Lat", "lat", "LAT", "location_latitude", "locationLatitude", "loc_lat"]:
            if lat_k in item and item[lat_k] not in [None, ""]:
                try:
                    lat = float(item[lat_k])
                    break
                except (ValueError, TypeError):
                    pass

        for lng_k in ["Longitude", "longitude", "Lng", "lng", "Lon", "lon", "LONG", "location_longitude", "locationLongitude", "loc_lng"]:
            if lng_k in item and item[lng_k] not in [None, ""]:
                try:
                    lng = float(item[lng_k])
                    break
                except (ValueError, TypeError):
                    pass

        # Web Mercator projection (X/Y)
        if lat is None or lng is None:
            x_val = item.get("X") or item.get("x")
            y_val = item.get("Y") or item.get("y")
            if x_val and y_val:
                try:
                    fx, fy = float(x_val), float(y_val)
                    if abs(fx) > 180 or abs(fy) > 90:
                        lat, lng = web_mercator_to_wgs84(fx, fy)
                    else:
                        lat, lng = fy, fx
                except Exception:
                    pass

        # Fallback to GeoJSON geometry
        if (lat is None or lng is None) and "geometry" in item and isinstance(item["geometry"], dict):
            coords = item["geometry"].get("coordinates")
            if isinstance(coords, list) and len(coords) >= 2:
                try:
                    c0, c1 = float(coords[0]), float(coords[1])
                    if abs(c0) > 180 or abs(c1) > 90:
                        lat, lng = web_mercator_to_wgs84(c0, c1)
                    else:
                        lng, lat = c0, c1
                except Exception:
                    pass

        if lat is None or lng is None:
            return None

        # Verify Indian coordinate bounds (Lat: 6.0 to 38.0, Lng: 68.0 to 98.0)
        if not (6.0 <= lat <= 38.0 and 68.0 <= lng <= 98.0):
            return None

        # Extract site identifier
        site_id = None
        for id_k in ["SiteID", "SiteId", "siteId", "site_id", "ID", "id", "LocId", "LocationId"]:
            if id_k in item and item[id_k] not in [None, ""]:
                site_id = str(item[id_k]).strip()
                break

        if not site_id:
            site_id = f"SITE_{int(lat*10000)}_{int(lng*10000)}"

        # Tower type and color code
        raw_type = (
            item.get("TowerType") or item.get("tower_type") or item.get("Tower_Type") or
            item.get("Type") or item.get("type") or item.get("site_type") or item.get("SiteType")
        )
        cat_val = category or item.get("Category") or item.get("category") or item.get("TypeDescription")
        tower_type, color_code = normalize_tower_type_and_color(raw_type, cat_val)

        # City / Locality
        city = (
            item.get("City") or item.get("city") or
            item.get("Location") or item.get("location") or
            item.get("Address") or item.get("address") or
            item.get("District") or item.get("district") or
            district
        )
        if isinstance(city, str):
            city = city.strip()
        else:
            city = district

        return {
            "site_id": site_id,
            "latitude": round(lat, 6),
            "longitude": round(lng, 6),
            "tower_type": tower_type,
            "color_code": color_code,
            "city": city,
            "state": state,
            "district": district
        }

    def parse_payload(self, data: Any, state: str, district: str) -> List[Dict[str, Any]]:
        """Extract and normalize all towers from Tarang Sanchar response."""
        sites: List[Dict[str, Any]] = []

        if isinstance(data, str):
            try:
                import json
                data = json.loads(data)
            except Exception:
                return sites

        # 1. Category-grouped dictionary (Cinema, Shop, Cafe, COW, etc.)
        if isinstance(data, dict):
            for cat in ["Cinema", "Shop", "Cafe", "COW", "Hospital", "School", "Hotel", "Mall", "Office"]:
                if cat in data and isinstance(data[cat], list):
                    for item in data[cat]:
                        s = self._parse_single_item(item, state, district, category=cat)
                        if s:
                            sites.append(s)

            if not sites:
                for k, v in data.items():
                    if isinstance(v, list) and len(v) > 0 and isinstance(v[0], dict):
                        for item in v:
                            s = self._parse_single_item(item, state, district, category=k)
                            if s:
                                sites.append(s)
            if sites:
                return sites

        # 2. Table, Table1, features, data, or direct list
        records = []
        if isinstance(data, list):
            records = data
        elif isinstance(data, dict):
            if "Table" in data and isinstance(data["Table"], list):
                records = data["Table"]
            elif "Table1" in data and isinstance(data["Table1"], list):
                records = data["Table1"]
            elif "features" in data and isinstance(data["features"], list):
                for f in data["features"]:
                    s = self._parse_single_item(f, state, district)
                    if s:
                        sites.append(s)
                return sites
            elif "data" in data and isinstance(data["data"], list):
                records = data["data"]

        for item in records:
            s = self._parse_single_item(item, state, district)
            if s:
                sites.append(s)

        return sites

    async def _sweep_single_district(
        self,
        client: httpx.AsyncClient,
        state: str,
        district: str,
        headers: dict,
        job_id: int
    ):
        """Sweeps slides of one district, saving captured sites directly to DB."""
        self.current_state = state
        self.current_district = district

        bounds = get_district_bounds(state, district)
        if not bounds:
            self.log(f"⚠️ Bounds not found for {district} ({state}). Skipping.", "WARN")
            return

        slides = generate_district_slides(bounds)
        self.total_slides = len(slides)
        self.current_slide_idx = 0

        self.log(
            f"📍 Sweeping [{self.queue_index + 1}/{self.total_districts_in_queue}] "
            f"{district}, {state} ({self.total_slides} slides)...",
            "INFO"
        )

        for idx, slide in enumerate(slides):
            while self.is_paused and self.is_running:
                await asyncio.sleep(1.0)

            if not self.is_running:
                break

            self.current_slide_idx = idx + 1
            sw_lat, ne_lat = slide["swLat"], slide["neLat"]
            sw_lng, ne_lng = slide["swLng"], slide["neLng"]

            url = (
                f"https://tarangsanchar.gov.in/EMFPortal/SiteFinder/GetLocations"
                f"?NELat={ne_lat}&SWLat={sw_lat}&NELng={ne_lng}&SWLng={sw_lng}&_={int(time.time()*1000)}"
            )

            retries = 3
            success = False
            while retries > 0 and not success and self.is_running:
                # Update cookie from stored session if updated
                stored_cookie = self.get_stored_session_cookie()
                if stored_cookie:
                    headers["Cookie"] = stored_cookie

                try:
                    resp = await client.get(url, headers=headers)
                    if resp.status_code == 200:
                        text = resp.text.strip()
                        if "Session Expired" in text:
                            self.log(
                                f"⚠️ Tarang Sanchar Session Expired at [{district}, {state}] slide {self.current_slide_idx}! "
                                f"Pausing worker. Send active session to auto-resume.",
                                "WARN"
                            )
                            self.is_paused = True
                            with SessionLocal() as db:
                                s = db.query(WorkerSession).first()
                                if s:
                                    s.is_valid = False
                                    db.commit()
                                j = db.query(WorkerJob).filter(WorkerJob.id == job_id).first()
                                if j:
                                    j.status = "paused_session_expired"
                                    j.error_message = f"Session expired at {district}, slide {self.current_slide_idx}"
                                    db.commit()
                            # Wait until resumed
                            while self.is_paused and self.is_running:
                                await asyncio.sleep(1.0)
                            if not self.is_running:
                                break
                            continue

                        data = resp.json()
                        sites = self.parse_payload(data, state, district)
                        success = True

                        if sites:
                            with SessionLocal() as db:
                                added_count = 0
                                for s in sites:
                                    existing = db.query(CapturedSite).filter(CapturedSite.site_id == s["site_id"]).first()
                                    if not existing:
                                        new_site = CapturedSite(
                                            site_id=s["site_id"],
                                            latitude=s["latitude"],
                                            longitude=s["longitude"],
                                            tower_type=s["tower_type"],
                                            color_code=s.get("color_code", "Blue"),
                                            city=s.get("city", district),
                                            state=state,
                                            district=district
                                        )
                                        db.add(new_site)
                                        added_count += 1
                                    else:
                                        if not existing.city and s.get("city"):
                                            existing.city = s.get("city")
                                        if existing.tower_type != s["tower_type"]:
                                            existing.tower_type = s["tower_type"]
                                            existing.color_code = s.get("color_code", "Blue")
                                db.commit()
                                self.sites_captured_this_session += added_count
                                if added_count > 0:
                                    self.log(
                                        f"[{district}] Slide {self.current_slide_idx}/{self.total_slides}: "
                                        f"+{added_count} new towers (Total captured: {self.sites_captured_this_session})",
                                        "INFO"
                                    )

                        # Update DB job progress
                        if (self.current_slide_idx % 5 == 0) or (self.current_slide_idx == self.total_slides):
                            with SessionLocal() as db:
                                j = db.query(WorkerJob).filter(WorkerJob.id == job_id).first()
                                if j:
                                    j.current_slide = self.current_slide_idx
                                    j.sites_captured = self.sites_captured_this_session
                                    db.commit()

                    else:
                        retries -= 1
                        await asyncio.sleep(1.0)
                except Exception as err:
                    retries -= 1
                    if retries == 0:
                        self.log(f"Slide error ({district}): {err}", "ERROR")
                    await asyncio.sleep(1.5)

            # Jittered polite delay
            await asyncio.sleep(random.uniform(0.20, 0.35))

    async def run_multi_district_sweep(self, queue: List[Tuple[str, str]], is_all_india: bool = False):
        """
        Execute fully autonomous sequential sweep across an entire queue of districts
        (e.g., all districts in a state, or all districts across full India).
        """
        self.is_running = True
        self.is_paused = False
        self.is_all_india = is_all_india
        self.total_districts_in_queue = len(queue)
        self.sites_captured_this_session = 0

        cookie = self.get_stored_session_cookie()
        if not cookie:
            self.log("⚠️ No active session cookie found! Please sync session from Chrome extension first.", "WARN")
            self.is_running = False
            return

        mode_name = "🇮🇳 ALL INDIA FULL SWEEP" if is_all_india else f"MULTI-DISTRICT SWEEP ({len(queue)} districts)"
        self.log(f"🚀 Starting {mode_name}: {len(queue)} total districts queued!", "INFO")

        # Create WorkerJob in DB
        with SessionLocal() as db:
            job = WorkerJob(
                state_name="All India" if is_all_india else queue[0][0],
                district_name=f"{len(queue)} districts",
                status="running",
                total_slides=len(queue) * 40,
                current_slide=0,
                sites_captured=0
            )
            db.add(job)
            db.commit()
            job_id = job.id

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://tarangsanchar.gov.in/EMFPortal/SiteFinder",
            "X-Requested-With": "XMLHttpRequest",
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "Cookie": cookie
        }

        async with httpx.AsyncClient(timeout=20.0, verify=False) as client:
            for q_idx, (state, district) in enumerate(queue):
                if not self.is_running:
                    self.log(f"⏹ Sweep stopped at district {q_idx + 1}/{len(queue)}.", "INFO")
                    break

                self.queue_index = q_idx
                await self._sweep_single_district(client, state, district, headers, job_id)
                self.log(
                    f"✅ Completed district [{q_idx + 1}/{len(queue)}] {district}, {state}. "
                    f"Advancing automatically to next district...",
                    "INFO"
                )

        # Full sweep finished
        self.is_running = False
        with SessionLocal() as db:
            j = db.query(WorkerJob).filter(WorkerJob.id == job_id).first()
            if j:
                j.sites_captured = self.sites_captured_this_session
                j.status = "completed" if self.queue_index >= len(queue) - 1 else "stopped"
                j.completed_at = datetime.utcnow()
                db.commit()

        self.log(
            f"🏆 Full sweep finished! Total districts swept: {self.queue_index + 1}/{len(queue)}. "
            f"Total towers captured: {self.sites_captured_this_session}.",
            "INFO"
        )

    def start_sweep(self, state: str, district: str):
        if self.is_running:
            self.stop()

        # Decide whether single district, single state all districts, or full India
        if state in ["All India", "All India (Entire Country)"] or district.startswith("All Districts (Full Country"):
            queue = get_all_india_queue()
            self.is_all_india = True
            self.total_districts_in_queue = len(queue)
            self._task = asyncio.create_task(self.run_multi_district_sweep(queue, is_all_india=True))
        elif district.startswith("All Districts in ") or district.startswith("All Districts"):
            queue = get_state_districts_queue(state)
            self.is_all_india = False
            self.total_districts_in_queue = len(queue)
            self._task = asyncio.create_task(self.run_multi_district_sweep(queue, is_all_india=False))
        else:
            queue = [(state, district)]
            self.is_all_india = False
            self.total_districts_in_queue = 1
            self._task = asyncio.create_task(self.run_multi_district_sweep(queue, is_all_india=False))

    def start_all_india_sweep(self):
        """1-click full India autonomous sweep across all states and districts."""
        if self.is_running:
            self.stop()
        queue = get_all_india_queue()
        self.is_all_india = True
        self.total_districts_in_queue = len(queue)
        self._task = asyncio.create_task(self.run_multi_district_sweep(queue, is_all_india=True))

    def pause(self):
        self.is_paused = True
        self.log("Worker paused.", "INFO")

    def resume(self):
        self.is_paused = False
        self.log("Worker resumed.", "INFO")

    def stop(self):
        self.is_running = False
        self.is_paused = False
        if self._task and not self._task.done():
            self._task.cancel()
        self.log("Worker stopped.", "INFO")


# Global worker instance
worker_instance = TarangScraperWorker()
