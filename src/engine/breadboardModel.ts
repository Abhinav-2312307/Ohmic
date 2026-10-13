import { BreadboardHole, CircuitComponent, JumperWire } from './componentTypes';

export const PITCH = 0.00254; // 2.54 mm (0.1 inch standard pitch)
export const TOTAL_COLUMNS = 63;
export const BREADBOARD_WIDTH = 0.165;  // 165 mm
export const BREADBOARD_HEIGHT = 0.055; // 55 mm
export const SURFACE_Z = 0.0085;        // Height of the top surface

// Pre-calculate all 830 pin coordinates and internal clip groups
export function generateBreadboardHoles(): Map<string, BreadboardHole> {
  const holes = new Map<string, BreadboardHole>();

  const startX = -((TOTAL_COLUMNS - 1) * PITCH) / 2;

  // 1. Terminal Strips: Columns 1 to 63
  // Upper rows: E, D, C, B, A (from trough moving outwards)
  // Lower rows: F, G, H, I, J (from trough moving outwards)
  const upperRows = ['E', 'D', 'C', 'B', 'A'];
  const lowerRows = ['F', 'G', 'H', 'I', 'J'];
  const troughHalfGap = 0.00381; // 7.62mm DIP trough spacing / 2

  for (let col = 1; col <= TOTAL_COLUMNS; col++) {
    const x = startX + (col - 1) * PITCH;

    // Upper rows A-E
    for (let rIdx = 0; rIdx < upperRows.length; rIdx++) {
      const rowName = upperRows[rIdx];
      const y = troughHalfGap + (rIdx + 1) * PITCH;
      const id = `${rowName}${col}`;
      holes.set(id, {
        id,
        column: col,
        row: rowName,
        x,
        y,
        z: SURFACE_Z,
        nodeGroup: `COL_UPPER_${col}`,
        currentVoltage: 0,
      });
    }

    // Lower rows F-J
    for (let rIdx = 0; rIdx < lowerRows.length; rIdx++) {
      const rowName = lowerRows[rIdx];
      const y = -(troughHalfGap + (rIdx + 1) * PITCH);
      const id = `${rowName}${col}`;
      holes.set(id, {
        id,
        column: col,
        row: rowName,
        x,
        y,
        z: SURFACE_Z,
        nodeGroup: `COL_LOWER_${col}`,
        currentVoltage: 0,
      });
    }
  }

  // 2. Power Rails: 50 holes per rail (5 groups of 5 with gaps, or continuous bus)
  const railHoleCount = 50;
  const railStartX = -((railHoleCount - 1) * PITCH * 1.1) / 2;
  const topRailY_Neg = 0.0210;
  const topRailY_Pos = 0.0245;
  const botRailY_Neg = -0.0210;
  const botRailY_Pos = -0.0245;

  for (let i = 1; i <= railHoleCount; i++) {
    const x = railStartX + (i - 1) * PITCH * 1.1;

    // Top Rails
    const topPosId = `TOP_POS_${i}`;
    holes.set(topPosId, {
      id: topPosId,
      column: i,
      row: 'TOP_POS',
      x,
      y: topRailY_Pos,
      z: SURFACE_Z,
      nodeGroup: 'BUS_TOP_POS',
      currentVoltage: 0,
    });

    const topNegId = `TOP_NEG_${i}`;
    holes.set(topNegId, {
      id: topNegId,
      column: i,
      row: 'TOP_NEG',
      x,
      y: topRailY_Neg,
      z: SURFACE_Z,
      nodeGroup: 'BUS_TOP_NEG',
      currentVoltage: 0,
    });

    // Bottom Rails
    const botNegId = `BOT_NEG_${i}`;
    holes.set(botNegId, {
      id: botNegId,
      column: i,
      row: 'BOT_NEG',
      x,
      y: botRailY_Neg,
      z: SURFACE_Z,
      nodeGroup: 'BUS_BOT_NEG',
      currentVoltage: 0,
    });

    const botPosId = `BOT_POS_${i}`;
    holes.set(botPosId, {
      id: botPosId,
      column: i,
      row: 'BOT_POS',
      x,
      y: botRailY_Pos,
      z: SURFACE_Z,
      nodeGroup: 'BUS_BOT_POS',
      currentVoltage: 0,
    });
  }

  return holes;
}

export const BREADBOARD_HOLES = generateBreadboardHoles();

// Coordinate lookup for either breadboard holes or external battery/component terminal pins
export function getTerminalOrHolePosition(
  id: string,
  components?: CircuitComponent[]
): [number, number, number] | null {
  if (BREADBOARD_HOLES.has(id)) {
    const hole = BREADBOARD_HOLES.get(id)!;
    return [hole.x, hole.y, hole.z];
  }

  // Battery terminal format: "componentId:terminal" (e.g. "batt_1:pos", "batt_1:neg")
  if (id.includes(':') && components) {
    const [compId, terminal] = id.split(':');
    const comp = components.find((c) => c.id === compId);
    if (comp) {
      if (comp.type === 'BATTERY_9V' || comp.type === 'DC_SOURCE' || comp.type === 'BATTERY_HOLDER_4AA') {
        const isPos = terminal === 'pos' || terminal === '+' || terminal === 'red';
        const sign = isPos ? 1 : -1;
        const rotY = comp.rotation ? comp.rotation[1] : 0;
        const offsetX = sign * 0.0064 * Math.cos(rotY);
        const offsetZ = sign * 0.0064 * Math.sin(rotY);
        const termX = comp.position[0] + offsetX;
        const termY = comp.position[1] + offsetZ;
        const termZ = comp.type === 'BATTERY_HOLDER_4AA' ? 0.018 : 0.048; // Top terminal height in meters
        return [termX, termY, termZ];
      } else if (comp.type === 'SPEAKER' || comp.type === 'DC_GEAR_MOTOR') {
        const isPos = terminal === 'pos' || terminal === '+' || terminal === 'sp1' || terminal === 'm1' || terminal === 'm_pos';
        const sign = isPos ? -1 : 1; // Left (+) / Right (-)
        const rotY = comp.rotation ? comp.rotation[1] : 0;
        const offsetX = sign * 0.009 * Math.cos(rotY);
        const offsetZ = sign * 0.009 * Math.sin(rotY);
        const termX = comp.position[0] + offsetX;
        const termY = comp.position[1] + offsetZ;
        const termZ = 0.014;
        return [termX, termY, termZ];
      } else if (comp.type === 'SERVO_SG90') {
        const rotY = comp.rotation ? comp.rotation[1] : 0;
        const termIdx = terminal === 'gnd' ? -1 : terminal === 'vcc' ? 0 : 1;
        const offsetX = termIdx * 0.00254 * Math.cos(rotY);
        const offsetZ = termIdx * 0.00254 * Math.sin(rotY);
        return [comp.position[0] + offsetX, comp.position[1] + offsetZ, 0.018];
      } else if (comp.type === 'RELAY_MODULE_5V') {
        const rotY = comp.rotation ? comp.rotation[1] : 0;
        const termMap: Record<string, number> = { vcc: -2, gnd: -1, in: 0, no: 1, com: 2, nc: 3 };
        const idx = termMap[terminal.toLowerCase()] ?? 0;
        const offsetX = idx * 0.0035 * Math.cos(rotY);
        const offsetZ = idx * 0.0035 * Math.sin(rotY);
        return [comp.position[0] + offsetX, comp.position[1] + offsetZ, 0.016];
      } else if (comp.type === 'KEYPAD_4X4') {
        const rotY = comp.rotation ? comp.rotation[1] : 0;
        const keys = ['r1', 'r2', 'r3', 'r4', 'c1', 'c2', 'c3', 'c4'];
        const idx = keys.indexOf(terminal.toLowerCase());
        const offset = (idx >= 0 ? idx - 3.5 : 0) * 0.00254;
        const offsetX = offset * Math.cos(rotY);
        const offsetZ = offset * Math.sin(rotY);
        return [comp.position[0] + offsetX, comp.position[1] + offsetZ, 0.006];
      } else if (comp.type === 'ARDUINO_UNO_R3') {
        const rotY = comp.rotation ? comp.rotation[1] : 0;
        const isPower = terminal === '5v' || terminal === '3v3' || terminal === 'gnd' || terminal === 'vin';
        const sideSign = isPower ? -1 : 1;
        const offsetX = sideSign * 0.025 * Math.cos(rotY);
        const offsetZ = sideSign * 0.025 * Math.sin(rotY);
        return [comp.position[0] + offsetX, comp.position[1] + offsetZ, 0.014];
      }
    }
  }

  return null;
}

// Fast coordinate lookup for any pin or terminal
export function getHolePosition(holeId: string, components?: CircuitComponent[]): [number, number, number] | null {
  return getTerminalOrHolePosition(holeId, components);
}

// Find nearest breadboard hole given Three.js world coordinates (x, z)
export function findNearestHole(threeX: number, threeZ: number, maxDist: number = 0.004): { id: string; x: number; y: number; z: number } | null {
  let nearestId: string | null = null;
  let minDistSq = maxDist * maxDist;

  BREADBOARD_HOLES.forEach((hole) => {
    // In Three.js, horizontal surface is X and Z, where Three Z is hole.y
    const dx = hole.x - threeX;
    const dz = hole.y - threeZ;
    const distSq = dx * dx + dz * dz;
    if (distSq < minDistSq) {
      minDistSq = distSq;
      nearestId = hole.id;
    }
  });

  if (!nearestId) return null;
  const h = BREADBOARD_HOLES.get(nearestId)!;
  return { id: h.id, x: h.x, y: h.y, z: h.z };
}

// Human-readable electrical connection details for HUD
export function getHoleDescription(holeId: string): string {
  if (holeId.startsWith('TOP_POS')) {
    const num = holeId.replace('TOP_POS_', '');
    return `Top Positive Rail (+) Pin ${num} • (Continuous Power Bus)`;
  }
  if (holeId.startsWith('TOP_NEG')) {
    const num = holeId.replace('TOP_NEG_', '');
    return `Top Ground Rail (-) Pin ${num} • (Continuous Ground Bus)`;
  }
  if (holeId.startsWith('BOT_POS')) {
    const num = holeId.replace('BOT_POS_', '');
    return `Bottom Positive Rail (+) Pin ${num} • (Continuous Power Bus)`;
  }
  if (holeId.startsWith('BOT_NEG')) {
    const num = holeId.replace('BOT_NEG_', '');
    return `Bottom Ground Rail (-) Pin ${num} • (Continuous Ground Bus)`;
  }
  const match = holeId.match(/^([A-J])(\d+)$/);
  if (match) {
    const row = match[1];
    const col = match[2];
    const isUpper = ['A', 'B', 'C', 'D', 'E'].includes(row);
    if (isUpper) {
      return `Hole ${holeId} • Col ${col} (Internally connected to A${col}, B${col}, C${col}, D${col}, E${col})`;
    } else {
      return `Hole ${holeId} • Col ${col} (Internally connected to F${col}, G${col}, H${col}, I${col}, J${col})`;
    }
  }
  if (holeId.includes(':pos') || holeId.includes(':+')) {
    return `9V Battery Positive Snap Terminal (+) • +9.0V DC`;
  }
  if (holeId.includes(':neg') || holeId.includes(':-')) {
    return `9V Battery Negative Snap Terminal (-) • 0.0V Ground`;
  }
  return `Hole ${holeId}`;
}

// Height elevation for each component model so leads penetrate into breadboard holes
export function getComponentDefaultElevation(type: string): number {
  switch (type) {
    case 'BATTERY_9V':
    case 'DC_SOURCE':
    case 'BATTERY_HOLDER_4AA':
    case 'SPEAKER':
    case 'DC_GEAR_MOTOR':
    case 'SERVO_SG90':
    case 'ARDUINO_UNO_R3':
    case 'KEYPAD_4X4':
    case 'TOOL_SOLDERING_IRON':
      return 0.0; // Rests on ESD bench mat
    case 'IC_555':
    case 'DIP8_555':
    case 'DIP8_LM358':
    case 'DIP8_LM393':
    case 'DIP16_CD4017':
    case 'DIP16_74HC595':
    case 'DIP16_L293D':
    case 'IC_SOCKET_DIP':
      return 0.0055; // DIP IC pins penetrate into socket, body sits on surface
    case 'ARDUINO_NANO':
    case 'ESP32_DEVKIT':
      return 0.0062; // Dev boards elevated over rows
    case 'POWER_MODULE_MB102':
      return 0.0075; // Sits elevated over breadboard rails
    case 'SWITCH_TACTILE':
    case 'SWITCH_TOGGLE':
    case 'SWITCH_SLIDE':
    case 'BULB_INCANDESCENT':
    case 'DISPLAY_7SEG':
    case 'BUZZER_ACTIVE':
    case 'BUZZER_PASSIVE':
      return 0.0065;
    case 'DISPLAY_OLED_I2C':
    case 'DISPLAY_LCD_1602_I2C':
    case 'SENSOR_HC_SR04':
    case 'SENSOR_DHT22':
    case 'SENSOR_PIR':
    case 'SENSOR_SOUND':
    case 'SENSOR_SOIL':
    case 'MODULE_TB6612FNG':
    case 'RELAY_MODULE_5V':
    case 'MOSFET_DRIVER_MODULE':
    case 'ROTARY_ENCODER_KY040':
    case 'WS2812B_STRIP':
      return 0.0080;
    case 'LED':
    case 'LED_RGB':
    case 'DIODE_1N4148':
    case 'DIODE_1N4007':
    case 'TRANSISTOR_NPN_BC547':
    case 'TRANSISTOR_PNP_BC557':
    case 'TRANSISTOR_NPN_2N2222':
    case 'MOSFET_N_LOGIC':
    case 'LDR_PHOTORESISTOR':
    case 'SENSOR_HALL':
    case 'SENSOR_IR_RECEIVER':
    case 'REGULATOR_AMS1117_3V3':
    case 'SCREW_TERMINAL_2P':
    case 'CAPACITOR_FILM':
    case 'RESISTOR':
    case 'CAPACITOR_ELECTROLYTIC':
    case 'CAPACITOR_CERAMIC':
    case 'POTENTIOMETER':
    case 'INDUCTOR_TOROID':
    default:
      return 0.0068;
  }
}

// Determine target pins for component placement given a starting anchor hole and rotation angle (0 or 90 deg)
export function getComponentFootprint(
  type: string,
  startHoleId: string,
  rotationDeg: number = 0
): { holeIds: string[]; isValid: boolean } {
  const startHole = BREADBOARD_HOLES.get(startHoleId);
  if (!startHole) return { holeIds: [], isValid: false };

  // If start hole is a rail pin
  if (startHole.row.includes('POS') || startHole.row.includes('NEG')) {
    return { holeIds: [startHoleId], isValid: true };
  }

  const rowOrder = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  const currentRowIdx = rowOrder.indexOf(startHole.row);
  const currentCol = startHole.column;

  if (currentRowIdx === -1) return { holeIds: [startHoleId], isValid: false };

  const isHorizontal = rotationDeg === 0 || rotationDeg === 180;

  switch (type) {
    case 'RESISTOR': {
      // 4 holes span (10.16 mm standard pitch)
      if (isHorizontal) {
        const targetCol = currentCol + 4 <= 63 ? currentCol + 4 : currentCol - 4;
        const targetId = `${startHole.row}${targetCol}`;
        if (BREADBOARD_HOLES.has(targetId)) {
          return { holeIds: [startHoleId, targetId], isValid: true };
        }
      } else {
        // Vertical in same section (E->A or F->J)
        const isUpper = currentRowIdx <= 4;
        const targetRowIdx = isUpper
          ? (currentRowIdx + 3 <= 4 ? currentRowIdx + 3 : currentRowIdx - 3)
          : (currentRowIdx + 3 <= 9 ? currentRowIdx + 3 : currentRowIdx - 3);
        const targetId = `${rowOrder[targetRowIdx]}${currentCol}`;
        if (BREADBOARD_HOLES.has(targetId)) {
          return { holeIds: [startHoleId, targetId], isValid: true };
        }
      }
      break;
    }

    case 'LED':
    case 'CAPACITOR_ELECTROLYTIC':
    case 'CAPACITOR_CERAMIC':
    case 'CAPACITOR_FILM':
    case 'BUZZER_ACTIVE':
    case 'BUZZER_PASSIVE':
    case 'SCREW_TERMINAL_2P': {
      // 1 or 2 holes span (2.54mm pitch)
      if (isHorizontal) {
        const targetCol = currentCol + 1 <= 63 ? currentCol + 1 : currentCol - 1;
        const targetId = `${startHole.row}${targetCol}`;
        if (BREADBOARD_HOLES.has(targetId)) {
          return { holeIds: [startHoleId, targetId], isValid: true };
        }
      } else {
        const nextRowIdx = currentRowIdx + 1 <= 9 ? currentRowIdx + 1 : currentRowIdx - 1;
        const targetId = `${rowOrder[nextRowIdx]}${currentCol}`;
        if (BREADBOARD_HOLES.has(targetId)) {
          return { holeIds: [startHoleId, targetId], isValid: true };
        }
      }
      break;
    }

    case 'POTENTIOMETER':
    case 'SWITCH_SLIDE':
    case 'REGULATOR_AMS1117_3V3':
    case 'SENSOR_DHT22':
    case 'SENSOR_PIR':
    case 'SENSOR_SOUND':
    case 'SENSOR_SOIL':
    case 'SENSOR_IR_RECEIVER':
    case 'SENSOR_HALL':
    case 'WS2812B_STRIP': {
      // 3 pins inline
      if (isHorizontal) {
        const c1 = currentCol;
        const c2 = currentCol + 1 <= 63 ? currentCol + 1 : currentCol - 1;
        const c3 = currentCol + 2 <= 63 ? currentCol + 2 : currentCol - 2;
        const id2 = `${startHole.row}${c2}`;
        const id3 = `${startHole.row}${c3}`;
        if (BREADBOARD_HOLES.has(id2) && BREADBOARD_HOLES.has(id3)) {
          return { holeIds: [startHoleId, id2, id3], isValid: true };
        }
      } else {
        const r1 = currentRowIdx;
        const r2 = r1 + 1 <= 9 ? r1 + 1 : r1 - 1;
        const r3 = r1 + 2 <= 9 ? r1 + 2 : r1 - 2;
        const id2 = `${rowOrder[r2]}${currentCol}`;
        const id3 = `${rowOrder[r3]}${currentCol}`;
        if (BREADBOARD_HOLES.has(id2) && BREADBOARD_HOLES.has(id3)) {
          return { holeIds: [startHoleId, id2, id3], isValid: true };
        }
      }
      break;
    }

    case 'LED_RGB':
    case 'DISPLAY_OLED_I2C':
    case 'DISPLAY_LCD_1602_I2C':
    case 'SENSOR_HC_SR04':
    case 'MOSFET_DRIVER_MODULE': {
      // 4 pins inline
      const c1 = currentCol;
      const c2 = currentCol + 1 <= 63 ? currentCol + 1 : currentCol - 1;
      const c3 = currentCol + 2 <= 63 ? currentCol + 2 : currentCol - 2;
      const c4 = currentCol + 3 <= 63 ? currentCol + 3 : currentCol - 3;
      const id2 = `${startHole.row}${c2}`;
      const id3 = `${startHole.row}${c3}`;
      const id4 = `${startHole.row}${c4}`;
      if (BREADBOARD_HOLES.has(id2) && BREADBOARD_HOLES.has(id3) && BREADBOARD_HOLES.has(id4)) {
        return { holeIds: [startHoleId, id2, id3, id4], isValid: true };
      }
      break;
    }

    case 'ROTARY_ENCODER_KY040': {
      // 5 pins inline (CLK, DT, SW, VCC, GND)
      const cols = [currentCol, currentCol + 1, currentCol + 2, currentCol + 3, currentCol + 4];
      if (cols.every((c) => c >= 1 && c <= 63)) {
        return { holeIds: cols.map((c) => `${startHole.row}${c}`), isValid: true };
      }
      break;
    }

    case 'MODULE_TB6612FNG': {
      // 8 pins dual inline
      const col = Math.min(56, Math.max(1, currentCol));
      const holeIds = [
        `E${col}`, `E${col + 1}`, `E${col + 2}`, `E${col + 3}`,
        `F${col}`, `F${col + 1}`, `F${col + 2}`, `F${col + 3}`,
      ];
      return { holeIds, isValid: true };
    }

    case 'SWITCH_TACTILE':
    case 'SWITCH_TOGGLE': {
      // Spans across the trough: Row E to Row F
      const targetId = startHole.row === 'E' ? `F${currentCol}` : startHole.row === 'F' ? `E${currentCol}` : `${startHole.row}${currentCol + 2}`;
      if (BREADBOARD_HOLES.has(targetId)) {
        return { holeIds: [startHoleId, targetId], isValid: true };
      }
      break;
    }

    case 'BULB_INCANDESCENT':
    case 'INDUCTOR_TOROID': {
      const targetCol = currentCol + 2 <= 63 ? currentCol + 2 : currentCol - 2;
      const targetId = `${startHole.row}${targetCol}`;
      if (BREADBOARD_HOLES.has(targetId)) {
        return { holeIds: [startHoleId, targetId], isValid: true };
      }
      break;
    }

    case 'DIP8_555':
    case 'IC_555':
    case 'DIP8_LM358':
    case 'DIP8_LM393': {
      // DIP-8 straddles the central trough across Row E and Row F
      const col = Math.min(60, Math.max(1, currentCol));
      const holeIds = [
        `E${col}`,
        `E${col + 1}`,
        `E${col + 2}`,
        `E${col + 3}`,
        `F${col}`,
        `F${col + 1}`,
        `F${col + 2}`,
        `F${col + 3}`,
      ];
      return { holeIds, isValid: true };
    }

    case 'DIP16_CD4017':
    case 'DIP16_74HC595':
    case 'DIP16_L293D':
    case 'IC_SOCKET_DIP': {
      // DIP-16 straddles the central trough across Row E and Row F over 8 columns
      const col = Math.min(56, Math.max(1, currentCol));
      const holeIds: string[] = [];
      for (let i = 0; i < 8; i++) holeIds.push(`E${col + i}`);
      for (let i = 0; i < 8; i++) holeIds.push(`F${col + i}`);
      return { holeIds, isValid: true };
    }

    case 'ARDUINO_NANO':
    case 'ESP32_DEVKIT': {
      // DIP-30 board straddles central trough over 15 columns
      const col = Math.min(48, Math.max(1, currentCol));
      const holeIds: string[] = [];
      for (let i = 0; i < 15; i++) holeIds.push(`E${col + i}`);
      for (let i = 0; i < 15; i++) holeIds.push(`F${col + i}`);
      return { holeIds, isValid: true };
    }

    case 'DIODE_1N4148':
    case 'DIODE_1N4007': {
      if (isHorizontal) {
        const targetCol = currentCol + 3 <= 63 ? currentCol + 3 : currentCol - 3;
        const targetId = `${startHole.row}${targetCol}`;
        if (BREADBOARD_HOLES.has(targetId)) {
          return { holeIds: [startHoleId, targetId], isValid: true };
        }
      } else {
        const isUpper = currentRowIdx <= 4;
        const targetRowIdx = isUpper
          ? (currentRowIdx + 2 <= 4 ? currentRowIdx + 2 : currentRowIdx - 2)
          : (currentRowIdx + 2 <= 9 ? currentRowIdx + 2 : currentRowIdx - 2);
        const targetId = `${rowOrder[targetRowIdx]}${currentCol}`;
        if (BREADBOARD_HOLES.has(targetId)) {
          return { holeIds: [startHoleId, targetId], isValid: true };
        }
      }
      break;
    }

    case 'TRANSISTOR_NPN_BC547':
    case 'TRANSISTOR_PNP_BC557':
    case 'TRANSISTOR_NPN_2N2222':
    case 'MOSFET_N_LOGIC': {
      if (isHorizontal) {
        const c1 = currentCol;
        const c2 = currentCol + 1 <= 63 ? currentCol + 1 : currentCol - 1;
        const c3 = currentCol + 2 <= 63 ? currentCol + 2 : currentCol - 2;
        const id2 = `${startHole.row}${c2}`;
        const id3 = `${startHole.row}${c3}`;
        if (BREADBOARD_HOLES.has(id2) && BREADBOARD_HOLES.has(id3)) {
          return { holeIds: [startHoleId, id2, id3], isValid: true };
        }
      } else {
        const r1 = currentRowIdx;
        const r2 = r1 + 1 <= 9 ? r1 + 1 : r1 - 1;
        const r3 = r1 + 2 <= 9 ? r1 + 2 : r1 - 2;
        const id2 = `${rowOrder[r2]}${currentCol}`;
        const id3 = `${rowOrder[r3]}${currentCol}`;
        if (BREADBOARD_HOLES.has(id2) && BREADBOARD_HOLES.has(id3)) {
          return { holeIds: [startHoleId, id2, id3], isValid: true };
        }
      }
      break;
    }

    case 'LDR_PHOTORESISTOR': {
      const targetCol = currentCol + 1 <= 63 ? currentCol + 1 : currentCol - 1;
      const targetId = `${startHole.row}${targetCol}`;
      if (BREADBOARD_HOLES.has(targetId)) {
        return { holeIds: [startHoleId, targetId], isValid: true };
      }
      break;
    }

    case 'POWER_MODULE_MB102': {
      return {
        holeIds: ['TOP_POS_1', 'TOP_NEG_1', 'BOT_POS_1', 'BOT_NEG_1'],
        isValid: true,
      };
    }

    case 'DISPLAY_7SEG': {
      const col = Math.min(59, Math.max(1, currentCol));
      const holeIds = [
        `E${col}`,
        `E${col + 1}`,
        `E${col + 2}`,
        `E${col + 3}`,
        `E${col + 4}`,
        `F${col}`,
        `F${col + 1}`,
        `F${col + 2}`,
        `F${col + 3}`,
        `F${col + 4}`,
      ];
      return { holeIds, isValid: true };
    }

    case 'BATTERY_9V':
    case 'DC_SOURCE':
    case 'BATTERY_HOLDER_4AA':
    case 'SPEAKER':
    case 'SERVO_SG90':
    case 'DC_GEAR_MOTOR':
    case 'RELAY_MODULE_5V':
    case 'KEYPAD_4X4':
    case 'ARDUINO_UNO_R3':
    case 'TOOL_SOLDERING_IRON': {
      // Voltage sources & external actuators rest on bench mat; wire leads connect to terminals
      return { holeIds: [], isValid: true };
    }
  }

  // Fallback default: single hole or next column
  const fallbackTarget = `${startHole.row}${currentCol + 1 <= 63 ? currentCol + 1 : currentCol - 1}`;
  if (BREADBOARD_HOLES.has(fallbackTarget)) {
    return { holeIds: [startHoleId, fallbackTarget], isValid: true };
  }
  return { holeIds: [startHoleId], isValid: true };
}

// Rotate a placed component (either CW or CCW by 90 degrees)
export function rotateComponent(
  comp: CircuitComponent,
  direction: 'CW' | 'CCW' = 'CW'
): CircuitComponent {
  if (comp.type === 'BATTERY_9V') {
    const currentRotY = comp.rotation ? comp.rotation[1] : 0;
    const delta = direction === 'CW' ? Math.PI / 2 : -Math.PI / 2;
    const newRotY = (currentRotY + delta + Math.PI * 4) % (Math.PI * 2);
    return {
      ...comp,
      rotation: [comp.rotation[0], newRotY, comp.rotation[2]],
    };
  }

  // For breadboard components, find the primary anchor hole
  const anchorHoleId = comp.pins[0]?.connectedHoleId;
  if (!anchorHoleId || !BREADBOARD_HOLES.has(anchorHoleId)) {
    const currentRotY = comp.rotation ? comp.rotation[1] : 0;
    const delta = direction === 'CW' ? Math.PI / 2 : -Math.PI / 2;
    const newRotY = (currentRotY + delta + Math.PI * 4) % (Math.PI * 2);
    return {
      ...comp,
      rotation: [comp.rotation[0], newRotY, comp.rotation[2]],
    };
  }

  const currentRotDeg = Math.round(((comp.rotation ? comp.rotation[1] : 0) * 180) / Math.PI) % 360;
  // Toggle between 0 deg (horizontal) and 90 deg (vertical)
  const newRotDeg = (currentRotDeg === 0 || currentRotDeg === 180) ? 90 : 0;

  const fp = getComponentFootprint(comp.type, anchorHoleId, newRotDeg);
  if (fp.isValid && fp.holeIds.length > 0) {
    const firstPos = getHolePosition(fp.holeIds[0]);
    const lastPos = getHolePosition(fp.holeIds[fp.holeIds.length - 1]);
    const midX = firstPos && lastPos ? (firstPos[0] + lastPos[0]) / 2 : comp.position[0];
    const midZ = firstPos && lastPos ? (firstPos[1] + lastPos[1]) / 2 : comp.position[1];

    const newPins = comp.pins.map((pin, idx) => ({
      ...pin,
      connectedHoleId: fp.holeIds[idx] || fp.holeIds[0],
    }));

    return {
      ...comp,
      position: [midX, midZ, comp.position[2] || getComponentDefaultElevation(comp.type)],
      rotation: [0, (newRotDeg * Math.PI) / 180, 0],
      pins: newPins,
    };
  }

  // Fallback: update visual angle
  const currentRotY = comp.rotation ? comp.rotation[1] : 0;
  const delta = direction === 'CW' ? Math.PI / 2 : -Math.PI / 2;
  const newRotY = (currentRotY + delta + Math.PI * 4) % (Math.PI * 2);
  return {
    ...comp,
    rotation: [comp.rotation[0], newRotY, comp.rotation[2]],
  };
}

// Move component directly to a target anchor hole
export function moveComponentToHole(
  comp: CircuitComponent,
  targetHoleId: string
): CircuitComponent | null {
  if (comp.type === 'BATTERY_9V') return null;

  const currentRotDeg = Math.round(((comp.rotation ? comp.rotation[1] : 0) * 180) / Math.PI) % 360;
  const fp = getComponentFootprint(comp.type, targetHoleId, currentRotDeg);

  if (!fp.isValid || fp.holeIds.length === 0) return null;

  const firstPos = getHolePosition(fp.holeIds[0]);
  const lastPos = getHolePosition(fp.holeIds[fp.holeIds.length - 1]);
  if (!firstPos || !lastPos) return null;

  const midX = (firstPos[0] + lastPos[0]) / 2;
  const midZ = (firstPos[1] + lastPos[1]) / 2;

  const newPins = comp.pins.map((pin, idx) => ({
    ...pin,
    connectedHoleId: fp.holeIds[idx] || fp.holeIds[0],
  }));

  return {
    ...comp,
    position: [midX, midZ, comp.position[2] || getComponentDefaultElevation(comp.type)],
    pins: newPins,
  };
}

// Nudge component by column and row delta (via Arrow Keys / WASD)
export function nudgeComponent(
  comp: CircuitComponent,
  deltaCol: number,
  deltaRow: number
): CircuitComponent | null {
  if (comp.type === 'BATTERY_9V') {
    // Battery rests on workbench mat
    const step = 0.008; // 8mm per nudge
    const newX = Math.max(-0.25, Math.min(0.25, comp.position[0] + deltaCol * step));
    const newZ = Math.max(-0.16, Math.min(0.16, comp.position[1] + deltaRow * step));
    return {
      ...comp,
      position: [newX, newZ, comp.position[2]],
    };
  }

  const anchorHoleId = comp.pins[0]?.connectedHoleId;
  if (!anchorHoleId) return null;

  // If connected to power rail
  if (anchorHoleId.startsWith('TOP_') || anchorHoleId.startsWith('BOT_')) {
    const parts = anchorHoleId.split('_');
    const railPrefix = `${parts[0]}_${parts[1]}`;
    const colNum = parseInt(parts[2], 10) || 1;
    const newCol = Math.max(1, Math.min(50, colNum + deltaCol));
    const newHoleId = `${railPrefix}_${newCol}`;
    return moveComponentToHole(comp, newHoleId);
  }

  // Terminal strips: A to J, 1 to 63
  const match = anchorHoleId.match(/^([A-J])(\d+)$/);
  if (!match) return null;

  const rowOrder = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  const currentRow = match[1];
  const currentCol = parseInt(match[2], 10);
  const currentRowIdx = rowOrder.indexOf(currentRow);
  if (currentRowIdx === -1) return null;

  const targetCol = Math.max(1, Math.min(TOTAL_COLUMNS, currentCol + deltaCol));
  const targetRowIdx = Math.max(0, Math.min(rowOrder.length - 1, currentRowIdx + deltaRow));
  const newAnchorHoleId = `${rowOrder[targetRowIdx]}${targetCol}`;

  return moveComponentToHole(comp, newAnchorHoleId);
}

// Recompute wire terminal positions when a connected component moves or rotates
export function updateWiresForComponent(
  comp: CircuitComponent,
  allComponents: CircuitComponent[],
  wires: JumperWire[]
): JumperWire[] {
  let hasChange = false;
  const updatedWires = wires.map((w) => {
    const startMatches = w.startHoleId.startsWith(`${comp.id}:`);
    const endMatches = w.endHoleId.startsWith(`${comp.id}:`);

    if (!startMatches && !endMatches) return w;

    hasChange = true;
    const startPos = getHolePosition(w.startHoleId, allComponents) || w.startPos;
    const endPos = getHolePosition(w.endHoleId, allComponents) || w.endPos;

    return {
      ...w,
      startPos,
      endPos,
    };
  });

  return hasChange ? updatedWires : wires;
}

export function isBenchComponent(type: string): boolean {
  return (
    type === 'BATTERY_9V' ||
    type === 'DC_SOURCE' ||
    type === 'BATTERY_HOLDER_4AA' ||
    type === 'SPEAKER' ||
    type === 'DC_GEAR_MOTOR' ||
    type === 'SERVO_SG90' ||
    type === 'RELAY_MODULE_5V' ||
    type === 'KEYPAD_4X4' ||
    type === 'ARDUINO_UNO_R3' ||
    type === 'TOOL_SOLDERING_IRON'
  );
}
