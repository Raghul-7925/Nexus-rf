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
from districts import get_district_bounds, generate_district_slides


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
    Sweeps district slides asynchronously, captures cellular tower coordinates & types,
    persists directly to database, and handles session expiration and retries safely.
    """

    def __init__(self):
        self.is_running: bool = False
        self.is_paused: bool = False
        self.current_state: Optional[str] = None
        self.current_district: Optional[str] = None
        self.current_slide_idx: int = 0
        self.total_slides: int = 0
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

    def get_stored_session_cookie(self) -> Optional[str]:
        if self.active_cookie_header:
            return self.active_cookie_header
        with SessionLocal() as db:
            s = db.query(WorkerSession).filter(WorkerSession.is_valid == True).first()
            if s:
                self.active_cookie_header = s.cookie_header
                return s.cookie_header
        return None

    def _parse_single_item(self, item: Any, state: str, district: str, category: Optional[str] = None) -> Optional[Dict[str, Any]]:
        if not isinstance(item, dict):
            return None

        props = item.get("attributes") or item.get("properties") or item
        geom = item.get("geometry") or {}

        lat = props.get("location_latitude") or props.get("latitude") or props.get("Latitude") or props.get("lat") or props.get("Lat")
        lng = props.get("location_longitude") or props.get("longitude") or props.get("Longitude") or props.get("lng") or props.get("Lng")

        # Check for geometry coordinates or x, y
        coords = geom.get("coordinates")
        if coords and len(coords) >= 2:
            lng, lat = coords[0], coords[1]
        elif (lat is None or lng is None) and "y" in props and "x" in props:
            try:
                x_val, y_val = float(props["x"]), float(props["y"])
                if abs(x_val) > 180 or abs(y_val) > 90:
                    lat, lng = web_mercator_to_wgs84(x_val, y_val)
                else:
                    lat, lng = y_val, x_val
            except (ValueError, TypeError):
                pass

        if lat is None or lng is None:
            return None

        try:
            lat = float(lat)
            lng = float(lng)
        except (ValueError, TypeError):
            return None

        if not (6.0 <= lat <= 38.0 and 68.0 <= lng <= 98.0):
            return None

        sid = (
            props.get("url_point") or props.get("SiteId") or props.get("Site_Id")
            or props.get("SITE_ID") or props.get("id") or props.get("location_id")
            or f"TS_{lat:.5f}_{lng:.5f}"
        )
        sid = str(sid).strip()

        raw_type = props.get("Tower_Type") or props.get("TOWER_TYPE") or props.get("SiteType") or props.get("site_type") or props.get("type")
        cat = category or props.get("category")
        ttype, color = normalize_tower_type_and_color(raw_type, cat)

        city = (
            props.get("city") or props.get("City") or props.get("location") or props.get("Location")
            or props.get("address") or props.get("site_address") or props.get("area") or props.get("town") or district
        )

        return {
            "site_id": sid,
            "latitude": round(lat, 6),
            "longitude": round(lng, 6),
            "tower_type": ttype,
            "color_code": color,
            "city": str(city).strip(),
            "state": state,
            "district": district
        }

    def parse_payload(self, data: Any, state: str, district: str) -> List[Dict[str, Any]]:
        """Parse Tarang Sanchar GetLocations JSON payload into standard tower dicts."""
        sites: List[Dict[str, Any]] = []

        if not data:
            return sites

        # 1. Tarang Sanchar Category Grouped structure:
        # [ { "Cinema": [ ... ], "Shop": [ ... ], "Cafe": [ ... ] } ]
        if isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict):
            for group in data:
                if any(k in group for k in ["Shop", "Cinema", "Club", "Cafe", "Tower", "Ground"]):
                    for cat, items in group.items():
                        if isinstance(items, list):
                            for item in items:
                                s = self._parse_single_item(item, state, district, category=cat)
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

    async def run_sweep(self, state: str, district: str):
        """Execute automated slide sweep across the selected district."""
        self.is_running = True
        self.is_paused = False
        self.current_state = state
        self.current_district = district

        cookie = self.get_stored_session_cookie()
        if not cookie:
            self.log("⚠️ No active session cookie found! Please sync session from Chrome extension first.", "WARN")
            self.is_running = False
            return

        bounds = get_district_bounds(state, district)
        if not bounds:
            self.log(f"❌ District {district} ({state}) bounds not found in database.", "ERROR")
            self.is_running = False
            return

        slides = generate_district_slides(bounds)
        self.total_slides = len(slides)
        self.current_slide_idx = 0
        self.sites_captured_this_session = 0

        self.log(f"🚀 Starting autonomous sweep for {district}, {state}: {self.total_slides} slides.", "INFO")

        # Create or update job in DB
        with SessionLocal() as db:
            job = WorkerJob(
                state_name=state,
                district_name=district,
                status="running",
                total_slides=self.total_slides,
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
            for idx, slide in enumerate(slides):
                while self.is_paused:
                    await asyncio.sleep(1.0)
                    if not self.is_running:
                        break

                if not self.is_running:
                    self.log(f"⏹ Sweep stopped at slide {idx}/{self.total_slides}.", "INFO")
                    break

                self.current_slide_idx = idx + 1
                sw_lat, ne_lat = slide["swLat"], slide["neLat"]
                sw_lng, ne_lng = slide["swLng"], slide["neLng"]

                url = f"https://tarangsanchar.gov.in/EMFPortal/SiteFinder/GetLocations?NELat={ne_lat}&SWLat={sw_lat}&NELng={ne_lng}&SWLng={sw_lng}&_={int(time.time()*1000)}"

                retries = 3
                success = False
                while retries > 0 and not success and self.is_running:
                    try:
                        resp = await client.get(url, headers=headers)
                        if resp.status_code == 200:
                            text = resp.text.strip()
                            if "Session Expired" in text:
                                self.log(f"⚠️ Tarang Sanchar Session Expired at slide {self.current_slide_idx}! Pausing worker.", "WARN")
                                self.is_paused = True
                                with SessionLocal() as db:
                                    s = db.query(WorkerSession).first()
                                    if s:
                                        s.is_valid = False
                                        db.commit()
                                    j = db.query(WorkerJob).filter(WorkerJob.id == job_id).first()
                                    if j:
                                        j.status = "paused_session_expired"
                                        j.error_message = "Session expired on Tarang Sanchar"
                                        db.commit()
                                break

                            data = resp.json()
                            sites = self.parse_payload(data, state, district)
                            success = True

                            # Save to database with deduplication
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
                                            # Update city/type if empty
                                            if not existing.city and s.get("city"):
                                                existing.city = s.get("city")
                                            if existing.tower_type != s["tower_type"]:
                                                existing.tower_type = s["tower_type"]
                                                existing.color_code = s.get("color_code", "Blue")
                                    db.commit()
                                    self.sites_captured_this_session += added_count
                                    if added_count > 0:
                                        self.log(f"Slide {self.current_slide_idx}/{self.total_slides}: captured {len(sites)} sites (+{added_count} new). Total: {self.sites_captured_this_session}", "INFO")

                            # Update job progress in DB every 5 slides
                            if (self.current_slide_idx % 5 == 0) or (self.current_slide_idx == self.total_slides):
                                with SessionLocal() as db:
                                    j = db.query(WorkerJob).filter(WorkerJob.id == job_id).first()
                                    if j:
                                        j.current_slide = self.current_slide_idx
                                        j.sites_captured = self.sites_captured_this_session
                                        db.commit()

                        else:
                            self.log(f"HTTP {resp.status_code} on slide {slide['id']}. Retrying...", "WARN")
                            retries -= 1
                            await asyncio.sleep(1.0)
                    except Exception as err:
                        retries -= 1
                        if retries == 0:
                            self.log(f"Failed slide {slide['id']}: {err}", "ERROR")
                        await asyncio.sleep(1.5)

                # Polite delay with jitter (200ms - 400ms) to ensure smooth cloud execution without WAF triggering
                await asyncio.sleep(random.uniform(0.20, 0.40))

        # Sweep finished
        self.is_running = False
        with SessionLocal() as db:
            j = db.query(WorkerJob).filter(WorkerJob.id == job_id).first()
            if j:
                j.current_slide = self.current_slide_idx
                j.sites_captured = self.sites_captured_this_session
                j.status = "completed" if self.current_slide_idx >= self.total_slides else "stopped"
                j.completed_at = datetime.utcnow()
                db.commit()

        self.log(f"🎉 District sweep finished for {district}, {state}! Total captured: {self.sites_captured_this_session} sites.", "INFO")

    def start_sweep(self, state: str, district: str):
        if self.is_running:
            self.stop()
        self._task = asyncio.create_task(self.run_sweep(state, district))

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
