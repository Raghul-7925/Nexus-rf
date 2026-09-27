import React, { useState } from 'react';
import { RFPlanRequest, RFPlanResponse } from '../types';
import { rfPlanAPI } from '../services/api';
import {
  Compass, MapPin, Sliders, Layers, CheckCircle2,
  AlertCircle, Sparkles, Loader
} from 'lucide-react';

interface RFPlanningPanelProps {
  lat: number | null;
  lng: number | null;
  onPlanDeployed: () => void;
  onLocateArea?: () => void;
}

const GENERATIONS = [
  { id: '4G+5G', label: '4G + 5G (Tri-Band)', desc: 'Macro coverage + C-band 5G capacity' },
  { id: '5G',    label: '5G NR Only',         desc: 'Dedicated n78 (3.5GHz) + n28 (700MHz)' },
  { id: '4G',    label: '4G LTE Only',        desc: 'Wide-area B3/B5/B40 rollout' },
];

const CLUTTER_OPTIONS = [
  { id: 'auto',        label: 'Auto-Detect Clutter',      desc: 'Nominatim & elevation terrain analysis' },
  { id: 'dense_urban', label: 'Dense Urban (High-Rise)',  desc: 'Heavy clutter loss (18-20dB), rooftop/microcells' },
  { id: 'urban',       label: 'Urban (City / Commercial)', desc: 'Standard urban loss (12dB), rooftop sites' },
  { id: 'suburban',    label: 'Suburban (Residential)',   desc: 'Moderate clutter (6dB), ground lattice towers' },
  { id: 'rural',       label: 'Rural / Highway (Open)',   desc: 'Minimal clutter (2dB), tall macro towers (45m)' },
];

const OPERATORS = ['Jio', 'Airtel', 'Vi', 'BSNL'];

export const RFPlanningPanel: React.FC<RFPlanningPanelProps> = ({
  lat, lng, onPlanDeployed, onLocateArea,
}) => {
  const [radius, setRadius] = useState<number>(3.0);
  const [generation, setGeneration] = useState<string>('4G+5G');
  const [clutter, setClutter] = useState<string>('auto');
  const [operator, setOperator] = useState<string>('Jio');
  const [priority, setPriority] = useState<string>('balanced');

  const [loading, setLoading] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [planResult, setPlanResult] = useState<RFPlanResponse | null>(null);
  const [error, setError] = useState<string>('');
  const [deployedNotice, setDeployedNotice] = useState<string>('');

  const handleGeneratePlan = async () => {
    if (!lat || !lng) {
      setError('Please click anywhere on the map to set the center planning point.');
      return;
    }
    setError('');
    setDeployedNotice('');
    setLoading(true);

    const req: RFPlanRequest = {
      center_lat: lat,
      center_lng: lng,
      radius_km: radius,
      target_generation: generation,
      density_type: clutter === 'auto' ? null : clutter,
      planning_priority: priority,
      operator: operator,
    };

    try {
      const res = await rfPlanAPI.generate(req);
      setPlanResult(res);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'RF planning calculation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeployAll = async () => {
    if (!planResult || planResult.recommended_sites.length === 0) return;
    setDeploying(true);
    try {
      const res = await rfPlanAPI.deploy(planResult.recommended_sites);
      setDeployedNotice(`Successfully deployed ${res.sites_count} planned sites (${res.deployed_cells} cells) to your map!`);
      onPlanDeployed();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to deploy planned towers.');
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-700 bg-slate-800 shrink-0">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Compass size={20} className="text-indigo-400" />
          RF Planning & Dimensioning
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Cellular site placement, link budgets & spectrum allocation based on clutter & density.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">

        {/* 1. Target Center Point */}
        <div className="bg-slate-800 p-3.5 rounded-lg border border-slate-700 space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
              <MapPin size={13} className="text-indigo-400" /> Planning Center Coordinate
            </label>
            {onLocateArea && (
              <button
                onClick={onLocateArea}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium"
              >
                Use My Location
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 bg-slate-700/60 border border-slate-600 rounded px-3 py-2 text-xs font-mono">
            {lat && lng ? (
              <span className="text-indigo-200 font-semibold">{lat.toFixed(5)}, {lng.toFixed(5)}</span>
            ) : (
              <span className="text-slate-400 italic">Click anywhere on the map to set planning center</span>
            )}
          </div>

          {/* Planning Radius */}
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-slate-400">Target Planning Radius:</span>
              <strong className="text-indigo-300 font-mono">{radius.toFixed(1)} km ({Math.round(Math.PI * radius * radius)} km²)</strong>
            </div>
            <input
              type="range"
              min="1.0"
              max="10.0"
              step="0.5"
              value={radius}
              onChange={e => setRadius(parseFloat(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer"
            />
          </div>
        </div>

        {/* 2. Planning Parameters */}
        <div className="bg-slate-800 p-3.5 rounded-lg border border-slate-700 space-y-3">
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
            <Sliders size={13} className="text-indigo-400" /> Dimensioning Parameters
          </label>

          {/* Operator Profile */}
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Target Operator</label>
            <div className="grid grid-cols-4 gap-1.5">
              {OPERATORS.map(op => (
                <button
                  key={op}
                  onClick={() => setOperator(op)}
                  className={`py-1.5 rounded text-xs font-semibold transition-all ${
                    operator === op
                      ? 'bg-indigo-600 text-white shadow'
                      : 'bg-slate-700/70 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  {op}
                </button>
              ))}
            </div>
          </div>

          {/* Target Technology */}
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Target Technology</label>
            <div className="space-y-1.5">
              {GENERATIONS.map(gen => (
                <div
                  key={gen.id}
                  onClick={() => setGeneration(gen.id)}
                  className={`p-2 rounded border cursor-pointer transition-all ${
                    generation === gen.id
                      ? 'bg-indigo-900/30 border-indigo-500 text-white'
                      : 'bg-slate-700/40 border-slate-700 hover:border-slate-600 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span>{gen.label}</span>
                    {generation === gen.id && <CheckCircle2 size={13} className="text-indigo-400" />}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">{gen.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Clutter / Density Type */}
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Environment Clutter & Topology</label>
            <select
              value={clutter}
              onChange={e => setClutter(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-xs text-slate-200 outline-none"
            >
              {CLUTTER_OPTIONS.map(c => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Optimization Priority */}
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Planning Goal</label>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-xs text-slate-200 outline-none"
            >
              <option value="balanced">Balanced (Footprint + Indoor Penetration)</option>
              <option value="capacity">Capacity Oriented (Dense Microcells / High Throughput)</option>
              <option value="coverage">Coverage Oriented (Wide Macro-Radius / Low-Band Focus)</option>
            </select>
          </div>

          <button
            onClick={handleGeneratePlan}
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-2.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/40"
          >
            {loading ? <Loader size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {loading ? 'Synthesizing RF Plan & Link Budgets…' : 'Synthesize RF Plan'}
          </button>

          {error && (
            <div className="bg-red-900/40 border border-red-800 text-red-300 p-2.5 rounded text-xs flex items-start gap-2">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {deployedNotice && (
            <div className="bg-green-900/40 border border-green-800 text-green-300 p-2.5 rounded text-xs flex items-start gap-2">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
              <span>{deployedNotice}</span>
            </div>
          )}
        </div>

        {/* 3. RF Planning Results */}
        {planResult && (
          <div className="space-y-4">
            {/* Metric Summary Card */}
            <div className="bg-gradient-to-br from-indigo-950/70 to-slate-800 p-3.5 rounded-lg border border-indigo-700/50 space-y-3">
              <div className="flex items-center justify-between border-b border-indigo-900/60 pb-2">
                <span className="text-xs font-bold text-indigo-300 uppercase tracking-wide">
                  Dimensioning Overview
                </span>
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-2 py-0.5 rounded-full font-medium">
                  {planResult.environment_detected}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-900/60 p-2 rounded border border-slate-700/50">
                  <span className="text-[10px] text-slate-400 block">Proposed Sites</span>
                  <strong className="text-base text-white">{planResult.total_sites_recommended} Cell Sites</strong>
                </div>
                <div className="bg-slate-900/60 p-2 rounded border border-slate-700/50">
                  <span className="text-[10px] text-slate-400 block">Inter-Site Dist (ISD)</span>
                  <strong className="text-base text-indigo-300">{planResult.inter_site_distance_km} km</strong>
                </div>
                <div className="bg-slate-900/60 p-2 rounded border border-slate-700/50">
                  <span className="text-[10px] text-slate-400 block">Projected Coverage</span>
                  <strong className="text-base text-green-400">{planResult.projected_coverage_pct}%</strong>
                </div>
                <div className="bg-slate-900/60 p-2 rounded border border-slate-700/50">
                  <span className="text-[10px] text-slate-400 block">Est. Population</span>
                  <strong className="text-base text-amber-300">~{planResult.estimated_population_served.toLocaleString()}</strong>
                </div>
              </div>

              <button
                onClick={handleDeployAll}
                disabled={deploying}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-900/30"
              >
                {deploying ? <Loader size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                {deploying ? 'Deploying to Map…' : 'Deploy All Planned Sites to Map'}
              </button>
            </div>

            {/* Recommended Sites List */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                <Layers size={13} /> Recommended Cell Locations ({planResult.recommended_sites.length})
              </h3>

              <div className="space-y-2.5">
                {planResult.recommended_sites.map(site => (
                  <div key={site.site_id} className="bg-slate-800 p-3 rounded-lg border border-slate-700 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        {site.name}
                      </div>
                      <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded font-mono">
                        Score: {site.priority_score}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-slate-300 bg-slate-900/50 p-2 rounded">
                      <div><span className="text-slate-500">Location:</span> {site.lat}, {site.lng}</div>
                      <div><span className="text-slate-500">Structure:</span> {site.tower_type} ({site.height_m}m)</div>
                      <div><span className="text-slate-500">Tx Power:</span> {site.power_dbm} dBm</div>
                      <div><span className="text-slate-500">Cell Reach:</span> ~{site.cell_radius_km} km ({site.coverage_km2} km²)</div>
                    </div>

                    {/* Bands */}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {site.recommended_bands.map(b => (
                        <span key={b.band} className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-700/50 px-1.5 py-0.5 rounded font-mono">
                          {b.band} ({b.freq_mhz}MHz) · {b.tech}
                        </span>
                      ))}
                    </div>

                    <p className="text-[10px] text-slate-400 italic pt-1 border-t border-slate-700/60">
                      💡 {site.rationale}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
