import React, { useState, useEffect, useRef } from 'react';
import { 
  Volume2, 
  VolumeX, 
  Zap, 
  Compass, 
  Radio, 
  Sliders, 
  BookOpen, 
  Skull, 
  Cpu, 
  AlertOctagon, 
  Activity, 
  Battery, 
  Wifi, 
  Sparkles, 
  Settings,
  HelpCircle,
  ShieldAlert,
  Info
} from 'lucide-react';

// Components
import { SystemBoot } from './components/SystemBoot';
import { RadarGrid } from './components/RadarGrid';
import { LiveEMFDisplay } from './components/LiveEMFDisplay';
import { AnomalyLog } from './components/AnomalyLog';
import { EVPRecorder } from './components/EVPRecorder';
import { TriangulationMap } from './components/TriangulationMap';
import { Diagnostics } from './components/Diagnostics';
import { EntityDatabase } from './components/EntityDatabase';
import { DeviceSpecs } from './components/DeviceSpecs';

// Audio Service
import { audioService } from './utils/audio';

function App() {
  const [isBooted, setIsBooted] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'triangulation' | 'evp' | 'diagnostics' | 'fieldguide'>('dashboard');
  
  // Tracker settings & readings
  const [emfLevel, setEmfLevel] = useState(0.8);
  const [sensitivity, setSensitivity] = useState(10);
  const [ambientTemp, setAmbientTemp] = useState(19.5);
  const [accentColor, setAccentColor] = useState('#10b981'); // Ecto-Green
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);

  // Simulation controls
  const [simulationMode, setSimulationMode] = useState<'auto' | 'manual'>('auto');
  const [manualEMF, setManualEMF] = useState(1.2);
  const [hauntingActive, setHauntingActive] = useState(false);
  const [hauntingTimer, setHauntingTimer] = useState(0);

  // Screen-shake & glitch overlays
  const [isScreenShaking, setIsScreenShaking] = useState(false);
  const [glitchText, setGlitchText] = useState<string | null>(null);

  // Time & Location
  const [systemTime, setSystemTime] = useState('');
  const [gpsCoords, setGpsCoords] = useState('40.7128° N, 74.0060° W');

  const hauntingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Update clock & random GPS drift
  useEffect(() => {
    const clockInterval = setInterval(() => {
      const now = new Date();
      setSystemTime(now.toLocaleTimeString() + '.' + String(Math.floor(now.getMilliseconds() / 100)).padStart(1, '0'));
    }, 100);

    const gpsInterval = setInterval(() => {
      // Very slight coordinates jitter
      const lat = 40.7128 + (Math.random() * 0.0004 - 0.0002);
      const lng = -74.0060 + (Math.random() * 0.0004 - 0.0002);
      setGpsCoords(`${lat.toFixed(5)}° N, ${Math.abs(lng).toFixed(5)}° W`);
    }, 5000);

    return () => {
      clearInterval(clockInterval);
      clearInterval(gpsInterval);
    };
  }, []);

  // EMF Simulation Engine
  useEffect(() => {
    if (!isBooted) return;

    const interval = setInterval(() => {
      if (hauntingActive) {
        // High, violently fluctuating EMF
        const base = 25.0;
        const spike = Math.sin(Date.now() * 0.005) * 12.0 + (Math.random() * 6.0);
        const finalEMF = Math.max(10, base + spike);
        setEmfLevel(finalEMF);
        audioService.setEMFLevel(finalEMF);
        return;
      }

      if (simulationMode === 'manual') {
        // Manual slider control with tiny noise
        const noise = (Math.random() * 0.3 - 0.15) * (sensitivity / 10);
        const finalEMF = Math.max(0.1, manualEMF + noise);
        setEmfLevel(finalEMF);
        audioService.setEMFLevel(finalEMF);
      } else {
        // Auto mode (random ghost walk with occasional spikes)
        setEmfLevel(prev => {
          let next = prev;
          
          // 95% of the time, stay near background level (0.4 to 1.5 mG)
          if (prev < 3.0) {
            // Random walk
            next += (Math.random() * 0.4 - 0.2);
            // Occasional spike chance
            if (Math.random() < 0.03) {
              next = 5.0 + Math.random() * 8.0; // Moderate spike
            }
          } else {
            // Decay back to background level
            next -= (0.3 + Math.random() * 0.5);
            // Occasional double-spike
            if (Math.random() < 0.1) {
              next = 12.0 + Math.random() * 10.0; // High spike
            }
          }

          // Bound limits
          next = Math.max(0.2, Math.min(next, 95));
          audioService.setEMFLevel(next);
          return next;
        });
      }
    }, 300);

    return () => clearInterval(interval);
  }, [isBooted, simulationMode, manualEMF, sensitivity, hauntingActive]);

  // Handle Haunting Outbreak Event
  const triggerHauntingOutbreak = () => {
    if (hauntingActive) return;

    setHauntingActive(true);
    setIsScreenShaking(true);
    audioService.playHauntingScream();
    
    // Drop temperature dramatically
    setAmbientTemp(3.2);

    // Glitchy terminal texts
    const glitchPhrases = [
      "WARNING: SPECTRAL SATURATION HIGH",
      "CRITICAL BREACH: CLASS V DETECTED",
      "GET OUT",
      "HE IS BEHIND YOU",
      "SYSTEM OVERLOAD",
      "RUN"
    ];

    let phraseIndex = 0;
    const phraseInterval = setInterval(() => {
      setGlitchText(glitchPhrases[phraseIndex % glitchPhrases.length]);
      phraseIndex++;
    }, 1500);

    // Stop haunting after 12 seconds
    setTimeout(() => {
      clearInterval(phraseInterval);
      setHauntingActive(false);
      setIsScreenShaking(false);
      setGlitchText(null);
      setAmbientTemp(18.5);
      audioService.playDiagnosticBeep(false); // Play winding down tone
    }, 15000);
  };

  // Sync mute and volume with AudioService
  useEffect(() => {
    audioService.setMute(isMuted);
  }, [isMuted]);

  useEffect(() => {
    audioService.setVolume(volume);
  }, [volume]);

  // Handle Boot Up
  const handleBootComplete = () => {
    setIsBooted(true);
  };

  if (!isBooted) {
    return <SystemBoot onBootComplete={handleBootComplete} accentColor={accentColor} />;
  }

  return (
    <div className={`min-h-screen bg-black text-slate-300 font-mono flex flex-col overflow-x-hidden relative select-none ${isScreenShaking ? 'animate-[shake_0.5s_infinite]' : ''}`}>
      {/* Cinematic CRT Scanline Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] pointer-events-none z-50"></div>
      
      {/* Ghostly background glow */}
      <div 
        className="absolute inset-0 opacity-10 pointer-events-none z-0 transition-all duration-1000"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 30%, ${hauntingActive ? '#ef4444' : accentColor}55 0%, transparent 70%)`
        }}
      ></div>

      {/* HAUNTING OUTBREAK GLITCH OVERLAY */}
      {hauntingActive && (
        <div className="fixed inset-0 z-40 bg-red-950/20 border-4 border-red-500 pointer-events-none animate-pulse flex flex-col items-center justify-center">
          <div className="bg-black/90 border border-red-500 p-6 rounded max-w-md text-center space-y-4 shadow-[0_0_50px_rgba(239,68,68,0.5)]">
            <AlertOctagon className="w-16 h-16 text-red-500 animate-bounce mx-auto" />
            <h2 className="text-xl font-extrabold text-red-500 tracking-[0.2em] uppercase">SPECTRAL OUTBREAK</h2>
            <p className="text-[11px] text-red-400 font-bold tracking-widest uppercase animate-pulse">
              {glitchText || "CRITICAL ENTITY DETECTED"}
            </p>
            <div className="text-[9px] text-slate-500">
              MAGNETOMETER LOAD: <span className="text-red-500 font-bold">{emfLevel.toFixed(2)} mG</span>
            </div>
          </div>
        </div>
      )}

      {/* TOP HEADER STATUS BAR */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md p-4 relative z-30 flex items-center justify-between">
        {/* Left branding */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <span 
              className="font-black text-lg md:text-xl tracking-[0.2em] text-white flex items-center gap-1.5"
            >
              <span style={{ color: hauntingActive ? '#ef4444' : accentColor }} className="animate-pulse">▲</span>
              AETHER <span className="text-slate-500 font-light text-base">V9</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-2 border-l border-zinc-800 pl-3 text-[10px] text-slate-500">
            <span>LOC: [{gpsCoords}]</span>
          </div>
        </div>

        {/* Center Clock / Status */}
        <div className="text-center font-mono hidden sm:block">
          <div className="text-[8px] text-slate-500 uppercase tracking-widest">SYSTEM_CHRONO_LOCK</div>
          <div className="text-xs text-white font-bold tracking-widest tabular-nums">{systemTime}</div>
        </div>

        {/* Right Controls (Mute, Volume, Battery, Signal) */}
        <div className="flex items-center gap-4">
          {/* Volume Slider & Mute */}
          <div className="flex items-center gap-2 border-r border-zinc-800 pr-3.5">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              disabled={isMuted}
              className="w-16 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white disabled:opacity-30"
            />
          </div>

          {/* Quick HUD Metrics */}
          <div className="flex items-center gap-3 text-[10px] text-slate-500">
            <div className="flex items-center gap-1">
              <Wifi className="w-3.5 h-3.5 text-emerald-500" />
              <span className="hidden xs:inline">SAT_LINK</span>
            </div>
            <div className="flex items-center gap-1">
              <Battery className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
              <span className="hidden xs:inline">98%</span>
            </div>
          </div>
        </div>
      </header>

      {/* NAVIGATION TABS */}
      <nav className="border-b border-zinc-900 bg-zinc-950/40 relative z-30 flex overflow-x-auto scrollbar-none">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: <Zap className="w-4 h-4" /> },
          { id: 'triangulation', label: 'Triangulation Node', icon: <Compass className="w-4 h-4" /> },
          { id: 'evp', label: 'EVP Recorder', icon: <Radio className="w-4 h-4" /> },
          { id: 'fieldguide', label: 'Field Guide', icon: <BookOpen className="w-4 h-4" /> },
          { id: 'diagnostics', label: 'Diagnostics / Specs', icon: <Sliders className="w-4 h-4" /> }
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                audioService.playDiagnosticBeep(true);
              }}
              className={`flex-1 py-3 px-4 border-b-2 font-bold tracking-widest text-[10px] md:text-xs uppercase flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                isActive 
                  ? 'text-white border-white bg-zinc-900/40' 
                  : 'text-slate-500 border-transparent hover:text-slate-300 hover:bg-zinc-900/10'
              }`}
              style={{
                borderBottomColor: isActive ? accentColor : 'transparent'
              }}
            >
              <span style={{ color: isActive ? accentColor : undefined }}>
                {tab.icon}
              </span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 p-4 md:p-6 grid grid-cols-1 xl:grid-cols-4 gap-6 relative z-20">
        
        {/* Left/Middle Column (Dynamic Tab Content) */}
        <div className="xl:col-span-3 space-y-6">
          {activeTab === 'dashboard' && (
            <>
              {/* Live Readings Block */}
              <LiveEMFDisplay 
                emfLevel={emfLevel} 
                sensitivity={sensitivity}
                hauntingActive={hauntingActive}
                accentColor={accentColor}
              />
              {/* Radar Grid and Anomaly Logs */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <RadarGrid 
                  emfLevel={emfLevel} 
                  hauntingActive={hauntingActive}
                  accentColor={accentColor}
                />
                <AnomalyLog 
                  emfLevel={emfLevel} 
                  hauntingActive={hauntingActive}
                  accentColor={accentColor}
                />
              </div>
            </>
          )}

          {activeTab === 'triangulation' && (
            <TriangulationMap 
              emfLevel={emfLevel} 
              hauntingActive={hauntingActive}
              accentColor={accentColor}
            />
          )}

          {activeTab === 'evp' && (
            <EVPRecorder accentColor={accentColor} />
          )}

          {activeTab === 'fieldguide' && (
            <EntityDatabase accentColor={accentColor} />
          )}

          {activeTab === 'diagnostics' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Diagnostics 
                sensitivity={sensitivity}
                setSensitivity={setSensitivity}
                ambientTemp={ambientTemp}
                setAmbientTemp={setAmbientTemp}
                accentColor={accentColor}
              />
              <DeviceSpecs 
                accentColor={accentColor}
                setAccentColor={setAccentColor}
              />
            </div>
          )}
        </div>

        {/* Right Sidebar (Simulation Controller & Quick Reference) */}
        <div className="xl:col-span-1 space-y-6">
          
          {/* Paranormal Simulator Panel */}
          <div className="border border-zinc-900 bg-zinc-950/80 rounded-lg p-4 shadow-[inset_0_0_15px_rgba(0,0,0,0.6)] font-mono">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-3 mb-4">
              <div className="flex items-center gap-2 text-white font-bold text-xs uppercase">
                <Settings className="w-4 h-4" style={{ color: accentColor }} />
                <span>GHOST_SIMULATOR_CORE</span>
              </div>
              <span className="text-[8px] text-slate-500 uppercase">INJECTOR</span>
            </div>

            <p className="text-[10px] text-slate-400 mb-4 leading-relaxed">
              Use this panel to simulate different paranormal environments or force a localized haunting manifestation.
            </p>

            <div className="space-y-4">
              {/* Simulation Mode Toggle */}
              <div className="flex items-center justify-between border border-zinc-900 bg-zinc-900/20 p-2 rounded">
                <span className="text-[10px] text-slate-500 font-bold uppercase">Simulation Mode</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      setSimulationMode('auto');
                      audioService.playDiagnosticBeep(true);
                    }}
                    className={`text-[8px] font-bold px-2 py-1 rounded border cursor-pointer ${
                      simulationMode === 'auto'
                        ? 'bg-white text-black border-white'
                        : 'bg-zinc-900 text-slate-400 border-zinc-800 hover:text-white'
                    }`}
                  >
                    AUTO
                  </button>
                  <button
                    onClick={() => {
                      setSimulationMode('manual');
                      audioService.playDiagnosticBeep(true);
                    }}
                    className={`text-[8px] font-bold px-2 py-1 rounded border cursor-pointer ${
                      simulationMode === 'manual'
                        ? 'bg-white text-black border-white'
                        : 'bg-zinc-900 text-slate-400 border-zinc-800 hover:text-white'
                    }`}
                  >
                    MANUAL
                  </button>
                </div>
              </div>

              {/* Manual EMF Control */}
              {simulationMode === 'manual' && (
                <div className="space-y-1.5 border border-zinc-900 bg-zinc-900/10 p-2.5 rounded">
                  <div className="flex justify-between text-[9px]">
                    <span className="text-slate-400 uppercase">Inject EMF Signal</span>
                    <span style={{ color: accentColor }} className="font-bold tabular-nums">{manualEMF.toFixed(1)} mG</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="20"
                    step="0.1"
                    value={manualEMF}
                    onChange={(e) => setManualEMF(Number(e.target.value))}
                    className="w-full h-1 bg-zinc-900 rounded-lg appearance-none cursor-pointer"
                    style={{ accentColor: accentColor }}
                  />
                  <div className="flex justify-between text-[8px] text-slate-600">
                    <span>QUIET</span>
                    <span>STRONG SPIKE</span>
                  </div>
                </div>
              )}

              {/* Spectral Outbreak Force Button */}
              <button
                onClick={triggerHauntingOutbreak}
                disabled={hauntingActive}
                className={`w-full py-3.5 rounded border text-[10px] font-black tracking-[0.2em] uppercase flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none cursor-pointer ${
                  hauntingActive 
                    ? 'bg-red-950 border-red-500 text-red-500 animate-pulse' 
                    : 'bg-red-600 border-red-500 text-black hover:bg-red-700 hover:border-red-600 shadow-[0_0_15px_rgba(239,68,68,0.3)]'
                }`}
              >
                <Skull className="w-4 h-4 animate-bounce" />
                <span>TRIGGER SPECTRAL OUTBREAK</span>
              </button>
            </div>
          </div>

          {/* Quick Field Reference Guide */}
          <div className="border border-zinc-900 bg-zinc-950/80 rounded-lg p-4 shadow-[inset_0_0_15px_rgba(0,0,0,0.6)] font-mono">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-3 mb-3">
              <div className="flex items-center gap-2 text-white font-bold text-xs uppercase">
                <Info className="w-4 h-4" style={{ color: accentColor }} />
                <span>EMF_REFERENCE_INDEX</span>
              </div>
            </div>

            <div className="space-y-2.5 text-[9px]">
              <div className="flex justify-between items-center border-b border-zinc-900 pb-1.5">
                <span className="text-slate-500">0.0 - 1.5 mG</span>
                <span className="text-emerald-500 font-bold uppercase">Background Noise</span>
              </div>
              <div className="flex justify-between items-center border-b border-zinc-900 pb-1.5">
                <span className="text-slate-500">2.5 - 5.0 mG</span>
                <span className="text-yellow-500 font-bold uppercase">Minor Anomaly</span>
              </div>
              <div className="flex justify-between items-center border-b border-zinc-900 pb-1.5">
                <span className="text-slate-500">5.0 - 10.0 mG</span>
                <span className="text-amber-500 font-bold uppercase">Moderate Energy</span>
              </div>
              <div className="flex justify-between items-center border-b border-zinc-900 pb-1.5">
                <span className="text-slate-500">10.0 - 20.0 mG</span>
                <span className="text-red-500 font-bold uppercase">Severe Manifestation</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">20.0+ mG</span>
                <span className="text-purple-500 font-black uppercase animate-pulse">Spectral Outbreak</span>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-zinc-900 bg-zinc-950/80 p-4 text-center text-[10px] text-slate-600 font-mono relative z-30 flex flex-col md:flex-row justify-between items-center gap-2">
        <div>
          <span>AETHER TECHNICAL CORPORATION © {new Date().getFullYear()} // ALL RIGHTS RESERVED</span>
        </div>
        <div className="flex items-center gap-4">
          <span>FIRMWARE: SPECTRAL_OS_v4.09</span>
          <span>CALIBRATION: STABLE</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
