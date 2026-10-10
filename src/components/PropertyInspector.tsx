'use client';

import React from 'react';
import { CircuitComponent, JumperWire } from '../engine/componentTypes';
import { Flame, AlertTriangle, Trash2, Cpu, Zap, Activity, RotateCw, RotateCcw, X, Spline } from 'lucide-react';
import { audioEngine } from '../engine/audioEngine';

interface PropertyInspectorProps {
  selectedComponent: CircuitComponent | null;
  selectedWire?: JumperWire | null;
  onUpdateValue: (id: string, newValue: number) => void;
  onUpdateState: (id: string, newState: Partial<CircuitComponent['state']>) => void;
  onDeleteComponent: (id: string) => void;
  onDeleteWire?: (id: string) => void;
  onRotateComponent?: (id: string, direction?: 'CW' | 'CCW') => void;
  onClose: () => void;
}

export default function PropertyInspector({
  selectedComponent,
  selectedWire,
  onUpdateValue,
  onUpdateState,
  onDeleteComponent,
  onDeleteWire,
  onRotateComponent,
  onClose,
}: PropertyInspectorProps) {
  if (!selectedComponent && !selectedWire) return null;

  // 1. Inspecting a Jumper Wire
  if (selectedWire) {
    const w = selectedWire;
    return (
      <aside className="absolute top-16 right-4 w-80 glass-panel rounded-2xl p-4 select-none z-20 shadow-2xl border border-white/[0.08] animate-in fade-in slide-in-from-right-4 duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded-full border border-white/40 shadow-sm" style={{ backgroundColor: w.color }} />
            <div>
              <span className="text-[10px] font-mono text-zinc-400">JUMPER WIRE</span>
              <h2 className="text-xs font-bold text-zinc-100 font-mono">{w.startHoleId} ➔ {w.endHoleId}</h2>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {onDeleteWire && (
              <button
                onClick={() => {
                  audioEngine.playPopSound();
                  onDeleteWire(w.id);
                }}
                className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                title="Delete Wire (Del)"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="p-2.5 bg-zinc-950/60 rounded-xl border border-white/[0.06]">
            <span className="text-[10px] text-zinc-500">CURRENT FLOW</span>
            <p className="text-sm font-bold text-emerald-400">{(w.current * 1000).toFixed(1)} mA</p>
          </div>
          <div className="p-2.5 bg-zinc-950/60 rounded-xl border border-white/[0.06]">
            <span className="text-[10px] text-zinc-500">POTENTIAL</span>
            <p className="text-sm font-bold text-amber-400">{w.voltage.toFixed(2)} V</p>
          </div>
        </div>
      </aside>
    );
  }

  // 2. Inspecting a Component
  const c = selectedComponent!;
  const isBurned = c.health === 'BURNED_OUT';
  const isOverheating = c.health === 'OVERHEATING';

  return (
    <aside className="absolute top-16 right-4 max-h-[calc(100vh-5rem)] w-80 glass-panel rounded-2xl p-4 select-none z-20 shadow-2xl border border-white/[0.08] overflow-y-auto animate-in fade-in slide-in-from-right-4 duration-200">
      {/* Header */}
      <div className="flex items-start justify-between pb-3 border-b border-white/[0.06]">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase text-amber-400 tracking-wider">
            {c.type}
          </span>
          <h2 className="text-sm font-bold text-zinc-100">{c.name}</h2>
        </div>

        <div className="flex items-center gap-1">
          {onRotateComponent && (
            <div className="flex items-center bg-zinc-950/60 rounded-lg p-0.5 border border-white/[0.06]">
              <button
                onClick={() => {
                  audioEngine.playKnobClick();
                  onRotateComponent(c.id, 'CCW');
                }}
                className="p-1 text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 rounded transition-all"
                title="Rotate Counter-Clockwise 90° (← Arrow Key)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <div className="w-px h-3 bg-white/[0.1] mx-0.5" />
              <button
                onClick={() => {
                  audioEngine.playKnobClick();
                  onRotateComponent(c.id, 'CW');
                }}
                className="p-1 text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 rounded transition-all"
                title="Rotate Clockwise 90° (→ Arrow Key or R)"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <button
            onClick={() => {
              audioEngine.playPopSound();
              onDeleteComponent(c.id);
            }}
            className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
            title="Delete Component (Del)"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
            title="Deselect (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Quick Interactive Controls Pill Bar */}
      <div className="my-2.5 px-2.5 py-1.5 bg-zinc-950/50 rounded-xl border border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-zinc-400">
        <span className="flex items-center gap-1">
          🔄 Rotate: <kbd className="px-1 py-0.2 rounded bg-zinc-800 text-amber-300 border border-white/[0.08]">←</kbd> <kbd className="px-1 py-0.2 rounded bg-zinc-800 text-amber-300 border border-white/[0.08]">→</kbd>
        </span>
        <span className="flex items-center gap-1">
          🖐 Move: <kbd className="px-1 py-0.2 rounded bg-zinc-800 text-amber-300 border border-white/[0.08]">Drag</kbd> or <kbd className="px-1 py-0.2 rounded bg-zinc-800 text-amber-300 border border-white/[0.08]">WASD</kbd>
        </span>
      </div>

      {/* Burnout Warning */}
      {isBurned && (
        <div className="my-3 p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl flex items-center gap-2.5 text-rose-300">
          <Flame className="w-5 h-5 text-rose-500 shrink-0 animate-bounce" />
          <div className="text-xs">
            <p className="font-bold">COMPONENT DESTROYED</p>
            <p className="text-[11px] text-rose-400">Thermal overload (P &gt; Pmax). Open-circuit failure.</p>
          </div>
        </div>
      )}

      {/* Tunable Value Input */}
      {c.type !== 'SWITCH_TACTILE' && c.type !== 'BATTERY_9V' && (
        <div className="my-3">
          <label className="text-[10px] font-mono text-zinc-400 mb-1.5 block uppercase tracking-wider">
            Rated Value ({c.unit}):
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={c.value}
              onChange={(e) => onUpdateValue(c.id, parseFloat(e.target.value) || 0)}
              className="flex-1 bg-zinc-950/80 border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs font-mono text-zinc-100 focus:outline-none focus:border-amber-400"
            />
            <span className="text-xs font-mono text-zinc-400 px-2 py-1.5 bg-zinc-900 rounded-xl border border-white/[0.06]">
              {c.unit}
            </span>
          </div>
        </div>
      )}

      {/* Potentiometer Rotary Wiper Slider */}
      {c.type === 'POTENTIOMETER' && (
        <div className="my-3 p-3 bg-zinc-950/50 rounded-xl border border-white/[0.06]">
          <div className="flex items-center justify-between text-xs font-mono mb-2">
            <span className="text-zinc-400">WIPER POSITION:</span>
            <span className="text-amber-400 font-bold">
              {Math.round((c.state?.wiperRatio ?? 0.5) * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0.01"
            max="0.99"
            step="0.01"
            value={c.state?.wiperRatio ?? 0.5}
            onChange={(e) =>
              onUpdateState(c.id, { wiperRatio: parseFloat(e.target.value) })
            }
            className="w-full accent-amber-400 cursor-pointer"
          />
        </div>
      )}

      {/* Switch Actuator */}
      {c.type === 'SWITCH_TACTILE' && (
        <div className="my-3">
          <button
            onMouseDown={() => {
              audioEngine.playSnapSound();
              onUpdateState(c.id, { isClosed: true });
            }}
            onMouseUp={() => {
              audioEngine.playPopSound();
              onUpdateState(c.id, { isClosed: false });
            }}
            className={`w-full py-2.5 rounded-xl font-mono font-bold text-xs transition-all ${
              c.state?.isClosed
                ? 'bg-emerald-500 text-zinc-950 shadow-lg shadow-emerald-500/20'
                : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border border-white/[0.08]'
            }`}
          >
            {c.state?.isClosed ? 'PRESSED (CLOSED 0.00Ω)' : 'PRESS TO ACTUATE'}
          </button>
        </div>
      )}

      {/* Live Operating Telemetry */}
      <div className="mt-2 border-t border-white/[0.06] pt-3 flex flex-col gap-2.5">
        <span className="text-[10px] font-mono font-bold uppercase text-zinc-400 tracking-wider">
          LIVE OPERATING METRICS
        </span>

        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="p-2.5 bg-zinc-950/60 rounded-xl border border-white/[0.06]">
            <span className="text-[10px] text-zinc-500">VOLTAGE DROP</span>
            <p className="text-sm font-bold text-zinc-100">{c.voltageDrop.toFixed(2)} V</p>
          </div>

          <div className="p-2.5 bg-zinc-950/60 rounded-xl border border-white/[0.06]">
            <span className="text-[10px] text-zinc-500">CURRENT</span>
            <p className="text-sm font-bold text-emerald-400">{(c.current * 1000).toFixed(1)} mA</p>
          </div>

          <div className="p-2.5 bg-zinc-950/60 rounded-xl border border-white/[0.06]">
            <span className="text-[10px] text-zinc-500">POWER DISSIPATION</span>
            <p className="text-sm font-bold text-amber-400">
              {c.powerDissipated > 1
                ? `${c.powerDissipated.toFixed(2)} W`
                : `${(c.powerDissipated * 1000).toFixed(0)} mW`}
            </p>
          </div>

          <div className="p-2.5 bg-zinc-950/60 rounded-xl border border-white/[0.06]">
            <span className="text-[10px] text-zinc-500">TEMPERATURE</span>
            <p className={`text-sm font-bold ${isBurned ? 'text-rose-500' : isOverheating ? 'text-orange-400' : 'text-zinc-100'}`}>
              {c.temperature.toFixed(1)} °C
            </p>
          </div>
        </div>

        {/* Pin Assignments */}
        <div className="mt-2 pt-2 border-t border-white/[0.06]">
          <span className="text-[10px] font-mono text-zinc-500 mb-1.5 block">
            TERMINAL PIN CONNECTIONS:
          </span>
          <div className="flex flex-col gap-1 text-[11px] font-mono">
            {c.pins.map((pin, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-2.5 py-1 bg-zinc-950/40 rounded-lg border border-white/[0.04]"
              >
                <span className="text-zinc-400">{pin.name}</span>
                <span className="text-emerald-400 font-bold">
                  {pin.connectedHoleId || 'Floating'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
