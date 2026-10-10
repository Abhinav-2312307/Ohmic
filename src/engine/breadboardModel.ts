import { BreadboardHole } from './componentTypes';

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

// Fast coordinate lookup for any pin
export function getHolePosition(holeId: string): [number, number, number] | null {
  const hole = BREADBOARD_HOLES.get(holeId);
  return hole ? [hole.x, hole.y, hole.z] : null;
}
