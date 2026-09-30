import { useState, useEffect } from 'react';
import { MapView } from './components/MapView';
import { RFPlanningPanel } from './components/RFPlanningPanel';
import { SimulationPanel } from './components/SimulationPanel';
import { ImportPanel } from './components/ImportPanel';
import { ComparePanel } from './components/ComparePanel';
import { towerAPI } from './services/api';
import { Tower, SimulateResponse, SimulateMultiResponse } from './types';
import {
  Compass, Activity, BarChart, Upload, Radio,
  Map as MapIcon, SlidersHorizontal, ChevronDown, Sparkles
} from 'lucide-react';

const TABS = [
  { id: 'rf-planning', icon: Compass,  label: 'RF Planning',   shortLabel: 'Planning' },
  { id: 'simulate',    icon: Activity, label: 'Simulation',    shortLabel: 'Simulate' },
  { id: 'compare',     icon: BarChart, label: 'ISP Rank',      shortLabel: 'Compare'  },
  { id: 'import',      icon: Upload,   label: 'Import/Export', shortLabel: 'Import'   },
] as const;
type TabId = typeof TABS[number]['id'];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('rf-planning');
  const [towers, setTowers] = useState<Tower[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [simSiteTowers, setSimSiteTowers] = useState<Tower[] | null>(null);
  const [simulationResult, setSimulationResult] = useState<SimulateResponse | null>(null);
  const [simulationResults, setSimulationResults] = useState<SimulateResponse[] | null>(null);
  const [multiSimData, setMultiSimData] = useState<SimulateMultiResponse | null>(null);
  const [multiQueueSites, setMultiQueueSites] = useState<Tower[][]>([]);
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
    // Ensure sidebar is visible on both mobile and desktop when a site is clicked
    setIsSidebarOpen(true);
  };

  const handleAddSiteToMultiSim = (siteTowers: Tower[]) => {
    const siteId = siteTowers[0]?.site_id || siteTowers[0]?.id;
    setMultiQueueSites((prev) => {
      if (prev.some((group) => (group[0]?.site_id || group[0]?.id) === siteId)) {
        return prev;
      }
      return [...prev, siteTowers];
    });
    setActiveTab('simulate');
    setSimPanelMode('simulate');
    setIsSidebarOpen(true);
  };

  const handleLocateUser = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setSelectedLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        (err) => console.warn('Geolocation failed:', err)
      );
    }
  };

  const activeTabMeta = TABS.find((t) => t.id === activeTab) || TABS[0];

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-slate-900 overflow-hidden font-sans text-slate-100 select-none">

      {/* ── Mobile Top Header (Visible only on < md) ────────────────────── */}
      <header className="h-14 bg-slate-950/95 backdrop-blur border-b border-slate-800 px-3.5 flex md:hidden items-center justify-between z-40 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
            <Radio size={18} />
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-white tracking-tight flex items-center gap-1.5">
              NexusRF <span className="text-[10px] font-normal text-indigo-400 bg-indigo-950/80 px-1.5 py-0.2 rounded border border-indigo-800">Twin</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-mono">
              {towers.length.toLocaleString()} Base Stations
            </p>
          </div>
        </div>

        {/* Mobile View Toggle Button (Map vs Controls) */}
        <button
          onClick={() => setIsSidebarOpen((prev) => !prev)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all border ${
            isSidebarOpen
              ? 'bg-slate-800 text-indigo-300 border-indigo-500/50 shadow'
              : 'bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-900/50'
          }`}
        >
          {isSidebarOpen ? (
            <>
              <MapIcon size={14} />
              <span>View Map</span>
            </>
          ) : (
            <>
              <SlidersHorizontal size={14} />
              <span>{activeTabMeta.shortLabel}</span>
            </>
          )}
        </button>
      </header>

      {/* ── Desktop Icon Sidebar (Visible only on md+) ─────────────────── */}
      <nav className="w-16 bg-slate-950 hidden md:flex flex-col items-center py-4 border-r border-slate-800 z-20 shrink-0">
        <div className="text-indigo-400 mb-8 p-2 rounded-xl bg-indigo-950/50 border border-indigo-800/40" title="NexusRF Digital Twin">
          <Radio size={26} />
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
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50 ring-2 ring-indigo-400/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Icon size={20} />
            </button>
          ))}
        </div>

        <div className="mt-auto text-[10px] text-slate-500 font-mono flex flex-col items-center gap-1">
          <Sparkles size={12} className="text-indigo-400" />
          <span>v2.2</span>
        </div>
      </nav>

      {/* ── Content Side Panel (Desktop & Mobile Drawer) ────────────────── */}
      {isSidebarOpen && (
        <aside
          className={`
            bg-slate-900 border-slate-800 z-30 flex flex-col shadow-2xl transition-all duration-200
            /* Mobile styles: fill between mobile top header and bottom nav dock */
            fixed inset-x-0 top-14 bottom-16 md:relative md:top-auto md:bottom-auto
            /* Desktop styles: sidebar fixed width */
            md:w-96 md:h-full md:border-r md:shrink-0
          `}
        >
          {/* Mobile-only panel mini-bar with dismiss button */}
          <div className="flex md:hidden items-center justify-between px-4 py-2 bg-slate-950/80 border-b border-slate-800">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <activeTabMeta.icon size={14} className="text-indigo-400" />
              {activeTabMeta.label}
            </span>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 px-2 py-1 rounded bg-slate-800 border border-slate-700"
            >
              <ChevronDown size={14} /> Minimize to Map
            </button>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col">
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
                multiQueueSites={multiQueueSites}
                onMultiQueueSitesChange={setMultiQueueSites}
                onSimulationComplete={(res) => {
                  setSimulationResult(res);
                  if (!res) {
                    setSimulationResults(null);
                    setMultiSimData(null);
                  }
                }}
                onMultiSimulationComplete={(results, multiData) => {
                  setSimulationResults(results);
                  setMultiSimData(multiData || null);
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
                onLocateUser={handleLocateUser}
              />
            )}
            {activeTab === 'import' && (
              <ImportPanel
                onImportComplete={fetchTowers}
                onTowersDeleted={fetchTowers}
              />
            )}
          </div>
        </aside>
      )}

      {/* ── Main Map Area ──────────────────────────────────────────────── */}
      <main className="flex-1 relative z-0 min-w-0 min-h-0 h-full">
        <MapView
          towers={towers}
          simulationResult={activeTab === 'simulate' ? simulationResult : null}
          simulationResults={activeTab === 'simulate' ? simulationResults : null}
          multiSimData={activeTab === 'simulate' ? multiSimData : null}
          onLocationSelect={handleMapClick}
          onSiteSelect={handleSiteSelect}
          onAddSiteToMultiSim={handleAddSiteToMultiSim}
          onImportClick={() => {
            setActiveTab('import');
            setIsSidebarOpen(true);
          }}
          onTowersChanged={fetchTowers}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        />

        {/* Floating "Open Panel" button on mobile when panel is minimized */}
        {!isSidebarOpen && (
          <div className="md:hidden absolute bottom-20 right-3 z-20">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-full shadow-2xl flex items-center gap-2 text-xs font-bold border border-indigo-400 transition-all animate-bounce"
            >
              <activeTabMeta.icon size={15} />
              <span>Open {activeTabMeta.shortLabel}</span>
            </button>
          </div>
        )}
      </main>

      {/* ── Mobile Bottom Navigation Dock (Visible only on < md) ────────── */}
      <nav className="h-16 bg-slate-950/95 backdrop-blur border-t border-slate-800 flex md:hidden items-center justify-around z-40 shrink-0 px-1">
        {TABS.map(({ id, icon: Icon, shortLabel }) => {
          const isSelected = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => {
                setActiveTab(id);
                setIsSidebarOpen(true);
              }}
              className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all ${
                isSelected
                  ? 'text-indigo-400 font-bold'
                  : 'text-slate-400 hover:text-slate-200 font-normal'
              }`}
            >
              <div
                className={`p-1.5 rounded-lg transition-all ${
                  isSelected ? 'bg-indigo-600/20 text-indigo-400' : ''
                }`}
              >
                <Icon size={18} />
              </div>
              <span className="text-[10px] tracking-tight mt-0.5">{shortLabel}</span>
            </button>
          );
        })}
      </nav>

    </div>
  );
}
