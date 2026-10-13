'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import TopToolbar, { WorkbenchTool, WIRE_COLORS } from '../components/TopToolbar';
import ComponentDrawer from '../components/ComponentDrawer';
import PropertyInspector from '../components/PropertyInspector';
import MultimeterPanel from '../components/MultimeterPanel';
import OscilloscopePanel from '../components/OscilloscopePanel';
import CodeEditor from '../components/CodeEditor';
import ArduinoIDEModal from '../components/ArduinoIDEModal';
import { ARDUINO_TEMPLATES } from '../engine/arduinoRuntime';
import { CompiledCircuit } from '../dsl';

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
  getComponentDefaultElevation,
  isBenchComponent,
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
  const [activePresetId, setActivePresetId] = useState<string>('led_basic');
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [selectedWireId, setSelectedWireId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isControlsGuideOpen, setIsControlsGuideOpen] = useState(false);
  const [isDevModeOpen, setIsDevModeOpen] = useState(false);
  const [isArduinoIdeOpen, setIsArduinoIdeOpen] = useState(false);
  const [arduinoMcuId, setArduinoMcuId] = useState<string | null>(null);

  // Virtual Instruments State
  const [activeProbe, setActiveProbe] = useState<'RED' | 'BLACK' | null>(null);
  const [multimeter, setMultimeter] = useState<MultimeterState>({
    mode: 'VOLTS_DC',
    reading: 0,
    unit: 'V',
    isContinuous: false,
    redProbeHoleId: undefined,
    blackProbeHoleId: undefined,
  });
  const [instrumentTab, setInstrumentTab] = useState<'DMM' | 'SCOPE' | 'NONE'>('NONE');

  const multimeterRef = useRef(multimeter);
  useEffect(() => {
    multimeterRef.current = multimeter;
  }, [multimeter]);

  const componentsRef = useRef(components);
  const wiresRef = useRef(wires);
  useEffect(() => {
    componentsRef.current = components;
  }, [components]);
  useEffect(() => {
    wiresRef.current = wires;
  }, [wires]);

  // Simulation Solve Loop (20Hz real-time MNA solver)
  useEffect(() => {
    if (!isSimulating) return;

    const interval = setInterval(() => {
      const result = solveCircuit(componentsRef.current, wiresRef.current, multimeterRef.current, ambientTemperature);
      componentsRef.current = result.components;
      wiresRef.current = result.wires;
      setComponents(result.components);
      setWires(result.wires);
      setMultimeter(result.multimeter);

      // Acoustic WebAudio synthesis for Speaker and Active/Passive Buzzers
      const sounder = result.components.find(
        (c) =>
          (c.type === 'SPEAKER' || c.type === 'BUZZER_PASSIVE' || c.type === 'BUZZER_ACTIVE') &&
          c.health !== 'BURNED_OUT' &&
          c.voltageDrop > 0.05
      );

      if (sounder) {
        let freq = sounder.state?.frequency || 440;
        // Check if an MCU on the bench is outputting a tone frequency
        const mcuWithTone = result.components.find(
          (c) => (c.type === 'ARDUINO_NANO' || c.type === 'ARDUINO_UNO_R3') && (c.state?.arduinoState?.activeToneFreq ?? 0) > 0
        );
        if (mcuWithTone?.state?.arduinoState?.activeToneFreq) {
          freq = mcuWithTone.state.arduinoState.activeToneFreq;
        } else if (sounder.type === 'BUZZER_ACTIVE') {
          freq = 2400; // Fixed active piezo tone
        } else if (sounder.type === 'BUZZER_PASSIVE' && !sounder.state?.frequency) {
          freq = 1000;
        }
        audioEngine.updateSpeaker(sounder.voltageDrop, freq);
      } else {
        audioEngine.updateSpeaker(0);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [ambientTemperature, isSimulating]);

  // Rotation Handler (supports CW and CCW with 'R' and Shift+'R')
  const handleRotateSelected = useCallback(
    (dir: 'CW' | 'CCW' = 'CW') => {
      if (!selectedComponentId) return;
      audioEngine.playKnobClick();
      setComponents((prev) => {
        const comp = prev.find((c) => c.id === selectedComponentId);
        if (!comp) return prev;
        const rotated = rotateComponent(comp, dir);
        const updated = prev.map((c) => (c.id === selectedComponentId ? rotated : c));
        setWires((prevWires) => {
          const updatedWires = updateWiresForComponent(rotated, updated, prevWires);
          const result = solveCircuit(updated, updatedWires, multimeterRef.current, ambientTemperature);
          setMultimeter(result.multimeter);
          return result.wires;
        });
        return updated;
      });
    },
    [selectedComponentId, ambientTemperature]
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
        setWires((prevWires) => {
          const updatedWires = updateWiresForComponent(nudged, updated, prevWires);
          const result = solveCircuit(updated, updatedWires, multimeterRef.current, ambientTemperature);
          setMultimeter(result.multimeter);
          return result.wires;
        });
        return updated;
      });
    },
    [selectedComponentId, ambientTemperature]
  );

  // Direct move handler for 3D mouse drag
  const handleMoveComponentDirect = useCallback(
    (id: string, updatedComp: CircuitComponent) => {
      setComponents((prev) => {
        const updated = prev.map((c) => (c.id === id ? updatedComp : c));
        setWires((prevWires) => {
          const updatedWires = updateWiresForComponent(updatedComp, updated, prevWires);
          const result = solveCircuit(updated, updatedWires, multimeterRef.current, ambientTemperature);
          setMultimeter(result.multimeter);
          return result.wires;
        });
        return updated;
      });
    },
    [ambientTemperature]
  );

  // Unified Immediate Circuit Solver & State Synchronizer
  const applyCircuitUpdate = useCallback(
    (newComps: CircuitComponent[], newWires: JumperWire[]) => {
      componentsRef.current = newComps;
      wiresRef.current = newWires;
      const result = solveCircuit(newComps, newWires, multimeterRef.current, ambientTemperature);
      componentsRef.current = result.components;
      wiresRef.current = result.wires;
      setComponents(result.components);
      setWires(result.wires);
      setMultimeter(result.multimeter);
    },
    [ambientTemperature]
  );

  // Deletion Helpers
  const deleteComponentAndWires = useCallback(
    (id: string) => {
      const nextComponents = components.filter((c) => c.id !== id);
      const nextWires = wires.filter(
        (w) =>
          !w.startHoleId.startsWith(`${id}:`) &&
          !w.endHoleId.startsWith(`${id}:`)
      );
      applyCircuitUpdate(nextComponents, nextWires);
      setSelectedComponentId(null);
      audioEngine.playPopSound();
    },
    [components, wires, applyCircuitUpdate]
  );

  const handleDeleteSelected = useCallback(() => {
    if (selectedComponentId) {
      deleteComponentAndWires(selectedComponentId);
    } else if (selectedWireId) {
      const nextWires = wires.filter((w) => w.id !== selectedWireId);
      applyCircuitUpdate(components, nextWires);
      setSelectedWireId(null);
      audioEngine.playPopSound();
    }
  }, [selectedComponentId, selectedWireId, deleteComponentAndWires, components, wires, applyCircuitUpdate]);

  // Open Arduino IDE & Microcontroller Firmware Programmer Handler
  const handleOpenArduinoIDE = useCallback((mcu?: CircuitComponent) => {
    let target = mcu || null;
    if (!target) {
      target = components.find((c) => c.type === 'ARDUINO_NANO' || c.type === 'ARDUINO_UNO_R3' || c.type === 'ESP32_DEVKIT') || null;
    }
    if (!target) {
      // Auto-place an Arduino Nano across columns 10-24 if none exists yet!
      const col = 10;
      const holeIds: string[] = [];
      for (let i = 0; i < 15; i++) holeIds.push(`E${col + i}`);
      for (let i = 0; i < 15; i++) holeIds.push(`F${col + i}`);
      const newMcuId = `mcu_${Date.now()}`;
      const nanoDefs = [
        { id: 'd1',   name: 'D1 (TX)' },
        { id: 'd0',   name: 'D0 (RX)' },
        { id: 'rst',  name: 'RESET' },
        { id: 'gnd',  name: 'GND' },
        { id: 'd2',   name: 'D2' },
        { id: 'd3',   name: 'D3 (~PWM)' },
        { id: 'd4',   name: 'D4' },
        { id: 'd5',   name: 'D5 (~PWM)' },
        { id: 'd6',   name: 'D6 (~PWM)' },
        { id: 'd7',   name: 'D7' },
        { id: 'd8',   name: 'D8' },
        { id: 'd9',   name: 'D9 (~PWM)' },
        { id: 'd10',  name: 'D10 (~PWM)' },
        { id: 'd11',  name: 'D11 (~PWM)' },
        { id: 'd12',  name: 'D12' },
        { id: 'd13',  name: 'D13 (LED)' },
        { id: '3v3',  name: '3.3V Output' },
        { id: 'aref', name: 'AREF' },
        { id: 'a0',   name: 'A0' },
        { id: 'a1',   name: 'A1' },
        { id: 'a2',   name: 'A2' },
        { id: 'a3',   name: 'A3' },
        { id: 'a4',   name: 'A4 (SDA)' },
        { id: 'a5',   name: 'A5 (SCL)' },
        { id: 'a6',   name: 'A6' },
        { id: 'a7',   name: 'A7' },
        { id: '5v',   name: '5V Power' },
        { id: 'rst2', name: 'RESET' },
        { id: 'gnd2', name: 'GND' },
        { id: 'vin',  name: 'VIN' },
      ];
      const pins = holeIds.map((hid, idx) => {
        const def = nanoDefs[idx] || { id: `p${idx + 1}`, name: `Pin ${idx + 1}` };
        return {
          id: def.id,
          name: def.name,
          relativePos: [(idx % 15 - 7) * 0.00254, idx < 15 ? -0.00381 : 0.00381, 0] as [number, number, number],
          connectedHoleId: hid,
        };
      });

      const firstPos = getHolePosition(holeIds[0]);
      const lastPos = getHolePosition(holeIds[holeIds.length - 1]);
      const posX = firstPos && lastPos ? (firstPos[0] + lastPos[0]) / 2 : 0;
      const posZ = firstPos && lastPos ? (firstPos[1] + lastPos[1]) / 2 : 0;

      const newMcu: CircuitComponent = {
        id: newMcuId,
        type: 'ARDUINO_NANO',
        name: 'Arduino Nano V3 (ATmega328P)',
        value: 1,
        unit: 'MCU',
        position: [posX, posZ, 0.0062],
        rotation: [0, 0, 0],
        pins,
        state: {
          arduinoState: {
            sourceCode: ARDUINO_TEMPLATES[0].code,
            pins: {},
            isCompiled: true,
            isRunning: true,
            serialBuffer: ['[BOOT] ATmega328P initialized at 16MHz.', 'Ready to flash.'],
            activeToneFreq: 0,
            virtualMillis: 0,
          },
        },
        health: 'NORMAL',
        temperature: ambientTemperature,
        powerDissipated: 0,
        voltageDrop: 0,
        current: 0,
      };

      const next = [...components, newMcu];
      applyCircuitUpdate(next, wires);
      setSelectedComponentId(newMcuId);
      setArduinoMcuId(newMcuId);
      setIsArduinoIdeOpen(true);
      audioEngine.playSnapSound();
      return;
    }

    setArduinoMcuId(target.id);
    setSelectedComponentId(target.id);
    setIsArduinoIdeOpen(true);
    audioEngine.playKnobClick();
  }, [components, wires, ambientTemperature, applyCircuitUpdate]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsSimulating((prev) => !prev);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (selectedComponentId) {
          const step = e.shiftKey ? 5 : 1;
          handleMoveSelected(-step, 0); // Left Arrow: Move column left
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (selectedComponentId) {
          const step = e.shiftKey ? 5 : 1;
          handleMoveSelected(step, 0); // Right Arrow: Move column right
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (selectedComponentId) {
          const step = e.shiftKey ? 5 : 1;
          handleMoveSelected(0, -step); // Up Arrow: Move row up (towards Row A)
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (selectedComponentId) {
          const step = e.shiftKey ? 5 : 1;
          handleMoveSelected(0, step); // Down Arrow: Move row down (towards Row J)
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
          handleMoveSelected(0, -1);
        } else {
          setActiveTool('WIRE');
          setPlacingComponent(null);
        }
      } else if (e.key === 's' || e.key === 'S') {
        if (selectedComponentId) {
          handleMoveSelected(0, 1);
        }
      } else if (e.key === 'v' || e.key === 'V') {
        setActiveTool('SELECT');
        setPlacingComponent(null);
      } else if (e.key === 'c' || e.key === 'C') {
        setIsDrawerOpen((prev) => !prev);
      } else if (e.key === '`' || e.key === '~' || ((e.key === 'e' || e.key === 'E') && !selectedComponentId)) {
        setIsDevModeOpen((prev) => !prev);
      } else if ((e.key === 'i' || e.key === 'I') && !selectedComponentId) {
        handleOpenArduinoIDE();
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
          handleRotateSelected(e.shiftKey ? 'CCW' : 'CW');
        }
      } else if (e.key === 'Escape') {
        setActiveTool('SELECT');
        setPlacingComponent(null);
        setSelectedComponentId(null);
        setSelectedWireId(null);
        setActiveProbe(null);
        setIsControlsGuideOpen(false);
        setIsDevModeOpen(false);
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

      const nextWires = [...wires, newWire];
      applyCircuitUpdate(components, nextWires);
      setSelectedWireId(newWire.id);
      setSelectedComponentId(null);
    },
    [components, wires, applyCircuitUpdate]
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
      let y = getComponentDefaultElevation(type);

      if (positionOverride) {
        x = positionOverride[0];
        z = positionOverride[1];
        y = positionOverride[2];
      } else if (holeIds.length > 0) {
        const firstPos = getHolePosition(holeIds[0], components);
        const lastPos = getHolePosition(holeIds[holeIds.length - 1], components);
        x = firstPos && lastPos ? (firstPos[0] + lastPos[0]) / 2 : 0;
        z = firstPos && lastPos ? (firstPos[1] + lastPos[1]) / 2 : 0;
      } else if (isBenchComponent(type)) {
        x =
          type === 'SPEAKER'
            ? 0.065
            : type === 'DC_SOURCE'
            ? 0.055
            : type === 'BATTERY_HOLDER_4AA'
            ? -0.075
            : type === 'DC_GEAR_MOTOR'
            ? 0.08
            : type === 'SERVO_SG90'
            ? 0.07
            : type === 'RELAY_MODULE_5V'
            ? -0.065
            : type === 'KEYPAD_4X4'
            ? 0.08
            : type === 'ARDUINO_UNO_R3'
            ? -0.08
            : type === 'TOOL_SOLDERING_IRON'
            ? 0.09
            : -0.06;
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

        case 'DC_SOURCE':
          name = 'Bench DC Power Supply (5V)';
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
          name = '8Ω Mini Dynamic Speaker';
          modelUrl = '/models/components/speaker_8ohm.glb';
          unit = 'Ω';
          pins = [
            { id: 'pos', name: '+', relativePos: [-0.009, 0, 0.014], connectedHoleId: `${id}:pos` },
            { id: 'neg', name: '-', relativePos: [0.009, 0, 0.014], connectedHoleId: `${id}:neg` },
          ];
          break;

        case 'CAPACITOR_ELECTROLYTIC':
          name = '100µF Electrolytic Capacitor';
          modelUrl = '/models/components/capacitor_electrolytic.glb';
          unit = 'µF';
          pins = [
            { id: 'cp1', name: '+', relativePos: [0.00127, 0, 0], connectedHoleId: holeIds[0] },
            { id: 'cp2', name: '-', relativePos: [-0.00127, 0, 0], connectedHoleId: holeIds[1] },
          ];
          break;

        case 'CAPACITOR_CERAMIC':
          name = '0.1µF Ceramic Capacitor';
          modelUrl = '/models/components/capacitor_electrolytic.glb';
          unit = 'µF';
          pins = [
            { id: 'cp1', name: 'Pin 1', relativePos: [-0.00127, 0, 0], connectedHoleId: holeIds[0] },
            { id: 'cp2', name: 'Pin 2', relativePos: [0.00127, 0, 0], connectedHoleId: holeIds[1] },
          ];
          break;

        case 'INDUCTOR_TOROID':
          name = '10mH Toroid Inductor';
          modelUrl = '/models/components/inductor_toroid.glb';
          unit = 'mH';
          pins = [
            { id: 'l1', name: 'Pin 1', relativePos: [-0.00254, 0, 0], connectedHoleId: holeIds[0] },
            { id: 'l2', name: 'Pin 2', relativePos: [0.00254, 0, 0], connectedHoleId: holeIds[1] },
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

        case 'SWITCH_TOGGLE':
          name = 'Toggle Switch';
          modelUrl = '/models/components/button_tactile_6mm.glb';
          unit = 'sw';
          pins = [
            { id: 'sw1', name: 'Pin 1', relativePos: [-0.002, 0, 0], connectedHoleId: holeIds[0] },
            { id: 'sw2', name: 'Pin 2', relativePos: [0.002, 0, 0], connectedHoleId: holeIds[1] },
          ];
          break;

        case 'DIP8_555':
          name = 'NE555 Timer IC';
          modelUrl = '/models/components/dip8_ic.glb';
          unit = 'IC';
          pins = [
            { id: 'p1', name: 'GND (1)', relativePos: [-0.00381, -0.00381, 0], connectedHoleId: holeIds[0] },
            { id: 'p2', name: 'TRIG (2)', relativePos: [-0.00127, -0.00381, 0], connectedHoleId: holeIds[1] },
            { id: 'p3', name: 'OUT (3)', relativePos: [0.00127, -0.00381, 0], connectedHoleId: holeIds[2] },
            { id: 'p4', name: 'RESET (4)', relativePos: [0.00381, -0.00381, 0], connectedHoleId: holeIds[3] },
            { id: 'p5', name: 'CTRL (5)', relativePos: [-0.00381, 0.00381, 0], connectedHoleId: holeIds[4] },
            { id: 'p6', name: 'THRES (6)', relativePos: [-0.00127, 0.00381, 0], connectedHoleId: holeIds[5] },
            { id: 'p7', name: 'DISCH (7)', relativePos: [0.00127, 0.00381, 0], connectedHoleId: holeIds[6] },
            { id: 'p8', name: 'VCC (8)', relativePos: [0.00381, 0.00381, 0], connectedHoleId: holeIds[7] },
          ];
          break;

        case 'DISPLAY_7SEG':
          name = '7-Segment LED Display';
          modelUrl = '/models/components/display_7seg_1digit.glb';
          unit = 'DISP';
          pins = holeIds.map((hid, idx) => ({
            id: `p${idx + 1}`,
            name: `Pin ${idx + 1}`,
            relativePos: [(idx % 5 - 2) * 0.00254, idx < 5 ? -0.00381 : 0.00381, 0] as [number, number, number],
            connectedHoleId: hid,
          }));
          break;

        case 'DIODE_1N4148':
          name = '1N4148 Signal Diode';
          unit = 'Vf';
          pins = [
            { id: 'd1', name: 'ANODE (+)', relativePos: [-0.00381, 0, 0], connectedHoleId: holeIds[0] },
            { id: 'd2', name: 'CATHODE (-)', relativePos: [0.00381, 0, 0], connectedHoleId: holeIds[1] },
          ];
          break;

        case 'DIODE_1N4007':
          name = '1N4007 Rectifier Diode';
          unit = 'Vf';
          pins = [
            { id: 'd1', name: 'ANODE (+)', relativePos: [-0.00381, 0, 0], connectedHoleId: holeIds[0] },
            { id: 'd2', name: 'CATHODE (-)', relativePos: [0.00381, 0, 0], connectedHoleId: holeIds[1] },
          ];
          break;

        case 'TRANSISTOR_NPN_BC547':
          name = 'BC547 NPN Transistor';
          unit = 'hFE';
          pins = [
            { id: 'c', name: 'COLLECTOR', relativePos: [-0.00254, 0, 0], connectedHoleId: holeIds[0] },
            { id: 'b', name: 'BASE', relativePos: [0, 0, 0], connectedHoleId: holeIds[1] },
            { id: 'e', name: 'EMITTER', relativePos: [0.00254, 0, 0], connectedHoleId: holeIds[2] },
          ];
          break;

        case 'TRANSISTOR_PNP_BC557':
          name = 'BC557 PNP Transistor';
          unit = 'hFE';
          pins = [
            { id: 'c', name: 'COLLECTOR', relativePos: [-0.00254, 0, 0], connectedHoleId: holeIds[0] },
            { id: 'b', name: 'BASE', relativePos: [0, 0, 0], connectedHoleId: holeIds[1] },
            { id: 'e', name: 'EMITTER', relativePos: [0.00254, 0, 0], connectedHoleId: holeIds[2] },
          ];
          break;

        case 'TRANSISTOR_NPN_2N2222':
          name = '2N2222 NPN Transistor';
          unit = 'hFE';
          pins = [
            { id: 'e', name: 'EMITTER', relativePos: [-0.00254, 0, 0], connectedHoleId: holeIds[0] },
            { id: 'b', name: 'BASE', relativePos: [0, 0, 0], connectedHoleId: holeIds[1] },
            { id: 'c', name: 'COLLECTOR', relativePos: [0.00254, 0, 0], connectedHoleId: holeIds[2] },
          ];
          break;

        case 'MOSFET_N_LOGIC':
          name = 'Logic-Level N-MOSFET';
          unit = 'Vth';
          pins = [
            { id: 'g', name: 'GATE', relativePos: [-0.00254, 0, 0], connectedHoleId: holeIds[0] },
            { id: 'd', name: 'DRAIN', relativePos: [0, 0, 0], connectedHoleId: holeIds[1] },
            { id: 's', name: 'SOURCE', relativePos: [0.00254, 0, 0], connectedHoleId: holeIds[2] },
          ];
          break;

        case 'LDR_PHOTORESISTOR':
          name = 'CdS LDR Photoresistor';
          unit = 'Ω';
          pins = [
            { id: 'p1', name: 'Pin 1', relativePos: [-0.00127, 0, 0], connectedHoleId: holeIds[0] },
            { id: 'p2', name: 'Pin 2', relativePos: [0.00127, 0, 0], connectedHoleId: holeIds[1] },
          ];
          break;

        case 'DIP8_LM358':
          name = 'LM358 Dual Op-Amp';
          modelUrl = '/models/components/dip8_ic.glb';
          unit = 'IC';
          pins = [
            { id: 'p1', name: 'OUT1 (1)', relativePos: [-0.00381, -0.00381, 0], connectedHoleId: holeIds[0] },
            { id: 'p2', name: 'IN1- (2)', relativePos: [-0.00127, -0.00381, 0], connectedHoleId: holeIds[1] },
            { id: 'p3', name: 'IN1+ (3)', relativePos: [0.00127, -0.00381, 0], connectedHoleId: holeIds[2] },
            { id: 'p4', name: 'GND (4)', relativePos: [0.00381, -0.00381, 0], connectedHoleId: holeIds[3] },
            { id: 'p5', name: 'IN2+ (5)', relativePos: [-0.00381, 0.00381, 0], connectedHoleId: holeIds[4] },
            { id: 'p6', name: 'IN2- (6)', relativePos: [-0.00127, 0.00381, 0], connectedHoleId: holeIds[5] },
            { id: 'p7', name: 'OUT2 (7)', relativePos: [0.00127, 0.00381, 0], connectedHoleId: holeIds[6] },
            { id: 'p8', name: 'VCC (8)', relativePos: [0.00381, 0.00381, 0], connectedHoleId: holeIds[7] },
          ];
          break;

        case 'BATTERY_HOLDER_4AA':
          name = '4×AA Battery Holder (6V)';
          unit = 'V';
          pins = [
            { id: 'pos', name: '+ (6V)', relativePos: [0.0064, 0, 0.018], connectedHoleId: `${id}:pos` },
            { id: 'neg', name: '- (GND)', relativePos: [-0.0064, 0, 0.018], connectedHoleId: `${id}:neg` },
          ];
          break;

        case 'CAPACITOR_FILM':
          name = `${defaultValue}µF Film Capacitor`;
          unit = 'µF';
          pins = [
            { id: 'cp1', name: 'Pin 1', relativePos: [-0.00254, 0, 0], connectedHoleId: holeIds[0] },
            { id: 'cp2', name: 'Pin 2', relativePos: [0.00254, 0, 0], connectedHoleId: holeIds[1] },
          ];
          break;

        case 'LED_RGB':
          name = '5mm RGB LED (Common Cathode)';
          unit = 'RGB';
          pins = [
            { id: 'r', name: 'RED Anode', relativePos: [-0.00381, 0, 0], connectedHoleId: holeIds[0] },
            { id: 'c', name: 'CATHODE (GND)', relativePos: [-0.00127, 0, 0], connectedHoleId: holeIds[1] },
            { id: 'g', name: 'GREEN Anode', relativePos: [0.00127, 0, 0], connectedHoleId: holeIds[2] },
            { id: 'b', name: 'BLUE Anode', relativePos: [0.00381, 0, 0], connectedHoleId: holeIds[3] },
          ];
          break;

        case 'BUZZER_ACTIVE':
          name = 'Active Buzzer (5V, 2.4kHz)';
          unit = 'Hz';
          pins = [
            { id: 'pos', name: '+ (VCC)', relativePos: [0.00254, 0, 0], connectedHoleId: holeIds[0] },
            { id: 'neg', name: '- (GND)', relativePos: [-0.00254, 0, 0], connectedHoleId: holeIds[1] },
          ];
          break;

        case 'BUZZER_PASSIVE':
          name = 'Passive Piezo Buzzer';
          unit = 'Ω';
          pins = [
            { id: 'pos', name: 'Pin 1 (+)', relativePos: [0.00254, 0, 0], connectedHoleId: holeIds[0] },
            { id: 'neg', name: 'Pin 2 (-)', relativePos: [-0.00254, 0, 0], connectedHoleId: holeIds[1] },
          ];
          break;

        case 'SWITCH_SLIDE':
          name = 'SPDT Slide Switch';
          unit = 'sw';
          pins = [
            { id: 'sw1', name: 'Terminal 1', relativePos: [-0.00254, 0, 0], connectedHoleId: holeIds[0] },
            { id: 'com', name: 'COMMON', relativePos: [0, 0, 0], connectedHoleId: holeIds[1] },
            { id: 'sw2', name: 'Terminal 2', relativePos: [0.00254, 0, 0], connectedHoleId: holeIds[2] },
          ];
          break;

        case 'DIP8_LM393':
          name = 'LM393 Dual Comparator';
          unit = 'IC';
          pins = [
            { id: 'p1', name: 'OUT1 (1)', relativePos: [-0.00381, -0.00381, 0], connectedHoleId: holeIds[0] },
            { id: 'p2', name: 'IN1- (2)', relativePos: [-0.00127, -0.00381, 0], connectedHoleId: holeIds[1] },
            { id: 'p3', name: 'IN1+ (3)', relativePos: [0.00127, -0.00381, 0], connectedHoleId: holeIds[2] },
            { id: 'p4', name: 'GND (4)', relativePos: [0.00381, -0.00381, 0], connectedHoleId: holeIds[3] },
            { id: 'p5', name: 'IN2+ (5)', relativePos: [-0.00381, 0.00381, 0], connectedHoleId: holeIds[4] },
            { id: 'p6', name: 'IN2- (6)', relativePos: [-0.00127, 0.00381, 0], connectedHoleId: holeIds[5] },
            { id: 'p7', name: 'OUT2 (7)', relativePos: [0.00127, 0.00381, 0], connectedHoleId: holeIds[6] },
            { id: 'p8', name: 'VCC (8)', relativePos: [0.00381, 0.00381, 0], connectedHoleId: holeIds[7] },
          ];
          break;

        case 'DIP16_CD4017':
          name = 'CD4017 Decade Counter IC';
          unit = 'IC';
          pins = [
            { id: 'p1', name: 'Q5 (1)', relativePos: [-0.00889, -0.00381, 0], connectedHoleId: holeIds[0] },
            { id: 'p2', name: 'Q1 (2)', relativePos: [-0.00635, -0.00381, 0], connectedHoleId: holeIds[1] },
            { id: 'p3', name: 'Q0 (3)', relativePos: [-0.00381, -0.00381, 0], connectedHoleId: holeIds[2] },
            { id: 'p4', name: 'Q2 (4)', relativePos: [-0.00127, -0.00381, 0], connectedHoleId: holeIds[3] },
            { id: 'p5', name: 'Q6 (5)', relativePos: [0.00127, -0.00381, 0], connectedHoleId: holeIds[4] },
            { id: 'p6', name: 'Q7 (6)', relativePos: [0.00381, -0.00381, 0], connectedHoleId: holeIds[5] },
            { id: 'p7', name: 'Q3 (7)', relativePos: [0.00635, -0.00381, 0], connectedHoleId: holeIds[6] },
            { id: 'p8', name: 'GND/VSS (8)', relativePos: [0.00889, -0.00381, 0], connectedHoleId: holeIds[7] },
            { id: 'p9', name: 'Q8 (9)', relativePos: [-0.00889, 0.00381, 0], connectedHoleId: holeIds[8] },
            { id: 'p10', name: 'Q4 (10)', relativePos: [-0.00635, 0.00381, 0], connectedHoleId: holeIds[9] },
            { id: 'p11', name: 'Q9 (11)', relativePos: [-0.00381, 0.00381, 0], connectedHoleId: holeIds[10] },
            { id: 'p12', name: 'CO Carry (12)', relativePos: [-0.00127, 0.00381, 0], connectedHoleId: holeIds[11] },
            { id: 'p13', name: 'CE Inh (13)', relativePos: [0.00127, 0.00381, 0], connectedHoleId: holeIds[12] },
            { id: 'p14', name: 'CLK (14)', relativePos: [0.00381, 0.00381, 0], connectedHoleId: holeIds[13] },
            { id: 'p15', name: 'RESET (15)', relativePos: [0.00635, 0.00381, 0], connectedHoleId: holeIds[14] },
            { id: 'p16', name: 'VDD (16)', relativePos: [0.00889, 0.00381, 0], connectedHoleId: holeIds[15] },
          ];
          break;

        case 'DIP16_74HC595':
          name = '74HC595 8-Bit Shift Register';
          unit = 'IC';
          pins = [
            { id: 'p1', name: 'QB (1)', relativePos: [-0.00889, -0.00381, 0], connectedHoleId: holeIds[0] },
            { id: 'p2', name: 'QC (2)', relativePos: [-0.00635, -0.00381, 0], connectedHoleId: holeIds[1] },
            { id: 'p3', name: 'QD (3)', relativePos: [-0.00381, -0.00381, 0], connectedHoleId: holeIds[2] },
            { id: 'p4', name: 'QE (4)', relativePos: [-0.00127, -0.00381, 0], connectedHoleId: holeIds[3] },
            { id: 'p5', name: 'QF (5)', relativePos: [0.00127, -0.00381, 0], connectedHoleId: holeIds[4] },
            { id: 'p6', name: 'QG (6)', relativePos: [0.00381, -0.00381, 0], connectedHoleId: holeIds[5] },
            { id: 'p7', name: 'QH (7)', relativePos: [0.00635, -0.00381, 0], connectedHoleId: holeIds[6] },
            { id: 'p8', name: 'GND (8)', relativePos: [0.00889, -0.00381, 0], connectedHoleId: holeIds[7] },
            { id: 'p9', name: "QH' (9)", relativePos: [-0.00889, 0.00381, 0], connectedHoleId: holeIds[8] },
            { id: 'p10', name: 'SRCLR (10)', relativePos: [-0.00635, 0.00381, 0], connectedHoleId: holeIds[9] },
            { id: 'p11', name: 'SRCLK (11)', relativePos: [-0.00381, 0.00381, 0], connectedHoleId: holeIds[10] },
            { id: 'p12', name: 'RCLK (12)', relativePos: [-0.00127, 0.00381, 0], connectedHoleId: holeIds[11] },
            { id: 'p13', name: 'OE (13)', relativePos: [0.00127, 0.00381, 0], connectedHoleId: holeIds[12] },
            { id: 'p14', name: 'SER (14)', relativePos: [0.00381, 0.00381, 0], connectedHoleId: holeIds[13] },
            { id: 'p15', name: 'QA (15)', relativePos: [0.00635, 0.00381, 0], connectedHoleId: holeIds[14] },
            { id: 'p16', name: 'VCC (16)', relativePos: [0.00889, 0.00381, 0], connectedHoleId: holeIds[15] },
          ];
          break;

        case 'DIP16_L293D':
          name = 'L293D Dual H-Bridge Motor Driver';
          unit = 'IC';
          pins = [
            { id: 'p1', name: '1,2EN (1)', relativePos: [-0.00889, -0.00381, 0], connectedHoleId: holeIds[0] },
            { id: 'p2', name: '1A (2)', relativePos: [-0.00635, -0.00381, 0], connectedHoleId: holeIds[1] },
            { id: 'p3', name: '1Y (3)', relativePos: [-0.00381, -0.00381, 0], connectedHoleId: holeIds[2] },
            { id: 'p4', name: 'GND (4)', relativePos: [-0.00127, -0.00381, 0], connectedHoleId: holeIds[3] },
            { id: 'p5', name: 'GND (5)', relativePos: [0.00127, -0.00381, 0], connectedHoleId: holeIds[4] },
            { id: 'p6', name: '2Y (6)', relativePos: [0.00381, -0.00381, 0], connectedHoleId: holeIds[5] },
            { id: 'p7', name: '2A (7)', relativePos: [0.00635, -0.00381, 0], connectedHoleId: holeIds[6] },
            { id: 'p8', name: 'VCC2 Motor (8)', relativePos: [0.00889, -0.00381, 0], connectedHoleId: holeIds[7] },
            { id: 'p9', name: '3,4EN (9)', relativePos: [-0.00889, 0.00381, 0], connectedHoleId: holeIds[8] },
            { id: 'p10', name: '3A (10)', relativePos: [-0.00635, 0.00381, 0], connectedHoleId: holeIds[9] },
            { id: 'p11', name: '3Y (11)', relativePos: [-0.00381, 0.00381, 0], connectedHoleId: holeIds[10] },
            { id: 'p12', name: 'GND (12)', relativePos: [-0.00127, 0.00381, 0], connectedHoleId: holeIds[11] },
            { id: 'p13', name: 'GND (13)', relativePos: [0.00127, 0.00381, 0], connectedHoleId: holeIds[12] },
            { id: 'p14', name: '4Y (14)', relativePos: [0.00381, 0.00381, 0], connectedHoleId: holeIds[13] },
            { id: 'p15', name: '4A (15)', relativePos: [0.00635, 0.00381, 0], connectedHoleId: holeIds[14] },
            { id: 'p16', name: 'VCC1 Logic (16)', relativePos: [0.00889, 0.00381, 0], connectedHoleId: holeIds[15] },
          ];
          break;

        case 'MODULE_TB6612FNG':
          name = 'TB6612FNG Dual Motor Driver';
          unit = 'MOD';
          pins = holeIds.map((hid, idx) => ({
            id: `p${idx + 1}`,
            name: `Pin ${idx + 1}`,
            relativePos: [(idx % 8 - 3.5) * 0.00254, idx < 8 ? -0.00381 : 0.00381, 0] as [number, number, number],
            connectedHoleId: hid,
          }));
          break;

        case 'RELAY_MODULE_5V':
          name = '5V 1-Channel Relay Module';
          unit = 'RELAY';
          pins = [
            { id: 'vcc', name: 'VCC (5V)', relativePos: [-0.007, 0, 0.016], connectedHoleId: `${id}:vcc` },
            { id: 'gnd', name: 'GND', relativePos: [-0.0035, 0, 0.016], connectedHoleId: `${id}:gnd` },
            { id: 'in', name: 'IN', relativePos: [0, 0, 0.016], connectedHoleId: `${id}:in` },
            { id: 'no', name: 'NO', relativePos: [0.0035, 0, 0.016], connectedHoleId: `${id}:no` },
            { id: 'com', name: 'COM', relativePos: [0.007, 0, 0.016], connectedHoleId: `${id}:com` },
            { id: 'nc', name: 'NC', relativePos: [0.0105, 0, 0.016], connectedHoleId: `${id}:nc` },
          ];
          break;

        case 'SERVO_SG90':
          name = 'SG90 Micro Servo (9g)';
          unit = 'deg';
          pins = [
            { id: 'gnd', name: 'GND (Brown)', relativePos: [-0.00254, 0, 0.018], connectedHoleId: `${id}:gnd` },
            { id: 'vcc', name: 'VCC (Red, 5V)', relativePos: [0, 0, 0.018], connectedHoleId: `${id}:vcc` },
            { id: 'sig', name: 'PWM SIG (Orange)', relativePos: [0.00254, 0, 0.018], connectedHoleId: `${id}:sig` },
          ];
          break;

        case 'DC_GEAR_MOTOR':
          name = 'TT DC Gearbox Motor + Wheel';
          unit = 'RPM';
          pins = [
            { id: 'pos', name: 'Motor +', relativePos: [-0.009, 0, 0.014], connectedHoleId: `${id}:pos` },
            { id: 'neg', name: 'Motor -', relativePos: [0.009, 0, 0.014], connectedHoleId: `${id}:neg` },
          ];
          break;

        case 'WS2812B_STRIP':
          name = 'WS2812B Addressable RGB LED (8-LED Strip)';
          unit = 'RGB';
          pins = [
            { id: 'din', name: 'DIN (Data)', relativePos: [-0.00254, 0, 0], connectedHoleId: holeIds[0] },
            { id: 'vcc', name: '+5V Power', relativePos: [0, 0, 0], connectedHoleId: holeIds[1] },
            { id: 'gnd', name: 'GND', relativePos: [0.00254, 0, 0], connectedHoleId: holeIds[2] },
          ];
          break;

        case 'MOSFET_DRIVER_MODULE':
          name = 'High-Power MOSFET Driver Switch Module';
          unit = 'PWM';
          pins = [
            { id: 'sig', name: 'PWM / TRIG', relativePos: [-0.00381, 0, 0], connectedHoleId: holeIds[0] },
            { id: 'gnd', name: 'GND', relativePos: [-0.00127, 0, 0], connectedHoleId: holeIds[1] },
            { id: 'vin', name: 'VIN+ (Power)', relativePos: [0.00127, 0, 0], connectedHoleId: holeIds[2] },
            { id: 'vout', name: 'LOAD- (Switch)', relativePos: [0.00381, 0, 0], connectedHoleId: holeIds[3] },
          ];
          break;

        case 'ROTARY_ENCODER_KY040':
          name = 'KY-040 Rotary Encoder Module';
          unit = 'PULSE';
          pins = [
            { id: 'clk', name: 'CLK', relativePos: [-0.00508, 0, 0], connectedHoleId: holeIds[0] },
            { id: 'dt', name: 'DT', relativePos: [-0.00254, 0, 0], connectedHoleId: holeIds[1] },
            { id: 'sw', name: 'SW (Pushbutton)', relativePos: [0, 0, 0], connectedHoleId: holeIds[2] },
            { id: 'vcc', name: '+ (5V)', relativePos: [0.00254, 0, 0], connectedHoleId: holeIds[3] },
            { id: 'gnd', name: 'GND', relativePos: [0.00508, 0, 0], connectedHoleId: holeIds[4] },
          ];
          break;

        case 'KEYPAD_4X4':
          name = '4×4 Matrix Keypad (16-Key)';
          unit = 'KEY';
          pins = ['r1', 'r2', 'r3', 'r4', 'c1', 'c2', 'c3', 'c4'].map((col, idx) => ({
            id: col,
            name: `Row/Col ${col.toUpperCase()}`,
            relativePos: [(idx - 3.5) * 0.0035, 0, 0.006] as [number, number, number],
            connectedHoleId: `${id}:${col}`,
          }));
          break;

        case 'REGULATOR_AMS1117_3V3':
          name = 'AMS1117-3.3V LDO Voltage Regulator';
          unit = 'V';
          pins = [
            { id: 'gnd', name: 'GND (1)', relativePos: [-0.00254, 0, 0], connectedHoleId: holeIds[0] },
            { id: 'out', name: 'VOUT 3.3V (2)', relativePos: [0, 0, 0], connectedHoleId: holeIds[1] },
            { id: 'in', name: 'VIN (3)', relativePos: [0.00254, 0, 0], connectedHoleId: holeIds[2] },
          ];
          break;

        case 'SCREW_TERMINAL_2P':
          name = '2-Pin 5mm Screw Terminal Block';
          unit = 'TERM';
          pins = [
            { id: 't1', name: 'Terminal 1', relativePos: [-0.00254, 0, 0], connectedHoleId: holeIds[0] },
            { id: 't2', name: 'Terminal 2', relativePos: [0.00254, 0, 0], connectedHoleId: holeIds[1] },
          ];
          break;

        case 'IC_SOCKET_DIP':
          name = '16-Pin DIP IC Socket';
          unit = 'DIP';
          pins = holeIds.map((hid, idx) => ({
            id: `p${idx + 1}`,
            name: `Socket Pin ${idx + 1}`,
            relativePos: [(idx % 8 - 3.5) * 0.00254, idx < 8 ? -0.00381 : 0.00381, 0] as [number, number, number],
            connectedHoleId: hid,
          }));
          break;

        case 'SENSOR_HC_SR04':
          name = 'HC-SR04 Ultrasonic Distance Sensor';
          unit = 'cm';
          pins = [
            { id: 'vcc', name: 'VCC (5V)', relativePos: [-0.00381, 0, 0], connectedHoleId: holeIds[0] },
            { id: 'trig', name: 'TRIG', relativePos: [-0.00127, 0, 0], connectedHoleId: holeIds[1] },
            { id: 'echo', name: 'ECHO', relativePos: [0.00127, 0, 0], connectedHoleId: holeIds[2] },
            { id: 'gnd', name: 'GND', relativePos: [0.00381, 0, 0], connectedHoleId: holeIds[3] },
          ];
          break;

        case 'SENSOR_DHT22':
          name = 'DHT22 / AM2302 Temp & Humidity Sensor';
          unit = '°C';
          pins = [
            { id: 'vcc', name: 'VCC (3.3-5V)', relativePos: [-0.00254, 0, 0], connectedHoleId: holeIds[0] },
            { id: 'data', name: 'DATA Out', relativePos: [0, 0, 0], connectedHoleId: holeIds[1] },
            { id: 'gnd', name: 'GND', relativePos: [0.00254, 0, 0], connectedHoleId: holeIds[2] },
          ];
          break;

        case 'SENSOR_PIR':
          name = 'HC-SR501 PIR Motion Sensor';
          unit = 'PIR';
          pins = [
            { id: 'vcc', name: 'VCC (5V)', relativePos: [-0.00254, 0, 0], connectedHoleId: holeIds[0] },
            { id: 'out', name: 'OUT (3.3V TTL)', relativePos: [0, 0, 0], connectedHoleId: holeIds[1] },
            { id: 'gnd', name: 'GND', relativePos: [0.00254, 0, 0], connectedHoleId: holeIds[2] },
          ];
          break;

        case 'SENSOR_SOUND':
          name = 'Microphone Sound Sensor Module';
          unit = 'dB';
          pins = [
            { id: 'vcc', name: 'VCC', relativePos: [-0.00254, 0, 0], connectedHoleId: holeIds[0] },
            { id: 'out', name: 'OUT (Analog)', relativePos: [0, 0, 0], connectedHoleId: holeIds[1] },
            { id: 'gnd', name: 'GND', relativePos: [0.00254, 0, 0], connectedHoleId: holeIds[2] },
          ];
          break;

        case 'SENSOR_SOIL':
          name = 'Capacitive Soil Moisture Sensor';
          unit = '%';
          pins = [
            { id: 'vcc', name: 'VCC', relativePos: [-0.00254, 0, 0], connectedHoleId: holeIds[0] },
            { id: 'sig', name: 'SIG (Analog Out)', relativePos: [0, 0, 0], connectedHoleId: holeIds[1] },
            { id: 'gnd', name: 'GND', relativePos: [0.00254, 0, 0], connectedHoleId: holeIds[2] },
          ];
          break;

        case 'SENSOR_IR_RECEIVER':
          name = 'VS1838B 38kHz IR Receiver Module';
          unit = 'IR';
          pins = [
            { id: 'out', name: 'DATA OUT', relativePos: [-0.00254, 0, 0], connectedHoleId: holeIds[0] },
            { id: 'gnd', name: 'GND', relativePos: [0, 0, 0], connectedHoleId: holeIds[1] },
            { id: 'vcc', name: 'VCC (5V)', relativePos: [0.00254, 0, 0], connectedHoleId: holeIds[2] },
          ];
          break;

        case 'SENSOR_HALL':
          name = 'A3144 Hall Effect Magnetic Sensor';
          unit = 'MAG';
          pins = [
            { id: 'vcc', name: 'VCC (5V)', relativePos: [-0.00254, 0, 0], connectedHoleId: holeIds[0] },
            { id: 'gnd', name: 'GND', relativePos: [0, 0, 0], connectedHoleId: holeIds[1] },
            { id: 'out', name: 'OUT', relativePos: [0.00254, 0, 0], connectedHoleId: holeIds[2] },
          ];
          break;

        case 'DISPLAY_OLED_I2C':
          name = '0.96" SSD1306 128×64 I2C OLED Display';
          unit = 'OLED';
          pins = [
            { id: 'gnd', name: 'GND', relativePos: [-0.00381, 0, 0], connectedHoleId: holeIds[0] },
            { id: 'vcc', name: 'VCC (3.3-5V)', relativePos: [-0.00127, 0, 0], connectedHoleId: holeIds[1] },
            { id: 'scl', name: 'SCL (Clock)', relativePos: [0.00127, 0, 0], connectedHoleId: holeIds[2] },
            { id: 'sda', name: 'SDA (Data)', relativePos: [0.00381, 0, 0], connectedHoleId: holeIds[3] },
          ];
          break;

        case 'DISPLAY_LCD_1602_I2C':
          name = '16×2 Character LCD (I2C Backpack)';
          unit = 'LCD';
          pins = [
            { id: 'gnd', name: 'GND', relativePos: [-0.00381, 0, 0], connectedHoleId: holeIds[0] },
            { id: 'vcc', name: 'VCC (5V)', relativePos: [-0.00127, 0, 0], connectedHoleId: holeIds[1] },
            { id: 'sda', name: 'SDA (Data)', relativePos: [0.00127, 0, 0], connectedHoleId: holeIds[2] },
            { id: 'scl', name: 'SCL (Clock)', relativePos: [0.00381, 0, 0], connectedHoleId: holeIds[3] },
          ];
          break;

        case 'ARDUINO_NANO': {
          name = 'Arduino Nano V3 (ATmega328P)';
          unit = 'MCU';
          const nanoDefs = [
            { id: 'd1',   name: 'D1 (TX)' },
            { id: 'd0',   name: 'D0 (RX)' },
            { id: 'rst',  name: 'RESET' },
            { id: 'gnd',  name: 'GND' },
            { id: 'd2',   name: 'D2' },
            { id: 'd3',   name: 'D3 (~PWM)' },
            { id: 'd4',   name: 'D4' },
            { id: 'd5',   name: 'D5 (~PWM)' },
            { id: 'd6',   name: 'D6 (~PWM)' },
            { id: 'd7',   name: 'D7' },
            { id: 'd8',   name: 'D8' },
            { id: 'd9',   name: 'D9 (~PWM)' },
            { id: 'd10',  name: 'D10 (~PWM)' },
            { id: 'd11',  name: 'D11 (~PWM)' },
            { id: 'd12',  name: 'D12' },
            { id: 'd13',  name: 'D13 (LED)' },
            { id: '3v3',  name: '3.3V Output' },
            { id: 'aref', name: 'AREF' },
            { id: 'a0',   name: 'A0' },
            { id: 'a1',   name: 'A1' },
            { id: 'a2',   name: 'A2' },
            { id: 'a3',   name: 'A3' },
            { id: 'a4',   name: 'A4 (SDA)' },
            { id: 'a5',   name: 'A5 (SCL)' },
            { id: 'a6',   name: 'A6' },
            { id: 'a7',   name: 'A7' },
            { id: '5v',   name: '5V Power' },
            { id: 'rst2', name: 'RESET' },
            { id: 'gnd2', name: 'GND' },
            { id: 'vin',  name: 'VIN' },
          ];
          pins = holeIds.map((hid, idx) => {
            const def = nanoDefs[idx] || { id: `pin_${idx + 1}`, name: `Pin ${idx + 1}` };
            return {
              id: def.id,
              name: def.name,
              relativePos: [(idx % 15 - 7) * 0.00254, idx < 15 ? -0.00381 : 0.00381, 0] as [number, number, number],
              connectedHoleId: hid,
            };
          });
          break;
        }

        case 'ESP32_DEVKIT':
          name = 'ESP32 NodeMCU DevKit V1 (Wi-Fi + BLE)';
          unit = 'MCU';
          pins = holeIds.map((hid, idx) => ({
            id: `pin_${idx + 1}`,
            name: idx === 0 ? '3V3 Output' : idx === 1 ? 'GND' : idx === 14 ? 'VIN (5V)' : `DIP Pin ${idx + 1}`,
            relativePos: [(idx % 15 - 7) * 0.00254, idx < 15 ? -0.00381 : 0.00381, 0] as [number, number, number],
            connectedHoleId: hid,
          }));
          break;

        case 'ARDUINO_UNO_R3':
          name = 'Arduino Uno R3 Microcontroller Board';
          unit = 'MCU';
          pins = [
            { id: '5v', name: '5V Power Output', relativePos: [-0.02, 0, 0.014], connectedHoleId: `${id}:5v` },
            { id: '3v3', name: '3.3V Output', relativePos: [-0.015, 0, 0.014], connectedHoleId: `${id}:3v3` },
            { id: 'gnd', name: 'GND Ground', relativePos: [-0.01, 0, 0.014], connectedHoleId: `${id}:gnd` },
            { id: 'vin', name: 'VIN Power Input', relativePos: [-0.005, 0, 0.014], connectedHoleId: `${id}:vin` },
          ];
          break;

        case 'TOOL_SOLDERING_IRON':
          name = 'ESD Soldering Iron Station';
          unit = '°C';
          pins = [];
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

      let compState: CircuitComponent['state'] | undefined = undefined;
      if (type === 'ARDUINO_NANO' || type === 'ARDUINO_UNO_R3') {
        compState = {
          arduinoState: {
            sourceCode: ARDUINO_TEMPLATES[0].code,
            pins: {},
            isCompiled: true,
            isRunning: true,
            serialBuffer: ['[BOOT] ATmega328P initialized at 16MHz.', 'Ready to flash.'],
            activeToneFreq: 0,
            virtualMillis: 0,
          },
        };
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
        state: compState,
        voltageDrop: 0,
        current: 0,
        powerDissipated: 0,
        temperature: ambientTemperature,
        health: 'NORMAL',
        maxPowerRating:
          type === 'BULB_INCANDESCENT'
            ? 5.0
            : type === 'SPEAKER'
            ? 15.0
            : type === 'POTENTIOMETER'
            ? 1.0
            : 0.25,
      };

      const nextComponents = [...components, newComp];
      applyCircuitUpdate(nextComponents, wires);
      setSelectedComponentId(id);
      setSelectedWireId(null);
      setPlacingComponent(null);
      setActiveTool('SELECT');
    },
    [components, wires, ambientTemperature, applyCircuitUpdate]
  );


  // Select Preset Handler
  const handleSelectPreset = useCallback((preset: PresetCircuit) => {
    setActivePresetId(preset.id);
    const freshComponents: CircuitComponent[] = JSON.parse(JSON.stringify(preset.components));
    const freshWires: JumperWire[] = JSON.parse(JSON.stringify(preset.wires));
    applyCircuitUpdate(freshComponents, freshWires);
    setSelectedComponentId(null);
    setSelectedWireId(null);
  }, [applyCircuitUpdate]);

  // Apply OhmScript Compiled Circuit Handler
  const handleApplyCompiledCircuit = useCallback(
    (compiled: CompiledCircuit) => {
      setActivePresetId('');
      setAmbientTemperature(compiled.ambientTemperature);
      setIsSimulating(compiled.simulationEnabled);

      if (compiled.multimeterConfig) {
        setMultimeter((prev) => ({
          ...prev,
          mode: (compiled.multimeterConfig?.mode as MultimeterState['mode']) || prev.mode,
          redProbeHoleId: compiled.multimeterConfig?.redProbeHoleId,
          blackProbeHoleId: compiled.multimeterConfig?.blackProbeHoleId,
        }));
        if (compiled.multimeterConfig.redProbeHoleId || compiled.multimeterConfig.blackProbeHoleId) {
          setInstrumentTab('DMM');
        }
      }

      applyCircuitUpdate(compiled.components, compiled.wires);
      setSelectedComponentId(null);
      setSelectedWireId(null);
      audioEngine.playPopSound();
    },
    [applyCircuitUpdate]
  );

  // Deep-link preset loading via URL query parameter (e.g. ?preset=pot_lamp, ?preset=3, ?preset=burnout)
  const hasLoadedUrlPreset = useRef(false);
  useEffect(() => {
    if (typeof window !== 'undefined' && !hasLoadedUrlPreset.current) {
      hasLoadedUrlPreset.current = true;
      const params = new URLSearchParams(window.location.search);
      const presetParam = params.get('preset');
      if (presetParam) {
        const presets = getPresetCircuits();
        const norm = presetParam.toLowerCase().trim();
        let found = presets.find((p) => p.id.toLowerCase() === norm);
        if (!found) {
          const num = parseInt(norm, 10);
          if (!isNaN(num) && num >= 1 && num <= presets.length) {
            found = presets[num - 1];
          } else if (norm.includes('burn') || norm.includes('thermal') || norm.includes('overload')) {
            found = presets.find((p) => p.id === 'burnout_demo');
          } else if (norm.includes('pot') || norm.includes('dim') || norm.includes('lamp')) {
            found = presets.find((p) => p.id === 'pot_lamp');
          } else if (norm.includes('spk') || norm.includes('speak') || norm.includes('tone') || norm.includes('audio')) {
            found = presets.find((p) => p.id === 'speaker_osc');
          } else if (norm.includes('led') || norm.includes('basic')) {
            found = presets.find((p) => p.id === 'led_basic');
          }
        }
        if (found) {
          handleSelectPreset(found);
        }
      }
    }
  }, [handleSelectPreset]);

  // Clear Canvas Handler
  const handleClear = () => {
    setActivePresetId('');
    applyCircuitUpdate([], []);
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
          handleSelectPreset(resetPreset);
        }}
        onSelectPreset={handleSelectPreset}
        activePresetId={activePresetId}
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
        selectedItemName={selectedComp?.name || (selectedWire ? 'Jumper Wire' : null)}
        selectedItemType={selectedComp ? 'COMPONENT' : (selectedWire ? 'WIRE' : null)}
        isDrawerOpen={isDrawerOpen}
        onToggleDrawer={() => setIsDrawerOpen(!isDrawerOpen)}
        onOpenControlsGuide={() => setIsControlsGuideOpen(true)}
        isDevModeOpen={isDevModeOpen}
        onToggleDevMode={() => setIsDevModeOpen(!isDevModeOpen)}
        instrumentTab={instrumentTab}
        onToggleInstrument={(tab) => setInstrumentTab(instrumentTab === tab ? 'NONE' : tab)}
        onOpenArduinoIDE={() => handleOpenArduinoIDE()}
        components={components}
        wires={wires}
        onApplyCompiledCircuit={handleApplyCompiledCircuit}
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
            const next = components.map((c) => (c.id === id ? { ...c, state: { ...c.state, ...newState } } : c));
            applyCircuitUpdate(next, wires);
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
          onUpdateValue={(id, val) => {
            const next = components.map((c) => (c.id === id ? { ...c, value: val } : c));
            applyCircuitUpdate(next, wires);
          }}
          onUpdateState={(id, newState) => {
            const next = components.map((c) =>
              c.id === id ? { ...c, state: { ...c.state, ...newState } } : c
            );
            applyCircuitUpdate(next, wires);
          }}
          onResetHealth={(id) => {
            const next = components.map((c) =>
              c.id === id
                ? {
                    ...c,
                    health: 'NORMAL' as const,
                    temperature: ambientTemperature,
                    powerDissipated: 0,
                    voltageDrop: 0,
                    current: 0,
                  }
                : c
            );
            applyCircuitUpdate(next, wires);
          }}
          onDeleteComponent={(id) => {
            deleteComponentAndWires(id);
          }}
          onDeleteWire={(id) => {
            const nextWires = wires.filter((w) => w.id !== id);
            applyCircuitUpdate(components, nextWires);
            setSelectedWireId(null);
            audioEngine.playPopSound();
          }}
          onRotateComponent={(_id, dir) => handleRotateSelected(dir)}
          onOpenArduinoIDE={(comp) => handleOpenArduinoIDE(comp)}
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

        {/* OhmScript Domain-Specific Language Dev Mode Panel */}
        <CodeEditor
          isOpen={isDevModeOpen}
          onClose={() => setIsDevModeOpen(false)}
          components={components}
          wires={wires}
          onApplyCompiledCircuit={handleApplyCompiledCircuit}
          ambientTemperature={ambientTemperature}
          isSimulating={isSimulating}
        />
      </main>

      {/* Interactive Controls & Shortcuts Guide Modal */}
      <ControlsGuideModal
        isOpen={isControlsGuideOpen}
        onClose={() => setIsControlsGuideOpen(false)}
      />

      {/* Arduino C++ Firmware IDE & Programmer Modal */}
      <ArduinoIDEModal
        isOpen={isArduinoIdeOpen}
        onClose={() => setIsArduinoIdeOpen(false)}
        mcuComponent={
          components.find((c) => c.id === arduinoMcuId) ||
          components.find((c) => c.type === 'ARDUINO_NANO' || c.type === 'ARDUINO_UNO_R3' || c.type === 'ESP32_DEVKIT') ||
          null
        }
        onUpdateComponentState={(id, newState) => {
          const next = components.map((c) =>
            c.id === id ? { ...c, state: { ...c.state, ...newState } } : c
          );
          applyCircuitUpdate(next, wires);
        }}
      />
    </div>
  );
}
