import React, { useState, useRef } from 'react';
import {
  Upload, FileText, CheckCircle, AlertCircle, Download,
  Trash2, ShieldCheck, FlaskConical, Radio
} from 'lucide-react';
import { importAPI, towerAPI, downloadExport } from '../services/api';

interface ImportPanelProps {
  onImportComplete: () => void;
  onTowersDeleted?: () => void;
}

interface ImportStats {
  format: string;
  total_items?: number;
  valid_cells?: number;
  snapped_to_baseline?: number;
  new_field_sites?: number;
  operators?: Record<string, number>;
  technologies?: Record<string, number>;
  bands?: string[];
  imported?: number;
  batch_id?: string;
}

export const ImportPanel: React.FC<ImportPanelProps> = ({ onImportComplete, onTowersDeleted }) => {
  const [file, setFile] = useState<File | null>(null);
  const [snapToBaseline, setSnapToBaseline] = useState(true);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [exportScope, setExportScope] = useState<'all' | 'user_test' | 'real'>('user_test');
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setStatus('idle');
      setStats(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setStatus('uploading');
    setMessage('');
    setStats(null);

    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    try {
      let res: any;
      if (ext === 'ntm') {
        res = await importAPI.importNetMonster(file, snapToBaseline, 1200.0);
      } else {
        res = await importAPI.importData(file, ext, snapToBaseline);
      }

      setStatus('success');
      setMessage(`Successfully imported ${res.imported ?? res.valid_cells ?? 'all'} records into the Digital Twin.`);
      setStats({
        format: res.format || ext,
        total_items: res.total_items,
        valid_cells: res.valid_cells,
        snapped_to_baseline: res.snapped_to_baseline,
        new_field_sites: res.new_field_sites,
        operators: res.operators,
        technologies: res.technologies,
        bands: res.bands,
        imported: res.imported,
        batch_id: res.batch_id,
      });

      onImportComplete();
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setMessage(err.response?.data?.detail || 'An error occurred during dataset import.');
    }
  };

  const handleClearAll = async () => {
    if (confirm('⚠️ Are you sure you want to delete ALL towers in the database? This cannot be undone.')) {
      setDeleting(true);
      try {
        const res = await towerAPI.deleteAll('all');
        alert(`Cleared all ${res.deleted_count} towers.`);
        onTowersDeleted?.();
      } catch (err: any) {
        alert(err.response?.data?.detail || 'Failed to clear towers.');
      } finally {
        setDeleting(false);
      }
    }
  };

  const handleClearTestOnly = async () => {
    if (confirm('Clear custom test and planned towers? Real TarangSanchar baseline data and verified field audits will be preserved.')) {
      setDeleting(true);
      try {
        const res = await towerAPI.deleteAll('user_test');
        alert(`Cleared ${res.deleted_count} test/planned towers. Real baseline preserved.`);
        onTowersDeleted?.();
      } catch (err: any) {
        alert(err.response?.data?.detail || 'Failed to clear test towers.');
      } finally {
        setDeleting(false);
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-700 bg-slate-800 shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Upload size={18} className="text-indigo-400" /> Telecom Data & Field Importer
          </h2>
          <span className="text-[10px] bg-slate-700 text-slate-300 border border-slate-600 px-2 py-0.5 rounded font-mono font-semibold">
            Universal Importer
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Import cell site data, coverage records, and drive-test files (.csv, .json, .geojson, .ntm).
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">

        {/* 0. Live District Extractor Banner */}
        <div className="bg-gradient-to-r from-indigo-950/60 to-purple-950/60 p-3 rounded-lg border border-indigo-700/60 space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Radio size={14} className="text-indigo-400" />
              Tarang Sanchar Live Extractor
            </span>
            <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded font-semibold">
              District-Wise Fast Fetch
            </span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Use the included browser extension on <strong className="text-white">tarangsanchar.gov.in</strong> to automatically fetch pure tower locations by district (e.g. Villupuram, Chennai, Coimbatore, Bengaluru, Mumbai) and click <strong>🚀 Push to App</strong> to load them immediately into this GIS view.
          </p>
        </div>

        {/* 1. Universal Import Card */}
        <div className="space-y-3 bg-slate-800 p-3.5 rounded-lg border border-slate-700">
          <div className="flex items-center justify-between border-b border-slate-700 pb-2">
            <h3 className="text-xs font-bold text-white uppercase tracking-wide flex items-center gap-1.5">
              <FileText size={14} className="text-indigo-400" />
              Upload Cell Site or Drive-Test File
            </h3>
            <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
              <span className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">.CSV</span>
              <span className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">.JSON</span>
              <span className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 text-amber-300">.NTM</span>
              <span className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">.GEOJSON</span>
            </div>
          </div>

          {/* Baseline Snapping Option */}
          <div className="bg-slate-850 p-2.5 rounded-lg border border-slate-700/80 text-xs">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={snapToBaseline}
                onChange={(e) => setSnapToBaseline(e.target.checked)}
                className="accent-indigo-500 mt-0.5 rounded cursor-pointer"
              />
              <span className="text-[11px] text-slate-300 leading-snug">
                <strong className="text-white block">Snap field audits to 100% TarangSanchar Baseline:</strong>
                Keeps official DoT macro tower coordinates as 100% exact truth while extracting cell identity (CID), PCI/PSC, LAC/TAC, and carrier spectrum.
              </span>
            </label>
          </div>

          {/* Drag & Drop Box */}
          <div
            className={`border-2 border-dashed rounded-lg p-5 text-center transition-colors cursor-pointer ${
              file ? 'border-indigo-500 bg-indigo-900/20' : 'border-slate-600 hover:border-slate-500 bg-slate-700/30'
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".csv,.json,.geojson,.ntm"
              onChange={handleFileSelect}
            />
            {file ? (
              <div className="flex flex-col items-center gap-1.5">
                <FileText size={28} className="text-indigo-400" />
                <span className="font-semibold text-xs text-indigo-200">{file.name}</span>
                <span className="text-[10px] text-slate-400">{(file.size / 1024).toFixed(1)} KB</span>
                <span
                  className="text-[11px] text-indigo-400 mt-1 hover:underline"
                  onClick={(e) => { e.stopPropagation(); setFile(null); }}
                >
                  Change File
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5 text-slate-400 text-xs">
                <Upload size={24} />
                <span>Click or drag telecom dataset file to upload</span>
                <span className="text-[10px] text-slate-500">
                  Accepts CSV, GeoJSON, generic JSON, or native .NTM drive-test logs
                </span>
              </div>
            )}
          </div>

          <button
            onClick={handleUpload}
            disabled={!file || status === 'uploading'}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-2.5 rounded-lg text-xs font-bold transition-all shadow-lg shadow-indigo-900/40 flex items-center justify-center gap-2"
          >
            <Upload size={14} />
            {status === 'uploading'
              ? 'Parsing, Resolving Frequencies & Snapping…'
              : 'Process & Import Dataset'}
          </button>

          {/* Success Summary */}
          {status === 'success' && (
            <div className="bg-emerald-950/60 border border-emerald-800 text-emerald-300 p-3 rounded-lg text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-emerald-200">
                <CheckCircle size={15} className="text-emerald-400 shrink-0" />
                <span>{message}</span>
              </div>

              {stats && (stats.snapped_to_baseline !== undefined || stats.operators) && (
                <div className="space-y-2 pt-2 border-t border-emerald-900/60">
                  <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-900/80 p-2.5 rounded border border-emerald-900/40">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Baseline Snapped</span>
                      <strong className="text-emerald-400 font-mono text-xs">
                        🛡️ {stats.snapped_to_baseline ?? 0} Sites (DoT match)
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">New Field Sites</span>
                      <strong className="text-indigo-300 font-mono text-xs">
                        📡 {stats.new_field_sites ?? 0} Sites
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Total Localized Cells</span>
                      <strong className="text-white font-mono text-xs">
                        {stats.valid_cells ?? stats.imported} cells
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Carrier Spectrum</span>
                      <strong className="text-amber-300 font-mono text-xs">
                        {stats.bands?.length ?? 0} Bands Configured
                      </strong>
                    </div>
                  </div>

                  {stats.operators && Object.keys(stats.operators).length > 0 && (
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
                        Operators Identified:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(stats.operators).map(([op, cnt]) => (
                          <span key={op} className="text-[10px] bg-slate-800 border border-slate-700 px-2 py-0.5 rounded font-mono text-slate-200">
                            {op}: <strong className="text-indigo-300">{cnt} cells</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {stats.bands && stats.bands.length > 0 && (
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
                        Frequencies & Technologies:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {stats.bands.map(b => (
                          <span key={b} className="text-[9px] bg-slate-800/90 border border-slate-700 px-1.5 py-0.2 rounded font-mono text-slate-300">
                            {b}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {status === 'error' && (
            <div className="bg-red-900/40 border border-red-800 text-red-300 p-2.5 rounded text-xs flex items-start gap-2">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{message}</span>
            </div>
          )}
        </div>

        {/* 2. Download / Export with Scope Selection */}
        <div className="space-y-3 bg-slate-800 p-3.5 rounded-lg border border-slate-700">
          <h3 className="text-xs font-bold text-white uppercase tracking-wide border-b border-slate-700 pb-2">
            Download & Export Data
          </h3>
          <p className="text-xs text-slate-400">
            Export your network dataset in standard CSV or GeoJSON formats.
          </p>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1.5">Export Scope</label>
            <div className="space-y-1.5 text-xs">
              <label className={`flex items-center gap-2 p-2 rounded border cursor-pointer ${
                exportScope === 'user_test' ? 'bg-indigo-900/30 border-indigo-500 text-white' : 'bg-slate-700/40 border-slate-700 text-slate-300'
              }`}>
                <input
                  type="radio"
                  name="scope"
                  checked={exportScope === 'user_test'}
                  onChange={() => setExportScope('user_test')}
                  className="accent-indigo-500"
                />
                <FlaskConical size={14} className="text-amber-400" />
                <div>
                  <strong className="block">My Test & Planned Towers Only</strong>
                  <span className="text-[10px] text-slate-400">Contains user-configured, planned, or edited test cells.</span>
                </div>
              </label>

              <label className={`flex items-center gap-2 p-2 rounded border cursor-pointer ${
                exportScope === 'all' ? 'bg-indigo-900/30 border-indigo-500 text-white' : 'bg-slate-700/40 border-slate-700 text-slate-300'
              }`}>
                <input
                  type="radio"
                  name="scope"
                  checked={exportScope === 'all'}
                  onChange={() => setExportScope('all')}
                  className="accent-indigo-500"
                />
                <Download size={14} className="text-indigo-400" />
                <div>
                  <strong className="block">Complete Merged Dataset</strong>
                  <span className="text-[10px] text-slate-400">Contains all real baseline, field audits, and test towers.</span>
                </div>
              </label>

              <label className={`flex items-center gap-2 p-2 rounded border cursor-pointer ${
                exportScope === 'real' ? 'bg-indigo-900/30 border-indigo-500 text-white' : 'bg-slate-700/40 border-slate-700 text-slate-300'
              }`}>
                <input
                  type="radio"
                  name="scope"
                  checked={exportScope === 'real'}
                  onChange={() => setExportScope('real')}
                  className="accent-indigo-500"
                />
                <ShieldCheck size={14} className="text-emerald-400" />
                <div>
                  <strong className="block">Real Baseline Infrastructure Only</strong>
                  <span className="text-[10px] text-slate-400">Official TarangSanchar DoT baseline macro towers only.</span>
                </div>
              </label>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => downloadExport('csv', exportScope)}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-slate-600"
            >
              <Download size={13} /> Export CSV
            </button>
            <button
              onClick={() => downloadExport('json', exportScope)}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-slate-600"
            >
              <Download size={13} /> Export JSON
            </button>
          </div>
        </div>

        {/* 3. Bulk Deletion & Dataset Reset */}
        <div className="space-y-3 bg-red-950/20 p-3.5 rounded-lg border border-red-900/40">
          <h3 className="text-xs font-bold text-red-300 uppercase tracking-wide border-b border-red-900/40 pb-2 flex items-center gap-1.5">
            <Trash2 size={13} className="text-red-400" /> Bulk Operations & Dataset Reset
          </h3>
          <p className="text-xs text-slate-400">
            Clear records without having to delete them one by one.
          </p>

          <div className="space-y-2">
            <button
              onClick={handleClearTestOnly}
              disabled={deleting}
              className="w-full bg-amber-600/30 hover:bg-amber-600/50 border border-amber-600/50 text-amber-200 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
            >
              <FlaskConical size={13} /> Clear My Test & Planned Towers (Keep Real Data)
            </button>

            <button
              onClick={handleClearAll}
              disabled={deleting}
              className="w-full bg-red-600/30 hover:bg-red-600/50 border border-red-600/50 text-red-200 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
            >
              <Trash2 size={13} /> Clear All Towers (Complete Database Wipe)
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
