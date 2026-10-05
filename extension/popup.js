/**
 * Popup Script:
 * - Controls live stats and preview filtering.
 * - District-Wise Automated Fast Tower Fetcher (pure locations only).
 * - Custom Bounding-Box Auto-Grid Scanner (Slide by Slide, persistent resume).
 * - Raw Mode CSV export (pure locations & types with null operator/band).
 * - Full CSV export with multi-operator breakdown.
 * - Direct 1-Click Push to Nexus RF Engine (localhost:8000).
 */

document.addEventListener('DOMContentLoaded', () => {
  let allTowers = [];
  let currentScanMode = 'district'; // 'district' or 'coords'

  const sitesCountEl = document.getElementById('sites-count');
  const towersCountEl = document.getElementById('towers-count');
  const enrichedCountEl = document.getElementById('enriched-count');
  const operatorTagsEl = document.getElementById('operator-tags');
  const techTagsEl = document.getElementById('tech-tags');
  const towersBodyEl = document.getElementById('towers-body');
  const searchInput = document.getElementById('search-input');
  const btnExportRawCsv = document.getElementById('btn-export-raw-csv');
  const btnExportCsv = document.getElementById('btn-export-csv');
  const btnExportJson = document.getElementById('btn-export-json');
  const btnPushNexus = document.getElementById('btn-push-nexus');
  const btnClear = document.getElementById('btn-clear');
  const btnFetchDetails = document.getElementById('btn-fetch-details');

  // Scanner UI elements
  const scanBadgeEl = document.getElementById('scan-progress-badge');
  const scanFillEl = document.getElementById('scan-progress-fill');
  const btnToggleScan = document.getElementById('btn-toggle-scan');
  const btnResetScan = document.getElementById('btn-reset-scan');
  const rawModeToggle = document.getElementById('raw-mode-toggle');

  // Tabs
  const tabBtnDistrict = document.getElementById('tab-btn-district');
  const tabBtnCoords = document.getElementById('tab-btn-coords');
  const districtScanBox = document.getElementById('district-scan-box');
  const coordsScanBox = document.getElementById('coords-scan-box');

  // District elements
  const popupStateSelect = document.getElementById('popup-state-select');
  const popupDistrictSelect = document.getElementById('popup-district-select');
  const popupDistrictSearch = document.getElementById('popup-district-search');
  const districtInfoText = document.getElementById('district-info-text');

  // Custom Coords elements
  const popupStartLat = document.getElementById('popup-start-lat');
  const popupStartLng = document.getElementById('popup-start-lng');
  const popupEndLat = document.getElementById('popup-end-lat');
  const popupEndLng = document.getElementById('popup-end-lng');
  const popupSlideCount = document.getElementById('popup-slide-count');
  const btnPopupUseView = document.getElementById('btn-popup-use-view');

  // ── Tab Switching ──────────────────────────────────────────────────────────
  tabBtnDistrict.addEventListener('click', () => {
    currentScanMode = 'district';
    tabBtnDistrict.classList.add('active');
    tabBtnCoords.classList.remove('active');
    districtScanBox.style.display = 'flex';
    coordsScanBox.style.display = 'none';
    btnToggleScan.textContent = '⚡ Fast Fetch District Towers';
  });

  tabBtnCoords.addEventListener('click', () => {
    currentScanMode = 'coords';
    tabBtnCoords.classList.add('active');
    tabBtnDistrict.classList.remove('active');
    coordsScanBox.style.display = 'flex';
    districtScanBox.style.display = 'none';
    btnToggleScan.textContent = '▶ Start Auto-Scan (Bounds)';
  });

  // ── District Dropdown Population ───────────────────────────────────────────
  function initDistrictsUI() {
    if (typeof window.TarangDistricts === 'undefined') return;

    const states = window.TarangDistricts.getStates();
    popupStateSelect.innerHTML = '';
    states.forEach(state => {
      const opt = document.createElement('option');
      opt.value = state;
      opt.textContent = state;
      if (state === 'Tamil Nadu') opt.selected = true;
      popupStateSelect.appendChild(opt);
    });

    populateDistrictsForState(popupStateSelect.value || 'Tamil Nadu', 'Villupuram');

    popupStateSelect.addEventListener('change', () => {
      populateDistrictsForState(popupStateSelect.value);
    });

    popupDistrictSelect.addEventListener('change', updateDistrictInfo);

    popupDistrictSearch.addEventListener('input', e => {
      const q = e.target.value.trim().toLowerCase();
      if (!q) {
        populateDistrictsForState(popupStateSelect.value);
        return;
      }
      const matched = window.TarangDistricts.findDistrictByName(q);
      if (matched) {
        popupStateSelect.value = matched.state;
        populateDistrictsForState(matched.state, matched.district);
      }
    });
  }

  function populateDistrictsForState(state, preferredDistrict = null) {
    const districts = window.TarangDistricts.getDistrictsForState(state);
    popupDistrictSelect.innerHTML = '';
    districts.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = d;
      if (preferredDistrict && d === preferredDistrict) opt.selected = true;
      popupDistrictSelect.appendChild(opt);
    });
    updateDistrictInfo();
  }

  function updateDistrictInfo() {
    const state = popupStateSelect.value;
    const district = popupDistrictSelect.value;
    const bounds = window.TarangDistricts.getDistrictBounds(state, district);
    if (bounds) {
      const slides = window.TarangDistricts.generateDistrictSlides(bounds);
      districtInfoText.textContent = `${district}, ${state} · ${slides.length} slides (${bounds[0]}, ${bounds[1]} to ${bounds[2]}, ${bounds[3]})`;
    } else {
      districtInfoText.textContent = `${district}, ${state}`;
    }
  }

  initDistrictsUI();

  // ── Coordinate bounds calculations ─────────────────────────────────────────
  function updatePopupSlideCount() {
    if (!popupStartLat || !popupSlideCount) return;
    const sLat = parseFloat(popupStartLat.value);
    const sLng = parseFloat(popupStartLng.value);
    const eLat = parseFloat(popupEndLat.value);
    const eLng = parseFloat(popupEndLng.value);

    if (isNaN(sLat) || isNaN(sLng) || isNaN(eLat) || isNaN(eLng)) {
      popupSlideCount.textContent = '— slides';
      return;
    }

    const dLat = Math.abs(eLat - sLat);
    const dLng = Math.abs(eLng - sLng);
    const rows = Math.max(1, Math.ceil(dLat / 0.020));
    const cols = Math.max(1, Math.ceil(dLng / 0.024));
    popupSlideCount.textContent = `${rows * cols} slides (${rows}×${cols})`;
  }

  [popupStartLat, popupStartLng, popupEndLat, popupEndLng].forEach(el => {
    if (el) el.addEventListener('input', updatePopupSlideCount);
  });

  // ── Data & Scan Status Polling ─────────────────────────────────────────────
  function loadData() {
    chrome.runtime.sendMessage({ action: 'GET_STATS' }, stats => {
      if (stats) {
        sitesCountEl.textContent = stats.siteCount || 0;
        enrichedCountEl.textContent = stats.detailCount || 0;
      }
    });

    chrome.runtime.sendMessage({ action: 'GET_SCAN_STATUS' }, scan => {
      if (scan && scan.success) {
        updateScanUI(scan);
      }
    });

    chrome.runtime.sendMessage({ action: 'GET_TOWERS' }, response => {
      if (chrome.runtime.lastError || !response) return;
      allTowers = response.towers || [];
      towersCountEl.textContent = allTowers.length;
      renderUI(allTowers);
    });
  }

  function updateScanUI(scan) {
    if (scan.mode === 'district' && scan.districtName) {
      if (popupDistrictSelect) popupDistrictSelect.value = scan.districtName;
      if (popupStateSelect && scan.stateName) popupStateSelect.value = scan.stateName;
    } else if (scan.startLat && popupStartLat && !popupStartLat.value) {
      popupStartLat.value = scan.startLat;
      popupStartLng.value = scan.startLng;
      popupEndLat.value = scan.endLat;
      popupEndLng.value = scan.endLng;
      updatePopupSlideCount();
    }

    if (scan.totalTiles > 0) {
      const pct = Math.round((scan.completedCount / scan.totalTiles) * 100);
      scanFillEl.style.width = `${pct}%`;

      const titlePrefix = scan.districtName ? `[${scan.districtName}] ` : '';

      if (scan.isScanning) {
        scanBadgeEl.textContent = `${titlePrefix}Scanning: ${scan.completedCount}/${scan.totalTiles} slides (${pct}%)`;
        btnToggleScan.textContent = '⏸ Pause Scan';
        btnToggleScan.style.background = '#f59e0b';
      } else if (scan.isPaused) {
        scanBadgeEl.textContent = `${titlePrefix}Paused at ${scan.completedCount}/${scan.totalTiles} slides`;
        btnToggleScan.textContent = '▶ Resume Scan';
        btnToggleScan.style.background = '#0284c7';
      } else if (scan.completedCount >= scan.totalTiles) {
        scanBadgeEl.textContent = `${titlePrefix}Completed all ${scan.totalTiles} slides!`;
        btnToggleScan.textContent = scan.mode === 'district' ? '⚡ Scan District Again' : '▶ Scan Again';
        btnToggleScan.style.background = '#10b981';
      }
    } else {
      scanFillEl.style.width = '0%';
      scanBadgeEl.textContent = 'Ready (Fast Fetch)';
      btnToggleScan.textContent = currentScanMode === 'district' ? '⚡ Fast Fetch District Towers' : '▶ Start Auto-Scan';
      btnToggleScan.style.background = '#0284c7';
    }
  }

  function renderUI(towers) {
    const opCounts = {};
    const techCounts = {};

    towers.forEach(t => {
      const op = t.operator || 'Raw/Unconfigured';
      opCounts[op] = (opCounts[op] || 0) + 1;

      const tech = t.technology || '4G';
      techCounts[tech] = (techCounts[tech] || 0) + 1;
    });

    renderTags(operatorTagsEl, opCounts, 'op');
    renderTags(techTagsEl, techCounts, 'tech');
    renderTable(towers);
  }

  function renderTags(container, counts, type) {
    container.innerHTML = '';
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    if (entries.length === 0) {
      container.innerHTML = '<span class="tag tag-dim">No data</span>';
      return;
    }

    entries.forEach(([name, count]) => {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.dataset.filter = name;

      let colorClass = 'tag-other';
      const lower = name.toLowerCase();
      if (lower.includes('airtel')) colorClass = 'tag-airtel';
      else if (lower.includes('jio')) colorClass = 'tag-jio';
      else if (lower.includes('vi') || lower.includes('vodafone')) colorClass = 'tag-vi';
      else if (lower.includes('bsnl')) colorClass = 'tag-bsnl';
      else if (lower.includes('raw')) colorClass = 'tag-raw';

      tag.classList.add(colorClass);
      tag.innerHTML = `<span>${name}</span> <span class="tag-count">${count}</span>`;
      container.appendChild(tag);
    });
  }

  function renderTable(towers) {
    towersBodyEl.innerHTML = '';

    if (towers.length === 0) {
      towersBodyEl.innerHTML = '<tr><td colspan="5" class="empty-state">No towers captured yet.</td></tr>';
      return;
    }

    const preview = towers.slice(0, 100);
    preview.forEach(t => {
      const tr = document.createElement('tr');
      const op = t.operator || 'Raw Loc';
      const tech = t.technology || '—';
      const sid = t.site_id || '—';
      const coords = `${t.latitude ? t.latitude.toFixed(4) : ''}, ${t.longitude ? t.longitude.toFixed(4) : ''}`;
      const type = t.tower_type || 'Rooftop';

      let opDotClass = 'dot-other';
      const opL = op.toLowerCase();
      if (opL.includes('airtel')) opDotClass = 'dot-airtel';
      else if (opL.includes('jio')) opDotClass = 'dot-jio';
      else if (opL.includes('vi')) opDotClass = 'dot-vi';
      else if (opL.includes('bsnl')) opDotClass = 'dot-bsnl';

      tr.innerHTML = `
        <td><span class="operator-dot ${opDotClass}"></span>${op}</td>
        <td><span class="tech-pill">${tech}</span></td>
        <td class="font-mono">${sid}</td>
        <td class="font-mono">${coords}</td>
        <td><span class="badge-type">${type}</span></td>
      `;
      towersBodyEl.appendChild(tr);
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

  // ── Search filter ──────────────────────────────────────────────────────────
  searchInput.addEventListener('input', e => {
    const q = e.target.value.toLowerCase().trim();
    if (!q) {
      renderUI(allTowers);
      return;
    }
    const filtered = allTowers.filter(t => {
      return (
        (t.site_id && t.site_id.toLowerCase().includes(q)) ||
        (t.operator && t.operator.toLowerCase().includes(q)) ||
        (t.technology && t.technology.toLowerCase().includes(q)) ||
        (t.tower_type && t.tower_type.toLowerCase().includes(q)) ||
        (t.address && t.address.toLowerCase().includes(q))
      );
    });
    renderUI(filtered);
  });

  // ── "Use Map View" button in Coords Tab ─────────────────────────────────────
  btnPopupUseView.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !tab.url.includes('tarangsanchar.gov.in')) {
      alert('Please switch to the Tarang Sanchar tab to capture viewport coordinates.');
      return;
    }
    chrome.tabs.sendMessage(tab.id, { action: 'TRIGGER_POPULATE_VIEWPORT' }, () => {
      setTimeout(() => {
        chrome.runtime.sendMessage({ action: 'GET_SCAN_STATUS' }, scan => {
          if (scan) updateScanUI(scan);
        });
      }, 300);
    });
  });

  // ── Toggle Auto-Scan (District or Coords) ───────────────────────────────────
  btnToggleScan.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !tab.url.includes('tarangsanchar.gov.in')) {
      alert('Please navigate to https://tarangsanchar.gov.in before starting Auto-Scan.');
      return;
    }

    chrome.runtime.sendMessage({ action: 'GET_SCAN_STATUS' }, scan => {
      if (scan && scan.isScanning) {
        // Pause scan
        chrome.runtime.sendMessage({ action: 'PAUSE_SCAN' }, () => {
          loadData();
        });
        return;
      }

      // Start or Resume scan
      if (currentScanMode === 'district') {
        const state = popupStateSelect.value;
        const district = popupDistrictSelect.value;
        if (!district) {
          alert('Please select a district.');
          return;
        }

        chrome.runtime.sendMessage(
          {
            action: 'START_DISTRICT_SCAN',
            state,
            district,
            fastLocationsOnly: true
          },
          res => {
            if (res && res.success) {
              loadData();
              chrome.tabs.sendMessage(tab.id, { action: 'TRIGGER_RESUME_SCAN_LOOP' }, () => {});
            } else {
              alert(res?.error || 'Failed to start district scan.');
            }
          }
        );
      } else {
        // Coords mode
        const sLat = parseFloat(popupStartLat.value);
        const sLng = parseFloat(popupStartLng.value);
        const eLat = parseFloat(popupEndLat.value);
        const eLng = parseFloat(popupEndLng.value);

        if (isNaN(sLat) || isNaN(sLng) || isNaN(eLat) || isNaN(eLng)) {
          alert('Please provide Start (SW) and End (NE) coordinates or click "Use Map View" first!');
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
            if (res && res.success) {
              loadData();
              chrome.tabs.sendMessage(tab.id, { action: 'TRIGGER_RESUME_SCAN_LOOP' }, () => {});
            }
          }
        );
      }
    });
  });

  // ── Reset Scan ─────────────────────────────────────────────────────────────
  btnResetScan.addEventListener('click', () => {
    if (confirm('Stop Auto-Scan and reset progress grid?')) {
      chrome.runtime.sendMessage({ action: 'RESET_SCAN' }, () => {
        loadData();
      });
    }
  });

  // ── Export RAW CSV (Fast Locations & Types, Null Operator/Band) ────────────
  btnExportRawCsv.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'GET_RAW_CSV' }, response => {
      if (!response || !response.csv) {
        const dist = popupDistrictSelect ? popupDistrictSelect.value : 'this district';
        const startFetch = confirm(
          `No towers captured yet for ${dist}!\n\n` +
          `Would you like to start "⚡ Fast Fetch District Towers" now?\n` +
          `It will automatically gather all tower coordinates for ${dist}.`
        );
        if (startFetch) {
          btnToggleScan.click();
        }
        return;
      }
      const dist = popupDistrictSelect ? popupDistrictSelect.value : 'district';
      const dateStr = new Date().toISOString().slice(0, 10);
      triggerDownload(response.csv, `tarangsanchar_raw_${dist}_${dateStr}.csv`, 'text/csv;charset=utf-8;');
    });
  });

  // ── Export Full CSV (With Operators & Bands) ───────────────────────────────
  btnExportCsv.addEventListener('click', () => {
    if (allTowers.length === 0) {
      const dist = popupDistrictSelect ? popupDistrictSelect.value : 'this district';
      const startFetch = confirm(
        `No towers captured yet for ${dist}!\n\n` +
        `Would you like to start "⚡ Fast Fetch District Towers" now to gather towers?`
      );
      if (startFetch) {
        btnToggleScan.click();
      }
      return;
    }
    const dist = popupDistrictSelect ? popupDistrictSelect.value : 'towers';
    const parser = typeof TarangParser !== 'undefined' ? TarangParser : (typeof window !== 'undefined' ? window.TarangParser : null);
    if (!parser) {
      alert('TarangParser not available. Please reopen popup.');
      return;
    }
    const csv = parser.towersToCSV(allTowers);
    const dateStr = new Date().toISOString().slice(0, 10);
    triggerDownload(csv, `tarangsanchar_full_${dist}_${dateStr}.csv`, 'text/csv;charset=utf-8;');
  });

  // ── Export JSON ────────────────────────────────────────────────────────────
  btnExportJson.addEventListener('click', () => {
    if (allTowers.length === 0) {
      alert('No towers captured yet. Start Auto-Scan or pan the map on Tarang Sanchar first!');
      return;
    }
    const dist = popupDistrictSelect ? popupDistrictSelect.value : 'towers';
    const jsonStr = window.TarangParser.towersToJSON(allTowers);
    const dateStr = new Date().toISOString().slice(0, 10);
    triggerDownload(jsonStr, `tarangsanchar_${dist}_${dateStr}.json`, 'application/json;charset=utf-8;');
  });

  // ── Direct 1-Click Push to Nexus RF Engine (localhost:8000) ────────────────
  btnPushNexus.addEventListener('click', () => {
    if (allTowers.length === 0) {
      alert('No captured towers to push! Run Fast Fetch first.');
      return;
    }

    btnPushNexus.textContent = 'Pushing…';
    btnPushNexus.disabled = true;

    chrome.runtime.sendMessage({ action: 'PUSH_TO_NEXUS_RF', apiUrl: 'http://127.0.0.1:8000/api/import' }, res => {
      btnPushNexus.disabled = false;
      if (res && res.success) {
        btnPushNexus.textContent = '✅ Pushed!';
        alert(`Successfully imported ${res.count} tower sites directly into Nexus RF!`);
        setTimeout(() => {
          btnPushNexus.textContent = '🚀 Push to App';
        }, 3000);
      } else {
        btnPushNexus.textContent = '🚀 Push to App';
        alert(`Could not push to local Nexus RF: ${res?.error || 'Make sure Nexus RF backend is running on http://127.0.0.1:8000'}`);
      }
    });
  });

  // ── Clear data ─────────────────────────────────────────────────────────────
  btnClear.addEventListener('click', () => {
    if (confirm('Clear all captured sites and reset scan progress?')) {
      chrome.runtime.sendMessage({ action: 'CLEAR_TOWERS' }, () => {
        allTowers = [];
        renderUI([]);
        sitesCountEl.textContent = '0';
        towersCountEl.textContent = '0';
        enrichedCountEl.textContent = '0';
        loadData();
      });
    }
  });

  // ── Auto-enrich details ───────────────────────────────────────────────────
  let isEnriching = false;
  btnFetchDetails.addEventListener('click', async () => {
    if (isEnriching) return;

    chrome.runtime.sendMessage({ action: 'GET_PENDING_SITE_IDS' }, async response => {
      const ids = (response && response.pendingIds) || [];
      if (ids.length === 0) {
        alert('All captured sites already have full operator details!');
        return;
      }

      isEnriching = true;
      btnFetchDetails.disabled = true;

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url || !tab.url.includes('tarangsanchar.gov.in')) {
        alert('Please open and stay on the Tarang Sanchar tab while fetching details.');
        isEnriching = false;
        btnFetchDetails.disabled = false;
        return;
      }

      let count = 0;
      for (const siteId of ids) {
        btnFetchDetails.textContent = `Enriching (${count}/${ids.length})...`;
        chrome.tabs.sendMessage(tab.id, { action: 'TRIGGER_SITE_DETAIL_FETCH', siteId });
        count++;
        await new Promise(r => setTimeout(r, 650));
        loadData();
      }

      btnFetchDetails.textContent = '⚡ Auto-Enrich Real Operators (Jio/Airtel/Vi/BSNL)';
      btnFetchDetails.disabled = false;
      isEnriching = false;
      loadData();
    });
  });

  // ── Cloud Worker Session Handover ──────────────────────────────────────────
  const btnSyncCloudSession = document.getElementById('btn-sync-cloud-session');
  const cloudWorkerUrlInput = document.getElementById('cloud-worker-url');
  const cloudSyncStatusEl = document.getElementById('cloud-sync-status');
  const linkCloudDashboard = document.getElementById('link-cloud-dashboard');

  if (btnSyncCloudSession) {
    chrome.storage.local.get(['cloud_worker_url'], res => {
      if (res && res.cloud_worker_url) {
        cloudWorkerUrlInput.value = res.cloud_worker_url;
        if (linkCloudDashboard) linkCloudDashboard.href = res.cloud_worker_url;
      }
    });

    cloudWorkerUrlInput.addEventListener('change', () => {
      const url = cloudWorkerUrlInput.value.trim();
      chrome.storage.local.set({ cloud_worker_url: url });
      if (linkCloudDashboard) linkCloudDashboard.href = url;
    });

    btnSyncCloudSession.addEventListener('click', () => {
      const cloudUrl = (cloudWorkerUrlInput.value || 'http://127.0.0.1:8001').trim();
      btnSyncCloudSession.textContent = 'Sending...';
      btnSyncCloudSession.disabled = true;
      cloudSyncStatusEl.textContent = 'Extracting active Tarang Sanchar session cookies...';
      cloudSyncStatusEl.style.color = '#38bdf8';

      chrome.runtime.sendMessage(
        { action: 'SYNC_SESSION_TO_CLOUD_WORKER', cloudUrl },
        response => {
          btnSyncCloudSession.disabled = false;
          btnSyncCloudSession.textContent = '🚀 Send Session';

          if (response && response.success) {
            cloudSyncStatusEl.textContent = '✅ Session synced to Cloud Worker! You can now close this tab.';
            cloudSyncStatusEl.style.color = '#10b981';
            alert(
              `Session successfully handed over to Cloud Worker at ${cloudUrl}!\n\n` +
              `The Cloud Worker is now ready to scrape towers 24/7 autonomously.\n` +
              `Click "Open Dashboard ↗" to view real-time progress and start sweeping!`
            );
          } else {
            cloudSyncStatusEl.textContent = `❌ ${response?.error || 'Failed to sync session.'}`;
            cloudSyncStatusEl.style.color = '#ef4444';
            alert(`Session handover failed: ${response?.error || 'Unknown error'}`);
          }
        }
      );
    });
  }

  loadData();
});
