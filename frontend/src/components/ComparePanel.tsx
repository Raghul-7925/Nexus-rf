import React, { useState } from 'react';
import { CompareRequest, CompareResponse, CompareResultItem } from '../types';
import { compareAPI } from '../services/api';
import {
  BarChart, MapPin, Trophy, Zap, Gamepad2, Home, Loader,
  ShieldCheck, CheckCircle2, AlertTriangle, Sparkles, Wifi, Clock, Signal
} from 'lucide-react';

interface ComparePanelProps {
  lat: number | null;
  lng: number | null;
  onLocateUser?: () => void;
}

const PERSONAS = [
  { id: 'balanced', label: 'Balanced',     icon: Trophy,   desc: 'Best overall combination of speed, coverage & reliability' },
  { id: 'speed',    label: 'Fast Speed',   icon: Zap,      desc: 'Optimized for high-bandwidth video streaming & downloads' },
  { id: 'gaming',   label: 'Low Latency',  icon: Gamepad2, desc: 'Optimized for mobile gaming, 5G NR low latency & ping' },
  { id: 'indoor',   label: 'Deep Indoor',  icon: Home,     desc: 'Optimized for Sub-1GHz wall penetration & rural reception' },
];

const OP_COLORS: Record<string, string> = {
  jio:    '#f97316',
  airtel: '#ef4444',
  vi:     '#eab308',
  bsnl:   '#22c55e',
};

function getOpColor(op: string) {
  const l = op.toLowerCase();
  for (const [k, v] of Object.entries(OP_COLORS)) if (l.includes(k)) return v;
  return '#6366f1';
}

function estimateThroughput(rx_dbm: number, bw_mhz: number, tech: string | null) {
  const is5G = tech?.toLowerCase().includes('5g');
  let effBpsHz = 0.5;
  if (rx_dbm >= -80) effBpsHz = is5G ? 7.5 : 4.8;
  else if (rx_dbm >= -90) effBpsHz = is5G ? 5.2 : 3.5;
  else if (rx_dbm >= -100) effBpsHz = is5G ? 3.0 : 2.0;
  else if (rx_dbm >= -108) effBpsHz = is5G ? 1.5 : 0.9;
  else effBpsHz = 0.3;

  const bw = Math.max(bw_mhz || 10, 5);
  const mimo = is5G ? 3.5 : 1.8;
  const dlMbps = Math.round(bw * effBpsHz * mimo);
  const ulMbps = Math.round(dlMbps * 0.22);
  return { dlMbps, ulMbps };
}

function estimateLatency(tech: string | null, rx_dbm: number) {
  const is5G = tech?.toLowerCase().includes('5g');
  const is4G = tech?.toLowerCase().includes('4g') || tech?.toLowerCase().includes('lte');
  let basePing = is5G ? 16 : (is4G ? 32 : 80);
  if (rx_dbm < -100) basePing += 14;
  if (rx_dbm < -108) basePing += 25;
  return `${basePing} - ${basePing + 10} ms`;
}

function getSignalLevel(rsrp: number) {
  if (rsrp >= -85) return { label: 'Excellent', color: 'text-emerald-400', bg: 'bg-emerald-500', pct: 95 };
  if (rsrp >= -98) return { label: 'Good', color: 'text-blue-400', bg: 'bg-blue-500', pct: 72 };
  if (rsrp >= -108) return { label: 'Fair (Edge)', color: 'text-amber-400', bg: 'bg-amber-500', pct: 45 };
  return { label: 'Poor / No Service', color: 'text-red-400', bg: 'bg-red-500', pct: 15 };
}

export const ComparePanel: React.FC<ComparePanelProps> = ({ lat, lng, onLocateUser }) => {
  const [radius, setRadius] = useState<number>(5.0);
  const [persona, setPersona] = useState<string>('balanced');
  const [dataSource, setDataSource] = useState<'verified' | 'test' | 'all'>('verified');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [error, setError] = useState<string>('');

  const handleCompare = async () => {
    if (!lat || !lng) {
      setError('Please tap or click anywhere on the map to set your evaluation location.');
      return;
    }
    setError('');
    setLoading(true);

    const req: CompareRequest = {
      lat,
      lng,
      radius_km: radius,
      sort_by: persona,
      model: 'cost231',
      environment: 'urban',
      data_source: dataSource,
    };

    try {
      const res = await compareAPI.compare(req);
      setResult(res);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Comparison analysis failed.');
    } finally {
      setLoading(false);
    }
  };

  const topPick: CompareResultItem | null =
    result && result.results.length > 0 ? result.results[0] : null;

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-700 bg-slate-800 shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <BarChart size={18} className="text-indigo-400" /> Best ISP Recommendation
          </h2>
          <span className="text-[10px] bg-indigo-950/80 text-indigo-300 border border-indigo-800/80 px-2 py-0.5 rounded font-mono font-semibold">
            3GPP TR 36.942
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Rank telecom operators at your location based on certified RF signal, capacity & MAPL limits.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">

        {/* 1. Evaluation Location */}
        <div className="bg-slate-800 p-3.5 rounded-lg border border-slate-700 space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
              <MapPin size={13} className="text-indigo-400" /> Evaluation Point
            </label>
            {onLocateUser && (
              <button
                onClick={onLocateUser}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium"
              >
                Use My Location
              </button>
            )}
          </div>

          <div className="bg-slate-700/60 p-2 rounded border border-slate-600 text-xs font-mono">
            {lat && lng ? (
              <span className="text-indigo-200 font-semibold">{lat.toFixed(5)}, {lng.toFixed(5)}</span>
            ) : (
              <span className="text-slate-400 italic">Tap or click map to set evaluation point</span>
            )}
          </div>

          {/* Search Radius */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">Search Radius:</span>
              <strong className="text-indigo-300 font-mono">{radius.toFixed(1)} km</strong>
            </div>
            <input
              type="range" min="1" max="15" step="0.5"
              value={radius} onChange={e => setRadius(parseFloat(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer"
            />
          </div>
        </div>

        {/* 2. Data Source Isolation (Official Baseline vs Test Sandbox) */}
        <div className="bg-slate-800 p-3.5 rounded-lg border border-slate-700 space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-400" /> Data Source Isolation
            </label>
            <span className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded font-mono">
              {dataSource === 'verified' ? '4,896 DoT Sites' : dataSource === 'test' ? 'Sandbox Only' : 'Unified'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 bg-slate-900/70 p-1 rounded-lg border border-slate-700/80">
            <button
              type="button"
              onClick={() => setDataSource('verified')}
              className={`py-1.5 px-2 rounded text-[11px] font-bold flex flex-col items-center gap-0.5 transition-all ${
                dataSource === 'verified'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span className="flex items-center gap-1">🏛️ Verified</span>
              <span className="text-[9px] font-normal opacity-85">DoT TarangSanchar</span>
            </button>
            <button
              type="button"
              onClick={() => setDataSource('test')}
              className={`py-1.5 px-2 rounded text-[11px] font-bold flex flex-col items-center gap-0.5 transition-all ${
                dataSource === 'test'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span className="flex items-center gap-1">🧪 Test</span>
              <span className="text-[9px] font-normal opacity-85">Sandbox / Plan</span>
            </button>
            <button
              type="button"
              onClick={() => setDataSource('all')}
              className={`py-1.5 px-2 rounded text-[11px] font-bold flex flex-col items-center gap-0.5 transition-all ${
                dataSource === 'all'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span className="flex items-center gap-1">🌐 Unified</span>
              <span className="text-[9px] font-normal opacity-85">All Combined</span>
            </button>
          </div>

          {dataSource === 'verified' && (
            <div className="flex items-start gap-1.5 text-[11px] text-emerald-300 bg-emerald-950/40 border border-emerald-800/60 p-2 rounded">
              <CheckCircle2 size={13} className="shrink-0 mt-0.5 text-emerald-400" />
              <span>
                <strong>Govt/DoT TarangSanchar Baseline:</strong> Evaluates only certified, operational macro base stations. User test additions are excluded from this public recommendation.
              </span>
            </div>
          )}
          {dataSource === 'test' && (
            <div className="flex items-start gap-1.5 text-[11px] text-purple-300 bg-purple-950/40 border border-purple-800/60 p-2 rounded">
              <AlertTriangle size={13} className="shrink-0 mt-0.5 text-purple-400" />
              <span>
                <strong>Sandbox Mode:</strong> Evaluates exclusively against student & RF engineer custom test sites for what-if scenarios.
              </span>
            </div>
          )}
          {dataSource === 'all' && (
            <div className="flex items-start gap-1.5 text-[11px] text-indigo-300 bg-indigo-950/40 border border-indigo-800/60 p-2 rounded">
              <Sparkles size={13} className="shrink-0 mt-0.5 text-indigo-400" />
              <span>
                <strong>Unified Analysis:</strong> Considers both official operational base stations and newly planned test towers together.
              </span>
            </div>
          )}
        </div>

        {/* 3. User Digital Needs / Persona */}
        <div className="bg-slate-800 p-3.5 rounded-lg border border-slate-700 space-y-2.5">
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide block">
            What matters most to you?
          </label>

          <div className="grid grid-cols-2 gap-2">
            {PERSONAS.map(p => {
              const Icon = p.icon;
              const isSelected = persona === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => setPersona(p.id)}
                  className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-indigo-900/40 border-indigo-500 shadow'
                      : 'bg-slate-700/40 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white mb-0.5">
                    <Icon size={14} className={isSelected ? 'text-indigo-400' : 'text-slate-400'} />
                    <span>{p.label}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight">{p.desc}</p>
                </div>
              );
            })}
          </div>

          <button
            onClick={handleCompare}
            disabled={loading || !lat || !lng}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/40 mt-2"
          >
            {loading ? <Loader size={14} className="animate-spin" /> : <Trophy size={14} />}
            {loading ? 'Evaluating Signal, Capacity & MAPL…' : 'Find Best ISP for Me'}
          </button>

          {error && (
            <div className="bg-red-900/40 border border-red-800 text-red-300 p-2.5 rounded text-xs">
              {error}
            </div>
          )}
        </div>

        {/* 4. Results & Top Recommendation */}
        {result && (
          <div className="space-y-4">
            {topPick ? (
              <div className="bg-gradient-to-br from-indigo-950 via-slate-800 to-slate-900 p-4 rounded-xl border border-indigo-500 shadow-xl space-y-3">
                <div className="flex items-center justify-between border-b border-indigo-800/60 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🏆</span>
                    <div>
                      <span className="text-[10px] text-indigo-300 uppercase tracking-widest font-extrabold block">
                        #1 Top Recommended ISP
                      </span>
                      <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getOpColor(topPick.operator) }} />
                        {topPick.operator}
                      </h3>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs bg-indigo-600/40 border border-indigo-400 text-indigo-200 px-2 py-1 rounded font-bold font-mono">
                      Score: {topPick.balanced_score}
                    </span>
                    <span className="block text-[9px] text-slate-400 font-mono mt-0.5">
                      {result.data_source_mode === 'verified' ? '🏛️ Official Data' : '🧪 Sandbox Data'}
                    </span>
                  </div>
                </div>

                {topPick.verdict && (
                  <p className="text-xs text-emerald-300 font-semibold bg-emerald-950/40 border border-emerald-800/60 p-2 rounded">
                    {topPick.verdict}
                  </p>
                )}

                {/* 3GPP RSRP Signal Gauge Bar */}
                {(() => {
                  const sig = getSignalLevel(topPick.rx_dbm);
                  return (
                    <div className="space-y-1 bg-slate-900/70 p-2 rounded border border-slate-700/60">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Signal size={12} className={sig.color} /> 3GPP RSRP Signal:
                        </span>
                        <div className="flex items-center gap-1.5 font-mono">
                          <strong className={sig.color}>{topPick.rx_dbm} dBm</strong>
                          <span className="text-[10px] text-slate-400">({sig.label})</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${sig.bg}`}
                          style={{ width: `${sig.pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })()}

                {/* Performance KPIs */}
                {(() => {
                  const tp = estimateThroughput(topPick.rx_dbm, topPick.bandwidth_mhz, topPick.technology);
                  const latStr = estimateLatency(topPick.technology, topPick.rx_dbm);
                  return (
                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-900/60 p-2.5 rounded border border-slate-700/60">
                      <div>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Wifi size={10} className="text-indigo-400" /> Est. Download
                        </span>
                        <strong className="text-emerald-400 font-mono text-sm">~{tp.dlMbps} Mbps</strong>
                        <span className="text-[9px] text-slate-400 block font-mono">UL ~{tp.ulMbps} Mbps</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Clock size={10} className="text-indigo-400" /> Est. Latency
                        </span>
                        <strong className="text-indigo-300 font-mono text-xs">{latStr}</strong>
                        <span className="text-[9px] text-slate-400 block">Ping to gateway</span>
                      </div>
                      <div className="pt-1 border-t border-slate-700/50">
                        <span className="text-[10px] text-slate-400 block">Nearest Cell</span>
                        <strong className="text-white text-xs">{topPick.distance_km} km away</strong>
                      </div>
                      <div className="pt-1 border-t border-slate-700/50">
                        <span className="text-[10px] text-slate-400 block">Spectrum / Tech</span>
                        <strong className="text-slate-200 font-mono text-xs">
                          {topPick.bandwidth_mhz} MHz ({topPick.technology || '4G/5G'})
                        </strong>
                      </div>
                    </div>
                  );
                })()}

                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
                    Available Carrier Bands at this Location:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {(topPick.bands_available || []).map((b: string) => (
                      <span key={b} className="text-[10px] bg-slate-800 border border-slate-700 px-2 py-0.5 rounded font-mono text-slate-300">
                        {b}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-800 p-4 rounded-lg text-center text-xs text-slate-400">
                No active base stations detected within {radius} km for the selected dataset. Try increasing the search radius or switching data source!
              </div>
            )}

            {/* Complete Operator Ranking Table */}
            {result.results.length > 1 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Complete Operator Leaderboard
                </h4>

                <div className="space-y-2">
                  {result.results.slice(1).map((r, i) => {
                    const tp = estimateThroughput(r.rx_dbm, r.bandwidth_mhz, r.technology);
                    return (
                      <div key={r.operator} className="bg-slate-800 p-3 rounded-lg border border-slate-700 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 font-bold text-white">
                            <span className="text-slate-500 font-mono text-[11px]">#{i + 2}</span>
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getOpColor(r.operator) }} />
                            {r.operator}
                          </div>
                          <span className="font-mono text-slate-300 font-semibold">{r.balanced_score} pts</span>
                        </div>

                        <div className="grid grid-cols-3 gap-1 text-[11px] text-slate-400 pt-1">
                          <div>
                            Signal: <strong className="text-slate-300 font-mono">{r.rx_dbm} dBm</strong>
                          </div>
                          <div>
                            Dist: <strong className="text-slate-300 font-mono">{r.distance_km} km</strong>
                          </div>
                          <div>
                            Speed: <strong className="text-emerald-400 font-mono">~{tp.dlMbps}M</strong>
                          </div>
                        </div>

                        {r.verdict && (
                          <p className="text-[10px] text-slate-400 italic pt-1 border-t border-slate-700/50">
                            {r.verdict}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
