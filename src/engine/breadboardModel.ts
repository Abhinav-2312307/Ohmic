import { BreadboardHole, CircuitComponent } from './componentTypes';

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
      if (comp.type === 'BATTERY_9V') {
        const isPos = terminal === 'pos' || terminal === '+';
        const sign = isPos ? 1 : -1;
        const rotY = comp.rotation ? comp.rotation[1] : 0;
        const offsetX = sign * 0.0064 * Math.cos(rotY);
        const offsetZ = sign * 0.0064 * Math.sin(rotY);
        const termX = comp.position[0] + offsetX;
        const termY = comp.position[1] + offsetZ;
        const termZ = 0.048; // Top terminal height in meters
        return [termX, termY, termZ];
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
    case 'CAPACITOR_CERAMIC': {
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

    case 'POTENTIOMETER': {
      // 3 pins side-by-side
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
        // Vertical
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

    case 'SWITCH_TACTILE': {
      // Spans across the trough: Row E to Row F
      const targetId = startHole.row === 'E' ? `F${currentCol}` : startHole.row === 'F' ? `E${currentCol}` : `${startHole.row}${currentCol + 2}`;
      if (BREADBOARD_HOLES.has(targetId)) {
        return { holeIds: [startHoleId, targetId], isValid: true };
      }
      break;
    }

    case 'BULB_INCANDESCENT':
    case 'SPEAKER':
    case 'INDUCTOR_TOROID': {
      // 2 or 3 holes span
      const targetCol = currentCol + 2 <= 63 ? currentCol + 2 : currentCol - 2;
      const targetId = `${startHole.row}${targetCol}`;
      if (BREADBOARD_HOLES.has(targetId)) {
        return { holeIds: [startHoleId, targetId], isValid: true };
      }
      break;
    }

    case 'BATTERY_9V': {
      // 9V Battery rests outside the board on the bench mat; connect wires to its snap terminals
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
