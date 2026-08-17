import React from 'react';
import { Sliders, Shield, Zap, RefreshCw, Thermometer, Wind, AlertCircle } from 'lucide-react';
import { audioService } from '../utils/audio';

interface DiagnosticsProps {
  sensitivity: number;
  setSensitivity: (s: number) => void;
  ambientTemp: number;
  setAmbientTemp: (t: number) => void;
  accentColor: string;
}

export const Diagnostics: React.FC<DiagnosticsProps> = ({
  sensitivity,
  setSensitivity,
  ambientTemp,
  setAmbientTemp,
  accentColor
}) => {

  const triggerSelfTest = () => {
    audioService.playDiagnosticBeep(true);
    setTimeout(() => audioService.playDiagnosticBeep(true), 150);
    setTimeout(() => audioService.playDiagnosticBeep(true), 300);
  };

  return (
    <div className="border border-zinc-900 bg-zinc-950/80 rounded-lg p-4 flex flex-col h-full shadow-[inset_0_0_15px_rgba(0,0,0,0.6)] font-mono">
      {/* HUD Header */}
      <div className="flex items-center justify-between border-b border-zinc-900 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4" style={{ color: accentColor }} />
          <span className="text-xs font-bold tracking-widest text-white uppercase">SENSOR_DIAGNOSTICS_CONTROLS</span>
        </div>
        <span className="text-[9px] text-slate-500 tracking-wider">CALIBRATION & HEALTH</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
        {/* Left Side: Calibration Sliders */}
        <div className="space-y-4">
          <span className="text-[10px] tracking-widest text-slate-500 uppercase block">
            HARDWARE_CALIBRATION
          </span>

          {/* Sensitivity Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px]">
              <span className="text-slate-400">SENSOR SENSITIVITY GAIN</span>
              <span style={{ color: accentColor }} className="font-bold">x{sensitivity}</span>
            </div>
            <input
              type="range"
              min="1"
              max="100"
              value={sensitivity}
              onChange={(e) => {
                setSensitivity(Number(e.target.value));
                audioService.playDiagnosticBeep(true);
              }}
              className="w-full h-1.5 bg-zinc-900 rounded-lg appearance-none cursor-pointer accent-white border border-zinc-800"
              style={{
                accentColor: accentColor
              }}
            />
            <div className="flex justify-between text-[8px] text-slate-600">
              <span>1x (LOW RESIDUAL)</span>
              <span>100x (CRITICAL RANGE)</span>
            </div>
          </div>

          {/* Ambient Temp Adjuster */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px]">
              <span className="text-slate-400">AMBIENT BASELINE TEMP</span>
              <span className="text-sky-400 font-bold">{ambientTemp.toFixed(1)} °C</span>
            </div>
            <input
              type="range"
              min="0"
              max="35"
              step="0.1"
              value={ambientTemp}
              onChange={(e) => {
                setAmbientTemp(Number(e.target.value));
              }}
              className="w-full h-1.5 bg-zinc-900 rounded-lg appearance-none cursor-pointer accent-white border border-zinc-800"
              style={{
                accentColor: '#38bdf8'
              }}
            />
            <div className="flex justify-between text-[8px] text-slate-600">
              <span>0°C (FREEZING ATTIC)</span>
              <span>35°C (WARM BASEMENT)</span>
            </div>
          </div>

          {/* Self-Test Trigger button */}
          <button
            onClick={triggerSelfTest}
            className="w-full py-2.5 border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900 text-[10px] font-bold tracking-widest uppercase rounded text-white flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer hover:border-zinc-700"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>RUN SENSOR SELF-TEST</span>
          </button>
        </div>

        {/* Right Side: Sensor Health & Environmental Info */}
        <div className="space-y-4 flex flex-col justify-between">
          <span className="text-[10px] tracking-widest text-slate-500 uppercase block">
            ENVIRONMENT_DIAGNOSTICS
          </span>

          {/* Environmental Grid stats */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Temperature */}
            <div className="bg-zinc-900/20 border border-zinc-900 rounded p-2 flex items-center gap-2.5">
              <Thermometer className="w-5 h-5 text-sky-400 flex-shrink-0" />
              <div>
                <span className="text-[8px] text-slate-500 uppercase block">COLD_SPOT_INDEX</span>
                <span className={`text-xs font-bold ${ambientTemp < 10 ? 'text-sky-400 animate-pulse' : 'text-slate-300'}`}>
                  {ambientTemp < 10 ? 'FREEZING' : 'NOMINAL'}
                </span>
              </div>
            </div>

            {/* Infrasound */}
            <div className="bg-zinc-900/20 border border-zinc-900 rounded p-2 flex items-center gap-2.5">
              <Wind className="w-5 h-5 text-slate-500 flex-shrink-0 animate-pulse" />
              <div>
                <span className="text-[8px] text-slate-500 uppercase block">INFRASOUND</span>
                <span className="text-xs font-bold text-slate-300">17.4 Hz</span>
              </div>
            </div>
          </div>

          {/* Sensor Matrix Health */}
          <div className="border border-zinc-900/60 bg-zinc-900/10 rounded p-2.5 space-y-2">
            <span className="text-[8px] text-slate-500 uppercase block">SENSOR MATRIX HEALTH STATUS</span>
            <div className="space-y-1.5 text-[9px]">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">MAGNETOMETER ARRAY</span>
                <span className="text-emerald-500 font-bold">100% OK</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">GEIGER RADIATION TUBE</span>
                <span className="text-emerald-500 font-bold">ACTIVE // OK</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">RF TRANSCEIVER CORE</span>
                <span className="text-emerald-500 font-bold">TUNED</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">MICRO-BAROMETER DIAPHRAGM</span>
                <span className="text-emerald-500 font-bold">1013.2 hPa</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
