'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import TopToolbar from '../components/TopToolbar';
import ComponentDrawer from '../components/ComponentDrawer';
import PropertyInspector from '../components/PropertyInspector';
import MultimeterPanel from '../components/MultimeterPanel';
import OscilloscopePanel from '../components/OscilloscopePanel';

const CircuitWorkbench3D = dynamic(() => import('../components/CircuitWorkbench3D'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-slate-400 font-mono text-xs">
      <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mb-3" />
      <span className="tracking-widest">LOADING OHMIC 3D WORKBENCH...</span>
    </div>
  ),
});
import { CircuitComponent, JumperWire, MultimeterState, ComponentType } from '../engine/componentTypes';
import { solveCircuit } from '../engine/circuitSolver';
import { getPresetCircuits, PresetCircuit } from '../presets/sampleCircuits';
import { getHolePosition } from '../engine/breadboardModel';
import { audioEngine } from '../engine/audioEngine';
import { Gauge, Activity, Minimize2, Maximize2 } from 'lucide-react';

export default function OhmicWorkbenchPage() {
  const defaultPreset = getPresetCircuits()[0];

  // Circuit Simulation State
  const [components, setComponents] = useState<CircuitComponent[]>(defaultPreset.components);
  const [wires, setWires] = useState<JumperWire[]>(defaultPreset.wires);
  const [isSimulating, setIsSimulating] = useState(true);
  const [ambientTemperature, setAmbientTemperature] = useState(25);
  const [wireColor, setWireColor] = useState('#e63946');
  const [isMuted, setIsMuted] = useState(false);

  // Selected Component & Active Tool State
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [activeProbe, setActiveProbe] = useState<'RED' | 'BLACK' | null>(null);
  const [activeView, setActiveView] = useState<'3D' | '2D'>('3D');

  // Virtual Instruments State
  const [multimeter, setMultimeter] = useState<MultimeterState>({
    mode: 'VOLTS_DC',
    reading: 0,
    unit: 'V',
    isContinuous: false,
    redProbeHoleId: 'E19',
    blackProbeHoleId: 'TOP_NEG_5',
  });
  const [instrumentTab, setInstrumentTab] = useState<'DMM' | 'SCOPE' | 'NONE'>('DMM');

  // Simulation Solve Loop
  useEffect(() => {
    if (!isSimulating) return;

    const interval = setInterval(() => {
      const result = solveCircuit(components, wires, multimeter, ambientTemperature);
      setComponents(result.components);
      setWires(result.wires);
      setMultimeter(result.multimeter);

      // Feed speaker voltage into WebAudio engine if speaker is present
      const speaker = result.components.find((c) => c.type === 'SPEAKER');
      if (speaker) {
        audioEngine.updateSpeaker(speaker.voltageDrop, 440);
      } else {
        audioEngine.updateSpeaker(0);
      }
    }, 50); // 20Hz update rate for smooth real-time telemetry

    return () => clearInterval(interval);
  }, [components, wires, multimeter, ambientTemperature, isSimulating]);

  // Keyboard Shortcuts (Space to Pause/Play)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setIsSimulating((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Wire creation handler
  const handleAddWire = useCallback((startHoleId: string, endHoleId: string, color: string) => {
    const startPos = getHolePosition(startHoleId);
    const endPos = getHolePosition(endHoleId);
    if (!startPos || !endPos) return;

    const newWire: JumperWire = {
      id: `wire_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      startHoleId,
      endHoleId,
      startPos,
      endPos,
      color,
      current: 0,
      voltage: 0,
    };

    setWires((prev) => [...prev, newWire]);
  }, []);

  // Component insertion handler
  const handleAddComponent = (type: ComponentType, defaultValue: number = 1000) => {
    const id = `comp_${Date.now()}`;
    const x = (Math.random() - 0.5) * 0.06;
    const y = 0.012;
    const z = 0.012;

    let pins: CircuitComponent['pins'] = [];
    let modelUrl = '';
    let unit = 'Ω';
    let name = 'Component';

    switch (type) {
      case 'RESISTOR':
        name = `${defaultValue}Ω Resistor`;
        modelUrl = '/models/components/resistor_1k.glb';
        unit = 'Ω';
        pins = [
          { id: 'p1', name: 'Pin 1', relativePos: [-0.00508, 0, 0] },
          { id: 'p2', name: 'Pin 2', relativePos: [0.00508, 0, 0] },
        ];
        break;
      case 'LED':
        name = '5mm Red LED';
        modelUrl = '/models/components/led_5mm_red.glb';
        unit = 'Vf';
        pins = [
          { id: 'anode', name: 'ANODE', relativePos: [0.00127, 0, 0] },
          { id: 'cathode', name: 'CATHODE', relativePos: [-0.00127, 0, 0] },
        ];
        break;
      case 'BULB_INCANDESCENT':
        name = 'Incandescent Bulb';
        modelUrl = '/models/components/bulb_incandescent.glb';
        unit = 'Ω';
        pins = [
          { id: 't1', name: 'Terminal 1', relativePos: [-0.002, 0, 0] },
          { id: 't2', name: 'Terminal 2', relativePos: [0.002, 0, 0] },
        ];
        break;
      case 'BATTERY_9V':
        name = '9V Battery';
        modelUrl = '/models/power/battery_9v.glb';
        unit = 'V';
        pins = [
          { id: 'pos', name: '+', relativePos: [0.0064, 0, 0.025] },
          { id: 'neg', name: '-', relativePos: [-0.0064, 0, 0.025] },
        ];
        break;
      case 'POTENTIOMETER':
        name = '10kΩ Potentiometer';
        modelUrl = '/models/components/potentiometer_10k.glb';
        unit = 'Ω';
        pins = [
          { id: 't1', name: 'T1', relativePos: [-0.00254, 0, 0] },
          { id: 'w', name: 'WIPER', relativePos: [0, 0, 0] },
          { id: 't2', name: 'T2', relativePos: [0.00254, 0, 0] },
        ];
        break;
      case 'SPEAKER':
        name = '8Ω Mini Speaker';
        modelUrl = '/models/components/speaker_8ohm.glb';
        unit = 'Ω';
        pins = [
          { id: 'sp1', name: '+', relativePos: [-0.008, 0, 0] },
          { id: 'sp2', name: '-', relativePos: [0.008, 0, 0] },
        ];
        break;
      case 'CAPACITOR_ELECTROLYTIC':
        name = '100µF Capacitor';
        modelUrl = '/models/components/capacitor_electrolytic.glb';
        unit = 'µF';
        pins = [
          { id: 'cp1', name: '+', relativePos: [0.00127, 0, 0] },
          { id: 'cp2', name: '-', relativePos: [-0.00127, 0, 0] },
        ];
        break;
      case 'SWITCH_TACTILE':
        name = 'Pushbutton Switch';
        modelUrl = '/models/components/button_tactile_6mm.glb';
        unit = 'sw';
        pins = [
          { id: 'sw1', name: 'Pin 1', relativePos: [-0.002, 0, 0] },
          { id: 'sw2', name: 'Pin 2', relativePos: [0.002, 0, 0] },
        ];
        break;
      default:
        name = `${type}`;
        unit = '';
        pins = [{ id: 'p1', name: 'Pin 1', relativePos: [0, 0, 0] }];
    }

    const newComp: CircuitComponent = {
      id,
      type,
      name,
      value: defaultValue,
      unit,
      position: [x, y, z],
      rotation: [0, 0, 0],
      modelUrl,
      pins,
      voltageDrop: 0,
      current: 0,
      powerDissipated: 0,
      temperature: ambientTemperature,
      health: 'NORMAL',
    };

    setComponents((prev) => [...prev, newComp]);
    setSelectedComponentId(id);
  };

  const handleSelectPreset = (preset: PresetCircuit) => {
    setComponents(preset.components);
    setWires(preset.wires);
    setSelectedComponentId(null);
  };

  const handleClear = () => {
    setComponents([]);
    setWires([]);
    setSelectedComponentId(null);
  };

  const selectedComp = components.find((c) => c.id === selectedComponentId) || null;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* Top Application Bar */}
      <TopToolbar
        isSimulating={isSimulating}
        onToggleSimulate={() => setIsSimulating(!isSimulating)}
        onReset={() => {
          const resetPreset = getPresetCircuits()[0];
          setComponents(resetPreset.components);
          setWires(resetPreset.wires);
        }}
        onSelectPreset={handleSelectPreset}
        ambientTemperature={ambientTemperature}
        onSetAmbientTemperature={setAmbientTemperature}
        wireColor={wireColor}
        onSetWireColor={setWireColor}
        isMuted={isMuted}
        onToggleMute={() => setIsMuted(audioEngine.toggleMute())}
        onClear={handleClear}
      />

      {/* Main Workspace Body */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left: Component Catalog Drawer */}
        <ComponentDrawer onAddComponent={handleAddComponent} />

        {/* Center: Interactive 3D Workbench Canvas */}
        <div className="flex-1 relative h-full">
          <CircuitWorkbench3D
            components={components}
            wires={wires}
            multimeter={multimeter}
            wireColor={wireColor}
            isSimulating={isSimulating}
            onAddWire={handleAddWire}
            onSelectComponent={(comp) => setSelectedComponentId(comp ? comp.id : null)}
            onComponentStateChange={(id, newState) => {
              setComponents((prev) =>
                prev.map((c) => (c.id === id ? { ...c, state: { ...c.state, ...newState } } : c))
              );
            }}
            onSetProbeHole={(probe, holeId) => {
              setMultimeter((prev) => ({
                ...prev,
                [probe === 'RED' ? 'redProbeHoleId' : 'blackProbeHoleId']: holeId,
              }));
              setActiveProbe(null);
            }}
            activeProbe={activeProbe}
          />

          {/* Floating Virtual Instruments Dock (Bottom Right) */}
          <div className="absolute bottom-4 right-4 z-20 flex flex-col items-end gap-2">
            {/* Dock Toggle Buttons */}
            <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-800 shadow-xl">
              <button
                onClick={() => setInstrumentTab(instrumentTab === 'DMM' ? 'NONE' : 'DMM')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                  instrumentTab === 'DMM'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Gauge className="w-3.5 h-3.5" />
                <span>MULTIMETER</span>
              </button>

              <button
                onClick={() => setInstrumentTab(instrumentTab === 'SCOPE' ? 'NONE' : 'SCOPE')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                  instrumentTab === 'SCOPE'
                    ? 'bg-emerald-500 text-slate-950 shadow-md'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>OSCILLOSCOPE</span>
              </button>
            </div>

            {/* Instrument View */}
            {instrumentTab === 'DMM' && (
              <MultimeterPanel
                state={multimeter}
                onModeChange={(mode) => setMultimeter((prev) => ({ ...prev, mode }))}
                onSelectProbe={(probe) => setActiveProbe(activeProbe === probe ? null : probe)}
                onClearProbes={() =>
                  setMultimeter((prev) => ({ ...prev, redProbeHoleId: undefined, blackProbeHoleId: undefined }))
                }
                activeProbe={activeProbe}
              />
            )}

            {instrumentTab === 'SCOPE' && (
              <OscilloscopePanel
                channel1Voltage={multimeter.reading}
                channel2Voltage={components[0]?.voltageDrop || 0}
                isSimulating={isSimulating}
              />
            )}
          </div>
        </div>

        {/* Right: Property Inspector & Telemetry Sidebar */}
        <PropertyInspector
          selectedComponent={selectedComp}
          onUpdateValue={(id, val) =>
            setComponents((prev) => prev.map((c) => (c.id === id ? { ...c, value: val } : c)))
          }
          onUpdateState={(id, newState) =>
            setComponents((prev) =>
              prev.map((c) => (c.id === id ? { ...c, state: { ...c.state, ...newState } } : c))
            )
          }
          onDeleteComponent={(id) => {
            setComponents((prev) => prev.filter((c) => c.id !== id));
            setSelectedComponentId(null);
          }}
        />
      </div>
    </div>
  );
}
