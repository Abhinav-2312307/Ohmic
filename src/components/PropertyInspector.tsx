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
  onResetHealth?: (id: string) => void;
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
  onResetHealth,
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
                title="Rotate Counter-Clockwise 90° (Shift+R)"
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
                title="Rotate Clockwise 90° (R)"
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
        <div className="my-3 p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl flex flex-col gap-2.5 text-rose-300">
          <div className="flex items-center gap-2.5">
            <Flame className="w-5 h-5 text-rose-500 shrink-0 animate-bounce" />
            <div className="text-xs">
              <p className="font-bold">COMPONENT DESTROYED</p>
              <p className="text-[11px] text-rose-400">Thermal overload (P &gt; Pmax). Open-circuit failure.</p>
            </div>
          </div>
          {onResetHealth && (
            <button
              onClick={() => {
                audioEngine.playSnapSound();
                onResetHealth(c.id);
              }}
              className="w-full py-2 bg-rose-500 hover:bg-rose-400 text-zinc-950 rounded-lg text-xs font-mono font-bold transition-all shadow-md shadow-rose-500/20"
            >
              🔄 REPLACE WITH FRESH COMPONENT
            </button>
          )}
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

      {/* Toggle / Slide Switch Actuator */}
      {(c.type === 'SWITCH_TOGGLE' || c.type === 'SWITCH_SLIDE') && (
        <div className="my-3 p-3 bg-zinc-950/50 rounded-xl border border-white/[0.06]">
          <div className="flex items-center justify-between text-xs font-mono mb-2">
            <span className="text-zinc-400">SWITCH STATE:</span>
            <span className={`font-bold ${c.state?.isClosed ? 'text-emerald-400' : 'text-amber-400'}`}>
              {c.state?.isClosed ? 'CLOSED (ON)' : 'OPEN (OFF)'}
            </span>
          </div>
          <button
            onClick={() => {
              audioEngine.playSnapSound();
              onUpdateState(c.id, { isClosed: !c.state?.isClosed });
            }}
            className={`w-full py-2 rounded-lg font-mono font-bold text-xs transition-all ${
              c.state?.isClosed
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-white/[0.08]'
            }`}
          >
            {c.state?.isClosed ? 'TOGGLE TO OPEN' : 'TOGGLE TO CLOSE'}
          </button>
        </div>
      )}

      {/* SG90 Servo Positional Slider */}
      {c.type === 'SERVO_SG90' && (
        <div className="my-3 p-3 bg-zinc-950/50 rounded-xl border border-white/[0.06]">
          <div className="flex items-center justify-between text-xs font-mono mb-2">
            <span className="text-zinc-400">SERVO ANGLE:</span>
            <span className="text-amber-400 font-bold">{Math.round(c.state?.servoAngle ?? 90)}°</span>
          </div>
          <input
            type="range"
            min="0"
            max="180"
            step="1"
            value={c.state?.servoAngle ?? 90}
            onChange={(e) => onUpdateState(c.id, { servoAngle: parseFloat(e.target.value) })}
            className="w-full accent-amber-400 cursor-pointer"
          />
          <div className="flex justify-between mt-2 gap-1.5">
            {[0, 45, 90, 135, 180].map((deg) => (
              <button
                key={deg}
                onClick={() => {
                  audioEngine.playKnobClick();
                  onUpdateState(c.id, { servoAngle: deg });
                }}
                className="flex-1 py-1 text-[10px] font-mono bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded border border-white/[0.06]"
              >
                {deg}°
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 5V Relay Actuator Control */}
      {c.type === 'RELAY_MODULE_5V' && (
        <div className="my-3 p-3 bg-zinc-950/50 rounded-xl border border-white/[0.06]">
          <div className="flex items-center justify-between text-xs font-mono mb-2">
            <span className="text-zinc-400">COIL RELAY STATE:</span>
            <span className={`font-bold ${c.state?.relayEnergized ? 'text-emerald-400' : 'text-zinc-400'}`}>
              {c.state?.relayEnergized ? '⚡ ENERGIZED (COM ➔ NO)' : 'IDLE (COM ➔ NC)'}
            </span>
          </div>
          <button
            onClick={() => {
              audioEngine.playSnapSound();
              onUpdateState(c.id, { relayEnergized: !c.state?.relayEnergized });
            }}
            className={`w-full py-2 rounded-lg font-mono font-bold text-xs transition-all ${
              c.state?.relayEnergized
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-white/[0.08]'
            }`}
          >
            {c.state?.relayEnergized ? 'DE-ENERGIZE RELAY' : 'ENERGIZE RELAY COIL'}
          </button>
        </div>
      )}

      {/* DC Gear Motor Live Telemetry */}
      {c.type === 'DC_GEAR_MOTOR' && (
        <div className="my-3 p-3 bg-zinc-950/50 rounded-xl border border-white/[0.06]">
          <div className="flex items-center justify-between text-xs font-mono mb-2">
            <span className="text-zinc-400">MOTOR SPEED:</span>
            <span className="text-amber-400 font-bold">{Math.round(c.state?.motorRpm ?? 0)} RPM</span>
          </div>
          <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-amber-400 transition-all duration-200"
              style={{ width: `${Math.min(100, ((c.state?.motorRpm ?? 0) / 250) * 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
            <span>ROTATION DIRECTION:</span>
            <span className="font-bold text-zinc-200">{c.state?.motorDirection ?? 'STOP'}</span>
          </div>
        </div>
      )}

      {/* RGB LED Color Controls */}
      {c.type === 'LED_RGB' && (
        <div className="my-3 p-3 bg-zinc-950/50 rounded-xl border border-white/[0.06] flex flex-col gap-2.5">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-zinc-400">RGB COLOR MIXER:</span>
            <div
              className="w-5 h-5 rounded-full border border-white/20 shadow-md"
              style={{
                backgroundColor: `rgb(${c.state?.rgbColor?.[0] ?? 255}, ${c.state?.rgbColor?.[1] ?? 128}, ${c.state?.rgbColor?.[2] ?? 0})`,
              }}
            />
          </div>
          {(['Red', 'Green', 'Blue'] as const).map((color, idx) => (
            <div key={color} className="flex items-center gap-2 text-xs font-mono">
              <span className="w-12 text-zinc-400 text-[10px]">{color}:</span>
              <input
                type="range"
                min="0"
                max="255"
                step="1"
                value={c.state?.rgbColor?.[idx] ?? (idx === 0 ? 255 : idx === 1 ? 128 : 0)}
                onChange={(e) => {
                  const current = c.state?.rgbColor ?? [255, 128, 0];
                  const next: [number, number, number] = [...current];
                  next[idx] = parseInt(e.target.value);
                  onUpdateState(c.id, { rgbColor: next });
                }}
                className={`flex-1 accent-${idx === 0 ? 'rose' : idx === 1 ? 'emerald' : 'sky'}-400 cursor-pointer`}
              />
              <span className="w-8 text-right text-zinc-300 text-[10px]">
                {c.state?.rgbColor?.[idx] ?? (idx === 0 ? 255 : idx === 1 ? 128 : 0)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* HC-SR04 Ultrasonic Distance Sensor Slider */}
      {c.type === 'SENSOR_HC_SR04' && (
        <div className="my-3 p-3 bg-zinc-950/50 rounded-xl border border-white/[0.06]">
          <div className="flex items-center justify-between text-xs font-mono mb-2">
            <span className="text-zinc-400">TARGET OBSTACLE DISTANCE:</span>
            <span className="text-cyan-400 font-bold">{Math.round(c.state?.distanceCm ?? 25)} cm</span>
          </div>
          <input
            type="range"
            min="2"
            max="400"
            step="1"
            value={c.state?.distanceCm ?? 25}
            onChange={(e) => onUpdateState(c.id, { distanceCm: parseFloat(e.target.value) })}
            className="w-full accent-cyan-400 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] font-mono text-zinc-500 mt-1">
            <span>2 cm (Near)</span>
            <span>400 cm (Far)</span>
          </div>
        </div>
      )}

      {/* DHT22 Temp & Humidity Sensor Sliders */}
      {c.type === 'SENSOR_DHT22' && (
        <div className="my-3 p-3 bg-zinc-950/50 rounded-xl border border-white/[0.06] flex flex-col gap-2.5">
          <div>
            <div className="flex items-center justify-between text-xs font-mono mb-1.5">
              <span className="text-zinc-400">TEMPERATURE:</span>
              <span className="text-rose-400 font-bold">{(c.state?.temperatureC ?? 24).toFixed(1)} °C</span>
            </div>
            <input
              type="range"
              min="-20"
              max="60"
              step="0.5"
              value={c.state?.temperatureC ?? 24}
              onChange={(e) => onUpdateState(c.id, { temperatureC: parseFloat(e.target.value) })}
              className="w-full accent-rose-400 cursor-pointer"
            />
          </div>
          <div>
            <div className="flex items-center justify-between text-xs font-mono mb-1.5">
              <span className="text-zinc-400">RELATIVE HUMIDITY:</span>
              <span className="text-blue-400 font-bold">{Math.round(c.state?.humidityPct ?? 50)} %</span>
            </div>
            <input
              type="range"
              min="10"
              max="95"
              step="1"
              value={c.state?.humidityPct ?? 50}
              onChange={(e) => onUpdateState(c.id, { humidityPct: parseFloat(e.target.value) })}
              className="w-full accent-blue-400 cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* PIR Motion Sensor Trigger */}
      {c.type === 'SENSOR_PIR' && (
        <div className="my-3 p-3 bg-zinc-950/50 rounded-xl border border-white/[0.06]">
          <div className="flex items-center justify-between text-xs font-mono mb-2">
            <span className="text-zinc-400">PIR MOTION STATUS:</span>
            <span className={`font-bold ${c.state?.motionDetected ? 'text-amber-400 animate-pulse' : 'text-zinc-400'}`}>
              {c.state?.motionDetected ? '👀 MOTION DETECTED (3.3V HIGH)' : 'IDLE (0V LOW)'}
            </span>
          </div>
          <button
            onClick={() => {
              audioEngine.playSnapSound();
              onUpdateState(c.id, { motionDetected: !c.state?.motionDetected });
            }}
            className={`w-full py-2 rounded-lg font-mono font-bold text-xs transition-all ${
              c.state?.motionDetected
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-white/[0.08]'
            }`}
          >
            {c.state?.motionDetected ? 'RESET MOTION' : 'TRIGGER MOTION EVENT'}
          </button>
        </div>
      )}

      {/* Sound Sensor Module Slider */}
      {c.type === 'SENSOR_SOUND' && (
        <div className="my-3 p-3 bg-zinc-950/50 rounded-xl border border-white/[0.06]">
          <div className="flex items-center justify-between text-xs font-mono mb-2">
            <span className="text-zinc-400">AMBIENT NOISE LEVEL:</span>
            <span className="text-teal-400 font-bold">{Math.round(c.state?.soundLevel ?? 45)} dB</span>
          </div>
          <input
            type="range"
            min="30"
            max="100"
            step="1"
            value={c.state?.soundLevel ?? 45}
            onChange={(e) => onUpdateState(c.id, { soundLevel: parseFloat(e.target.value) })}
            className="w-full accent-teal-400 cursor-pointer"
          />
        </div>
      )}

      {/* Soil Moisture Sensor Slider */}
      {c.type === 'SENSOR_SOIL' && (
        <div className="my-3 p-3 bg-zinc-950/50 rounded-xl border border-white/[0.06]">
          <div className="flex items-center justify-between text-xs font-mono mb-2">
            <span className="text-zinc-400">SOIL MOISTURE LEVEL:</span>
            <span className="text-blue-400 font-bold">{Math.round(c.state?.moistureLevel ?? 60)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={c.state?.moistureLevel ?? 60}
            onChange={(e) => onUpdateState(c.id, { moistureLevel: parseFloat(e.target.value) })}
            className="w-full accent-blue-400 cursor-pointer"
          />
        </div>
      )}

      {/* Hall Effect Magnetic Sensor Toggle */}
      {c.type === 'SENSOR_HALL' && (
        <div className="my-3 p-3 bg-zinc-950/50 rounded-xl border border-white/[0.06]">
          <div className="flex items-center justify-between text-xs font-mono mb-2">
            <span className="text-zinc-400">MAGNET PROXIMITY:</span>
            <span className={`font-bold ${c.state?.magneticDetected ? 'text-red-400' : 'text-zinc-400'}`}>
              {c.state?.magneticDetected ? '🧲 FIELD DETECTED (LOW)' : 'NO FIELD (HIGH)'}
            </span>
          </div>
          <button
            onClick={() => {
              audioEngine.playSnapSound();
              onUpdateState(c.id, { magneticDetected: !c.state?.magneticDetected });
            }}
            className={`w-full py-2 rounded-lg font-mono font-bold text-xs transition-all ${
              c.state?.magneticDetected
                ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-white/[0.08]'
            }`}
          >
            {c.state?.magneticDetected ? 'REMOVE MAGNET' : 'APPLY MAGNET'}
          </button>
        </div>
      )}

      {/* KY-040 Rotary Encoder Controls */}
      {c.type === 'ROTARY_ENCODER_KY040' && (
        <div className="my-3 p-3 bg-zinc-950/50 rounded-xl border border-white/[0.06]">
          <div className="flex items-center justify-between text-xs font-mono mb-2">
            <span className="text-zinc-400">ENCODER POSITION:</span>
            <span className="text-teal-400 font-bold">{c.state?.encoderPosition ?? 0}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <button
              onClick={() => {
                audioEngine.playKnobClick();
                onUpdateState(c.id, { encoderPosition: (c.state?.encoderPosition ?? 0) - 1 });
              }}
              className="py-1.5 text-xs font-mono bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg border border-white/[0.08]"
            >
              ⟲ Step CCW (-1)
            </button>
            <button
              onClick={() => {
                audioEngine.playKnobClick();
                onUpdateState(c.id, { encoderPosition: (c.state?.encoderPosition ?? 0) + 1 });
              }}
              className="py-1.5 text-xs font-mono bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg border border-white/[0.08]"
            >
              ⟳ Step CW (+1)
            </button>
          </div>
        </div>
      )}

      {/* 4x4 Matrix Keypad Interactive Buttons */}
      {c.type === 'KEYPAD_4X4' && (
        <div className="my-3 p-3 bg-zinc-950/50 rounded-xl border border-white/[0.06]">
          <div className="flex items-center justify-between text-xs font-mono mb-2">
            <span className="text-zinc-400">PRESSED KEY:</span>
            <span className="text-amber-400 font-bold">{c.state?.keypadKey || 'None'}</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {['1', '2', '3', 'A', '4', '5', '6', 'B', '7', '8', '9', 'C', '*', '0', '#', 'D'].map((key) => (
              <button
                key={key}
                onMouseDown={() => {
                  audioEngine.playPopSound();
                  onUpdateState(c.id, { keypadKey: key });
                }}
                onMouseUp={() => {
                  onUpdateState(c.id, { keypadKey: undefined });
                }}
                className={`py-2 text-xs font-mono font-bold rounded-lg transition-all ${
                  c.state?.keypadKey === key
                    ? 'bg-amber-400 text-zinc-950'
                    : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800 border border-white/[0.06]'
                }`}
              >
                {key}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* OLED & LCD Screen Live Display Configuration */}
      {(c.type === 'DISPLAY_OLED_I2C' || c.type === 'DISPLAY_LCD_1602_I2C') && (
        <div className="my-3 p-3 bg-zinc-950/50 rounded-xl border border-white/[0.06] flex flex-col gap-2">
          <span className="text-[10px] font-mono text-zinc-400 block uppercase tracking-wider">
            {c.type === 'DISPLAY_OLED_I2C' ? '0.96" OLED SCREEN TEXT' : '16x2 LCD SCREEN TEXT'}:
          </span>
          <input
            type="text"
            placeholder="Line 1: Hello World"
            defaultValue={c.state?.oledLines?.[0] ?? c.state?.lcdLines?.[0] ?? 'Ohmic Lab v2.0'}
            onChange={(e) => {
              if (c.type === 'DISPLAY_OLED_I2C') {
                const lines = [...(c.state?.oledLines ?? ['Ohmic Lab v2.0', '128x64 OLED Ready'])];
                lines[0] = e.target.value;
                onUpdateState(c.id, { oledLines: lines });
              } else {
                const lines: [string, string] = [e.target.value, c.state?.lcdLines?.[1] ?? 'System Ready'];
                onUpdateState(c.id, { lcdLines: lines });
              }
            }}
            className="w-full bg-zinc-900 border border-white/[0.08] rounded-lg px-2.5 py-1 text-xs font-mono text-zinc-100 focus:outline-none focus:border-amber-400"
          />
          <input
            type="text"
            placeholder="Line 2: Ready..."
            defaultValue={c.state?.oledLines?.[1] ?? c.state?.lcdLines?.[1] ?? 'Circuit OK'}
            onChange={(e) => {
              if (c.type === 'DISPLAY_OLED_I2C') {
                const lines = [...(c.state?.oledLines ?? ['Ohmic Lab v2.0', '128x64 OLED Ready'])];
                lines[1] = e.target.value;
                onUpdateState(c.id, { oledLines: lines });
              } else {
                const lines: [string, string] = [c.state?.lcdLines?.[0] ?? 'Ohmic Lab v2.0', e.target.value];
                onUpdateState(c.id, { lcdLines: lines });
              }
            }}
            className="w-full bg-zinc-900 border border-white/[0.08] rounded-lg px-2.5 py-1 text-xs font-mono text-zinc-100 focus:outline-none focus:border-amber-400"
          />
        </div>
      )}

      {/* CD4017 Counter Output Display */}
      {c.type === 'DIP16_CD4017' && (
        <div className="my-3 p-3 bg-zinc-950/50 rounded-xl border border-white/[0.06]">
          <div className="flex items-center justify-between text-xs font-mono mb-2">
            <span className="text-zinc-400">ACTIVE OUTPUT PIN:</span>
            <span className="text-fuchsia-400 font-bold">Q{c.state?.counterIndex ?? 0}</span>
          </div>
          <div className="grid grid-cols-5 gap-1">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((idx) => (
              <div
                key={idx}
                className={`py-1 text-center font-mono text-[10px] rounded border ${
                  (c.state?.counterIndex ?? 0) === idx
                    ? 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/50 font-bold'
                    : 'bg-zinc-900 text-zinc-500 border-white/[0.04]'
                }`}
              >
                Q{idx}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Incandescent Bulb Live Glow Indicator */}
      {c.type === 'BULB_INCANDESCENT' && (
        <div className="my-3 p-3 bg-zinc-950/60 rounded-xl border border-white/[0.06] flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-zinc-400">FILAMENT STATE:</span>
            <span
              className={`font-bold flex items-center gap-1.5 ${
                (c as any).isEmitting
                  ? 'text-amber-400'
                  : isBurned
                  ? 'text-rose-500'
                  : 'text-zinc-500'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  (c as any).isEmitting
                    ? 'bg-amber-400 shadow-md shadow-amber-400/80 animate-pulse'
                    : isBurned
                    ? 'bg-rose-500'
                    : 'bg-zinc-600'
                }`}
              />
              {(c as any).isEmitting
                ? 'RADIATING'
                : isBurned
                ? 'BURNED OUT'
                : 'COLD (0% GLOW)'}
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
            <span>RELATIVE BRIGHTNESS:</span>
            <span className="text-zinc-100 font-bold">
              {Math.min(100, Math.round(((c as any).emissionIntensity ?? 0) * 50))}%
            </span>
          </div>

          <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-600 via-amber-400 to-yellow-200 transition-all duration-300"
              style={{
                width: `${Math.min(100, Math.round(((c as any).emissionIntensity ?? 0) * 50))}%`,
              }}
            />
          </div>
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
