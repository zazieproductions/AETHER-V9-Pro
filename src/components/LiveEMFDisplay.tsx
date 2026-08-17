import React, { useEffect, useRef, useState } from 'react';
import { Activity, ShieldAlert, Zap, Radio, ZapOff } from 'lucide-react';

interface LiveEMFDisplayProps {
  emfLevel: number;
  sensitivity: number;
  hauntingActive: boolean;
  accentColor: string;
}

export const LiveEMFDisplay: React.FC<LiveEMFDisplayProps> = ({
  emfLevel,
  sensitivity,
  hauntingActive,
  accentColor
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [magneticVector, setMagneticVector] = useState({ x: 0, y: 0, z: 0 });
  const [electricField, setElectricField] = useState(0);
  const [rfField, setRfField] = useState(0);
  const [fluctuationRate, setFluctuationRate] = useState(0);

  const prevEMFRef = useRef(0);
  const waveOffsetRef = useRef(0);

  // Simulate electromagnetic vector splits (X, Y, Z components) based on EMF level
  useEffect(() => {
    const interval = setInterval(() => {
      if (emfLevel <= 0.2) {
        setMagneticVector({ x: 0.1, y: 0.1, z: 0.1 });
        setElectricField(0.5);
        setRfField(0.01);
        setFluctuationRate(0);
        return;
      }

      // X, Y, Z components add up quadratically to total magnetic field (with some noise)
      // Total B = sqrt(x^2 + y^2 + z^2)
      const ratioX = 0.3 + Math.random() * 0.4;
      const ratioY = 0.2 + Math.random() * 0.3;
      const ratioZ = Math.sqrt(Math.max(0, 1 - ratioX * ratioX - ratioY * ratioY));

      const x = emfLevel * ratioX;
      const y = emfLevel * ratioY;
      const z = emfLevel * ratioZ;

      setMagneticVector({
        x: Number(x.toFixed(2)),
        y: Number(y.toFixed(2)),
        z: Number(z.toFixed(2))
      });

      // Electric field spikes (V/m) - roughly correlates with EMF spikes
      const eField = emfLevel * (1.2 + Math.random() * 0.8) * sensitivity;
      setElectricField(Number(eField.toFixed(1)));

      // RF bursts (mW/m²) - highly volatile
      const rf = hauntingActive 
        ? (20 + Math.random() * 80) * sensitivity 
        : emfLevel > 15.0 
          ? (5 + Math.random() * 25) * sensitivity 
          : (0.01 + Math.random() * 1.5);
      setRfField(Number(rf.toFixed(3)));

      // Rate of change (dE/dt)
      const diff = Math.abs(emfLevel - prevEMFRef.current);
      setFluctuationRate(Number(diff.toFixed(2)));
      prevEMFRef.current = emfLevel;
    }, 150);

    return () => clearInterval(interval);
  }, [emfLevel, sensitivity, hauntingActive]);

  // Canvas Oscilloscope/Signal Waveform Visualizer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const render = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw horizontal reference lines
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.moveTo(0, canvas.height / 4);
      ctx.lineTo(canvas.width, canvas.height / 4);
      ctx.moveTo(0, (canvas.height / 4) * 3);
      ctx.lineTo(canvas.width, (canvas.height / 4) * 3);
      ctx.stroke();

      // Draw vertical grid lines
      ctx.beginPath();
      for (let x = 30; x < canvas.width; x += 30) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
      }
      ctx.stroke();

      // Draw spectral wave based on EMF levels
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 2;
      ctx.shadowBlur = 4;
      ctx.shadowColor = accentColor;
      ctx.beginPath();

      waveOffsetRef.current += hauntingActive ? 0.25 : 0.08;
      const amp = Math.min(emfLevel * 1.5, canvas.height / 2.2); // Cap amplitude
      const freq = 0.03 + Math.min(emfLevel * 0.002, 0.1);

      for (let x = 0; x < canvas.width; x++) {
        // Overlay multiple sine waves for a complex "anomalous" signal look
        let y = canvas.height / 2;
        
        // Base carrier wave
        y += Math.sin(x * freq + waveOffsetRef.current) * amp;
        
        // High-frequency noise overlay during spikes
        if (emfLevel > 5.0) {
          y += Math.sin(x * 0.2 + waveOffsetRef.current * 3) * (amp * 0.2);
          y += (Math.random() - 0.5) * (emfLevel * 0.2); // Fuzzy static
        }

        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.shadowBlur = 0; // Reset shadow

      // Draw digital oscilloscope details
      ctx.fillStyle = `${accentColor}99`;
      ctx.font = '8px monospace';
      ctx.fillText(`SWEEP: ${hauntingActive ? 'FAST' : 'AUTO'}`, 6, 12);
      ctx.fillText(`GAIN: x${sensitivity}`, 6, 22);
      ctx.fillText(`TRIG: ${emfLevel > 10 ? 'ACQUIRED' : 'AUTO'}`, 6, 32);

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [emfLevel, sensitivity, hauntingActive, accentColor]);

  // Calculate danger/alert level color
  const getEMFColor = () => {
    if (emfLevel < 2.5) return 'text-emerald-500';
    if (emfLevel < 10.0) return 'text-amber-500';
    return 'text-red-500';
  };

  const getEMFBorder = () => {
    if (emfLevel < 2.5) return 'border-emerald-500/20';
    if (emfLevel < 10.0) return 'border-amber-500/30';
    return 'border-red-500/40 animate-pulse';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Primary EMF Large Gauge/Reading */}
      <div className={`md:col-span-1 border border-zinc-900 bg-zinc-950/80 rounded-lg p-4 flex flex-col justify-between relative overflow-hidden shadow-[inset_0_0_15px_rgba(0,0,0,0.6)] ${getEMFBorder()}`}>
        {/* Glow corner effects matching EMF level */}
        <div className={`absolute top-0 right-0 w-24 h-24 pointer-events-none opacity-20 bg-radial from-transparent to-black`}
             style={{
               backgroundImage: `radial-gradient(circle at top right, ${emfLevel > 10 ? '#ef4444' : emfLevel > 2.5 ? '#f59e0b' : accentColor}44, transparent 70%)`
             }}
        ></div>

        <div className="flex items-center justify-between border-b border-zinc-900 pb-2 mb-3">
          <div className="flex items-center gap-1.5">
            <Zap className="w-4 h-4" style={{ color: accentColor }} />
            <span className="text-xs font-bold tracking-widest text-white uppercase font-mono">EMF_CORE_READING</span>
          </div>
          <span className="text-[9px] font-mono text-slate-500 tracking-wider">MAGNETIC FIELD</span>
        </div>

        {/* Large Counter Display */}
        <div className="text-center py-4 font-mono">
          <div className="text-[10px] text-slate-500 tracking-widest uppercase mb-1">ELECTROMAGNETIC DENSITY</div>
          <div className={`text-5xl md:text-6xl font-bold tracking-tighter ${getEMFColor()} flex items-baseline justify-center gap-1 font-mono tabular-nums drop-shadow-[0_0_10px_rgba(0,0,0,0.5)]`}>
            {emfLevel.toFixed(2)}
            <span className="text-sm text-slate-400 font-light tracking-normal ml-1">mG</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-2 flex items-center justify-center gap-1.5">
            <span className="font-bold">{(emfLevel / 10).toFixed(3)}</span>
            <span className="text-slate-600">µT (MicroTesla)</span>
          </div>
        </div>

        {/* Level Indicator Bar */}
        <div className="space-y-1.5 font-mono">
          <div className="flex justify-between text-[8px] tracking-wider text-slate-500 uppercase">
            <span>Spectral Threshold</span>
            <span className={getEMFColor()}>
              {emfLevel < 2.5 ? 'SAFE / BACKGROUND' : emfLevel < 10.0 ? 'ANOMALOUS ACTIVITY' : 'CRITICAL OUTBREAK'}
            </span>
          </div>
          <div className="h-2 bg-zinc-900 rounded overflow-hidden p-[1px] border border-zinc-800 flex gap-0.5">
            {/* 10 segmented blocks */}
            {Array.from({ length: 15 }).map((_, i) => {
              const segmentThreshold = (i + 1) * 1.5; // Up to 22.5 mG
              const isActive = emfLevel >= segmentThreshold;
              let segmentBg = 'bg-zinc-800';
              if (isActive) {
                if (segmentThreshold < 3.0) segmentBg = 'bg-emerald-500';
                else if (segmentThreshold < 12.0) segmentBg = 'bg-amber-500';
                else segmentBg = 'bg-red-500';
              }
              return (
                <div 
                  key={i} 
                  className={`flex-1 h-full rounded-sm transition-all duration-150 ${segmentBg}`}
                  style={{
                    boxShadow: isActive ? `0 0 4px ${segmentThreshold < 3.0 ? '#10b981' : segmentThreshold < 12.0 ? '#f59e0b' : '#ef4444'}` : 'none'
                  }}
                ></div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Axis Vector Breakdown */}
      <div className="border border-zinc-900 bg-zinc-950/80 rounded-lg p-4 flex flex-col justify-between relative overflow-hidden shadow-[inset_0_0_15px_rgba(0,0,0,0.6)] font-mono">
        <div className="flex items-center justify-between border-b border-zinc-900 pb-2 mb-3">
          <div className="flex items-center gap-1.5">
            <Activity className="w-4 h-4" style={{ color: accentColor }} />
            <span className="text-xs font-bold tracking-widest text-white uppercase">VECTOR_AXIS_SPLIT</span>
          </div>
          <span className="text-[9px] text-slate-500 tracking-wider">TRI-AXIS COMPONENT</span>
        </div>

        {/* X, Y, Z Vector Bars */}
        <div className="space-y-3.5 flex-1 flex flex-col justify-center">
          {/* X Axis */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-slate-400">
              <span className="font-bold text-red-400">X-AXIS (LATERAL)</span>
              <span className="tabular-nums font-semibold">{magneticVector.x} mG</span>
            </div>
            <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-900">
              <div 
                className="h-full bg-red-500 transition-all duration-150 rounded-full" 
                style={{ 
                  width: `${Math.min((magneticVector.x / 15) * 100, 100)}%`,
                  boxShadow: '0 0 6px #ef4444'
                }}
              ></div>
            </div>
          </div>

          {/* Y Axis */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-slate-400">
              <span className="font-bold text-emerald-400">Y-AXIS (LONGITUDINAL)</span>
              <span className="tabular-nums font-semibold">{magneticVector.y} mG</span>
            </div>
            <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-900">
              <div 
                className="h-full bg-emerald-500 transition-all duration-150 rounded-full" 
                style={{ 
                  width: `${Math.min((magneticVector.y / 15) * 100, 100)}%`,
                  boxShadow: `0 0 6px #10b981`
                }}
              ></div>
            </div>
          </div>

          {/* Z Axis */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-slate-400">
              <span className="font-bold text-blue-400">Z-AXIS (VERTICAL)</span>
              <span className="tabular-nums font-semibold">{magneticVector.z} mG</span>
            </div>
            <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-900">
              <div 
                className="h-full bg-blue-500 transition-all duration-150 rounded-full" 
                style={{ 
                  width: `${Math.min((magneticVector.z / 15) * 100, 100)}%`,
                  boxShadow: '0 0 6px #3b82f6'
                }}
              ></div>
            </div>
          </div>
        </div>

        {/* Fluctuation rate dE/dt */}
        <div className="border-t border-zinc-900 pt-2.5 mt-2 flex justify-between items-center text-[9px] text-slate-500">
          <span>FLUCTUATION RATE (dE/dt):</span>
          <span className={`font-bold tabular-nums ${fluctuationRate > 2.0 ? 'text-amber-500 animate-pulse' : 'text-slate-300'}`}>
            {fluctuationRate} mG/s
          </span>
        </div>
      </div>

      {/* Auxiliary Fields: Electric & RF Oscilloscope */}
      <div className="border border-zinc-900 bg-zinc-950/80 rounded-lg p-4 flex flex-col relative overflow-hidden shadow-[inset_0_0_15px_rgba(0,0,0,0.6)] font-mono">
        <div className="flex items-center justify-between border-b border-zinc-900 pb-2 mb-3">
          <div className="flex items-center gap-1.5">
            <Radio className="w-4 h-4" style={{ color: accentColor }} />
            <span className="text-xs font-bold tracking-widest text-white uppercase">SIGNAL_OSCILLOSCOPE</span>
          </div>
          <span className="text-[9px] text-slate-500 tracking-wider">SPECTRAL WAVEFORM</span>
        </div>

        {/* Canvas wave visualizer */}
        <div className="flex-1 bg-black rounded border border-zinc-900 overflow-hidden relative min-h-[100px] mb-3">
          <canvas
            ref={canvasRef}
            width={280}
            height={110}
            className="w-full h-full block"
          />
        </div>

        {/* Secondary readings */}
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div className="bg-zinc-900/40 border border-zinc-900/60 rounded p-1.5 flex flex-col justify-between">
            <span className="text-slate-500 text-[8px] uppercase font-bold">Electric Field</span>
            <div className="flex items-baseline gap-0.5 mt-0.5">
              <span className="text-white font-bold text-sm tabular-nums">{electricField}</span>
              <span className="text-slate-500 text-[8px]">V/m</span>
            </div>
          </div>
          <div className="bg-zinc-900/40 border border-zinc-900/60 rounded p-1.5 flex flex-col justify-between">
            <span className="text-slate-500 text-[8px] uppercase font-bold">Radio Frequency</span>
            <div className="flex items-baseline gap-0.5 mt-0.5">
              <span className="text-white font-bold text-sm tabular-nums">{rfField}</span>
              <span className="text-slate-500 text-[8px]">mW/m²</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
