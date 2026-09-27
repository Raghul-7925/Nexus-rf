/**
 * Popup Script:
 * - Controls live stats and preview filtering.
 * - Auto-Grid Scanner (Slide by Slide, persistent resume).
 * - Raw Mode CSV export (pure locations & types with null operator/band).
 * - Full CSV export with multi-operator breakdown.
 */

document.addEventListener('DOMContentLoaded', () => {
  let allTowers = [];

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
  const btnClear = document.getElementById('btn-clear');
  const btnFetchDetails = document.getElementById('btn-fetch-details');

  // Scanner UI elements
  const scanBadgeEl = document.getElementById('scan-progress-badge');
  const scanFillEl = document.getElementById('scan-progress-fill');
  const btnToggleScan = document.getElementById('btn-toggle-scan');
  const btnResetScan = document.getElementById('btn-reset-scan');
  const rawModeToggle = document.getElementById('raw-mode-toggle');

  const popupStartLat = document.getElementById('popup-start-lat');
  const popupStartLng = document.getElementById('popup-start-lng');
  const popupEndLat = document.getElementById('popup-end-lat');
  const popupEndLng = document.getElementById('popup-end-lng');
  const popupSlideCount = document.getElementById('popup-slide-count');
  const btnPopupUseView = document.getElementById('btn-popup-use-view');

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
    if (scan.startLat && popupStartLat && !popupStartLat.value) {
      popupStartLat.value = scan.startLat;
      popupStartLng.value = scan.startLng;
      popupEndLat.value = scan.endLat;
      popupEndLng.value = scan.endLng;
      updatePopupSlideCount();
    }

    if (scan.totalTiles > 0) {
      const pct = Math.round((scan.completedCount / scan.totalTiles) * 100);
      scanFillEl.style.width = `${pct}%`;

      if (scan.isScanning) {
        scanBadgeEl.textContent = `Scanning: ${scan.completedCount}/${scan.totalTiles} slides (${pct}%)`;
        btnToggleScan.textContent = '⏸ Pause Scan';
        btnToggleScan.style.background = '#f59e0b';
      } else if (scan.isPaused) {
        scanBadgeEl.textContent = `Paused at ${scan.completedCount}/${scan.totalTiles} slides`;
        btnToggleScan.textContent = '▶ Resume Scan';
        btnToggleScan.style.background = '#0284c7';
      } else if (scan.completedCount >= scan.totalTiles) {
        scanBadgeEl.textContent = `All ${scan.totalTiles} slides completed!`;
        btnToggleScan.textContent = '▶ Scan Again';
        btnToggleScan.style.background = '#10b981';
      }
    } else {
      scanFillEl.style.width = '0%';
      scanBadgeEl.textContent = 'Ready (Slide by Slide)';
      btnToggleScan.textContent = '▶ Start Auto-Scan';
      btnToggleScan.style.background = '#0284c7';
    }
  }

  function renderUI(towers) {
    const opCounts = {};
    const techCounts = {};

    towers.forEach(t => {
      const op = t.operator || 'Unknown';
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

      if (type === 'op') {
        const lower = name.toLowerCase();
        if (lower.includes('jio')) tag.classList.add('tag-jio');
        else if (lower.includes('airtel')) tag.classList.add('tag-airtel');
        else if (lower.includes('vi') || lower.includes('idea') || lower.includes('vodafone')) tag.classList.add('tag-vi');
        else if (lower.includes('bsnl')) tag.classList.add('tag-bsnl');
      }

      tag.textContent = `${name}: ${count}`;
      container.appendChild(tag);
    });
  }

  function renderTable(towers) {
    towersBodyEl.innerHTML = '';

    const filter = (searchInput.value || '').trim().toLowerCase();
    const isRaw = rawModeToggle.checked;

    const filtered = towers.filter(t => {
      if (!filter) return true;
      return (
        (t.operator && t.operator.toLowerCase().includes(filter)) ||
        (t.site_id && t.site_id.toLowerCase().includes(filter)) ||
        (t.technology && t.technology.toLowerCase().includes(filter))
      );
    });

    if (filtered.length === 0) {
      towersBodyEl.innerHTML = `<tr><td colspan="5" class="empty-state">${
        filter ? 'No towers match your search.' : 'No towers captured yet.'
      }</td></tr>`;
      return;
    }

    const preview = filtered.slice(0, 50);
    preview.forEach(t => {
      const tr = document.createElement('tr');
      const opDisplay = isRaw ? '<em class="text-slate-500">null</em>' : escapeHtml(t.operator || 'Unknown');
      const techDisplay = isRaw ? '<em class="text-slate-500">null</em>' : escapeHtml(t.technology || '4G');

      tr.innerHTML = `
        <td><strong>${opDisplay}</strong></td>
        <td>${techDisplay}</td>
        <td title="${escapeHtml(t.site_id || '')}">${escapeHtml(t.site_id || 'N/A')}</td>
        <td>${t.latitude ? t.latitude.toFixed(4) : '-'}, ${t.longitude ? t.longitude.toFixed(4) : '-'}</td>
        <td>${escapeHtml(t.tower_type || 'Rooftop')}</td>
      `;
      towersBodyEl.appendChild(tr);
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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

  searchInput.addEventListener('input', () => {
    renderTable(allTowers);
  });

  rawModeToggle.addEventListener('change', () => {
    renderTable(allTowers);
  });

  // Use visible map view
  if (btnPopupUseView) {
    btnPopupUseView.addEventListener('click', async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) return;
      chrome.tabs.sendMessage(tab.id, { action: 'TRIGGER_POPULATE_VIEWPORT' }, () => {
        setTimeout(() => {
          chrome.runtime.sendMessage({ action: 'GET_SCAN_STATUS' }, scan => {
            if (scan && scan.startLat) {
              popupStartLat.value = scan.startLat;
              popupStartLng.value = scan.startLng;
              popupEndLat.value = scan.endLat;
              popupEndLng.value = scan.endLng;
              updatePopupSlideCount();
            }
          });
        }, 350);
      });
    });
  }

  // Toggle Auto-Scan
  btnToggleScan.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !tab.url.includes('tarangsanchar.gov.in')) {
      alert('Please switch to the Tarang Sanchar tab to start or resume Auto-Scan.');
      return;
    }

    // Check current scan status
    chrome.runtime.sendMessage({ action: 'GET_SCAN_STATUS' }, scan => {
      if (scan && scan.isScanning) {
        chrome.runtime.sendMessage({ action: 'PAUSE_SCAN' }, () => {
          loadData();
        });
      } else {
        const sLat = parseFloat(popupStartLat.value);
        const sLng = parseFloat(popupStartLng.value);
        const eLat = parseFloat(popupEndLat.value);
        const eLng = parseFloat(popupEndLng.value);

        if (isNaN(sLat) || isNaN(sLng) || isNaN(eLat) || isNaN(eLng)) {
          alert('Please enter Start and End coordinates or click "Use Map View" first!');
          return;
        }

        // Start or Resume scan
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
              // Trigger active tab content loop
              chrome.tabs.sendMessage(tab.id, { action: 'TRIGGER_RESUME_SCAN_LOOP' }, () => {});
            }
          }
        );
      }
    });
  });

  // Reset Scan
  btnResetScan.addEventListener('click', () => {
    if (confirm('Stop Auto-Scan and reset progress grid?')) {
      chrome.runtime.sendMessage({ action: 'RESET_SCAN' }, () => {
        loadData();
      });
    }
  });

  // Export RAW CSV (Locations & Types Only, Null Operator & Band)
  btnExportRawCsv.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'GET_RAW_CSV' }, response => {
      if (!response || !response.csv) {
        alert('No towers captured yet. Start Auto-Scan or pan the map on Tarang Sanchar first!');
        return;
      }
      const dateStr = new Date().toISOString().slice(0, 10);
      triggerDownload(response.csv, `tarangsanchar_raw_locations_${dateStr}.csv`, 'text/csv;charset=utf-8;');
    });
  });

  // Export Full CSV (With Operators & Bands)
  btnExportCsv.addEventListener('click', () => {
    if (allTowers.length === 0) {
      alert('No towers captured yet. Start Auto-Scan or pan the map on Tarang Sanchar first!');
      return;
    }
    const csv = window.TarangParser.towersToCSV(allTowers);
    const dateStr = new Date().toISOString().slice(0, 10);
    triggerDownload(csv, `tarangsanchar_full_towers_${dateStr}.csv`, 'text/csv;charset=utf-8;');
  });

  // Export JSON
  btnExportJson.addEventListener('click', () => {
    if (allTowers.length === 0) {
      alert('No towers captured yet. Start Auto-Scan or pan the map on Tarang Sanchar first!');
      return;
    }
    const jsonStr = window.TarangParser.towersToJSON(allTowers);
    const dateStr = new Date().toISOString().slice(0, 10);
    triggerDownload(jsonStr, `tarangsanchar_towers_${dateStr}.json`, 'application/json;charset=utf-8;');
  });

  // Clear data
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

  // Auto-enrich details
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

  loadData();
});
