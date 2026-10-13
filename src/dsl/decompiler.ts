// ─────────────────────────────────────────────────────────────────────────────
// OhmScript Decompiler — CircuitComponent[] + JumperWire[] → OhmScript source
// ─────────────────────────────────────────────────────────────────────────────

import { CircuitComponent, JumperWire } from '../engine/componentTypes';
import { COLOR_NAME_MAP } from './types';

/** Reverse map hex colors to names */
const HEX_TO_NAME: Record<string, string> = {};
for (const [name, hex] of Object.entries(COLOR_NAME_MAP)) {
  HEX_TO_NAME[hex.toLowerCase()] = name;
}

/** Format resistance for OhmScript */
function fmtResistance(ohms: number): string {
  if (ohms >= 1e6) return `${ohms / 1e6}M`;
  if (ohms >= 1000 && ohms % 1000 === 0) return `${ohms / 1000}k`;
  if (ohms >= 1000) return `${(ohms / 1000).toFixed(1)}k`;
  return `${ohms}`;
}

/** Format capacitance for OhmScript */
function fmtCapacitance(farads: number): string {
  if (farads >= 1e-6) return `${Math.round(farads * 1e6)}uF`;
  if (farads >= 1e-9) return `${Math.round(farads * 1e9)}nF`;
  return `${Math.round(farads * 1e12)}pF`;
}

/** Format inductance for OhmScript */
function fmtInductance(henrys: number): string {
  if (henrys >= 1) return `${henrys}H`;
  return `${Math.round(henrys * 1000)}mH`;
}

/** Find closest color name for a hex value */
function colorName(hex: string): string {
  const lower = hex.toLowerCase();
  if (HEX_TO_NAME[lower]) return HEX_TO_NAME[lower];
  // Fuzzy match by checking first characters
  for (const [name, known] of Object.entries(COLOR_NAME_MAP)) {
    if (known.toLowerCase() === lower) return name;
  }
  return hex; // fallback to hex literal
}

/** Get breadboard hole IDs from component pins */
function getPinHoles(comp: CircuitComponent): string[] {
  return comp.pins.map(p => p.connectedHoleId).filter((h): h is string => !!h);
}

/** Determine if a component is placed on the bench (off-board) */
function isOnBench(comp: CircuitComponent): boolean {
  return comp.type === 'BATTERY_9V' || comp.type === 'DC_SOURCE';
}

/** Resolve wire endpoint to OhmScript syntax */
function formatEndpoint(holeId: string, components: CircuitComponent[]): string {
  // Battery terminal: "batt_1:pos" → "BATT1.pos"
  if (holeId.includes(':')) {
    const [compId, terminal] = holeId.split(':');
    const comp = components.find(c => c.id === compId);
    if (comp) {
      return `${comp.id}.${terminal}`;
    }
  }
  return holeId;
}

export interface DecompileOptions {
  title?: string;
  description?: string;
  author?: string;
  version?: string;
  ambientTemperature?: number;
  simulationEnabled?: boolean;
}

/**
 * Convert live circuit state back to OhmScript source code.
 * This enables the bidirectional visual ↔ code workflow.
 */
export function decompile(
  components: CircuitComponent[],
  wires: JumperWire[],
  options?: DecompileOptions,
): string {
  const lines: string[] = [];

  // ── Header ──────────────────────────────────────────────────────────────
  lines.push('# ─── OhmScript v1.0 ─── Auto-generated from Ohmic Workbench ───');
  lines.push('');

  // ── Metadata ────────────────────────────────────────────────────────────
  if (options?.title) {
    lines.push(`@circuit "${options.title}"`);
  }
  if (options?.description) {
    lines.push(`@desc "${options.description}"`);
  }
  if (options?.author) {
    lines.push(`@author "${options.author}"`);
  }
  if (options?.version) {
    lines.push(`@version "${options.version}"`);
  }
  lines.push('');

  // ── Components ──────────────────────────────────────────────────────────
  lines.push('# ── Components ────────────────────────────────────────');

  for (const comp of components) {
    let line = '';

    switch (comp.type) {
      case 'BATTERY_9V':
      case 'DC_SOURCE':
        line = `bat  ${padRight(comp.id, 8)} ${comp.value}V`;
        break;

      case 'RESISTOR': {
        line = `res  ${padRight(comp.id, 8)} ${fmtResistance(comp.value)}`;
        if (comp.maxPowerRating && comp.maxPowerRating !== 0.25) {
          line += ` maxP=${comp.maxPowerRating}W`;
        }
        break;
      }

      case 'LED': {
        const color = (comp.ledColor || 'RED').toLowerCase();
        line = `led  ${padRight(comp.id, 8)} ${color}`;
        if (comp.forwardVoltage) {
          line += ` Vf=${comp.forwardVoltage}V`;
        }
        break;
      }

      case 'POTENTIOMETER': {
        line = `pot  ${padRight(comp.id, 8)} ${fmtResistance(comp.value)}`;
        if (comp.state?.wiperRatio !== undefined) {
          line += ` wiper=${comp.state.wiperRatio}`;
        }
        break;
      }

      case 'BULB_INCANDESCENT':
        line = `bulb ${padRight(comp.id, 8)} ${comp.value}`;
        if (comp.maxPowerRating && comp.maxPowerRating !== 5.0) {
          line += ` maxP=${comp.maxPowerRating}W`;
        }
        break;

      case 'SPEAKER':
        line = `spk  ${padRight(comp.id, 8)} ${comp.value}`;
        if (comp.maxPowerRating && comp.maxPowerRating !== 15.0) {
          line += ` maxP=${comp.maxPowerRating}W`;
        }
        break;

      case 'SWITCH_TACTILE':
        line = `sw   ${padRight(comp.id, 8)} tactile`;
        break;

      case 'SWITCH_TOGGLE':
        line = `sw   ${padRight(comp.id, 8)} toggle`;
        break;

      case 'CAPACITOR_ELECTROLYTIC':
        line = `cap  ${padRight(comp.id, 8)} ${fmtCapacitance(comp.value)} electrolytic`;
        break;

      case 'CAPACITOR_CERAMIC':
        line = `cap  ${padRight(comp.id, 8)} ${fmtCapacitance(comp.value)} ceramic`;
        break;

      case 'INDUCTOR_TOROID':
        line = `ind  ${padRight(comp.id, 8)} ${fmtInductance(comp.value)}`;
        break;

      case 'DIP8_555':
        line = `ic555 ${comp.id}`;
        break;

      case 'DISPLAY_7SEG':
        line = `seg7 ${comp.id}`;
        break;

      case 'DIODE_1N4148':
        line = `diode ${padRight(comp.id, 8)} 1n4148`;
        break;

      case 'DIODE_1N4007':
        line = `diode ${padRight(comp.id, 8)} 1n4007`;
        break;

      case 'TRANSISTOR_NPN_BC547':
        line = `npn  ${padRight(comp.id, 8)} bc547`;
        break;

      case 'TRANSISTOR_NPN_2N2222':
        line = `npn  ${padRight(comp.id, 8)} 2n2222`;
        break;

      case 'TRANSISTOR_PNP_BC557':
        line = `pnp  ${padRight(comp.id, 8)} bc557`;
        break;

      case 'MOSFET_N_LOGIC':
        line = `mosfet ${padRight(comp.id, 8)} irlz44n`;
        break;

      case 'LDR_PHOTORESISTOR':
        line = `ldr  ${padRight(comp.id, 8)} cds`;
        break;

      case 'DIP8_LM358':
        line = `lm358 ${comp.id}`;
        break;

      case 'POWER_MODULE_MB102':
        line = `mb102 ${padRight(comp.id, 8)} 5V`;
        break;

      default:
        line = `# Unknown component type: ${comp.type} ${comp.id}`;
    }

    lines.push(line);
  }

  lines.push('');

  // ── Placement ───────────────────────────────────────────────────────────
  lines.push('# ── Placement ─────────────────────────────────────────');

  for (const comp of components) {
    if (isOnBench(comp)) {
      lines.push(`place ${padRight(comp.id, 8)} bench`);
    } else {
      const holes = getPinHoles(comp);
      if (holes.length === 0) continue;

      // Filter out internal IDs (battery terminal IDs)
      const boardHoles = holes.filter(h => !h.includes(':'));
      if (boardHoles.length === 0) continue;

      if (boardHoles.length <= 2) {
        lines.push(`place ${padRight(comp.id, 8)} ${boardHoles.join('-')}`);
      } else {
        lines.push(`place ${padRight(comp.id, 8)} ${boardHoles.join(':')}`);
      }
    }
  }

  lines.push('');

  // ── Wiring ──────────────────────────────────────────────────────────────
  lines.push('# ── Wiring ────────────────────────────────────────────');

  for (const wire of wires) {
    const from = formatEndpoint(wire.startHoleId, components);
    const to = formatEndpoint(wire.endHoleId, components);
    const color = colorName(wire.color);
    lines.push(`wire ${padRight(from, 18)} -> ${padRight(to, 18)} ${color}`);
  }

  lines.push('');

  // ── State ───────────────────────────────────────────────────────────────
  const stateLines: string[] = [];
  for (const comp of components) {
    if (comp.state?.wiperRatio !== undefined && comp.type === 'POTENTIOMETER') {
      stateLines.push(`set  ${comp.id}.wiper ${comp.state.wiperRatio}`);
    }
    if (comp.state?.isClosed !== undefined) {
      stateLines.push(`set  ${comp.id}.closed ${comp.state.isClosed}`);
    }
    if (comp.state?.frequency !== undefined) {
      stateLines.push(`set  ${comp.id}.frequency ${comp.state.frequency}`);
    }
  }

  if (stateLines.length > 0) {
    lines.push('# ── State ─────────────────────────────────────────────');
    lines.push(...stateLines);
    lines.push('');
  }

  // ── Simulation ──────────────────────────────────────────────────────────
  lines.push('# ── Simulation ────────────────────────────────────────');
  lines.push(`@temp ${options?.ambientTemperature ?? 25}`);
  lines.push(`@sim ${options?.simulationEnabled !== false ? 'on' : 'off'}`);
  lines.push('');

  return lines.join('\n');
}

function padRight(str: string, len: number): string {
  return str + ' '.repeat(Math.max(0, len - str.length));
}
