import io
import csv
from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, Depends, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
import httpx

from db import init_db, get_db, CapturedSite, WorkerJob, WorkerSession, WorkerLog
from districts import get_states, get_districts_for_state, get_district_bounds
from scraper import worker_instance

app = FastAPI(
    title="Nexus RF — Tarang Sanchar Autonomous Cloud Worker",
    version="1.0.0",
    description="24/7 Cloud Background Microservice for Fast Cellular Tower Coordinates & Types Fetching"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event():
    init_db()
    # Check if existing session cookie in db
    worker_instance.get_stored_session_cookie()


class SessionPayload(BaseModel):
    cookie: Optional[str] = None
    cookies: Optional[List[Dict[str, Any]]] = None


class StartJobPayload(BaseModel):
    state: str
    district: str


class SyncNexusPayload(BaseModel):
    nexus_url: Optional[str] = "http://127.0.0.1:8000/api/import"


# --- REST API Endpoints ---

@app.post("/api/worker/session")
def set_session(payload: SessionPayload):
    cookie_str = ""
    if payload.cookie:
        cookie_str = payload.cookie.strip()
    elif payload.cookies:
        # Convert list of Chrome cookie objects
        parts = []
        for c in payload.cookies:
            if isinstance(c, dict) and "name" in c and "value" in c:
                parts.append(f"{c['name']}={c['value']}")
        cookie_str = "; ".join(parts)

    if not cookie_str:
        raise HTTPException(status_code=400, detail="Empty cookie provided")

    worker_instance.set_session_cookie(cookie_str)
    return {"success": True, "message": "Session cookie stored successfully"}


@app.get("/api/worker/session")
def get_session_status(db: Session = Depends(get_db)):
    sess = db.query(WorkerSession).first()
    if not sess:
        return {"has_session": False, "is_valid": False, "updated_at": None}
    return {
        "has_session": bool(sess.cookie_header),
        "is_valid": sess.is_valid,
        "updated_at": sess.updated_at.isoformat() if sess.updated_at else None
    }


@app.get("/api/worker/districts")
def get_districts_list():
    states = get_states()
    result = {}
    for s in states:
        result[s] = get_districts_for_state(s)
    return {"states": states, "districts": result}


@app.post("/api/worker/start")
def start_worker(payload: StartJobPayload):
    bounds = get_district_bounds(payload.state, payload.district)
    if not bounds:
        raise HTTPException(status_code=404, detail="District not found")

    cookie = worker_instance.get_stored_session_cookie()
    if not cookie:
        raise HTTPException(
            status_code=400,
            detail="No session cookie available. Please sync session from Chrome extension first."
        )

    worker_instance.start_sweep(payload.state, payload.district)
    return {
        "success": True,
        "message": f"Autonomous sweep started for {payload.district}, {payload.state}",
        "district": payload.district,
        "state": payload.state
    }


@app.post("/api/worker/pause")
def pause_worker():
    worker_instance.pause()
    return {"success": True, "is_paused": True}


@app.post("/api/worker/resume")
def resume_worker():
    worker_instance.resume()
    return {"success": True, "is_paused": False}


@app.post("/api/worker/stop")
def stop_worker():
    worker_instance.stop()
    return {"success": True, "is_running": False}


@app.get("/api/worker/status")
def get_worker_status(db: Session = Depends(get_db)):
    total_sites_count = db.query(CapturedSite).count()
    last_job = db.query(WorkerJob).order_by(WorkerJob.id.desc()).first()
    sess = db.query(WorkerSession).first()

    progress_pct = 0
    if worker_instance.total_slides > 0:
        progress_pct = round((worker_instance.current_slide_idx / worker_instance.total_slides) * 100, 1)

    return {
        "is_running": worker_instance.is_running,
        "is_paused": worker_instance.is_paused,
        "state": worker_instance.current_state,
        "district": worker_instance.current_district,
        "current_slide": worker_instance.current_slide_idx,
        "total_slides": worker_instance.total_slides,
        "progress_percent": progress_pct,
        "sites_captured_session": worker_instance.sites_captured_this_session,
        "total_sites_database": total_sites_count,
        "has_valid_session": bool(sess and sess.is_valid and sess.cookie_header),
        "recent_logs": worker_instance.recent_logs[-50:]
    }


@app.get("/api/worker/towers")
def get_captured_towers(
    state: Optional[str] = None,
    district: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    query = db.query(CapturedSite)
    if state:
        query = query.filter(CapturedSite.state == state)
    if district:
        query = query.filter(CapturedSite.district == district)

    total = query.count()
    items = query.order_by(CapturedSite.id.desc()).offset(offset).limit(limit).all()

    return {
        "total": total,
        "items": [
            {
                "site_id": i.site_id,
                "latitude": i.latitude,
                "longitude": i.longitude,
                "tower_type": i.tower_type,
                "color_code": getattr(i, "color_code", "Blue"),
                "city": getattr(i, "city", i.district),
                "state": i.state,
                "district": i.district,
                "updated_at": i.updated_at.isoformat() if i.updated_at else None
            }
            for i in items
        ]
    }


@app.get("/api/worker/export/csv")
def export_csv(
    state: Optional[str] = None,
    district: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Export raw towers CSV containing ONLY:
    site_id, latitude, longitude, tower_type, color_code, city
    No extra dummy data.
    """
    query = db.query(CapturedSite)
    if state:
        query = query.filter(CapturedSite.state == state)
    if district:
        query = query.filter(CapturedSite.district == district)

    sites = query.all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "site_id", "latitude", "longitude", "tower_type", "color_code", "city"
    ])

    for s in sites:
        city_name = getattr(s, "city", None) or s.district or state or "India"
        color = getattr(s, "color_code", None) or "Blue"
        ttype = s.tower_type or f"Rooftop ({color})"
        writer.writerow([
            s.site_id,
            f"{s.latitude:.6f}",
            f"{s.longitude:.6f}",
            ttype,
            color,
            city_name
        ])

    output.seek(0)
    filename = f"tarangsanchar_{district or state or 'towers'}_{datetime.utcnow().strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@app.post("/api/worker/sync-nexus")
async def sync_to_nexus_rf(payload: SyncNexusPayload, db: Session = Depends(get_db)):
    """Directly pushes captured towers to the Nexus RF engine /api/import endpoint."""
    sites = db.query(CapturedSite).all()
    if not sites:
        raise HTTPException(status_code=400, detail="No captured sites in database to sync")

    # Generate minimal CSV payload
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["site_id", "latitude", "longitude", "tower_type", "color_code", "city"])
    for s in sites:
        city_name = getattr(s, "city", None) or s.district or "India"
        color = getattr(s, "color_code", None) or "Blue"
        ttype = s.tower_type or f"Rooftop ({color})"
        writer.writerow([
            s.site_id,
            f"{s.latitude:.6f}",
            f"{s.longitude:.6f}",
            ttype,
            color,
            city_name
        ])

    csv_data = output.getvalue()

    url = payload.nexus_url or "http://127.0.0.1:8000/api/import"
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            files = {"file": ("cloud_towers.csv", csv_data, "text/csv")}
            data = {"source": "tarangsanchar"}
            resp = await client.post(url, files=files, data=data)
            if resp.status_code == 200:
                res_data = resp.json()
                return {
                    "success": True,
                    "count": len(sites),
                    "nexus_response": res_data,
                    "message": f"Successfully synced {len(sites)} sites to Nexus RF engine!"
                }
            else:
                return {
                    "success": False,
                    "error": f"Nexus RF responded with status {resp.status_code}: {resp.text}"
                }
    except Exception as e:
        return {"success": False, "error": f"Could not connect to Nexus RF at {url}: {str(e)}"}


# --- Web Dashboard UI (Served at root `/`) ---

@app.get("/", response_class=HTMLResponse)
def dashboard():
    return """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nexus RF — Autonomous Cloud Tower Fetcher</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    body { background-color: #0b0f19; color: #f3f4f6; font-family: ui-sans-serif, system-ui, sans-serif; }
    .glass-card { background: rgba(17, 24, 39, 0.7); backdrop-filter: blur(12px); border: 1px solid rgba(59, 130, 246, 0.2); }
    .terminal-window { background: #030712; font-family: ui-monospace, monospace; border: 1px solid #1f2937; }
  </style>
</head>
<body class="min-h-screen flex flex-col justify-between">
  <!-- Top Navigation -->
  <header class="border-b border-gray-800 bg-gray-900/60 sticky top-0 z-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <span class="p-2 bg-blue-600/20 text-blue-400 rounded-lg border border-blue-500/30 text-lg">
          <i class="fa-solid fa-satellite-dish"></i>
        </span>
        <div>
          <h1 class="text-base font-bold text-white flex items-center gap-2">
            Nexus RF <span class="text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded font-mono">Cloud Worker v1.0</span>
          </h1>
          <p class="text-xs text-gray-400">Autonomous 24/7 Tower Coordinate & Type Extractor</p>
        </div>
      </div>
      <div class="flex items-center space-x-3">
        <span id="session-badge" class="px-3 py-1 rounded-full text-xs font-medium bg-red-950 text-red-400 border border-red-800/50 flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span> No Session
        </span>
        <button onclick="openSessionModal()" class="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 transition">
          <i class="fa-solid fa-key mr-1"></i> Update Session
        </button>
      </div>
    </div>
  </header>

  <!-- Main Container -->
  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex-1 space-y-6">
    <!-- Top Stats Row -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div class="glass-card rounded-xl p-4">
        <div class="text-xs text-gray-400 mb-1 flex items-center justify-between">
          <span>Captured Sites (DB)</span>
          <i class="fa-solid fa-database text-blue-400"></i>
        </div>
        <div id="stat-total-sites" class="text-2xl font-extrabold text-blue-400 font-mono">0</div>
        <div class="text-[11px] text-gray-500 mt-1">Stored persistently in cloud</div>
      </div>

      <div class="glass-card rounded-xl p-4">
        <div class="text-xs text-gray-400 mb-1 flex items-center justify-between">
          <span>Worker State</span>
          <i class="fa-solid fa-circle-notch text-purple-400"></i>
        </div>
        <div id="stat-worker-state" class="text-2xl font-extrabold text-purple-400 font-mono">IDLE</div>
        <div id="stat-worker-sub" class="text-[11px] text-gray-500 mt-1">Ready to sweep</div>
      </div>

      <div class="glass-card rounded-xl p-4">
        <div class="text-xs text-gray-400 mb-1 flex items-center justify-between">
          <span>Current Slide</span>
          <i class="fa-solid fa-layer-group text-emerald-400"></i>
        </div>
        <div id="stat-slide-progress" class="text-2xl font-extrabold text-emerald-400 font-mono">0 / 0</div>
        <div id="stat-pct" class="text-[11px] text-gray-500 mt-1">0% completed</div>
      </div>

      <div class="glass-card rounded-xl p-4">
        <div class="text-xs text-gray-400 mb-1 flex items-center justify-between">
          <span>This Sweep Found</span>
          <i class="fa-solid fa-tower-broadcast text-amber-400"></i>
        </div>
        <div id="stat-session-found" class="text-2xl font-extrabold text-amber-400 font-mono">0</div>
        <div class="text-[11px] text-gray-500 mt-1">New sites deduplicated</div>
      </div>
    </div>

    <!-- Controls & Progress Panel -->
    <div class="glass-card rounded-xl p-5 space-y-4">
      <div class="flex flex-col md:flex-row items-center justify-between gap-4">
        <!-- District Picker -->
        <div class="flex items-center space-x-3 w-full md:w-auto">
          <div>
            <label class="text-xs text-gray-400 block mb-1">State</label>
            <select id="state-select" class="bg-gray-900 border border-gray-700 text-gray-200 text-xs rounded-lg px-3 py-2 outline-none focus:border-blue-500">
              <option value="">Loading...</option>
            </select>
          </div>
          <div>
            <label class="text-xs text-gray-400 block mb-1">District</label>
            <select id="district-select" class="bg-gray-900 border border-gray-700 text-gray-200 text-xs rounded-lg px-3 py-2 outline-none focus:border-blue-500 min-w-[160px]">
              <option value="">Select State First</option>
            </select>
          </div>
          <div class="pt-5">
            <button id="btn-start" onclick="startSweep()" class="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs px-4 py-2 rounded-lg transition flex items-center gap-1.5 shadow-lg shadow-blue-600/30">
              <i class="fa-solid fa-bolt"></i> Start Autonomous Sweep
            </button>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center space-x-2 pt-1 md:pt-4 w-full md:w-auto justify-end">
          <button id="btn-pause" onclick="pauseSweep()" class="bg-amber-600 hover:bg-amber-500 text-white text-xs px-3 py-2 rounded-lg transition disabled:opacity-40">
            <i class="fa-solid fa-pause mr-1"></i> Pause
          </button>
          <button id="btn-resume" onclick="resumeSweep()" class="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-2 rounded-lg transition disabled:opacity-40">
            <i class="fa-solid fa-play mr-1"></i> Resume
          </button>
          <button id="btn-stop" onclick="stopSweep()" class="bg-red-600 hover:bg-red-500 text-white text-xs px-3 py-2 rounded-lg transition disabled:opacity-40">
            <i class="fa-solid fa-stop mr-1"></i> Stop
          </button>
          <div class="h-6 w-px bg-gray-700 mx-1"></div>
          <a href="/api/worker/export/csv" class="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 text-xs px-3 py-2 rounded-lg transition flex items-center gap-1">
            <i class="fa-solid fa-download"></i> Raw CSV
          </a>
          <button onclick="syncToNexusRF()" class="bg-purple-600 hover:bg-purple-500 text-white text-xs px-3 py-2 rounded-lg transition flex items-center gap-1 shadow-lg shadow-purple-600/30">
            <i class="fa-solid fa-cloud-arrow-up"></i> Sync to Nexus RF
          </button>
        </div>
      </div>

      <!-- Progress Bar -->
      <div>
        <div class="flex justify-between text-xs text-gray-400 mb-1">
          <span id="progress-label">Sweep Progress</span>
          <span id="progress-pct-label" class="font-mono">0%</span>
        </div>
        <div class="w-full bg-gray-800 rounded-full h-2.5 overflow-hidden">
          <div id="progress-bar" class="bg-gradient-to-r from-blue-500 to-emerald-400 h-2.5 rounded-full transition-all duration-300" style="width: 0%"></div>
        </div>
      </div>
    </div>

    <!-- Live Terminal Logs -->
    <div class="glass-card rounded-xl p-4">
      <div class="flex items-center justify-between mb-2">
        <h2 class="text-xs font-semibold text-gray-300 flex items-center gap-2">
          <i class="fa-solid fa-terminal text-blue-400"></i> Cloud Worker Activity Log
        </h2>
        <span class="text-[11px] text-gray-500">Live Polling (Every 1.5s)</span>
      </div>
      <div id="terminal-box" class="terminal-window rounded-lg p-3 h-64 overflow-y-auto text-xs space-y-1">
        <div class="text-gray-500">[System] Worker initialized. Ready to fetch.</div>
      </div>
    </div>
  </main>

  <!-- Session Modal -->
  <div id="session-modal" class="fixed inset-0 bg-black/70 backdrop-blur-sm hidden items-center justify-center z-50">
    <div class="glass-card bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-lg mx-4 space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-bold text-white flex items-center gap-2">
          <i class="fa-solid fa-key text-blue-400"></i> Set Tarang Sanchar Session
        </h3>
        <button onclick="closeSessionModal()" class="text-gray-400 hover:text-white">&times;</button>
      </div>
      <p class="text-xs text-gray-400">
        Paste your active <code class="text-blue-300">ASP.NET_SessionId</code> cookie from Tarang Sanchar, or use the 1-Click "Handover Session" button in the Chrome extension.
      </p>
      <textarea id="session-input" rows="4" placeholder="ASP.NET_SessionId=...; __RequestVerificationToken_L0VNRlBvcnRhbA2=..." class="w-full bg-gray-950 border border-gray-700 text-xs rounded-lg p-3 text-gray-200 outline-none focus:border-blue-500 font-mono"></textarea>
      <div class="flex justify-end space-x-2">
        <button onclick="closeSessionModal()" class="px-3 py-1.5 text-xs text-gray-400 hover:text-white">Cancel</button>
        <button onclick="saveSession()" class="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold">Save Session</button>
      </div>
    </div>
  </div>

  <footer class="border-t border-gray-800/80 py-4 text-center text-xs text-gray-500">
    Nexus RF Cloud Microservice · Designed for Railway & Cloud deployment
  </footer>

  <script>
    let districtsData = {};

    async function loadDistricts() {
      try {
        const res = await fetch('/api/worker/districts');
        const data = await res.json();
        districtsData = data.districts;
        const stateSelect = document.getElementById('state-select');
        stateSelect.innerHTML = '';
        data.states.forEach(s => {
          const opt = document.createElement('option');
          opt.value = s;
          opt.textContent = s;
          if (s === 'Tamil Nadu') opt.selected = true;
          stateSelect.appendChild(opt);
        });
        updateDistricts();
      } catch (e) {
        console.error("Failed loading districts", e);
      }
    }

    function updateDistricts() {
      const state = document.getElementById('state-select').value;
      const districtSelect = document.getElementById('district-select');
      districtSelect.innerHTML = '';
      const list = districtsData[state] || [];
      list.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = d;
        if (d === 'Villupuram') opt.selected = true;
        districtSelect.appendChild(opt);
      });
    }

    document.getElementById('state-select').addEventListener('change', updateDistricts);

    async function pollStatus() {
      try {
        const res = await fetch('/api/worker/status');
        const data = await res.json();

        // Update stats
        document.getElementById('stat-total-sites').textContent = data.total_sites_database.toLocaleString();
        document.getElementById('stat-session-found').textContent = data.sites_captured_session.toLocaleString();
        document.getElementById('stat-slide-progress').textContent = `${data.current_slide} / ${data.total_slides}`;
        document.getElementById('stat-pct').textContent = `${data.progress_percent}% completed`;

        const stateEl = document.getElementById('stat-worker-state');
        const subEl = document.getElementById('stat-worker-sub');
        if (data.is_running) {
          stateEl.textContent = data.is_paused ? 'PAUSED' : 'SWEEPING';
          stateEl.className = data.is_paused ? 'text-2xl font-extrabold text-amber-400 font-mono' : 'text-2xl font-extrabold text-emerald-400 font-mono animate-pulse';
          subEl.textContent = `[${data.district || ''}] ${data.current_slide}/${data.total_slides} slides`;
        } else {
          stateEl.textContent = 'IDLE';
          stateEl.className = 'text-2xl font-extrabold text-purple-400 font-mono';
          subEl.textContent = 'Ready for sweep';
        }

        // Progress bar
        document.getElementById('progress-bar').style.width = `${data.progress_percent}%`;
        document.getElementById('progress-pct-label').textContent = `${data.progress_percent}%`;
        document.getElementById('progress-label').textContent = data.is_running ? `Sweeping ${data.district}, ${data.state} (Slide ${data.current_slide}/${data.total_slides})` : 'Sweep Progress';

        // Session badge
        const badge = document.getElementById('session-badge');
        if (data.has_valid_session) {
          badge.className = 'px-3 py-1 rounded-full text-xs font-medium bg-emerald-950 text-emerald-400 border border-emerald-800/50 flex items-center gap-1.5';
          badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400"></span> Session Active';
        } else {
          badge.className = 'px-3 py-1 rounded-full text-xs font-medium bg-red-950 text-red-400 border border-red-800/50 flex items-center gap-1.5';
          badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span> No Session';
        }

        // Logs
        const box = document.getElementById('terminal-box');
        if (data.recent_logs && data.recent_logs.length > 0) {
          box.innerHTML = data.recent_logs.map(l => {
            let color = 'text-gray-300';
            if (l.level === 'WARN') color = 'text-amber-400';
            if (l.level === 'ERROR') color = 'text-red-400';
            return `<div class="${color}"><span class="text-gray-600">[${l.time}]</span> ${l.message}</div>`;
          }).join('');
          box.scrollTop = box.scrollHeight;
        }
      } catch (e) {}
    }

    async function startSweep() {
      const state = document.getElementById('state-select').value;
      const district = document.getElementById('district-select').value;
      if (!state || !district) return alert("Select state and district");

      try {
        const res = await fetch('/api/worker/start', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ state, district })
        });
        const data = await res.json();
        if (!res.ok) alert(data.detail || "Error starting sweep");
        pollStatus();
      } catch (e) {
        alert("Failed to start: " + e.message);
      }
    }

    async function pauseSweep() {
      await fetch('/api/worker/pause', { method: 'POST' });
      pollStatus();
    }

    async function resumeSweep() {
      await fetch('/api/worker/resume', { method: 'POST' });
      pollStatus();
    }

    async function stopSweep() {
      if (confirm("Stop autonomous sweep?")) {
        await fetch('/api/worker/stop', { method: 'POST' });
        pollStatus();
      }
    }

    async function syncToNexusRF() {
      const nexusUrl = prompt("Enter Nexus RF Import API URL:", "http://127.0.0.1:8000/api/import");
      if (!nexusUrl) return;

      try {
        const res = await fetch('/api/worker/sync-nexus', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ nexus_url: nexusUrl })
        });
        const data = await res.json();
        if (data.success) {
          alert(`Successfully pushed ${data.count} tower sites directly into Nexus RF!`);
        } else {
          alert(`Sync failed: ${data.error}`);
        }
      } catch (e) {
        alert("Sync error: " + e.message);
      }
    }

    function openSessionModal() {
      document.getElementById('session-modal').classList.remove('hidden');
      document.getElementById('session-modal').classList.add('flex');
    }

    function closeSessionModal() {
      document.getElementById('session-modal').classList.add('hidden');
      document.getElementById('session-modal').classList.remove('flex');
    }

    async function saveSession() {
      const cookie = document.getElementById('session-input').value.trim();
      if (!cookie) return alert("Please enter cookie string");

      try {
        const res = await fetch('/api/worker/session', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ cookie })
        });
        const data = await res.json();
        if (data.success) {
          closeSessionModal();
          alert("Session saved! Worker can now query Tarang Sanchar.");
          pollStatus();
        } else {
          alert(data.detail || "Failed to save session");
        }
      } catch (e) {
        alert("Error: " + e.message);
      }
    }

    loadDistricts();
    pollStatus();
    setInterval(pollStatus, 1500);
  </script>
</body>
</html>"""
