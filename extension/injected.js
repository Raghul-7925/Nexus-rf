/**
 * Injected Script: Runs in the page's execution context.
 * Intercepts window.fetch and window.XMLHttpRequest to sniff Tarang Sanchar responses.
 * Also provides coordinate picking and map viewport bounds capture for Auto-Scanner.
 */

(function () {
  'use strict';

  if (window.__TARANG_INJECTED_ACTIVE__) return;
  window.__TARANG_INJECTED_ACTIVE__ = true;

  console.log('[Nexus RF] Tarang Sanchar Network Sniffer & Coordinate Picker initialized.');

  let lastCapturedBounds = null;

  function trackBoundsFromUrl(url) {
    if (!url || typeof url !== 'string') return;
    if (url.includes('GetLocations')) {
      try {
        const u = new URL(url, window.location.origin);
        const neLat = parseFloat(u.searchParams.get('NELat'));
        const swLat = parseFloat(u.searchParams.get('SWLat'));
        const neLng = parseFloat(u.searchParams.get('NELng'));
        const swLng = parseFloat(u.searchParams.get('SWLng'));
        if (!isNaN(neLat) && !isNaN(swLat) && !isNaN(neLng) && !isNaN(swLng)) {
          lastCapturedBounds = {
            neLat: Number(neLat.toFixed(5)),
            swLat: Number(swLat.toFixed(5)),
            neLng: Number(neLng.toFixed(5)),
            swLng: Number(swLng.toFixed(5))
          };
        }
      } catch (e) {}
    }
  }

  function processResponse(text, url) {
    if (!text || typeof text !== 'string') return;
    trackBoundsFromUrl(url);

    if (typeof window.TarangParser === 'undefined') return;

    try {
      const data = JSON.parse(text);
      const result = window.TarangParser.extractTowersFromPayload(data, url);

      if (Array.isArray(result) && result.length > 0) {
        console.log(`[Nexus RF] 📡 Sniffed ${result.length} towers from: ${url.slice(0, 100)}`);
        window.postMessage(
          {
            source: 'TARANG_SNIFFER',
            type: 'TOWERS_CAPTURED',
            towers: result,
            url: url
          },
          '*'
        );
      } else if (result && result.isDetail) {
        console.log(`[Nexus RF] 📋 Sniffed details for Site ${result.site_id}:`, result.operators);
        window.postMessage(
          {
            source: 'TARANG_SNIFFER',
            type: 'SITE_DETAILS_CAPTURED',
            detail: result,
            url: url
          },
          '*'
        );
      }
    } catch (e) {
      // Non-JSON response, ignore safely
    }
  }

  // --- 1. Intercept window.fetch ---
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);
    try {
      const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
      if (
        url.includes('GetLocations') ||
        url.includes('GetLocationDetails') ||
        url.includes('SiteFinder') ||
        url.includes('query')
      ) {
        const clone = response.clone();
        clone.text().then(txt => processResponse(txt, url)).catch(() => {});
      }
    } catch (err) {
      // Safe fail
    }
    return response;
  };

  // --- 2. Intercept XMLHttpRequest ---
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._snifferUrl = typeof url === 'string' ? url : String(url);
    return originalOpen.apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener('load', function () {
      try {
        if (this.status >= 200 && this.status < 300 && this.responseText) {
          processResponse(this.responseText, this._snifferUrl || '');
        }
      } catch (e) {
        // Safe fail
      }
    });
    return originalSend.apply(this, args);
  };

  // Helper to resolve current page map bounds
  function getResolvedBounds() {
    if (lastCapturedBounds) {
      return lastCapturedBounds;
    }

    // Try Leaflet on window.map or DOM
    let leafletMap = window.map;
    if (!leafletMap || typeof leafletMap.getBounds !== 'function') {
      const el = document.querySelector('.leaflet-container');
      if (el && el._leaflet_map) leafletMap = el._leaflet_map;
    }
    if (leafletMap && typeof leafletMap.getBounds === 'function') {
      try {
        const b = leafletMap.getBounds();
        return {
          swLat: Number(b.getSouthWest().lat.toFixed(5)),
          swLng: Number(b.getSouthWest().lng.toFixed(5)),
          neLat: Number(b.getNorthEast().lat.toFixed(5)),
          neLng: Number(b.getNorthEast().lng.toFixed(5))
        };
      } catch (e) {}
    }

    // Try Google Maps
    if (window.google && window.google.maps && window.map && typeof window.map.getBounds === 'function') {
      try {
        const b = window.map.getBounds();
        if (b) {
          return {
            swLat: Number(b.getSouthWest().lat().toFixed(5)),
            swLng: Number(b.getSouthWest().lng().toFixed(5)),
            neLat: Number(b.getNorthEast().lat().toFixed(5)),
            neLng: Number(b.getNorthEast().lng().toFixed(5))
          };
        }
      } catch (e) {}
    }

    return null;
  }

  // --- 3. Listen for requests from content script ---
  window.addEventListener('message', async event => {
    if (event.source !== window || !event.data) return;

    // Single site details query
    if (event.data.source === 'TARANG_CONTENT' && event.data.type === 'TRIGGER_FETCH_SITE_DETAILS') {
      const siteId = event.data.siteId;
      if (siteId) {
        fetch(`/EMFPortal/SiteFinder/GetLocationDetails?SiteId=${siteId}&_=${Date.now()}`)
          .catch(() => {});
      }
    }

    // Auto-scan slide tile query
    if (event.data.source === 'TARANG_CONTENT' && event.data.type === 'TRIGGER_FETCH_LOCATIONS_TILE') {
      const { neLat, swLat, neLng, swLng, tileId } = event.data;
      try {
        const url = `/EMFPortal/SiteFinder/GetLocations?NELat=${neLat}&SWLat=${swLat}&NELng=${neLng}&SWLng=${swLng}&_=${Date.now()}`;
        const res = await fetch(url);
        const txt = await res.text();
        processResponse(txt, url);
        window.postMessage({ source: 'TARANG_SNIFFER', type: 'TILE_FETCH_DONE', tileId, success: true }, '*');
      } catch (err) {
        window.postMessage({ source: 'TARANG_SNIFFER', type: 'TILE_FETCH_DONE', tileId, success: false }, '*');
      }
    }

    // Request current page bounds (for "Use Current Map View")
    if (event.data.source === 'TARANG_CONTENT' && event.data.type === 'REQUEST_PAGE_BOUNDS') {
      const bounds = getResolvedBounds();
      window.postMessage({ source: 'TARANG_SNIFFER', type: 'PAGE_BOUNDS_RESPONSE', bounds }, '*');
    }

    // Start Interactive Map Point Picker (Click to set Start / End point)
    if (event.data.source === 'TARANG_CONTENT' && event.data.type === 'START_MAP_PICKER') {
      const target = event.data.target; // 'start' or 'end'

      const finishPick = (lat, lng) => {
        window.postMessage({
          source: 'TARANG_SNIFFER',
          type: 'MAP_POINT_PICKED',
          target,
          lat: Number(lat.toFixed(5)),
          lng: Number(lng.toFixed(5))
        }, '*');
      };

      // 1. Try Leaflet
      let leafletMap = window.map;
      if (!leafletMap || typeof leafletMap.once !== 'function') {
        const el = document.querySelector('.leaflet-container');
        if (el && el._leaflet_map) leafletMap = el._leaflet_map;
      }
      if (leafletMap && typeof leafletMap.once === 'function') {
        leafletMap.once('click', e => {
          finishPick(e.latlng.lat, e.latlng.lng);
        });
        return;
      }

      // 2. Try Google Maps
      if (window.google && window.google.maps && window.map) {
        window.google.maps.event.addListenerOnce(window.map, 'click', e => {
          finishPick(e.latLng.lat(), e.latLng.lng());
        });
        return;
      }

      // 3. Fallback: Listen for click on map DOM element with bounding-box interpolation
      const mapDiv = document.querySelector('#map, #mapDiv, .leaflet-container') || document.body;
      const onMapDomClick = e => {
        mapDiv.removeEventListener('click', onMapDomClick, true);
        const rect = mapDiv.getBoundingClientRect();
        const bounds = getResolvedBounds();
        if (bounds) {
          const xPct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          const yPct = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
          const lat = bounds.neLat - yPct * (bounds.neLat - bounds.swLat);
          const lng = bounds.swLng + xPct * (bounds.neLng - bounds.swLng);
          finishPick(lat, lng);
        }
      };
      mapDiv.addEventListener('click', onMapDomClick, { capture: true, once: true });
    }

    // Pan map to coordinates (e.g. when district is selected)
    if (event.data.source === 'TARANG_CONTENT' && event.data.type === 'PAN_TO_COORDS') {
      const { lat, lng, zoom } = event.data;
      try {
        let leafletMap = window.map;
        if (!leafletMap || typeof leafletMap.setView !== 'function') {
          const el = document.querySelector('.leaflet-container');
          if (el && el._leaflet_map) leafletMap = el._leaflet_map;
        }
        if (leafletMap && typeof leafletMap.setView === 'function') {
          leafletMap.setView([lat, lng], zoom || 12);
        } else if (window.google && window.google.maps && window.map && typeof window.map.setCenter === 'function') {
          window.map.setCenter({ lat, lng });
          if (zoom) window.map.setZoom(zoom);
        }
      } catch (e) {}
    }
  });
})();
