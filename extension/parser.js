/**
 * Tarang Sanchar Tower Data Extractor - Normalizer & Heuristic Parser
 * Specifically updated based on tarangsanchar.gov.in network payloads (GetLocations, GetLocationDetails).
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TarangParser = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Coordinate bounding box for India
  const INDIA_BOUNDS = {
    minLat: 6.0,
    maxLat: 38.0,
    minLng: 68.0,
    maxLng: 98.0
  };

  /**
   * Convert Web Mercator (EPSG:3857) to WGS84 (EPSG:4326) [lat, lng]
   */
  function webMercatorToWgs84(x, y) {
    const lng = (x / 20037508.34) * 180.0;
    let lat = (y / 20037508.34) * 180.0;
    lat = (180.0 / Math.PI) * (2 * Math.atan(Math.exp((lat * Math.PI) / 180.0)) - Math.PI / 2);
    return [lat, lng];
  }

  /**
   * Normalize operator names to standard Nexus RF identifiers
   */
  function normalizeOperator(raw) {
    if (!raw || typeof raw !== 'string') return 'Airtel';
    const s = raw.trim().toUpperCase();
    if (s.includes('AIRTEL') || s.includes('BHARTI')) return 'Airtel';
    if (s.includes('JIO') || s.includes('RELIANCE') || s.includes('RJIL')) return 'Jio';
    if (s.includes('VODAFONE') || s.includes('IDEA') || s.includes('VI') || s.includes('VIL')) return 'Vi';
    if (s.includes('BSNL') || s.includes('MTNL') || s.includes('CELLONE')) return 'BSNL';
    return raw.trim();
  }

  /**
   * Normalize technology identifier
   */
  function normalizeTechnology(raw) {
    if (!raw || typeof raw !== 'string') return '4G';
    const s = raw.trim().toUpperCase();
    if (s.includes('5G') || s.includes('NR')) return '5G';
    if (s.includes('4G') || s.includes('LTE')) return '4G';
    if (s.includes('3G') || s.includes('UMTS') || s.includes('WCDMA')) return '3G';
    if (s.includes('2G') || s.includes('GSM')) return '2G';
    return '4G';
  }

  /**
   * Derive default frequency band in MHz based on operator and tech
   */
  function deriveDefaultBand(operator, tech, rawBand) {
    if (rawBand) {
      const num = parseFloat(String(rawBand).replace(/[^0-9.]/g, ''));
      if (!isNaN(num) && num > 100 && num < 10000) {
        return num;
      }
    }

    if (tech === '5G') return 3500;
    if (operator === 'Jio') return tech === '5G' ? 3500 : 2300;
    if (operator === 'Airtel') return tech === '5G' ? 3500 : (tech === '4G' ? 1800 : (tech === '3G' ? 2100 : 900));
    if (operator === 'Vi') return tech === '4G' ? 1800 : 900;
    if (operator === 'BSNL') {
      if (tech === '5G') return 3500;
      if (tech === '4G') return 700; // Band 28 (700 MHz) primary sub-GHz 4G allocation
      if (tech === '3G') return 2100;
      return 900; // 2G GSM
    }
    return 1800;
  }

  /**
   * Normalize tower type and color code based on Tarang Sanchar map marker colors:
   * 🔵 Blue (Cinema, Theatre, Mall, Multiplex, Club) -> Rooftop (Blue)
   * 🟢 Green (Shop, Ground, Hotel, School, Tower, Mast) -> Ground Based (Green)
   * 🩷 Pink (Cafe, Restaurant, Wall, Pole) -> Wall Mount (Pink)
   * 🟠 Orange (COW, Mobile, Temporary) -> COW (Orange)
   */
  function normalizeTowerTypeAndColor(raw, category) {
    if (category) {
      const cat = String(category).trim().toLowerCase();
      // 🔵 Blue: Rooftop commercial / buildings
      if (['cinema', 'theatre', 'theater', 'mall', 'multiplex', 'club', 'roof', 'rtt'].some(k => cat.includes(k))) {
        return { type: 'Rooftop (Blue)', color: 'Blue' };
      }
      // 🟢 Green: Ground Based Tower / Mast
      if (['shop', 'ground', 'hotel', 'school', 'tower', 'mast', 'gbt', 'gbm'].some(k => cat.includes(k))) {
        return { type: 'Ground Based (Green)', color: 'Green' };
      }
      // 🩷 Pink: Wall mount / Pole / Microcell
      if (['cafe', 'restaurant', 'wall', 'pole', 'wmt', 'micro'].some(k => cat.includes(k))) {
        return { type: 'Wall Mount (Pink)', color: 'Pink' };
      }
      // 🟠 Orange: COW / Temporary
      if (['cow', 'wheel', 'temp', 'mobile'].some(k => cat.includes(k))) {
        return { type: 'COW (Orange)', color: 'Orange' };
      }
    }
    if (raw && typeof raw === 'string') {
      const s = raw.trim().toUpperCase();
      if (s.includes('WALL') || s.includes('POLE') || s.includes('WMT') || s.includes('PINK')) {
        return { type: 'Wall Mount (Pink)', color: 'Pink' };
      }
      if (s.includes('GROUND') || s.includes('GBT') || s.includes('GBM') || s.includes('MAST') || s.includes('GREEN')) {
        return { type: 'Ground Based (Green)', color: 'Green' };
      }
      if (s.includes('ROOF') || s.includes('RTT') || s.includes('BUILDING') || s.includes('BLUE')) {
        return { type: 'Rooftop (Blue)', color: 'Blue' };
      }
      if (s.includes('COW') || s.includes('WHEEL') || s.includes('ORANGE')) {
        return { type: 'COW (Orange)', color: 'Orange' };
      }
    }
    return { type: 'Rooftop (Blue)', color: 'Blue' };
  }

  function normalizeTowerType(raw, category) {
    return normalizeTowerTypeAndColor(raw, category).type;
  }

  /**
   * Check if lat/lng looks valid for India
   */
  function isValidIndiaCoord(lat, lng) {
    return (
      typeof lat === 'number' &&
      typeof lng === 'number' &&
      !isNaN(lat) &&
      !isNaN(lng) &&
      lat >= INDIA_BOUNDS.minLat &&
      lat <= INDIA_BOUNDS.maxLat &&
      lng >= INDIA_BOUNDS.minLng &&
      lng <= INDIA_BOUNDS.maxLng
    );
  }

  /**
   * Parse operator string from Tarang Sanchar GetLocationDetails
   * e.g., "VI - 2G, 4G, Airtel - 2G, 4G, 5G" or "VI - 2G, 4G"
   */
  function parseOperatorsString(str) {
    if (!str || typeof str !== 'string') return [];
    // Split by comma followed by "<Name> -"
    const parts = str.split(/(?:,\s*)(?=[A-Za-z\s]+-\s*)/);
    const results = [];
    for (const part of parts) {
      const dashIdx = part.indexOf('-');
      if (dashIdx !== -1) {
        const opRaw = part.slice(0, dashIdx).trim();
        const techListRaw = part.slice(dashIdx + 1).trim();
        const op = normalizeOperator(opRaw);
        const techs = techListRaw
          .split(',')
          .map(t => normalizeTechnology(t))
          .filter(Boolean);

        for (const tech of techs) {
          results.push({
            operator: op,
            technology: tech,
            band: deriveDefaultBand(op, tech)
          });
        }
      }
    }
    return results;
  }

  /**
   * Resolve coordinates from varied property naming conventions
   */
  function extractCoordinates(item) {
    let lat = null;
    let lng = null;

    // Check GeoJSON geometry: [lng, lat]
    if (item.geometry && Array.isArray(item.geometry.coordinates)) {
      lng = item.geometry.coordinates[0];
      lat = item.geometry.coordinates[1];
    } else if (item.geometry && typeof item.geometry.x === 'number' && typeof item.geometry.y === 'number') {
      const x = item.geometry.x;
      const y = item.geometry.y;
      if (Math.abs(x) > 180 || Math.abs(y) > 90) {
        const [wgsLat, wgsLng] = webMercatorToWgs84(x, y);
        lat = wgsLat;
        lng = wgsLng;
      } else {
        lat = y;
        lng = x;
      }
    }

    // Direct properties, including Tarang Sanchar location_latitude / location_longitude
    const props = item.attributes || item.properties || item;
    if (lat === null || lng === null) {
      const latVal =
        props.location_latitude ||
        props.latitude ||
        props.LATITUDE ||
        props.lat ||
        props.LAT ||
        props.Latitude ||
        props.y ||
        props.Y;
      const lngVal =
        props.location_longitude ||
        props.longitude ||
        props.LONGITUDE ||
        props.lng ||
        props.LON ||
        props.LONG ||
        props.Longitude ||
        props.x ||
        props.X;

      if (latVal !== undefined && lngVal !== undefined) {
        let parsedLat = parseFloat(latVal);
        let parsedLng = parseFloat(lngVal);

        if (Math.abs(parsedLng) > 180 || Math.abs(parsedLat) > 90) {
          const [wgsLat, wgsLng] = webMercatorToWgs84(parsedLng, parsedLat);
          parsedLat = wgsLat;
          parsedLng = wgsLng;
        }

        // Swap if lat/lng were inverted
        if (
          parsedLat >= INDIA_BOUNDS.minLng &&
          parsedLat <= INDIA_BOUNDS.maxLng &&
          parsedLng >= INDIA_BOUNDS.minLat &&
          parsedLng <= INDIA_BOUNDS.maxLat
        ) {
          const tmp = parsedLat;
          parsedLat = parsedLng;
          parsedLng = tmp;
        }

        lat = parsedLat;
        lng = parsedLng;
      }
    }

    if (isValidIndiaCoord(lat, lng)) {
      return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
    }
    return null;
  }

  /**
   * Normalize an extracted record into a clean Nexus RF tower model
   */
  function normalizeTowerRecord(item, category = null) {
    const coords = extractCoordinates(item);
    if (!coords) return null;

    const props = item.attributes || item.properties || item;

    // Tarang Sanchar uses url_point for Site ID
    const siteId = String(
      props.url_point ||
      props.site_id ||
      props.SITE_ID ||
      props.siteid ||
      props.SITEID ||
      props.tower_id ||
      props.TOWER_ID ||
      props.site_name ||
      props.id ||
      props.ID ||
      ''
    ).trim() || `TS-${coords.lat.toFixed(4)}-${coords.lng.toFixed(4)}`;

    const rawOp =
      props.operator ||
      props.OPERATOR ||
      props.tsp ||
      props.TSP ||
      props.tsp_name ||
      props.TSP_NAME ||
      props.operator_name ||
      props.OperatorName ||
      '';
    const operator = rawOp ? normalizeOperator(rawOp) : 'Airtel';

    const rawTech =
      props.technology ||
      props.TECHNOLOGY ||
      props.tech ||
      props.TECH ||
      props.bts_tech ||
      props.Generation ||
      '';
    const technology = rawTech ? normalizeTechnology(rawTech) : '4G';

    const rawBand = props.band || props.BAND || props.frequency || props.FREQUENCY || props.freq_mhz || props.freq;
    const band = deriveDefaultBand(operator, technology, rawBand);

    const cellId = String(props.cell_id || props.CELL_ID || props.cellid || props.bts_id || '').trim() || '';

    const towerType = normalizeTowerType(props.tower_type || props.STRUCTURE_TYPE, category || props.category);
    const rawHeight = parseFloat(props.height || props.HEIGHT || props.height_m || props.tower_height);
    const defaultHeight = towerType === 'Ground' ? 35.0 : (towerType === 'WallMount' ? 12.0 : 25.0);
    const height = !isNaN(rawHeight) && rawHeight > 3 && rawHeight < 150
      ? Number(rawHeight.toFixed(1))
      : defaultHeight;

    const rawPower = parseFloat(props.power || props.POWER || props.power_dbm || props.eirp);
    const defaultPower = towerType === 'WallMount' ? 37.0 : 43.0;
    const power = !isNaN(rawPower) && rawPower > 10 && rawPower < 70 ? Number(rawPower.toFixed(1)) : defaultPower;

    const uniqueKey = `${siteId}__${operator}__${coords.lat}__${coords.lng}__${technology}`;

    return {
      key: uniqueKey,
      name: `${operator} Site ${siteId}`,
      site_id: siteId,
      cell_id: cellId,
      latitude: coords.lat,
      longitude: coords.lng,
      operator: operator,
      band: band,
      technology: technology,
      height: height,
      power: power,
      tower_type: towerType,
      category: category || props.category || 'Tower',
      source: 'tarangsanchar'
    };
  }

  /**
   * Search and extract all tower candidates from an arbitrary payload or Tarang Sanchar response
   */
  function extractTowersFromPayload(payload, url = '') {
    const results = [];
    const seenKeys = new Set();

    // Special Check: Tarang Sanchar GetLocations endpoint
    // Payload structure: [ { "Cinema": [ ... ], "Shop": [ ... ], "Club": [ ... ], "Cafe": [ ... ] } ]
    if (Array.isArray(payload) && payload.length > 0 && typeof payload[0] === 'object') {
      let isTarangLocations = false;
      for (const group of payload) {
        if (group && (group.Shop || group.Cinema || group.Club || group.Cafe)) {
          isTarangLocations = true;
          for (const [category, items] of Object.entries(group)) {
            if (Array.isArray(items)) {
              for (const item of items) {
                const tower = normalizeTowerRecord(item, category);
                if (tower && !seenKeys.has(tower.key)) {
                  seenKeys.add(tower.key);
                  results.push(tower);
                }
              }
            }
          }
        }
      }
      if (isTarangLocations) {
        return results;
      }
    }

    // Special Check: Tarang Sanchar GetLocationDetails endpoint
    // Payload: { "image_url": "...", "operators": "VI - 2G, 4G, Airtel - 2G, 4G, 5G", "address": "..." }
    if (payload && typeof payload === 'object' && payload.operators && typeof payload.operators === 'string') {
      let siteId = null;
      if (url) {
        const match = url.match(/[?&]SiteId=([0-9A-Za-z_-]+)/i);
        if (match) siteId = match[1];
      }
      const parsedOps = parseOperatorsString(payload.operators);
      return {
        isDetail: true,
        site_id: siteId,
        operators: parsedOps,
        address: payload.address || '',
        siteCompliance: payload.siteCompliance || ''
      };
    }

    // Generic recursive descent parser for other GIS payloads
    function visit(node, depth) {
      if (!node || depth > 8) return;

      if (Array.isArray(node)) {
        for (let i = 0; i < node.length; i++) {
          visit(node[i], depth + 1);
        }
        return;
      }

      if (typeof node === 'object') {
        const tower = normalizeTowerRecord(node);
        if (tower) {
          if (!seenKeys.has(tower.key)) {
            seenKeys.add(tower.key);
            results.push(tower);
          }
          return;
        }

        for (const key of Object.keys(node)) {
          const val = node[key];
          if (val && typeof val === 'object') {
            visit(val, depth + 1);
          }
        }
      }
    }

    visit(payload, 0);
    return results;
  }

  /**
   * Convert an array of towers to Nexus RF CSV
   */
  function towersToCSV(towers) {
    const headers = [
      'site_id',
      'latitude',
      'longitude',
      'operator',
      'band',
      'technology',
      'height',
      'power',
      'tower_type',
      'cell_id'
    ];

    const lines = [headers.join(',')];
    for (const t of towers) {
      const row = [
        `"${(t.site_id || '').replace(/"/g, '""')}"`,
        t.latitude,
        t.longitude,
        `"${(t.operator || '').replace(/"/g, '""')}"`,
        t.band,
        `"${(t.technology || '').replace(/"/g, '""')}"`,
        t.height,
        t.power,
        `"${(t.tower_type || 'Rooftop').replace(/"/g, '""')}"`,
        `"${(t.cell_id || '').replace(/"/g, '""')}"`
      ];
      lines.push(row.join(','));
    }
    return lines.join('\n');
  }

  /**
   * Convert an array of towers to Nexus RF JSON
   */
  function towersToJSON(towers) {
    const cleaned = towers.map(t => ({
      site_id: t.site_id,
      name: t.name || `${t.operator} ${t.site_id}`,
      latitude: t.latitude,
      longitude: t.longitude,
      operator: t.operator,
      band: t.band,
      technology: t.technology,
      height: t.height,
      power: t.power,
      tower_type: t.tower_type,
      cell_id: t.cell_id || '',
      address: t.address || '',
      source: 'tarangsanchar'
    }));
    return JSON.stringify(cleaned, null, 2);
  }

  /**
   * Convert sites to Raw Mode CSV
   * Contains ONLY: location coordinate, tower type based on colour code, and location city name
   * No extra data columns.
   */
  function sitesToRawCSV(sites) {
    const headers = [
      'site_id',
      'latitude',
      'longitude',
      'tower_type',
      'color_code',
      'city'
    ];

    const lines = [headers.join(',')];
    const list = Array.isArray(sites) ? sites : Object.values(sites);
    for (const s of list) {
      const cat = s.category || '';
      const towerInfo = normalizeTowerTypeAndColor(s.tower_type, cat);
      const city = s.city || s.location || s.address || s.district || s.state || '';

      const row = [
        `"${(s.site_id || '').replace(/"/g, '""')}"`,
        s.latitude,
        s.longitude,
        `"${towerInfo.type}"`,
        `"${towerInfo.color}"`,
        `"${city.replace(/"/g, '""')}"`
      ];
      lines.push(row.join(','));
    }
    return lines.join('\n');
  }

  return {
    INDIA_BOUNDS,
    webMercatorToWgs84,
    normalizeOperator,
    normalizeTechnology,
    deriveDefaultBand,
    normalizeTowerType,
    normalizeTowerTypeAndColor,
    isValidIndiaCoord,
    parseOperatorsString,
    extractCoordinates,
    normalizeTowerRecord,
    extractTowersFromPayload,
    towersToCSV,
    towersToJSON,
    sitesToRawCSV
  };
});
