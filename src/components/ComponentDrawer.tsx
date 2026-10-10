'use client';

import React, { useState } from 'react';
import { ComponentType } from '../engine/componentTypes';
import {
  Search,
  Plus,
  Zap,
  Lightbulb,
  Volume2,
  Cpu,
  Battery,
  Gauge,
  X,
  CircleDot,
  ToggleLeft,
} from 'lucide-react';
import { audioEngine } from '../engine/audioEngine';

interface ComponentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onStartPlacement: (type: ComponentType, defaultValue?: number) => void;
}

interface ComponentCatalogItem {
  type: ComponentType;
  title: string;
  category: 'power' | 'passives' | 'semiconductors' | 'output' | 'logic';
  description: string;
  value: number;
  unit: string;
  icon: React.ReactNode;
  badge?: string;
}

const CATALOG: ComponentCatalogItem[] = [
  {
    type: 'BATTERY_9V',
    title: '9V Alkaline Battery',
    category: 'power',
    description: 'High-current DC voltage source with polarized snap terminals for breadboard rails.',
    value: 9,
    unit: 'V',
    icon: <Battery className="w-4 h-4 text-amber-400" />,
    badge: '9.0V DC Source',
  },
  {
    type: 'DC_SOURCE',
    title: 'Bench DC Power Supply',
    category: 'power',
    description: 'Regulated adjustable 5V bench power rails with low ripple.',
    value: 5,
    unit: 'V',
    icon: <Zap className="w-4 h-4 text-amber-400" />,
    badge: '5.0V Regulated',
  },
  {
    type: 'RESISTOR',
    title: '1kΩ Resistor (1/4W)',
    category: 'passives',
    description: 'Through-hole metal film resistor with 1kΩ color bands. 0.25W rated.',
    value: 1000,
    unit: 'Ω',
    icon: <Gauge className="w-4 h-4 text-emerald-400" />,
    badge: '0.25W Rated',
  },
  {
    type: 'RESISTOR',
    title: '330Ω Current Limiter',
    category: 'passives',
    description: 'Ideal current-limiting resistor for 5mm LEDs on 5V/9V circuits.',
    value: 330,
    unit: 'Ω',
    icon: <Gauge className="w-4 h-4 text-emerald-400" />,
    badge: '330Ω Limiter',
  },
  {
    type: 'RESISTOR',
    title: '100Ω Power Resistor',
    category: 'passives',
    description: 'Low-value resistor for testing thermal burnout and overload physics.',
    value: 100,
    unit: 'Ω',
    icon: <Gauge className="w-4 h-4 text-emerald-400" />,
    badge: 'Burnout Test',
  },
  {
    type: 'POTENTIOMETER',
    title: '10kΩ Rotary Potentiometer',
    category: 'passives',
    description: 'Adjustable 3-terminal voltage divider with rotary knurled dial.',
    value: 10000,
    unit: 'Ω',
    icon: <Gauge className="w-4 h-4 text-cyan-400" />,
    badge: 'Linear Taper',
  },
  {
    type: 'CAPACITOR_ELECTROLYTIC',
    title: '100µF Electrolytic Cap',
    category: 'passives',
    description: 'Polarized aluminum filter capacitor (25V rating) for power decoupling.',
    value: 0.0001,
    unit: 'F',
    icon: <CircleDot className="w-4 h-4 text-blue-400" />,
    badge: '100µF 25V',
  },
  {
    type: 'INDUCTOR_TOROID',
    title: '10mH Toroid Inductor',
    category: 'passives',
    description: 'Ferrite core toroid choke for LC filters and resonant circuits.',
    value: 0.01,
    unit: 'H',
    icon: <CircleDot className="w-4 h-4 text-amber-500" />,
    badge: '10mH Choke',
  },
  {
    type: 'LED',
    title: '5mm Red Diffused LED',
    category: 'semiconductors',
    description: '1.9V forward voltage drop, 20mA nominal operating current, radiant glow.',
    value: 1.9,
    unit: 'Vf',
    icon: <Lightbulb className="w-4 h-4 text-rose-400" />,
    badge: 'Red Vf=1.9V',
  },
  {
    type: 'BULB_INCANDESCENT',
    title: 'Incandescent Indicator Bulb',
    category: 'output',
    description: 'Miniature glass bulb with coiled tungsten filament and dynamic thermal glow.',
    value: 40,
    unit: 'Ω',
    icon: <Lightbulb className="w-4 h-4 text-amber-400" />,
    badge: 'Tungsten 40Ω',
  },
  {
    type: 'SPEAKER',
    title: '8Ω Mini Dynamic Speaker',
    category: 'output',
    description: 'Voice coil acoustic transducer generating live sound tones from voltage.',
    value: 8,
    unit: 'Ω',
    icon: <Volume2 className="w-4 h-4 text-indigo-400" />,
    badge: '8Ω Audio',
  },
  {
    type: 'SWITCH_TACTILE',
    title: '6mm Momentary Pushbutton',
    category: 'logic',
    description: 'Tactile push switch bridging adjacent breadboard columns or across center trough.',
    value: 0.01,
    unit: 'Ω',
    icon: <ToggleLeft className="w-4 h-4 text-teal-400" />,
    badge: 'SPST NO',
  },
  {
    type: 'DIP8_555',
    title: 'NE555 Precision Timer IC',
    category: 'logic',
    description: 'Classic 8-pin dual-in-line package timer for multivibrator pulse generation.',
    value: 555,
    unit: 'IC',
    icon: <Cpu className="w-4 h-4 text-purple-400" />,
    badge: 'DIP-8 Package',
  },
];

export default function ComponentDrawer({
  isOpen,
  onClose,
  onStartPlacement,
}: ComponentDrawerProps) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  if (!isOpen) return null;

  const filtered = CATALOG.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase());
    const matchesCat = activeCategory === 'all' || c.category === activeCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <aside className="absolute top-16 left-4 bottom-4 w-80 glass-panel rounded-2xl z-20 flex flex-col overflow-hidden shadow-2xl border border-white/[0.08] animate-in fade-in slide-in-from-left-4 duration-200 select-none">
      {/* Header */}
      <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold font-mono tracking-wider text-zinc-100">
              COMPONENT CATALOG
            </h2>
            <p className="text-[10px] text-zinc-400">Click any component to place</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          title="Close Catalog (C)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search & Categories */}
      <div className="p-3 border-b border-white/[0.06] bg-zinc-900/40">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Search parts (e.g. Resistor, 555, LED)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-zinc-950/80 border border-white/[0.08] rounded-xl text-xs font-mono text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-amber-400/60"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1 mt-2.5 overflow-x-auto no-scrollbar">
          {[
            { id: 'all', label: 'All' },
            { id: 'passives', label: 'Passives' },
            { id: 'semiconductors', label: 'Semis' },
            { id: 'power', label: 'Power' },
            { id: 'output', label: 'Outputs' },
            { id: 'logic', label: 'Logic' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-2.5 py-1 text-[10px] font-mono rounded-lg whitespace-nowrap transition-all ${
                activeCategory === cat.id
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Component Cards List */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {filtered.map((item, idx) => (
          <div
            key={idx}
            className="group flex flex-col p-3 rounded-xl glass-card cursor-pointer"
            onClick={() => {
              audioEngine.playKnobClick();
              onStartPlacement(item.type, item.value);
            }}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-zinc-850 border border-white/[0.06] group-hover:border-amber-500/30 transition-colors">
                  {item.icon}
                </div>
                <div>
                  <h3 className="text-xs font-bold text-zinc-100 group-hover:text-amber-300 transition-colors">
                    {item.title}
                  </h3>
                  <span className="text-[10px] font-mono text-zinc-400">
                    {item.badge}
                  </span>
                </div>
              </div>

              <button
                className="px-2 py-1 rounded-lg bg-amber-500/10 text-amber-400 group-hover:bg-amber-500 group-hover:text-zinc-950 text-[10px] font-mono font-bold transition-all border border-amber-500/30 flex items-center gap-1 shadow-sm"
                title="Place onto breadboard"
              >
                <Plus className="w-3 h-3" />
                <span>PLACE</span>
              </button>
            </div>

            <p className="text-[11px] text-zinc-400 mt-2 line-clamp-2 leading-relaxed">
              {item.description}
            </p>
          </div>
        ))}
      </div>
    </aside>
  );
}
