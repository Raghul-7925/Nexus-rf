import { Tower } from '../types';
import { Trash2, Edit, Radio, MapPin } from 'lucide-react';

interface TowerListProps {
  towers: Tower[];
  onDelete: (id: string) => void;
  onEdit: (tower: Tower) => void;
  onSimulate: (id: string) => void;
  onZoomTo: (lat: number, lng: number) => void;
  selectedId: string | null;
}

const OPERATOR_COLORS: Record<string, string> = {
  'Airtel': 'bg-red-500/20 text-red-400 border-red-500/30',
  'Jio': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'Vi': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  'BSNL': 'bg-green-500/20 text-green-400 border-green-500/30',
};

export default function TowerList({ towers, onDelete, onEdit, onSimulate, onZoomTo, selectedId }: TowerListProps) {
  if (towers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-4 p-6 text-center">
        <Radio size={48} className="opacity-20" />
        <p className="text-sm">No towers configured yet. Click on the map to place a tower, or import data via CSV/JSON.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-1 h-full overflow-y-auto">
      {towers.map(tower => (
        <div 
          key={tower.id} 
          className={`p-3 rounded-lg border transition-colors ${selectedId === tower.id ? 'bg-slate-800 border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.15)]' : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'}`}
        >
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="font-bold text-sm text-slate-200">{tower.name}</h3>
              <div className="text-xs text-slate-400 flex gap-2 mt-1">
                <span>{tower.freq_mhz} MHz</span> • 
                <span>{tower.height_m}m</span> • 
                <span>{tower.technology || 'LTE'}</span>
              </div>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${tower.operator && OPERATOR_COLORS[tower.operator] ? OPERATOR_COLORS[tower.operator] : 'bg-slate-700 text-slate-300 border-slate-600'}`}>
              {tower.operator || 'Custom'}
            </span>
          </div>
          
          <div className="flex gap-2 mt-3 pt-3 border-t border-slate-700/50">
            <button 
              onClick={() => onSimulate(tower.id)}
              className="flex-1 bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white px-2 py-1.5 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1"
            >
              <Radio size={14} /> Simulate
            </button>
            <button 
              onClick={() => onZoomTo(tower.lat, tower.lng)}
              className="p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white rounded transition-colors"
              title="Locate on map"
            >
              <MapPin size={16} />
            </button>
            <button 
              onClick={() => onEdit(tower)}
              className="p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white rounded transition-colors"
              title="Edit"
            >
              <Edit size={16} />
            </button>
            <button 
              onClick={() => {
                if (confirm(`Are you sure you want to delete "${tower.name}"?`)) {
                  onDelete(tower.id);
                }
              }}
              className="p-1.5 text-red-400 hover:bg-red-900/30 hover:text-red-300 rounded transition-colors"
              title="Delete"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
