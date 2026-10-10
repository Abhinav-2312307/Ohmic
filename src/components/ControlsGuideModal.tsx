'use client';

import React, { useState } from 'react';
import {
  X,
  Keyboard,
  MousePointer,
  RotateCw,
  Spline,
  BatteryCharging,
  Gauge,
  Camera,
  Zap,
  Trash2,
  Search,
  Sparkles,
} from 'lucide-react';

interface ControlsGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ControlItem {
  task: string;
  keys: string[];
  description: string;
  tip?: string;
}

interface ControlCategory {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  items: ControlItem[];
}

const CONTROL_CATEGORIES: ControlCategory[] = [
  {
    id: 'select_move',
    title: 'Selection & Movement',
    icon: MousePointer,
    color: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
    items: [
      {
        task: 'Select Item',
        keys: ['Left Click'],
        description: 'Click directly on any placed component or jumper wire to select it.',
      },
      {
        task: 'Drag to Move',
        keys: ['Click + Drag'],
        description: 'Click and drag a selected component across breadboard holes or workbench mat.',
        tip: 'Snaps automatically to the nearest breadboard socket or mat coordinates.',
      },
      {
        task: 'Nudge Rows (Up / Down)',
        keys: ['W', 'S', '↑', '↓'],
        description: 'Step-move the selected component forward or backward across breadboard rows.',
      },
      {
        task: 'Nudge Columns (Left / Right)',
        keys: ['A', 'D', 'Shift+←', 'Shift+→'],
        description: 'Step-move the selected component left or right across breadboard columns (1–63).',
      },
      {
        task: 'Deselect',
        keys: ['Esc', 'Click Mat'],
        description: 'Cancel current selection and close inspector panel.',
      },
    ],
  },
  {
    id: 'rotate',
    title: 'Component Rotation',
    icon: RotateCw,
    color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
    items: [
      {
        task: 'Rotate Clockwise (90°)',
        keys: ['→', 'R'],
        description: 'Rotates selected component or placement hologram 90° clockwise.',
        tip: 'For breadboard parts, automatically flips footprint pins between horizontal and vertical.',
      },
      {
        task: 'Rotate Counter-Clockwise (90°)',
        keys: ['←'],
        description: 'Rotates selected component 90° counter-clockwise.',
      },
      {
        task: 'Rotate 9V Battery',
        keys: ['←', '→', 'R'],
        description: 'Rotates battery on the ESD bench mat. Connected jumper wires follow the snap terminals automatically.',
      },
    ],
  },
  {
    id: 'wiring',
    title: 'Wiring & Circuit Connections',
    icon: Spline,
    color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    items: [
      {
        task: 'Activate Wire Tool',
        keys: ['W'],
        description: 'Selects the flexible jumper wire tool from the workbench dock.',
      },
      {
        task: 'Stretch & Attach Wire',
        keys: ['Click ➔ Drag ➔ Click'],
        description: 'Click any socket hole or battery terminal to start, then click target hole to connect.',
        tip: 'Wires sag with realistic catenary curves and calculate live node voltage & current.',
      },
      {
        task: 'Quick Wire Colors',
        keys: ['1', '2', '3', '4', '5', '6', '7'],
        description: '1=Red (+), 2=Black (GND), 3=Amber, 4=Emerald, 5=Cyan, 6=Violet, 7=White.',
      },
      {
        task: 'Cancel Wiring',
        keys: ['Esc', 'Right Click'],
        description: 'Aborts wire stretching without creating a connection.',
      },
    ],
  },
  {
    id: 'power',
    title: '9V Battery & Off-Board Power',
    icon: BatteryCharging,
    color: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
    items: [
      {
        task: 'Place 9V Battery',
        keys: ['C ➔ Battery ➔ Click Mat'],
        description: 'Select 9V Alkaline Battery from catalog and place it outside the board on the green bench mat.',
      },
      {
        task: 'Connect Positive Terminal (+)',
        keys: ['Wire Tool ➔ Click Red Stud'],
        description: 'Attach a jumper wire to the positive terminal (+9.0V DC) and connect to Top Positive Rail (+).',
      },
      {
        task: 'Connect Negative Terminal (-)',
        keys: ['Wire Tool ➔ Click Black Socket'],
        description: 'Attach a jumper wire to the negative snap socket (0.0V Ground) and connect to Ground Rail (-).',
      },
    ],
  },
  {
    id: 'instruments',
    title: 'Virtual Test Instruments',
    icon: Gauge,
    color: 'text-violet-400 border-violet-500/30 bg-violet-500/10',
    items: [
      {
        task: 'Toggle Digital Multimeter (DMM)',
        keys: ['M'],
        description: 'Open or close the 6.5-digit precision digital multimeter panel.',
      },
      {
        task: 'Attach DMM Test Probes',
        keys: ['Click Red/Black Probe ➔ Click Hole'],
        description: 'Select Red or Black probe in the DMM, then click any hole or terminal to measure.',
        tip: 'Supports DC Volts, AC Volts, Current (mA), Resistance (Ω), and Continuity Buzzer.',
      },
      {
        task: 'Toggle Oscilloscope',
        keys: ['O'],
        description: 'Open or close the real-time dual-channel oscilloscope waveform analyzer.',
      },
    ],
  },
  {
    id: 'camera',
    title: '3D Camera & Viewport Navigation',
    icon: Camera,
    color: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
    items: [
      {
        task: 'Orbit View (Rotate 3D)',
        keys: ['Left Click + Drag (Empty Space)'],
        description: 'Smoothly orbits the camera 360° around the workbench.',
      },
      {
        task: 'Pan Camera (Translate)',
        keys: ['Right Click + Drag'],
        description: 'Pans the camera laterally across the workbench mat.',
      },
      {
        task: 'Zoom In / Out',
        keys: ['Mouse Scroll Wheel'],
        description: 'Smoothly zooms into breadboard holes and component labels.',
      },
    ],
  },
  {
    id: 'simulation',
    title: 'Physics Simulation & Tuning',
    icon: Zap,
    color: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10',
    items: [
      {
        task: 'Run / Pause Simulation',
        keys: ['Space'],
        description: 'Toggles the live 20Hz Modified Nodal Analysis (MNA) circuit solver.',
      },
      {
        task: 'Open Component Catalog',
        keys: ['C'],
        description: 'Browse resistors, capacitors, LEDs, potentiometers, tactile buttons, bulbs, and ICs.',
      },
      {
        task: 'Delete Selected Item',
        keys: ['Delete', 'Backspace'],
        description: 'Permanently removes the selected component or wire from the circuit.',
      },
    ],
  },
];

export default function ControlsGuideModal({ isOpen, onClose }: ControlsGuideModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string>('all');

  if (!isOpen) return null;

  const filteredCategories = CONTROL_CATEGORIES.map((cat) => {
    if (activeTab !== 'all' && cat.id !== activeTab) return null;

    const filteredItems = cat.items.filter((item) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.task.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.keys.some((k) => k.toLowerCase().includes(q)) ||
        (item.tip && item.tip.toLowerCase().includes(q))
      );
    });

    if (filteredItems.length === 0) return null;
    return { ...cat, items: filteredItems };
  }).filter(Boolean) as ControlCategory[];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[88vh] flex flex-col bg-[#0e1015] border border-white/[0.12] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-zinc-950/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-zinc-100 font-mono tracking-wide">
                  CONTROLS & SHORTCUTS GUIDE
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Interactive Affordances
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-sans">
                Quick reference for component selection, movement, arrow key rotation, wiring, and instruments.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 rounded-xl transition-colors"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="px-6 py-3 border-b border-white/[0.06] bg-zinc-900/60 flex flex-wrap items-center justify-between gap-3">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-mono">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'all'
                  ? 'bg-amber-500 text-zinc-950 font-bold shadow-md shadow-amber-500/20'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              All Tasks
            </button>
            {CONTROL_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveTab(cat.id)}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                  activeTab === cat.id
                    ? 'bg-zinc-800 text-zinc-100 border border-white/[0.12] font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/60'
                }`}
              >
                {cat.title}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search shortcut or task..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-zinc-950/80 border border-white/[0.08] rounded-xl text-xs font-mono text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-400"
            />
          </div>
        </div>

        {/* Categorized Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {filteredCategories.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 font-mono text-xs">
              No controls matching &ldquo;{searchQuery}&rdquo;. Try another term.
            </div>
          ) : (
            filteredCategories.map((category) => {
              const Icon = category.icon;
              return (
                <section
                  key={category.id}
                  className="bg-zinc-950/50 rounded-2xl border border-white/[0.06] p-4 shadow-sm"
                >
                  {/* Category Header */}
                  <div className="flex items-center gap-2.5 mb-3.5 pb-2.5 border-b border-white/[0.06]">
                    <div
                      className={`w-6 h-6 rounded-lg border flex items-center justify-center ${category.color}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <h3 className="text-sm font-bold text-zinc-200 font-mono tracking-wide">
                      {category.title}
                    </h3>
                  </div>

                  {/* Task Items Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {category.items.map((item, i) => (
                      <div
                        key={i}
                        className="p-3 bg-zinc-900/60 hover:bg-zinc-900 rounded-xl border border-white/[0.04] hover:border-white/[0.1] transition-all flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <span className="text-xs font-bold text-zinc-200 font-mono">
                              {item.task}
                            </span>
                            <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                              {item.keys.map((k, ki) => (
                                <kbd
                                  key={ki}
                                  className="px-2 py-0.5 rounded-md bg-zinc-800 text-amber-300 border border-amber-500/20 text-[11px] font-mono shadow-sm"
                                >
                                  {k}
                                </kbd>
                              ))}
                            </div>
                          </div>
                          <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                            {item.description}
                          </p>
                        </div>

                        {item.tip && (
                          <div className="mt-2 pt-2 border-t border-white/[0.04] text-[11px] text-amber-400/90 font-mono flex items-center gap-1.5">
                            <Sparkles className="w-3 h-3 shrink-0 text-amber-400" />
                            <span>{item.tip}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-white/[0.08] bg-zinc-950/90 flex items-center justify-between text-xs font-mono text-zinc-400">
          <div className="flex items-center gap-4">
            <span>
              💡 <span className="text-zinc-300">Quick Rotation Tip:</span> Use{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-amber-300 border border-white/[0.1]">←</kbd> and{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-amber-300 border border-white/[0.1]">→</kbd> Arrow Keys
            </span>
            <span>
              💡 <span className="text-zinc-300">Quick Move Tip:</span> Drag with mouse or use{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-amber-300 border border-white/[0.1]">WASD</kbd>
            </span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-amber-500 text-zinc-950 font-bold hover:bg-amber-400 transition-colors shadow-md shadow-amber-500/20"
          >
            Got it (Esc)
          </button>
        </div>
      </div>
    </div>
  );
}
