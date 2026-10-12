'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play,
  RotateCcw,
  RefreshCw,
  FileDown,
  FileUp,
  FileCode,
  Code2,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  X,
  ChevronDown,
  ChevronUp,
  Copy,
  Sparkles,
  Maximize2,
  Minimize2,
  HelpCircle,
  BookOpen,
} from 'lucide-react';
import {
  buildCircuitFromOhmScript,
  buildOhmScriptFromCircuit,
  parse,
  exportCircuitToJSON,
  importCircuitFromJSON,
  downloadFile,
  DiagnosticMessage,
  CompiledCircuit,
} from '../dsl';
import { CircuitComponent, JumperWire } from '../engine/componentTypes';
import { audioEngine } from '../engine/audioEngine';

interface CodeEditorProps {
  isOpen: boolean;
  onClose: () => void;
  components: CircuitComponent[];
  wires: JumperWire[];
  onApplyCompiledCircuit: (compiled: CompiledCircuit) => void;
  ambientTemperature: number;
  isSimulating: boolean;
}

// ── Built-in Starter Templates ────────────────────────────────────────────────
const TEMPLATES: { name: string; desc: string; code: string }[] = [
  {
    name: '1. Basic LED Circuit',
    desc: '9V Battery → 470Ω Resistor → Red LED',
    code: `# ── Basic LED Circuit ─────────────────────────────────
@circuit "Basic LED Circuit"
@description "9V Alkaline Battery feeds 470Ω current limiter and 5mm Red LED"
@author "Ohmic Workbench"
@version "1.0"

# Components
bat  BAT1  9V
res  R1    470    maxP=0.25W
led  LED1  red    Vf=1.9V

# Breadboard Placements
place BAT1 bench
place R1   E15-E19
place LED1 D19-D20

# Wiring
wire BAT1.pos -> TOP_POS_10   red
wire BAT1.neg -> TOP_NEG_10   black
wire TOP_POS_10 -> A15        red
wire A20 -> TOP_NEG_20        blue

# Simulation & Probing
@temp 25
@sim on
probe red   TOP_POS_10
probe black TOP_NEG_10
@probe_mode VOLTS_DC
`,
  },
  {
    name: '2. Potentiometer Dimmer',
    desc: '10kΩ Potentiometer wiper controlling incandescent bulb',
    code: `# ── Variable Dimmer Lamp ──────────────────────────────
@circuit "Variable Dimmer Lamp"
@description "10kΩ Potentiometer controls bulb brightness via variable resistance"
@author "Ohmic Workbench"
@version "1.0"

# Components
bat  BAT1  9V
pot  POT1  10k    wiper=0.5
bulb BULB1 25     maxP=5W

# Placements
place BAT1  bench
place POT1  E10:E11:E12
place BULB1 D15-D19

# Wiring
wire BAT1.pos -> TOP_POS_10   red
wire BAT1.neg -> TOP_NEG_10   black
wire TOP_POS_10 -> A10        red
wire A11 -> A15               amber
wire A19 -> TOP_NEG_19        black

# Interactive State
set POT1.wiper 0.65

@temp 25
@sim on
`,
  },
  {
    name: '3. Speaker Tone Generator',
    desc: '8Ω Bench Speaker driven by audio oscillator',
    code: `# ── Audio Tone Generator ──────────────────────────────
@circuit "Audio Tone Generator & 8Ω Speaker"
@description "Frequency generator driving a breadboard 8Ω speaker"
@author "Ohmic Workbench"
@version "1.0"

# Components
bat  BAT1  9V
res  R1    100    maxP=2W
spk  SPK1  8      maxP=15W

# Placements
place BAT1 bench
place R1   E12-E16
place SPK1 D16-D20

# Wiring
wire BAT1.pos -> TOP_POS_10   red
wire BAT1.neg -> TOP_NEG_10   black
wire TOP_POS_10 -> A12        red
wire A20 -> TOP_NEG_20        blue

# Speaker Frequency
set SPK1.frequency 440

@temp 25
@sim on
`,
  },
  {
    name: '4. Thermal Overload Demo',
    desc: 'Low resistance 22Ω across 9V demonstrating smoke and burnout',
    code: `# ── Thermal Overload & Burnout Demo ──────────────────
@circuit "Thermal Overload & Burnout Demo"
@description "22Ω 1/4W resistor across 9V rails experiences severe thermal stress"
@author "Ohmic Workbench"
@version "1.0"

# Components
bat  BAT1  9V
res  R1    22     maxP=0.25W

# Placements
place BAT1 bench
place R1   E15-E19

# Wiring
wire BAT1.pos -> TOP_POS_10   red
wire BAT1.neg -> TOP_NEG_10   black
wire TOP_POS_10 -> A15        red
wire A19 -> TOP_NEG_19        black

@temp 25
@sim on
`,
  },
  {
    name: '5. Voltage Divider',
    desc: 'Two 10kΩ resistors dividing 9V to 4.5V with center tap probe',
    code: `# ── Precision Voltage Divider ─────────────────────────
@circuit "Voltage Divider"
@description "Two matched 10kΩ resistors splitting 9V in half"
@author "Ohmic Workbench"
@version "1.0"

# Components
bat  BAT1  9V
res  R1    10k    maxP=0.25W
res  R2    10k    maxP=0.25W

# Placements
place BAT1 bench
place R1   E10-E14
place R2   D14-D18

# Wiring
wire BAT1.pos -> TOP_POS_10   red
wire BAT1.neg -> TOP_NEG_10   black
wire TOP_POS_10 -> A10        red
wire A18 -> TOP_NEG_18        black

# Probe center node (column 14)
probe red   A14
probe black TOP_NEG_18
@probe_mode VOLTS_DC

@temp 25
@sim on
`,
  },
];

export default function CodeEditor({
  isOpen,
  onClose,
  components,
  wires,
  onApplyCompiledCircuit,
  ambientTemperature,
  isSimulating,
}: CodeEditorProps) {
  // Editor code state
  const [code, setCode] = useState<string>('');
  const [diagnostics, setDiagnostics] = useState<DiagnosticMessage[]>([]);
  const [statusMessage, setStatusMessage] = useState<string>('Ready');
  const [statusType, setStatusType] = useState<'idle' | 'success' | 'error'>('idle');
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [showCheatsheet, setShowCheatsheet] = useState<boolean>(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize or decompile current visual circuit when editor opens
  useEffect(() => {
    if (isOpen && (!code || code.trim() === '')) {
      const generated = buildOhmScriptFromCircuit(components, wires, {
        title: 'Current Circuit',
        description: 'Exported from live 3D workbench',
        author: 'User',
        ambientTemperature,
        simulationEnabled: isSimulating,
      });
      setCode(generated);
    }
  }, [isOpen, components, wires, ambientTemperature, isSimulating]);

  // Real-time syntax check debounce
  useEffect(() => {
    if (!code) {
      setDiagnostics([]);
      return;
    }
    const timer = setTimeout(() => {
      try {
        const ast = parse(code);
        setDiagnostics(ast.errors);
        if (ast.errors.length === 0) {
          setStatusMessage('Syntax Valid');
          setStatusType('idle');
        } else {
          setStatusMessage(`${ast.errors.length} syntax error${ast.errors.length > 1 ? 's' : ''}`);
          setStatusType('error');
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Parser error';
        setDiagnostics([{ severity: 'error', message: msg, line: 1, col: 1 }]);
        setStatusMessage('Syntax Error');
        setStatusType('error');
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [code]);

  // Synchronize line number scrolling with textarea
  const handleScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  // Compile & Apply to 3D Workbench
  const handleCompile = () => {
    audioEngine.playKnobClick();
    try {
      const { circuit, diagnostics: compDiagnostics } = buildCircuitFromOhmScript(code);
      setDiagnostics(compDiagnostics);

      const errors = compDiagnostics.filter((d) => d.severity === 'error');
      if (errors.length > 0) {
        setStatusMessage(`Compilation failed: ${errors[0].message}`);
        setStatusType('error');
        return;
      }

      onApplyCompiledCircuit(circuit);
      setStatusMessage(`Compiled successfully (${circuit.components.length} components, ${circuit.wires.length} wires)`);
      setStatusType('success');
      setTimeout(() => {
        setStatusType('idle');
        setStatusMessage('Ready');
      }, 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Compilation failed';
      setStatusMessage(msg);
      setStatusType('error');
    }
  };

  // Decompile live 3D workbench into code
  const handleSyncFromVisual = () => {
    audioEngine.playKnobClick();
    const generated = buildOhmScriptFromCircuit(components, wires, {
      title: 'Current Circuit',
      description: 'Exported from live 3D workbench',
      author: 'User',
      ambientTemperature,
      simulationEnabled: isSimulating,
    });
    setCode(generated);
    setStatusMessage('Synchronized from 3D Workbench');
    setStatusType('success');
    setTimeout(() => setStatusType('idle'), 2000);
  };

  // Load a starter template
  const handleSelectTemplate = (templateCode: string) => {
    audioEngine.playKnobClick();
    setCode(templateCode);
    setIsTemplatesOpen(false);
    setStatusMessage('Template loaded');
    setStatusType('idle');
  };

  // Copy code to clipboard
  const handleCopy = () => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Export as .ohm file
  const handleExportOhm = () => {
    audioEngine.playKnobClick();
    const titleMatch = code.match(/@circuit\s+"([^"]+)"/);
    const fileName = titleMatch ? `${titleMatch[1].replace(/\s+/g, '_').toLowerCase()}.ohm` : 'circuit.ohm';
    downloadFile(fileName, code, 'text/plain');
  };

  // Export as .json interchange
  const handleExportJSON = () => {
    audioEngine.playKnobClick();
    const jsonStr = exportCircuitToJSON({
      components,
      wires,
      ambientTemperature,
      simulationEnabled: isSimulating,
      ohmscriptSource: code,
    });
    const titleMatch = code.match(/@circuit\s+"([^"]+)"/);
    const fileName = titleMatch ? `${titleMatch[1].replace(/\s+/g, '_').toLowerCase()}.json` : 'circuit.json';
    downloadFile(fileName, jsonStr, 'application/json');
  };

  // Import file handler (.ohm or .json)
  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      try {
        if (file.name.endsWith('.json')) {
          const { circuit, source } = importCircuitFromJSON(content);
          setCode(source);
          onApplyCompiledCircuit(circuit);
          setStatusMessage(`Imported JSON: ${circuit.title}`);
          setStatusType('success');
        } else {
          // Treat as OhmScript
          setCode(content);
          const { circuit, diagnostics: compDiagnostics } = buildCircuitFromOhmScript(content);
          setDiagnostics(compDiagnostics);
          if (compDiagnostics.filter((d) => d.severity === 'error').length === 0) {
            onApplyCompiledCircuit(circuit);
            setStatusMessage(`Imported OhmScript: ${circuit.title}`);
            setStatusType('success');
          } else {
            setStatusMessage('Loaded OhmScript with syntax errors');
            setStatusType('error');
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to import file';
        setStatusMessage(msg);
        setStatusType('error');
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  // Handle Tab key inside textarea
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const val = target.value;
      const newVal = val.substring(0, start) + '  ' + val.substring(end);
      setCode(newVal);
      // Restore cursor position
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      }, 0);
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleCompile();
    }
  };

  // Number of lines
  const linesCount = useMemo(() => {
    return Math.max(code.split('\n').length, 1);
  }, [code]);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed z-30 transition-all duration-200 flex flex-col glass-panel rounded-2xl border border-cyan-500/20 shadow-2xl overflow-hidden backdrop-blur-2xl ${
        isExpanded
          ? 'top-16 bottom-4 left-4 right-4'
          : 'top-16 bottom-4 left-4 w-[580px] max-w-[95vw]'
      }`}
      style={{
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.75), 0 0 40px rgba(6, 182, 212, 0.1)',
      }}
    >
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileImport}
        accept=".ohm,.json,text/plain,application/json"
        className="hidden"
      />

      {/* ── Top Header Toolbar ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-zinc-950/70 border-b border-white/[0.08] select-none">
        {/* Left: Brand & Status */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-md shadow-cyan-500/25 border border-cyan-400/30">
            <Code2 className="w-4 h-4 text-zinc-950 font-bold" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs font-bold text-zinc-100 tracking-wider">
                OHMSCRIPT DEV
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                DSL v1.0
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  statusType === 'error'
                    ? 'bg-rose-400 shadow-sm shadow-rose-400 animate-pulse'
                    : statusType === 'success'
                    ? 'bg-emerald-400 shadow-sm shadow-emerald-400'
                    : 'bg-cyan-400'
                }`}
              />
              <span
                className={`${
                  statusType === 'error'
                    ? 'text-rose-400'
                    : statusType === 'success'
                    ? 'text-emerald-400 font-semibold'
                    : 'text-zinc-400'
                }`}
              >
                {statusMessage}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5">
          {/* Templates Menu */}
          <div className="relative">
            <button
              onClick={() => setIsTemplatesOpen(!isTemplatesOpen)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-mono text-zinc-300 hover:text-cyan-300 hover:bg-zinc-800/70 border border-white/[0.06] transition-colors"
              title="Starter Circuits"
            >
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span>Presets</span>
              <ChevronDown className="w-3 h-3 text-zinc-400" />
            </button>

            {isTemplatesOpen && (
              <div className="absolute top-full mt-1.5 left-0 w-64 glass-panel rounded-xl border border-white/[0.1] shadow-2xl p-1.5 z-40 animate-in fade-in zoom-in-95 duration-150">
                <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 px-2 py-1 border-b border-white/[0.06]">
                  Example Circuits
                </div>
                <div className="flex flex-col gap-0.5 mt-1">
                  {TEMPLATES.map((tmpl, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectTemplate(tmpl.code)}
                      className="text-left px-2.5 py-1.5 rounded-lg hover:bg-cyan-500/10 hover:border-cyan-500/20 transition-all text-xs group"
                    >
                      <div className="font-mono text-zinc-200 group-hover:text-cyan-300 font-semibold">
                        {tmpl.name}
                      </div>
                      <div className="text-[10px] text-zinc-400 truncate">{tmpl.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Cheatsheet Toggle */}
          <button
            onClick={() => setShowCheatsheet(!showCheatsheet)}
            className={`p-1.5 rounded-lg border transition-colors ${
              showCheatsheet
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/70 border-white/[0.06]'
            }`}
            title="Syntax Cheatsheet"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>

          {/* Copy */}
          <button
            onClick={handleCopy}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/70 border border-white/[0.06] rounded-lg transition-colors"
            title="Copy Code"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          {/* Import */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/70 border border-white/[0.06] rounded-lg transition-colors"
            title="Import (.ohm / .json)"
          >
            <FileUp className="w-3.5 h-3.5" />
          </button>

          {/* Export Dropdown / Buttons */}
          <button
            onClick={handleExportOhm}
            className="px-2 py-1 rounded-lg text-[11px] font-mono text-zinc-300 hover:text-cyan-300 hover:bg-zinc-800/70 border border-white/[0.06] transition-colors"
            title="Download .ohm text file"
          >
            .ohm
          </button>

          <button
            onClick={handleExportJSON}
            className="px-2 py-1 rounded-lg text-[11px] font-mono text-zinc-300 hover:text-cyan-300 hover:bg-zinc-800/70 border border-white/[0.06] transition-colors"
            title="Download JSON interchange file"
          >
            .json
          </button>

          {/* Maximize / Minimize */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/70 border border-white/[0.06] rounded-lg transition-colors"
            title={isExpanded ? 'Restore Size' : 'Maximize'}
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 border border-white/[0.06] rounded-lg transition-colors ml-0.5"
            title="Close Dev Mode"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Syntax Cheatsheet Panel (Collapsible) ───────────────────────────── */}
      {showCheatsheet && (
        <div className="bg-zinc-950/90 border-b border-white/[0.08] p-3 text-[11px] font-mono text-zinc-300 max-h-48 overflow-y-auto">
          <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-white/[0.06]">
            <span className="text-cyan-400 font-bold tracking-wide">OhmScript v1.0 Syntax Cheatsheet</span>
            <span className="text-zinc-500 text-[10px]">Directives, Components, Wires & State</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-[10px] leading-relaxed">
            <div>
              <div className="text-amber-400 font-semibold mb-0.5">Component Declarations:</div>
              <div className="text-zinc-400">
                <code className="text-zinc-200 font-bold">bat BAT1 9V</code> — 9V Alkaline battery<br />
                <code className="text-zinc-200 font-bold">res R1 470 maxP=0.25W</code> — Resistor with rating<br />
                <code className="text-zinc-200 font-bold">led LED1 red Vf=1.9V</code> — Red/Green/Blue/Yellow LED<br />
                <code className="text-zinc-200 font-bold">pot POT1 10k wiper=0.5</code> — 10kΩ Potentiometer<br />
                <code className="text-zinc-200 font-bold">spk SPK1 8 maxP=15W</code> — 8Ω Breadboard speaker<br />
                <code className="text-zinc-200 font-bold">bulb BULB1 25</code> — 25Ω Incandescent bulb
              </div>
            </div>
            <div>
              <div className="text-emerald-400 font-semibold mb-0.5">Placements & Wiring:</div>
              <div className="text-zinc-400">
                <code className="text-zinc-200 font-bold">place BAT1 bench</code> — Place on ESD bench mat<br />
                <code className="text-zinc-200 font-bold">place R1 E15-E19</code> — 2-pin placement across holes<br />
                <code className="text-zinc-200 font-bold">place POT1 E10:E11:E12</code> — 3-pin placement<br />
                <code className="text-zinc-200 font-bold">wire BAT1.pos -&gt; TOP_POS_10 red</code> — Wire from terminal<br />
                <code className="text-zinc-200 font-bold">wire A15 -&gt; TOP_NEG_15 black</code> — Tie hole to rail<br />
                <code className="text-zinc-200 font-bold">set POT1.wiper 0.75</code> — Live wiper control
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Main Code Editor Body ──────────────────────────────────────────── */}
      <div className="relative flex-1 flex overflow-hidden bg-[#0d0e12] font-mono text-xs">
        {/* Line Numbers Gutter */}
        <div
          ref={lineNumbersRef}
          className="w-11 py-3 bg-zinc-950/80 border-r border-white/[0.06] select-none text-right pr-2 text-zinc-600 text-[11px] leading-6 overflow-hidden pointer-events-none font-mono"
        >
          {Array.from({ length: linesCount }, (_, i) => {
            const lineNum = i + 1;
            const hasError = diagnostics.some((d) => d.line === lineNum && d.severity === 'error');
            const hasWarning = diagnostics.some((d) => d.line === lineNum && d.severity === 'warning');

            return (
              <div
                key={i}
                className={`flex items-center justify-end gap-1 ${
                  hasError ? 'text-rose-400 font-bold' : hasWarning ? 'text-amber-400' : ''
                }`}
              >
                {hasError && <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />}
                <span>{lineNum}</span>
              </div>
            );
          })}
        </div>

        {/* Textarea Input */}
        <textarea
          ref={textareaRef}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          placeholder="# Type or paste OhmScript code here...&#10;@circuit &quot;My Circuit&quot;&#10;bat BAT1 9V&#10;res R1 470&#10;place BAT1 bench&#10;place R1 E15-E19"
          className="flex-1 p-3 bg-transparent text-zinc-100 font-mono text-[13px] leading-6 resize-none outline-none overflow-auto whitespace-pre tab-2 selection:bg-cyan-500/30 selection:text-white"
          style={{
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          }}
        />
      </div>

      {/* ── Diagnostics Bar (if any errors/warnings) ───────────────────────── */}
      {diagnostics.length > 0 && (
        <div className="max-h-28 overflow-y-auto bg-rose-950/40 border-t border-rose-500/20 px-3 py-1.5 text-[11px] font-mono select-none">
          <div className="flex items-center gap-1.5 text-rose-400 font-semibold mb-1">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Diagnostics ({diagnostics.length})</span>
          </div>
          <div className="flex flex-col gap-1">
            {diagnostics.map((diag, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-1.5 ${
                  diag.severity === 'error' ? 'text-rose-300' : 'text-amber-300'
                }`}
              >
                <span className="text-zinc-500">Line {diag.line}:{diag.col}</span>
                <span>•</span>
                <span>{diag.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Bottom Control Footer ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-zinc-950/80 border-t border-white/[0.08] select-none">
        {/* Left: Quick Sync Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncFromVisual}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono text-zinc-300 hover:text-cyan-300 hover:bg-zinc-800/80 border border-white/[0.08] transition-all"
            title="Decompile 3D visual circuit back to OhmScript"
          >
            <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
            <span>Decompile 3D → Code</span>
          </button>

          <span className="text-[10px] font-mono text-zinc-500 hidden sm:inline">
            ⌘+Enter to Compile
          </span>
        </div>

        {/* Right: Compile & Run Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCompile}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-mono font-bold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-zinc-950 shadow-lg shadow-cyan-500/25 transition-all transform active:scale-95"
            title="Compile OhmScript and build circuit on 3D breadboard (Cmd/Ctrl + Enter)"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>COMPILE TO 3D</span>
          </button>
        </div>
      </div>
    </div>
  );
}
