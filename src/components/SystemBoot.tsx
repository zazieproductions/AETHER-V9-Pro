import React, { useState, useEffect } from 'react';
import { Shield, Cpu, Activity, Zap, RefreshCw, Power } from 'lucide-react';
import { audioService } from '../utils/audio';

interface SystemBootProps {
  onBootComplete: () => void;
  accentColor: string;
}

export const SystemBoot: React.FC<SystemBootProps> = ({ onBootComplete, accentColor }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPoweringOn, setIsPoweringOn] = useState(false);
  const [isBooted, setIsBooted] = useState(false);
  const [progress, setProgress] = useState(0);

  const bootSteps = [
    { log: 'INITIALIZING AETHER_OS v4.09...', delay: 200 },
    { log: 'LOADING KERNEL SUBSYSTEMS...', delay: 300 },
    { log: 'CONNECTING HARDWARE INTERFACES...', delay: 250 },
    { log: 'DETECTING INTEGRATED MAGNETOMETER (LIS3MDL)... OK', delay: 400 },
    { log: 'DETECTING GEIGER-MÜLLER COUNTER TUBE (LND-712)... OK', delay: 350 },
    { log: 'CALIBRATING AMBIENT THERMAL SCANNER... OK', delay: 300 },
    { log: 'ESTABLISHING ELECTROMAGNETIC TRIANGULATION LINK... OK', delay: 400 },
    { log: 'TUNING RADIO FREQUENCY RECEIVER (50Hz - 18GHz)... OK', delay: 300 },
    { log: 'ALLOCATING BUFFER FOR EVP REAL-TIME DEMODULATOR... OK', delay: 400 },
    { log: 'RUNNING SPECTRUM ANALYZER SELF-TEST... PASS', delay: 300 },
    { log: 'PARANORMAL SIGNATURE MATCHING DATABASE LOADED (142 ENTITIES)... OK', delay: 300 },
    { log: 'SYSTEM READY. AWAITING OPERATOR IGNITION.', delay: 200 }
  ];

  const handlePowerClick = () => {
    if (isPoweringOn) return;
    setIsPoweringOn(true);
    
    // Initialize audio service on user interaction
    audioService.init();
    audioService.playPowerUp();

    let step = 0;
    const addNextLog = () => {
      if (step < bootSteps.length) {
        setLogs(prev => [...prev, bootSteps[step].log]);
        setProgress(Math.round(((step + 1) / bootSteps.length) * 100));
        setTimeout(() => {
          step++;
          addNextLog();
        }, bootSteps[step].delay);
      } else {
        setIsBooted(true);
        setTimeout(() => {
          onBootComplete();
        }, 1000);
      }
    };

    addNextLog();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-slate-300 font-mono p-4 overflow-hidden relative select-none">
      {/* Cinematic grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] pointer-events-none z-10"></div>
      <div 
        className="absolute inset-0 opacity-15 pointer-events-none z-0"
        style={{
          backgroundImage: `radial-gradient(circle at center, ${accentColor}44 0%, transparent 70%)`
        }}
      ></div>

      {/* Decorative HUD Elements */}
      <div className="absolute top-6 left-6 flex items-center gap-2 text-xs tracking-widest opacity-40">
        <Shield className="w-4 h-4" />
        <span>SECURE INTERFACE LINK</span>
      </div>
      <div className="absolute top-6 right-6 text-xs tracking-widest opacity-40">
        SYS_LOC: [40.7128° N, 74.0060° W]
      </div>
      <div className="absolute bottom-6 left-6 text-xs tracking-widest opacity-40">
        AETHER_TECH_CORP // PROJECT_PHANTOM
      </div>
      <div className="absolute bottom-6 right-6 text-xs tracking-widest opacity-40 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
        <span>REC STANDBY</span>
      </div>

      {/* Main Core Boot UI */}
      <div className="w-full max-w-xl border border-slate-800 bg-zinc-950/80 rounded-lg p-6 md:p-8 backdrop-blur-md relative z-20 shadow-[0_0_50px_rgba(0,0,0,0.8)]">
        {/* Corner brackets */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-slate-700 rounded-tl-sm"></div>
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-slate-700 rounded-tr-sm"></div>
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-slate-700 rounded-bl-sm"></div>
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-slate-700 rounded-br-sm"></div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold tracking-[0.2em] text-white flex items-center justify-center gap-2">
            <span style={{ color: accentColor }} className="animate-pulse">▲</span>
            AETHER <span className="text-slate-400 font-light">V9</span>
          </h1>
          <p className="text-[10px] md:text-xs text-slate-500 tracking-[0.4em] uppercase mt-2">
            Spectral Electromagnetic Tracker Pro
          </p>
        </div>

        {/* Power Button & Progress Area */}
        {!isPoweringOn ? (
          <div className="flex flex-col items-center justify-center py-10">
            <button
              onClick={handlePowerClick}
              className="group relative flex items-center justify-center w-24 h-24 rounded-full border-2 border-slate-800 bg-zinc-900/60 hover:bg-zinc-900 cursor-pointer transition-all duration-300 shadow-[0_0_15px_rgba(0,0,0,0.5)] active:scale-95"
              style={{
                boxShadow: `0 0 20px rgba(0,0,0,0.6), inset 0 0 10px rgba(255,255,255,0.02)`
              }}
            >
              <div 
                className="absolute inset-2 rounded-full border border-dashed border-slate-700 animate-[spin_20s_linear_infinite]"
              ></div>
              <div 
                className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                  boxShadow: `0 0 30px ${accentColor}44, inset 0 0 15px ${accentColor}22`,
                  borderColor: accentColor
                }}
              ></div>
              <Power 
                className="w-10 h-10 text-slate-500 group-hover:text-white transition-colors duration-300 relative z-10"
                style={{
                  filter: `drop-shadow(0 0 4px rgba(0,0,0,0.5))`
                }}
              />
            </button>
            <span className="text-xs text-slate-500 tracking-[0.25em] uppercase mt-6 font-bold animate-pulse group-hover:text-white">
              INITIALIZE SYSTEM IGNITION
            </span>
            <p className="text-[10px] text-slate-600 text-center max-w-xs mt-3">
              WARNING: Extreme electromagnetic fluctuations may cause high frequency audio feedback. Keep volume monitored.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Terminal logs */}
            <div className="h-48 bg-black/95 border border-zinc-900 rounded p-4 overflow-y-auto text-[10px] md:text-xs leading-5 font-mono text-zinc-400 scrollbar-thin scrollbar-thumb-zinc-800">
              {logs.map((log, index) => (
                <div key={index} className="flex items-start gap-2">
                  <span className="text-slate-600">[{new Date().toLocaleTimeString()}]</span>
                  <span className={log.includes('OK') || log.includes('PASS') ? 'text-emerald-500' : 'text-zinc-300'}>
                    {log}
                  </span>
                </div>
              ))}
              {!isBooted && <span className="inline-block w-1.5 h-4 bg-slate-400 animate-pulse ml-1"></span>}
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] tracking-wider text-slate-500 uppercase">
                <span>SYSTEM BOOT SEQUENCE</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden p-[1px] border border-zinc-800">
                <div 
                  className="h-full rounded-full transition-all duration-150 ease-out"
                  style={{ 
                    width: `${progress}%`,
                    backgroundColor: accentColor,
                    boxShadow: `0 0 8px ${accentColor}`
                  }}
                ></div>
              </div>
            </div>

            {/* Status Icons */}
            <div className="grid grid-cols-4 gap-2 text-center pt-2">
              <div className="p-2 border border-zinc-900 bg-zinc-950 rounded flex flex-col items-center gap-1">
                <Cpu className="w-4 h-4 text-slate-600" />
                <span className="text-[8px] text-slate-500 uppercase">PROCESSOR</span>
                <span className="text-[9px] text-emerald-500 font-bold">ONLINE</span>
              </div>
              <div className="p-2 border border-zinc-900 bg-zinc-950 rounded flex flex-col items-center gap-1">
                <Zap className="w-4 h-4 text-slate-600" />
                <span className="text-[8px] text-slate-500 uppercase">EMF SENSOR</span>
                <span className="text-[9px] text-emerald-500 font-bold">ACTIVE</span>
              </div>
              <div className="p-2 border border-zinc-900 bg-zinc-950 rounded flex flex-col items-center gap-1">
                <Activity className="w-4 h-4 text-slate-600" />
                <span className="text-[8px] text-slate-500 uppercase">SPECTRUM</span>
                <span className="text-[9px] text-emerald-500 font-bold">CALIBRATED</span>
              </div>
              <div className="p-2 border border-zinc-900 bg-zinc-950 rounded flex flex-col items-center gap-1">
                <RefreshCw className="w-4 h-4 text-slate-600 animate-spin" style={{ animationDuration: '3s' }} />
                <span className="text-[8px] text-slate-500 uppercase">EVP LINK</span>
                <span className="text-[9px] text-amber-500 font-bold">TUNING</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
