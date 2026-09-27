import { useState, useEffect, useMemo } from 'react';
import { Tower, TowerCreate, SimulateResponse } from '../types';
import { simulateAPI, towerAPI } from '../services/api';
import {
  Activity, Radio, Loader, Plus, AlertCircle, Save
} from 'lucide-react';

// ── Model auto-selection logic ─────────────────────────────────────────────
function autoModel(freq: number): string {
  if (freq < 1500)  return 'hata';
  if (freq < 6000)  return 'cost231';
  return 'fspl';
}

const MODEL_NAMES: Record<string, string> = {
  hata: 'Okumura-Hata',
  cost231: 'COST-231 Hata',
  fspl: 'Free-Space PL',
};

const COMMON_BANDS = [
  { label: 'B28 (700 MHz) - 4G/5G',  freq: 700,  tech: '4G',    bw: 10 },
  { label: 'B8 (900 MHz) - 2G/4G',   freq: 900,  tech: '4G',    bw: 10 },
  { label: 'B3 (1800 MHz) - 4G LTE', freq: 1800, tech: '4G',    bw: 15 },
  { label: 'B1 (2100 MHz) - 3G/4G',  freq: 2100, tech: '4G',    bw: 15 },
  { label: 'B40 (2300 MHz) - 4G TDD',freq: 2300, tech: '4G TDD',bw: 20 },
  { label: 'n78 (3500 MHz) - 5G NR', freq: 3500, tech: '5G NR', bw: 100 },
];

const OPERATORS = ['Jio', 'Airtel', 'Vi', 'BSNL', 'Custom'];
const TOWER_TYPES = ['Rooftop', 'Ground', 'Wall-mount'];

interface SimulationPanelProps {
  towers: Tower[];
  selectedSiteTowers: Tower[] | null;
  lat: number | null;
  lng: number | null;
  onSimulationComplete: (r: SimulateResponse | null) => void;
  onTowersChanged?: () => void;
}

export function SimulationPanel({
  towers, selectedSiteTowers, lat, lng, onSimulationComplete, onTowersChanged,
}: SimulationPanelProps) {
  const [mode, setMode] = useState<'simulate' | 'add'>('simulate');
  const [selectedTowerId, setSelectedTowerId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimulateResponse | null>(null);
  const [error, setError] = useState('');

  // ── New Tower Form State ──
  const [newSiteName, setNewSiteName] = useState('');
  const [newOperator, setNewOperator] = useState('Jio');
  const [newFreq, setNewFreq] = useState(1800);
  const [newTech, setNewTech] = useState('4G');
  const [newBw, setNewBw] = useState(15);
  const [newTowerType, setNewTowerType] = useState('Rooftop');
  const [newHeight, setNewHeight] = useState(30);
  const [newPower, setNewPower] = useState(43);
  const [savingNew, setSavingNew] = useState(false);

  // Auto-select tower when site is clicked on map
  useEffect(() => {
    if (selectedSiteTowers && selectedSiteTowers.length > 0) {
      setSelectedTowerId(selectedSiteTowers[0].id);
      setMode('simulate');
    }
  }, [selectedSiteTowers]);

  const selectedTower = towers.find(t => t.id === selectedTowerId) ?? null;

  const siteMates = useMemo(() => {
    if (!selectedTower) return [];
    const sid = selectedTower.site_id || selectedTower.id;
    return towers.filter(t => (t.site_id || t.id) === sid);
  }, [selectedTower, towers]);

  const autoMdl = (selectedTower && selectedTower.freq_mhz != null) ? autoModel(selectedTower.freq_mhz) : null;

  const handleSimulate = async (towerIdToSim = selectedTowerId) => {
    if (!towerIdToSim) {
      setError('Please pick a tower on the map or list below.');
      return;
    }
    const t = towers.find(item => item.id === towerIdToSim);
    if (t && t.freq_mhz == null) {
      setError('This is a raw unconfigured tower. Configure frequency & operator below to simulate.');
      return;
    }

    setError('');
    setLoading(true);
    setResult(null);
    try {
      const res = await simulateAPI.simulate(towerIdToSim, {
        resolution: 120,
        terrain_aware: true,
        building_aware: true,
      });
      setResult(res);
      onSimulationComplete(res);
    } catch (e: any) {
      setError(e.response?.data?.detail ?? 'Simulation calculation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAndSimulate = async () => {
    if (!lat || !lng) {
      setError('Click anywhere on the map to set the new tower position.');
      return;
    }
    setError('');
    setSavingNew(true);

    const siteId = `TEST-${Date.now().toString().slice(-4)}`;
    const payload: TowerCreate = {
      name: newSiteName.trim() || `${newOperator} Test Site`,
      lat,
      lng,
      operator: newOperator,
      technology: newTech,
      freq_mhz: newFreq,
      bandwidth_mhz: newBw,
      height_m: newHeight,
      power_dbm: newPower,
      tower_type: newTowerType,
      azimuth_deg: 0.0,
      source: 'user_test',
      site_id: siteId,
      cell_id: `${siteId}-C1`,
    };

    try {
      const created = await towerAPI.create(payload);
      onTowersChanged?.();
      setSelectedTowerId(created.id);
      setMode('simulate');
      // Directly simulate the newly created tower
      setTimeout(() => {
        handleSimulate(created.id);
      }, 300);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to create test tower.');
    } finally {
      setSavingNew(false);
    }
  };

  const handleQuickConfigure = async (targetTower: Tower, freq: number, tech: string, bw: number, op: string) => {
    try {
      setLoading(true);
      await towerAPI.update(targetTower.id, {
        freq_mhz: freq,
        technology: tech,
        bandwidth_mhz: bw,
        operator: op,
        source: 'user_test',
      });
      onTowersChanged?.();
      setTimeout(() => handleSimulate(targetTower.id), 250);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update tower.');
      setLoading(false);
    }
  };

  const handleClear = () => {
    setResult(null);
    onSimulationComplete(null);
    setError('');
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-700 bg-slate-800 shrink-0">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Activity size={18} className="text-indigo-400" /> Coverage Simulation
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          RF raycasting with Open-Elevation terrain & OSM building footprints.
        </p>

        {/* Mode Switcher */}
        <div className="flex gap-2 mt-3 bg-slate-900 p-1 rounded-lg border border-slate-700">
          <button
            onClick={() => setMode('simulate')}
            className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all ${
              mode === 'simulate' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            📡 Existing Towers
          </button>
          <button
            onClick={() => setMode('add')}
            className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1 ${
              mode === 'add' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Plus size={13} /> Add & Simulate
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">

        {/* ── MODE A: ADD & SIMULATE NEW TOWER ───────────────────────────── */}
        {mode === 'add' && (
          <div className="bg-slate-800 p-3.5 rounded-lg border border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-300 uppercase tracking-wide">
                ➕ Place New Test Tower
              </span>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/40">
                User Test Data
              </span>
            </div>

            {/* Coordinates */}
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Target Coordinates</label>
              <div className="bg-slate-700/60 p-2 rounded border border-slate-600 text-xs font-mono">
                {lat && lng ? (
                  <span className="text-emerald-300 font-bold">{lat.toFixed(5)}, {lng.toFixed(5)}</span>
                ) : (
                  <span className="text-amber-300 italic">Click anywhere on the map to set tower position</span>
                )}
              </div>
            </div>

            {/* Site Name & Operator */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Site Label</label>
                <input
                  type="text"
                  placeholder="e.g. Metro Cell 1"
                  value={newSiteName}
                  onChange={e => setNewSiteName(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded p-1.5 text-xs text-white outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Operator</label>
                <select
                  value={newOperator}
                  onChange={e => setNewOperator(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded p-1.5 text-xs text-white outline-none"
                >
                  {OPERATORS.map(op => <option key={op} value={op}>{op}</option>)}
                </select>
              </div>
            </div>

            {/* Band / Technology */}
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Spectrum Band & Frequency</label>
              <select
                value={newFreq}
                onChange={e => {
                  const f = parseInt(e.target.value);
                  setNewFreq(f);
                  const matched = COMMON_BANDS.find(b => b.freq === f);
                  if (matched) {
                    setNewTech(matched.tech);
                    setNewBw(matched.bw);
                  }
                }}
                className="w-full bg-slate-700 border border-slate-600 rounded p-1.5 text-xs text-white outline-none"
              >
                {COMMON_BANDS.map(b => (
                  <option key={b.freq} value={b.freq}>{b.label}</option>
                ))}
              </select>
            </div>

            {/* Structure Type */}
            <div className="grid grid-cols-3 gap-1.5">
              {TOWER_TYPES.map(type => (
                <button
                  key={type}
                  onClick={() => setNewTowerType(type)}
                  className={`py-1 rounded text-xs transition-all ${
                    newTowerType === type
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            {/* Height & Power Sliders */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>Height:</span>
                  <strong className="text-white">{newHeight} m</strong>
                </div>
                <input
                  type="range" min="10" max="60" value={newHeight}
                  onChange={e => setNewHeight(parseInt(e.target.value))}
                  className="w-full accent-indigo-500"
                />
              </div>
              <div>
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>Tx Power:</span>
                  <strong className="text-white">{newPower} dBm</strong>
                </div>
                <input
                  type="range" min="30" max="49" value={newPower}
                  onChange={e => setNewPower(parseInt(e.target.value))}
                  className="w-full accent-indigo-500"
                />
              </div>
            </div>

            <button
              onClick={handleCreateAndSimulate}
              disabled={savingNew || !lat || !lng}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow"
            >
              {savingNew ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
              {savingNew ? 'Saving & Simulating…' : 'Save & Simulate Coverage'}
            </button>
          </div>
        )}

        {/* ── MODE B: SELECT & SIMULATE EXISTING TOWER ───────────────────── */}
        {mode === 'simulate' && (
          <>
            {!selectedTower ? (
              <div className="bg-indigo-900/20 border border-indigo-700/60 rounded-lg p-5 text-center space-y-2">
                <Radio size={30} className="text-indigo-400 mx-auto animate-pulse" />
                <p className="text-sm text-indigo-200 font-semibold">Click any tower on the map</p>
                <p className="text-xs text-slate-400">
                  Or use the tower list below to inspect multi-operator cells and launch coverage heatmaps.
                </p>
              </div>
            ) : (
              <div className="bg-slate-800 p-3.5 rounded-lg border border-slate-700 space-y-3">
                <div className="flex items-start justify-between border-b border-slate-700 pb-2">
                  <div>
                    <h3 className="font-bold text-white text-sm">
                      {selectedTower.site_id || selectedTower.name}
                    </h3>
                    <p className="text-[11px] text-slate-400 capitalize">
                      {selectedTower.tower_type || 'Ground'} · {selectedTower.lat.toFixed(5)}, {selectedTower.lng.toFixed(5)}
                    </p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                    selectedTower.source === 'rf_planned' ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-700' :
                    selectedTower.source === 'user_test' ? 'bg-amber-900/50 text-amber-300 border border-amber-700' :
                    'bg-blue-900/50 text-blue-300 border border-blue-700'
                  }`}>
                    {selectedTower.source === 'rf_planned' ? '🛠 Planned' :
                     selectedTower.source === 'user_test' ? '🧪 Test' : '🏛 Real Tower'}
                  </span>
                </div>

                {/* If site has multiple cells/operators */}
                {siteMates.length > 1 && (
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Select Cell to Simulate</label>
                    <div className="space-y-1 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
                      {siteMates.map(cell => (
                        <button
                          key={cell.id}
                          onClick={() => setSelectedTowerId(cell.id)}
                          className={`w-full text-left p-2 rounded text-xs flex items-center justify-between transition-colors border ${
                            selectedTowerId === cell.id
                              ? 'bg-indigo-900/40 border-indigo-500 text-white'
                              : 'bg-slate-700/40 border-slate-700 hover:border-slate-600 text-slate-300'
                          }`}
                        >
                          <span className="font-semibold">{cell.operator || 'Unassigned'}</span>
                          <span className="text-slate-400">{cell.technology}</span>
                          <span className="font-mono text-indigo-300">{cell.freq_mhz ? `${cell.freq_mhz} MHz` : 'Unconfigured'}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* If selected tower is raw/unconfigured, offer instant quick-configure */}
                {selectedTower.freq_mhz == null && (
                  <div className="bg-amber-950/40 border border-amber-800 p-2.5 rounded-lg space-y-2">
                    <p className="text-[11px] text-amber-300 font-semibold flex items-center gap-1">
                      <AlertCircle size={13} /> Raw Location: Choose a band to simulate
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {COMMON_BANDS.slice(0, 4).map(b => (
                        <button
                          key={b.freq}
                          onClick={() => handleQuickConfigure(selectedTower, b.freq, b.tech, b.bw, 'Jio')}
                          className="bg-amber-900/30 hover:bg-amber-900/60 border border-amber-700/60 text-amber-200 p-1.5 rounded text-[11px] text-left"
                        >
                          {b.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Simulation Specs */}
                {selectedTower.freq_mhz != null && (
                  <div className="bg-slate-900/60 p-2.5 rounded border border-slate-700 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Carrier Frequency:</span>
                      <strong className="text-white font-mono">{selectedTower.freq_mhz} MHz</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Propagation Model:</span>
                      <strong className="text-indigo-300">{MODEL_NAMES[autoMdl || 'cost231']}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Antenna Height & Power:</span>
                      <span className="text-slate-300">{selectedTower.height_m}m · {selectedTower.power_dbm} dBm</span>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => handleSimulate()}
                    disabled={loading || selectedTower.freq_mhz == null}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow"
                  >
                    {loading ? <Loader size={14} className="animate-spin" /> : <Activity size={14} />}
                    {loading ? 'Raycasting Coverage…' : 'Simulate Coverage'}
                  </button>

                  {result && (
                    <button
                      onClick={handleClear}
                      className="bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-2 rounded-lg text-xs font-semibold"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {error && (
          <div className="bg-red-900/40 border border-red-800 text-red-300 p-2.5 rounded text-xs flex items-start gap-2">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ── SIMULATION RESULT METRICS ──────────────────────────────────── */}
        {result && (
          <div className="bg-slate-800 p-3.5 rounded-lg border border-slate-700 space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-700 pb-2">
              <span className="font-bold text-white uppercase tracking-wide">Simulation KPIs</span>
              <span className="font-mono text-emerald-400 font-bold">{result.avg_rsrp_dbm} dBm RSRP</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="bg-slate-900/50 p-2 rounded">
                <span className="text-slate-500 block">Max Range</span>
                <strong className="text-white text-xs">{result.max_range_km.toFixed(2)} km</strong>
              </div>
              <div className="bg-slate-900/50 p-2 rounded">
                <span className="text-slate-500 block">Est. SINR</span>
                <strong className="text-indigo-300 text-xs">~{result.sinr_db} dB</strong>
              </div>
              <div className="bg-slate-900/50 p-2 rounded">
                <span className="text-slate-500 block">Strong Coverage</span>
                <strong className="text-emerald-400 text-xs">{result.area_km2.green.toFixed(1)} km²</strong>
              </div>
              <div className="bg-slate-900/50 p-2 rounded">
                <span className="text-slate-500 block">Fair Coverage</span>
                <strong className="text-amber-400 text-xs">{result.area_km2.amber.toFixed(1)} km²</strong>
              </div>
            </div>

            <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-700/60">
              <span>Environment: <strong className="text-slate-300 capitalize">{result.environment}</strong></span>
              {result.terrain_aware && <span className="text-emerald-400 font-semibold">✦ Terrain-Aware</span>}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
