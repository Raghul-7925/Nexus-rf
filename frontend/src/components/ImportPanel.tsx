import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Download, Trash2, ShieldCheck, FlaskConical } from 'lucide-react';
import { importAPI, towerAPI, downloadExport } from '../services/api';

interface ImportPanelProps {
  onImportComplete: () => void;
  onTowersDeleted?: () => void;
}

export const ImportPanel: React.FC<ImportPanelProps> = ({ onImportComplete, onTowersDeleted }) => {
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState('csv');
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [exportScope, setExportScope] = useState<'all' | 'user_test' | 'real'>('user_test');
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setStatus('idle');
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setStatus('uploading');
    try {
      const res = await importAPI.importData(file, format);
      setStatus('success');
      setMessage(`Successfully imported ${res.row_count} records. Batch ID: ${res.batch_id}`);
      onImportComplete();
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setMessage(err.response?.data?.detail || 'An error occurred during import.');
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
    if (confirm('Clear only your custom test and planned towers? Real Tarang Sanchar baseline data will be preserved.')) {
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
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Upload size={18} className="text-indigo-400" /> Import & Export
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Manage datasets, scope exports for test towers, and perform bulk operations.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">

        {/* 1. Upload Data */}
        <div className="space-y-3 bg-slate-800 p-3.5 rounded-lg border border-slate-700">
          <h3 className="text-xs font-bold text-white uppercase tracking-wide border-b border-slate-700 pb-2">
            Upload Custom Dataset
          </h3>

          <div>
            <label className="block text-[11px] font-medium mb-1.5 text-slate-300">File Format</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <input type="radio" checked={format === 'csv'} onChange={() => setFormat('csv')} className="accent-indigo-500" />
                <span>CSV</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <input type="radio" checked={format === 'json'} onChange={() => setFormat('json')} className="accent-indigo-500" />
                <span>JSON</span>
              </label>
            </div>
          </div>

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
              accept={format === 'csv' ? '.csv' : '.json'}
              onChange={handleFileSelect}
            />
            {file ? (
              <div className="flex flex-col items-center gap-1.5">
                <FileText size={28} className="text-indigo-400" />
                <span className="font-semibold text-xs text-indigo-200">{file.name}</span>
                <span className="text-[10px] text-slate-400">{(file.size / 1024).toFixed(1)} KB</span>
                <span className="text-[11px] text-indigo-400 mt-1 hover:underline" onClick={(e) => { e.stopPropagation(); setFile(null); }}>Remove</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5 text-slate-400 text-xs">
                <Upload size={24} />
                <span>Click or drag file to upload</span>
                <span className="text-[10px] text-slate-500">Supports {format.toUpperCase()}</span>
              </div>
            )}
          </div>

          <button
            onClick={handleUpload}
            disabled={!file || status === 'uploading'}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-2 rounded-lg text-xs font-bold transition-colors"
          >
            {status === 'uploading' ? 'Uploading & Parsing…' : 'Start Bulk Import'}
          </button>

          {status === 'success' && (
            <div className="bg-green-900/40 border border-green-800 text-green-300 p-2.5 rounded text-xs flex items-start gap-2">
              <CheckCircle size={14} className="mt-0.5 shrink-0" />
              <span>{message}</span>
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
            Choose whether to export your custom test & planned towers or the complete dataset.
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
                  <span className="text-[10px] text-slate-400">Contains only user-configured, planned, or edited test cells.</span>
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
                  <span className="text-[10px] text-slate-400">Contains all real baseline and test towers combined.</span>
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
                  <span className="text-[10px] text-slate-400">Contains official Tarang Sanchar data only.</span>
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
