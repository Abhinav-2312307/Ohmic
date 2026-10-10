'use client';

import React from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Thermometer,
  Sparkles,
  MousePointer,
  Spline,
  Box,
  RotateCw,
  Trash2,
  SlidersHorizontal,
  ChevronDown,
  Keyboard,
} from 'lucide-react';
import { getPresetCircuits, PresetCircuit } from '../presets/sampleCircuits';

export type WorkbenchTool = 'SELECT' | 'WIRE' | 'PLACE_COMPONENT' | 'DMM_PROBE' | 'DELETE';

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

  activeTool: WorkbenchTool;
  onSelectTool: (tool: WorkbenchTool) => void;
  onRotateSelected?: (direction: 'CW' | 'CCW') => void;
  onDeleteSelected?: () => void;
  hasSelection?: boolean;
  isDrawerOpen: boolean;
  onToggleDrawer: () => void;
  onOpenControlsGuide?: () => void;
}

export const WIRE_COLORS = [
  { name: 'Red (+)', hex: '#ef4444' },
  { name: 'Black (GND)', hex: '#18181b' },
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Cyan', hex: '#06b6d4' },
  { name: 'Violet', hex: '#8b5cf6' },
  { name: 'White', hex: '#f4f4f5' },
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
  activeTool,
  onSelectTool,
  onRotateSelected,
  onDeleteSelected,
  hasSelection,
  isDrawerOpen,
  onToggleDrawer,
  onOpenControlsGuide,
}: TopToolbarProps) {
  const presets = getPresetCircuits();

  return (
    <header className="h-14 glass-panel border-b border-white/[0.08] px-4 flex items-center justify-between select-none z-30">
      {/* Left: Brand Identity & Circuit Presets */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-500/20 border border-amber-400/40">
            <span className="text-zinc-950 font-black text-sm font-mono">Ω</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold tracking-wider text-zinc-100 font-mono">OHMIC</span>
              <span className="text-[9px] font-mono font-medium px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                PRO v1.2
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-400">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isSimulating ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'
                }`}
              />
              <span>{isSimulating ? '60Hz MNA Solver Active' : 'Simulation Paused'}</span>
            </div>
          </div>
        </div>

        <div className="h-5 w-px bg-white/[0.08] mx-1" />

        {/* Load Preset Circuit Dropdown */}
        <div className="relative group">
          <div className="flex items-center gap-2 bg-zinc-900/80 hover:bg-zinc-850 px-2.5 py-1.5 rounded-lg border border-white/[0.08] text-xs font-mono text-zinc-300 transition-all cursor-pointer">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <select
              onChange={(e) => {
                const selected = presets.find((p) => p.id === e.target.value);
                if (selected) onSelectPreset(selected);
              }}
              defaultValue=""
              className="bg-transparent text-zinc-200 text-xs font-mono focus:outline-none cursor-pointer pr-4"
            >
              <option value="" disabled className="bg-zinc-900 text-zinc-400">
                Load Preset Circuit...
              </option>
              {presets.map((p) => (
                <option key={p.id} value={p.id} className="bg-zinc-900 text-zinc-200">
                  {p.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Center: Interactive Precision Tool Shelf */}
      <div className="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-xl border border-white/[0.08] shadow-lg">
        {/* Select Tool */}
        <button
          onClick={() => onSelectTool('SELECT')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
            activeTool === 'SELECT'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
          title="Select & Orbit (V / Esc)"
        >
          <MousePointer className="w-3.5 h-3.5" />
          <span>SELECT</span>
        </button>

        {/* Wire Tool */}
        <button
          onClick={() => onSelectTool('WIRE')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
            activeTool === 'WIRE'
              ? 'bg-amber-500 text-zinc-950 font-bold shadow-md shadow-amber-500/20'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
          title="Stretch Jumper Wire (W)"
        >
          <Spline className="w-3.5 h-3.5" />
          <span>WIRE</span>
        </button>

        {/* Component Drawer Toggle */}
        <button
          onClick={onToggleDrawer}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
            isDrawerOpen
              ? 'bg-zinc-800 text-zinc-100 border border-white/[0.1]'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
          title="Toggle Component Catalog (C)"
        >
          <Box className="w-3.5 h-3.5" />
          <span>COMPONENTS</span>
        </button>

        <div className="h-4 w-px bg-white/[0.08] mx-1" />

        {/* Wire Color Palette Quick Dots */}
        <div className="flex items-center gap-1 px-1">
          {WIRE_COLORS.map((wc) => (
            <button
              key={wc.hex}
              onClick={() => {
                onSetWireColor(wc.hex);
                onSelectTool('WIRE');
              }}
              className={`w-3.5 h-3.5 rounded-full transition-all ${
                wireColor === wc.hex
                  ? 'ring-2 ring-amber-400 scale-125 shadow-md shadow-amber-500/40'
                  : 'hover:scale-110 opacity-70 hover:opacity-100'
              }`}
              style={{ backgroundColor: wc.hex }}
              title={`Use ${wc.name} Wire`}
            />
          ))}
        </div>

        {/* Dual-Direction Rotate Action (if component selected) */}
        {hasSelection && onRotateSelected && (
          <div className="flex items-center bg-zinc-950/70 rounded-lg p-0.5 border border-white/[0.08]">
            <button
              onClick={() => onRotateSelected('CCW')}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-mono text-zinc-300 hover:text-amber-300 hover:bg-zinc-800 transition-all"
              title="Rotate Counter-Clockwise 90° (← Arrow Key)"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span>←</span>
            </button>
            <div className="w-px h-3 bg-white/[0.1] mx-0.5" />
            <button
              onClick={() => onRotateSelected('CW')}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-mono text-zinc-300 hover:text-amber-300 hover:bg-zinc-800 transition-all"
              title="Rotate Clockwise 90° (→ Arrow Key or R)"
            >
              <RotateCw className="w-3.5 h-3.5 text-amber-400" />
              <span>→ (R)</span>
            </button>
          </div>
        )}

        {/* Delete Action (if component or wire selected) */}
        {hasSelection && onDeleteSelected && (
          <button
            onClick={onDeleteSelected}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-all"
            title="Delete Selected (Del)"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>DELETE</span>
          </button>
        )}

        {/* Controls Guide Quick Button */}
        {onOpenControlsGuide && (
          <button
            onClick={onOpenControlsGuide}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono text-zinc-300 hover:text-amber-300 hover:bg-zinc-800/80 border border-white/[0.06] transition-all ml-1"
            title="Open Controls & Shortcuts Guide (? / H)"
          >
            <Keyboard className="w-3.5 h-3.5 text-amber-400" />
            <span>CONTROLS</span>
          </button>
        )}
      </div>

      {/* Right: Simulation Engine State & Environment */}
      <div className="flex items-center gap-3">
        {/* Play/Pause Button */}
        <button
          onClick={onToggleSimulate}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all shadow-md ${
            isSimulating
              ? 'bg-zinc-850 hover:bg-zinc-800 text-amber-400 border border-amber-500/30'
              : 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-emerald-500/20'
          }`}
          title="Toggle Simulation (Space)"
        >
          {isSimulating ? (
            <>
              <Pause className="w-3.5 h-3.5 fill-current" />
              <span>PAUSE</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>RUN SIM</span>
            </>
          )}
        </button>

        {/* Reset */}
        <button
          onClick={onReset}
          className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-all"
          title="Reset Circuit"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Ambient Temperature Slider */}
        <div className="flex items-center gap-1.5 bg-zinc-900/80 px-2 py-1 rounded-lg border border-white/[0.08] text-xs font-mono text-zinc-300">
          <Thermometer className="w-3.5 h-3.5 text-orange-400" />
          <span>{ambientTemperature}°C</span>
          <input
            type="range"
            min="-10"
            max="80"
            value={ambientTemperature}
            onChange={(e) => onSetAmbientTemperature(parseInt(e.target.value))}
            className="w-14 h-1 accent-orange-400 bg-zinc-700 rounded cursor-pointer"
            title="Ambient Temperature"
          />
        </div>

        {/* Audio Mute Toggle */}
        <button
          onClick={onToggleMute}
          className={`p-1.5 rounded-lg border transition-all ${
            isMuted
              ? 'text-zinc-500 border-white/[0.06] hover:text-zinc-300'
              : 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
          }`}
          title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        {/* Clear Canvas */}
        <button
          onClick={onClear}
          className="text-xs font-mono text-zinc-500 hover:text-rose-400 px-2 py-1 rounded hover:bg-rose-500/10 transition-colors"
          title="Clear all components & wires"
        >
          Clear
        </button>
      </div>
    </header>
  );
}
