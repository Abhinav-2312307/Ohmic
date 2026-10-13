'use client';

import React, { useState } from 'react';
import {
  X,
  BookOpen,
  Copy,
  Check,
  Play,
  Layers,
  Cpu,
  Zap,
  Sliders,
  Terminal,
  Grid,
} from 'lucide-react';

interface GuideBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertCode: (code: string) => void;
}

type TabType = 'overview' | 'components' | 'placement' | 'wiring' | 'controls' | 'examples';

export default function GuideBookModal({
  isOpen,
  onClose,
  onInsertCode,
}: GuideBookModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl h-[88vh] bg-[#0c0d12] border border-cyan-500/30 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-zinc-200 font-sans">
        {/* ── Modal Header ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 bg-zinc-950/80 border-b border-white/[0.08] select-none">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  OhmScript DSL: Complete Syntax Guide Book
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 rounded-full">
                  v2.0 Spec
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Official declarative hardware specification for the Ohmic 3D Electronic Workbench
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl border border-white/[0.06] transition-colors"
            title="Close Guide Book"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Navigation Tabs ───────────────────────────────────────────── */}
        <div className="flex items-center gap-1 px-6 py-2.5 bg-zinc-950/40 border-b border-white/[0.06] overflow-x-auto select-none font-mono text-xs">
          {[
            { id: 'overview', label: '1. Overview & Directives', icon: Terminal },
            { id: 'components', label: '2. All 34 Components', icon: Cpu },
            { id: 'placement', label: '3. Placements & Holes', icon: Grid },
            { id: 'wiring', label: '4. Wiring & Terminals', icon: Zap },
            { id: 'controls', label: '5. Live Controls (set)', icon: Sliders },
            { id: 'examples', label: '6. Verified Blueprints', icon: Layers },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 border border-transparent'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── Scrollable Tab Content ────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6 text-sm text-zinc-300 leading-relaxed font-sans space-y-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6 max-w-4xl">
              <div>
                <h3 className="text-lg font-bold text-white mb-2">⚡ Document Anatomy</h3>
                <p className="text-xs text-zinc-400 mb-3">
                  Every <code className="text-cyan-300">.ohm</code> file is structured into five sequential sections:
                </p>
                <pre className="p-4 rounded-xl bg-zinc-950/90 border border-white/[0.08] text-xs font-mono text-zinc-200 overflow-x-auto">
{`# 1. Directives: Project metadata, board geometry & simulation state
@circuit "Precision Voltage Switch"
@description "CdS photoresistor triggers transistor relay switch"
@author "Ohmic Laboratory"
@board full_830
@temp 25
@sim on

# 2. Components: Declarations with engineering parameters
bat    BAT1  9V
res    R1    10k       maxP=0.25W
ldr    LDR1  10k       light=0.5
npn    Q1    2N2222    hfe=150
diode  D1    1N4007
relay  RL1   5V

# 3. Placements: Anchored to breadboard holes or bench mat
place BAT1 bench
place R1   E15-E19
place LDR1 D19-D20
place Q1   E25:E26:E27
place D1   F25-F26
place RL1  bench

# 4. Wiring: 3D catenary flexible jumpers
wire BAT1.pos  -> TOP_POS_10     red
wire BAT1.neg  -> TOP_NEG_10     black
wire TOP_POS_10 -> A15           red
wire A19       -> B26            yellow
wire TOP_NEG_10 -> A27           black
wire RL1.in    -> B25            blue

# 5. Runtime Instrumentation: Multimeter probing & live parameters
probe red   B25
probe black TOP_NEG_10
@probe_mode VOLTS_DC
set LDR1.light 0.85`}
                </pre>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white mb-2">📋 Top-Level Directives Reference</h3>
                <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-zinc-900/80 text-zinc-400 border-b border-white/[0.08]">
                      <tr>
                        <th className="p-3">Directive</th>
                        <th className="p-3">Arguments</th>
                        <th className="p-3">Purpose</th>
                        <th className="p-3">Example</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.06] bg-zinc-950/50">
                      <tr>
                        <td className="p-3 text-cyan-300 font-bold">@circuit</td>
                        <td className="p-3 text-zinc-300">&quot;Title&quot;</td>
                        <td className="p-3 text-zinc-400">Project title name</td>
                        <td className="p-3 text-amber-300">@circuit &quot;555 Flasher&quot;</td>
                      </tr>
                      <tr>
                        <td className="p-3 text-cyan-300 font-bold">@description</td>
                        <td className="p-3 text-zinc-300">&quot;Synopsis&quot;</td>
                        <td className="p-3 text-zinc-400">Multi-word description of circuit</td>
                        <td className="p-3 text-amber-300">@description &quot;1Hz astable pulse&quot;</td>
                      </tr>
                      <tr>
                        <td className="p-3 text-cyan-300 font-bold">@board</td>
                        <td className="p-3 text-zinc-300">full_830 | half_400</td>
                        <td className="p-3 text-zinc-400">Breadboard matrix tie-points</td>
                        <td className="p-3 text-amber-300">@board full_830</td>
                      </tr>
                      <tr>
                        <td className="p-3 text-cyan-300 font-bold">@temp</td>
                        <td className="p-3 text-zinc-300">Number (°C)</td>
                        <td className="p-3 text-zinc-400">Workbench ambient temperature</td>
                        <td className="p-3 text-amber-300">@temp 25</td>
                      </tr>
                      <tr>
                        <td className="p-3 text-cyan-300 font-bold">@sim</td>
                        <td className="p-3 text-zinc-300">on | off</td>
                        <td className="p-3 text-zinc-400">Master SPICE solver state</td>
                        <td className="p-3 text-amber-300">@sim on</td>
                      </tr>
                      <tr>
                        <td className="p-3 text-cyan-300 font-bold">@probe_mode</td>
                        <td className="p-3 text-zinc-300">Mode Enum</td>
                        <td className="p-3 text-zinc-400">Digital Multimeter rotary mode</td>
                        <td className="p-3 text-amber-300">@probe_mode VOLTS_DC</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ALL 34 COMPONENTS */}
          {activeTab === 'components' && (
            <div className="space-y-6 max-w-4xl">
              <div>
                <h3 className="text-lg font-bold text-white mb-1">🧩 34 Hardware Components Catalog</h3>
                <p className="text-xs text-zinc-400 mb-4">
                  All 34 physical components have complete 3D procedural meshes, MNA electrical models, and OhmScript syntax:
                </p>
                <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-zinc-900/80 text-zinc-400 border-b border-white/[0.08]">
                      <tr>
                        <th className="p-2.5">Category</th>
                        <th className="p-2.5">Keyword</th>
                        <th className="p-2.5">Declaration Syntax</th>
                        <th className="p-2.5">Pin Identifiers</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.06] bg-zinc-950/50">
                      <tr>
                        <td className="p-2.5 text-zinc-500 font-sans">Power</td>
                        <td className="p-2.5 text-cyan-300 font-bold">bat</td>
                        <td className="p-2.5 text-zinc-200">bat BAT1 9V [type=alkaline|4aa]</td>
                        <td className="p-2.5 text-amber-300">pos, neg</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 text-zinc-500 font-sans">Power</td>
                        <td className="p-2.5 text-cyan-300 font-bold">mb102</td>
                        <td className="p-2.5 text-zinc-200">mb102 MB1 5.0V</td>
                        <td className="p-2.5 text-amber-300">Direct breadboard rail plug</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 text-zinc-500 font-sans">Passives</td>
                        <td className="p-2.5 text-cyan-300 font-bold">res</td>
                        <td className="p-2.5 text-zinc-200">res R1 10k [maxP=0.25W]</td>
                        <td className="p-2.5 text-amber-300">p1, p2 (non-polarized)</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 text-zinc-500 font-sans">Passives</td>
                        <td className="p-2.5 text-cyan-300 font-bold">pot</td>
                        <td className="p-2.5 text-zinc-200">pot POT1 10k [wiper=0.5]</td>
                        <td className="p-2.5 text-amber-300">t1, w (wiper), t2</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 text-zinc-500 font-sans">Passives</td>
                        <td className="p-2.5 text-cyan-300 font-bold">cap</td>
                        <td className="p-2.5 text-zinc-200">cap C1 100uF [electrolytic|ceramic|film]</td>
                        <td className="p-2.5 text-amber-300">cp1 (+), cp2 (-)</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 text-zinc-500 font-sans">Passives</td>
                        <td className="p-2.5 text-cyan-300 font-bold">ind</td>
                        <td className="p-2.5 text-zinc-200">ind L1 10mH</td>
                        <td className="p-2.5 text-amber-300">l1, l2</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 text-zinc-500 font-sans">Passives</td>
                        <td className="p-2.5 text-cyan-300 font-bold">sw</td>
                        <td className="p-2.5 text-zinc-200">sw SW1 tactile|toggle|slide</td>
                        <td className="p-2.5 text-amber-300">sw1, sw2 (slide: sw1, com, sw2)</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 text-zinc-500 font-sans">Semiconductors</td>
                        <td className="p-2.5 text-cyan-300 font-bold">led</td>
                        <td className="p-2.5 text-zinc-200">led LED1 red|green|blue|yellow|rgb [Vf=1.9V]</td>
                        <td className="p-2.5 text-amber-300">anode, cathode (RGB: r, c, g, b)</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 text-zinc-500 font-sans">Semiconductors</td>
                        <td className="p-2.5 text-cyan-300 font-bold">diode</td>
                        <td className="p-2.5 text-zinc-200">diode D1 1N4148|1N4007</td>
                        <td className="p-2.5 text-amber-300">a (anode), k (cathode)</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 text-zinc-500 font-sans">Semiconductors</td>
                        <td className="p-2.5 text-cyan-300 font-bold">npn / pnp</td>
                        <td className="p-2.5 text-zinc-200">npn Q1 BC547|2N2222 / pnp Q2 BC557</td>
                        <td className="p-2.5 text-amber-300">c (coll), b (base), e (emit)</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 text-zinc-500 font-sans">Semiconductors</td>
                        <td className="p-2.5 text-cyan-300 font-bold">mosfet</td>
                        <td className="p-2.5 text-zinc-200">mosfet M1 IRLZ44N [vth=2.0V]</td>
                        <td className="p-2.5 text-amber-300">g (gate), d (drain), s (source)</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 text-zinc-500 font-sans">Semiconductors</td>
                        <td className="p-2.5 text-cyan-300 font-bold">ldr</td>
                        <td className="p-2.5 text-zinc-200">ldr LDR1 10k [light=0.5]</td>
                        <td className="p-2.5 text-amber-300">p1, p2</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 text-zinc-500 font-sans">ICs</td>
                        <td className="p-2.5 text-cyan-300 font-bold">ic555</td>
                        <td className="p-2.5 text-zinc-200">ic555 U1 (DIP-8 Precision Timer)</td>
                        <td className="p-2.5 text-amber-300">p1(GND)..p8(VCC)</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 text-zinc-500 font-sans">ICs</td>
                        <td className="p-2.5 text-cyan-300 font-bold">lm358</td>
                        <td className="p-2.5 text-zinc-200">lm358 OP1 (DIP-8 Dual Op-Amp)</td>
                        <td className="p-2.5 text-amber-300">p1(OUT1)..p8(VCC)</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 text-zinc-500 font-sans">ICs</td>
                        <td className="p-2.5 text-cyan-300 font-bold">ic</td>
                        <td className="p-2.5 text-zinc-200">ic U1 cd4017|74hc595|lm393|l293d|tb6612</td>
                        <td className="p-2.5 text-amber-300">DIP pin map p1..p16</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 text-zinc-500 font-sans">Sensors</td>
                        <td className="p-2.5 text-cyan-300 font-bold">sensor</td>
                        <td className="p-2.5 text-zinc-200">sensor US1 hcsr04 (Ultrasonic Distance)</td>
                        <td className="p-2.5 text-amber-300">vcc, trig, echo, gnd</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 text-zinc-500 font-sans">Sensors</td>
                        <td className="p-2.5 text-cyan-300 font-bold">sensor</td>
                        <td className="p-2.5 text-zinc-200">sensor TH1 dht22 (Temp &amp; Humidity)</td>
                        <td className="p-2.5 text-amber-300">vcc, data, gnd</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 text-zinc-500 font-sans">Sensors</td>
                        <td className="p-2.5 text-cyan-300 font-bold">sensor</td>
                        <td className="p-2.5 text-zinc-200">sensor PIR1 pir (PIR Motion)</td>
                        <td className="p-2.5 text-amber-300">vcc, out, gnd</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 text-zinc-500 font-sans">Sensors</td>
                        <td className="p-2.5 text-cyan-300 font-bold">sensor</td>
                        <td className="p-2.5 text-zinc-200">sensor MIC1 sound / SOIL1 soil / HALL1 hall / IR1 ir</td>
                        <td className="p-2.5 text-amber-300">vcc, out, gnd</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 text-zinc-500 font-sans">Actuators</td>
                        <td className="p-2.5 text-cyan-300 font-bold">buzzer</td>
                        <td className="p-2.5 text-zinc-200">buzzer BZ1 active|passive</td>
                        <td className="p-2.5 text-amber-300">pos (+), neg (-)</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 text-zinc-500 font-sans">Actuators</td>
                        <td className="p-2.5 text-cyan-300 font-bold">servo</td>
                        <td className="p-2.5 text-zinc-200">servo SRV1 [angle=90]</td>
                        <td className="p-2.5 text-amber-300">gnd, vcc, sig</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 text-zinc-500 font-sans">Actuators</td>
                        <td className="p-2.5 text-cyan-300 font-bold">motor</td>
                        <td className="p-2.5 text-zinc-200">motor M1 200 (TT DC Motor)</td>
                        <td className="p-2.5 text-amber-300">pos (+), neg (-)</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 text-zinc-500 font-sans">Actuators</td>
                        <td className="p-2.5 text-cyan-300 font-bold">relay</td>
                        <td className="p-2.5 text-zinc-200">relay RL1 5V (Optocoupled Relay)</td>
                        <td className="p-2.5 text-amber-300">vcc, gnd, in, no, com, nc</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 text-zinc-500 font-sans">Displays</td>
                        <td className="p-2.5 text-cyan-300 font-bold">disp</td>
                        <td className="p-2.5 text-zinc-200">disp OLED1 oled / LCD1 lcd</td>
                        <td className="p-2.5 text-amber-300">gnd, vcc, scl, sda</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 text-zinc-500 font-sans">Input</td>
                        <td className="p-2.5 text-cyan-300 font-bold">keypad</td>
                        <td className="p-2.5 text-zinc-200">keypad KP1 4x4</td>
                        <td className="p-2.5 text-amber-300">r1..r4, c1..c4</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 text-zinc-500 font-sans">Input</td>
                        <td className="p-2.5 text-cyan-300 font-bold">encoder</td>
                        <td className="p-2.5 text-zinc-200">encoder ENC1 ky040</td>
                        <td className="p-2.5 text-amber-300">clk, dt, sw, vcc, gnd</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 text-zinc-500 font-sans">MCUs</td>
                        <td className="p-2.5 text-cyan-300 font-bold">mcu</td>
                        <td className="p-2.5 text-zinc-200">mcu MCU1 nano|esp32|uno</td>
                        <td className="p-2.5 text-amber-300">DIP pinout / 5v, 3v3, gnd, vin</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PLACEMENT & HOLES */}
          {activeTab === 'placement' && (
            <div className="space-y-6 max-w-4xl">
              <div>
                <h3 className="text-lg font-bold text-white mb-2">📍 Breadboard Coordinate Matrix</h3>
                <p className="text-xs text-zinc-400 mb-3">
                  The 830-tie-point solderless breadboard adheres to standard 2.54 mm pitch:
                </p>
                <div className="p-4 rounded-xl bg-zinc-950/90 border border-white/[0.08] text-xs font-mono text-zinc-300 space-y-2">
                  <div className="text-emerald-400 font-bold">Top Power Distribution Rails:</div>
                  <div><code className="text-zinc-100">TOP_POS_1</code> .. <code className="text-zinc-100">TOP_POS_50</code> (Red +5V / +9V Bus)</div>
                  <div><code className="text-zinc-100">TOP_NEG_1</code> .. <code className="text-zinc-100">TOP_NEG_50</code> (Blue/Black 0V Ground Bus)</div>

                  <div className="text-cyan-400 font-bold pt-2">Upper Terminal Section (Connected in 5-hole vertical strips):</div>
                  <div>Rows <code className="text-zinc-100">A1..A63</code>, <code className="text-zinc-100">B1..B63</code>, <code className="text-zinc-100">C1..C63</code>, <code className="text-zinc-100">D1..D63</code>, <code className="text-zinc-100">E1..E63</code></div>

                  <div className="text-amber-400 font-bold pt-2">════ Central DIP Trough (0.3&quot; Isolating Gap) ════</div>

                  <div className="text-cyan-400 font-bold pt-2">Lower Terminal Section (Connected in 5-hole vertical strips):</div>
                  <div>Rows <code className="text-zinc-100">F1..F63</code>, <code className="text-zinc-100">G1..G63</code>, <code className="text-zinc-100">H1..H63</code>, <code className="text-zinc-100">I1..I63</code>, <code className="text-zinc-100">J1..J63</code></div>

                  <div className="text-emerald-400 font-bold pt-2">Bottom Power Distribution Rails:</div>
                  <div><code className="text-zinc-100">BOT_POS_1</code> .. <code className="text-zinc-100">BOT_POS_50</code> (Red + Bus)</div>
                  <div><code className="text-zinc-100">BOT_NEG_1</code> .. <code className="text-zinc-100">BOT_NEG_50</code> (Blue/Black Ground Bus)</div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white mb-2">📌 Four Placement Syntax Modes</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-white/[0.08]">
                    <div className="text-amber-400 font-mono font-bold text-xs mb-1">1. Two-Hole Span (Passives)</div>
                    <code className="text-xs font-mono text-zinc-200">place R1 E15-E19</code>
                    <p className="text-[11px] text-zinc-400 mt-1">
                      Places axial leaded parts across row E from column 15 to column 19.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-white/[0.08]">
                    <div className="text-amber-400 font-mono font-bold text-xs mb-1">2. Explicit Multi-Hole List</div>
                    <code className="text-xs font-mono text-zinc-200">place Q1 E20:E21:E22</code>
                    <p className="text-[11px] text-zinc-400 mt-1">
                      For 3-pin transistors, pots, or 4-pin modules mapped directly to adjacent columns.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-white/[0.08]">
                    <div className="text-amber-400 font-mono font-bold text-xs mb-1">3. DIP Auto-Straddle (ICs &amp; Nano)</div>
                    <code className="text-xs font-mono text-zinc-200">place U1 E20</code>
                    <p className="text-[11px] text-zinc-400 mt-1">
                      Anchor pin 1 at E20; compiler automatically straddles across central trough to F20.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-white/[0.08]">
                    <div className="text-amber-400 font-mono font-bold text-xs mb-1">4. Bench Mat Outside Board</div>
                    <code className="text-xs font-mono text-zinc-200">place BAT1 bench</code>
                    <p className="text-[11px] text-zinc-400 mt-1">
                      Places batteries, speakers, DC motors, servos, relays, or Arduino Uno on the ESD mat.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: WIRING */}
          {activeTab === 'wiring' && (
            <div className="space-y-6 max-w-4xl">
              <div>
                <h3 className="text-lg font-bold text-white mb-2">🔌 Wire Command Syntax</h3>
                <pre className="p-3.5 rounded-xl bg-zinc-950/90 border border-white/[0.08] text-xs font-mono text-zinc-200">
{`wire  <source_node>  ->  <destination_node>  [color]`}
                </pre>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white mb-2">🎨 Supported Wire Colors</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-mono">
                  {[
                    { color: 'red', hex: '#ef4444', desc: 'Positive Power (+5V/+9V)' },
                    { color: 'black', hex: '#18181b', desc: 'Ground / Negative (0V)' },
                    { color: 'blue', hex: '#2563eb', desc: 'Analog / Low-Side' },
                    { color: 'green', hex: '#22c55e', desc: 'Sensors / Clocks' },
                    { color: 'orange', hex: '#f4a261', desc: 'PWM / Logic Gates' },
                    { color: 'yellow', hex: '#eab308', desc: 'Switched Outputs' },
                    { color: 'white', hex: '#e4e4e7', desc: 'Reference Voltages' },
                    { color: 'teal', hex: '#2a9d8f', desc: 'I2C SDA / Data' },
                    { color: 'purple', hex: '#a855f7', desc: 'I2C SCL / Clocks' },
                  ].map((w) => (
                    <div key={w.color} className="p-2.5 rounded-lg bg-zinc-950/60 border border-white/[0.06] flex items-center gap-2">
                      <div className="w-3.5 h-3.5 rounded-full border border-white/20" style={{ backgroundColor: w.hex }} />
                      <div>
                        <div className="font-bold text-white">{w.color}</div>
                        <div className="text-[10px] text-zinc-500 font-sans">{w.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white mb-2">⚡ Bench Virtual Terminals</h3>
                <p className="text-xs text-zinc-400 mb-2">
                  When wiring to components on the bench mat, use <code className="text-cyan-300">&lt;id&gt;.&lt;terminal&gt;</code>:
                </p>
                <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-white/[0.08] text-xs font-mono space-y-1">
                  <div><code className="text-zinc-200">wire BAT1.pos -&gt; TOP_POS_1   red</code> — Battery + snap post</div>
                  <div><code className="text-zinc-200">wire BAT1.neg -&gt; TOP_NEG_1   black</code> — Battery - snap post</div>
                  <div><code className="text-zinc-200">wire M1.pos   -&gt; TOP_POS_10  red</code> — DC motor positive terminal</div>
                  <div><code className="text-zinc-200">wire SRV1.sig -&gt; B15         orange</code> — Servo signal control wire</div>
                  <div><code className="text-zinc-200">wire RL1.no   -&gt; M1.pos      red</code> — Relay Normally Open terminal</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: LIVE CONTROLS */}
          {activeTab === 'controls' && (
            <div className="space-y-6 max-w-4xl">
              <div>
                <h3 className="text-lg font-bold text-white mb-2">🎛️ Live Runtime Control with `set`</h3>
                <p className="text-xs text-zinc-400 mb-3">
                  Manipulate component states, physical sensor readings, and actuators on the fly:
                </p>
                <pre className="p-3.5 rounded-xl bg-zinc-950/90 border border-white/[0.08] text-xs font-mono text-zinc-200">
{`set  <component_id>.<property>  <value>`}
                </pre>
              </div>

              <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-zinc-900/80 text-zinc-400 border-b border-white/[0.08]">
                    <tr>
                      <th className="p-3">Target Component</th>
                      <th className="p-3">Property</th>
                      <th className="p-3">Type / Range</th>
                      <th className="p-3">Example Statement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06] bg-zinc-950/50">
                    <tr>
                      <td className="p-3 text-cyan-300 font-bold">Potentiometer</td>
                      <td className="p-3 text-zinc-200">wiper</td>
                      <td className="p-3 text-zinc-400">0.0 .. 1.0 ratio</td>
                      <td className="p-3 text-amber-300">set POT1.wiper 0.75</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-cyan-300 font-bold">Switch</td>
                      <td className="p-3 text-zinc-200">closed</td>
                      <td className="p-3 text-zinc-400">true | false</td>
                      <td className="p-3 text-amber-300">set SW1.closed true</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-cyan-300 font-bold">SG90 Servo</td>
                      <td className="p-3 text-zinc-200">angle</td>
                      <td className="p-3 text-zinc-400">0 .. 180 degrees</td>
                      <td className="p-3 text-amber-300">set SRV1.angle 120</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-cyan-300 font-bold">Relay Module</td>
                      <td className="p-3 text-zinc-200">relay</td>
                      <td className="p-3 text-zinc-400">true | false</td>
                      <td className="p-3 text-amber-300">set RL1.relay true</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-cyan-300 font-bold">HC-SR04 Sonar</td>
                      <td className="p-3 text-zinc-200">distance</td>
                      <td className="p-3 text-zinc-400">2 .. 400 cm</td>
                      <td className="p-3 text-amber-300">set US1.distance 42</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-cyan-300 font-bold">DHT22 Temp &amp; Hum</td>
                      <td className="p-3 text-zinc-200">temp / humidity</td>
                      <td className="p-3 text-zinc-400">-20..60°C / 10..95%</td>
                      <td className="p-3 text-amber-300">set TH1.temp 28.5</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-cyan-300 font-bold">PIR Sensor</td>
                      <td className="p-3 text-zinc-200">motion</td>
                      <td className="p-3 text-zinc-400">true | false</td>
                      <td className="p-3 text-amber-300">set PIR1.motion true</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-cyan-300 font-bold">Microphone Sound</td>
                      <td className="p-3 text-zinc-200">sound</td>
                      <td className="p-3 text-zinc-400">30 .. 100 dB</td>
                      <td className="p-3 text-amber-300">set MIC1.sound 75</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-cyan-300 font-bold">Soil Moisture</td>
                      <td className="p-3 text-zinc-200">moisture</td>
                      <td className="p-3 text-zinc-400">0 .. 100 %</td>
                      <td className="p-3 text-amber-300">set SOIL1.moisture 80</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-cyan-300 font-bold">Hall Effect</td>
                      <td className="p-3 text-zinc-200">magnet</td>
                      <td className="p-3 text-zinc-400">true | false</td>
                      <td className="p-3 text-amber-300">set HALL1.magnet true</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-cyan-300 font-bold">Rotary Encoder</td>
                      <td className="p-3 text-zinc-200">encoder</td>
                      <td className="p-3 text-zinc-400">Step Integer</td>
                      <td className="p-3 text-amber-300">set ENC1.encoder 14</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-cyan-300 font-bold">4x4 Keypad</td>
                      <td className="p-3 text-zinc-200">key</td>
                      <td className="p-3 text-zinc-400">&#39;0&#39;..&#39;9&#39;, &#39;A&#39;..&#39;D&#39;, &#39;*&#39;, &#39;#&#39;</td>
                      <td className="p-3 text-amber-300">set KP1.key &quot;5&quot;</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: VERIFIED BLUEPRINTS */}
          {activeTab === 'examples' && (
            <div className="space-y-6 max-w-4xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">🧪 Ready-to-Run Verified Circuit Blueprints</h3>
                  <p className="text-xs text-zinc-400">
                    Click &quot;Load Circuit&quot; to inject any script directly into your 3D Workbench editor.
                  </p>
                </div>
              </div>

              {[
                {
                  title: '1. NE555 Astable LED Flasher',
                  desc: 'Astable multivibrator driving square wave flashes through 1/4W resistor into 5mm red LED',
                  code: `@circuit "NE555 1Hz Flasher"
@description "Classic astable multivibrator producing square wave flashes"
@author "Ohmic Laboratory"
@version "2.0"
@board full_830
@temp 25
@sim on

# Power & Passives
bat    BAT1   9V
res    R1     10k       maxP=0.25W
res    R2     47k       maxP=0.25W
res    R_LED  330       maxP=0.25W
cap    C1     10uF      electrolytic
cap    C2     0.01uF    ceramic
ic555  U1
led    LED1   red       Vf=1.9V

# Placements
place BAT1  bench
place U1    E20
place R1    A27-A28
place R2    B27-B26
place C1    E26-E21
place C2    E25-E21
place R_LED E23-E18
place LED1  D18-D17

# Power Rails
wire BAT1.pos -> TOP_POS_1   red
wire BAT1.neg -> TOP_NEG_1   black

# 555 Pin Wiring
wire TOP_POS_1 -> E28        red     # Pin 8 (VCC)
wire TOP_POS_1 -> E24        red     # Pin 4 (RESET)
wire TOP_NEG_1 -> E21        black   # Pin 1 (GND)
wire E22 -> E26              blue    # Pin 2 (TRIG) to Pin 6 (THRES)
wire D17 -> TOP_NEG_1        black   # LED Cathode to GND

# Probing
probe red   E23
probe black E21
@probe_mode FREQUENCY`,
                },
                {
                  title: '2. 2N2222 Transistor Motor Driver',
                  desc: 'NPN transistor low-side switch driving TT DC gearbox motor with 1N4007 flyback diode',
                  code: `@circuit "2N2222 Motor Driver Switch"
@description "Logic switch driving high-current DC motor with back-EMF protection"
@author "Ohmic Laboratory"
@version "2.0"
@board full_830
@temp 25
@sim on

bat    BAT1   9V
res    R_BASE 1k
sw     SW1    tactile
diode  D_FLY  1N4007
npn    Q1     2N2222    hfe=150
motor  M1     200

place BAT1  bench
place M1    bench
place SW1   E15-F15
place R_BASE A15-A20
place Q1    E20:E21:E22
place D_FLY F21-F22

wire BAT1.pos -> TOP_POS_1   red
wire BAT1.neg -> TOP_NEG_1   black
wire TOP_POS_1 -> B15        red
wire B20      -> B21         orange
wire TOP_NEG_1 -> B20        black
wire M1.pos   -> TOP_POS_1   red
wire M1.neg   -> F22         blue
wire F21      -> TOP_POS_1   red`,
                },
                {
                  title: '3. Ultrasonic Sonar & I2C OLED Display',
                  desc: 'HC-SR04 sonar module feeding graphical SSD1306 OLED monitor via Arduino Nano',
                  code: `@circuit "Sonar Radar Monitor"
@description "HC-SR04 sonar module feeding graphical SSD1306 OLED"
@author "Ohmic Laboratory"
@version "2.0"
@board full_830
@temp 25
@sim on

bat     BAT1   9V
mcu     MCU1   nano
sensor  US1    hcsr04
disp    OLED1  oled

place BAT1  bench
place MCU1  E10
place US1   B30:B31:B32:B33
place OLED1 B40:B41:B42:B43

wire BAT1.pos -> MCU1.vin    red
wire BAT1.neg -> MCU1.gnd    black
wire MCU1.5v  -> US1.vcc     red
wire MCU1.gnd -> US1.gnd     black
wire MCU1.5v  -> OLED1.vcc   red
wire MCU1.gnd -> OLED1.gnd   black

set US1.distance 35`,
                },
              ].map((ex, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-zinc-950/80 border border-white/[0.08] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white text-sm">{ex.title}</div>
                      <div className="text-xs text-zinc-400">{ex.desc}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopy(ex.code, idx)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono text-zinc-300 hover:text-white bg-zinc-800/80 border border-white/[0.08] transition-colors"
                      >
                        {copiedIndex === idx ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          onInsertCode(ex.code);
                          onClose();
                        }}
                        className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-mono font-bold text-zinc-950 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 transition-all shadow-sm"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Load Circuit</span>
                      </button>
                    </div>
                  </div>
                  <pre className="p-3 rounded-lg bg-[#08090c] border border-white/[0.06] text-xs font-mono text-zinc-300 overflow-x-auto max-h-56">
                    {ex.code}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Modal Footer ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-3 bg-zinc-950/90 border-t border-white/[0.08] select-none text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Specification Document: docs/OHMSCRIPT_SYNTAX_GUIDE.md</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg font-mono text-xs text-zinc-200 hover:text-white bg-zinc-800 hover:bg-zinc-700 transition-colors"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
}
