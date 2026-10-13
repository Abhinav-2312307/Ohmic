'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Thermometer,
  Sparkles,
  MousePointer,
  Spline,
  Box,
  Trash2,
  ChevronDown,
  ChevronRight,
  Keyboard,
  Code2,
  FolderOpen,
  FilePlus,
  Download,
  Upload,
  Activity,
  Gauge,
  HelpCircle,
  Maximize2,
  Check,
  Zap,
  Cpu,
} from 'lucide-react';
import { getPresetCircuits, PresetCircuit } from '../presets/sampleCircuits';
import {
  exportCircuitToJSON,
  importCircuitFromJSON,
  downloadFile,
  buildOhmScriptFromCircuit,
  CompiledCircuit,
} from '../dsl';
import { CircuitComponent, JumperWire } from '../engine/componentTypes';
import { audioEngine } from '../engine/audioEngine';

export type WorkbenchTool = 'SELECT' | 'WIRE' | 'PLACE_COMPONENT' | 'DMM_PROBE' | 'DELETE';

interface TopToolbarProps {
  isSimulating: boolean;
  onToggleSimulate: () => void;
  onReset: () => void;
  onSelectPreset: (preset: PresetCircuit) => void;
  activePresetId?: string;
  ambientTemperature: number;
  onSetAmbientTemperature: (temp: number) => void;
  wireColor: string;
  onSetWireColor: (color: string) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onClear: () => void;

  activeTool: WorkbenchTool;
  onSelectTool: (tool: WorkbenchTool) => void;
  onRotateSelected?: (direction: 'CW' | 'CCW') => void;
  onDeleteSelected?: () => void;
  hasSelection?: boolean;
  selectedItemName?: string | null;
  selectedItemType?: 'COMPONENT' | 'WIRE' | null;

  isDrawerOpen: boolean;
  onToggleDrawer: () => void;
  onOpenControlsGuide?: () => void;
  isDevModeOpen?: boolean;
  onToggleDevMode?: () => void;

  instrumentTab?: 'DMM' | 'SCOPE' | 'NONE';
  onToggleInstrument?: (instrument: 'DMM' | 'SCOPE') => void;
  onOpenArduinoIDE?: () => void;

  components?: CircuitComponent[];
  wires?: JumperWire[];
  onApplyCompiledCircuit?: (compiled: CompiledCircuit) => void;
}

export const WIRE_COLORS = [
  { name: 'Red (+)', hex: '#ef4444', desc: 'Positive Voltage / +9V / +5V Rail' },
  { name: 'Black (GND)', hex: '#18181b', desc: 'Ground Reference / 0V Rail' },
  { name: 'Amber', hex: '#f59e0b', desc: 'Signal / Intermediate Node' },
  { name: 'Emerald', hex: '#10b981', desc: 'Control / Pulse / Timing' },
  { name: 'Cyan', hex: '#06b6d4', desc: 'Audio / Waveform Output' },
  { name: 'Violet', hex: '#8b5cf6', desc: 'Analog Feedback / Sensor' },
  { name: 'White', hex: '#f4f4f5', desc: 'Logic Bus / Data Line' },
];

type MenuKey = 'file' | 'edit' | 'view' | 'simulation' | 'instruments' | 'help' | null;

export default function TopToolbar({
  isSimulating,
  onToggleSimulate,
  onReset,
  onSelectPreset,
  activePresetId,
  ambientTemperature,
  onSetAmbientTemperature,
  wireColor,
  onSetWireColor,
  isMuted,
  onToggleMute,
  onClear,
  activeTool,
  onSelectTool,
  onRotateSelected,
  onDeleteSelected,
  hasSelection,
  selectedItemName,
  selectedItemType,
  isDrawerOpen,
  onToggleDrawer,
  onOpenControlsGuide,
  isDevModeOpen,
  onToggleDevMode,
  instrumentTab = 'NONE',
  onToggleInstrument,
  onOpenArduinoIDE,
  components = [],
  wires = [],
  onApplyCompiledCircuit,
}: TopToolbarProps) {
  const presets = getPresetCircuits();
  const currentPreset = presets.find((p) => p.id === activePresetId);

  // Menu bar state
  const [activeMenu, setActiveMenu] = useState<MenuKey>(null);
  const [isPresetsSubmenuOpen, setIsPresetsSubmenuOpen] = useState(false);
  const [isTempPopoverOpen, setIsTempPopoverOpen] = useState(false);
  const [isWireColorPickerOpen, setIsWireColorPickerOpen] = useState(false);

  const navRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
        setIsPresetsSubmenuOpen(false);
        setIsTempPopoverOpen(false);
        setIsWireColorPickerOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Menu interaction handlers
  const handleMenuClick = (menu: MenuKey) => {
    audioEngine.playKnobClick();
    setActiveMenu(activeMenu === menu ? null : menu);
    setIsPresetsSubmenuOpen(false);
  };

  const handleMenuMouseEnter = (menu: MenuKey) => {
    if (activeMenu !== null && activeMenu !== menu) {
      setActiveMenu(menu);
      setIsPresetsSubmenuOpen(false);
    }
  };

  const closeAllMenus = () => {
    setActiveMenu(null);
    setIsPresetsSubmenuOpen(false);
    setIsTempPopoverOpen(false);
    setIsWireColorPickerOpen(false);
  };

  // Export circuit as .ohm
  const handleExportOhm = () => {
    audioEngine.playKnobClick();
    closeAllMenus();
    const source = buildOhmScriptFromCircuit(components, wires, {
      title: currentPreset?.title || 'Custom Circuit',
      description: currentPreset?.description || 'Exported from Ohmic Workbench',
      ambientTemperature,
      simulationEnabled: isSimulating,
    });
    const filename = `${(currentPreset?.title || 'circuit').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ohm`;
    downloadFile(filename, source, 'text/plain');
  };

  // Export circuit as .json
  const handleExportJSON = () => {
    audioEngine.playKnobClick();
    closeAllMenus();
    const jsonStr = exportCircuitToJSON({
      title: currentPreset?.title || 'Custom Circuit',
      description: currentPreset?.description || 'Exported from Ohmic Workbench',
      components,
      wires,
      ambientTemperature,
      simulationEnabled: isSimulating,
    });
    const filename = `${(currentPreset?.title || 'circuit').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
    downloadFile(filename, jsonStr, 'application/json');
  };

  // Import file handler (.ohm or .json)
  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content || !onApplyCompiledCircuit) return;

      try {
        if (file.name.endsWith('.json')) {
          const { circuit } = importCircuitFromJSON(content);
          onApplyCompiledCircuit(circuit);
        } else {
          // OhmScript
          const { buildCircuitFromOhmScript } = require('../dsl');
          const { circuit } = buildCircuitFromOhmScript(content);
          onApplyCompiledCircuit(circuit);
        }
        audioEngine.playPopSound();
      } catch (err) {
        console.error('Failed to import circuit:', err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
    closeAllMenus();
  };

  // Toggle fullscreen
  const handleToggleFullscreen = () => {
    closeAllMenus();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const activeColorObj = WIRE_COLORS.find((c) => c.hex === wireColor) || WIRE_COLORS[0];

  return (
    <div ref={navRef} className="relative z-40 select-none flex flex-col font-sans">
      {/* Hidden file input for File -> Import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileImport}
        accept=".ohm,.json,text/plain,application/json"
        className="hidden"
      />

      {/* ═══════════════════════════════════════════════════════════════════════
          TIER 1: GLOBAL APPLICATION MENU & SYSTEM STATUS BAR (Height: 36px)
      ═════════════════════════════════════════════════════════════════════════ */}
      <div className="h-9 bg-[#0b0c10]/95 backdrop-blur-2xl border-b border-white/[0.06] px-3 flex items-center justify-between text-xs text-zinc-300">
        {/* Left: App Identity & Menus */}
        <div className="flex items-center gap-2">
          {/* Brand Logo & Version Chip */}
          <div className="flex items-center gap-1.5 mr-2">
            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-md shadow-amber-500/20 border border-amber-400/40">
              <span className="text-zinc-950 font-black text-[11px] font-mono leading-none">Ω</span>
            </div>
            <span className="text-xs font-black tracking-wider text-zinc-100 font-mono">OHMIC</span>
            <span className="text-[8px] font-mono font-bold px-1 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
              PRO
            </span>
          </div>

          <div className="h-3.5 w-px bg-white/[0.08] mr-1" />

          {/* Desktop Application Menu Bar */}
          <div className="flex items-center text-[11px] font-mono">
            {/* 1. FILE MENU */}
            <div className="relative">
              <button
                onClick={() => handleMenuClick('file')}
                onMouseEnter={() => handleMenuMouseEnter('file')}
                className={`px-2 py-1 rounded transition-colors ${
                  activeMenu === 'file'
                    ? 'bg-white/[0.1] text-zinc-100 font-bold'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05]'
                }`}
              >
                File
              </button>

              {activeMenu === 'file' && (
                <div className="absolute top-full left-0 mt-1 w-64 glass-panel bg-[#12141c]/95 border border-white/[0.1] rounded-xl shadow-2xl p-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <button
                    onClick={() => {
                      onClear();
                      closeAllMenus();
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-zinc-300 hover:text-white hover:bg-white/[0.08] transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <FilePlus className="w-3.5 h-3.5 text-zinc-400" />
                      <span>New Blank Circuit</span>
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">⌘N</span>
                  </button>

                  {/* Open Preset Submenu */}
                  <div
                    className="relative"
                    onMouseEnter={() => setIsPresetsSubmenuOpen(true)}
                    onMouseLeave={() => setIsPresetsSubmenuOpen(false)}
                  >
                    <button className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-zinc-300 hover:text-white hover:bg-white/[0.08] transition-colors">
                      <span className="flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>Open Preset Circuit</span>
                      </span>
                      <ChevronRight className="w-3 h-3 text-zinc-500" />
                    </button>

                    {isPresetsSubmenuOpen && (
                      <div className="absolute top-0 left-full ml-1 w-72 glass-panel bg-[#12141c]/95 border border-white/[0.1] rounded-xl shadow-2xl p-1 z-50">
                        <div className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 px-2 py-1">
                          Circuit Library
                        </div>
                        {presets.map((preset) => (
                          <button
                            key={preset.id}
                            onClick={() => {
                              onSelectPreset(preset);
                              closeAllMenus();
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                              activePresetId === preset.id
                                ? 'bg-amber-500/15 text-amber-300 font-bold'
                                : 'text-zinc-300 hover:text-white hover:bg-white/[0.08]'
                            }`}
                          >
                            <span className="truncate pr-2">{preset.title}</span>
                            {activePresetId === preset.id && <Check className="w-3.5 h-3.5 text-amber-400" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="my-1 h-px bg-white/[0.06]" />

                  <button
                    onClick={() => {
                      fileInputRef.current?.click();
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-zinc-300 hover:text-white hover:bg-white/[0.08] transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Upload className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Import Circuit (.ohm, .json)</span>
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">⌘O</span>
                  </button>

                  <button
                    onClick={handleExportOhm}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-zinc-300 hover:text-white hover:bg-white/[0.08] transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Download className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Export as OhmScript (.ohm)</span>
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">⇧⌘S</span>
                  </button>

                  <button
                    onClick={handleExportJSON}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-zinc-300 hover:text-white hover:bg-white/[0.08] transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Download className="w-3.5 h-3.5 text-amber-400" />
                      <span>Export as JSON Interchange</span>
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">.json</span>
                  </button>

                  <div className="my-1 h-px bg-white/[0.06]" />

                  <button
                    onClick={() => {
                      onClear();
                      closeAllMenus();
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      <span>Clear Workbench Mat</span>
                    </span>
                    <span className="text-[10px] text-rose-500/60 font-mono">Del All</span>
                  </button>
                </div>
              )}
            </div>

            {/* 2. EDIT MENU */}
            <div className="relative">
              <button
                onClick={() => handleMenuClick('edit')}
                onMouseEnter={() => handleMenuMouseEnter('edit')}
                className={`px-2 py-1 rounded transition-colors ${
                  activeMenu === 'edit'
                    ? 'bg-white/[0.1] text-zinc-100 font-bold'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05]'
                }`}
              >
                Edit
              </button>

              {activeMenu === 'edit' && (
                <div className="absolute top-full left-0 mt-1 w-64 glass-panel bg-[#12141c]/95 border border-white/[0.1] rounded-xl shadow-2xl p-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <button
                    onClick={() => {
                      if (onRotateSelected) onRotateSelected('CW');
                      closeAllMenus();
                    }}
                    disabled={!hasSelection}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-zinc-300 hover:text-white hover:bg-white/[0.08] disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <RotateCw className="w-3.5 h-3.5 text-amber-400" />
                      <span>Rotate Clockwise 90°</span>
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">R</span>
                  </button>

                  <button
                    onClick={() => {
                      if (onRotateSelected) onRotateSelected('CCW');
                      closeAllMenus();
                    }}
                    disabled={!hasSelection}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-zinc-300 hover:text-white hover:bg-white/[0.08] disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                      <span>Rotate Counter-Clockwise 90°</span>
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">⇧R</span>
                  </button>

                  <div className="my-1 h-px bg-white/[0.06]" />

                  <button
                    onClick={() => {
                      if (onDeleteSelected) onDeleteSelected();
                      closeAllMenus();
                    }}
                    disabled={!hasSelection}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Selected</span>
                    </span>
                    <span className="text-[10px] text-rose-500/60 font-mono">Del</span>
                  </button>
                </div>
              )}
            </div>

            {/* 3. VIEW MENU */}
            <div className="relative">
              <button
                onClick={() => handleMenuClick('view')}
                onMouseEnter={() => handleMenuMouseEnter('view')}
                className={`px-2 py-1 rounded transition-colors ${
                  activeMenu === 'view'
                    ? 'bg-white/[0.1] text-zinc-100 font-bold'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05]'
                }`}
              >
                View
              </button>

              {activeMenu === 'view' && (
                <div className="absolute top-full left-0 mt-1 w-64 glass-panel bg-[#12141c]/95 border border-white/[0.1] rounded-xl shadow-2xl p-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <button
                    onClick={() => {
                      onToggleDrawer();
                      closeAllMenus();
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-zinc-300 hover:text-white hover:bg-white/[0.08] transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Box className="w-3.5 h-3.5 text-amber-400" />
                      <span>Parts Catalog Drawer</span>
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">C</span>
                  </button>

                  <button
                    onClick={() => {
                      if (onToggleDevMode) onToggleDevMode();
                      closeAllMenus();
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-zinc-300 hover:text-white hover:bg-white/[0.08] transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Code2 className="w-3.5 h-3.5 text-cyan-400" />
                      <span>OhmScript Code Editor</span>
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">` / E</span>
                  </button>

                  <div className="my-1 h-px bg-white/[0.06]" />

                  <button
                    onClick={handleToggleFullscreen}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-zinc-300 hover:text-white hover:bg-white/[0.08] transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Maximize2 className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Toggle Fullscreen</span>
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">F11</span>
                  </button>
                </div>
              )}
            </div>

            {/* 4. SIMULATION MENU */}
            <div className="relative">
              <button
                onClick={() => handleMenuClick('simulation')}
                onMouseEnter={() => handleMenuMouseEnter('simulation')}
                className={`px-2 py-1 rounded transition-colors ${
                  activeMenu === 'simulation'
                    ? 'bg-white/[0.1] text-zinc-100 font-bold'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05]'
                }`}
              >
                Simulation
              </button>

              {activeMenu === 'simulation' && (
                <div className="absolute top-full left-0 mt-1 w-64 glass-panel bg-[#12141c]/95 border border-white/[0.1] rounded-xl shadow-2xl p-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <button
                    onClick={() => {
                      onToggleSimulate();
                      closeAllMenus();
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-zinc-300 hover:text-white hover:bg-white/[0.08] transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      {isSimulating ? (
                        <Pause className="w-3.5 h-3.5 text-amber-400" />
                      ) : (
                        <Play className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                      <span>{isSimulating ? 'Pause Solver' : 'Run 60Hz Solver'}</span>
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">Space</span>
                  </button>

                  <button
                    onClick={() => {
                      onReset();
                      closeAllMenus();
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-zinc-300 hover:text-white hover:bg-white/[0.08] transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Reset Simulation</span>
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">↺</span>
                  </button>

                  <div className="my-1 h-px bg-white/[0.06]" />

                  <div className="px-2.5 py-1 text-[9px] font-mono uppercase tracking-wider text-zinc-500">
                    Ambient Temperature
                  </div>
                  {[20, 25, 40, 60].map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        onSetAmbientTemperature(t);
                        closeAllMenus();
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                        ambientTemperature === t
                          ? 'bg-orange-500/20 text-orange-300 font-bold'
                          : 'text-zinc-300 hover:text-white hover:bg-white/[0.08]'
                      }`}
                    >
                      <span>{t}°C {t === 25 ? '(Room Standard)' : t === 60 ? '(High Thermal Stress)' : ''}</span>
                      {ambientTemperature === t && <Check className="w-3.5 h-3.5 text-orange-400" />}
                    </button>
                  ))}

                  <div className="my-1 h-px bg-white/[0.06]" />

                  <button
                    onClick={() => {
                      onToggleMute();
                      closeAllMenus();
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-zinc-300 hover:text-white hover:bg-white/[0.08] transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      {isMuted ? <VolumeX className="w-3.5 h-3.5 text-zinc-500" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
                      <span>{isMuted ? 'Unmute Sound FX' : 'Mute Sound FX'}</span>
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* 5. INSTRUMENTS MENU */}
            <div className="relative">
              <button
                onClick={() => handleMenuClick('instruments')}
                onMouseEnter={() => handleMenuMouseEnter('instruments')}
                className={`px-2 py-1 rounded transition-colors ${
                  activeMenu === 'instruments'
                    ? 'bg-white/[0.1] text-zinc-100 font-bold'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05]'
                }`}
              >
                Instruments
              </button>

              {activeMenu === 'instruments' && (
                <div className="absolute top-full left-0 mt-1 w-64 glass-panel bg-[#12141c]/95 border border-white/[0.1] rounded-xl shadow-2xl p-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <button
                    onClick={() => {
                      if (onToggleInstrument) onToggleInstrument('DMM');
                      closeAllMenus();
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                      instrumentTab === 'DMM'
                        ? 'bg-amber-500/20 text-amber-300 font-bold'
                        : 'text-zinc-300 hover:text-white hover:bg-white/[0.08]'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Gauge className="w-3.5 h-3.5 text-amber-400" />
                      <span>Digital Multimeter (DMM-8800)</span>
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">M</span>
                  </button>

                  <button
                    onClick={() => {
                      if (onToggleInstrument) onToggleInstrument('SCOPE');
                      closeAllMenus();
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                      instrumentTab === 'SCOPE'
                        ? 'bg-emerald-500/20 text-emerald-300 font-bold'
                        : 'text-zinc-300 hover:text-white hover:bg-white/[0.08]'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Activity className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Dual-Channel Oscilloscope</span>
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">O</span>
                  </button>
                </div>
              )}
            </div>

            {/* 6. HELP MENU */}
            <div className="relative">
              <button
                onClick={() => handleMenuClick('help')}
                onMouseEnter={() => handleMenuMouseEnter('help')}
                className={`px-2 py-1 rounded transition-colors ${
                  activeMenu === 'help'
                    ? 'bg-white/[0.1] text-zinc-100 font-bold'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05]'
                }`}
              >
                Help
              </button>

              {activeMenu === 'help' && (
                <div className="absolute top-full left-0 mt-1 w-64 glass-panel bg-[#12141c]/95 border border-white/[0.1] rounded-xl shadow-2xl p-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <button
                    onClick={() => {
                      if (onOpenControlsGuide) onOpenControlsGuide();
                      closeAllMenus();
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-zinc-300 hover:text-white hover:bg-white/[0.08] transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Keyboard className="w-3.5 h-3.5 text-amber-400" />
                      <span>Shortcuts & Controls Guide</span>
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">? / H</span>
                  </button>

                  <button
                    onClick={() => {
                      if (onToggleDevMode) onToggleDevMode();
                      closeAllMenus();
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-zinc-300 hover:text-white hover:bg-white/[0.08] transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
                      <span>OhmScript Language Reference</span>
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">DSL</span>
                  </button>

                  <div className="my-1 h-px bg-white/[0.06]" />

                  <div className="px-2.5 py-1 text-[10px] text-zinc-400 font-mono">
                    Ohmic Circuit Workbench v1.2<br />
                    Modified Nodal Analysis + Thermal ODE
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Center: Active Circuit Name & Status Badge */}
        <div className="hidden md:flex items-center gap-2 bg-zinc-900/60 px-3 py-0.5 rounded-full border border-white/[0.06]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] font-mono text-zinc-200 font-medium truncate max-w-xs">
            {currentPreset?.title || 'Interactive Breadboard Canvas'}
          </span>
          <span className="text-[9px] font-mono text-zinc-500 border-l border-white/[0.08] pl-2">
            {isSimulating ? '60Hz MNA Engine' : 'Paused'}
          </span>
        </div>

        {/* Right: Quick System & Environment Tray */}
        <div className="flex items-center gap-1.5 text-xs font-mono">
          {/* Temperature Quick Chip */}
          <div className="relative">
            <button
              onClick={() => setIsTempPopoverOpen(!isTempPopoverOpen)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-zinc-800/60 border border-transparent hover:border-white/[0.08] transition-colors text-zinc-300"
              title="Ambient Temperature Settings"
            >
              <Thermometer className="w-3 h-3 text-orange-400" />
              <span className="text-[11px]">{ambientTemperature}°C</span>
            </button>

            {isTempPopoverOpen && (
              <div className="absolute top-full right-0 mt-1.5 w-52 glass-panel bg-[#12141c]/95 border border-white/[0.1] rounded-xl shadow-2xl p-3 z-50">
                <div className="flex items-center justify-between text-[11px] text-zinc-300 font-semibold mb-2">
                  <span>Ambient Temp</span>
                  <span className="text-orange-400 font-mono">{ambientTemperature}°C</span>
                </div>
                <input
                  type="range"
                  min="-10"
                  max="80"
                  value={ambientTemperature}
                  onChange={(e) => onSetAmbientTemperature(parseInt(e.target.value))}
                  className="w-full h-1 accent-orange-400 bg-zinc-700 rounded cursor-pointer"
                />
                <div className="flex justify-between text-[9px] text-zinc-500 mt-1 font-mono">
                  <span>-10°C</span>
                  <span>25°C (Room)</span>
                  <span>80°C</span>
                </div>
              </div>
            )}
          </div>

          {/* Sound FX Toggle */}
          <button
            onClick={onToggleMute}
            className={`p-1 rounded-md transition-colors ${
              isMuted
                ? 'text-zinc-500 hover:text-zinc-300'
                : 'text-emerald-400 hover:bg-emerald-500/10'
            }`}
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          {/* Controls Guide */}
          {onOpenControlsGuide && (
            <button
              onClick={onOpenControlsGuide}
              className="p-1 text-zinc-400 hover:text-amber-300 hover:bg-zinc-800/60 rounded-md transition-colors"
              title="Controls & Shortcuts Guide (? / H)"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Fullscreen */}
          <button
            onClick={handleToggleFullscreen}
            className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 rounded-md transition-colors"
            title="Toggle Fullscreen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          TIER 2: PRECISION COMMAND & TOOL RIBBON (Height: 44px)
      ═════════════════════════════════════════════════════════════════════════ */}
      <div className="h-11 glass-panel border-b border-white/[0.08] px-3 flex items-center justify-between">
        {/* Left: Workbench Interaction Tools (CAD Segmented Control) */}
        <div className="flex items-center gap-1.5">
          {/* Segmented Tool Group */}
          <div className="flex items-center bg-zinc-950/80 p-0.5 rounded-xl border border-white/[0.08] shadow-inner">
            {/* Select Tool */}
            <button
              onClick={() => onSelectTool('SELECT')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                activeTool === 'SELECT'
                  ? 'bg-amber-500 text-zinc-950 font-bold shadow-md shadow-amber-500/25'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05]'
              }`}
              title="Select & Orbit View (V / Esc)"
            >
              <MousePointer className="w-3.5 h-3.5" />
              <span>SELECT</span>
            </button>

            {/* Wire Tool */}
            <button
              onClick={() => onSelectTool('WIRE')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                activeTool === 'WIRE'
                  ? 'bg-amber-500 text-zinc-950 font-bold shadow-md shadow-amber-500/25'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05]'
              }`}
              title="Draw Jumper Wire (W)"
            >
              <Spline className="w-3.5 h-3.5" />
              <span>WIRE</span>
            </button>

            {/* Components Drawer Toggle */}
            <button
              onClick={onToggleDrawer}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                isDrawerOpen
                  ? 'bg-zinc-800 text-zinc-100 border border-white/[0.1] shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05]'
              }`}
              title="Component Catalog Drawer (C)"
            >
              <Box className="w-3.5 h-3.5" />
              <span>PARTS</span>
            </button>
          </div>

          <div className="h-5 w-px bg-white/[0.08] mx-0.5" />

          {/* Wire Color Picker Dropdown Pill */}
          <div className="relative">
            <button
              onClick={() => setIsWireColorPickerOpen(!isWireColorPickerOpen)}
              className="flex items-center gap-1.5 bg-zinc-900/90 hover:bg-zinc-850 px-2.5 py-1.5 rounded-xl border border-white/[0.08] text-xs font-mono text-zinc-200 transition-colors shadow-sm"
              title="Active Wire Color"
            >
              <span
                className="w-3 h-3 rounded-full shadow-sm ring-1 ring-white/20"
                style={{ backgroundColor: wireColor }}
              />
              <span className="text-[11px] font-mono hidden sm:inline">{activeColorObj.name}</span>
              <ChevronDown className="w-3 h-3 text-zinc-400" />
            </button>

            {isWireColorPickerOpen && (
              <div className="absolute top-full left-0 mt-1.5 w-60 glass-panel bg-[#12141c]/95 border border-white/[0.1] rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 px-2 py-1">
                  Wire Color Standard
                </div>
                {WIRE_COLORS.map((wc, idx) => (
                  <button
                    key={wc.hex}
                    onClick={() => {
                      onSetWireColor(wc.hex);
                      onSelectTool('WIRE');
                      setIsWireColorPickerOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs font-mono transition-colors ${
                      wireColor === wc.hex
                        ? 'bg-white/[0.1] text-white font-bold'
                        : 'text-zinc-300 hover:text-white hover:bg-white/[0.06]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3.5 h-3.5 rounded-full shadow-sm"
                        style={{ backgroundColor: wc.hex }}
                      />
                      <span>{wc.name}</span>
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono">[{idx + 1}]</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Center: Contextual Selection Shelf OR Presets Switcher */}
        <div className="hidden lg:flex items-center gap-2">
          {hasSelection ? (
            /* Contextual Item Selected Actions */
            <div className="flex items-center gap-1.5 bg-zinc-950/80 px-3 py-1 rounded-xl border border-amber-500/30 text-xs font-mono shadow-md animate-in fade-in duration-150">
              <span className="text-amber-400 font-semibold flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>Selected: {selectedItemName || (selectedItemType === 'WIRE' ? 'Jumper Wire' : 'Component')}</span>
              </span>

              {onRotateSelected && selectedItemType !== 'WIRE' && (
                <>
                  <div className="h-4 w-px bg-white/[0.1] mx-1" />
                  <button
                    onClick={() => onRotateSelected('CCW')}
                    className="p-1 rounded text-zinc-400 hover:text-amber-300 hover:bg-zinc-800 transition-colors"
                    title="Rotate 90° CCW (Shift+R)"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onRotateSelected('CW')}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-zinc-300 hover:text-amber-300 hover:bg-zinc-800 transition-colors"
                    title="Rotate 90° CW (R)"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-amber-400" />
                    <span>Rotate (R)</span>
                  </button>
                </>
              )}

              {onDeleteSelected && (
                <>
                  <div className="h-4 w-px bg-white/[0.1] mx-1" />
                  <button
                    onClick={onDeleteSelected}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                    title="Delete Item (Del)"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </>
              )}
            </div>
          ) : (
            /* Quick Preset Switcher Combobox */
            <div className="flex items-center gap-2 bg-zinc-900/80 hover:bg-zinc-850 px-3 py-1.5 rounded-xl border border-white/[0.08] text-xs font-mono text-zinc-300 transition-colors">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <select
                onChange={(e) => {
                  const selected = presets.find((p) => p.id === e.target.value);
                  if (selected) onSelectPreset(selected);
                }}
                value={activePresetId || ''}
                className="bg-transparent text-zinc-200 text-xs font-mono focus:outline-none cursor-pointer pr-2 truncate max-w-sm"
              >
                <option value="" disabled className="bg-zinc-900 text-zinc-400">
                  Load Preset Circuit...
                </option>
                {presets.map((p) => (
                  <option key={p.id} value={p.id} className="bg-zinc-900 text-zinc-200">
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Right: Instruments, Dev Mode & Master Simulation Controls */}
        <div className="flex items-center gap-2">
          {/* Virtual Instruments Toggle Group */}
          {onToggleInstrument && (
            <div className="flex items-center bg-zinc-950/80 p-0.5 rounded-xl border border-white/[0.08]">
              <button
                onClick={() => onToggleInstrument('DMM')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                  instrumentTab === 'DMM'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05]'
                }`}
                title="Toggle Digital Multimeter (M)"
              >
                <Gauge className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">DMM</span>
              </button>

              <button
                onClick={() => onToggleInstrument('SCOPE')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                  instrumentTab === 'SCOPE'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05]'
                }`}
                title="Toggle Oscilloscope (O)"
              >
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">SCOPE</span>
              </button>
            </div>
          )}

          {/* OhmScript Dev IDE Button */}
          {onToggleDevMode && (
            <button
              onClick={onToggleDevMode}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all ${
                isDevModeOpen
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-lg shadow-cyan-500/20'
                  : 'text-zinc-300 hover:text-cyan-300 bg-zinc-900/80 hover:bg-zinc-850 border border-white/[0.08]'
              }`}
              title="Toggle OhmScript Code Editor / Dev Mode (E / `)"
            >
              <Code2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>OHMSCRIPT</span>
            </button>
          )}

          {/* Arduino IDE Firmware Button */}
          {onOpenArduinoIDE && (
            <button
              onClick={onOpenArduinoIDE}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all text-zinc-300 hover:text-teal-300 bg-zinc-900/80 hover:bg-zinc-850 border border-teal-500/30 hover:border-teal-400/50 shadow-sm"
              title="Open Arduino IDE & C++ Sketch Editor (Firmware)"
            >
              <Cpu className="w-3.5 h-3.5 text-teal-400" />
              <span>ARDUINO IDE</span>
            </button>
          )}

          {/* Master Simulation Play/Pause Toggle */}
          <button
            onClick={onToggleSimulate}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-mono font-bold transition-all shadow-md active:scale-95 ${
              isSimulating
                ? 'bg-zinc-900 hover:bg-zinc-850 text-amber-400 border border-amber-500/40 shadow-amber-500/10'
                : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-zinc-950 shadow-emerald-500/25'
            }`}
            title="Toggle Live Simulation (Space)"
          >
            {isSimulating ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>PAUSE</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>RUN SIM</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
