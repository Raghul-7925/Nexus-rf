import { useState, useEffect, useMemo } from 'react';
import { Tower, TowerCreate, SimulateResponse } from '../types';
import { simulateAPI, towerAPI } from '../services/api';
import {
  Activity, Radio, Loader, Plus, AlertCircle, Save,
  Edit3, Trash2, CheckCircle2, Sparkles, Layers
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
const TECHNOLOGIES = ['4G', '5G NR', '4G TDD', '3G', '2G'];
const TOWER_TYPES = ['Rooftop', 'Ground', 'Wall-mount'];

const OP_COLORS: Record<string, string> = {
  jio: '#f97316',
  airtel: '#ef4444',
  vi: '#eab308',
  bsnl: '#22c55e',
  custom: '#a855f7',
};

function getOpColor(op?: string | null) {
  if (!op) return '#94a3b8';
  const l = op.toLowerCase();
  for (const [k, v] of Object.entries(OP_COLORS)) {
    if (l.includes(k)) return v;
  }
  return '#94a3b8';
}

interface EditableCell {
  id?: string; // If undefined, this is a newly added cell
  operator: string;
  technology: string;
  freq_mhz: number;
  bandwidth_mhz: number;
  azimuth_deg: number;
  height_m: number;
  power_dbm: number;
}

interface SimulationPanelProps {
  towers: Tower[];
  selectedSiteTowers: Tower[] | null;
  lat: number | null;
  lng: number | null;
  initialMode?: 'simulate' | 'add' | 'edit';
  onSimulationComplete: (r: SimulateResponse | null) => void;
  onMultiSimulationComplete?: (results: SimulateResponse[] | null) => void;
  onTowersChanged?: () => void;
}

export function SimulationPanel({
  towers,
  selectedSiteTowers,
  lat,
  lng,
  initialMode = 'simulate',
  onSimulationComplete,
  onMultiSimulationComplete,
  onTowersChanged,
}: SimulationPanelProps) {
  const [mode, setMode] = useState<'simulate' | 'add' | 'edit'>(initialMode);
  const [selectedTowerId, setSelectedTowerId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [multiLoading, setMultiLoading] = useState(false);
  const [result, setResult] = useState<SimulateResponse | null>(null);
  const [multiResults, setMultiResults] = useState<SimulateResponse[] | null>(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // ── Edit Site State ──
  const [editSiteName, setEditSiteName] = useState('');
  const [editTowerType, setEditTowerType] = useState('Ground');
  const [editHeight, setEditHeight] = useState(30);
  const [editPower, setEditPower] = useState(43);
  const [editCells, setEditCells] = useState<EditableCell[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

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

  // Sync mode when initialMode prop changes
  useEffect(() => {
    if (initialMode) {
      setMode(initialMode);
    }
  }, [initialMode]);

  // Auto-select tower and populate edit form when site is clicked
  useEffect(() => {
    if (selectedSiteTowers && selectedSiteTowers.length > 0) {
      setSelectedTowerId(selectedSiteTowers[0].id);

      // Populate edit state
      const first = selectedSiteTowers[0];
      setEditSiteName(first.name || first.site_id || 'Cell Site');
      setEditTowerType(first.tower_type || 'Ground');
      setEditHeight(first.height_m || 30);
      setEditPower(first.power_dbm || 43);

      setEditCells(
        selectedSiteTowers.map((t) => ({
          id: t.id,
          operator: t.operator || 'Jio',
          technology: t.technology || '4G',
          freq_mhz: t.freq_mhz ?? 1800,
          bandwidth_mhz: t.bandwidth_mhz ?? 15,
          azimuth_deg: t.azimuth_deg ?? 0.0,
          height_m: t.height_m || 30,
          power_dbm: t.power_dbm || 43,
        }))
      );
    }
  }, [selectedSiteTowers]);

  const selectedTower = towers.find((t) => t.id === selectedTowerId) ?? null;

  const siteMates = useMemo(() => {
    if (!selectedTower) return [];
    const sid = selectedTower.site_id || selectedTower.id;
    return towers.filter((t) => (t.site_id || t.id) === sid);
  }, [selectedTower, towers]);

  // Keep edit cells in sync if siteMates change and no manual additions are in progress
  useEffect(() => {
    if (siteMates.length > 0 && mode === 'edit' && editCells.length === 0) {
      const first = siteMates[0];
      setEditSiteName(first.name || first.site_id || 'Cell Site');
      setEditTowerType(first.tower_type || 'Ground');
      setEditHeight(first.height_m || 30);
      setEditPower(first.power_dbm || 43);
      setEditCells(
        siteMates.map((t) => ({
          id: t.id,
          operator: t.operator || 'Jio',
          technology: t.technology || '4G',
          freq_mhz: t.freq_mhz ?? 1800,
          bandwidth_mhz: t.bandwidth_mhz ?? 15,
          azimuth_deg: t.azimuth_deg ?? 0.0,
          height_m: t.height_m || 30,
          power_dbm: t.power_dbm || 43,
        }))
      );
    }
  }, [siteMates, mode]);

  const autoMdl =
    selectedTower && selectedTower.freq_mhz != null ? autoModel(selectedTower.freq_mhz) : null;

  // ── Single Cell Simulation ───────────────────────────────────────────────
  const handleSimulate = async (towerIdToSim = selectedTowerId) => {
    if (!towerIdToSim) {
      setError('Please pick a tower on the map or list below.');
      return;
    }
    const t = towers.find((item) => item.id === towerIdToSim);
    if (t && t.freq_mhz == null) {
      setError('This is an unconfigured tower. Configure frequency & operator below to simulate.');
      return;
    }

    setError('');
    setLoading(true);
    setResult(null);
    setMultiResults(null);
    try {
      const res = await simulateAPI.simulate(towerIdToSim, {
        resolution: 120,
        terrain_aware: true,
        building_aware: true,
      });
      setResult(res);
      onSimulationComplete(res);
      onMultiSimulationComplete?.([res]);
    } catch (e: any) {
      setError(e.response?.data?.detail ?? 'Simulation calculation failed.');
    } finally {
      setLoading(false);
    }
  };

  // ── Multi-Band & Multi-Operator Simulation (Requirement 5) ───────────────
  const handleSimulateMulti = async () => {
    if (siteMates.length === 0) {
      setError('Select a site on the map to simulate all bands.');
      return;
    }

    // Filter to towers that have valid freq_mhz or assign defaults
    const validTowers = siteMates.filter((t) => t.freq_mhz != null);
    if (validTowers.length === 0) {
      setError('None of the cells on this site have frequency configured. Use Edit Site to assign bands.');
      return;
    }

    setError('');
    setMultiLoading(true);
    setResult(null);
    setMultiResults(null);
    try {
      const resp = await simulateAPI.simulateMulti({
        tower_ids: validTowers.map((t) => t.id),
        resolution: 120,
        terrain_aware: true,
        building_aware: true,
      });

      setMultiResults(resp.layers);
      if (resp.layers.length > 0) {
        setResult(resp.layers[0]);
        onSimulationComplete(resp.layers[0]);
      }
      onMultiSimulationComplete?.(resp.layers);
      setSuccessMsg(`Simulated ${resp.layers.length} carrier/band layers!`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e: any) {
      setError(e.response?.data?.detail ?? 'Multi-carrier simulation failed.');
    } finally {
      setMultiLoading(false);
    }
  };

  // ── Save Site & Cells Changes (Requirement 4) ────────────────────────────
  const handleSaveEdit = async () => {
    if (!selectedTower) {
      setError('No site selected to save.');
      return;
    }
    setError('');
    setSuccessMsg('');
    setSavingEdit(true);

    const siteId = selectedTower.site_id || selectedTower.id;

    try {
      // 1. Update existing cells or create new ones
      for (let i = 0; i < editCells.length; i++) {
        const cell = editCells[i];
        if (cell.id) {
          // Existing cell -> update
          await towerAPI.update(cell.id, {
            name: editSiteName,
            tower_type: editTowerType,
            height_m: editHeight,
            power_dbm: editPower,
            operator: cell.operator,
            technology: cell.technology,
            freq_mhz: cell.freq_mhz,
            bandwidth_mhz: cell.bandwidth_mhz,
            azimuth_deg: cell.azimuth_deg,
          });
        } else {
          // Newly added cell -> create
          await towerAPI.create({
            name: editSiteName,
            lat: selectedTower.lat,
            lng: selectedTower.lng,
            operator: cell.operator,
            technology: cell.technology,
            freq_mhz: cell.freq_mhz,
            bandwidth_mhz: cell.bandwidth_mhz,
            height_m: editHeight,
            power_dbm: editPower,
            tower_type: editTowerType,
            azimuth_deg: cell.azimuth_deg,
            source: 'user_test',
            site_id: siteId,
            cell_id: `${siteId}-C${i + 1}`,
          });
        }
      }

      onTowersChanged?.();
      setSuccessMsg('✅ Site and radio cells saved successfully!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to save site edits.');
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Add Cell to Edit List ────────────────────────────────────────────────
  const handleAddCellToEdit = () => {
    const defaultBand = COMMON_BANDS[editCells.length % COMMON_BANDS.length];
    const defaultOp = OPERATORS[editCells.length % OPERATORS.length];
    setEditCells((prev) => [
      ...prev,
      {
        operator: defaultOp,
        technology: defaultBand.tech,
        freq_mhz: defaultBand.freq,
        bandwidth_mhz: defaultBand.bw,
        azimuth_deg: (prev.length * 120) % 360,
        height_m: editHeight,
        power_dbm: editPower,
      },
    ]);
  };

  // ── Remove Cell from Edit List ───────────────────────────────────────────
  const handleRemoveCellFromEdit = async (index: number) => {
    const cellToRemove = editCells[index];
    if (cellToRemove.id) {
      if (editCells.length <= 1) {
        setError('A site must have at least one radio cell.');
        return;
      }
      try {
        await towerAPI.delete(cellToRemove.id);
        onTowersChanged?.();
      } catch (err: any) {
        setError('Failed to delete cell: ' + err.message);
        return;
      }
    }
    setEditCells((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Create and Simulate New Tower ────────────────────────────────────────
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
      setTimeout(() => {
        handleSimulate(created.id);
      }, 300);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to create test tower.');
    } finally {
      setSavingNew(false);
    }
  };

  const handleQuickConfigure = async (
    targetTower: Tower,
    freq: number,
    tech: string,
    bw: number,
    op: string
  ) => {
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
    setMultiResults(null);
    onSimulationComplete(null);
    onMultiSimulationComplete?.(null);
    setError('');
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-700 bg-slate-800 shrink-0">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Activity size={18} className="text-indigo-400" /> Coverage Simulation & Site Studio
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Circular 3-sector cellular coverage, terrain raycasting & multi-carrier comparison.
        </p>

        {/* 3-Mode Switcher */}
        <div className="flex gap-1.5 mt-3 bg-slate-900 p-1 rounded-lg border border-slate-700 text-xs">
          <button
            onClick={() => setMode('simulate')}
            className={`flex-1 py-1.5 rounded-md font-semibold transition-all flex items-center justify-center gap-1 ${
              mode === 'simulate'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio size={13} /> Simulate
          </button>
          <button
            onClick={() => setMode('edit')}
            className={`flex-1 py-1.5 rounded-md font-semibold transition-all flex items-center justify-center gap-1 ${
              mode === 'edit'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Edit3 size={13} /> Edit Site
          </button>
          <button
            onClick={() => setMode('add')}
            className={`flex-1 py-1.5 rounded-md font-semibold transition-all flex items-center justify-center gap-1 ${
              mode === 'add'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Plus size={13} /> Add Site
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">

        {/* Success Banner */}
        {successMsg && (
          <div className="bg-emerald-950/60 border border-emerald-700 text-emerald-300 p-2.5 rounded-lg text-xs flex items-center gap-2">
            <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="bg-red-900/40 border border-red-800 text-red-300 p-2.5 rounded-lg text-xs flex items-start gap-2">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            MODE: EDIT SITE & RADIO CELLS (Requirement 4 & 5)
            ══════════════════════════════════════════════════════════════════ */}
        {mode === 'edit' && (
          <>
            {!selectedTower ? (
              <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-6 text-center space-y-2">
                <Edit3 size={32} className="text-indigo-400 mx-auto opacity-70" />
                <h4 className="text-sm font-bold text-white">Select a Site to Edit</h4>
                <p className="text-xs text-slate-400">
                  Click any tower marker on the map and click <strong className="text-indigo-300">"✏ Edit Site & Cells"</strong>, or choose a site from the list.
                </p>
                {towers.length > 0 && (
                  <div className="pt-2">
                    <label className="text-[11px] text-slate-400 block mb-1">Or pick from existing:</label>
                    <select
                      value={selectedTowerId}
                      onChange={(e) => setSelectedTowerId(e.target.value)}
                      className="w-full bg-slate-700 border border-slate-600 rounded p-1.5 text-xs text-white outline-none"
                    >
                      <option value="">-- Choose a site --</option>
                      {towers.slice(0, 50).map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.site_id || t.name} ({t.operator || 'Raw'} - {t.lat.toFixed(4)}, {t.lng.toFixed(4)})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Site Properties */}
                <div className="bg-slate-800 p-3.5 rounded-lg border border-slate-700 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                    <div>
                      <span className="text-xs font-bold text-white uppercase tracking-wide">
                        Site Configuration
                      </span>
                      <span className="block text-[10px] text-slate-400 font-mono">
                        {selectedTower.lat.toFixed(5)}, {selectedTower.lng.toFixed(5)}
                      </span>
                    </div>
                    <span className="text-[10px] bg-indigo-900/50 text-indigo-300 border border-indigo-700 px-2 py-0.5 rounded font-mono">
                      {selectedTower.site_id || selectedTower.id.slice(0, 8)}
                    </span>
                  </div>

                  {/* Site Name & Structure Type */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Site Name / ID</label>
                      <input
                        type="text"
                        value={editSiteName}
                        onChange={(e) => setEditSiteName(e.target.value)}
                        className="w-full bg-slate-700 border border-slate-600 rounded p-1.5 text-xs text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Structure Type</label>
                      <select
                        value={editTowerType}
                        onChange={(e) => setEditTowerType(e.target.value)}
                        className="w-full bg-slate-700 border border-slate-600 rounded p-1.5 text-xs text-white outline-none"
                      >
                        {TOWER_TYPES.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Height & Tx Power */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                        <span>Tower Height:</span>
                        <strong className="text-white">{editHeight} m</strong>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="80"
                        value={editHeight}
                        onChange={(e) => setEditHeight(parseInt(e.target.value))}
                        className="w-full accent-indigo-500"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                        <span>Site Tx Power:</span>
                        <strong className="text-white">{editPower} dBm</strong>
                      </div>
                      <input
                        type="range"
                        min="30"
                        max="52"
                        value={editPower}
                        onChange={(e) => setEditPower(parseInt(e.target.value))}
                        className="w-full accent-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Radio Cells & Multi-Carrier Configuration */}
                <div className="bg-slate-800 p-3.5 rounded-lg border border-slate-700 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                    <span className="text-xs font-bold text-white uppercase tracking-wide flex items-center gap-1.5">
                      <Layers size={14} className="text-amber-400" /> Radio Cells & Bands ({editCells.length})
                    </span>
                    <button
                      onClick={handleAddCellToEdit}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition-colors"
                    >
                      <Plus size={12} /> Add Carrier/Band
                    </button>
                  </div>

                  {/* Cells List */}
                  <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                    {editCells.map((cell, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-700/80 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: getOpColor(cell.operator) }}
                            />
                            <span className="text-xs font-bold text-white">
                              Carrier #{idx + 1}
                            </span>
                            {cell.id && (
                              <span className="text-[10px] text-slate-500 font-mono">
                                ({cell.id.slice(0, 6)})
                              </span>
                            )}
                          </div>
                          {editCells.length > 1 && (
                            <button
                              onClick={() => handleRemoveCellFromEdit(idx)}
                              className="text-slate-400 hover:text-red-400 transition-colors p-0.5"
                              title="Delete this cell"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>

                        {/* Operator & Tech */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-0.5">Operator</label>
                            <select
                              value={cell.operator}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditCells((prev) =>
                                  prev.map((c, i) => (i === idx ? { ...c, operator: val } : c))
                                );
                              }}
                              className="w-full bg-slate-800 border border-slate-600 rounded p-1 text-xs text-white outline-none"
                            >
                              {OPERATORS.map((op) => (
                                <option key={op} value={op}>{op}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-0.5">Technology</label>
                            <select
                              value={cell.technology}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditCells((prev) =>
                                  prev.map((c, i) => (i === idx ? { ...c, technology: val } : c))
                                );
                              }}
                              className="w-full bg-slate-800 border border-slate-600 rounded p-1 text-xs text-white outline-none"
                            >
                              {TECHNOLOGIES.map((tech) => (
                                <option key={tech} value={tech}>{tech}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Frequency Preset & Bandwidth */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-0.5">Spectrum Band</label>
                            <select
                              value={cell.freq_mhz}
                              onChange={(e) => {
                                const f = parseInt(e.target.value);
                                const match = COMMON_BANDS.find((b) => b.freq === f);
                                setEditCells((prev) =>
                                  prev.map((c, i) =>
                                    i === idx
                                      ? {
                                          ...c,
                                          freq_mhz: f,
                                          technology: match ? match.tech : c.technology,
                                          bandwidth_mhz: match ? match.bw : c.bandwidth_mhz,
                                        }
                                      : c
                                  )
                                );
                              }}
                              className="w-full bg-slate-800 border border-slate-600 rounded p-1 text-xs text-white outline-none font-mono"
                            >
                              {COMMON_BANDS.map((b) => (
                                <option key={b.freq} value={b.freq}>{b.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-0.5">Bandwidth (MHz)</label>
                            <select
                              value={cell.bandwidth_mhz}
                              onChange={(e) => {
                                const bw = parseFloat(e.target.value);
                                setEditCells((prev) =>
                                  prev.map((c, i) => (i === idx ? { ...c, bandwidth_mhz: bw } : c))
                                );
                              }}
                              className="w-full bg-slate-800 border border-slate-600 rounded p-1 text-xs text-white outline-none font-mono"
                            >
                              {[5, 10, 15, 20, 40, 100].map((bw) => (
                                <option key={bw} value={bw}>{bw} MHz</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="pt-2 border-t border-slate-700/80 flex flex-col gap-2">
                    <button
                      onClick={handleSaveEdit}
                      disabled={savingEdit}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow"
                    >
                      {savingEdit ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
                      {savingEdit ? 'Saving Site & Cells…' : 'Save Site & Cells Changes'}
                    </button>

                    <button
                      onClick={() => {
                        setMode('simulate');
                        setTimeout(handleSimulateMulti, 100);
                      }}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                    >
                      <Sparkles size={14} /> Simulate All Bands for this Site
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            MODE: SIMULATE COVERAGE (Requirement 2 & 5)
            ══════════════════════════════════════════════════════════════════ */}
        {mode === 'simulate' && (
          <>
            {!selectedTower ? (
              <div className="bg-indigo-900/20 border border-indigo-700/60 rounded-lg p-5 text-center space-y-2">
                <Radio size={30} className="text-indigo-400 mx-auto animate-pulse" />
                <p className="text-sm text-indigo-200 font-semibold">Click any tower on the map</p>
                <p className="text-xs text-slate-400">
                  Select a site on the GIS map to simulate multi-operator circular coverage with terrain & building awareness.
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
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                      selectedTower.source === 'rf_planned'
                        ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-700'
                        : selectedTower.source === 'user_test'
                        ? 'bg-amber-900/50 text-amber-300 border border-amber-700'
                        : 'bg-blue-900/50 text-blue-300 border border-blue-700'
                    }`}
                  >
                    {selectedTower.source === 'rf_planned'
                      ? '🛠 Planned'
                      : selectedTower.source === 'user_test'
                      ? '🧪 Test'
                      : '🏛 Real Tower'}
                  </span>
                </div>

                {/* If site has multiple cells/operators */}
                {siteMates.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] text-slate-400">Site Bands & Carriers ({siteMates.length})</label>
                      <button
                        onClick={() => setMode('edit')}
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5"
                      >
                        <Edit3 size={11} /> Edit Bands
                      </button>
                    </div>
                    <div className="space-y-1 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
                      {siteMates.map((cell) => (
                        <button
                          key={cell.id}
                          onClick={() => setSelectedTowerId(cell.id)}
                          className={`w-full text-left p-2 rounded text-xs flex items-center justify-between transition-colors border ${
                            selectedTowerId === cell.id
                              ? 'bg-indigo-900/40 border-indigo-500 text-white'
                              : 'bg-slate-700/40 border-slate-700 hover:border-slate-600 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: getOpColor(cell.operator) }}
                            />
                            <span className="font-semibold">{cell.operator || 'Unassigned'}</span>
                            <span className="text-slate-400 text-[10px]">{cell.technology}</span>
                          </div>
                          <span className="font-mono text-indigo-300 text-[11px]">
                            {cell.freq_mhz ? `${cell.freq_mhz} MHz` : 'Unconfigured'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* If selected tower is raw/unconfigured, offer instant quick-configure */}
                {selectedTower.freq_mhz == null && (
                  <div className="bg-amber-950/40 border border-amber-800 p-2.5 rounded-lg space-y-2">
                    <p className="text-[11px] text-amber-300 font-semibold flex items-center gap-1">
                      <AlertCircle size={13} /> Raw Location: Choose a band to configure
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {COMMON_BANDS.slice(0, 4).map((b) => (
                        <button
                          key={b.freq}
                          onClick={() =>
                            handleQuickConfigure(selectedTower, b.freq, b.tech, b.bw, 'Jio')
                          }
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
                      <strong className="text-indigo-300">
                        {MODEL_NAMES[autoMdl || 'cost231']} (Circular 3-Sector)
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Antenna Height & Power:</span>
                      <span className="text-slate-300">
                        {selectedTower.height_m}m · {selectedTower.power_dbm} dBm
                      </span>
                    </div>
                  </div>
                )}

                {/* Multi-Band and Single Simulation Buttons */}
                <div className="space-y-2">
                  {/* Simulate All Bands Button */}
                  <button
                    onClick={handleSimulateMulti}
                    disabled={multiLoading || loading}
                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow"
                  >
                    {multiLoading ? (
                      <Loader size={14} className="animate-spin" />
                    ) : (
                      <Sparkles size={14} className="text-amber-300" />
                    )}
                    {multiLoading
                      ? 'Simulating All Bands…'
                      : `Simulate All ${siteMates.length} Bands & Operators`}
                  </button>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSimulate()}
                      disabled={loading || multiLoading || selectedTower.freq_mhz == null}
                      className="flex-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                    >
                      {loading ? <Loader size={13} className="animate-spin" /> : <Activity size={13} />}
                      {loading ? 'Simulating…' : 'Simulate Selected Cell Only'}
                    </button>

                    {(result || multiResults) && (
                      <button
                        onClick={handleClear}
                        className="bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-semibold"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            MODE: ADD NEW TEST SITE
            ══════════════════════════════════════════════════════════════════ */}
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
                  <span className="text-emerald-300 font-bold">
                    {lat.toFixed(5)}, {lng.toFixed(5)}
                  </span>
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
                  onChange={(e) => setNewSiteName(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded p-1.5 text-xs text-white outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Operator</label>
                <select
                  value={newOperator}
                  onChange={(e) => setNewOperator(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded p-1.5 text-xs text-white outline-none"
                >
                  {OPERATORS.map((op) => (
                    <option key={op} value={op}>{op}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Band / Technology */}
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Spectrum Band & Frequency</label>
              <select
                value={newFreq}
                onChange={(e) => {
                  const f = parseInt(e.target.value);
                  setNewFreq(f);
                  const matched = COMMON_BANDS.find((b) => b.freq === f);
                  if (matched) {
                    setNewTech(matched.tech);
                    setNewBw(matched.bw);
                  }
                }}
                className="w-full bg-slate-700 border border-slate-600 rounded p-1.5 text-xs text-white outline-none font-mono"
              >
                {COMMON_BANDS.map((b) => (
                  <option key={b.freq} value={b.freq}>{b.label}</option>
                ))}
              </select>
            </div>

            {/* Structure Type */}
            <div className="grid grid-cols-3 gap-1.5">
              {TOWER_TYPES.map((type) => (
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
                  type="range"
                  min="10"
                  max="60"
                  value={newHeight}
                  onChange={(e) => setNewHeight(parseInt(e.target.value))}
                  className="w-full accent-indigo-500"
                />
              </div>
              <div>
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>Tx Power:</span>
                  <strong className="text-white">{newPower} dBm</strong>
                </div>
                <input
                  type="range"
                  min="30"
                  max="49"
                  value={newPower}
                  onChange={(e) => setNewPower(parseInt(e.target.value))}
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

        {/* ══════════════════════════════════════════════════════════════════
            MULTI-CARRIER SIMULATION RESULTS SUMMARY (Requirement 5)
            ══════════════════════════════════════════════════════════════════ */}
        {multiResults && multiResults.length > 1 && (
          <div className="bg-slate-800 p-3.5 rounded-lg border border-slate-700 space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-700 pb-2">
              <span className="font-bold text-white uppercase tracking-wide flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-400" /> Multi-Carrier Comparison
              </span>
              <span className="font-mono text-indigo-400 font-bold">
                {multiResults.length} Layers Active
              </span>
            </div>

            <div className="space-y-1.5">
              {multiResults.map((r, i) => (
                <div
                  key={i}
                  className="bg-slate-900/60 p-2 rounded flex items-center justify-between border border-slate-700/60"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: r.color || getOpColor(r.operator) }}
                    />
                    <div>
                      <span className="font-semibold text-white block leading-tight">
                        {r.operator || 'Carrier'} {r.technology}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {r.freq_mhz} MHz · {r.max_range_km.toFixed(1)} km range
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-emerald-400 font-bold block text-xs">
                      {r.avg_rsrp_dbm} dBm
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {r.area_km2.green.toFixed(1)} km² strong
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 italic">
              💡 Hover anywhere on the GIS map coverage area to inspect live RSRP & distance for each carrier!
            </p>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            SINGLE CARRIER KPI METRICS
            ══════════════════════════════════════════════════════════════════ */}
        {result && (!multiResults || multiResults.length <= 1) && (
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
