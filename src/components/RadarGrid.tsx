import React, { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, ShieldAlert, Crosshair } from 'lucide-react';

interface RadarGridProps {
  emfLevel: number;
  hauntingActive: boolean;
  accentColor: string;
}

interface RadarBlip {
  id: number;
  x: number; // -1 to 1 relative to center
  y: number; // -1 to 1 relative to center
  intensity: number; // 0 to 1
  size: number;
  speedX: number;
  speedY: number;
  pulseSpeed: number;
  name: string;
  type: string;
  age: number;
}

export const RadarGrid: React.FC<RadarGridProps> = ({ emfLevel, hauntingActive, accentColor }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [blips, setBlips] = useState<RadarBlip[]>([]);
  const [isScanning, setIsScanning] = useState(true);
  const [detectedEntities, setDetectedEntities] = useState<RadarBlip[]>([]);
  const angleRef = useRef(0);
  const blipIdRef = useRef(0);

  // Initialize some random default blips
  useEffect(() => {
    const initialBlips: RadarBlip[] = [
      {
        id: blipIdRef.current++,
        x: 0.3,
        y: -0.4,
        intensity: 0.4,
        size: 5,
        speedX: 0.001,
        speedY: -0.0015,
        pulseSpeed: 1.5,
        name: 'ANOMALY_09',
        type: 'Residual EMF',
        age: 0
      },
      {
        id: blipIdRef.current++,
        x: -0.5,
        y: 0.2,
        intensity: 0.6,
        size: 7,
        speedX: -0.002,
        speedY: 0.001,
        pulseSpeed: 2.5,
        name: 'POLTER_SIG_02',
        type: 'Kinetic Energy',
        age: 0
      }
    ];
    setBlips(initialBlips);
  }, []);

  // Handle Haunting Spikes
  useEffect(() => {
    if (hauntingActive) {
      // Inject multiple high intensity, fast-moving blips
      const scaryBlips: RadarBlip[] = Array.from({ length: 4 }).map((_, i) => ({
        id: blipIdRef.current++,
        x: (Math.random() * 1.2 - 0.6),
        y: (Math.random() * 1.2 - 0.6),
        intensity: 0.8 + Math.random() * 0.2,
        size: 8 + Math.random() * 6,
        speedX: (Math.random() * 0.01 - 0.005),
        speedY: (Math.random() * 0.01 - 0.005),
        pulseSpeed: 4 + Math.random() * 4,
        name: `PHANTOM_SIG_0${i + 1}`,
        type: 'Class V Apparition',
        age: 0
      }));
      setBlips(prev => [...prev, ...scaryBlips]);
    } else {
      // Remove Class V blips over time, keep standard ones
      setBlips(prev => prev.filter(b => b.type !== 'Class V Apparition'));
    }
  }, [hauntingActive]);

  // Handle EMF spikes by creating temporary blips
  useEffect(() => {
    if (emfLevel > 12.0 && !hauntingActive && Math.random() < 0.2) {
      const newBlip: RadarBlip = {
        id: blipIdRef.current++,
        x: (Math.random() * 1.4 - 0.7),
        y: (Math.random() * 1.4 - 0.7),
        intensity: Math.min(emfLevel / 30, 1.0),
        size: 4 + (emfLevel / 5),
        speedX: (Math.random() * 0.004 - 0.002),
        speedY: (Math.random() * 0.004 - 0.002),
        pulseSpeed: 2 + (emfLevel / 10),
        name: `E_BURST_${Math.floor(Math.random() * 100)}`,
        type: 'High RF Burst',
        age: 0
      };
      setBlips(prev => {
        // Limit total blips to 8
        const clean = prev.slice(-7);
        return [...clean, newBlip];
      });
    }
  }, [emfLevel, hauntingActive]);

  // Animation Loop for Canvas and Blip physics
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const render = () => {
      // Clear canvas with a very slight opacity trail for cinematic motion blur
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const maxRadius = Math.min(centerX, centerY) - 10;

      // Draw Grid Circles
      ctx.strokeStyle = `${accentColor}11`;
      ctx.lineWidth = 1;
      for (let r = maxRadius / 4; r <= maxRadius; r += maxRadius / 4) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw Crosshairs
      ctx.beginPath();
      ctx.moveTo(centerX - maxRadius, centerY);
      ctx.lineTo(centerX + maxRadius, centerY);
      ctx.moveTo(centerX, centerY - maxRadius);
      ctx.lineTo(centerX, centerY + maxRadius);
      ctx.stroke();

      // Draw Diagonal Helper Lines
      ctx.strokeStyle = `${accentColor}08`;
      ctx.beginPath();
      ctx.moveTo(centerX - maxRadius * 0.707, centerY - maxRadius * 0.707);
      ctx.lineTo(centerX + maxRadius * 0.707, centerY + maxRadius * 0.707);
      ctx.moveTo(centerX - maxRadius * 0.707, centerY + maxRadius * 0.707);
      ctx.lineTo(centerX + maxRadius * 0.707, centerY - maxRadius * 0.707);
      ctx.stroke();

      // Draw sweeping line
      if (isScanning) {
        angleRef.current = (angleRef.current + (hauntingActive ? 0.04 : 0.015)) % (Math.PI * 2);
        const sweepX = centerX + Math.cos(angleRef.current) * maxRadius;
        const sweepY = centerY + Math.sin(angleRef.current) * maxRadius;

        // Draw the sweep line
        ctx.strokeStyle = `${accentColor}44`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(sweepX, sweepY);
        ctx.stroke();

        // Draw sweep gradient trail
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxRadius);
        gradient.addColorStop(0, 'transparent');
        gradient.addColorStop(1, `${accentColor}05`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, maxRadius, angleRef.current - 0.4, angleRef.current);
        ctx.closePath();
        ctx.fill();
      }

      // Update and Draw Blips
      const sweptAngle = angleRef.current;
      const detectedThisFrame: RadarBlip[] = [];

      setBlips(prevBlips => {
        return prevBlips.map(blip => {
          // Move blip
          let nextX = blip.x + blip.speedX;
          let nextY = blip.y + blip.speedY;

          // Keep blips inside radar circle radius (approx 0.95 to keep margins)
          const dist = Math.sqrt(nextX * nextX + nextY * nextY);
          if (dist > 0.9) {
            // Bounce or reverse speed
            const angle = Math.atan2(nextY, nextX);
            nextX = Math.cos(angle) * 0.88;
            nextY = Math.sin(angle) * 0.88;
            blip.speedX = -blip.speedX * (0.8 + Math.random() * 0.4);
            blip.speedY = -blip.speedY * (0.8 + Math.random() * 0.4);
          }

          // Calculate visual position
          const bx = centerX + nextX * maxRadius;
          const by = centerY + nextY * maxRadius;

          // Calculate angle of the blip relative to center
          let blipAngle = Math.atan2(nextY, nextX);
          if (blipAngle < 0) blipAngle += Math.PI * 2;

          // Check if sweep line passed over the blip
          const angleDiff = Math.abs(sweptAngle - blipAngle);
          const isSwept = isScanning ? (angleDiff < 0.1 || angleDiff > Math.PI * 2 - 0.1) : true;

          // Pulse animation
          const pulse = 0.7 + Math.sin(Date.now() * 0.003 * blip.pulseSpeed) * 0.3;

          // Draw the blip if swept or if scanning is off
          if (isSwept || !isScanning) {
            // High glow outer ring
            ctx.shadowBlur = 10;
            ctx.shadowColor = accentColor;
            ctx.fillStyle = `${accentColor}${Math.floor(blip.intensity * 255).toString(16).padStart(2, '0')}`;
            ctx.beginPath();
            ctx.arc(bx, by, blip.size * pulse, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0; // Reset shadow

            // Inner core
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(bx, by, blip.size * 0.4, 0, Math.PI * 2);
            ctx.fill();

            // Label
            ctx.fillStyle = `${accentColor}dd`;
            ctx.font = '9px monospace';
            ctx.fillText(blip.name, bx + blip.size + 4, by + 3);
          }

          // Gather detected entities to show in HUD list
          const distanceToCenter = Math.sqrt(nextX * nextX + nextY * nextY);
          if (distanceToCenter < 0.9) {
            detectedThisFrame.push({
              ...blip,
              x: nextX,
              y: nextY,
              age: blip.age + 1
            });
          }

          return {
            ...blip,
            x: nextX,
            y: nextY,
            age: blip.age + 1
          };
        });
      });

      // Update list of detected entities (de-duplicate and limit)
      setDetectedEntities(detectedThisFrame.slice(0, 5));

      // Draw Center Core
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
      ctx.fill();

      // Outer Ring Border
      ctx.strokeStyle = `${accentColor}33`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(centerX, centerY, maxRadius, 0, Math.PI * 2);
      ctx.stroke();

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [accentColor, isScanning, hauntingActive]);

  return (
    <div className="border border-zinc-900 bg-zinc-950/80 rounded-lg p-4 relative overflow-hidden flex flex-col h-full shadow-[inset_0_0_15px_rgba(0,0,0,0.6)]">
      {/* HUD Header */}
      <div className="flex items-center justify-between border-b border-zinc-900 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Crosshair className="w-4 h-4" style={{ color: accentColor }} />
          <span className="text-xs font-bold tracking-widest text-white uppercase">AETHER_RADAR_SCANNER</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsScanning(!isScanning)}
            className="text-[9px] tracking-wider border border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 px-2 py-1 rounded text-slate-400 font-mono flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
          >
            {isScanning ? (
              <>
                <EyeOff className="w-3 h-3 text-red-400" />
                <span>FREEZE</span>
              </>
            ) : (
              <>
                <Eye className="w-3 h-3 text-emerald-400" />
                <span>SWEEP</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Radar Screen Layout */}
      <div className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-6">
        {/* Canvas Screen */}
        <div className="relative w-64 h-64 md:w-72 md:h-72 flex-shrink-0">
          {/* Scanning sweep overlay effect */}
          <div className="absolute inset-0 rounded-full border border-zinc-900 bg-black/40 shadow-[0_0_20px_rgba(0,0,0,0.8)] pointer-events-none"></div>
          <canvas
            ref={canvasRef}
            width={300}
            height={300}
            className="w-full h-full rounded-full"
          />
          {/* Grid coordinates overlay */}
          <div className="absolute top-2 left-2 text-[8px] font-mono text-slate-600">R_RANGE: 15m</div>
          <div className="absolute bottom-2 right-2 text-[8px] font-mono text-slate-600">BEAM_POL: SPECTRAL</div>
        </div>

        {/* Radar Detected Entities List */}
        <div className="flex-1 w-full min-w-[200px] flex flex-col justify-between self-stretch font-mono">
          <div className="space-y-3">
            <span className="text-[10px] tracking-widest text-slate-500 uppercase block mb-1">
              TARGET_ACQUISITION_LOG
            </span>
            {detectedEntities.length === 0 ? (
              <div className="border border-dashed border-zinc-900 rounded p-4 text-center text-slate-600 text-[10px] uppercase">
                Scanning sector... No anomalous signatures locked.
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-none">
                {detectedEntities.map((blip) => {
                  const dist = Math.sqrt(blip.x * blip.x + blip.y * blip.y) * 15; // Map to 15m scale
                  const bearing = Math.round((Math.atan2(blip.y, blip.x) * 180 / Math.PI + 360) % 360);
                  
                  return (
                    <div 
                      key={blip.id} 
                      className="border border-zinc-900 bg-zinc-950/90 rounded p-2 flex items-center justify-between text-[10px] relative overflow-hidden"
                    >
                      {/* Left side info */}
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full animate-ping" style={{ backgroundColor: accentColor }}></span>
                          <span className="text-white font-bold">{blip.name}</span>
                          <span className="text-[8px] px-1 py-0.2 rounded bg-zinc-900 text-slate-400 border border-zinc-800">
                            {blip.type}
                          </span>
                        </div>
                        <div className="text-slate-500 text-[9px]">
                          DIST: <span className="text-slate-300 font-bold">{dist.toFixed(1)}m</span> | 
                          BEARING: <span className="text-slate-300 font-bold">{bearing}°</span>
                        </div>
                      </div>

                      {/* Right side energy meter */}
                      <div className="text-right space-y-0.5">
                        <div className="text-[9px] text-slate-500">ENERGY</div>
                        <div 
                          className="font-bold text-xs"
                          style={{ color: accentColor }}
                        >
                          {(blip.intensity * 100).toFixed(0)}%
                        </div>
                      </div>

                      {/* Spark line accent */}
                      <div 
                        className="absolute bottom-0 left-0 h-[1.5px] transition-all duration-300"
                        style={{ 
                          width: `${blip.intensity * 100}%`,
                          backgroundColor: accentColor
                        }}
                      ></div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Stats Panel */}
          <div className="mt-4 pt-3 border-t border-zinc-900 grid grid-cols-2 gap-2">
            <div className="bg-zinc-900/30 border border-zinc-900 rounded p-2 text-center">
              <span className="text-[8px] text-slate-500 uppercase block">Anomalies Detected</span>
              <span className="text-lg font-bold text-white tracking-wider">
                {detectedEntities.length}
              </span>
            </div>
            <div className="bg-zinc-900/30 border border-zinc-900 rounded p-2 text-center">
              <span className="text-[8px] text-slate-500 uppercase block">Sector Status</span>
              {hauntingActive ? (
                <span className="text-[10px] font-bold text-red-500 tracking-wider animate-pulse flex items-center justify-center gap-1 mt-1">
                  <ShieldAlert className="w-3 h-3" /> OUTBREAK
                </span>
              ) : detectedEntities.length > 0 ? (
                <span className="text-[10px] font-bold text-amber-500 tracking-wider flex items-center justify-center gap-1 mt-1 animate-pulse">
                  ▲ ANOMALOUS
                </span>
              ) : (
                <span className="text-[10px] font-bold text-emerald-500 tracking-wider flex items-center justify-center gap-1 mt-1">
                  ● NOMINAL
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
