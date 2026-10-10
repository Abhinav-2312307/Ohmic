'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Activity, Zap } from 'lucide-react';

interface OscilloscopeProps {
  channel1Voltage: number;
  channel2Voltage: number;
  isSimulating: boolean;
  onClose?: () => void;
}

export default function OscilloscopePanel({
  channel1Voltage,
  channel2Voltage,
  isSimulating,
  onClose,
}: OscilloscopeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [timebase, setTimebase] = useState<number>(2); // ms/div
  const [voltsPerDiv, setVoltsPerDiv] = useState<number>(2); // V/div

  // Waveform buffer
  const historyRef = useRef<{ ch1: number[]; ch2: number[] }>({ ch1: [], ch2: [] });
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const render = () => {
      animationId = requestAnimationFrame(render);

      if (isSimulating) {
        timeRef.current += 0.05;
        // Generate simulated trace with live circuit voltage + high-frequency ripple
        const val1 = channel1Voltage + Math.sin(timeRef.current * 8) * 0.15;
        const val2 = channel2Voltage + Math.cos(timeRef.current * 4) * 0.1;

        historyRef.current.ch1.push(val1);
        historyRef.current.ch2.push(val2);

        if (historyRef.current.ch1.length > 200) {
          historyRef.current.ch1.shift();
          historyRef.current.ch2.shift();
        }
      }

      const w = canvas.width;
      const h = canvas.height;

      // Dark Phosphor Scope Screen
      ctx.fillStyle = '#0a100d';
      ctx.fillRect(0, 0, w, h);

      // Grid Graticule (10 x 8 divisions)
      ctx.strokeStyle = '#1b3b22';
      ctx.lineWidth = 1;

      const numDivX = 10;
      const numDivY = 8;
      for (let i = 0; i <= numDivX; i++) {
        const x = (i / numDivX) * w;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let j = 0; j <= numDivY; j++) {
        const y = (j / numDivY) * h;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Center Reference Axes
      ctx.strokeStyle = '#2d6a4f';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w / 2, h);
      ctx.stroke();

      const midY = h / 2;
      const scaleY = (h / 8) / Math.max(0.5, voltsPerDiv);

      // Channel 1 Trace (Phosphor Yellow-Green)
      ctx.strokeStyle = '#e9d8a6';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#e9d8a6';
      ctx.shadowBlur = 6;
      ctx.beginPath();

      const data1 = historyRef.current.ch1;
      for (let i = 0; i < data1.length; i++) {
        const x = (i / 200) * w;
        const y = midY - data1[i] * scaleY;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Channel 2 Trace (Cyan)
      ctx.strokeStyle = '#94d2bd';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#94d2bd';
      ctx.shadowBlur = 4;
      ctx.beginPath();

      const data2 = historyRef.current.ch2;
      for (let i = 0; i < data2.length; i++) {
        const x = (i / 200) * w;
        const y = midY - data2[i] * scaleY;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    };

    render();

    return () => cancelAnimationFrame(animationId);
  }, [channel1Voltage, channel2Voltage, isSimulating, timebase, voltsPerDiv]);

  return (
    <div className="flex flex-col glass-panel rounded-2xl p-4 shadow-2xl w-full max-w-sm border border-white/[0.08] select-none animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <span className="font-mono text-xs font-bold text-zinc-100">
            RIGOL DSO-2000 SCOPE
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            50 MS/s LIVE
          </span>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
              title="Close"
            >
              <Zap className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Phosphor CRT Screen */}
      <div className="my-3 rounded-xl overflow-hidden border border-emerald-500/30 shadow-inner bg-zinc-950">
        <canvas ref={canvasRef} width={340} height={180} className="w-full h-auto block" />
      </div>

      {/* Live Readouts */}
      <div className="grid grid-cols-2 gap-2 text-xs font-mono my-1 bg-zinc-950/70 p-2.5 rounded-xl border border-white/[0.06]">
        <div className="flex flex-col">
          <span className="text-[10px] text-amber-300 font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 shadow-sm shadow-amber-400" /> CH1 (Vpp)
          </span>
          <span className="text-sm font-bold text-zinc-100 mt-0.5">
            {channel1Voltage.toFixed(2)} V
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-teal-300 font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-teal-400 shadow-sm shadow-teal-400" /> CH2 (Vpp)
          </span>
          <span className="text-sm font-bold text-zinc-100 mt-0.5">
            {channel2Voltage.toFixed(2)} V
          </span>
        </div>
      </div>

      {/* Dial Controls */}
      <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-white/[0.06]">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-mono text-zinc-400">VOLTS / DIV</label>
          <div className="flex items-center gap-1">
            {[1, 2, 5].map((v) => (
              <button
                key={v}
                onClick={() => setVoltsPerDiv(v)}
                className={`flex-1 py-1 text-[11px] font-mono rounded-lg font-bold transition-all ${
                  voltsPerDiv === v
                    ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20'
                    : 'bg-zinc-850 text-zinc-300 hover:bg-zinc-800 border border-white/[0.04]'
                }`}
              >
                {v}V
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-mono text-zinc-400">TIMEBASE</label>
          <div className="flex items-center gap-1">
            {[1, 2, 5].map((t) => (
              <button
                key={t}
                onClick={() => setTimebase(t)}
                className={`flex-1 py-1 text-[11px] font-mono rounded-lg font-bold transition-all ${
                  timebase === t
                    ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20'
                    : 'bg-zinc-850 text-zinc-300 hover:bg-zinc-800 border border-white/[0.04]'
                }`}
              >
                {t}ms
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
