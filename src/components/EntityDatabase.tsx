import React, { useState } from 'react';
import { BookOpen, Skull, Flame, Wind, Eye, ShieldAlert, Sparkles } from 'lucide-react';

interface EntityDatabaseProps {
  accentColor: string;
}

interface Entity {
  name: string;
  class: string;
  danger: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  emfProfile: string;
  tempProfile: string;
  rfProfile: string;
  behaviors: string[];
  countermeasure: string;
  icon: React.ReactNode;
}

export const EntityDatabase: React.FC<EntityDatabaseProps> = ({ accentColor }) => {
  const [selectedEntity, setSelectedEntity] = useState<string>('Spirit');

  const entities: Entity[] = [
    {
      name: 'Spirit',
      class: 'Class I Residual Apparition',
      danger: 'LOW',
      emfProfile: '2.5 - 5.0 mG [Stable]',
      tempProfile: 'Slow drift (12°C - 15°C)',
      rfProfile: 'Low static emissions',
      behaviors: [
        'Passive haunting behaviors.',
        'No direct kinetic triggers.',
        'Often bound to a specific personal heirloom.'
      ],
      countermeasure: 'Smudge sticks or high frequency electromagnetic dispersion.',
      icon: <Wind className="w-5 h-5 text-sky-400" />
    },
    {
      name: 'Wraith',
      class: 'Class II Poltergeist Breed',
      danger: 'MEDIUM',
      emfProfile: '5.0 - 10.0 mG [High rate of fluctuation]',
      tempProfile: 'Sudden cold spots (5°C - 8°C)',
      rfProfile: 'EVP whispers at 1200Hz',
      behaviors: [
        'Can pass through physical barriers.',
        'Attracted to high-frequency motion.',
        'Triggers infrared motion alarms randomly.'
      ],
      countermeasure: 'Salt barriers or localized magnetic shielding.',
      icon: <Eye className="w-5 h-5 text-emerald-400" />
    },
    {
      name: 'Poltergeist',
      class: 'Class III Kinetic Manifestation',
      danger: 'HIGH',
      emfProfile: '10.0 - 18.0 mG [Spikes on X and Y Axes]',
      tempProfile: 'Freezing cold spots (< 3°C)',
      rfProfile: 'Loud white noise bursts',
      behaviors: [
        'Highly kinetic. Throws physical objects.',
        'Alters local gravitational fields.',
        'Disrupts digital monitors and audio recorders.'
      ],
      countermeasure: 'Infrasound pulses or grounding magnetic fields.',
      icon: <Flame className="w-5 h-5 text-amber-500 animate-pulse" />
    },
    {
      name: 'Oni',
      class: 'Class IV Demonic Apparition',
      danger: 'EXTREME',
      emfProfile: '18.0+ mG [Saturated Tri-axis load]',
      tempProfile: 'Near-freezing temperatures (< 0°C)',
      rfProfile: 'Screaming EVP signals',
      behaviors: [
        'Highly aggressive and territorial.',
        'Extremely active when multiple operators are present.',
        'Materializes in physical form for short periods.'
      ],
      countermeasure: 'Crucifix triangulation or high-intensity UV exposure.',
      icon: <Skull className="w-5 h-5 text-red-500 animate-bounce" />
    }
  ];

  const current = entities.find(e => e.name === selectedEntity) || entities[0];

  const getDangerColor = (danger: string) => {
    switch (danger) {
      case 'EXTREME':
        return 'text-red-500 font-extrabold animate-pulse';
      case 'HIGH':
        return 'text-amber-500 font-bold';
      case 'MEDIUM':
        return 'text-yellow-500';
      default:
        return 'text-emerald-500';
    }
  };

  return (
    <div className="border border-zinc-900 bg-zinc-950/80 rounded-lg p-4 flex flex-col h-full shadow-[inset_0_0_15px_rgba(0,0,0,0.6)] font-mono">
      {/* HUD Header */}
      <div className="flex items-center justify-between border-b border-zinc-900 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4" style={{ color: accentColor }} />
          <span className="text-xs font-bold tracking-widest text-white uppercase">SPECTRAL_ENTITY_DATABASE</span>
        </div>
        <span className="text-[9px] text-slate-500 tracking-wider">FIELD CLASSIFICATIONS</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
        {/* Left Side: Navigation list */}
        <div className="md:col-span-1 space-y-1.5">
          <span className="text-[8px] text-slate-500 uppercase tracking-wider block mb-1">ENTITY INDEX</span>
          {entities.map(e => (
            <button
              key={e.name}
              onClick={() => setSelectedEntity(e.name)}
              className={`w-full p-2.5 rounded border text-left transition-all cursor-pointer flex items-center justify-between text-xs ${
                selectedEntity === e.name
                  ? 'bg-white text-black border-white font-bold'
                  : 'bg-zinc-900/40 text-slate-400 border-zinc-900 hover:text-white hover:border-zinc-800'
              }`}
            >
              <div className="flex items-center gap-2">
                {e.icon}
                <span>{e.name.toUpperCase()}</span>
              </div>
              <span className={`text-[8px] px-1 py-0.2 rounded ${
                selectedEntity === e.name ? 'bg-black text-white' : 'bg-zinc-950 text-slate-400'
              }`}>
                {e.danger}
              </span>
            </button>
          ))}
        </div>

        {/* Right Side: Entity Info Inspector */}
        <div className="md:col-span-2 bg-zinc-900/10 border border-zinc-900 rounded-lg p-3.5 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="border-b border-zinc-900 pb-2 flex items-start justify-between">
              <div>
                <span className="text-[8px] text-slate-500 uppercase block">SPECTRAL PROFILE</span>
                <span className="text-lg font-extrabold text-white tracking-wider">{current.name.toUpperCase()}</span>
                <span className="text-[9px] text-slate-400 block mt-0.5">{current.class}</span>
              </div>
              <div className="text-right">
                <span className="text-[8px] text-slate-500 uppercase block">THREAT RISK</span>
                <span className={`text-xs uppercase ${getDangerColor(current.danger)}`}>
                  {current.danger}
                </span>
              </div>
            </div>

            {/* Profiles grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px]">
              <div className="bg-zinc-950/80 border border-zinc-900 rounded p-2">
                <span className="text-[8px] text-slate-500 uppercase block font-bold">EMF RANGE</span>
                <span className="text-white mt-1 block font-semibold">{current.emfProfile}</span>
              </div>
              <div className="bg-zinc-950/80 border border-zinc-900 rounded p-2">
                <span className="text-[8px] text-slate-500 uppercase block font-bold">THERMAL PROFILE</span>
                <span className="text-sky-400 mt-1 block font-semibold">{current.tempProfile}</span>
              </div>
              <div className="bg-zinc-950/80 border border-zinc-900 rounded p-2">
                <span className="text-[8px] text-slate-500 uppercase block font-bold">RF MODULATION</span>
                <span className="text-slate-300 mt-1 block font-semibold">{current.rfProfile}</span>
              </div>
            </div>

            {/* Behavior list */}
            <div className="space-y-1.5">
              <span className="text-[8px] text-slate-500 uppercase tracking-wider block">OBSERVED BEHAVIORS</span>
              <ul className="space-y-1 text-[10px] text-slate-400 list-disc list-inside pl-1">
                {current.behaviors.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Countermeasures */}
          <div className="border-t border-zinc-900 pt-3 mt-3">
            <span className="text-[8px] text-slate-500 uppercase block font-bold">CONTAINMENT COUNTERMEASURE</span>
            <p className="text-[10px] text-amber-500 font-semibold mt-1 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{current.countermeasure}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
