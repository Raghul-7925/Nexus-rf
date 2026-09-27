import React, { useState } from 'react';
import { CompareRequest, CompareResponse, CompareResultItem } from '../types';
import { compareAPI } from '../services/api';
import {
  BarChart, MapPin, Trophy, Zap, Gamepad2, Home, Loader
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

export const ComparePanel: React.FC<ComparePanelProps> = ({ lat, lng, onLocateUser }) => {
  const [radius, setRadius] = useState<number>(5.0);
  const [persona, setPersona] = useState<string>('balanced');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [error, setError] = useState<string>('');

  const handleCompare = async () => {
    if (!lat || !lng) {
      setError('Please click anywhere on the map to set your evaluation point.');
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
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <BarChart size={18} className="text-indigo-400" /> Best ISP Recommendation
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Rank telecom operators at your location tailored to your daily digital needs.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">

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
              <span className="text-slate-400 italic">Click map to set your house / office location</span>
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

        {/* 2. User Digital Needs / Persona */}
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
            {loading ? 'Evaluating Signal & Capacity…' : 'Find Best ISP for Me'}
          </button>

          {error && (
            <div className="bg-red-900/40 border border-red-800 text-red-300 p-2.5 rounded text-xs">
              {error}
            </div>
          )}
        </div>

        {/* 3. Results & Top Recommendation */}
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
                  <span className="text-xs bg-indigo-600/40 border border-indigo-400 text-indigo-200 px-2 py-1 rounded font-bold font-mono">
                    Score: {topPick.balanced_score}
                  </span>
                </div>

                {topPick.verdict && (
                  <p className="text-xs text-emerald-300 font-semibold bg-emerald-950/40 border border-emerald-800/60 p-2 rounded">
                    {topPick.verdict}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-900/60 p-2.5 rounded border border-slate-700/60">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Signal Strength</span>
                    <strong className="text-emerald-400 font-mono text-sm">{topPick.rx_dbm} dBm</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Nearest Cell</span>
                    <strong className="text-white text-xs">{topPick.distance_km} km away</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Carrier Bandwidth</span>
                    <strong className="text-indigo-300 font-mono">{topPick.bandwidth_mhz} MHz</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Main Carrier</span>
                    <strong className="text-slate-200 font-mono">{topPick.freq_mhz} MHz ({topPick.technology})</strong>
                  </div>
                </div>

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
                No active towers detected within {radius} km. Try increasing the search radius!
              </div>
            )}

            {/* Complete Operator Ranking Table */}
            {result.results.length > 1 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Complete Operator Leaderboard
                </h4>

                <div className="space-y-2">
                  {result.results.slice(1).map((r, i) => (
                    <div key={r.operator} className="bg-slate-800 p-3 rounded-lg border border-slate-700 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold text-white">
                          <span className="text-slate-500 font-mono text-[11px]">#{i + 2}</span>
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getOpColor(r.operator) }} />
                          {r.operator}
                        </div>
                        <span className="font-mono text-slate-400 font-semibold">{r.balanced_score} pts</span>
                      </div>

                      <div className="flex justify-between text-[11px] text-slate-400">
                        <span>Signal: <strong className="text-slate-300 font-mono">{r.rx_dbm} dBm</strong></span>
                        <span>Dist: <strong className="text-slate-300 font-mono">{r.distance_km} km</strong></span>
                        <span>BW: <strong className="text-slate-300 font-mono">{r.bandwidth_mhz} MHz</strong></span>
                      </div>

                      {r.verdict && (
                        <p className="text-[10px] text-slate-400 italic pt-1 border-t border-slate-700/50">
                          {r.verdict}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
