import React, { useMemo, useState, useCallback, useRef } from 'react';
import Map, { NavigationControl, Marker, Source, Layer, Popup } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Tower, SimulateResponse } from '../types';
import {
  Eye, EyeOff, Upload, Locate, Trash2, Layers,
  Maximize2, Minimize2, Crosshair, CheckSquare, Square, Sparkles
} from 'lucide-react';
import { towerAPI } from '../services/api';

// ── Operator colors ────────────────────────────────────────────────────────
const OP_COLOR: Record<string, string> = {
  airtel: '#ef4444',
  jio:    '#f97316',
  vi:     '#eab308',
  bsnl:   '#22c55e',
};

function opColor(op?: string | null) {
  if (!op) return '#94a3b8';
  const l = op.toLowerCase();
  for (const [k, v] of Object.entries(OP_COLOR)) if (l.includes(k)) return v;
  return '#94a3b8';
}

// ── Tower type colors ──────────────────────────────────────────────────────
const TOWER_TYPE_COLORS: Record<string, string> = {
  ground:     '#22c55e',
  rooftop:    '#3b82f6',
  wallmount:  '#ec4899',
  'wall-mount': '#ec4899',
};

function towerTypeColor(type?: string | null) {
  if (!type) return '#22c55e';
  const k = type.toLowerCase().replace(/[\s_-]/g, '');
  return TOWER_TYPE_COLORS[k] || TOWER_TYPE_COLORS[type.toLowerCase()] || '#22c55e';
}

// ── High-Performance Hardware-Accelerated Tower Marker ──────────────────────
// Uses transform3d to prevent layout recalculations during map drag/zoom
const FastTowerMarker = React.memo(({
  color,
  size = 42,
  badge
}: {
  color: string;
  size?: number;
  badge?: string;
}) => (
  <div
    style={{
      position: 'relative',
      width: size,
      height: size,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transform: 'translate3d(0, 0, 0)',
      willChange: 'transform',
      pointerEvents: 'auto',
    }}
  >
    {/* Outer pulse aura */}
    <div
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: color,
        opacity: 0.22,
      }}
    />
    {/* Middle ring */}
    <div
      style={{
        position: 'absolute',
        width: size * 0.65,
        height: size * 0.65,
        borderRadius: '50%',
        backgroundColor: color,
        border: '2px solid #ffffff',
        boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
      }}
    />
    {/* Tower icon emoji */}
    <div
      style={{
        position: 'relative',
        zIndex: 2,
        fontSize: size * 0.38,
        lineHeight: 1,
        userSelect: 'none',
      }}
    >
      🗼
    </div>
    {/* Badge (Planned / Test) */}
    {badge && (
      <div
        style={{
          position: 'absolute',
          top: -2,
          right: -2,
          zIndex: 3,
          fontSize: 9,
          background: '#0f172a',
          border: '1px solid #ffffff',
          borderRadius: '50%',
          width: 15,
          height: 15,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
        }}
      >
        {badge}
      </div>
    )}
  </div>
));

// ── Tile sources ───────────────────────────────────────────────────────────
type BaseStyle = 'gmap' | 'osm' | 'satellite' | 'terrain' | 'dark';

const TILE_SOURCES: Record<BaseStyle, string[]> = {
  gmap:      ['https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}'],
  osm:       ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
  satellite: ['https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'],
  terrain:   ['https://tile.opentopomap.org/{z}/{x}/{y}.png'],
  dark:      ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
};

const STYLE_LABEL: Record<BaseStyle, string> = {
  gmap:      '🌐 Google Map',
  osm:       '🗺 OpenStreetMap',
  satellite: '🛰 Satellite',
  terrain:   '⛰ Terrain',
  dark:      '🌙 Dark',
};

function buildStyle(base: BaseStyle) {
  const tiles = TILE_SOURCES[base] || TILE_SOURCES.gmap;
  return {
    version: 8 as const,
    sources: { base: { type: 'raster' as const, tiles, tileSize: 256, attribution: '© Google / OSM / ESRI' } },
    layers: [{ id: 'base', type: 'raster' as const, source: 'base', minzoom: 0, maxzoom: 22 }],
  };
}

// ── Math helpers for point inspector ───────────────────────────────────────
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371.0;
  const dLat = ((lat2 - lat1) * Math.PI) / 180.0;
  const dLon = ((lon2 - lon1) * Math.PI) / 180.0;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180.0) *
      Math.cos((lat2 * Math.PI) / 180.0) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function estimateRSRP(
  towerLat: number,
  towerLng: number,
  pointLat: number,
  pointLng: number,
  freqMhz = 1800,
  powerDbm = 43,
  heightM = 30
) {
  const d = Math.max(0.02, haversineKm(towerLat, towerLng, pointLat, pointLng));
  const f = Math.max(freqMhz, 700);
  const hb = Math.max(heightM, 15);
  const hm = 1.5;
  const a_hm = (1.1 * Math.log10(f) - 0.7) * hm - (1.56 * Math.log10(f) - 0.8);
  const pl = 46.3 + 33.9 * Math.log10(f) - 13.82 * Math.log10(hb) - a_hm + (44.9 - 6.55 * Math.log10(hb)) * Math.log10(d);

  // 3-sector composite gain ~ +7 dB
  const rx = powerDbm + 7.0 - pl;
  const rsrp = Math.round(rx - 17.0);

  let quality: 'Excellent' | 'Good' | 'Fair' | 'Poor' = 'Poor';
  let bars = 1;
  let qColor = '#ef4444';
  if (rsrp >= -85) { quality = 'Excellent'; bars = 5; qColor = '#22c55e'; }
  else if (rsrp >= -100) { quality = 'Good'; bars = 4; qColor = '#3b82f6'; }
  else if (rsrp >= -110) { quality = 'Fair'; bars = 2; qColor = '#eab308'; }
  else { quality = 'Poor'; bars = 1; qColor = '#ef4444'; }

  return { distanceKm: Math.round(d * 100) / 100, rsrpDbm: rsrp, quality, bars, qColor, pathLossDb: Math.round(pl * 10) / 10 };
}

// ── Props ──────────────────────────────────────────────────────────────────
interface MapViewProps {
  towers: Tower[];
  simulationResult?: SimulateResponse | null;
  simulationResults?: SimulateResponse[] | null;
  onLocationSelect: (lat: number, lng: number) => void;
  onSiteSelect?: (towers: Tower[], switchToSim?: boolean) => void;
  onImportClick?: () => void;
  onTowersChanged?: () => void;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

type SourceFilter = 'all' | 'real' | 'test';

function getSiteSource(towers: Tower[]): 'rf_planned' | 'user_test' | 'tarangsanchar' {
  if (towers.some(t => t.source === 'rf_planned')) return 'rf_planned';
  if (towers.some(t => t.source === 'user_test' || t.source === 'manual')) return 'user_test';
  return 'tarangsanchar';
}

export const MapView: React.FC<MapViewProps> = ({
  towers,
  simulationResult,
  simulationResults,
  onLocationSelect,
  onSiteSelect,
  onImportClick,
  onTowersChanged,
  isSidebarOpen = true,
  onToggleSidebar,
}) => {
  const mapRef = useRef<any>(null);
  const [baseStyle, setBaseStyle] = useState<BaseStyle>('gmap');
  const [showTowers, setShowTowers] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [hoveredSite, setHoveredSite] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [viewState, setViewState] = useState({ longitude: 79.4861, latitude: 11.9401, zoom: 12 });

  // Multi-carrier layer toggles and opacity
  const [enabledLayers, setEnabledLayers] = useState<Record<number, boolean>>({});
  const [layerOpacity, setLayerOpacity] = useState(0.75);

  // Live mouse hover point inspection state
  const [inspectPoint, setInspectPoint] = useState<{
    lat: number;
    lng: number;
    distanceKm: number;
    rsrpDbm: number;
    quality: string;
    bars: number;
    qColor: string;
    pathLossDb: number;
    carriers: Array<{
      operator: string;
      tech: string;
      freqMhz: number;
      color: string;
      distanceKm: number;
      rsrpDbm: number;
      quality: string;
      qColor: string;
    }>;
  } | null>(null);

  // Consolidate simulation layers
  const activeSimLayers = useMemo(() => {
    if (simulationResults && simulationResults.length > 0) {
      return simulationResults;
    }
    if (simulationResult) {
      return [simulationResult];
    }
    return [];
  }, [simulationResult, simulationResults]);

  // ── Group towers into sites ───────────────────────────────────────────
  const sites = useMemo(() => {
    const groups: Record<string, Tower[]> = {};
    towers.forEach(t => {
      const key = t.site_id || t.id;
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });
    return Object.entries(groups)
      .map(([site_id, ts]) => ({
        site_id,
        towers: ts,
        lat: ts[0].lat,
        lng: ts[0].lng,
        tower_type: ts[0].tower_type ?? 'ground',
        source: getSiteSource(ts),
      }))
      .filter(site => {
        if (sourceFilter === 'all') return true;
        if (sourceFilter === 'real') return site.source === 'tarangsanchar';
        if (sourceFilter === 'test') return site.source === 'rf_planned' || site.source === 'user_test';
        return true;
      });
  }, [towers, sourceFilter]);

  // ── Viewport culling (Solves Lag): only render visible markers ────────
  const visibleSites = useMemo(() => {
    if (!showTowers || sites.length === 0) return [];
    
    // Calculate degree span for current viewport with 25% safety margin
    const latSpan = Math.max(0.015, 360 / Math.pow(2, viewState.zoom));
    const lngSpan = Math.max(0.015, latSpan / Math.max(0.1, Math.cos((viewState.latitude * Math.PI) / 180)));
    const padLat = latSpan * 0.25;
    const padLng = lngSpan * 0.25;

    const south = viewState.latitude - latSpan / 2 - padLat;
    const north = viewState.latitude + latSpan / 2 + padLat;
    const west  = viewState.longitude - lngSpan / 2 - padLng;
    const east  = viewState.longitude + lngSpan / 2 + padLng;

    const filtered = sites.filter(s => s.lat >= south && s.lat <= north && s.lng >= west && s.lng <= east);

    // If zoomed far out (<11) and dense, cap to nearest 120 to guarantee smooth 60 FPS
    if (viewState.zoom < 11 && filtered.length > 120) {
      return filtered.slice(0, 120);
    }
    return filtered;
  }, [sites, showTowers, viewState.latitude, viewState.longitude, viewState.zoom]);

  const handleMapClick = useCallback((e: any) => {
    setHoveredSite(null);
    setConfirmDelete(null);
    onLocationSelect(e.lngLat.lat, e.lngLat.lng);
  }, [onLocationSelect]);

  // ── Real-time Hover Point Inspector (Requirement 6) ───────────────────
  const handleMapMouseMove = useCallback((e: any) => {
    if (activeSimLayers.length === 0) {
      if (inspectPoint) setInspectPoint(null);
      return;
    }

    const curLat = e.lngLat.lat;
    const curLng = e.lngLat.lng;

    // Check if within any active layer bounds
    const hitLayers = activeSimLayers.filter((layer, idx) => {
      if (enabledLayers[idx] === false) return false;
      const [south, west, north, east] = layer.bounds;
      return curLat >= south && curLat <= north && curLng >= west && curLng <= east;
    });

    if (hitLayers.length === 0) {
      if (inspectPoint) setInspectPoint(null);
      return;
    }

    // Compute metrics across all hit layers
    const carrierMetrics = hitLayers.map(l => {
      const tLat = l.tower_lat ?? (l.bounds[0] + l.bounds[2]) / 2;
      const tLng = l.tower_lng ?? (l.bounds[1] + l.bounds[3]) / 2;
      const calc = estimateRSRP(tLat, tLng, curLat, curLng, l.freq_mhz || 1800, l.power_dbm || 43, l.height_m || 30);
      return {
        operator: l.operator || 'Carrier',
        tech: l.technology || '4G',
        freqMhz: l.freq_mhz || 1800,
        color: l.color || '#22c55e',
        distanceKm: calc.distanceKm,
        rsrpDbm: calc.rsrpDbm,
        quality: calc.quality,
        bars: calc.bars,
        qColor: calc.qColor,
        pathLossDb: calc.pathLossDb,
      };
    });

    carrierMetrics.sort((a, b) => b.rsrpDbm - a.rsrpDbm);
    const top = carrierMetrics[0];

    setInspectPoint({
      lat: curLat,
      lng: curLng,
      distanceKm: top.distanceKm,
      rsrpDbm: top.rsrpDbm,
      quality: top.quality,
      bars: top.bars,
      qColor: top.qColor,
      pathLossDb: top.pathLossDb,
      carriers: carrierMetrics,
    });
  }, [activeSimLayers, enabledLayers, inspectPoint]);

  // ── Go to current location ───────────────────────────────────────────
  const handleLocate = () => {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setViewState(v => ({ ...v, longitude, latitude, zoom: 14 }));
        setLocating(false);
      },
      () => { alert('Location access denied.'); setLocating(false); }
    );
  };

  const handleDeleteSite = async (siteId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await towerAPI.deleteSite(siteId);
      setHoveredSite(null);
      setConfirmDelete(null);
      onTowersChanged?.();
    } catch { alert('Delete failed.'); }
  };

  const isDark = baseStyle === 'dark';
  const mapStyle = buildStyle(baseStyle);

  return (
    <div className={`relative w-full h-full${isDark ? ' dark-map' : ''}`}>
      <Map
        ref={mapRef}
        {...viewState}
        onMove={(e) => setViewState(e.viewState)}
        mapStyle={mapStyle as any}
        onClick={handleMapClick}
        onMouseMove={handleMapMouseMove}
        onMouseLeave={() => setInspectPoint(null)}
        style={{ width: '100%', height: '100%' }}
      >
        <NavigationControl position="bottom-right" />

        {/* ── Multi-Carrier / Multi-Band Coverage Overlays ─────────────── */}
        {activeSimLayers.map((layer, idx) => {
          if (enabledLayers[idx] === false) return null;
          return (
            <Source
              key={`${layer.tower_id || idx}-${layer.freq_mhz || idx}`}
              id={`sim-src-${idx}`}
              type="image"
              url={`data:image/png;base64,${layer.png_base64}`}
              coordinates={[
                [layer.bounds[1], layer.bounds[2]],
                [layer.bounds[3], layer.bounds[2]],
                [layer.bounds[3], layer.bounds[0]],
                [layer.bounds[1], layer.bounds[0]],
              ]}
            >
              <Layer
                id={`sim-layer-${idx}`}
                type="raster"
                paint={{ 'raster-opacity': layerOpacity }}
              />
            </Source>
          );
        })}

        {/* ── High-Performance Viewport-Culled Tower Markers ───────────── */}
        {showTowers && visibleSites.map(site => {
          const color = towerTypeColor(site.tower_type);
          const isHovered = hoveredSite === site.site_id;
          const badge = site.source === 'rf_planned' ? '🛠️' : site.source === 'user_test' ? '🧪' : undefined;
          return (
            <React.Fragment key={site.site_id}>
              <Marker
                longitude={site.lng}
                latitude={site.lat}
                anchor="center"
                onClick={(e) => {
                  e.originalEvent.stopPropagation();
                  setHoveredSite(isHovered ? null : site.site_id);
                  setConfirmDelete(null);
                }}
              >
                <div className={`cursor-pointer transition-transform duration-150 ${isHovered ? 'scale-125 z-30' : 'hover:scale-110 z-10'}`}>
                  <FastTowerMarker color={color} size={isHovered ? 48 : 38} badge={badge} />
                </div>
              </Marker>

              {isHovered && (
                <Popup
                  longitude={site.lng}
                  latitude={site.lat}
                  anchor="bottom"
                  offset={24}
                  closeButton={false}
                  className="z-50 min-w-[250px]"
                >
                  <div className="p-2 text-slate-800 text-sm" onMouseLeave={() => !confirmDelete && setHoveredSite(null)}>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 border-b border-slate-200 pb-1.5 mb-1.5">
                      <div>
                        <div className="font-bold text-base leading-tight">
                          {site.towers[0].site_id || site.towers[0].name}
                        </div>
                        <div className="text-xs text-slate-500 capitalize">
                          {site.tower_type} · {site.lat.toFixed(5)}, {site.lng.toFixed(5)}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          {site.source === 'rf_planned' && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                              🛠️ Planned Site
                            </span>
                          )}
                          {site.source === 'user_test' && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              🧪 Test Site
                            </span>
                          )}
                          {site.source === 'tarangsanchar' && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                              🏛 Official Baseline
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDelete(site.site_id); }}
                        className="text-red-400 hover:text-red-600 mt-0.5 flex-shrink-0"
                        title="Delete site"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    {/* Radio Cells list */}
                    <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                      {site.towers.map(t => (
                        <div key={t.id} className="flex items-center gap-1.5 text-xs py-0.5 border-b border-slate-100 last:border-none">
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: opColor(t.operator) }}
                          />
                          <span className="font-semibold text-slate-800">
                            {t.operator || 'Unconfigured'}
                          </span>
                          {t.technology && (
                            <span className="text-[10px] bg-slate-100 px-1 py-0.2 rounded text-slate-600">
                              {t.technology}
                            </span>
                          )}
                          <span className="ml-auto font-mono text-slate-600 text-[11px]">
                            {t.freq_mhz != null ? `${t.freq_mhz} MHz` : 'Raw Loc'}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Actions: Edit vs Simulate */}
                    <div className="mt-2.5 flex gap-1.5 border-t border-slate-200 pt-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSiteSelect?.(site.towers, false); // false = Edit Mode!
                          setHoveredSite(null);
                        }}
                        className="flex-1 text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded px-2 py-1.5 font-medium flex items-center justify-center gap-1 border border-indigo-200 shadow-sm"
                      >
                        ✏ Edit Site & Cells
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSiteSelect?.(site.towers, true); // true = Simulate Mode!
                          setHoveredSite(null);
                        }}
                        className="flex-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded px-2 py-1.5 font-medium flex items-center justify-center gap-1 shadow-sm"
                      >
                        📡 Simulate
                      </button>
                    </div>

                    {confirmDelete === site.site_id && (
                      <div className="mt-2 p-2 bg-red-50 rounded border border-red-200 text-xs">
                        <p className="text-red-700 font-semibold mb-1.5">Delete {site.towers.length} cell(s) at this site?</p>
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => handleDeleteSite(site.site_id, e)}
                            className="flex-1 bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded font-medium"
                          >
                            Yes
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmDelete(null); }}
                            className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 py-1 rounded font-medium"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </Popup>
              )}
            </React.Fragment>
          );
        })}
      </Map>

      {/* ── Top Floating Toolbar ────────────────────────────────────── */}
      <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-1.5 max-w-[calc(100%-140px)]">
        {onImportClick && (
          <button
            onClick={onImportClick}
            className="bg-slate-800/90 hover:bg-slate-700 text-white px-2.5 py-1.5 rounded shadow flex items-center gap-1.5 border border-slate-700 text-xs font-medium"
          >
            <Upload size={13} /> Import
          </button>
        )}

        <button
          onClick={handleLocate}
          disabled={locating}
          title="Go to my location"
          className="bg-slate-800/90 hover:bg-slate-700 text-white px-2.5 py-1.5 rounded shadow flex items-center gap-1.5 border border-slate-700 text-xs font-medium disabled:opacity-60"
        >
          <Locate size={13} className={locating ? 'animate-spin' : ''} />
          {locating ? 'Locating…' : 'My Location'}
        </button>

        <button
          onClick={() => setShowTowers(v => !v)}
          className="bg-slate-800/90 hover:bg-slate-700 text-white px-2.5 py-1.5 rounded shadow flex items-center gap-1.5 border border-slate-700 text-xs font-medium"
        >
          {showTowers ? <Eye size={13} /> : <EyeOff size={13} />}
          {visibleSites.length} / {sites.length} Sites
        </button>

        {/* Source Filter Switcher */}
        <div className="flex items-center bg-slate-900/90 backdrop-blur rounded p-0.5 border border-slate-700 text-xs shadow">
          <button
            onClick={() => setSourceFilter('all')}
            className={`px-2 py-1 rounded transition-colors text-[11px] font-medium ${
              sourceFilter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setSourceFilter('real')}
            className={`px-2 py-1 rounded transition-colors text-[11px] font-medium ${
              sourceFilter === 'real' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white'
            }`}
            title="Show only official Tarang Sanchar baseline towers"
          >
            🏛 Real
          </button>
          <button
            onClick={() => setSourceFilter('test')}
            className={`px-2 py-1 rounded transition-colors text-[11px] font-medium ${
              sourceFilter === 'test' ? 'bg-purple-600 text-white' : 'text-slate-300 hover:text-white'
            }`}
            title="Show user test & RF planned towers"
          >
            🧪 Test/Plan
          </button>
        </div>
      </div>

      {/* ── Fullscreen Map Toggle Button (Requirement 3) ──────────────── */}
      {onToggleSidebar && (
        <div className="absolute top-3 right-3 z-10">
          <button
            onClick={onToggleSidebar}
            title={isSidebarOpen ? 'Collapse side panel (Full screen GIS)' : 'Show side panel'}
            className="bg-slate-900/90 hover:bg-slate-800 text-white px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-1.5 border border-slate-700 text-xs font-medium transition-all"
          >
            {isSidebarOpen ? <Maximize2 size={14} className="text-indigo-400" /> : <Minimize2 size={14} className="text-green-400" />}
            <span>{isSidebarOpen ? 'Full Screen GIS' : 'Show Panel'}</span>
          </button>
        </div>
      )}

      {/* ── Interactive Live Mouse Hover Point Inspector (Requirement 6) ─ */}
      {inspectPoint && (
        <div className="absolute top-14 right-3 z-20 bg-slate-900/95 backdrop-blur border border-slate-700 text-white p-3 rounded-xl shadow-2xl min-w-[270px] pointer-events-none animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center justify-between border-b border-slate-700/80 pb-2 mb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-400">
              <Crosshair size={14} />
              <span>RF Point Inspector</span>
            </div>
            <div className="flex items-center gap-1 font-mono text-[10px] text-slate-400">
              <span>{inspectPoint.lat.toFixed(4)}, {inspectPoint.lng.toFixed(4)}</span>
            </div>
          </div>

          {/* Primary metrics */}
          <div className="grid grid-cols-2 gap-2 mb-2.5 bg-slate-800/80 p-2 rounded-lg border border-slate-700/50">
            <div>
              <span className="text-[10px] text-slate-400 block">Distance from Site</span>
              <span className="text-sm font-bold font-mono text-white">
                {inspectPoint.distanceKm} km
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Path Loss</span>
              <span className="text-sm font-bold font-mono text-slate-300">
                {inspectPoint.pathLossDb} dB
              </span>
            </div>
            <div className="col-span-2 pt-1 border-t border-slate-700/50 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 block">Best RSRP (Signal)</span>
                <span className="text-base font-extrabold font-mono" style={{ color: inspectPoint.qColor }}>
                  {inspectPoint.rsrpDbm} dBm
                </span>
              </div>
              <div className="text-right">
                <span
                  className="inline-block px-2 py-0.5 rounded text-[10px] font-bold"
                  style={{ backgroundColor: `${inspectPoint.qColor}25`, color: inspectPoint.qColor, border: `1px solid ${inspectPoint.qColor}66` }}
                >
                  {inspectPoint.quality} ({inspectPoint.bars}/5 bars)
                </span>
              </div>
            </div>
          </div>

          {/* Multi-operator comparison if multiple carriers are active */}
          {inspectPoint.carriers.length > 1 && (
            <div className="space-y-1 border-t border-slate-700/80 pt-2">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold mb-1">
                Carriers at this Point:
              </span>
              {inspectPoint.carriers.map((c, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                    <span className="font-semibold text-slate-200">{c.operator} {c.tech}</span>
                    <span className="text-[10px] text-slate-400 font-mono">({c.freqMhz}M)</span>
                  </div>
                  <span className="font-mono font-bold" style={{ color: c.qColor }}>
                    {c.rsrpDbm} dBm
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Multi-Carrier Layer Controller (Requirement 5) ───────────── */}
      {activeSimLayers.length > 1 && (
        <div className="absolute top-14 left-3 z-10 bg-slate-900/90 backdrop-blur text-xs p-3 rounded-xl shadow-xl border border-slate-700 text-slate-200 min-w-[240px]">
          <div className="flex items-center justify-between font-bold text-white mb-2 pb-1.5 border-b border-slate-700">
            <span className="flex items-center gap-1.5">
              <Sparkles size={14} className="text-amber-400" /> Multi-Carrier Layers
            </span>
            <span className="text-[10px] text-slate-400 font-mono">{activeSimLayers.length} Bands</span>
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {activeSimLayers.map((layer, idx) => {
              const isEnabled = enabledLayers[idx] !== false;
              const color = layer.color || opColor(layer.operator);
              return (
                <div
                  key={idx}
                  onClick={() => setEnabledLayers(prev => ({ ...prev, [idx]: !isEnabled }))}
                  className={`flex items-center gap-2 p-1.5 rounded cursor-pointer transition-colors ${
                    isEnabled ? 'bg-slate-800/80 hover:bg-slate-800' : 'opacity-40 hover:opacity-60'
                  }`}
                >
                  {isEnabled ? (
                    <CheckSquare size={14} className="text-indigo-400 flex-shrink-0" />
                  ) : (
                    <Square size={14} className="text-slate-500 flex-shrink-0" />
                  )}
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="font-semibold text-white">
                    {layer.operator || 'Carrier'} {layer.technology}
                  </span>
                  <span className="ml-auto font-mono text-slate-400 text-[10px]">
                    {layer.freq_mhz} MHz
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-2.5 pt-2 border-t border-slate-700/80 flex items-center justify-between">
            <span className="text-[10px] text-slate-400">Layer Opacity</span>
            <input
              type="range"
              min="0.2"
              max="1.0"
              step="0.05"
              value={layerOpacity}
              onChange={(e) => setLayerOpacity(parseFloat(e.target.value))}
              className="w-24 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>
        </div>
      )}

      {/* ── Single Coverage Legend (when 1 layer active) ──────────────── */}
      {activeSimLayers.length === 1 && (
        <div className="absolute bottom-20 right-14 z-10 bg-slate-800/95 text-xs p-3 rounded shadow border border-slate-700 text-slate-200 min-w-[210px]">
          <div className="font-bold mb-1.5 text-white flex items-center justify-between">
            <span>Coverage Prediction</span>
            <span className="text-[10px] text-green-400 font-mono">{activeSimLayers[0].avg_rsrp_dbm} dBm RSRP</span>
          </div>
          <div className="text-slate-400 text-[10px] mb-2">
            <span className="text-indigo-300 uppercase font-medium">{activeSimLayers[0].model}</span>
            {' · '}<span className="text-indigo-300 capitalize">{activeSimLayers[0].environment}</span>
            {activeSimLayers[0].terrain_aware && <span className="text-green-400 ml-1">· ✦ Terrain</span>}
            {activeSimLayers[0].building_aware && activeSimLayers[0].buildings_count > 0 && (
              <span className="text-amber-400 ml-1">· 🏢 {activeSimLayers[0].buildings_count} Buildings</span>
            )}
          </div>
          {[
            { bg: 'bg-green-500', label: 'Excellent (>−85 dBm)', km2: activeSimLayers[0].area_km2.green },
            { bg: 'bg-yellow-500', label: 'Good (>−100 dBm)',    km2: activeSimLayers[0].area_km2.amber },
            { bg: 'bg-red-500',   label: 'Fair (>−110 dBm)',     km2: activeSimLayers[0].area_km2.red   },
          ].map(({ bg, label, km2 }) => (
            <div key={label} className="flex items-center gap-2 mb-1">
              <div className={`w-3 h-3 rounded-full ${bg} opacity-80`} />
              <span>{label}</span>
              <span className="ml-auto text-slate-400 font-mono">{(km2 || 0).toFixed(1)} km²</span>
            </div>
          ))}
          <div className="mt-1.5 pt-1.5 border-t border-slate-700 flex justify-between text-[10px] text-slate-400">
            <span>Max Range: {activeSimLayers[0].max_range_km.toFixed(2)} km</span>
            <span>SINR: ~{activeSimLayers[0].sinr_db} dB</span>
          </div>
        </div>
      )}

      {/* ── BOTTOM: Map source switcher ──────────────────────────────── */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10">
        <div className="flex items-center gap-1 bg-slate-900/90 backdrop-blur rounded-full px-2 py-1 shadow-lg border border-slate-700">
          <Layers size={12} className="text-slate-400 mr-1" />
          {(['gmap', 'osm', 'satellite', 'terrain', 'dark'] as BaseStyle[]).map(id => (
            <button
              key={id}
              onClick={() => setBaseStyle(id)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                baseStyle === id
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-300 hover:bg-slate-700'
              }`}
            >
              {STYLE_LABEL[id]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tower legend ─────────────────────────────────────────────── */}
      <div className="absolute bottom-14 left-3 z-10 bg-slate-800/90 text-[10px] p-2 rounded shadow border border-slate-700 text-slate-300 space-y-0.5">
        {[['ground','#22c55e','🟢 Ground'],['rooftop','#3b82f6','🔵 Rooftop'],['wall-mount','#ec4899','🩷 Wall-mount']].map(([,c,l])=>(
          <div key={l} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{backgroundColor:c as string}}/>
            <span>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
