/**
 * Content Script:
 * 1. Injects sniffer & parser into host page context.
 * 2. Bridges network events & DOM popups to background.js.
 * 3. Provides an interactive HUD with custom Start & End coordinate bounds,
 *    click-on-map picking, "Use Current Map View", and persistent slide-by-slide auto-scanner.
 */

(function () {
  'use strict';

  console.log('[Nexus RF] Content script active on Tarang Sanchar.');

  // Inject parser first, then sniffer into host page context
  function injectScript(file) {
    const s = document.createElement('script');
    s.src = chrome.runtime.getURL(file);
    s.onload = function () {
      this.remove();
    };
    (document.head || document.documentElement).appendChild(s);
  }

  injectScript('parser.js');
  injectScript('injected.js');

  // --- Floating HUD Widget ---
  let floatingWidget = null;
  let towerCountEl = null;
  let scanStatusEl = null;
  let scanBtnEl = null;
  let scanProgressBarEl = null;
  let startLatInput = null;
  let startLngInput = null;
  let endLatInput = null;
  let endLngInput = null;
  let slideCalcEl = null;
  let pickNoticeEl = null;

  let isScanningLoop = false;
  let activePickTarget = null; // 'start' or 'end'

  function createFloatingHUD() {
    if (document.getElementById('nexus-rf-hud')) return;

    floatingWidget = document.createElement('div');
    floatingWidget.id = 'nexus-rf-hud';
    floatingWidget.innerHTML = `
      <div class="nrf-hud-header">
        <div style="display:flex; align-items:center;">
          <span class="nrf-pulse-dot"></span>
          <span class="nrf-title">Nexus RF Extractor</span>
        </div>
        <button id="nrf-minimize-btn" title="Toggle HUD">−</button>
      </div>

      <div id="nrf-hud-body" class="nrf-hud-body">
        <div class="nrf-stat-row">
          <span>Captured Sites:</span>
          <strong id="nrf-tower-count">0</strong>
        </div>

        <!-- Coordinates Selection Section -->
        <div class="nrf-coord-section">
          <div class="nrf-section-title">📍 Scan Area (Start & End Bounds)</div>
          
          <div class="nrf-coord-row">
            <span class="nrf-coord-label">Start (SW):</span>
            <input type="number" step="0.0001" id="nrf-start-lat" placeholder="Start Lat" class="nrf-input" />
            <input type="number" step="0.0001" id="nrf-start-lng" placeholder="Start Lng" class="nrf-input" />
            <button id="nrf-pick-start-btn" class="nrf-btn nrf-btn-pick" title="Click on map to set Start">📍 Pick</button>
          </div>

          <div class="nrf-coord-row">
            <span class="nrf-coord-label">End (NE):</span>
            <input type="number" step="0.0001" id="nrf-end-lat" placeholder="End Lat" class="nrf-input" />
            <input type="number" step="0.0001" id="nrf-end-lng" placeholder="End Lng" class="nrf-input" />
            <button id="nrf-pick-end-btn" class="nrf-btn nrf-btn-pick" title="Click on map to set End">📍 Pick</button>
          </div>

          <div class="nrf-coord-actions">
            <button id="nrf-use-viewport-btn" class="nrf-btn nrf-btn-subtle" title="Fill with current visible map viewport">
              🗺 Use Current Map View
            </button>
            <span id="nrf-slide-calc" class="nrf-slide-calc">0 slides</span>
          </div>
        </div>

        <!-- Scanner Progress & Status -->
        <div class="nrf-progress-container">
          <div id="nrf-progress-bar" class="nrf-progress-bar" style="width: 0%;"></div>
        </div>
        <div class="nrf-stat-row" style="font-size: 11px; color: #94a3b8; margin: 4px 0;">
          <span id="nrf-scan-status">Set bounds or click 'Use Current Map View'</span>
        </div>

        <!-- Scan action controls -->
        <div class="nrf-scan-actions">
          <button id="nrf-scan-btn" class="nrf-btn nrf-btn-scan">▶ Start Auto-Scan</button>
          <button id="nrf-stop-scan" class="nrf-btn nrf-btn-secondary" title="Stop scan and reset grid">⏹ Stop</button>
        </div>

        <!-- Download & Clear controls -->
        <div class="nrf-actions">
          <button id="nrf-download-raw-csv" class="nrf-btn nrf-btn-raw" title="Download pure locations with null operator/tech">Raw CSV</button>
          <button id="nrf-download-csv" class="nrf-btn nrf-btn-primary" title="Download standard CSV with operators">Full CSV</button>
          <button id="nrf-clear-btn" class="nrf-btn nrf-btn-ghost" title="Clear all stored data">Clear</button>
        </div>
      </div>
    `;

    // Picking notification overlay
    pickNoticeEl = document.createElement('div');
    pickNoticeEl.id = 'nrf-pick-notice';
    pickNoticeEl.style.display = 'none';
    pickNoticeEl.innerHTML = `
      <span id="nrf-pick-text">🎯 Click on the map to pick point</span>
      <button id="nrf-cancel-pick-btn" style="background:#ef4444; border:none; color:white; border-radius:4px; padding:2px 8px; cursor:pointer; font-size:11px; margin-left:8px;">Cancel</button>
    `;

    const style = document.createElement('style');
    style.textContent = `
      #nexus-rf-hud {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 9999999;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        background: rgba(15, 23, 42, 0.96);
        backdrop-filter: blur(12px);
        color: #f8fafc;
        border: 1px solid rgba(59, 130, 246, 0.4);
        border-radius: 12px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 15px rgba(59, 130, 246, 0.2);
        padding: 12px 14px;
        width: 320px;
        font-size: 12px;
        transition: all 0.2s ease;
      }
      .nrf-hud-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
        padding-bottom: 6px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }
      .nrf-pulse-dot {
        width: 8px;
        height: 8px;
        background-color: #10b981;
        border-radius: 50%;
        display: inline-block;
        margin-right: 6px;
        box-shadow: 0 0 8px #10b981;
      }
      .nrf-title {
        font-weight: 600;
        font-size: 13px;
        color: #60a5fa;
      }
      #nrf-minimize-btn {
        background: transparent;
        border: none;
        color: #94a3b8;
        cursor: pointer;
        font-size: 16px;
        line-height: 1;
        padding: 0 4px;
      }
      #nrf-minimize-btn:hover { color: #f8fafc; }
      .nrf-stat-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 12px;
        color: #cbd5e1;
      }
      #nrf-tower-count {
        font-size: 14px;
        color: #38bdf8;
        font-weight: 700;
      }
      .nrf-coord-section {
        background: rgba(30, 41, 59, 0.7);
        border: 1px solid rgba(148, 163, 184, 0.2);
        border-radius: 8px;
        padding: 8px;
        margin: 6px 0;
      }
      .nrf-section-title {
        font-size: 11px;
        font-weight: 600;
        color: #93c5fd;
        margin-bottom: 6px;
      }
      .nrf-coord-row {
        display: flex;
        align-items: center;
        gap: 4px;
        margin-bottom: 5px;
      }
      .nrf-coord-label {
        font-size: 10px;
        color: #94a3b8;
        width: 58px;
        flex-shrink: 0;
      }
      .nrf-input {
        flex: 1;
        min-width: 0;
        background: rgba(15, 23, 42, 0.9);
        border: 1px solid #475569;
        border-radius: 4px;
        color: #f1f5f9;
        font-size: 11px;
        padding: 3px 5px;
      }
      .nrf-input:focus {
        outline: none;
        border-color: #38bdf8;
      }
      .nrf-coord-actions {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 4px;
      }
      .nrf-slide-calc {
        font-size: 11px;
        color: #38bdf8;
        font-weight: 600;
      }
      .nrf-progress-container {
        width: 100%;
        height: 5px;
        background: rgba(51, 65, 85, 0.6);
        border-radius: 3px;
        overflow: hidden;
        margin-top: 4px;
      }
      .nrf-progress-bar {
        height: 100%;
        background: linear-gradient(90deg, #38bdf8, #10b981);
        transition: width 0.3s ease;
      }
      .nrf-scan-actions {
        display: flex;
        gap: 6px;
        margin: 6px 0;
      }
      .nrf-actions {
        display: flex;
        gap: 6px;
        margin-top: 6px;
      }
      .nrf-btn {
        padding: 5px 8px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        border: none;
        transition: all 0.15s;
      }
      .nrf-btn-pick {
        background: #3b82f6;
        color: white;
        padding: 3px 6px;
        font-size: 10px;
        flex-shrink: 0;
      }
      .nrf-btn-pick:hover { background: #2563eb; }
      .nrf-btn-subtle {
        background: #334155;
        color: #e2e8f0;
        padding: 3px 8px;
        font-size: 10px;
      }
      .nrf-btn-subtle:hover { background: #475569; }
      .nrf-btn-scan {
        background: #0284c7;
        color: white;
        flex: 2;
      }
      .nrf-btn-scan:hover { background: #0369a1; }
      .nrf-btn-secondary {
        background: #475569;
        color: white;
        flex: 1;
      }
      .nrf-btn-secondary:hover { background: #334155; }
      .nrf-btn-raw {
        background: #059669;
        color: white;
        flex: 1;
      }
      .nrf-btn-raw:hover { background: #047857; }
      .nrf-btn-primary {
        background: #2563eb;
        color: white;
        flex: 1;
      }
      .nrf-btn-primary:hover { background: #1d4ed8; }
      .nrf-btn-ghost {
        background: transparent;
        color: #ef4444;
        border: 1px solid rgba(239, 68, 68, 0.4);
      }
      .nrf-btn-ghost:hover { background: rgba(239, 68, 68, 0.15); }
      .nrf-minimized #nrf-hud-body { display: none; }
      .nrf-minimized { width: auto; min-width: unset; padding: 8px 12px; }
      .nrf-minimized .nrf-hud-header { margin-bottom: 0; padding-bottom: 0; border: none; }

      #nrf-pick-notice {
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10000000;
        background: #1e293b;
        color: #38bdf8;
        border: 2px solid #38bdf8;
        border-radius: 30px;
        padding: 8px 16px;
        font-family: sans-serif;
        font-size: 13px;
        font-weight: 600;
        box-shadow: 0 10px 25px rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(floatingWidget);
    document.body.appendChild(pickNoticeEl);

    towerCountEl = document.getElementById('nrf-tower-count');
    scanStatusEl = document.getElementById('nrf-scan-status');
    scanBtnEl = document.getElementById('nrf-scan-btn');
    scanProgressBarEl = document.getElementById('nrf-progress-bar');
    startLatInput = document.getElementById('nrf-start-lat');
    startLngInput = document.getElementById('nrf-start-lng');
    endLatInput = document.getElementById('nrf-end-lat');
    endLngInput = document.getElementById('nrf-end-lng');
    slideCalcEl = document.getElementById('nrf-slide-calc');

    document.getElementById('nrf-minimize-btn').addEventListener('click', () => {
      floatingWidget.classList.toggle('nrf-minimized');
      const btn = document.getElementById('nrf-minimize-btn');
      btn.textContent = floatingWidget.classList.contains('nrf-minimized') ? '+' : '−';
    });

    scanBtnEl.addEventListener('click', toggleAutoScan);
    document.getElementById('nrf-stop-scan').addEventListener('click', stopScanGrid);
    document.getElementById('nrf-download-raw-csv').addEventListener('click', exportRawCSV);
    document.getElementById('nrf-download-csv').addEventListener('click', exportFullCSV);
    document.getElementById('nrf-clear-btn').addEventListener('click', clearData);

    document.getElementById('nrf-pick-start-btn').addEventListener('click', () => startPickMode('start'));
    document.getElementById('nrf-pick-end-btn').addEventListener('click', () => startPickMode('end'));
    document.getElementById('nrf-cancel-pick-btn').addEventListener('click', cancelPickMode);
    document.getElementById('nrf-use-viewport-btn').addEventListener('click', populateFromCurrentViewport);

    [startLatInput, startLngInput, endLatInput, endLngInput].forEach(inp => {
      inp.addEventListener('input', updateSlideCalculation);
    });

    updateHUDCount();
  }

  function updateSlideCalculation() {
    const sLat = parseFloat(startLatInput.value);
    const sLng = parseFloat(startLngInput.value);
    const eLat = parseFloat(endLatInput.value);
    const eLng = parseFloat(endLngInput.value);

    if (isNaN(sLat) || isNaN(sLng) || isNaN(eLat) || isNaN(eLng)) {
      slideCalcEl.textContent = '— slides';
      return;
    }

    const dLat = Math.abs(eLat - sLat);
    const dLng = Math.abs(eLng - sLng);
    const rows = Math.max(1, Math.ceil(dLat / 0.020));
    const cols = Math.max(1, Math.ceil(dLng / 0.024));
    const total = rows * cols;
    slideCalcEl.textContent = `${total} slides (${rows}×${cols})`;
  }

  function startPickMode(target) {
    activePickTarget = target;
    const label = target === 'start' ? 'Start (SW)' : 'End (NE)';
    pickNoticeEl.style.display = 'flex';
    document.getElementById('nrf-pick-text').textContent = `🎯 Click anywhere on the map to set ${label} Point`;

    // Notify injected script to listen for map click
    window.postMessage({ source: 'TARANG_CONTENT', type: 'START_MAP_PICKER', target }, '*');
  }

  function cancelPickMode() {
    activePickTarget = null;
    pickNoticeEl.style.display = 'none';
  }

  function populateFromCurrentViewport() {
    scanStatusEl.textContent = 'Reading map viewport bounds...';
    const handler = event => {
      if (event.source === window && event.data && event.data.type === 'PAGE_BOUNDS_RESPONSE') {
        window.removeEventListener('message', handler);
        const b = event.data.bounds;
        if (b && typeof b.swLat === 'number') {
          startLatInput.value = b.swLat.toFixed(5);
          startLngInput.value = b.swLng.toFixed(5);
          endLatInput.value = b.neLat.toFixed(5);
          endLngInput.value = b.neLng.toFixed(5);
          updateSlideCalculation();
          scanStatusEl.textContent = 'Bounds populated from visible map.';
        } else {
          scanStatusEl.textContent = 'Could not detect bounds. Pan the map once or click Pick.';
        }
      }
    };
    window.addEventListener('message', handler);
    window.postMessage({ source: 'TARANG_CONTENT', type: 'REQUEST_PAGE_BOUNDS' }, '*');
    setTimeout(() => {
      window.removeEventListener('message', handler);
    }, 1200);
  }

  function updateHUDCount() {
    chrome.runtime.sendMessage({ action: 'GET_SCAN_STATUS' }, res => {
      if (chrome.runtime.lastError || !res) return;
      if (towerCountEl) towerCountEl.textContent = res.sitesCount || 0;

      if (res.startLat && !startLatInput.value) {
        startLatInput.value = res.startLat;
        startLngInput.value = res.startLng;
        endLatInput.value = res.endLat;
        endLngInput.value = res.endLng;
        updateSlideCalculation();
      }

      if (res.totalTiles > 0) {
        const pct = Math.round((res.completedCount / res.totalTiles) * 100);
        scanProgressBarEl.style.width = `${pct}%`;

        if (res.isScanning) {
          scanStatusEl.textContent = `Scanning: slide ${res.completedCount}/${res.totalTiles} (${pct}%)`;
          scanBtnEl.textContent = '⏸ Pause Scan';
          scanBtnEl.style.background = '#f59e0b';
        } else if (res.isPaused) {
          scanStatusEl.textContent = `Paused: slide ${res.completedCount}/${res.totalTiles} (${pct}%)`;
          scanBtnEl.textContent = '▶ Resume Scan';
          scanBtnEl.style.background = '#0284c7';
        } else if (res.completedCount >= res.totalTiles) {
          scanStatusEl.textContent = `Completed all ${res.totalTiles} slides!`;
          scanBtnEl.textContent = '▶ Scan Again';
          scanBtnEl.style.background = '#10b981';
        }
      } else {
        scanProgressBarEl.style.width = '0%';
        scanStatusEl.textContent = 'Ready: Enter bounds or click "Use Map View"';
        scanBtnEl.textContent = '▶ Start Auto-Scan';
        scanBtnEl.style.background = '#0284c7';
      }
    });
  }

  function triggerDownload(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportRawCSV() {
    chrome.runtime.sendMessage({ action: 'GET_RAW_CSV' }, response => {
      if (!response || !response.csv) {
        alert('No towers captured yet. Start Auto-Scan or pan the map on Tarang Sanchar first!');
        return;
      }
      const filename = `tarangsanchar_raw_towers_${new Date().toISOString().slice(0, 10)}.csv`;
      triggerDownload(response.csv, filename, 'text/csv;charset=utf-8;');
    });
  }

  function exportFullCSV() {
    chrome.runtime.sendMessage({ action: 'GET_TOWERS' }, response => {
      const towers = (response && response.towers) || [];
      if (towers.length === 0) {
        alert('No towers captured yet. Start Auto-Scan or pan the map on Tarang Sanchar first!');
        return;
      }
      const csv = window.TarangParser.towersToCSV(towers);
      const filename = `tarangsanchar_full_towers_${new Date().toISOString().slice(0, 10)}.csv`;
      triggerDownload(csv, filename, 'text/csv;charset=utf-8;');
    });
  }

  function clearData() {
    if (confirm('Clear all captured sites and reset scan progress?')) {
      chrome.runtime.sendMessage({ action: 'CLEAR_TOWERS' }, () => {
        isScanningLoop = false;
        if (towerCountEl) towerCountEl.textContent = '0';
        updateHUDCount();
      });
    }
  }

  function stopScanGrid() {
    chrome.runtime.sendMessage({ action: 'STOP_SCAN' }, () => {
      isScanningLoop = false;
      updateHUDCount();
    });
  }

  // --- Auto-Scanner Loop (Slide by slide until end or paused) ---
  async function toggleAutoScan() {
    if (isScanningLoop) {
      // Pause manually
      isScanningLoop = false;
      chrome.runtime.sendMessage({ action: 'PAUSE_SCAN' }, () => {
        updateHUDCount();
      });
      return;
    }

    const sLat = parseFloat(startLatInput.value);
    const sLng = parseFloat(startLngInput.value);
    const eLat = parseFloat(endLatInput.value);
    const eLng = parseFloat(endLngInput.value);

    if (isNaN(sLat) || isNaN(sLng) || isNaN(eLat) || isNaN(eLng)) {
      alert('Please provide Start (SW) and End (NE) coordinates or click "Use Current Map View" first!');
      return;
    }

    chrome.runtime.sendMessage(
      {
        action: 'START_OR_RESUME_SCAN',
        startLat: sLat,
        startLng: sLng,
        endLat: eLat,
        endLng: eLng
      },
      res => {
        if (!res || !res.nextTile) {
          alert('Scan completed or no remaining slides.');
          updateHUDCount();
          return;
        }
        isScanningLoop = true;
        runSlideLoop(res.nextTile);
      }
    );
  }

  async function runSlideLoop(initialTile) {
    let currentTile = initialTile;

    while (isScanningLoop && currentTile) {
      scanStatusEl.textContent = `Fetching slide ${currentTile.id} (${currentTile.swLat}, ${currentTile.swLng})...`;
      scanBtnEl.textContent = '⏸ Pause Scan';
      scanBtnEl.style.background = '#f59e0b';

      // Send fetch request to injected.js
      const tileDonePromise = new Promise(resolve => {
        const tileHandler = event => {
          if (
            event.source === window &&
            event.data &&
            event.data.type === 'TILE_FETCH_DONE' &&
            event.data.tileId === currentTile.id
          ) {
            window.removeEventListener('message', tileHandler);
            resolve(event.data);
          }
        };
        window.addEventListener('message', tileHandler);
      });

      window.postMessage(
        {
          source: 'TARANG_CONTENT',
          type: 'TRIGGER_FETCH_LOCATIONS_TILE',
          neLat: currentTile.neLat,
          swLat: currentTile.swLat,
          neLng: currentTile.neLng,
          swLng: currentTile.swLng,
          tileId: currentTile.id
        },
        '*'
      );

      // Wait for fetch completion or timeout
      await Promise.race([tileDonePromise, new Promise(r => setTimeout(r, 4500))]);

      // Notify background that tile is done and get next tile (resume aware)
      const nextRes = await new Promise(resolve => {
        chrome.runtime.sendMessage(
          { action: 'MARK_TILE_DONE', tileId: currentTile.id },
          resolve
        );
      });

      updateHUDCount();
      currentTile = nextRes ? nextRes.nextTile : null;

      if (!currentTile) {
        isScanningLoop = false;
        scanStatusEl.textContent = `All slides completed!`;
        scanBtnEl.textContent = '▶ Scan Again';
        scanBtnEl.style.background = '#10b981';
        break;
      }

      // Polite delay between consecutive slides (650ms)
      await new Promise(r => setTimeout(r, 650));
    }
  }

  // --- Listen for messages from injected.js & popup ---
  window.addEventListener('message', event => {
    if (event.source !== window || !event.data) return;

    // Picked coordinates from map click
    if (event.data.source === 'TARANG_SNIFFER' && event.data.type === 'MAP_POINT_PICKED') {
      const { target, lat, lng } = event.data;
      if (target === 'start') {
        startLatInput.value = lat;
        startLngInput.value = lng;
      } else if (target === 'end') {
        endLatInput.value = lat;
        endLngInput.value = lng;
      }
      cancelPickMode();
      updateSlideCalculation();
      scanStatusEl.textContent = `Point saved: ${lat}, ${lng}`;
    }

    // Towers captured from page
    if (event.data.source === 'TARANG_SNIFFER' && event.data.type === 'TOWERS_CAPTURED') {
      chrome.runtime.sendMessage(
        { action: 'SAVE_TOWERS', towers: event.data.towers },
        response => {
          if (response && response.success) {
            updateHUDCount();
          }
        }
      );
    }

    // Site details captured
    if (event.data.source === 'TARANG_SNIFFER' && event.data.type === 'SITE_DETAILS_CAPTURED') {
      chrome.runtime.sendMessage(
        { action: 'ENRICH_SITE', detail: event.data.detail },
        () => {
          updateHUDCount();
        }
      );
    }
  });

  // Listen for extension commands from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'TRIGGER_POPULATE_VIEWPORT') {
      populateFromCurrentViewport();
      sendResponse({ received: true });
    }
    if (request.action === 'TRIGGER_RESUME_SCAN_LOOP') {
      chrome.runtime.sendMessage({ action: 'GET_SCAN_STATUS' }, res => {
        if (res && res.isScanning) {
          isScanningLoop = true;
          // Find next tile
          chrome.runtime.sendMessage({ action: 'START_OR_RESUME_SCAN' }, scanRes => {
            if (scanRes && scanRes.nextTile) {
              runSlideLoop(scanRes.nextTile);
            }
          });
        }
      });
      sendResponse({ received: true });
    }
    return true;
  });

  // Initialize HUD once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createFloatingHUD);
  } else {
    createFloatingHUD();
  }
})();
