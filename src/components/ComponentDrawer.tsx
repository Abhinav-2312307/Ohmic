'use client';

import React, { useState } from 'react';
import { ComponentType } from '../engine/componentTypes';
import { Search, Plus, Zap, Lightbulb, Volume2, Cpu, Battery, Gauge } from 'lucide-react';

interface ComponentDrawerProps {
  onAddComponent: (type: ComponentType, defaultValue?: number) => void;
}

interface ComponentCatalogItem {
  type: ComponentType;
  title: string;
  category: 'power' | 'passives' | 'semiconductors' | 'output' | 'macro';
  description: string;
  value: number;
  unit: string;
  icon: React.ReactNode;
  badge?: string;
}

const CATALOG: ComponentCatalogItem[] = [
  // Power Sources
  {
    type: 'BATTERY_9V',
    title: '9V Alkaline Battery',
    category: 'power',
    description: 'High-current DC voltage source with polarized snap terminals.',
    value: 9,
    unit: 'V',
    icon: <Battery className="w-4 h-4 text-amber-400" />,
    badge: '9.0V DC',
  },
  {
    type: 'DC_SOURCE',
    title: 'Bench DC Power Supply',
    category: 'power',
    description: 'Regulated adjustable 5V / 12V bench power rails.',
    value: 5,
    unit: 'V',
    icon: <Zap className="w-4 h-4 text-amber-500" />,
    badge: '5.0V Reg',
  },

  // Passives
  {
    type: 'RESISTOR',
    title: '1kΩ Resistor (1/4W)',
    category: 'passives',
    description: 'Through-hole carbon/metal film resistor with 1kΩ color code bands.',
    value: 1000,
    unit: 'Ω',
    icon: <Gauge className="w-4 h-4 text-emerald-400" />,
    badge: '0.25W max',
  },
  {
    type: 'RESISTOR',
    title: '100Ω Power Resistor',
    category: 'passives',
    description: 'Low-value resistor for medium-current circuits.',
    value: 100,
    unit: 'Ω',
    icon: <Gauge className="w-4 h-4 text-emerald-400" />,
    badge: '0.25W max',
  },
  {
    type: 'POTENTIOMETER',
    title: '10kΩ Rotary Potentiometer',
    category: 'passives',
    description: 'Adjustable 3-terminal voltage divider with rotary knurled dial.',
    value: 10000,
    unit: 'Ω',
    icon: <Gauge className="w-4 h-4 text-cyan-400" />,
    badge: '10kΩ Lin',
  },
  {
    type: 'CAPACITOR_ELECTROLYTIC',
    title: '100µF Electrolytic Capacitor',
    category: 'passives',
    description: 'Polarized radial aluminum capacitor with safety pressure vent.',
    value: 100,
    unit: 'µF',
    icon: <Zap className="w-4 h-4 text-sky-400" />,
    badge: '25V Max',
  },
  {
    type: 'INDUCTOR_TOROID',
    title: '10mH Toroidal Inductor',
    category: 'passives',
    description: 'High-current copper winding over dark ferrite ring core.',
    value: 10,
    unit: 'mH',
    icon: <Zap className="w-4 h-4 text-orange-400" />,
    badge: '16 Turns',
  },

  // Semiconductors & Light
  {
    type: 'LED',
    title: '5mm Red Diffused LED',
    category: 'semiconductors',
    description: '1.9V forward voltage drop, 20mA nominal operating current.',
    value: 1.9,
    unit: 'Vf',
    icon: <Lightbulb className="w-4 h-4 text-rose-500" />,
    badge: '2.0V 20mA',
  },
  {
    type: 'BULB_INCANDESCENT',
    title: 'Incandescent Indicator Bulb',
    category: 'semiconductors',
    description: 'Miniature screw-base glass bulb with coiled tungsten filament.',
    value: 20,
    unit: 'Ω',
    icon: <Lightbulb className="w-4 h-4 text-yellow-400" />,
    badge: 'Tungsten',
  },
  {
    type: 'DIP8_555',
    title: 'NE555 Precision Timer IC',
    category: 'semiconductors',
    description: 'Industry standard 8-pin dual in-line package oscillator timer.',
    value: 1,
    unit: 'IC',
    icon: <Cpu className="w-4 h-4 text-purple-400" />,
    badge: 'DIP-8',
  },

  // Outputs & Controls
  {
    type: 'SWITCH_TACTILE',
    title: '6x6mm Tactile Pushbutton',
    category: 'output',
    description: 'Momentary mechanical contact switch for interactive inputs.',
    value: 1,
    unit: 'sw',
    icon: <Zap className="w-4 h-4 text-blue-400" />,
    badge: 'Momentary',
  },
  {
    type: 'SPEAKER',
    title: '8Ω Dynamic Mini Speaker',
    category: 'output',
    description: 'Electrodynamic speaker with live WebAudio acoustic playback.',
    value: 8,
    unit: 'Ω',
    icon: <Volume2 className="w-4 h-4 text-emerald-400" />,
    badge: 'Live Audio',
  },
  {
    type: 'DISPLAY_7SEG',
    title: '1.0" 7-Segment Display',
    category: 'output',
    description: '10-pin DIP common cathode numeric display (A-G, DP).',
    value: 1,
    unit: 'ch',
    icon: <Lightbulb className="w-4 h-4 text-red-400" />,
    badge: '1-Digit',
  },
];

export default function ComponentDrawer({ onAddComponent }: ComponentDrawerProps) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const filtered = CATALOG.filter((item) => {
    const matchesCat = activeCategory === 'all' || item.category === activeCategory;
    const matchesSearch =
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.description.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800 w-80 select-none">
      {/* Header */}
      <div className="p-4 border-b border-slate-800">
        <h2 className="text-xs font-mono font-bold text-slate-200 tracking-wider flex items-center gap-2 mb-3">
          <span>📦 COMPONENT LIBRARY</span>
        </h2>

        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search resistors, ICs, bulbs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1 mt-3 overflow-x-auto no-scrollbar">
          {[
            { id: 'all', label: 'All' },
            { id: 'power', label: 'Power' },
            { id: 'passives', label: 'Passives' },
            { id: 'semiconductors', label: 'Semis' },
            { id: 'output', label: 'Outputs' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-2.5 py-1 text-[11px] font-mono rounded-md whitespace-nowrap transition-all ${
                activeCategory === cat.id
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {filtered.map((item, idx) => (
          <div
            key={idx}
            className="group flex flex-col p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 hover:border-amber-500/50 hover:bg-slate-800/40 transition-all shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/60">
                  {item.icon}
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-100 group-hover:text-amber-400 transition-colors">
                    {item.title}
                  </h3>
                  <span className="text-[10px] font-mono text-slate-500">
                    {item.badge}
                  </span>
                </div>
              </div>

              <button
                onClick={() => onAddComponent(item.type, item.value)}
                className="p-1.5 rounded-md bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-slate-950 transition-all border border-amber-500/30"
                title="Add to workbench"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-[11px] text-slate-400 mt-2 line-clamp-2 leading-relaxed">
              {item.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
