'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import TopToolbar, { WorkbenchTool, WIRE_COLORS } from '../components/TopToolbar';
import ComponentDrawer from '../components/ComponentDrawer';
import PropertyInspector from '../components/PropertyInspector';
import MultimeterPanel from '../components/MultimeterPanel';
import OscilloscopePanel from '../components/OscilloscopePanel';

const CircuitWorkbench3D = dynamic(() => import('../components/CircuitWorkbench3D'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#0a0b0e] text-zinc-400 font-mono text-xs select-none">
      <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mb-3" />
      <span className="tracking-widest">INITIALIZING OHMIC 3D WORKBENCH...</span>
    </div>
  ),
});

import {
  CircuitComponent,
  JumperWire,
  MultimeterState,
  ComponentType,
} from '../engine/componentTypes';
import { solveCircuit } from '../engine/circuitSolver';
import { getPresetCircuits, PresetCircuit } from '../presets/sampleCircuits';
import {
  getHolePosition,
  BREADBOARD_HOLES,
  rotateComponent,
  nudgeComponent,
  updateWiresForComponent,
} from '../engine/breadboardModel';
import { audioEngine } from '../engine/audioEngine';
import ControlsGuideModal from '../components/ControlsGuideModal';
import { Gauge, Activity } from 'lucide-react';

export default function OhmicWorkbenchPage() {
  const defaultPreset = getPresetCircuits()[0];

  // Circuit Simulation State
  const [components, setComponents] = useState<CircuitComponent[]>(defaultPreset.components);
  const [wires, setWires] = useState<JumperWire[]>(defaultPreset.wires);
  const [isSimulating, setIsSimulating] = useState(true);
  const [ambientTemperature, setAmbientTemperature] = useState(25);
  const [wireColor, setWireColor] = useState('#ef4444');
  const [isMuted, setIsMuted] = useState(false);

  // Active Tool & Mode
  const [activeTool, setActiveTool] = useState<WorkbenchTool>('SELECT');
  const [placingComponent, setPlacingComponent] = useState<{
    type: ComponentType;
    defaultValue?: number;
  } | null>(null);

  // Selected Entities
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [selectedWireId, setSelectedWireId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isControlsGuideOpen, setIsControlsGuideOpen] = useState(false);

  // Virtual Instruments State
  const [activeProbe, setActiveProbe] = useState<'RED' | 'BLACK' | null>(null);
  const [multimeter, setMultimeter] = useState<MultimeterState>({
    mode: 'VOLTS_DC',
    reading: 0,
    unit: 'V',
    isContinuous: false,
    redProbeHoleId: 'E19',
    blackProbeHoleId: 'TOP_NEG_5',
  });
  const [instrumentTab, setInstrumentTab] = useState<'DMM' | 'SCOPE' | 'NONE'>('DMM');

  // Simulation Solve Loop (20Hz real-time MNA solver)
  useEffect(() => {
    if (!isSimulating) return;

    const interval = setInterval(() => {
      const result = solveCircuit(components, wires, multimeter, ambientTemperature);
      setComponents(result.components);
      setWires(result.wires);
      setMultimeter(result.multimeter);

      // Acoustic WebAudio synthesis
      const speaker = result.components.find((c) => c.type === 'SPEAKER');
      if (speaker) {
        audioEngine.updateSpeaker(speaker.voltageDrop, 440);
      } else {
        audioEngine.updateSpeaker(0);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [components, wires, multimeter, ambientTemperature, isSimulating]);

  // Rotation Handler (supports CW and CCW with arrow keys and 'R')
  const handleRotateSelected = useCallback(
    (dir: 'CW' | 'CCW' = 'CW') => {
      if (!selectedComponentId) return;
      audioEngine.playKnobClick();
      setComponents((prev) => {
        const comp = prev.find((c) => c.id === selectedComponentId);
        if (!comp) return prev;
        const rotated = rotateComponent(comp, dir);
        const updated = prev.map((c) => (c.id === selectedComponentId ? rotated : c));
        setWires((prevWires) => updateWiresForComponent(rotated, updated, prevWires));
        return updated;
      });
    },
    [selectedComponentId]
  );

  // Movement Handler (step-by-step nudge on breadboard or workbench mat)
  const handleMoveSelected = useCallback(
    (deltaCol: number, deltaRow: number) => {
      if (!selectedComponentId) return;
      setComponents((prev) => {
        const comp = prev.find((c) => c.id === selectedComponentId);
        if (!comp) return prev;
        const nudged = nudgeComponent(comp, deltaCol, deltaRow);
        if (!nudged) return prev;
        audioEngine.playSnapSound();
        const updated = prev.map((c) => (c.id === selectedComponentId ? nudged : c));
        setWires((prevWires) => updateWiresForComponent(nudged, updated, prevWires));
        return updated;
      });
    },
    [selectedComponentId]
  );

  // Direct move handler for 3D mouse drag
  const handleMoveComponentDirect = useCallback((id: string, updatedComp: CircuitComponent) => {
    setComponents((prev) => {
      const updated = prev.map((c) => (c.id === id ? updatedComp : c));
      setWires((prevWires) => updateWiresForComponent(updatedComp, updated, prevWires));
      return updated;
    });
  }, []);

  // Deletion Handler
  const handleDeleteSelected = useCallback(() => {
    if (selectedComponentId) {
      setComponents((prev) => prev.filter((c) => c.id !== selectedComponentId));
      // Also clean up any jumper wires attached directly to this component
      setWires((prev) =>
        prev.filter(
          (w) =>
            !w.startHoleId.startsWith(`${selectedComponentId}:`) &&
            !w.endHoleId.startsWith(`${selectedComponentId}:`)
        )
      );
      setSelectedComponentId(null);
      audioEngine.playPopSound();
    } else if (selectedWireId) {
      setWires((prev) => prev.filter((w) => w.id !== selectedWireId));
      setSelectedWireId(null);
      audioEngine.playPopSound();
    }
  }, [selectedComponentId, selectedWireId]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsSimulating((prev) => !prev);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (selectedComponentId) {
          if (e.shiftKey) {
            handleMoveSelected(-1, 0); // Shift+Left: Move column left
          } else {
            handleRotateSelected('CCW'); // Left Arrow: Rotate 90° CCW
          }
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (selectedComponentId) {
          if (e.shiftKey) {
            handleMoveSelected(1, 0); // Shift+Right: Move column right
          } else {
            handleRotateSelected('CW'); // Right Arrow: Rotate 90° CW
          }
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (selectedComponentId) {
          handleMoveSelected(0, 1); // Up Arrow: Move row up
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (selectedComponentId) {
          handleMoveSelected(0, -1); // Down Arrow: Move row down
        }
      } else if (e.key === 'a' || e.key === 'A') {
        if (selectedComponentId) {
          handleMoveSelected(-1, 0);
        }
      } else if (e.key === 'd' || e.key === 'D') {
        if (selectedComponentId) {
          handleMoveSelected(1, 0);
        }
      } else if (e.key === 'w' || e.key === 'W') {
        if (selectedComponentId) {
          handleMoveSelected(0, 1);
        } else {
          setActiveTool('WIRE');
          setPlacingComponent(null);
        }
      } else if (e.key === 's' || e.key === 'S') {
        if (selectedComponentId) {
          handleMoveSelected(0, -1);
        }
      } else if (e.key === 'v' || e.key === 'V') {
        setActiveTool('SELECT');
        setPlacingComponent(null);
      } else if (e.key === 'c' || e.key === 'C') {
        setIsDrawerOpen((prev) => !prev);
      } else if (e.key === 'm' || e.key === 'M') {
        audioEngine.playKnobClick();
        setInstrumentTab((prev) => (prev === 'DMM' ? 'NONE' : 'DMM'));
      } else if (e.key === 'o' || e.key === 'O') {
        audioEngine.playKnobClick();
        setInstrumentTab((prev) => (prev === 'SCOPE' ? 'NONE' : 'SCOPE'));
      } else if (e.key === '?' || e.key === 'h' || e.key === 'H') {
        setIsControlsGuideOpen((prev) => !prev);
      } else if (e.key >= '1' && e.key <= '7') {
        const colorIdx = parseInt(e.key) - 1;
        if (WIRE_COLORS[colorIdx]) {
          setWireColor(WIRE_COLORS[colorIdx].hex);
          setActiveTool('WIRE');
          setPlacingComponent(null);
        }
      } else if (e.key === 'r' || e.key === 'R') {
        if (selectedComponentId) {
          handleRotateSelected('CW');
        }
      } else if (e.key === 'Escape') {
        setActiveTool('SELECT');
        setPlacingComponent(null);
        setSelectedComponentId(null);
        setSelectedWireId(null);
        setActiveProbe(null);
        setIsControlsGuideOpen(false);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        handleDeleteSelected();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedComponentId,
    selectedWireId,
    handleRotateSelected,
    handleMoveSelected,
    handleDeleteSelected,
  ]);

  // Wire creation handler
  const handleAddWire = useCallback(
    (startHoleId: string, endHoleId: string, color: string) => {
      const startPos = getHolePosition(startHoleId, components);
      const endPos = getHolePosition(endHoleId, components);
      if (!startPos || !endPos) return;

      const newWire: JumperWire = {
        id: `wire_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
        startHoleId,
        endHoleId,
        startPos,
        endPos,
        color,
        current: 0,
        voltage: 0,
      };

      setWires((prev) => [...prev, newWire]);
      setSelectedWireId(newWire.id);
      setSelectedComponentId(null);
    },
    [components]
  );

  // Component Placement Handler
  const handlePlaceComponent = useCallback(
    (
      type: ComponentType,
      holeIds: string[],
      rotationDeg: number,
      defaultValue: number = 1000,
      positionOverride?: [number, number, number]
    ) => {
      const id = `comp_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

      // Calculate 3D position
      let x = 0;
      let z = 0;
      let y = 0.012;

      if (positionOverride) {
        x = positionOverride[0];
        z = positionOverride[1];
        y = positionOverride[2];
      } else if (holeIds.length > 0) {
        const firstPos = getHolePosition(holeIds[0], components);
        const lastPos = getHolePosition(holeIds[holeIds.length - 1], components);
        x = firstPos && lastPos ? (firstPos[0] + lastPos[0]) / 2 : 0;
        z = firstPos && lastPos ? (firstPos[1] + lastPos[1]) / 2 : 0;
      } else if (type === 'BATTERY_9V') {
        x = -0.06;
        z = 0.055;
        y = 0.0;
      }

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
            { id: 'p1', name: 'Pin 1', relativePos: [-0.00508, 0, 0], connectedHoleId: holeIds[0] },
            { id: 'p2', name: 'Pin 2', relativePos: [0.00508, 0, 0], connectedHoleId: holeIds[1] },
          ];
          break;

        case 'LED':
          name = '5mm Red LED';
          modelUrl = '/models/components/led_5mm_red.glb';
          unit = 'Vf';
          pins = [
            { id: 'anode', name: 'ANODE', relativePos: [0.00127, 0, 0], connectedHoleId: holeIds[0] },
            { id: 'cathode', name: 'CATHODE', relativePos: [-0.00127, 0, 0], connectedHoleId: holeIds[1] },
          ];
          break;

        case 'BULB_INCANDESCENT':
          name = 'Incandescent Bulb';
          modelUrl = '/models/components/bulb_incandescent.glb';
          unit = 'Ω';
          pins = [
            { id: 't1', name: 'Terminal 1', relativePos: [-0.002, 0, 0], connectedHoleId: holeIds[0] },
            { id: 't2', name: 'Terminal 2', relativePos: [0.002, 0, 0], connectedHoleId: holeIds[1] },
          ];
          break;

        case 'BATTERY_9V':
          name = '9V Alkaline Battery';
          modelUrl = '/models/power/battery_9v.glb';
          unit = 'V';
          pins = [
            { id: 'pos', name: '+', relativePos: [0.0064, 0, 0.048], connectedHoleId: `${id}:pos` },
            { id: 'neg', name: '-', relativePos: [-0.0064, 0, 0.048], connectedHoleId: `${id}:neg` },
          ];
          break;

        case 'POTENTIOMETER':
          name = '10kΩ Potentiometer';
          modelUrl = '/models/components/potentiometer_10k.glb';
          unit = 'Ω';
          pins = [
            { id: 't1', name: 'T1', relativePos: [-0.00254, 0, 0], connectedHoleId: holeIds[0] },
            { id: 'w', name: 'WIPER', relativePos: [0, 0, 0], connectedHoleId: holeIds[1] },
            { id: 't2', name: 'T2', relativePos: [0.00254, 0, 0], connectedHoleId: holeIds[2] },
          ];
          break;

        case 'SPEAKER':
          name = '8Ω Mini Speaker';
          modelUrl = '/models/components/speaker_8ohm.glb';
          unit = 'Ω';
          pins = [
            { id: 'sp1', name: '+', relativePos: [-0.008, 0, 0], connectedHoleId: holeIds[0] },
            { id: 'sp2', name: '-', relativePos: [0.008, 0, 0], connectedHoleId: holeIds[1] },
          ];
          break;

        case 'CAPACITOR_ELECTROLYTIC':
          name = '100µF Capacitor';
          modelUrl = '/models/components/capacitor_electrolytic.glb';
          unit = 'µF';
          pins = [
            { id: 'cp1', name: '+', relativePos: [0.00127, 0, 0], connectedHoleId: holeIds[0] },
            { id: 'cp2', name: '-', relativePos: [-0.00127, 0, 0], connectedHoleId: holeIds[1] },
          ];
          break;

        case 'SWITCH_TACTILE':
          name = 'Tactile Pushbutton';
          modelUrl = '/models/components/button_tactile_6mm.glb';
          unit = 'sw';
          pins = [
            { id: 'sw1', name: 'Pin 1', relativePos: [-0.002, 0, 0], connectedHoleId: holeIds[0] },
            { id: 'sw2', name: 'Pin 2', relativePos: [0.002, 0, 0], connectedHoleId: holeIds[1] },
          ];
          break;

        default:
          name = `${type}`;
          unit = '';
          pins = holeIds.map((hid, idx) => ({
            id: `p${idx}`,
            name: `Pin ${idx + 1}`,
            relativePos: [idx * 0.00254, 0, 0] as [number, number, number],
            connectedHoleId: hid,
          }));
      }

      const newComp: CircuitComponent = {
        id,
        type,
        name,
        value: defaultValue,
        unit,
        position: [x, z, y],
        rotation: [0, (rotationDeg * Math.PI) / 180, 0],
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
      setSelectedWireId(null);
      setPlacingComponent(null);
      setActiveTool('SELECT');
    },
    [ambientTemperature]
  );


  // Select Preset Handler
  const handleSelectPreset = (preset: PresetCircuit) => {
    setComponents(preset.components);
    setWires(preset.wires);
    setSelectedComponentId(null);
    setSelectedWireId(null);
  };

  // Clear Canvas Handler
  const handleClear = () => {
    setComponents([]);
    setWires([]);
    setSelectedComponentId(null);
    setSelectedWireId(null);
  };

  const selectedComp = components.find((c) => c.id === selectedComponentId) || null;
  const selectedWire = wires.find((w) => w.id === selectedWireId) || null;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0a0b0e] text-zinc-100 font-sans select-none">
      {/* Top Application Bar & Tool Dock */}
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
        activeTool={activeTool}
        onSelectTool={(t) => {
          setActiveTool(t);
          if (t !== 'PLACE_COMPONENT') setPlacingComponent(null);
        }}
        onRotateSelected={selectedComponentId ? handleRotateSelected : undefined}
        onDeleteSelected={selectedComponentId || selectedWireId ? handleDeleteSelected : undefined}
        hasSelection={!!(selectedComponentId || selectedWireId)}
        isDrawerOpen={isDrawerOpen}
        onToggleDrawer={() => setIsDrawerOpen(!isDrawerOpen)}
        onOpenControlsGuide={() => setIsControlsGuideOpen(true)}
      />

      {/* Main Full-Screen 3D Workspace */}
      <main className="flex-1 relative w-full h-full overflow-hidden">
        {/* 3D Workbench Canvas */}
        <CircuitWorkbench3D
          components={components}
          wires={wires}
          multimeter={multimeter}
          wireColor={wireColor}
          isSimulating={isSimulating}
          activeTool={activeTool}
          placingComponent={placingComponent}
          onAddWire={handleAddWire}
          onPlaceComponent={handlePlaceComponent}
          onSelectComponent={(comp) => {
            setSelectedComponentId(comp ? comp.id : null);
            if (comp) setSelectedWireId(null);
          }}
          onSelectWire={(wire) => {
            setSelectedWireId(wire ? wire.id : null);
            if (wire) setSelectedComponentId(null);
          }}
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
          selectedComponentId={selectedComponentId}
          selectedWireId={selectedWireId}
          onCancelAction={() => {
            setPlacingComponent(null);
            setActiveTool('SELECT');
            setSelectedComponentId(null);
            setSelectedWireId(null);
          }}
          onMoveComponent={handleMoveComponentDirect}
          onOpenControlsGuide={() => setIsControlsGuideOpen(true)}
        />

        {/* Collapsible Left Component Catalog Drawer */}
        <ComponentDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          onStartPlacement={(type, defaultValue) => {
            setPlacingComponent({ type, defaultValue });
            setActiveTool('PLACE_COMPONENT');
            setIsDrawerOpen(false);
          }}
        />

        {/* Floating Right Inspector Panel */}
        <PropertyInspector
          selectedComponent={selectedComp}
          selectedWire={selectedWire}
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
            audioEngine.playPopSound();
          }}
          onDeleteWire={(id) => {
            setWires((prev) => prev.filter((w) => w.id !== id));
            setSelectedWireId(null);
            audioEngine.playPopSound();
          }}
          onRotateComponent={(_id, dir) => handleRotateSelected(dir)}
          onClose={() => {
            setSelectedComponentId(null);
            setSelectedWireId(null);
          }}
        />

        {/* Floating Virtual Instruments Dock (Bottom Right) */}
        <div className="absolute bottom-4 right-4 z-20 flex flex-col items-end gap-2 pointer-events-auto">
          {/* Instrument Toggle Pills */}
          <div className="flex items-center gap-1.5 glass-dock p-1.5 rounded-xl border border-white/[0.08] shadow-2xl">
            <button
              onClick={() => {
                audioEngine.playKnobClick();
                setInstrumentTab(instrumentTab === 'DMM' ? 'NONE' : 'DMM');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                instrumentTab === 'DMM'
                  ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              <Gauge className="w-3.5 h-3.5" />
              <span>MULTIMETER</span>
            </button>

            <button
              onClick={() => {
                audioEngine.playKnobClick();
                setInstrumentTab(instrumentTab === 'SCOPE' ? 'NONE' : 'SCOPE');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                instrumentTab === 'SCOPE'
                  ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>OSCILLOSCOPE</span>
            </button>
          </div>

          {/* DMM Hardware Panel */}
          {instrumentTab === 'DMM' && (
            <MultimeterPanel
              state={multimeter}
              onModeChange={(mode) => setMultimeter((prev) => ({ ...prev, mode }))}
              onSelectProbe={(probe) => setActiveProbe(activeProbe === probe ? null : probe)}
              onClearProbes={() =>
                setMultimeter((prev) => ({
                  ...prev,
                  redProbeHoleId: undefined,
                  blackProbeHoleId: undefined,
                }))
              }
              activeProbe={activeProbe}
              onClose={() => setInstrumentTab('NONE')}
            />
          )}

          {/* Oscilloscope Panel */}
          {instrumentTab === 'SCOPE' && (
            <OscilloscopePanel
              channel1Voltage={multimeter.reading}
              channel2Voltage={components[0]?.voltageDrop || 0}
              isSimulating={isSimulating}
              onClose={() => setInstrumentTab('NONE')}
            />
          )}
        </div>
      </main>

      {/* Interactive Controls & Shortcuts Guide Modal */}
      <ControlsGuideModal
        isOpen={isControlsGuideOpen}
        onClose={() => setIsControlsGuideOpen(false)}
      />
    </div>
  );
}
