// ─────────────────────────────────────────────────────────────────────────────
// OhmScript Compiler — AST → CircuitComponent[] + JumperWire[]
// ─────────────────────────────────────────────────────────────────────────────

import {
  OhmScriptAST,
  CompiledCircuit,
  ComponentNode,
  PlacementNode,
  WireNode,
  SetNode,
  ProbeNode,
  DirectiveNode,
  DiagnosticMessage,
  COLOR_NAME_MAP,
} from './types';
import { CircuitComponent, JumperWire, ComponentType, ComponentPin } from '../engine/componentTypes';
import { getHolePosition } from '../engine/breadboardModel';

// ── Value Parsers ────────────────────────────────────────────────────────────

/** Parse values like "9V", "470", "10k", "4.7k", "100uF", "0.25W" */
function parseElectricalValue(raw: string): { value: number; unit: string } {
  if (!raw) return { value: 0, unit: '' };

  // Try value+unit patterns
  const match = raw.match(/^(\d+\.?\d*)(V|Ω|W|uF|µF|nF|pF|mH|H|k|K|M)?$/i);
  if (match) {
    let num = parseFloat(match[1]);
    const unit = match[2] || '';
    const upperUnit = unit.toUpperCase();

    // Handle SI multipliers
    if (upperUnit === 'K') num *= 1000;
    else if (upperUnit === 'M' && !unit.startsWith('m')) num *= 1e6;

    // Handle sub-units
    if (unit === 'uF' || unit === 'µF') return { value: num * 1e-6, unit: 'F' };
    if (unit === 'nF') return { value: num * 1e-9, unit: 'F' };
    if (unit === 'pF') return { value: num * 1e-12, unit: 'F' };
    if (unit === 'mH') return { value: num * 1e-3, unit: 'H' };

    return { value: num, unit: unit.replace(/[kKM]/i, '') || 'Ω' };
  }

  // Plain number
  const n = parseFloat(raw);
  if (!isNaN(n)) return { value: n, unit: '' };

  return { value: 0, unit: '' };
}

/** Resolve color name or hex to hex string */
function resolveColor(color?: string): string {
  if (!color) return '#ef4444'; // default red
  if (color.startsWith('#')) return color;
  return COLOR_NAME_MAP[color.toLowerCase()] || '#ef4444';
}

// ── Component Type Mapping ───────────────────────────────────────────────────

interface ComponentBlueprint {
  type: ComponentType;
  name: string;
  modelUrl: string;
  unit: string;
  defaultValue: number;
  pinTemplate: (holeIds: string[]) => ComponentPin[];
  extraDefaults?: Partial<CircuitComponent>;
}

function getComponentBlueprint(
  dslType: string,
  primaryValue: string,
  options: { key: string; value: string }[],
): ComponentBlueprint {
  const optMap = new Map(options.map(o => [o.key.toLowerCase(), o.value]));

  switch (dslType) {
    case 'bat': {
      const v = parseElectricalValue(primaryValue);
      const voltage = v.value || 9;
      return {
        type: voltage <= 5 ? 'DC_SOURCE' : 'BATTERY_9V',
        name: `${voltage}V Battery`,
        modelUrl: '/models/power/battery_9v.glb',
        unit: 'V',
        defaultValue: voltage,
        pinTemplate: () => [
          { id: 'pos', name: '+', relativePos: [0.0064, 0, 0.048] },
          { id: 'neg', name: '-', relativePos: [-0.0064, 0, 0.048] },
        ],
      };
    }

    case 'res': {
      const v = parseElectricalValue(primaryValue);
      const maxP = optMap.has('maxp') ? parseElectricalValue(optMap.get('maxp')!).value : 0.25;
      return {
        type: 'RESISTOR',
        name: `${formatResistance(v.value)} Resistor`,
        modelUrl: '/models/components/resistor_1k.glb',
        unit: 'Ω',
        defaultValue: v.value || 1000,
        pinTemplate: (holeIds) => [
          { id: 'r1', name: 'Pin 1', relativePos: [-0.00508, 0, 0], connectedHoleId: holeIds[0] },
          { id: 'r2', name: 'Pin 2', relativePos: [0.00508, 0, 0], connectedHoleId: holeIds[1] },
        ],
        extraDefaults: { maxPowerRating: maxP },
      };
    }

    case 'led': {
      const colorStr = primaryValue.toLowerCase();
      const colorMap: Record<string, { color: 'RED' | 'GREEN' | 'BLUE' | 'YELLOW'; vf: number }> = {
        red: { color: 'RED', vf: 1.9 },
        green: { color: 'GREEN', vf: 2.2 },
        blue: { color: 'BLUE', vf: 3.2 },
        yellow: { color: 'YELLOW', vf: 2.1 },
      };
      const mapped = colorMap[colorStr] || colorMap.red;
      const vfOpt = optMap.get('vf');
      const vf = vfOpt ? parseElectricalValue(vfOpt).value : mapped.vf;

      return {
        type: 'LED',
        name: `5mm ${mapped.color} LED`,
        modelUrl: `/models/components/led_5mm_${colorStr}.glb`,
        unit: 'pc',
        defaultValue: 1,
        pinTemplate: (holeIds) => [
          { id: 'l1', name: 'ANODE', relativePos: [-0.00127, 0, 0], connectedHoleId: holeIds[0] },
          { id: 'l2', name: 'CATHODE', relativePos: [0.00127, 0, 0], connectedHoleId: holeIds[1] },
        ],
        extraDefaults: { forwardVoltage: vf, ledColor: mapped.color },
      };
    }

    case 'pot': {
      const v = parseElectricalValue(primaryValue);
      const wiper = optMap.has('wiper') ? parseFloat(optMap.get('wiper')!) : 0.5;
      return {
        type: 'POTENTIOMETER',
        name: `${formatResistance(v.value)} Potentiometer`,
        modelUrl: '/models/components/potentiometer_10k.glb',
        unit: 'Ω',
        defaultValue: v.value || 10000,
        pinTemplate: (holeIds) => [
          { id: 'pt1', name: 'T1', relativePos: [-0.00254, 0, 0], connectedHoleId: holeIds[0] },
          { id: 'ptw', name: 'WIPER', relativePos: [0, 0, 0], connectedHoleId: holeIds[1] },
          { id: 'pt2', name: 'T2', relativePos: [0.00254, 0, 0], connectedHoleId: holeIds[2] },
        ],
        extraDefaults: { state: { wiperRatio: wiper } },
      };
    }

    case 'bulb': {
      const v = parseElectricalValue(primaryValue);
      const maxP = optMap.has('maxp') ? parseElectricalValue(optMap.get('maxp')!).value : 5.0;
      return {
        type: 'BULB_INCANDESCENT',
        name: 'Incandescent Indicator Bulb',
        modelUrl: '/models/components/bulb_incandescent.glb',
        unit: 'Ω',
        defaultValue: v.value || 25,
        pinTemplate: (holeIds) => [
          { id: 'b1', name: 'Terminal 1', relativePos: [-0.00254, 0, 0], connectedHoleId: holeIds[0] },
          { id: 'b2', name: 'Terminal 2', relativePos: [0.00254, 0, 0], connectedHoleId: holeIds[1] },
        ],
        extraDefaults: { maxPowerRating: maxP },
      };
    }

    case 'spk': {
      const v = parseElectricalValue(primaryValue);
      const maxP = optMap.has('maxp') ? parseElectricalValue(optMap.get('maxp')!).value : 15.0;
      return {
        type: 'SPEAKER',
        name: `${v.value || 8}Ω Dynamic Mini Speaker`,
        modelUrl: '/models/components/speaker_8ohm.glb',
        unit: 'Ω',
        defaultValue: v.value || 8,
        pinTemplate: (holeIds) => [
          { id: 'pos', name: '+', relativePos: [-0.009, 0, 0.014], connectedHoleId: holeIds[0] || 'pos' },
          { id: 'neg', name: '-', relativePos: [0.009, 0, 0.014], connectedHoleId: holeIds[1] || 'neg' },
        ],
        extraDefaults: { maxPowerRating: maxP },
      };
    }

    case 'sw': {
      const subtype = primaryValue.toLowerCase();
      const isToggle = subtype === 'toggle';
      return {
        type: isToggle ? 'SWITCH_TOGGLE' : 'SWITCH_TACTILE',
        name: isToggle ? 'Toggle Switch' : 'Tactile Pushbutton',
        modelUrl: '/models/components/button_tactile_6mm.glb',
        unit: 'sw',
        defaultValue: 1,
        pinTemplate: (holeIds) => [
          { id: 'sw1', name: 'Pin 1', relativePos: [-0.002, 0, 0], connectedHoleId: holeIds[0] },
          { id: 'sw2', name: 'Pin 2', relativePos: [0.002, 0, 0], connectedHoleId: holeIds[1] },
        ],
        extraDefaults: { state: { isClosed: false } },
      };
    }

    case 'cap': {
      const v = parseElectricalValue(primaryValue);
      const isElectrolytic = optMap.has('electrolytic') || primaryValue.toLowerCase().includes('uf');
      return {
        type: isElectrolytic ? 'CAPACITOR_ELECTROLYTIC' : 'CAPACITOR_CERAMIC',
        name: isElectrolytic ? `${formatCapacitance(v.value)} Electrolytic Cap` : `${formatCapacitance(v.value)} Ceramic Cap`,
        modelUrl: '/models/components/capacitor_electrolytic.glb',
        unit: 'F',
        defaultValue: v.value || 100e-6,
        pinTemplate: (holeIds) => [
          { id: 'cp1', name: isElectrolytic ? '+' : 'Pin 1', relativePos: [-0.00127, 0, 0], connectedHoleId: holeIds[0] },
          { id: 'cp2', name: isElectrolytic ? '-' : 'Pin 2', relativePos: [0.00127, 0, 0], connectedHoleId: holeIds[1] },
        ],
      };
    }

    case 'ind': {
      const v = parseElectricalValue(primaryValue);
      return {
        type: 'INDUCTOR_TOROID',
        name: `${formatInductance(v.value)} Toroid Inductor`,
        modelUrl: '/models/components/inductor_toroid.glb',
        unit: 'H',
        defaultValue: v.value || 0.01,
        pinTemplate: (holeIds) => [
          { id: 'l1', name: 'Pin 1', relativePos: [-0.00254, 0, 0], connectedHoleId: holeIds[0] },
          { id: 'l2', name: 'Pin 2', relativePos: [0.00254, 0, 0], connectedHoleId: holeIds[1] },
        ],
      };
    }

    case 'ic555':
      return {
        type: 'DIP8_555',
        name: 'NE555 Timer IC',
        modelUrl: '/models/components/dip8_ic.glb',
        unit: 'IC',
        defaultValue: 555,
        pinTemplate: (holeIds) => [
          { id: 'p1', name: 'GND (1)', relativePos: [-0.00381, -0.00381, 0], connectedHoleId: holeIds[0] },
          { id: 'p2', name: 'TRIG (2)', relativePos: [-0.00127, -0.00381, 0], connectedHoleId: holeIds[1] },
          { id: 'p3', name: 'OUT (3)', relativePos: [0.00127, -0.00381, 0], connectedHoleId: holeIds[2] },
          { id: 'p4', name: 'RESET (4)', relativePos: [0.00381, -0.00381, 0], connectedHoleId: holeIds[3] },
          { id: 'p5', name: 'CTRL (5)', relativePos: [-0.00381, 0.00381, 0], connectedHoleId: holeIds[4] },
          { id: 'p6', name: 'THRES (6)', relativePos: [-0.00127, 0.00381, 0], connectedHoleId: holeIds[5] },
          { id: 'p7', name: 'DISCH (7)', relativePos: [0.00127, 0.00381, 0], connectedHoleId: holeIds[6] },
          { id: 'p8', name: 'VCC (8)', relativePos: [0.00381, 0.00381, 0], connectedHoleId: holeIds[7] },
        ],
      };

    case 'seg7':
      return {
        type: 'DISPLAY_7SEG',
        name: '7-Segment LED Display',
        modelUrl: '/models/components/display_7seg_1digit.glb',
        unit: 'DISP',
        defaultValue: 1,
        pinTemplate: (holeIds) =>
          holeIds.map((hid, idx) => ({
            id: `p${idx + 1}`,
            name: `Pin ${idx + 1}`,
            relativePos: [(idx % 5 - 2) * 0.00254, idx < 5 ? -0.00381 : 0.00381, 0] as [number, number, number],
            connectedHoleId: hid,
          })),
      };

    case 'diode': {
      const model = (primaryValue || '').toLowerCase();
      const is1N4007 = model.includes('4007') || optMap.has('4007') || optMap.has('rectifier');
      return {
        type: is1N4007 ? 'DIODE_1N4007' : 'DIODE_1N4148',
        name: is1N4007 ? '1N4007 Rectifier Diode' : '1N4148 High-Speed Signal Diode',
        modelUrl: '',
        unit: 'V',
        defaultValue: is1N4007 ? 0.70 : 0.72,
        pinTemplate: (holeIds) => [
          { id: 'a', name: 'Anode (+)', relativePos: [-0.00381, 0, 0], connectedHoleId: holeIds[0] },
          { id: 'k', name: 'Cathode (-)', relativePos: [0.00381, 0, 0], connectedHoleId: holeIds[1] },
        ],
        extraDefaults: { diodeThreshold: is1N4007 ? 0.70 : 0.72 },
      };
    }

    case 'npn': {
      const model = (primaryValue || '').toLowerCase();
      const is2N2222 = model.includes('2222') || optMap.has('2n2222');
      const hfe = optMap.has('hfe') ? parseElectricalValue(optMap.get('hfe')!).value : (is2N2222 ? 150 : 250);
      return {
        type: is2N2222 ? 'TRANSISTOR_NPN_2N2222' : 'TRANSISTOR_NPN_BC547',
        name: is2N2222 ? '2N2222 NPN BJT' : 'BC547 NPN BJT',
        modelUrl: '',
        unit: 'hFE',
        defaultValue: hfe,
        pinTemplate: (holeIds) => [
          { id: 'c', name: 'Collector (C)', relativePos: [-0.00254, 0, 0], connectedHoleId: holeIds[0] },
          { id: 'b', name: 'Base (B)', relativePos: [0, 0, 0], connectedHoleId: holeIds[1] },
          { id: 'e', name: 'Emitter (E)', relativePos: [0.00254, 0, 0], connectedHoleId: holeIds[2] },
        ],
        extraDefaults: { hfe },
      };
    }

    case 'pnp': {
      const hfe = optMap.has('hfe') ? parseElectricalValue(optMap.get('hfe')!).value : 220;
      return {
        type: 'TRANSISTOR_PNP_BC557',
        name: 'BC557 PNP BJT',
        modelUrl: '',
        unit: 'hFE',
        defaultValue: hfe,
        pinTemplate: (holeIds) => [
          { id: 'c', name: 'Collector (C)', relativePos: [-0.00254, 0, 0], connectedHoleId: holeIds[0] },
          { id: 'b', name: 'Base (B)', relativePos: [0, 0, 0], connectedHoleId: holeIds[1] },
          { id: 'e', name: 'Emitter (E)', relativePos: [0.00254, 0, 0], connectedHoleId: holeIds[2] },
        ],
        extraDefaults: { hfe },
      };
    }

    case 'mosfet': {
      const vth = optMap.has('vth') ? parseElectricalValue(optMap.get('vth')!).value : 2.0;
      const rds = optMap.has('rdson') ? parseElectricalValue(optMap.get('rdson')!).value : 0.05;
      return {
        type: 'MOSFET_N_LOGIC',
        name: 'Logic-Level N-MOSFET (IRLZ44N)',
        modelUrl: '',
        unit: 'A',
        defaultValue: 30,
        pinTemplate: (holeIds) => [
          { id: 'g', name: 'Gate (G)', relativePos: [-0.00254, 0, 0], connectedHoleId: holeIds[0] },
          { id: 'd', name: 'Drain (D)', relativePos: [0, 0, 0], connectedHoleId: holeIds[1] },
          { id: 's', name: 'Source (S)', relativePos: [0.00254, 0, 0], connectedHoleId: holeIds[2] },
        ],
        extraDefaults: { vth, rdsOn: rds },
      };
    }

    case 'ldr': {
      const light = optMap.has('light') ? parseFloat(optMap.get('light')!) : 0.5;
      return {
        type: 'LDR_PHOTORESISTOR',
        name: 'CdS Photoresistor LDR',
        modelUrl: '',
        unit: 'lux',
        defaultValue: 500,
        pinTemplate: (holeIds) => [
          { id: 'p1', name: 'Pin 1', relativePos: [-0.00127, 0, 0], connectedHoleId: holeIds[0] },
          { id: 'p2', name: 'Pin 2', relativePos: [0.00127, 0, 0], connectedHoleId: holeIds[1] },
        ],
        extraDefaults: { lightLevel: light },
      };
    }

    case 'lm358': {
      return {
        type: 'DIP8_LM358',
        name: 'LM358 Dual Op-Amp',
        modelUrl: '/models/components/dip8_ic.glb',
        unit: 'IC',
        defaultValue: 358,
        pinTemplate: (holeIds) => [
          { id: 'p1', name: 'OUT1 (1)', relativePos: [-0.00381, -0.00381, 0], connectedHoleId: holeIds[0] },
          { id: 'p2', name: 'IN1- (2)', relativePos: [-0.00127, -0.00381, 0], connectedHoleId: holeIds[1] },
          { id: 'p3', name: 'IN1+ (3)', relativePos: [0.00127, -0.00381, 0], connectedHoleId: holeIds[2] },
          { id: 'p4', name: 'GND (4)', relativePos: [0.00381, -0.00381, 0], connectedHoleId: holeIds[3] },
          { id: 'p5', name: 'IN2+ (5)', relativePos: [-0.00381, 0.00381, 0], connectedHoleId: holeIds[4] },
          { id: 'p6', name: 'IN2- (6)', relativePos: [-0.00127, 0.00381, 0], connectedHoleId: holeIds[5] },
          { id: 'p7', name: 'OUT2 (7)', relativePos: [0.00127, 0.00381, 0], connectedHoleId: holeIds[6] },
          { id: 'p8', name: 'VCC (8)', relativePos: [0.00381, 0.00381, 0], connectedHoleId: holeIds[7] },
        ],
      };
    }

    case 'mb102': {
      const v = parseElectricalValue(primaryValue);
      return {
        type: 'POWER_MODULE_MB102',
        name: 'MB102 Power Supply Module',
        modelUrl: '',
        unit: 'V',
        defaultValue: v.value || 5.0,
        pinTemplate: (holeIds) => [
          { id: 'vcc_top', name: 'Top VCC (+)', relativePos: [0, -0.016, 0], connectedHoleId: holeIds[0] || 'TOP_POS_1' },
          { id: 'gnd_top', name: 'Top GND (-)', relativePos: [0, -0.0135, 0], connectedHoleId: holeIds[1] || 'TOP_NEG_1' },
          { id: 'vcc_bot', name: 'Bot VCC (+)', relativePos: [0, 0.0135, 0], connectedHoleId: holeIds[2] || 'BOT_POS_1' },
          { id: 'gnd_bot', name: 'Bot GND (-)', relativePos: [0, 0.016, 0], connectedHoleId: holeIds[3] || 'BOT_NEG_1' },
        ],
      };
    }

    default:
      return {
        type: 'RESISTOR',
        name: 'Unknown Component',
        modelUrl: '/models/components/resistor_1k.glb',
        unit: 'Ω',
        defaultValue: 1000,
        pinTemplate: (holeIds) => holeIds.map((hid, idx) => ({
          id: `p${idx}`,
          name: `Pin ${idx + 1}`,
          relativePos: [idx * 0.00254, 0, 0] as [number, number, number],
          connectedHoleId: hid,
        })),
      };
  }
}

// ── Format Helpers ───────────────────────────────────────────────────────────
function formatResistance(ohms: number): string {
  if (ohms >= 1e6) return `${(ohms / 1e6).toFixed(ohms % 1e6 === 0 ? 0 : 1)}MΩ`;
  if (ohms >= 1000) return `${(ohms / 1000).toFixed(ohms % 1000 === 0 ? 0 : 1)}kΩ`;
  return `${ohms}Ω`;
}

function formatCapacitance(farads: number): string {
  if (farads >= 1e-6) return `${(farads * 1e6).toFixed(0)}µF`;
  if (farads >= 1e-9) return `${(farads * 1e9).toFixed(0)}nF`;
  return `${(farads * 1e12).toFixed(0)}pF`;
}

function formatInductance(henrys: number): string {
  if (henrys >= 1) return `${henrys.toFixed(1)}H`;
  return `${(henrys * 1000).toFixed(0)}mH`;
}

// ── Placement Parser ─────────────────────────────────────────────────────────

interface ParsedPlacement {
  mode: 'bench' | '2pin' | '3pin' | 'multi';
  holeIds: string[];
}

function parsePlacementLocation(location: string): ParsedPlacement {
  const loc = location.trim().toLowerCase();
  if (loc === 'bench') {
    return { mode: 'bench', holeIds: [] };
  }

  // 3-pin: "E10:E11:E12"
  if (location.includes(':')) {
    const parts = location.split(':').map(s => s.trim());
    return { mode: parts.length > 3 ? 'multi' : '3pin', holeIds: parts };
  }

  // 2-pin: "E15-E19"
  if (location.includes('-')) {
    const parts = location.split('-').map(s => s.trim());
    return { mode: '2pin', holeIds: parts };
  }

  // Single hole (used as center)
  return { mode: '2pin', holeIds: [location] };
}

// ── Wire Endpoint Resolution ─────────────────────────────────────────────────

function resolveWireEndpoint(endpoint: string, componentMap: Map<string, CircuitComponent>): string {
  // Dotted: "BAT1.pos" → "BAT1:pos" (internal battery terminal ID)
  if (endpoint.includes('.')) {
    const [compId, pinName] = endpoint.split('.');
    const comp = componentMap.get(compId);
    if (comp && (comp.type === 'BATTERY_9V' || comp.type === 'DC_SOURCE' || comp.type === 'SPEAKER')) {
      // Map common pin aliases
      const normalizedPin = pinName.toLowerCase();
      if (normalizedPin === 'pos' || normalizedPin === '+' || normalizedPin === 'positive' || normalizedPin === 'sp1' || normalizedPin === '1') {
        return `${comp.id}:pos`;
      }
      if (normalizedPin === 'neg' || normalizedPin === '-' || normalizedPin === 'negative' || normalizedPin === 'gnd' || normalizedPin === 'sp2' || normalizedPin === '2') {
        return `${comp.id}:neg`;
      }
    }
    // For other components, find the pin by name or id
    if (comp) {
      const pin = comp.pins.find(p =>
        p.name.toLowerCase() === pinName.toLowerCase() ||
        p.id.toLowerCase() === pinName.toLowerCase()
      );
      if (pin?.connectedHoleId) return pin.connectedHoleId;
    }
    return `${compId}:${pinName}`;
  }
  return endpoint;
}

// ── Main Compiler ────────────────────────────────────────────────────────────

export function compile(ast: OhmScriptAST): CompiledCircuit {
  const diagnostics: DiagnosticMessage[] = [...ast.errors];

  // Default circuit metadata
  let title = 'Untitled Circuit';
  let description = '';
  let author = '';
  let version = '1.0';
  let ambientTemperature = 25;
  let simulationEnabled = true;
  let probeMode = 'VOLTS_DC';

  // Battery position on bench mat
  const battX = -0.055;
  const battZ = 0.052;

  // Process directives first
  const directives = ast.nodes.filter(n => n.kind === 'directive') as DirectiveNode[];
  for (const d of directives) {
    switch (d.name) {
      case 'circuit': title = d.value; break;
      case 'description': description = d.value; break;
      case 'author': author = d.value; break;
      case 'version': version = d.value; break;
      case 'temp': ambientTemperature = parseFloat(d.value) || 25; break;
      case 'sim': simulationEnabled = d.value.toLowerCase() !== 'off' && d.value.toLowerCase() !== 'false'; break;
      case 'probe_mode': probeMode = d.value.toUpperCase(); break;
    }
  }

  // Build component map from component declarations
  const componentNodes = ast.nodes.filter(n => n.kind === 'component') as ComponentNode[];
  const placementNodes = ast.nodes.filter(n => n.kind === 'placement') as PlacementNode[];
  const wireNodes = ast.nodes.filter(n => n.kind === 'wire') as WireNode[];
  const setNodes = ast.nodes.filter(n => n.kind === 'set') as SetNode[];
  const probeNodes = ast.nodes.filter(n => n.kind === 'probe') as ProbeNode[];

  // Build placement lookup
  const placementMap = new Map<string, PlacementNode>();
  for (const p of placementNodes) {
    placementMap.set(p.componentId, p);
  }

  // Create CircuitComponent[] from component declarations + placements
  const components: CircuitComponent[] = [];
  const componentMap = new Map<string, CircuitComponent>();
  let batteryCount = 0;

  for (const compNode of componentNodes) {
    const blueprint = getComponentBlueprint(compNode.componentType, compNode.primaryValue, compNode.options);
    const placement = placementMap.get(compNode.id);

    let position: [number, number, number] = [0, 0.00635, 0.0068];
    let holeIds: string[] = [];
    let pinConnections: ComponentPin[] = [];

    if (placement) {
      const parsed = parsePlacementLocation(placement.location);

      if (parsed.mode === 'bench') {
        if (blueprint.type === 'POWER_MODULE_MB102') {
          // MB102 power supply module plugged directly into rails on breadboard left
          position = [-0.082, 0.006, 0.008];
          holeIds = ['TOP_POS_1', 'TOP_NEG_1', 'BOT_POS_1', 'BOT_NEG_1'];
          pinConnections = blueprint.pinTemplate(holeIds);
        } else if (blueprint.type === 'SPEAKER') {
          // Speaker on bench mat outside breadboard (right side)
          position = [0.065, 0.052, 0.0];
          pinConnections = [
            { id: 'pos', name: '+', relativePos: [-0.009, 0, 0.014], connectedHoleId: `${compNode.id}:pos` },
            { id: 'neg', name: '-', relativePos: [0.009, 0, 0.014], connectedHoleId: `${compNode.id}:neg` },
          ];
        } else {
          // Battery / DC power supply on bench mat (left side)
          const bx = battX + batteryCount * 0.03;
          position = [bx, battZ, 0.0];
          batteryCount++;

          // Battery pins get virtual terminal IDs (not breadboard holes)
          pinConnections = blueprint.pinTemplate([]).map(p => ({
            ...p,
            connectedHoleId: p.id === 'pos' ? `${compNode.id}:pos` : `${compNode.id}:neg`,
          }));
        }
      } else {
        holeIds = parsed.holeIds;

        // Calculate 3D position from first hole
        if (holeIds.length > 0) {
          const pos1 = getHolePosition(holeIds[0]);
          if (pos1) {
            if (holeIds.length > 1) {
              const pos2 = getHolePosition(holeIds[holeIds.length - 1]);
              if (pos2) {
                position = [
                  (pos1[0] + pos2[0]) / 2,
                  (pos1[1] + pos2[1]) / 2,
                  0.0068,
                ];
              } else {
                position = [pos1[0], pos1[1], 0.0068];
              }
            } else {
              position = [pos1[0], pos1[1], 0.0068];
            }
          }
        }

        pinConnections = blueprint.pinTemplate(holeIds);
      }
    } else {
      // No placement — warn
      if (blueprint.type !== 'BATTERY_9V' && blueprint.type !== 'DC_SOURCE' && blueprint.type !== 'POWER_MODULE_MB102') {
        diagnostics.push({
          severity: 'warning',
          message: `Component '${compNode.id}' has no placement. Use 'place ${compNode.id} <location>'`,
          line: compNode.loc.line,
          col: compNode.loc.col,
        });
      }
      if (blueprint.type === 'POWER_MODULE_MB102') {
        position = [-0.082, 0.006, 0.008];
        holeIds = ['TOP_POS_1', 'TOP_NEG_1', 'BOT_POS_1', 'BOT_NEG_1'];
        pinConnections = blueprint.pinTemplate(holeIds);
      } else {
        pinConnections = blueprint.pinTemplate([]);
      }
    }

    const comp: CircuitComponent = {
      id: compNode.id,
      type: blueprint.type,
      name: blueprint.name,
      value: blueprint.defaultValue,
      unit: blueprint.unit,
      position,
      rotation: [0, 0, 0],
      modelUrl: blueprint.modelUrl,
      pins: pinConnections,
      voltageDrop: 0,
      current: 0,
      powerDissipated: 0,
      temperature: ambientTemperature,
      health: 'NORMAL',
      ...blueprint.extraDefaults,
    };

    components.push(comp);
    componentMap.set(compNode.id, comp);
  }

  // Apply set commands
  for (const setNode of setNodes) {
    const [compId, prop] = setNode.target.split('.');
    const comp = components.find(c => c.id === compId);
    if (!comp) {
      diagnostics.push({
        severity: 'error',
        message: `Component '${compId}' not found for 'set' command`,
        line: setNode.loc.line,
        col: setNode.loc.col,
      });
      continue;
    }

    const propLower = prop.toLowerCase();
    if (propLower === 'wiper' || propLower === 'wiperratio') {
      comp.state = { ...comp.state, wiperRatio: parseFloat(setNode.value) };
    } else if (propLower === 'closed' || propLower === 'isclosed') {
      comp.state = { ...comp.state, isClosed: setNode.value.toLowerCase() === 'true' };
    } else if (propLower === 'frequency' || propLower === 'freq') {
      comp.state = { ...comp.state, frequency: parseFloat(setNode.value) };
    } else if (propLower === 'value') {
      comp.value = parseElectricalValue(setNode.value).value;
    }
  }

  // Create JumperWire[] from wire declarations
  const wires: JumperWire[] = [];

  for (const wireNode of wireNodes) {
    const from = resolveWireEndpoint(wireNode.from, componentMap);
    const to = resolveWireEndpoint(wireNode.to, componentMap);
    const color = resolveColor(wireNode.color);

    // Resolve 3D positions
    const startPos = getHolePosition(from, components) || [0, 0, 0];
    const endPos = getHolePosition(to, components) || [0, 0, 0];

    const wireId = `w_${wireNode.from.replace(/\./g, '_')}_${wireNode.to.replace(/\./g, '_')}`.toLowerCase();

    wires.push({
      id: wireId,
      startHoleId: from,
      endHoleId: to,
      startPos: startPos as [number, number, number],
      endPos: endPos as [number, number, number],
      color,
      current: 0,
      voltage: 0,
    });
  }

  // Build multimeter config from probe commands
  let multimeterConfig: CompiledCircuit['multimeterConfig'] = undefined;
  const redProbe = probeNodes.find(p => p.probeColor === 'red');
  const blackProbe = probeNodes.find(p => p.probeColor === 'black');
  if (redProbe || blackProbe) {
    multimeterConfig = {
      mode: probeMode,
      redProbeHoleId: redProbe?.holeId,
      blackProbeHoleId: blackProbe?.holeId,
    };
  }

  return {
    title,
    description,
    author,
    version,
    components,
    wires,
    ambientTemperature,
    simulationEnabled,
    multimeterConfig,
    diagnostics,
  };
}
