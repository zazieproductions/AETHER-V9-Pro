import React, { useState, useEffect } from 'react';
import { Terminal, AlertTriangle, ShieldCheck, ShieldAlert, Skull, Trash2 } from 'lucide-react';

interface AnomalyLogProps {
  emfLevel: number;
  hauntingActive: boolean;
  accentColor: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  emf: number;
  duration: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  type: string;
  message: string;
}

export const AnomalyLog: React.FC<AnomalyLogProps> = ({ emfLevel, hauntingActive, accentColor }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [hauntProbability, setHauntProbability] = useState(1);
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');

  // Load some initial realistic paranormal logs
  useEffect(() => {
    const initialLogs: LogEntry[] = [
      {
        id: '1',
        timestamp: new Date(Date.now() - 300000).toLocaleTimeString(),
        emf: 1.25,
        duration: '2.5s',
        severity: 'LOW',
        type: 'Minor Flux',
        message: 'Static discharge detected near magnetometer array.'
      },
      {
        id: '2',
        timestamp: new Date(Date.now() - 180000).toLocaleTimeString(),
        emf: 4.82,
        duration: '5.1s',
        severity: 'MEDIUM',
        type: 'Cold Spot Core',
        message: 'Sudden localized temperature drop (ΔT: -4.2°C) combined with minor magnetic spike.'
      },
      {
        id: '3',
        timestamp: new Date(Date.now() - 60000).toLocaleTimeString(),
        emf: 9.11,
        duration: '1.2s',
        severity: 'HIGH',
        type: 'EVP Burst',
        message: 'Acoustic infrasound pulse detected at 17Hz. RF signal modulation triggered.'
      }
    ];
    setLogs(initialLogs);
  }, []);

  // Monitor EMF spikes to dynamically append logs
  useEffect(() => {
    if (emfLevel > 5.0) {
      const isCritical = emfLevel > 15.0;
      const isHigh = emfLevel > 10.0;
      
      const severity = isCritical ? 'CRITICAL' : isHigh ? 'HIGH' : 'MEDIUM';
      const type = isCritical ? 'Spectral Breach' : isHigh ? 'Poltergeist Spike' : 'Anomalous Wave';
      const messages = [
        'Extreme electromagnetic saturation. Magnetometer warning.',
        'Fluctuation rate exceeds safety parameters. Entity manifestation possible.',
        'Coherent magnetic fields detected. Triangulation locking in.',
        'Radio Frequency burst. Demodulator parsing audio waves.',
        'High density magnetic field on Z-Axis. Localized gravity warping.'
      ];
      const message = messages[Math.floor(Math.random() * messages.length)];

      const newLog: LogEntry = {
        id: Math.random().toString(),
        timestamp: new Date().toLocaleTimeString(),
        emf: Number(emfLevel.toFixed(2)),
        duration: `${(1.5 + Math.random() * 4).toFixed(1)}s`,
        severity,
        type,
        message
      };

      setLogs(prev => {
        // Prevent duplicate spam of same severity in short period
        if (prev.length > 0 && prev[0].severity === severity && Math.random() < 0.6) {
          return prev;
        }
        // Limit to 50 logs total
        return [newLog, ...prev].slice(0, 50);
      });
    }
  }, [emfLevel]);

  // Handle simulated Haunting Events
  useEffect(() => {
    if (hauntingActive) {
      const hauntingLog: LogEntry = {
        id: 'HAUNT_' + Date.now(),
        timestamp: new Date().toLocaleTimeString(),
        emf: 22.4,
        duration: 'ACTIVE',
        severity: 'CRITICAL',
        type: 'SPECTRAL BREACH',
        message: 'WARNING: Class V Apparition fully materialized. Extreme bio-magnetic threat. Evacuate area immediately.'
      };
      setLogs(prev => [hauntingLog, ...prev]);
    }
  }, [hauntingActive]);

  // Dynamic calculation of Haunted Probability based on log severity and current EMF
  useEffect(() => {
    let baseProb = 1;
    // Current EMF contribution
    if (emfLevel > 1.5) {
      baseProb += (emfLevel * 2.5);
    }
    // High severity logs contribution
    const highLogsCount = logs.filter(l => l.severity === 'HIGH' || l.severity === 'CRITICAL').length;
    baseProb += (highLogsCount * 6);

    // Caps
    if (hauntingActive) {
      setHauntProbability(99.8);
    } else {
      setHauntProbability(Math.min(Math.max(Math.round(baseProb), 1), 98));
    }
  }, [logs, emfLevel, hauntingActive]);

  const clearLogs = () => {
    setLogs([]);
  };

  const filteredLogs = logs.filter(log => {
    if (filterSeverity === 'ALL') return true;
    return log.severity === filterSeverity;
  });

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return 'bg-red-950 text-red-400 border-red-500 animate-pulse';
      case 'HIGH':
        return 'bg-amber-950 text-amber-400 border-amber-500';
      case 'MEDIUM':
        return 'bg-yellow-950/50 text-yellow-500 border-yellow-600/50';
      default:
        return 'bg-zinc-900 text-slate-400 border-zinc-800';
    }
  };

  return (
    <div className="border border-zinc-900 bg-zinc-950/80 rounded-lg p-4 flex flex-col h-full shadow-[inset_0_0_15px_rgba(0,0,0,0.6)] font-mono">
      {/* HUD Header */}
      <div className="flex items-center justify-between border-b border-zinc-900 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4" style={{ color: accentColor }} />
          <span className="text-xs font-bold tracking-widest text-white uppercase">ANOMALY_LOG_TERMINAL</span>
        </div>
        <button
          onClick={clearLogs}
          className="text-[9px] text-slate-500 hover:text-red-400 transition-colors flex items-center gap-1 uppercase bg-zinc-900/40 px-2 py-1 rounded border border-zinc-900 hover:border-red-900/50 cursor-pointer active:scale-95"
        >
          <Trash2 className="w-3 h-3" /> Clear Terminal
        </button>
      </div>

      {/* Probability Index & Status Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="md:col-span-1 border border-zinc-900 bg-zinc-900/20 rounded p-3 flex flex-col justify-between relative overflow-hidden">
          <div className="text-[9px] text-slate-500 uppercase tracking-wider">HAUNTING_PROBABILITY</div>
          <div className="flex items-baseline gap-1.5 my-1">
            <span 
              className="text-4xl font-bold tracking-tighter tabular-nums"
              style={{ 
                color: hauntProbability > 60 ? '#ef4444' : hauntProbability > 25 ? '#f59e0b' : accentColor,
                textShadow: `0 0 10px ${hauntProbability > 60 ? '#ef4444' : hauntProbability > 25 ? '#f59e0b' : accentColor}33`
              }}
            >
              {hauntProbability}%
            </span>
            <span className="text-[10px] text-slate-500">INDEX</span>
          </div>
          <div className="text-[8px] text-slate-400 uppercase leading-relaxed">
            {hauntProbability > 75 
              ? 'SPECTRAL MATERIALIZATION IMMINENT' 
              : hauntProbability > 35 
                ? 'HIGH DENSITY ANOMALOUS ENERGY FIELD' 
                : 'NORMAL BACKGROUND STATIC'}
          </div>
        </div>

        <div className="md:col-span-2 border border-zinc-900 bg-zinc-900/20 rounded p-3 flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-[9px] text-slate-500 uppercase tracking-wider">THREAT LEVEL ASSESSMENT</div>
            <div className="flex items-center gap-2">
              {hauntProbability > 75 ? (
                <div className="flex items-center gap-1.5 text-red-500 text-xs font-bold uppercase animate-pulse">
                  <Skull className="w-4 h-4" />
                  <span>CLASS V BREED OUTBREAK</span>
                </div>
              ) : hauntProbability > 35 ? (
                <div className="flex items-center gap-1.5 text-amber-500 text-xs font-bold uppercase">
                  <AlertTriangle className="w-4 h-4 animate-bounce" />
                  <span>POTENTIAL PARANORMAL RESIDUAL</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-emerald-500 text-xs font-bold uppercase">
                  <ShieldCheck className="w-4 h-4" />
                  <span>ENVIRONMENT SECURE</span>
                </div>
              )}
            </div>
            <p className="text-[8px] text-slate-500 max-w-sm">
              Tri-axis magnetometer, infrasound micro-barometer, and Geiger radiation core fully synchronized. Monitoring spectral signatures.
            </p>
          </div>

          <div className="hidden sm:flex flex-col items-end text-right">
            <span className="text-[8px] text-slate-600 uppercase">Tracker Uptime</span>
            <span className="text-[10px] text-slate-400 font-bold tabular-nums">00:14:52:09</span>
            <span className="text-[8px] text-slate-600 uppercase mt-1">Buffer State</span>
            <span className="text-[10px] text-emerald-500 font-bold">100% SECURE</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 mb-3 border-b border-zinc-900 pb-2">
        <span className="text-[9px] text-slate-500 uppercase mr-1">Filter Logs:</span>
        {['ALL', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((sev) => (
          <button
            key={sev}
            onClick={() => setFilterSeverity(sev)}
            className={`text-[8px] font-bold tracking-wider px-2 py-0.5 rounded border transition-all cursor-pointer ${
              filterSeverity === sev
                ? 'bg-white text-black border-white'
                : 'bg-zinc-900 text-slate-400 border-zinc-800 hover:text-white hover:border-zinc-700'
            }`}
          >
            {sev}
          </button>
        ))}
      </div>

      {/* Scrolling Log Panel */}
      <div className="flex-1 overflow-y-auto max-h-[320px] space-y-2 pr-1 scrollbar-thin scrollbar-thumb-zinc-900 scrollbar-track-transparent">
        {filteredLogs.length === 0 ? (
          <div className="border border-dashed border-zinc-900 rounded p-8 text-center text-slate-600 text-[10px] uppercase">
            No logged anomalies match current filter criteria.
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div 
              key={log.id} 
              className="border border-zinc-900 bg-zinc-950/60 hover:bg-zinc-950 rounded p-2.5 flex flex-col md:flex-row md:items-start justify-between gap-2.5 transition-colors relative overflow-hidden"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[8px] text-slate-600">[{log.timestamp}]</span>
                  <span className={`text-[9px] px-1.5 py-0.2 rounded border font-bold ${getSeverityBadge(log.severity)}`}>
                    {log.severity}
                  </span>
                  <span className="text-[10px] font-bold text-white">{log.type}</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">{log.message}</p>
              </div>

              <div className="flex items-center md:flex-col md:items-end justify-between md:justify-start gap-2 border-t md:border-t-0 border-zinc-900 pt-1.5 md:pt-0">
                <div className="text-[9px] text-slate-500">
                  EMF: <span className="text-white font-bold tabular-nums">{log.emf} mG</span>
                </div>
                <div className="text-[9px] text-slate-500">
                  SPAN: <span className="text-white font-bold tabular-nums">{log.duration}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
