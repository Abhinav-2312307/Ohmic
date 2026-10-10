'use client';

import React, { useEffect } from 'react';
import { MultimeterState } from '../engine/componentTypes';
import { audioEngine } from '../engine/audioEngine';
import { Activity, Zap, Volume2, X } from 'lucide-react';

interface MultimeterProps {
  state: MultimeterState;
  onModeChange: (mode: MultimeterState['mode']) => void;
  onSelectProbe: (probe: 'RED' | 'BLACK') => void;
  onClearProbes: () => void;
  activeProbe: 'RED' | 'BLACK' | null;
  onClose?: () => void;
}

export default function MultimeterPanel({
  state,
  onModeChange,
  onSelectProbe,
  onClearProbes,
  activeProbe,
  onClose,
}: MultimeterProps) {
  useEffect(() => {
    if (state.mode === 'CONTINUITY' && state.isContinuous) {
      audioEngine.setContinuityBeep(true);
    } else {
      audioEngine.setContinuityBeep(false);
    }
    return () => audioEngine.setContinuityBeep(false);
  }, [state.mode, state.isContinuous]);

  const formatReading = () => {
    if (!state.redProbeHoleId || !state.blackProbeHoleId) {
      return '---';
    }
    if (state.mode === 'CONTINUITY') {
      return state.isContinuous ? '0.04 Ω' : 'OL';
    }
    if (state.reading > 99999) {
      return 'O.L';
    }
    return state.reading.toFixed(3);
  };

  return (
    <div className="flex flex-col glass-panel rounded-2xl p-4 shadow-2xl w-full max-w-sm select-none border border-white/[0.08] animate-in fade-in duration-200">
      {/* Multimeter Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shadow-sm shadow-amber-400" />
          <span className="font-mono text-xs font-bold tracking-wider text-zinc-100">
            FLUKE DMM-8800
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono font-medium px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
            TRUE RMS • 20kHz
          </span>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* High-Contrast Segmented LCD Display */}
      <div className="my-3 bg-zinc-950/90 border border-white/[0.08] rounded-xl p-3.5 flex flex-col justify-between shadow-inner">
        <div className="flex items-center justify-between text-[10px] font-mono text-amber-400/80 mb-1">
          <span className="flex items-center gap-1">
            <Activity className="w-3 h-3 text-emerald-400" /> AUTO-RANGE
          </span>
          <span className="font-bold tracking-wider">{state.mode}</span>
        </div>

        {/* Large Digital Value */}
        <div className="flex items-baseline justify-between font-mono py-1">
          <span className="text-3xl font-extrabold text-amber-400 tracking-tight lcd-amber">
            {formatReading()}
          </span>
          <span className="text-base font-bold text-amber-500/80 ml-2 font-mono">
            {state.unit}
          </span>
        </div>

        {/* Bar Graph Scale */}
        <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden mt-2 border border-white/[0.06]">
          <div
            className="h-full bg-amber-400 transition-all duration-150 shadow-sm shadow-amber-400"
            style={{
              width: `${Math.min(100, Math.max(5, (Math.abs(state.reading) / 10) * 100))}%`,
            }}
          />
        </div>
      </div>

      {/* Mode Rotary Selector Buttons */}
      <div className="grid grid-cols-4 gap-1.5 my-2">
        {[
          { mode: 'VOLTS_DC', label: 'V ⎓' },
          { mode: 'VOLTS_AC', label: 'V ~' },
          { mode: 'RESISTANCE', label: 'Ω' },
          { mode: 'CONTINUITY', label: '🔊 BEEP' },
        ].map((m) => (
          <button
            key={m.mode}
            onClick={() => {
              audioEngine.playKnobClick();
              onModeChange(m.mode as MultimeterState['mode']);
            }}
            className={`py-2 px-1 rounded-xl text-xs font-mono font-bold transition-all ${
              state.mode === m.mode
                ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                : 'bg-zinc-850 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 border border-white/[0.04]'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Probe Lead Controls */}
      <div className="mt-2 pt-3 border-t border-white/[0.06] flex flex-col gap-2">
        <div className="text-[10px] font-mono text-zinc-400 flex items-center justify-between">
          <span>TEST PROBE LEADS:</span>
          <button
            onClick={() => {
              audioEngine.playPopSound();
              onClearProbes();
            }}
            className="text-[10px] text-zinc-500 hover:text-zinc-300 underline cursor-pointer"
          >
            Unplug Both
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* Red Positive Probe */}
          <button
            onClick={() => {
              audioEngine.playKnobClick();
              onSelectProbe('RED');
            }}
            className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-mono transition-all ${
              activeProbe === 'RED'
                ? 'bg-red-500/20 border-red-500 text-red-300 ring-2 ring-red-500/30 shadow-md'
                : 'bg-zinc-900/80 border-white/[0.06] text-zinc-300 hover:border-red-500/50'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 shadow-sm shadow-red-500" />
              <span>RED (+)</span>
            </div>
            <span className="text-[10px] text-zinc-400 font-bold">
              {state.redProbeHoleId || 'Click Pin'}
            </span>
          </button>

          {/* Black Negative Probe */}
          <button
            onClick={() => {
              audioEngine.playKnobClick();
              onSelectProbe('BLACK');
            }}
            className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-mono transition-all ${
              activeProbe === 'BLACK'
                ? 'bg-zinc-600/20 border-zinc-400 text-zinc-200 ring-2 ring-zinc-400/30 shadow-md'
                : 'bg-zinc-900/80 border-white/[0.06] text-zinc-300 hover:border-zinc-500/50'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-zinc-700 border border-zinc-500" />
              <span>BLK (COM)</span>
            </div>
            <span className="text-[10px] text-zinc-400 font-bold">
              {state.blackProbeHoleId || 'Click Pin'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
