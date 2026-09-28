import { useState, useEffect } from 'react';
import { MapView } from './components/MapView';
import { RFPlanningPanel } from './components/RFPlanningPanel';
import { SimulationPanel } from './components/SimulationPanel';
import { ImportPanel } from './components/ImportPanel';
import { ComparePanel } from './components/ComparePanel';
import { towerAPI } from './services/api';
import { Tower, SimulateResponse } from './types';
import { Compass, Activity, BarChart, Upload, Radio } from 'lucide-react';

const TABS = [
  { id: 'rf-planning', icon: Compass,  label: 'RF Planning'       },
  { id: 'simulate',    icon: Activity, label: 'Coverage Simulation' },
  { id: 'compare',     icon: BarChart, label: 'Compare Operators'  },
  { id: 'import',      icon: Upload,   label: 'Import / Export'    },
] as const;
type TabId = typeof TABS[number]['id'];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('rf-planning');
  const [towers, setTowers] = useState<Tower[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [simSiteTowers, setSimSiteTowers] = useState<Tower[] | null>(null);
  const [simulationResult, setSimulationResult] = useState<SimulateResponse | null>(null);
  const [simulationResults, setSimulationResults] = useState<SimulateResponse[] | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [simPanelMode, setSimPanelMode] = useState<'simulate' | 'add' | 'edit'>('simulate');

  const fetchTowers = async () => {
    try {
      setTowers(await towerAPI.list());
    } catch (err) {
      console.error('Fetch towers failed:', err);
    }
  };

  useEffect(() => {
    fetchTowers();
  }, []);

  const handleMapClick = (lat: number, lng: number) => {
    setSelectedLocation({ lat, lng });
  };

  const handleSiteSelect = (siteTowers: Tower[], switchToSim = true) => {
    setSimSiteTowers(siteTowers);
    setSelectedLocation({ lat: siteTowers[0].lat, lng: siteTowers[0].lng });
    setActiveTab('simulate');
    setSimPanelMode(switchToSim ? 'simulate' : 'edit');
    // Ensure sidebar is visible when user selects or edits a site
    setIsSidebarOpen(true);
  };

  return (
    <div className="flex h-screen w-full bg-slate-900 overflow-hidden font-sans">

      {/* ── Icon sidebar ───────────────────────────────────────────────── */}
      <div className="w-16 bg-slate-950 flex flex-col items-center py-4 border-r border-slate-800 z-20 shrink-0">
        <div className="text-indigo-500 mb-8" title="NexusRF Digital Twin">
          <Radio size={28} />
        </div>
        <div className="flex flex-col gap-3 w-full px-2">
          {TABS.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              title={label}
              onClick={() => {
                setActiveTab(id);
                setIsSidebarOpen(true);
              }}
              className={`p-3 rounded-xl flex justify-center transition-all ${
                activeTab === id && isSidebarOpen
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Icon size={22} />
            </button>
          ))}
        </div>
      </div>

      {/* ── Collapsible Side Panel (Full-screen toggleable) ─────────────── */}
      {isSidebarOpen && (
        <div className="w-96 bg-slate-900 border-r border-slate-800 z-10 flex flex-col shadow-2xl shrink-0 transition-all duration-200">
          {activeTab === 'rf-planning' && (
            <RFPlanningPanel
              lat={selectedLocation?.lat ?? null}
              lng={selectedLocation?.lng ?? null}
              onPlanDeployed={fetchTowers}
            />
          )}
          {activeTab === 'simulate' && (
            <SimulationPanel
              towers={towers}
              selectedSiteTowers={simSiteTowers}
              lat={selectedLocation?.lat ?? null}
              lng={selectedLocation?.lng ?? null}
              initialMode={simPanelMode}
              onSimulationComplete={(res) => {
                setSimulationResult(res);
                if (!res) setSimulationResults(null);
              }}
              onMultiSimulationComplete={(results) => {
                setSimulationResults(results);
                if (results && results.length > 0) {
                  setSimulationResult(results[0]);
                } else {
                  setSimulationResult(null);
                }
              }}
              onTowersChanged={fetchTowers}
            />
          )}
          {activeTab === 'compare' && (
            <ComparePanel
              lat={selectedLocation?.lat ?? null}
              lng={selectedLocation?.lng ?? null}
            />
          )}
          {activeTab === 'import' && (
            <ImportPanel
              onImportComplete={fetchTowers}
              onTowersDeleted={fetchTowers}
            />
          )}
        </div>
      )}

      {/* ── Map (Expands to full screen when sidebar is collapsed) ───────── */}
      <div className="flex-1 relative z-0 min-w-0 min-h-0">
        <MapView
          towers={towers}
          simulationResult={activeTab === 'simulate' ? simulationResult : null}
          simulationResults={activeTab === 'simulate' ? simulationResults : null}
          onLocationSelect={handleMapClick}
          onSiteSelect={handleSiteSelect}
          onImportClick={() => {
            setActiveTab('import');
            setIsSidebarOpen(true);
          }}
          onTowersChanged={fetchTowers}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        />
      </div>
    </div>
  );
}
