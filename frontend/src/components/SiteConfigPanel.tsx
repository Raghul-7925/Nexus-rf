import { useState, useEffect } from 'react';
import { Tower, TowerCreate } from '../types';
import { towerAPI } from '../services/api';
import { Plus, Trash2, Save, Zap, ChevronDown, ChevronUp } from 'lucide-react';

// ── Complete Indian telecom band catalogue (flat list — all always shown) ───
// Technology is stored as metadata only; bands are never filtered.
const ALL_BANDS: { label: string; freq: number; defaultBw: number; tech: string }[] = [
  // 2G
  { label: 'B8 (900 MHz)',   freq: 900,   defaultBw: 10,  tech: '2G'     },
  { label: 'B3 (1800 MHz)',  freq: 1800,  defaultBw: 10,  tech: '2G/4G'  },
  // 3G
  { label: 'B1 (2100 MHz)',  freq: 2100,  defaultBw: 5,   tech: '3G/4G'  },
  // 4G / LTE
  { label: 'B28 (700 MHz)',  freq: 700,   defaultBw: 10,  tech: '4G'     },
  { label: 'B5 (850 MHz)',   freq: 850,   defaultBw: 10,  tech: '4G'     },
  { label: 'B40 (2300 MHz)', freq: 2300,  defaultBw: 20,  tech: '4G TDD' },
  { label: 'B41 (2500 MHz)', freq: 2500,  defaultBw: 20,  tech: '4G TDD' },
  // 5G NR
  { label: 'n28 (700 MHz)',  freq: 703,   defaultBw: 30,  tech: '5G NR'  },
  { label: 'n78 (3500 MHz)', freq: 3500,  defaultBw: 100, tech: '5G NR'  },
  { label: 'n77 (3700 MHz)', freq: 3700,  defaultBw: 100, tech: '5G NR'  },
  { label: 'n258 (26 GHz)',  freq: 26000, defaultBw: 400, tech: '5G mmW' },
  // Custom (user-defined freq)
];

const OPERATORS   = ['Airtel', 'Jio', 'Vi', 'BSNL', 'Other'];
const TOWER_TYPES = ['Rooftop', 'Ground', 'Wall-mount'] as const;
const ANTENNA_TYPES = ['Omni', '2-Sector (180°×2)', '3-Sector (120°×3)', '4-Sector (90°×4)', '6-Sector (60°×6)'] as const;

function dbmToWatts(dbm: number) {
  const w = Math.pow(10, (dbm - 30) / 10);
  return w >= 1 ? `${w.toFixed(1)} W` : `${(w * 1000).toFixed(0)} mW`;
}

function buildSectors(antennaType: string): number[] {
  const match = antennaType.match(/(\d+)-Sector/);
  if (!match) return [];
  const n = parseInt(match[1]);
  return Array.from({ length: n }, (_, i) => Math.round((360 / n) * i));
}


// ── per-operator band selection ───────────────────────────────────────────────
interface OpConfig {
  id: string;
  operator: string;
  power_dbm: number;
  tech: string; // selected technology group
  // key = band label, value = bandwidth MHz (user-editable, defaults to band's defaultBw)
  selectedBands: Record<string, number>;
  customFreq: string;  // for custom frequency entry
  customBw: string;
  open: boolean;
}

interface SiteConfigPanelProps {
  lat: number | null;
  lng: number | null;
  editingSite: Tower[] | null;
  onSave: (towers: TowerCreate[]) => void;
}

export function SiteConfigPanel({ lat, lng, editingSite, onSave }: SiteConfigPanelProps) {
  const [siteName, setSiteName] = useState('');
  const [towerType, setTowerType] = useState<typeof TOWER_TYPES[number]>('Rooftop');
  const [height, setHeight] = useState(30);
  const [antennaType, setAntennaType] = useState('Omni');
  const [sectors, setSectors] = useState<number[]>([]);
  const [operators, setOperators] = useState<OpConfig[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Populate form when editing existing site
  useEffect(() => {
    if (!editingSite || editingSite.length === 0) {
      setSiteName('');
      setTowerType('Rooftop');
      setHeight(30);
      setAntennaType('Omni');
      setSectors([]);
      setOperators([]);
      return;
    }

    const first = editingSite[0];
    setSiteName(first.site_id ?? first.name.split(' - ')[0]);
    setTowerType((first.tower_type as typeof TOWER_TYPES[number]) ?? 'Rooftop');
    setHeight(first.height_m ?? 30);

    // Reconstruct operator configs from editing site
    const opMap: Record<string, OpConfig> = {};
    editingSite.forEach(t => {
      if (!t.operator && t.freq_mhz == null) return;
      const op = t.operator ?? 'Other';
      if (!opMap[op]) {
        opMap[op] = {
          id: `${op}-${Date.now()}`,
          operator: op,
          power_dbm: t.power_dbm ?? 43,
          tech: t.technology ?? '4G',
          selectedBands: {},
          customFreq: '',
          customBw: '',
          open: true,
        };
      }
      // Match band by frequency
      const band = ALL_BANDS.find(b => b.freq === t.freq_mhz);
      if (band) {
        opMap[op].selectedBands[band.label] = t.bandwidth_mhz ?? band.defaultBw;
      }
    });
    setOperators(Object.values(opMap));
  }, [editingSite]);

  useEffect(() => { setSectors(buildSectors(antennaType)); }, [antennaType]);

  const addOperator = () => {
    setOperators(ops => [
      ...ops,
      { id: `op-${Date.now()}`, operator: 'Jio', power_dbm: 43, tech: '4G', selectedBands: {}, customFreq: '', customBw: '', open: true },
    ]);
  };

  const removeOperator = (id: string) => setOperators(ops => ops.filter(o => o.id !== id));

  const toggleBand = (opId: string, bandLabel: string, defaultBw: number) => {
    setOperators(ops => ops.map(o => {
      if (o.id !== opId) return o;
      const next = { ...o.selectedBands };
      if (next[bandLabel] !== undefined) {
        delete next[bandLabel];
      } else {
        next[bandLabel] = defaultBw;
      }
      return { ...o, selectedBands: next };
    }));
  };

  const updateBandBw = (opId: string, bandLabel: string, bw: number) => {
    setOperators(ops => ops.map(o =>
      o.id !== opId ? o : { ...o, selectedBands: { ...o.selectedBands, [bandLabel]: bw } }
    ));
  };

  const updateOp = <K extends keyof OpConfig>(id: string, key: K, val: OpConfig[K]) => {
    setOperators(ops => ops.map(o => o.id !== id ? o : { ...o, [key]: val }));
  };

  const handleSave = async () => {
    if (!lat || !lng) { setError('Click on the map to set location first.'); return; }
    if (!siteName.trim()) { setError('Enter a site name.'); return; }
    if (operators.length === 0) { setError('Add at least one operator.'); return; }

    const allBandsEmpty = operators.every(o => Object.keys(o.selectedBands).length === 0 && !o.customFreq);
    if (allBandsEmpty) { setError('Select at least one band for each operator.'); return; }

    setError('');
    setSaving(true);

    const siteId = `SITE-${siteName.toUpperCase().replace(/\s+/g, '_')}-${Date.now()}`;

    try {
      if (editingSite && editingSite.length > 0) {
        const sid = editingSite[0].site_id;
        if (sid) await towerAPI.deleteSite(sid).catch(() => {});
        else await Promise.all(editingSite.map(t => towerAPI.delete(t.id).catch(() => {})));
      }

      const newTowers: TowerCreate[] = [];
      const sectorAzimuths = sectors.length > 0 ? sectors : [null as null];

      for (const op of operators) {
        // Catalogue bands
        const entries = Object.entries(op.selectedBands);
        for (const [bandLabel, bw] of entries) {
          const band = ALL_BANDS.find(b => b.label === bandLabel);
          if (!band) continue;
          for (const azimuth of sectorAzimuths) {
            newTowers.push({
              name: `${siteName} - ${op.operator} ${bandLabel}${azimuth !== null ? ` Az${azimuth}°` : ''}`,
              lat, lng,
              freq_mhz: band.freq,
              bandwidth_mhz: bw,
              height_m: height,
              power_dbm: op.power_dbm,
              operator: op.operator,
              technology: band.tech,
              tower_type: towerType,
              azimuth_deg: azimuth,
              site_id: siteId,
              source: 'manual',
              cell_id: null,
            });
          }
        }
      }

      if (newTowers.length === 0) { setError('No valid bands selected.'); setSaving(false); return; }
      onSave(newTowers);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-700 bg-slate-800 shrink-0">
        <h2 className="text-lg font-bold text-white">
          {editingSite ? '✏ Edit Site' : '+ New Site'}
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          {lat && lng
            ? `📍 ${lat.toFixed(5)}, ${lng.toFixed(5)}`
            : 'Click on map to place site'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-thin">

        {/* Site Name */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wide">Site Name</label>
          <input
            type="text"
            value={siteName}
            onChange={e => setSiteName(e.target.value)}
            placeholder="e.g. Radhapuram Main Tower"
            className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Tower Type */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">Tower Type</label>
          <div className="grid grid-cols-3 gap-2">
            {TOWER_TYPES.map(t => (
              <button
                key={t}
                onClick={() => setTowerType(t)}
                className={`py-2 rounded text-xs font-medium border transition-colors ${
                  towerType === t
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {t === 'Ground' ? '🟢' : t === 'Rooftop' ? '🔵' : '🩷'} {t}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Colour code: Green=Ground · Blue=Rooftop · Pink=Wall-mount</p>
        </div>

        {/* Height */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wide">
            Tower Height — <span className="text-white">{height} m</span>
          </label>
          <input
            type="range" min={5} max={120} step={1}
            value={height}
            onChange={e => setHeight(Number(e.target.value))}
            className="w-full accent-indigo-500"
          />
          <div className="flex justify-between text-[10px] text-slate-500 mt-0.5"><span>5 m</span><span>120 m</span></div>
        </div>

        {/* Antenna Type */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wide">Antenna Pattern</label>
          <select
            value={antennaType}
            onChange={e => setAntennaType(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
          >
            {ANTENNA_TYPES.map(a => <option key={a}>{a}</option>)}
          </select>
          {sectors.length > 0 && (
            <div className="mt-2 space-y-1">
              <p className="text-[10px] text-slate-400">Sector azimuths (editable):</p>
              <div className="flex gap-2 flex-wrap">
                {sectors.map((az, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400">S{i+1}:</span>
                    <input
                      type="number" min={0} max={359}
                      value={az}
                      onChange={e => setSectors(s => s.map((v, j) => j === i ? Number(e.target.value) : v))}
                      className="w-16 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white text-center"
                    />
                    <span className="text-[10px] text-slate-400">°</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Operators ────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Operators & Bands</label>
            <button
              onClick={addOperator}
              className="flex items-center gap-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1 rounded font-medium"
            >
              <Plus size={12} /> Add Operator
            </button>
          </div>

          {operators.length === 0 && (
            <div className="text-center py-6 text-slate-500 text-sm bg-slate-800/50 rounded-lg border border-slate-700 border-dashed">
              No operators added yet.<br/>
              <span className="text-xs">Click "Add Operator" to start.</span>
            </div>
          )}

          <div className="space-y-3">
            {operators.map(op => (
              <div key={op.id} className="bg-slate-800 rounded-lg border border-slate-700">
                {/* Operator header */}
                <div className="flex items-center gap-2 p-3">
                  <button
                    onClick={() => updateOp(op.id, 'open', !op.open)}
                    className="text-slate-400 hover:text-white"
                  >
                    {op.open ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                  </button>
                  <select
                    value={op.operator}
                    onChange={e => updateOp(op.id, 'operator', e.target.value)}
                    className="flex-1 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white"
                  >
                    {OPERATORS.map(o => <option key={o}>{o}</option>)}
                  </select>
                  <button onClick={() => removeOperator(op.id)} className="text-red-400 hover:text-red-300">
                    <Trash2 size={14}/>
                  </button>
                </div>

                {op.open && (
                  <div className="px-3 pb-3 space-y-3 border-t border-slate-700 pt-3">

                    {/* Power */}
                    <div>
                      <label className="text-[11px] text-slate-400 font-medium">
                        TX Power: <span className="text-white font-bold">{op.power_dbm} dBm</span>
                        <span className="text-slate-500 ml-1">({dbmToWatts(op.power_dbm)})</span>
                      </label>
                      <input
                        type="range" min={20} max={60} step={0.5}
                        value={op.power_dbm}
                        onChange={e => updateOp(op.id, 'power_dbm', Number(e.target.value))}
                        className="w-full accent-indigo-500 mt-1"
                      />
                      <div className="flex justify-between text-[10px] text-slate-500"><span>20 dBm (100 mW)</span><span>60 dBm (1 kW)</span></div>
                    </div>

                    {/* All bands — flat list, always shown, with editable BW */}
                    <div>
                      <label className="text-[11px] text-slate-400 font-medium block mb-1.5 flex items-center gap-1">
                        <Zap size={11}/> Select Bands &amp; Set Bandwidth
                      </label>
                      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                        {ALL_BANDS.map(band => {
                          const checked = op.selectedBands[band.label] !== undefined;
                          const bw = op.selectedBands[band.label] ?? band.defaultBw;
                          return (
                            <div
                              key={band.label}
                              className={`rounded border transition-colors ${
                                checked ? 'bg-indigo-900/50 border-indigo-600' : 'bg-slate-700/50 border-slate-600'
                              }`}
                            >
                              <label className="flex items-center gap-2 px-2 py-1.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleBand(op.id, band.label, band.defaultBw)}
                                  className="accent-indigo-500 flex-shrink-0"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-semibold text-white">{band.label}</div>
                                  <div className="text-[10px] text-slate-400">{band.tech}</div>
                                </div>
                                {/* Editable BW — only visible when checked */}
                                {checked && (
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <input
                                      type="number"
                                      min={1} max={500} step={1}
                                      value={bw}
                                      onClick={e => e.stopPropagation()}
                                      onChange={e => updateBandBw(op.id, band.label, Number(e.target.value))}
                                      className="w-14 bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-xs text-white text-center"
                                    />
                                    <span className="text-[10px] text-slate-400">MHz</span>
                                  </div>
                                )}
                                {!checked && (
                                  <span className="text-[10px] text-slate-500">{band.defaultBw} MHz</span>
                                )}
                              </label>
                            </div>
                          );
                        })}
                      </div>
                      {/* Custom frequency */}
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="number" placeholder="Custom MHz" min={400} max={100000}
                          value={op.customFreq}
                          onChange={e => updateOp(op.id, 'customFreq', e.target.value)}
                          className="flex-1 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white placeholder-slate-500"
                        />
                        <input
                          type="number" placeholder="BW MHz" min={1} max={500}
                          value={op.customBw}
                          onChange={e => updateOp(op.id, 'customBw', e.target.value)}
                          className="w-20 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white placeholder-slate-500"
                        />
                        <button
                          onClick={() => {
                            const f = parseFloat(op.customFreq);
                            const b = parseFloat(op.customBw);
                            if (!f) return;
                            const lbl = `Custom (${f} MHz)`;
                            updateBandBw(op.id, lbl, b || 10);
                            updateOp(op.id, 'customFreq', '');
                            updateOp(op.id, 'customBw', '');
                          }}
                          className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded font-medium"
                        >+</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded p-3 text-sm text-red-300">
            ⚠ {error}
          </div>
        )}
      </div>

      {/* Save button */}
      <div className="p-4 border-t border-slate-700 bg-slate-800 shrink-0">
        <button
          onClick={handleSave}
          disabled={saving || !lat || !lng}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-lg transition-colors"
        >
          <Save size={16}/>
          {saving ? 'Saving…' : editingSite ? 'Update Site' : 'Save Site'}
        </button>
        {(!lat || !lng) && (
          <p className="text-center text-xs text-slate-500 mt-2">📍 Click on the map first</p>
        )}
      </div>
    </div>
  );
}
