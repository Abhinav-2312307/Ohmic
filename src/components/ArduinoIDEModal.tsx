'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Cpu,
  Check,
  Upload,
  RotateCcw,
  Terminal,
  Play,
  Pause,
  X,
  Music,
  Code2,
  FileCode,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Send,
  Zap,
} from 'lucide-react';
import { CircuitComponent } from '../engine/componentTypes';
import {
  ARDUINO_TEMPLATES,
  getArduinoVM,
  SketchTemplate,
} from '../engine/arduinoRuntime';
import { audioEngine } from '../engine/audioEngine';

interface ArduinoIDEModalProps {
  isOpen: boolean;
  onClose: () => void;
  mcuComponent: CircuitComponent | null;
  onUpdateComponentState: (id: string, newState: Partial<CircuitComponent['state']>) => void;
}

export default function ArduinoIDEModal({
  isOpen,
  onClose,
  mcuComponent,
  onUpdateComponentState,
}: ArduinoIDEModalProps) {
  const [code, setCode] = useState<string>('');
  const [compileStatus, setCompileStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [compileMessage, setCompileMessage] = useState<string>('');
  const [isSerialOpen, setIsSerialOpen] = useState<boolean>(true);
  const [serialInput, setSerialInput] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('happy_birthday');

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const terminalLogsRef = useRef<HTMLDivElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  // Initialize sketch code when component changes or opens
  useEffect(() => {
    if (!mcuComponent) return;
    const existingCode = mcuComponent.state?.arduinoState?.sourceCode;
    if (existingCode && existingCode.trim()) {
      setCode(existingCode);
    } else {
      const defaultCode = ARDUINO_TEMPLATES[0].code;
      setCode(defaultCode);
    }
    setCompileStatus('idle');
    setCompileMessage('');
  }, [mcuComponent?.id, isOpen]);

  // Auto-scroll serial output inside its dedicated container (without shifting parent layout)
  useEffect(() => {
    if (isSerialOpen && terminalLogsRef.current) {
      terminalLogsRef.current.scrollTop = terminalLogsRef.current.scrollHeight;
    }
  }, [mcuComponent?.state?.arduinoState?.serialBuffer, isSerialOpen]);

  if (!isOpen || !mcuComponent) return null;

  const mcuId = mcuComponent.id;
  const vm = getArduinoVM(mcuId, code);
  const arduinoState = mcuComponent.state?.arduinoState || vm.getState();

  const handleVerify = () => {
    audioEngine.playKnobClick();
    const success = vm.loadCode(code);
    if (success) {
      setCompileStatus('success');
      setCompileMessage('Sketch compiled successfully! Zero errors.');
    } else {
      setCompileStatus('error');
      setCompileMessage(vm.compileError || 'Syntax compilation error');
    }
  };

  const handleUpload = () => {
    audioEngine.playSnapSound();
    const success = vm.loadCode(code);
    if (success) {
      setCompileStatus('success');
      setCompileMessage('Flashing firmware: Binary verified and uploaded to board!');
      onUpdateComponentState(mcuId, {
        arduinoState: vm.getState(),
      });
    } else {
      setCompileStatus('error');
      setCompileMessage(vm.compileError || 'Upload failed due to compilation errors');
    }
  };

  const handleReset = () => {
    audioEngine.playKnobClick();
    vm.reset();
    onUpdateComponentState(mcuId, {
      arduinoState: vm.getState(),
    });
  };

  const handleSelectTemplate = (templateId: string) => {
    audioEngine.playKnobClick();
    const tmpl = ARDUINO_TEMPLATES.find((t) => t.id === templateId);
    if (tmpl) {
      setSelectedTemplateId(templateId);
      setCode(tmpl.code);
      setCompileStatus('idle');
      setCompileMessage('');
    }
  };

  const handleSendSerial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serialInput.trim()) return;
    vm.sendSerialInput(serialInput);
    setSerialInput('');
  };

  const handleClearSerial = () => {
    audioEngine.playPopSound();
    vm.clearSerial();
    onUpdateComponentState(mcuId, {
      arduinoState: vm.getState(),
    });
  };

  // Handle Tab key in textarea
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const newCode = code.substring(0, start) + '  ' + code.substring(end);
      setCode(newCode);
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      }, 0);
    }
  };

  const lineCount = code.split('\n').length;
  const activeTone = arduinoState.activeToneFreq ?? 0;
  const isPin13High = Boolean(arduinoState.pins?.['13']?.digitalValue || arduinoState.pins?.['D13']?.digitalValue);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="flex flex-col w-full max-w-5xl h-[88vh] bg-zinc-950/95 border border-teal-500/30 rounded-2xl shadow-2xl shadow-teal-950/40 overflow-hidden">
        
        {/* ── IDE Header ────────────────────────────────────────────────────────── */}
        <header className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-zinc-900 border-b border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-teal-500/15 border border-teal-500/40 text-teal-400 shadow-sm shadow-teal-500/20">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold font-mono text-zinc-100 tracking-wide">
                  Arduino IDE 2.0 • {mcuComponent.name || 'Arduino Nano V3'}
                </h1>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-teal-500/20 text-teal-300 border border-teal-500/40 rounded-full">
                  ATmega328P
                </span>
                {activeTone > 0 && (
                  <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-bold bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/40 rounded-full animate-pulse">
                    <Music className="w-3 h-3" />
                    <span>{activeTone} Hz</span>
                  </span>
                )}
                {isPin13High && (
                  <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full">
                    <Zap className="w-3 h-3" />
                    <span>D13 HIGH</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] font-mono text-zinc-400">
                Component Designator: <span className="text-teal-400 font-bold">{mcuComponent.id}</span> • Interactive C++ Firmware Engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.08] rounded-xl transition-all"
              title="Close IDE (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* ── IDE Action Toolbar ─────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 bg-zinc-900/60 border-b border-white/[0.06]">
          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleVerify}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-teal-300 hover:text-teal-200 border border-teal-500/30 rounded-xl text-xs font-mono font-semibold transition-all shadow-sm active:scale-95"
              title="Verify / Compile C++ Sketch"
            >
              <Check className="w-4 h-4 text-teal-400" />
              <span>Verify</span>
            </button>

            <button
              onClick={handleUpload}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-teal-600 hover:bg-teal-500 text-zinc-950 font-bold rounded-xl text-xs font-mono transition-all shadow-md shadow-teal-600/30 active:scale-95"
              title="Upload / Flash Sketch into Virtual Arduino"
            >
              <Upload className="w-4 h-4 fill-current" />
              <span>Upload & Run</span>
            </button>

            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-mono transition-all border border-white/[0.08]"
              title="Restart sketch execution from setup()"
            >
              <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
              <span>Reset MCU</span>
            </button>
          </div>

          {/* Template Picker & Serial Monitor Toggle */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-400">
              <FileCode className="w-3.5 h-3.5 text-zinc-500" />
              <span>Sketch:</span>
              <select
                value={selectedTemplateId}
                onChange={(e) => handleSelectTemplate(e.target.value)}
                className="bg-zinc-900 border border-white/[0.1] rounded-xl px-2.5 py-1 text-xs font-mono text-zinc-200 focus:outline-none focus:border-teal-500"
              >
                {ARDUINO_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setIsSerialOpen(!isSerialOpen)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-mono font-bold transition-all border ${
                isSerialOpen
                  ? 'bg-teal-500/20 text-teal-300 border-teal-500/40 shadow-sm'
                  : 'bg-zinc-900 text-zinc-400 border-white/[0.08] hover:text-zinc-200'
              }`}
              title="Toggle Serial Monitor (9600 baud)"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Serial Monitor</span>
            </button>
          </div>
        </div>

        {/* ── Compilation Status Toast ───────────────────────────────────────────── */}
        {compileStatus !== 'idle' && (
          <div
            className={`flex items-center justify-between px-5 py-2 text-xs font-mono border-b ${
              compileStatus === 'success'
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-300 border-rose-500/20'
            }`}
          >
            <div className="flex items-center gap-2">
              {compileStatus === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400" />
              )}
              <span>{compileMessage}</span>
            </div>
            <button
              onClick={() => setCompileStatus('idle')}
              className="text-zinc-400 hover:text-zinc-200 text-xs"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ── Center Area: Code Editor + Serial Monitor ──────────────────────────── */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
          
          {/* Code Editor with Line Numbers */}
          <div className="flex-1 flex min-h-0 bg-zinc-950 overflow-hidden">
            {/* Line Numbers Column */}
            <div
              ref={lineNumbersRef}
              className="w-12 py-3 px-1 select-none text-right font-mono text-xs text-zinc-600 bg-zinc-950/80 border-r border-white/[0.04] leading-5 overflow-hidden"
            >
              {Array.from({ length: lineCount }).map((_, i) => (
                <div key={i} className="px-1 h-5 leading-5">
                  {i + 1}
                </div>
              ))}
            </div>

            {/* Code Textarea */}
            <textarea
              ref={textareaRef}
              value={code}
              onScroll={(e) => {
                if (lineNumbersRef.current) {
                  lineNumbersRef.current.scrollTop = e.currentTarget.scrollTop;
                }
              }}
              onChange={(e) => {
                setCode(e.target.value);
                setCompileStatus('idle');
              }}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              className="flex-1 p-3 font-mono text-xs text-zinc-100 bg-transparent resize-none focus:outline-none leading-5 selection:bg-teal-500/30 overflow-y-auto whitespace-pre"
              placeholder="// Write your Arduino C++ sketch here..."
            />
          </div>

          {/* ── Slide-up Serial Monitor Terminal ──────────────────────────────────── */}
          {isSerialOpen && (
            <div className="h-44 flex flex-col bg-zinc-950 border-t border-white/[0.08] shadow-inner">
              <div className="flex items-center justify-between px-4 py-1.5 bg-zinc-900/80 border-b border-white/[0.06] text-xs font-mono">
                <div className="flex items-center gap-2 text-zinc-300 font-bold">
                  <Terminal className="w-3.5 h-3.5 text-teal-400" />
                  <span>COM3 • 9600 baud • Serial Terminal</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleClearSerial}
                    className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear</span>
                  </button>
                </div>
              </div>

              {/* Terminal Logs */}
              <div
                ref={terminalLogsRef}
                className="flex-1 p-3 overflow-y-auto font-mono text-xs space-y-0.5 text-emerald-400/90 select-text"
              >
                {arduinoState.serialBuffer && arduinoState.serialBuffer.length > 0 ? (
                  arduinoState.serialBuffer.map((line, i) => (
                    <div key={i} className="leading-snug">
                      {line}
                    </div>
                  ))
                ) : (
                  <div className="text-zinc-600 italic">No serial communication active. Call Serial.begin(9600) and Serial.println() to print.</div>
                )}
              </div>

              {/* Terminal Send Input */}
              <form onSubmit={handleSendSerial} className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border-t border-white/[0.06]">
                <input
                  type="text"
                  value={serialInput}
                  onChange={(e) => setSerialInput(e.target.value)}
                  placeholder="Send data to Serial.read()..."
                  className="flex-1 bg-zinc-950 border border-white/[0.08] rounded-lg px-2.5 py-1 text-xs font-mono text-zinc-100 focus:outline-none focus:border-teal-500"
                />
                <button
                  type="submit"
                  className="px-3 py-1 bg-teal-600 hover:bg-teal-500 text-zinc-950 font-bold rounded-lg text-xs font-mono transition-all flex items-center gap-1"
                >
                  <Send className="w-3 h-3" />
                  <span>Send</span>
                </button>
              </form>
            </div>
          )}
        </div>

        {/* ── Bottom Live GPIO Pin Inspector ───────────────────────────────────── */}
        <footer className="px-5 py-2.5 bg-zinc-900/90 border-t border-white/[0.08] flex items-center justify-between text-xs font-mono overflow-x-auto gap-4">
          <div className="flex items-center gap-2 shrink-0 text-zinc-400 font-bold">
            <span>GPIO PINS:</span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            {['D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12', 'D13', 'A0', 'A1', 'A2'].map((pinName) => {
              const p = arduinoState.pins?.[pinName];
              const isOut = p?.mode === 'OUTPUT';
              const isHigh = Boolean(p?.digitalValue || (p?.toneFreq ?? 0) > 0);
              const toneF = p?.toneFreq ?? 0;

              return (
                <div
                  key={pinName}
                  className={`px-2 py-0.5 rounded-lg border text-[10px] font-mono flex items-center gap-1 shrink-0 ${
                    toneF > 0
                      ? 'bg-fuchsia-500/20 border-fuchsia-500/50 text-fuchsia-300 font-bold'
                      : isHigh
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-bold'
                      : 'bg-zinc-950 border-white/[0.06] text-zinc-400'
                  }`}
                  title={`${pinName}: ${p?.mode || 'INPUT'} | ${isHigh ? 'HIGH (5V)' : 'LOW (0V)'} ${toneF ? `| Tone: ${toneF}Hz` : ''}`}
                >
                  <span>{pinName}</span>
                  {toneF > 0 ? (
                    <span className="text-[9px] text-fuchsia-400">{toneF}Hz</span>
                  ) : isOut ? (
                    <span className={`w-1.5 h-1.5 rounded-full ${isHigh ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="text-[11px] text-zinc-500 shrink-0">
            Running time: <span className="text-zinc-300 font-bold">{(arduinoState.virtualMillis || 0) / 1000}s</span>
          </div>
        </footer>

      </div>
    </div>
  );
}
