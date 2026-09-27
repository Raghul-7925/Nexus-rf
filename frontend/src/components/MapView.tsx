import React, { useMemo, useState, useCallback, useRef } from 'react';
import Map, { NavigationControl, Marker, Source, Layer, Popup } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Tower, SimulateResponse } from '../types';
import { Eye, EyeOff, Upload, Locate, Trash2, Layers } from 'lucide-react';
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

// ── Tower type colors (same as test repo) ────────────────────────────────
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

// ── 🗼 Tower marker — matches test repo style exactly ─────────────────────
const TowerMarker = ({ color, size = 50, badge }: { color: string; size?: number; badge?: string }) => (
  <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    {/* Outer glow ring */}
    <div style={{
      position: 'absolute', width: size, height: size, borderRadius: '50%',
      background: `radial-gradient(circle, ${color}44 0%, ${color}00 70%)`,
      border: `2px solid ${color}66`,
    }} />
    {/* Middle ring */}
    <div style={{
      position: 'absolute', width: size * 0.6, height: size * 0.6, borderRadius: '50%',
      background: `radial-gradient(circle, ${color}55 0%, ${color}00 70%)`,
      border: `2px solid ${color}88`,
    }} />
    {/* Inner dot */}
    <div style={{
      position: 'absolute', width: size * 0.36, height: size * 0.36, borderRadius: '50%',
      background: `${color}cc`,
      border: `2px solid ${color}`,
      boxShadow: `0 0 10px ${color}88`,
    }} />
    {/* 🗼 emoji */}
    <div style={{ position: 'relative', zIndex: 2, fontSize: size * 0.32, filter: `drop-shadow(0 0 4px ${color})`, lineHeight: 1 }}>
      🗼
    </div>
    {/* Mini badge icon */}
    {badge && (
      <div style={{
        position: 'absolute',
        top: 2,
        right: 2,
        zIndex: 3,
        fontSize: 10,
        background: 'rgba(15, 23, 42, 0.85)',
        border: '1px solid rgba(255, 255, 255, 0.3)',
        borderRadius: '50%',
        width: 15,
        height: 15,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {badge}
      </div>
    )}
  </div>
);

// ── map tile sources ───────────────────────────────────────────────────────
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


// ── props ──────────────────────────────────────────────────────────────────
interface MapViewProps {
  towers: Tower[];
  simulationResult: SimulateResponse | null;
  onLocationSelect: (lat: number, lng: number) => void;
  onSiteSelect?: (towers: Tower[], switchToSim?: boolean) => void;
  onImportClick?: () => void;
  onTowersChanged?: () => void;
}

type SourceFilter = 'all' | 'real' | 'test';

function getSiteSource(towers: Tower[]): 'rf_planned' | 'user_test' | 'tarangsanchar' {
  if (towers.some(t => t.source === 'rf_planned')) return 'rf_planned';
  if (towers.some(t => t.source === 'user_test' || t.source === 'manual')) return 'user_test';
  return 'tarangsanchar';
}

export const MapView: React.FC<MapViewProps> = ({
  towers, simulationResult, onLocationSelect, onSiteSelect, onImportClick, onTowersChanged,
}) => {
  const mapRef = useRef<any>(null);
  const [baseStyle, setBaseStyle] = useState<BaseStyle>('gmap');
  const [showTowers, setShowTowers] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [hoveredSite, setHoveredSite] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [viewState, setViewState] = useState({ longitude: 79.4861, latitude: 11.9401, zoom: 12 });

  // ── group towers into sites ───────────────────────────────────────────
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

  const handleMapClick = useCallback((e: any) => {
    setHoveredSite(null);
    setConfirmDelete(null);
    onLocationSelect(e.lngLat.lat, e.lngLat.lng);
  }, [onLocationSelect]);

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
        style={{ width: '100%', height: '100%' }}
      >
        <NavigationControl position="bottom-right" />

        {/* ── Coverage overlay ───────────────────────────────────────── */}
        {simulationResult && (
          <Source
            id="sim-src" type="image"
            url={`data:image/png;base64,${simulationResult.png_base64}`}
            coordinates={[
              [simulationResult.bounds[1], simulationResult.bounds[2]],
              [simulationResult.bounds[3], simulationResult.bounds[2]],
              [simulationResult.bounds[3], simulationResult.bounds[0]],
              [simulationResult.bounds[1], simulationResult.bounds[0]],
            ]}
          >
            <Layer id="sim-layer" type="raster" paint={{ 'raster-opacity': 0.72 }} />
          </Source>
        )}

        {/* ── Tower markers ──────────────────────────────────────────── */}
        {showTowers && sites.map(site => {
          const color = towerTypeColor(site.tower_type);
          const isHovered = hoveredSite === site.site_id;
          const badge = site.source === 'rf_planned' ? '🛠️' : site.source === 'user_test' ? '🧪' : undefined;
          return (
            <React.Fragment key={site.site_id}>
              <Marker longitude={site.lng} latitude={site.lat} anchor="center"
                onClick={(e) => {
                  e.originalEvent.stopPropagation();
                  setHoveredSite(isHovered ? null : site.site_id);
                  setConfirmDelete(null);
                }}
              >
                <div className={`cursor-pointer transition-transform ${isHovered ? 'scale-125' : 'hover:scale-110'}`}>
                  <TowerMarker color={color} size={isHovered ? 52 : 44} badge={badge} />
                </div>
              </Marker>

              {isHovered && (
                <Popup longitude={site.lng} latitude={site.lat}
                  anchor="bottom" offset={28} closeButton={false}
                  className="z-50 min-w-[240px]"
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
                      <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(site.site_id); }}
                        className="text-red-400 hover:text-red-600 mt-0.5 flex-shrink-0"
                        title="Delete site">
                        <Trash2 size={15} />
                      </button>
                    </div>

                    {/* Cells */}
                    <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                      {site.towers.map(t => (
                        <div key={t.id} className="flex items-center gap-1.5 text-xs">
                          <span className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: opColor(t.operator) }} />
                          <span className="font-semibold">{t.operator || (t.freq_mhz != null ? 'Cell' : 'Raw Location')}</span>
                          {t.technology && <span className="text-slate-500">{t.technology}</span>}
                          <span className="ml-auto font-mono text-slate-600">
                            {t.freq_mhz != null ? `${t.freq_mhz} MHz` : 'Unconfigured'}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Actions */}
                    <div className="mt-2 flex gap-1.5 border-t border-slate-200 pt-1.5">
                      <button onClick={(e) => { e.stopPropagation(); onSiteSelect?.(site.towers, false); setHoveredSite(null); }}
                        className="flex-1 text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded px-2 py-1 font-medium">
                        ✏ Edit
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); onSiteSelect?.(site.towers, true); setHoveredSite(null); }}
                        className="flex-1 text-xs bg-green-50 hover:bg-green-100 text-green-700 rounded px-2 py-1 font-medium">
                        📡 Simulate
                      </button>
                    </div>

                    {confirmDelete === site.site_id && (
                      <div className="mt-2 p-2 bg-red-50 rounded border border-red-200 text-xs">
                        <p className="text-red-700 font-semibold mb-1.5">Delete {site.towers.length} cell(s) at this site?</p>
                        <div className="flex gap-2">
                          <button onClick={(e) => handleDeleteSite(site.site_id, e)}
                            className="flex-1 bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded font-medium">Yes</button>
                          <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(null); }}
                            className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 py-1 rounded font-medium">Cancel</button>
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
          <button onClick={onImportClick}
            className="bg-slate-800/90 hover:bg-slate-700 text-white px-2.5 py-1.5 rounded shadow flex items-center gap-1.5 border border-slate-700 text-xs font-medium">
            <Upload size={13} /> Import
          </button>
        )}

        <button onClick={handleLocate} disabled={locating}
          title="Go to my location"
          className="bg-slate-800/90 hover:bg-slate-700 text-white px-2.5 py-1.5 rounded shadow flex items-center gap-1.5 border border-slate-700 text-xs font-medium disabled:opacity-60">
          <Locate size={13} className={locating ? 'animate-spin' : ''} />
          {locating ? 'Locating…' : 'My Location'}
        </button>

        <button onClick={() => setShowTowers(v => !v)}
          className="bg-slate-800/90 hover:bg-slate-700 text-white px-2.5 py-1.5 rounded shadow flex items-center gap-1.5 border border-slate-700 text-xs font-medium">
          {showTowers ? <Eye size={13} /> : <EyeOff size={13} />}
          {sites.length} Site{sites.length !== 1 ? 's' : ''}
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

      {/* ── Coverage legend ──────────────────────────────────────────── */}
      {simulationResult && (
        <div className="absolute bottom-20 right-14 z-10 bg-slate-800/95 text-xs p-3 rounded shadow border border-slate-700 text-slate-200 min-w-[210px]">
          <div className="font-bold mb-1.5 text-white flex items-center justify-between">
            <span>Coverage Prediction</span>
            <span className="text-[10px] text-green-400 font-mono">{simulationResult.avg_rsrp_dbm} dBm RSRP</span>
          </div>
          <div className="text-slate-400 text-[10px] mb-2">
            <span className="text-indigo-300 uppercase font-medium">{simulationResult.model}</span>
            {' · '}<span className="text-indigo-300 capitalize">{simulationResult.environment}</span>
            {simulationResult.terrain_aware && <span className="text-green-400 ml-1">· ✦ Terrain</span>}
            {simulationResult.building_aware && simulationResult.buildings_count > 0 && (
              <span className="text-amber-400 ml-1">· 🏢 {simulationResult.buildings_count} Buildings</span>
            )}
          </div>
          {[
            { bg: 'bg-green-500', label: 'Excellent (>−85 dBm)', km2: simulationResult.area_km2.green },
            { bg: 'bg-yellow-500', label: 'Good (>−100 dBm)',    km2: simulationResult.area_km2.amber },
            { bg: 'bg-red-500',   label: 'Fair (>−110 dBm)',     km2: simulationResult.area_km2.red   },
          ].map(({ bg, label, km2 }) => (
            <div key={label} className="flex items-center gap-2 mb-1">
              <div className={`w-3 h-3 rounded-full ${bg} opacity-80`} />
              <span>{label}</span>
              <span className="ml-auto text-slate-400 font-mono">{km2.toFixed(1)} km²</span>
            </div>
          ))}
          <div className="mt-1.5 pt-1.5 border-t border-slate-700 flex justify-between text-[10px] text-slate-400">
            <span>Max Range: {simulationResult.max_range_km.toFixed(2)} km</span>
            <span>SINR: ~{simulationResult.sinr_db} dB</span>
          </div>
        </div>
      )}

      {/* ── BOTTOM: Map source switcher (Google Map / OpenStreetMap) ───── */}
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
