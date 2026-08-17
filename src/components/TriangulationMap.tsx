import React, { useState, useEffect } from 'react';
import { Compass, ShieldAlert, Radio, Landmark, MapPin, Eye } from 'lucide-react';

interface TriangulationMapProps {
  emfLevel: number;
  hauntingActive: boolean;
  accentColor: string;
}

interface SensorNode {
  id: string;
  name: string;
  room: string;
  x: number; // percentage from left
  y: number; // percentage from top
  emf: number;
  temp: number;
  motion: boolean;
  type: 'EMF' | 'TEMP' | 'MOTION';
}

export const TriangulationMap: React.FC<TriangulationMapProps> = ({
  emfLevel,
  hauntingActive,
  accentColor
}) => {
  const [selectedLocation, setSelectedLocation] = useState('Asylum - Ward B');
  const [nodes, setNodes] = useState<SensorNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<SensorNode | null>(null);

  const locations = [
    { name: 'Asylum - Ward B', desc: 'Abandoned medical ward. High history of cold spots.' },
    { name: 'Amityville Residence', desc: 'Residential attic. Multiple reports of kinetic poltergeist spikes.' },
    { name: 'Cabin in the Woods', desc: 'Isolated forestry cabin. Constant infrasound and RF noise.' }
  ];

  // Initialize and update mock sensor nodes based on selected location
  useEffect(() => {
    let initialNodes: SensorNode[] = [];
    if (selectedLocation === 'Asylum - Ward B') {
      initialNodes = [
        { id: 'N1', name: 'NODE_01_EMF', room: 'Intensive Care', x: 25, y: 35, emf: 0.8, temp: 18.2, motion: false, type: 'EMF' },
        { id: 'N2', name: 'NODE_02_TEMP', room: 'Morgue Entrance', x: 75, y: 25, emf: 1.2, temp: 12.4, motion: false, type: 'TEMP' },
        { id: 'N3', name: 'NODE_03_MOTION', room: 'Isolation Ward', x: 45, y: 70, emf: 0.4, temp: 19.1, motion: false, type: 'MOTION' },
        { id: 'N4', name: 'NODE_04_EMF', room: 'Doctor Office', x: 80, y: 75, emf: 0.5, temp: 19.8, motion: false, type: 'EMF' }
      ];
    } else if (selectedLocation === 'Amityville Residence') {
      initialNodes = [
        { id: 'N1', name: 'NODE_01_EMF', room: 'Master Bedroom', x: 30, y: 25, emf: 1.5, temp: 20.1, motion: false, type: 'EMF' },
        { id: 'N2', name: 'NODE_02_TEMP', room: 'Attic Stairway', x: 70, y: 45, emf: 2.1, temp: 15.5, motion: false, type: 'TEMP' },
        { id: 'N3', name: 'NODE_03_MOTION', room: 'Basement Door', x: 20, y: 75, emf: 0.9, temp: 17.8, motion: false, type: 'MOTION' }
      ];
    } else {
      initialNodes = [
        { id: 'N1', name: 'NODE_01_EMF', room: 'Living Room', x: 50, y: 50, emf: 0.5, temp: 19.5, motion: false, type: 'EMF' },
        { id: 'N2', name: 'NODE_02_TEMP', room: 'Basement Hatch', x: 85, y: 80, emf: 1.1, temp: 11.2, motion: false, type: 'TEMP' },
        { id: 'N3', name: 'NODE_03_MOTION', room: 'Porch Entrance', x: 15, y: 20, emf: 0.2, temp: 15.1, motion: false, type: 'MOTION' }
      ];
    }
    setNodes(initialNodes);
    setSelectedNode(initialNodes[0]);
  }, [selectedLocation]);

  // Simulate real-time fluctuating node readings
  useEffect(() => {
    const interval = setInterval(() => {
      setNodes(prevNodes => {
        const updated = prevNodes.map(node => {
          let updatedEMF = node.emf;
          let updatedTemp = node.temp;
          let updatedMotion = node.motion;

          // If global haunting active, make ALL nodes spike dramatically
          if (hauntingActive) {
            updatedEMF = 15 + Math.random() * 10;
            updatedTemp = Math.max(1, node.temp - (0.5 + Math.random() * 0.8)); // extreme temperature drop
            updatedMotion = Math.random() < 0.7;
          } else {
            // Normal fluctuation
            if (node.type === 'EMF') {
              // Standard fluctuation, occasionally spike if global EMF is high
              updatedEMF = emfLevel > 5 ? emfLevel * (0.6 + Math.random() * 0.4) : 0.4 + Math.random() * 0.8;
            } else {
              updatedEMF = 0.3 + Math.random() * 0.5;
            }

            if (node.type === 'TEMP') {
              // Temperature slowly drifts, drops if EMF is high
              const tempDrop = emfLevel > 8 ? 0.2 : 0;
              updatedTemp = node.temp + (Math.random() * 0.4 - 0.2) - tempDrop;
            }

            if (node.type === 'MOTION') {
              // Occasional motion trigger (especially if EMF spikes)
              const motionChance = emfLevel > 8 ? 0.3 : 0.03;
              updatedMotion = Math.random() < motionChance;
            }
          }

          return {
            ...node,
            emf: Number(updatedEMF.toFixed(2)),
            temp: Number(updatedTemp.toFixed(1)),
            motion: updatedMotion
          };
        });

        // Keep selected node details synced
        if (selectedNode) {
          const synced = updated.find(n => n.id === selectedNode.id);
          if (synced) setSelectedNode(synced);
        }

        return updated;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [emfLevel, hauntingActive, selectedNode]);

  return (
    <div className="border border-zinc-900 bg-zinc-950/80 rounded-lg p-4 flex flex-col h-full shadow-[inset_0_0_15px_rgba(0,0,0,0.6)] font-mono">
      {/* HUD Header */}
      <div className="flex items-center justify-between border-b border-zinc-900 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4" style={{ color: accentColor }} />
          <span className="text-xs font-bold tracking-widest text-white uppercase">TRIANGULATION_NODE_MAP</span>
        </div>
        <div className="flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5 text-slate-500" />
          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="text-[10px] bg-zinc-900 border border-zinc-800 text-white rounded px-2 py-0.5 focus:outline-none focus:border-slate-500 cursor-pointer font-bold"
          >
            {locations.map(loc => (
              <option key={loc.name} value={loc.name}>{loc.name}</option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-[10px] text-slate-500 mb-4 uppercase">
        {locations.find(l => l.name === selectedLocation)?.desc}
      </p>

      {/* Grid Floorplan & Node Markers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1">
        {/* Floorplan Map Screen */}
        <div className="lg:col-span-2 bg-black border border-zinc-900 rounded-lg p-2 relative min-h-[220px] flex items-center justify-center overflow-hidden">
          {/* Grid lines overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#111111_1px,transparent_1px),linear-gradient(to_bottom,#111111_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none"></div>

          {/* Simple vector floor plan outline */}
          <svg className="absolute inset-0 w-full h-full opacity-25 p-4 pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
            {/* Outer walls */}
            <rect x="5" y="5" width="90" height="90" fill="none" stroke={accentColor} strokeWidth="1.5" />
            {/* Rooms dividers */}
            <line x1="50" y1="5" x2="50" y2="95" stroke={accentColor} strokeWidth="1" strokeDasharray="2,2" />
            <line x1="5" y1="50" x2="95" y2="50" stroke={accentColor} strokeWidth="1" strokeDasharray="2,2" />
            <line x1="25" y1="5" x2="25" y2="50" stroke={accentColor} strokeWidth="1" strokeDasharray="2,2" />
            <line x1="75" y1="50" x2="75" y2="95" stroke={accentColor} strokeWidth="1" strokeDasharray="2,2" />
          </svg>

          {/* Map labels */}
          <div className="absolute top-6 left-6 text-[8px] text-slate-600 uppercase">ZONE_ALPHA</div>
          <div className="absolute top-6 right-6 text-[8px] text-slate-600 uppercase">ZONE_BETA</div>
          <div className="absolute bottom-6 left-6 text-[8px] text-slate-600 uppercase">ZONE_CHARLIE</div>
          <div className="absolute bottom-6 right-6 text-[8px] text-slate-600 uppercase">ZONE_DELTA</div>

          {/* Node Markers */}
          {nodes.map((node) => {
            const isSelected = selectedNode?.id === node.id;
            let markerBg = 'bg-zinc-800 border-zinc-500';
            
            if (node.motion) {
              markerBg = 'bg-red-500 border-red-400 animate-ping';
            } else if (node.emf > 10.0) {
              markerBg = 'bg-red-600 border-red-500';
            } else if (node.emf > 2.5) {
              markerBg = 'bg-amber-500 border-amber-400';
            } else {
              markerBg = 'bg-emerald-500 border-emerald-400';
            }

            return (
              <button
                key={node.id}
                onClick={() => setSelectedNode(node)}
                className={`absolute w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all cursor-pointer z-10 hover:scale-110 active:scale-90 ${markerBg}`}
                style={{
                  left: `${node.x}%`,
                  top: `${node.y}%`,
                  boxShadow: isSelected 
                    ? `0 0 15px #ffffff, inset 0 0 5px rgba(255,255,255,0.8)` 
                    : `0 0 10px ${node.emf > 10.0 ? '#ef4444' : node.emf > 2.5 ? '#f59e0b' : '#10b981'}44`
                }}
              >
                <span className="text-[8px] font-bold text-black">{node.id}</span>
              </button>
            );
          })}

          {/* Heatmap overlay during haunting */}
          {hauntingActive && (
            <div 
              className="absolute inset-0 bg-red-950/20 pointer-events-none animate-pulse"
              style={{
                boxShadow: 'inset 0 0 50px rgba(239,68,68,0.3)'
              }}
            ></div>
          )}
        </div>

        {/* Selected Node Inspector Panel */}
        <div className="bg-zinc-900/20 border border-zinc-900 rounded-lg p-3 flex flex-col justify-between">
          {selectedNode ? (
            <div className="space-y-3.5">
              <div className="border-b border-zinc-900 pb-2">
                <span className="text-[8px] text-slate-500 uppercase block">NODE INSPECTOR</span>
                <span className="text-sm font-bold text-white">{selectedNode.name}</span>
                <span className="text-[9px] text-slate-400 block mt-0.5">ROOM: {selectedNode.room}</span>
              </div>

              {/* Node Readings */}
              <div className="space-y-2.5">
                <div>
                  <span className="text-[8px] text-slate-500 uppercase block">MAGNETIC LOAD</span>
                  <div className="flex justify-between items-center">
                    <span 
                      className="text-lg font-bold"
                      style={{ color: selectedNode.emf > 10.0 ? '#ef4444' : selectedNode.emf > 2.5 ? '#f59e0b' : accentColor }}
                    >
                      {selectedNode.emf.toFixed(2)} mG
                    </span>
                    <span className="text-[9px] text-slate-400">
                      {selectedNode.emf > 10.0 ? 'SPIKING' : selectedNode.emf > 2.5 ? 'MODERATE' : 'QUIET'}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-[8px] text-slate-500 uppercase block">THERMAL CORE</span>
                  <div className="flex justify-between items-center">
                    <span 
                      className="text-lg font-bold text-sky-400"
                    >
                      {selectedNode.temp.toFixed(1)} °C
                    </span>
                    <span className="text-[9px] text-slate-400">
                      {selectedNode.temp < 10.0 ? 'FREEZING' : 'NORMAL'}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-[8px] text-slate-500 uppercase block">INFRARED MOTION SENSOR</span>
                  <div className="flex justify-between items-center">
                    <span 
                      className={`text-xs font-bold px-2 py-0.5 rounded ${
                        selectedNode.motion 
                          ? 'bg-red-950 text-red-400 border border-red-500 animate-pulse' 
                          : 'bg-zinc-900 text-slate-500 border border-zinc-800'
                      }`}
                    >
                      {selectedNode.motion ? 'MOTION DETECTED' : 'NO MOTION'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-slate-600 text-[10px] uppercase py-8">
              Select a node on the layout map to inspect diagnostics.
            </div>
          )}

          {/* Triangulation Alert */}
          <div className="border-t border-zinc-900 pt-3 mt-3">
            <span className="text-[8px] text-slate-600 uppercase block">Triangulation Lock</span>
            <div className="flex items-center gap-1.5 mt-1">
              <div className={`w-2 h-2 rounded-full ${hauntingActive ? 'bg-red-500 animate-ping' : 'bg-emerald-500'}`}></div>
              <span className="text-[10px] text-slate-300 font-bold">
                {hauntingActive ? 'MULTIPLE BREACHES REGISTERED' : 'COHERENT MATRIX LOCK'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
