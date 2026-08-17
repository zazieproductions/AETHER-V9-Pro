import React from 'react';
import { Cpu, Sliders, Shield, Palette } from 'lucide-react';

interface DeviceSpecsProps {
  accentColor: string;
  setAccentColor: (color: string) => void;
}

export const DeviceSpecs: React.FC<DeviceSpecsProps> = ({ accentColor, setAccentColor }) => {
  const colorThemes = [
    { name: 'Ecto-Green', value: '#10b981', label: 'ECTO-GREEN' },
    { name: 'Phantom-Blue', value: '#06b6d4', label: 'PHANTOM-BLUE' },
    { name: 'Poltergeist-Red', value: '#ef4444', label: 'POLTERGEIST-RED' },
    { name: 'Aether-Violet', value: '#a855f7', label: 'AETHER-VIOLET' }
  ];

  return (
    <div className="border border-zinc-900 bg-zinc-950/80 rounded-lg p-4 flex flex-col h-full shadow-[inset_0_0_15px_rgba(0,0,0,0.6)] font-mono">
      {/* HUD Header */}
      <div className="flex items-center justify-between border-b border-zinc-900 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4" style={{ color: accentColor }} />
          <span className="text-xs font-bold tracking-widest text-white uppercase">DEVICE_SPECIFICATIONS</span>
        </div>
        <span className="text-[9px] text-slate-500 tracking-wider">HARDWARE & FIRMWARE</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
        {/* Left Side: Specs List */}
        <div className="space-y-3 text-[10px]">
          <span className="text-[8px] text-slate-500 uppercase tracking-wider block">HARDWARE MATRIX</span>
          <div className="space-y-2 bg-zinc-900/20 border border-zinc-900 rounded p-3">
            <div className="flex justify-between border-b border-zinc-900/50 pb-1">
              <span className="text-slate-500">MODEL</span>
              <span className="text-white font-bold">AETHER-V9 PRO</span>
            </div>
            <div className="flex justify-between border-b border-zinc-900/50 pb-1">
              <span className="text-slate-500">FIRMWARE</span>
              <span className="text-white font-bold">v4.09.2-SPECTRAL</span>
            </div>
            <div className="flex justify-between border-b border-zinc-900/50 pb-1">
              <span className="text-slate-500">MAGNETOMETER</span>
              <span className="text-white">LIS3MDL Tri-axis</span>
            </div>
            <div className="flex justify-between border-b border-zinc-900/50 pb-1">
              <span className="text-slate-500">GEIGER TUBE</span>
              <span className="text-white">LND-712 Core</span>
            </div>
            <div className="flex justify-between pb-1">
              <span className="text-slate-500">SPECTRAL RANGE</span>
              <span className="text-white">0.1 Hz - 18.4 GHz</span>
            </div>
          </div>
        </div>

        {/* Right Side: Theme Selector */}
        <div className="space-y-4">
          <span className="text-[8px] text-slate-500 uppercase tracking-wider block">
            SPECTRAL COLOR INTERFACE
          </span>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            Customize the system overlay color. Different frequencies help contrast the readout against various ambient lighting conditions.
          </p>

          <div className="grid grid-cols-2 gap-2">
            {colorThemes.map((theme) => {
              const isSelected = accentColor === theme.value;
              return (
                <button
                  key={theme.name}
                  onClick={() => setAccentColor(theme.value)}
                  className={`p-2.5 rounded border text-left transition-all cursor-pointer flex items-center gap-2.5 text-[10px] font-bold ${
                    isSelected
                      ? 'bg-zinc-900 text-white'
                      : 'bg-zinc-900/30 text-slate-400 hover:text-white hover:bg-zinc-900'
                  }`}
                  style={{
                    borderColor: isSelected ? theme.value : '#18181b'
                  }}
                >
                  <span 
                    className="w-3.5 h-3.5 rounded-full block border"
                    style={{ 
                      backgroundColor: theme.value,
                      borderColor: isSelected ? '#ffffff' : 'transparent',
                      boxShadow: `0 0 8px ${theme.value}`
                    }}
                  ></span>
                  <span>{theme.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
