import { useState, useEffect } from 'react';
import { Tower, TowerCreate } from '../types';
import { Save, Crosshair } from 'lucide-react';

interface TowerConfigPanelProps {
  onSave: (data: TowerCreate) => Promise<void>;
  clickLocation: { lat: number, lng: number } | null;
  editingTower?: Tower | null;
}

const FREQUENCIES = [700, 850, 900, 1800, 2100, 2300, 2500, 3500];
const OPERATORS = ['Airtel', 'Jio', 'Vi', 'BSNL', 'Other'];

export default function TowerConfigPanel({ onSave, clickLocation, editingTower }: TowerConfigPanelProps) {
  const [formData, setFormData] = useState<TowerCreate>({
    name: '',
    lat: 11.9401,
    lng: 79.4861,
    freq_mhz: 1800,
    height_m: 30,
    power_dbm: 43, // 20W
    operator: 'Airtel',
    technology: '4G',
    bandwidth_mhz: 20,
    tower_type: 'Rooftop',
    azimuth_deg: null,
    source: 'manual',
    cell_id: '',
    site_id: '',
  });

  const [isOmni, setIsOmni] = useState(true);
  const [loading, setLoading] = useState(false);

  // If editing an existing tower
  useEffect(() => {
    if (editingTower) {
      setFormData({
        name: editingTower.name,
        lat: editingTower.lat,
        lng: editingTower.lng,
        freq_mhz: editingTower.freq_mhz,
        height_m: editingTower.height_m,
        power_dbm: editingTower.power_dbm,
        operator: editingTower.operator || 'Airtel',
        technology: editingTower.technology || '4G',
        bandwidth_mhz: editingTower.bandwidth_mhz || 20,
        tower_type: editingTower.tower_type || 'Rooftop',
        azimuth_deg: editingTower.azimuth_deg,
        source: editingTower.source || 'manual',
        cell_id: editingTower.cell_id || '',
        site_id: editingTower.site_id || '',
      });
      setIsOmni(editingTower.azimuth_deg === null || editingTower.azimuth_deg === undefined);
    }
  }, [editingTower]);

  // Update location when map is clicked
  useEffect(() => {
    if (clickLocation) {
      setFormData(prev => ({ ...prev, lat: clickLocation.lat, lng: clickLocation.lng }));
    }
  }, [clickLocation]);

  // Auto-suggest technology & bandwidth based on frequency
  useEffect(() => {
    let tech = '4G';
    let bw = 20;

    if (formData.freq_mhz === 700) {
      tech = '5G';
      bw = 10;
    } else if (formData.freq_mhz === 900) {
      tech = '2G/4G';
      bw = 10;
    } else if (formData.freq_mhz === 1800 || formData.freq_mhz === 2100) {
      tech = '4G';
      bw = 20;
    } else if (formData.freq_mhz === 2300) {
      tech = '4G';
      bw = 40;
    } else if (formData.freq_mhz === 3500) {
      tech = '5G';
      bw = 100;
    }

    setFormData(prev => ({ ...prev, technology: tech, bandwidth_mhz: bw }));
  }, [formData.freq_mhz]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const dataToSave: TowerCreate = {
        ...formData,
        azimuth_deg: isOmni ? null : (formData.azimuth_deg ?? 0),
      };
      await onSave(dataToSave);
      // Reset name for next creation
      setFormData(prev => ({ ...prev, name: '', cell_id: '', site_id: '' }));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const dbmToWatts = (dbm: number) => {
    return (Math.pow(10, dbm / 10) / 1000).toFixed(1);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-1 h-full overflow-y-auto">
      <div className="space-y-1">
        <label className="text-xs font-semibold text-slate-400 uppercase">Tower / Site Name</label>
        <input 
          type="text" 
          required
          className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm focus:border-blue-500 outline-none text-slate-200"
          placeholder="e.g. Radhapuram Rooftop Site"
          value={formData.name}
          onChange={e => setFormData({...formData, name: e.target.value})}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-400 uppercase">Operator</label>
          <select 
            className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm outline-none text-slate-200"
            value={formData.operator || 'Airtel'}
            onChange={e => setFormData({...formData, operator: e.target.value})}
          >
            {OPERATORS.map(op => <option key={op} value={op}>{op}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-400 uppercase">Tower Type</label>
          <select 
            className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm outline-none text-slate-200"
            value={formData.tower_type || 'Rooftop'}
            onChange={e => setFormData({...formData, tower_type: e.target.value})}
          >
            <option value="Rooftop">Rooftop</option>
            <option value="Ground">Ground</option>
            <option value="Wall-mount">Wall-mount</option>
          </select>
        </div>
      </div>

      <div className="p-3 bg-slate-800/50 border border-slate-700 rounded-lg space-y-2">
        <div className="flex justify-between items-center text-xs font-semibold text-slate-400 uppercase">
          <span>Coordinates</span>
          <span className="flex items-center gap-1 text-blue-400"><Crosshair size={12}/> Click map to relocate</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>Lat: <span className="text-slate-200 font-mono">{formData.lat.toFixed(5)}</span></div>
          <div>Lng: <span className="text-slate-200 font-mono">{formData.lng.toFixed(5)}</span></div>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-400 uppercase flex justify-between">
          <span>Frequency Band</span>
          <span className="text-blue-400 font-semibold">{formData.freq_mhz} MHz ({formData.technology})</span>
        </label>
        <div className="flex flex-wrap gap-1.5">
          {FREQUENCIES.map(f => (
            <button
              type="button"
              key={f}
              onClick={() => setFormData({...formData, freq_mhz: f})}
              className={`px-2.5 py-1 text-xs rounded border transition-colors ${formData.freq_mhz === f ? 'bg-blue-600 border-blue-500 text-white font-semibold' : 'bg-slate-800 border-slate-700 hover:border-slate-500 text-slate-300'}`}
            >
              {f}M
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between">
          <label className="text-xs font-semibold text-slate-400 uppercase">Tower Height</label>
          <span className="text-sm font-mono text-blue-400 font-bold">{formData.height_m} meters</span>
        </div>
        <input 
          type="range" min="5" max="100" step="1"
          className="w-full accent-blue-500" 
          value={formData.height_m}
          onChange={e => setFormData({...formData, height_m: Number(e.target.value)})}
        />
      </div>

      <div className="space-y-1">
        <div className="flex justify-between">
          <label className="text-xs font-semibold text-slate-400 uppercase">Transmit Power</label>
          <span className="text-sm font-mono text-blue-400 font-bold">{formData.power_dbm} dBm ({dbmToWatts(formData.power_dbm)} W)</span>
        </div>
        <input 
          type="range" min="20" max="60" step="1"
          className="w-full accent-blue-500" 
          value={formData.power_dbm}
          onChange={e => setFormData({...formData, power_dbm: Number(e.target.value)})}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label className="text-xs font-semibold text-slate-400 uppercase">Azimuth (°)</label>
            <label className="flex items-center gap-1 text-xs cursor-pointer text-slate-400">
              <input 
                type="checkbox" 
                checked={isOmni} 
                onChange={e => setIsOmni(e.target.checked)} 
                className="accent-blue-500" 
              />
              Omni
            </label>
          </div>
          <input 
            type="number" 
            min="0"
            max="360"
            disabled={isOmni}
            placeholder="Omni pattern"
            className={`w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm outline-none text-slate-200 ${isOmni ? 'opacity-40 cursor-not-allowed' : 'focus:border-blue-500'}`}
            value={isOmni ? '' : (formData.azimuth_deg ?? 0)}
            onChange={e => setFormData({...formData, azimuth_deg: Number(e.target.value)})}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-400 uppercase">Channel BW</label>
          <div className="p-2 bg-slate-800 border border-slate-700 rounded text-sm text-slate-300 font-mono">
            {formData.bandwidth_mhz} MHz
          </div>
        </div>
      </div>

      <button 
        type="submit" 
        disabled={loading || !formData.name}
        className="mt-2 w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded font-medium flex items-center justify-center gap-2 transition-colors shadow-lg shadow-blue-900/20"
      >
        <Save size={18} />
        {loading ? 'Saving Tower...' : (editingTower ? 'Update Tower' : 'Save Tower Configuration')}
      </button>
    </form>
  );
}
