'use client';

import React from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Thermometer, Layers, Sparkles } from 'lucide-react';
import { getPresetCircuits, PresetCircuit } from '../presets/sampleCircuits';

interface TopToolbarProps {
  isSimulating: boolean;
  onToggleSimulate: () => void;
  onReset: () => void;
  onSelectPreset: (preset: PresetCircuit) => void;
  ambientTemperature: number;
  onSetAmbientTemperature: (temp: number) => void;
  wireColor: string;
  onSetWireColor: (color: string) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onClear: () => void;
}

const WIRE_COLORS = [
  { name: 'Red (+)', hex: '#e63946' },
  { name: 'Black (GND)', hex: '#1d3557' },
  { name: 'Yellow', hex: '#ffd166' },
  { name: 'Green', hex: '#06d6a0' },
  { name: 'Blue', hex: '#118ab2' },
  { name: 'Orange', hex: '#f77f00' },
];

export default function TopToolbar({
  isSimulating,
  onToggleSimulate,
  onReset,
  onSelectPreset,
  ambientTemperature,
  onSetAmbientTemperature,
  wireColor,
  onSetWireColor,
  isMuted,
  onToggleMute,
  onClear,
}: TopToolbarProps) {
  const presets = getPresetCircuits();

  return (
    <header className="h-14 bg-slate-950 border-b border-slate-800 px-4 flex items-center justify-between select-none z-30">
      {/* Brand & Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-black tracking-wider text-amber-400 font-mono flex items-center gap-1.5">
            OHMIC ⚡
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            PROTOTYPE v1.0
          </span>
        </div>

        <div className="h-4 w-px bg-slate-800 mx-1" />

        {/* Live Simulation Indicator */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <span
            className={`w-2 h-2 rounded-full ${
              isSimulating ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'
            }`}
          />
          <span className={isSimulating ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
            {isSimulating ? 'SOLVER ACTIVE (60Hz)' : 'SIMULATION PAUSED'}
          </span>
        </div>
      </div>

      {/* Center Controls: Play, Reset, Preset circuits */}
      <div className="flex items-center gap-3">
        {/* Play/Pause */}
        <button
          onClick={onToggleSimulate}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all shadow-md ${
            isSimulating
              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
              : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
          }`}
        >
          {isSimulating ? (
            <>
              <Pause className="w-3.5 h-3.5 fill-current" />
              <span>PAUSE</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>START SIM</span>
            </>
          )}
        </button>

        <button
          onClick={onReset}
          className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-all"
          title="Reset Simulation State"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-slate-800" />

        {/* Load Preset Circuit Dropdown */}
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <select
            onChange={(e) => {
              const selected = presets.find((p) => p.id === e.target.value);
              if (selected) onSelectPreset(selected);
            }}
            defaultValue=""
            className="bg-slate-900 border border-slate-700 text-xs font-mono text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-400 cursor-pointer"
          >
            <option value="" disabled>
              Load Demo Circuit...
            </option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Right Controls: Ambient Temp, Wire Color, Audio */}
      <div className="flex items-center gap-4">
        {/* Wire Color Picker */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-slate-400">WIRE:</span>
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
            {WIRE_COLORS.map((wc) => (
              <button
                key={wc.hex}
                onClick={() => onSetWireColor(wc.hex)}
                className={`w-4 h-4 rounded-full transition-transform ${
                  wireColor === wc.hex ? 'scale-125 ring-2 ring-white shadow-md' : 'hover:scale-110'
                }`}
                style={{ backgroundColor: wc.hex }}
                title={wc.name}
              />
            ))}
          </div>
        </div>

        {/* Ambient Temperature Slider */}
        <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
          <Thermometer className="w-4 h-4 text-orange-400" />
          <span>{ambientTemperature}°C</span>
          <input
            type="range"
            min="-10"
            max="80"
            value={ambientTemperature}
            onChange={(e) => onSetAmbientTemperature(parseInt(e.target.value))}
            className="w-16 accent-orange-400 cursor-pointer"
            title="Set Ambient Temperature"
          />
        </div>

        {/* Audio Mute Toggle */}
        <button
          onClick={onToggleMute}
          className={`p-2 rounded-lg border transition-all ${
            isMuted
              ? 'text-slate-500 border-slate-800 hover:text-slate-300'
              : 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
          }`}
          title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        <button
          onClick={onClear}
          className="text-xs font-mono text-rose-400 hover:text-rose-300 px-2 py-1 rounded hover:bg-rose-500/10 transition-colors"
        >
          Clear
        </button>
      </div>
    </header>
  );
}
