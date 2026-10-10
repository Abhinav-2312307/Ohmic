'use client';

import React, { useEffect } from 'react';
import { MultimeterState } from '../engine/componentTypes';
import { audioEngine } from '../engine/audioEngine';
import { Activity, Volume2, VolumeX } from 'lucide-react';

interface MultimeterProps {
  state: MultimeterState;
  onModeChange: (mode: MultimeterState['mode']) => void;
  onSelectProbe: (probe: 'RED' | 'BLACK') => void;
  onClearProbes: () => void;
  activeProbe: 'RED' | 'BLACK' | null;
}

export default function MultimeterPanel({
  state,
  onModeChange,
  onSelectProbe,
  onClearProbes,
  activeProbe,
}: MultimeterProps) {
  // Trigger audio continuity buzzer when continuous in continuity mode
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
    <div className="flex flex-col bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-2xl w-full max-w-sm">
      {/* Multimeter Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
          <span className="font-mono text-xs font-bold tracking-wider text-slate-200">
            PRECISION DMM-8800
          </span>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
          TRUE RMS
        </span>
      </div>

      {/* LCD Display */}
      <div className="my-3 bg-emerald-950/30 border-2 border-emerald-900/60 rounded-lg p-3.5 flex flex-col justify-between shadow-inner">
        <div className="flex items-center justify-between text-[11px] font-mono text-emerald-400/80 mb-1">
          <span className="flex items-center gap-1">
            <Activity className="w-3 h-3" /> AUTO RANGE
          </span>
          <span className="font-bold">{state.mode}</span>
        </div>

        {/* Large Digital Value */}
        <div className="flex items-baseline justify-between font-mono py-1">
          <span className="text-3xl font-extrabold text-emerald-400 tracking-tight">
            {formatReading()}
          </span>
          <span className="text-lg font-bold text-emerald-500 ml-2">
            {state.unit}
          </span>
        </div>

        {/* Bar Graph Scale */}
        <div className="w-full bg-emerald-950/80 h-1.5 rounded-full overflow-hidden mt-2 border border-emerald-900/40">
          <div
            className="h-full bg-emerald-400 transition-all duration-150"
            style={{
              width: `${Math.min(100, Math.max(5, (Math.abs(state.reading) / 10) * 100))}%`,
            }}
          />
        </div>
      </div>

      {/* Mode Rotary Selector Buttons */}
      <div className="grid grid-cols-4 gap-1.5 my-2">
        <button
          onClick={() => onModeChange('VOLTS_DC')}
          className={`py-1.5 px-2 rounded text-xs font-mono font-bold transition-all ${
            state.mode === 'VOLTS_DC'
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          V ⎓
        </button>
        <button
          onClick={() => onModeChange('VOLTS_AC')}
          className={`py-1.5 px-2 rounded text-xs font-mono font-bold transition-all ${
            state.mode === 'VOLTS_AC'
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          V ~
        </button>
        <button
          onClick={() => onModeChange('RESISTANCE')}
          className={`py-1.5 px-2 rounded text-xs font-mono font-bold transition-all ${
            state.mode === 'RESISTANCE'
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          Ω
        </button>
        <button
          onClick={() => onModeChange('CONTINUITY')}
          className={`py-1.5 px-2 rounded text-xs font-mono font-bold transition-all ${
            state.mode === 'CONTINUITY'
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          🔊 BEEP
        </button>
      </div>

      {/* Probe Lead Controls */}
      <div className="mt-3 pt-3 border-t border-slate-800 flex flex-col gap-2">
        <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
          <span>PROBE CONNECTIONS:</span>
          <button
            onClick={onClearProbes}
            className="text-[10px] text-slate-500 hover:text-slate-300 underline"
          >
            Clear Both
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* Red Positive Probe */}
          <button
            onClick={() => onSelectProbe('RED')}
            className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-mono transition-all ${
              activeProbe === 'RED'
                ? 'bg-red-500/20 border-red-500 text-red-300 ring-2 ring-red-500/30'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:border-red-500/50'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span>RED (+)</span>
            </div>
            <span className="text-[10px] text-slate-400">
              {state.redProbeHoleId || 'Unset'}
            </span>
          </button>

          {/* Black Negative Probe */}
          <button
            onClick={() => onSelectProbe('BLACK')}
            className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-mono transition-all ${
              activeProbe === 'BLACK'
                ? 'bg-slate-500/20 border-slate-400 text-slate-200 ring-2 ring-slate-400/30'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:border-slate-400/50'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-500" />
              <span>BLK (COM)</span>
            </div>
            <span className="text-[10px] text-slate-400">
              {state.blackProbeHoleId || 'Unset'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
