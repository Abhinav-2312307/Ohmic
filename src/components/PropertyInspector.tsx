'use client';

import React from 'react';
import { CircuitComponent } from '../engine/componentTypes';
import { Flame, AlertTriangle, Trash2, Cpu, Zap, Activity } from 'lucide-react';

interface PropertyInspectorProps {
  selectedComponent: CircuitComponent | null;
  onUpdateValue: (id: string, newValue: number) => void;
  onUpdateState: (id: string, newState: Partial<CircuitComponent['state']>) => void;
  onDeleteComponent: (id: string) => void;
}

export default function PropertyInspector({
  selectedComponent,
  onUpdateValue,
  onUpdateState,
  onDeleteComponent,
}: PropertyInspectorProps) {
  if (!selectedComponent) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center select-none bg-slate-900 border-l border-slate-800 w-80 text-slate-500">
        <Activity className="w-8 h-8 mb-3 opacity-30 text-amber-500" />
        <p className="text-xs font-mono uppercase tracking-wider">No Component Selected</p>
        <p className="text-[11px] text-slate-600 mt-1 max-w-[200px]">
          Click any component on the workbench to inspect live voltages, currents, and temperatures.
        </p>
      </div>
    );
  }

  const c = selectedComponent;
  const isBurned = c.health === 'BURNED_OUT';
  const isOverheating = c.health === 'OVERHEATING';

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-800 w-80 p-4 select-none overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between pb-3 border-b border-slate-800">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase text-amber-400 tracking-wider">
            {c.type}
          </span>
          <h2 className="text-sm font-bold text-slate-100">{c.name}</h2>
        </div>

        <button
          onClick={() => onDeleteComponent(c.id)}
          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-all"
          title="Delete Component"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Burnout Warning Banner */}
      {isBurned && (
        <div className="my-3 p-3 bg-rose-950/40 border border-rose-600/50 rounded-lg flex items-center gap-2.5 text-rose-300">
          <Flame className="w-5 h-5 text-rose-500 shrink-0 animate-bounce" />
          <div className="text-xs">
            <p className="font-bold">COMPONENT BURNED OUT!</p>
            <p className="text-[10px] opacity-80">
              Exceeded maximum thermal limits ({c.maxPowerRating || 0.25}W). Disconnected into an open circuit.
            </p>
          </div>
        </div>
      )}

      {isOverheating && (
        <div className="my-3 p-2.5 bg-amber-950/40 border border-amber-600/50 rounded-lg flex items-center gap-2 text-amber-300">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="text-xs font-semibold">Thermal Stress Warning (&gt;90°C)</span>
        </div>
      )}

      {/* Primary Value Adjustment */}
      <div className="my-4 flex flex-col gap-2">
        <label className="text-xs font-mono font-semibold text-slate-300">
          RATED VALUE ({c.unit}):
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={c.value}
            onChange={(e) => onUpdateValue(c.id, parseFloat(e.target.value) || 0)}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm font-mono text-emerald-400 focus:outline-none focus:border-amber-500"
          />
          <span className="text-xs font-mono font-bold text-slate-400 px-2 py-1.5 bg-slate-800 rounded">
            {c.unit}
          </span>
        </div>
      </div>

      {/* Interactive Controls (e.g. Potentiometer / Switch) */}
      {c.type === 'POTENTIOMETER' && (
        <div className="my-3 p-3 bg-slate-950/60 border border-slate-800 rounded-lg flex flex-col gap-2">
          <div className="flex justify-between text-xs font-mono text-slate-300">
            <span>WIPER RATIO:</span>
            <span className="font-bold text-cyan-400">
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
            className="w-full accent-cyan-400 cursor-pointer"
          />
        </div>
      )}

      {c.type === 'SWITCH_TACTILE' && (
        <div className="my-3 flex flex-col gap-2">
          <button
            onMouseDown={() => onUpdateState(c.id, { isClosed: true })}
            onMouseUp={() => onUpdateState(c.id, { isClosed: false })}
            className={`w-full py-2.5 rounded-lg font-mono font-bold text-xs transition-all ${
              c.state?.isClosed
                ? 'bg-emerald-500 text-slate-950 shadow-lg'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {c.state?.isClosed ? 'PRESSED (CLOSED 0.00Ω)' : 'PRESS TO ACTUATE'}
          </button>
        </div>
      )}

      {/* Live Electrical Telemetry */}
      <div className="mt-2 border-t border-slate-800 pt-3 flex flex-col gap-2.5">
        <span className="text-[10px] font-mono font-bold uppercase text-slate-400 tracking-wider">
          LIVE OPERATING METRICS
        </span>

        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="p-2.5 bg-slate-950/80 rounded-lg border border-slate-800">
            <span className="text-[10px] text-slate-500">VOLTAGE DROP</span>
            <p className="text-sm font-bold text-slate-100">
              {c.voltageDrop.toFixed(2)} V
            </p>
          </div>

          <div className="p-2.5 bg-slate-950/80 rounded-lg border border-slate-800">
            <span className="text-[10px] text-slate-500">CURRENT</span>
            <p className="text-sm font-bold text-emerald-400">
              {(c.current * 1000).toFixed(1)} mA
            </p>
          </div>

          <div className="p-2.5 bg-slate-950/80 rounded-lg border border-slate-800">
            <span className="text-[10px] text-slate-500">POWER DISSIPATION</span>
            <p className="text-sm font-bold text-amber-400">
              {c.powerDissipated > 1
                ? `${c.powerDissipated.toFixed(2)} W`
                : `${(c.powerDissipated * 1000).toFixed(0)} mW`}
            </p>
          </div>

          <div className="p-2.5 bg-slate-950/80 rounded-lg border border-slate-800">
            <span className="text-[10px] text-slate-500">TEMPERATURE</span>
            <p
              className={`text-sm font-bold ${
                isBurned
                  ? 'text-rose-500'
                  : isOverheating
                  ? 'text-orange-400'
                  : 'text-slate-100'
              }`}
            >
              {c.temperature.toFixed(1)} °C
            </p>
          </div>
        </div>

        {/* Pin Connections */}
        <div className="mt-2 pt-2 border-t border-slate-800/60">
          <span className="text-[10px] font-mono text-slate-500 mb-1.5 block">
            TERMINAL PIN ASSIGNMENTS:
          </span>
          <div className="flex flex-col gap-1 text-[11px] font-mono">
            {c.pins.map((pin, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-2.5 py-1 bg-slate-950/40 rounded border border-slate-800/60"
              >
                <span className="text-slate-400">{pin.name}</span>
                <span className="text-emerald-400 font-bold">
                  {pin.connectedHoleId || 'Floating'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
